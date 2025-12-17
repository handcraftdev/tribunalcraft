use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::DEFENDER_POOL_SEED;
use crate::errors::TribunalCraftError;

#[derive(Accounts)]
pub struct CreatePool<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = DefenderPool::LEN,
        seeds = [DEFENDER_POOL_SEED, owner.key().as_ref()],
        bump
    )]
    pub defender_pool: Account<'info, DefenderPool>,

    pub system_program: Program<'info, System>,
}

pub fn create_pool(ctx: Context<CreatePool>, initial_stake: u64) -> Result<()> {
    let defender_pool = &mut ctx.accounts.defender_pool;
    let clock = Clock::get()?;

    // Transfer initial stake to pool account
    if initial_stake > 0 {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.owner.to_account_info(),
                to: defender_pool.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, initial_stake)?;
    }

    // Initialize pool
    defender_pool.owner = ctx.accounts.owner.key();
    defender_pool.total_stake = initial_stake;
    defender_pool.available = initial_stake;
    defender_pool.held = 0;
    defender_pool.subject_count = 0;
    defender_pool.pending_disputes = 0;
    defender_pool.bump = ctx.bumps.defender_pool;
    defender_pool.created_at = clock.unix_timestamp;
    defender_pool.updated_at = clock.unix_timestamp;

    msg!("Defender pool created with {} lamports", initial_stake);
    Ok(())
}

#[derive(Accounts)]
pub struct StakePool<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner @ TribunalCraftError::Unauthorized,
        seeds = [DEFENDER_POOL_SEED, owner.key().as_ref()],
        bump = defender_pool.bump
    )]
    pub defender_pool: Account<'info, DefenderPool>,

    pub system_program: Program<'info, System>,
}

pub fn stake_pool(ctx: Context<StakePool>, amount: u64) -> Result<()> {
    let defender_pool = &mut ctx.accounts.defender_pool;
    let clock = Clock::get()?;

    require!(amount > 0, TribunalCraftError::StakeBelowMinimum);

    // Transfer stake to pool
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.owner.to_account_info(),
            to: defender_pool.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_context, amount)?;

    // Update pool
    defender_pool.total_stake += amount;
    defender_pool.available += amount;
    defender_pool.updated_at = clock.unix_timestamp;

    msg!("Added {} lamports to pool", amount);
    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawPool<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner @ TribunalCraftError::Unauthorized,
        seeds = [DEFENDER_POOL_SEED, owner.key().as_ref()],
        bump = defender_pool.bump
    )]
    pub defender_pool: Account<'info, DefenderPool>,

    pub system_program: Program<'info, System>,
}

pub fn withdraw_pool(ctx: Context<WithdrawPool>, amount: u64) -> Result<()> {
    let defender_pool = &mut ctx.accounts.defender_pool;
    let clock = Clock::get()?;

    require!(amount <= defender_pool.available, TribunalCraftError::InsufficientAvailableStake);

    // Transfer from pool to owner
    **defender_pool.to_account_info().try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.owner.to_account_info().try_borrow_mut_lamports()? += amount;

    // Update pool
    defender_pool.total_stake -= amount;
    defender_pool.available -= amount;
    defender_pool.updated_at = clock.unix_timestamp;

    msg!("Withdrew {} lamports from pool", amount);
    Ok(())
}
