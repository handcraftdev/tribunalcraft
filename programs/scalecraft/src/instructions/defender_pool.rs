use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::DEFENDER_POOL_SEED;
use crate::errors::ScaleCraftError;
use crate::events::{PoolDepositEvent, PoolWithdrawEvent, PoolType};

/// Create a defender pool
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

pub fn create_pool(ctx: Context<CreatePool>, initial_amount: u64, max_bond: u64) -> Result<()> {
    let defender_pool = &mut ctx.accounts.defender_pool;
    let clock = Clock::get()?;

    // Transfer initial amount to pool account
    if initial_amount > 0 {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.owner.to_account_info(),
                to: defender_pool.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, initial_amount)?;
    }

    // Initialize pool
    defender_pool.owner = ctx.accounts.owner.key();
    defender_pool.balance = initial_amount;
    defender_pool.max_bond = max_bond;
    defender_pool.bump = ctx.bumps.defender_pool;
    defender_pool.created_at = clock.unix_timestamp;
    defender_pool.updated_at = clock.unix_timestamp;

    if initial_amount > 0 {
        emit!(PoolDepositEvent {
            pool_type: PoolType::Defender,
            owner: ctx.accounts.owner.key(),
            amount: initial_amount,
            timestamp: clock.unix_timestamp,
        });
    }

    msg!("Defender pool created with {} lamports, max_bond={}", initial_amount, max_bond);
    Ok(())
}

/// Deposit to defender pool
#[derive(Accounts)]
pub struct StakePool<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        constraint = defender_pool.owner == owner.key() @ ScaleCraftError::Unauthorized,
        seeds = [DEFENDER_POOL_SEED, owner.key().as_ref()],
        bump = defender_pool.bump
    )]
    pub defender_pool: Account<'info, DefenderPool>,

    pub system_program: Program<'info, System>,
}

pub fn stake_pool(ctx: Context<StakePool>, amount: u64) -> Result<()> {
    let defender_pool = &mut ctx.accounts.defender_pool;
    let clock = Clock::get()?;

    require!(amount > 0, ScaleCraftError::StakeBelowMinimum);

    // Transfer to pool
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.owner.to_account_info(),
            to: defender_pool.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_context, amount)?;

    // Update pool
    defender_pool.deposit(amount);
    defender_pool.updated_at = clock.unix_timestamp;

    emit!(PoolDepositEvent {
        pool_type: PoolType::Defender,
        owner: ctx.accounts.owner.key(),
        amount,
        timestamp: clock.unix_timestamp,
    });

    msg!("Added {} lamports to defender pool", amount);
    Ok(())
}

/// Withdraw from defender pool
#[derive(Accounts)]
pub struct WithdrawPool<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        constraint = defender_pool.owner == owner.key() @ ScaleCraftError::Unauthorized,
        seeds = [DEFENDER_POOL_SEED, owner.key().as_ref()],
        bump = defender_pool.bump
    )]
    pub defender_pool: Account<'info, DefenderPool>,

    pub system_program: Program<'info, System>,
}

pub fn withdraw_pool(ctx: Context<WithdrawPool>, amount: u64) -> Result<()> {
    let defender_pool = &mut ctx.accounts.defender_pool;
    let clock = Clock::get()?;

    require!(amount <= defender_pool.balance, ScaleCraftError::InsufficientAvailableStake);

    // Transfer from pool to owner
    **defender_pool.to_account_info().try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.owner.to_account_info().try_borrow_mut_lamports()? += amount;

    // Update pool
    defender_pool.balance = defender_pool.balance.saturating_sub(amount);
    defender_pool.updated_at = clock.unix_timestamp;

    emit!(PoolWithdrawEvent {
        pool_type: PoolType::Defender,
        owner: ctx.accounts.owner.key(),
        amount,
        slashed: 0,
        timestamp: clock.unix_timestamp,
    });

    msg!("Withdrew {} lamports from defender pool", amount);
    Ok(())
}

/// Update max_bond setting for defender pool
#[derive(Accounts)]
pub struct UpdateMaxBond<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        constraint = defender_pool.owner == owner.key() @ ScaleCraftError::Unauthorized,
        seeds = [DEFENDER_POOL_SEED, owner.key().as_ref()],
        bump = defender_pool.bump
    )]
    pub defender_pool: Account<'info, DefenderPool>,
}

pub fn update_max_bond(ctx: Context<UpdateMaxBond>, new_max_bond: u64) -> Result<()> {
    let defender_pool = &mut ctx.accounts.defender_pool;
    let clock = Clock::get()?;

    defender_pool.max_bond = new_max_bond;
    defender_pool.updated_at = clock.unix_timestamp;

    msg!("Updated max_bond to {} lamports", new_max_bond);
    Ok(())
}
