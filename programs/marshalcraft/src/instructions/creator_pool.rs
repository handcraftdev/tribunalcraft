use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::CREATOR_POOL_SEED;
use crate::errors::MarshalCraftError;

#[derive(Accounts)]
pub struct StakeCreatorPool<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    pub config: Account<'info, ProtocolConfig>,

    #[account(
        init_if_needed,
        payer = creator,
        space = CreatorPool::LEN,
        seeds = [CREATOR_POOL_SEED, config.key().as_ref(), creator.key().as_ref()],
        bump
    )]
    pub creator_pool: Account<'info, CreatorPool>,

    pub system_program: Program<'info, System>,
}

pub fn stake_creator_pool(ctx: Context<StakeCreatorPool>, amount: u64) -> Result<()> {
    let config = &ctx.accounts.config;
    let pool = &mut ctx.accounts.creator_pool;
    let clock = Clock::get()?;

    require!(!config.is_paused, MarshalCraftError::ProtocolPaused);

    // Initialize if new
    if pool.created_at == 0 {
        pool.config = config.key();
        pool.creator = ctx.accounts.creator.key();
        pool.bump = ctx.bumps.creator_pool;
        pool.created_at = clock.unix_timestamp;
    }

    // Validate minimum
    let new_total = pool.total_stake + amount;
    require!(new_total >= config.min_creator_pool, MarshalCraftError::StakeBelowMinimum);

    // Transfer SOL
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.creator.to_account_info(),
            to: pool.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_context, amount)?;

    // Update pool
    pool.total_stake += amount;
    pool.available += amount;
    pool.updated_at = clock.unix_timestamp;

    msg!("Creator pool staked: {} lamports", amount);
    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawCreatorPool<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    pub config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        has_one = creator @ MarshalCraftError::Unauthorized,
        has_one = config,
    )]
    pub creator_pool: Account<'info, CreatorPool>,

    pub system_program: Program<'info, System>,
}

pub fn withdraw_creator_pool(ctx: Context<WithdrawCreatorPool>, amount: u64) -> Result<()> {
    let pool = &mut ctx.accounts.creator_pool;
    let clock = Clock::get()?;

    require!(pool.available >= amount, MarshalCraftError::InsufficientAvailableStake);

    // Update pool first
    pool.available -= amount;
    pool.total_stake -= amount;
    pool.updated_at = clock.unix_timestamp;

    // Transfer SOL back to creator
    **pool.to_account_info().try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.creator.to_account_info().try_borrow_mut_lamports()? += amount;

    msg!("Creator pool withdrawn: {} lamports", amount);
    Ok(())
}
