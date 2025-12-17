use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::STAKER_POOL_SEED;
use crate::errors::TribunalCraftError;

#[derive(Accounts)]
pub struct CreatePool<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = StakerPool::LEN,
        seeds = [STAKER_POOL_SEED, owner.key().as_ref()],
        bump
    )]
    pub staker_pool: Account<'info, StakerPool>,

    pub system_program: Program<'info, System>,
}

pub fn create_pool(ctx: Context<CreatePool>, initial_stake: u64) -> Result<()> {
    let staker_pool = &mut ctx.accounts.staker_pool;
    let clock = Clock::get()?;

    // Transfer initial stake to pool account
    if initial_stake > 0 {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.owner.to_account_info(),
                to: staker_pool.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, initial_stake)?;
    }

    // Initialize pool
    staker_pool.owner = ctx.accounts.owner.key();
    staker_pool.total_stake = initial_stake;
    staker_pool.available = initial_stake;
    staker_pool.held = 0;
    staker_pool.subject_count = 0;
    staker_pool.pending_disputes = 0;
    staker_pool.bump = ctx.bumps.staker_pool;
    staker_pool.created_at = clock.unix_timestamp;
    staker_pool.updated_at = clock.unix_timestamp;

    msg!("Staker pool created with {} lamports", initial_stake);
    Ok(())
}

#[derive(Accounts)]
pub struct StakePool<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner @ TribunalCraftError::Unauthorized,
        seeds = [STAKER_POOL_SEED, owner.key().as_ref()],
        bump = staker_pool.bump
    )]
    pub staker_pool: Account<'info, StakerPool>,

    pub system_program: Program<'info, System>,
}

pub fn stake_pool(ctx: Context<StakePool>, amount: u64) -> Result<()> {
    let staker_pool = &mut ctx.accounts.staker_pool;
    let clock = Clock::get()?;

    require!(amount > 0, TribunalCraftError::StakeBelowMinimum);

    // Transfer stake to pool
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.owner.to_account_info(),
            to: staker_pool.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_context, amount)?;

    // Update pool
    staker_pool.total_stake += amount;
    staker_pool.available += amount;
    staker_pool.updated_at = clock.unix_timestamp;

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
        seeds = [STAKER_POOL_SEED, owner.key().as_ref()],
        bump = staker_pool.bump
    )]
    pub staker_pool: Account<'info, StakerPool>,

    pub system_program: Program<'info, System>,
}

pub fn withdraw_pool(ctx: Context<WithdrawPool>, amount: u64) -> Result<()> {
    let staker_pool = &mut ctx.accounts.staker_pool;
    let clock = Clock::get()?;

    require!(amount <= staker_pool.available, TribunalCraftError::InsufficientAvailableStake);

    // Transfer from pool to owner
    **staker_pool.to_account_info().try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.owner.to_account_info().try_borrow_mut_lamports()? += amount;

    // Update pool
    staker_pool.total_stake -= amount;
    staker_pool.available -= amount;
    staker_pool.updated_at = clock.unix_timestamp;

    msg!("Withdrew {} lamports from pool", amount);
    Ok(())
}
