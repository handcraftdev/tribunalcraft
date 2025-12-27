use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::{JUROR_POOL_SEED, INITIAL_REPUTATION, SLASH_THRESHOLD};
use crate::errors::ScaleCraftError;
use crate::events::{PoolDepositEvent, PoolWithdrawEvent, PoolType};

/// Register as a juror (create JurorPool)
#[derive(Accounts)]
pub struct RegisterJuror<'info> {
    #[account(mut)]
    pub juror: Signer<'info>,

    #[account(
        init,
        payer = juror,
        space = JurorPool::LEN,
        seeds = [JUROR_POOL_SEED, juror.key().as_ref()],
        bump
    )]
    pub juror_pool: Account<'info, JurorPool>,

    pub system_program: Program<'info, System>,
}

pub fn register_juror(ctx: Context<RegisterJuror>, stake_amount: u64) -> Result<()> {
    let juror_pool = &mut ctx.accounts.juror_pool;
    let clock = Clock::get()?;

    // Transfer SOL if any
    if stake_amount > 0 {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.juror.to_account_info(),
                to: juror_pool.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, stake_amount)?;
    }

    // Initialize juror pool
    juror_pool.owner = ctx.accounts.juror.key();
    juror_pool.balance = stake_amount;
    juror_pool.reputation = INITIAL_REPUTATION;
    juror_pool.bump = ctx.bumps.juror_pool;
    juror_pool.created_at = clock.unix_timestamp;

    if stake_amount > 0 {
        emit!(PoolDepositEvent {
            pool_type: PoolType::Juror,
            owner: ctx.accounts.juror.key(),
            amount: stake_amount,
            timestamp: clock.unix_timestamp,
        });
    }

    msg!("Juror registered with {} lamports", stake_amount);
    Ok(())
}

/// Add stake to juror pool
#[derive(Accounts)]
pub struct AddJurorStake<'info> {
    #[account(mut)]
    pub juror: Signer<'info>,

    #[account(
        mut,
        constraint = juror_pool.owner == juror.key() @ ScaleCraftError::Unauthorized,
        seeds = [JUROR_POOL_SEED, juror.key().as_ref()],
        bump = juror_pool.bump
    )]
    pub juror_pool: Account<'info, JurorPool>,

    pub system_program: Program<'info, System>,
}

pub fn add_juror_stake(ctx: Context<AddJurorStake>, amount: u64) -> Result<()> {
    let juror_pool = &mut ctx.accounts.juror_pool;
    let clock = Clock::get()?;

    require!(amount > 0, ScaleCraftError::StakeBelowMinimum);

    // Transfer SOL
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.juror.to_account_info(),
            to: juror_pool.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_context, amount)?;

    // Update balance
    juror_pool.deposit(amount);

    emit!(PoolDepositEvent {
        pool_type: PoolType::Juror,
        owner: ctx.accounts.juror.key(),
        amount,
        timestamp: clock.unix_timestamp,
    });

    msg!("Juror stake added: {} lamports", amount);
    Ok(())
}

/// Withdraw stake from juror pool (with reputation-based slashing)
#[derive(Accounts)]
pub struct WithdrawJurorStake<'info> {
    #[account(mut)]
    pub juror: Signer<'info>,

    #[account(
        mut,
        constraint = juror_pool.owner == juror.key() @ ScaleCraftError::Unauthorized,
        seeds = [JUROR_POOL_SEED, juror.key().as_ref()],
        bump = juror_pool.bump
    )]
    pub juror_pool: Account<'info, JurorPool>,

    pub system_program: Program<'info, System>,
}

pub fn withdraw_juror_stake(ctx: Context<WithdrawJurorStake>, amount: u64) -> Result<()> {
    let juror_pool = &mut ctx.accounts.juror_pool;
    let clock = Clock::get()?;

    require!(juror_pool.balance >= amount, ScaleCraftError::InsufficientAvailableStake);

    // Calculate return based on reputation
    let (return_amount, slash_amount) = juror_pool.calculate_withdrawal(amount, SLASH_THRESHOLD);

    // Update pool balance
    juror_pool.balance = juror_pool.balance.saturating_sub(amount);

    // Transfer return amount to juror (slash amount stays in pool as "dust")
    **juror_pool.to_account_info().try_borrow_mut_lamports()? -= return_amount;
    **ctx.accounts.juror.to_account_info().try_borrow_mut_lamports()? += return_amount;

    emit!(PoolWithdrawEvent {
        pool_type: PoolType::Juror,
        owner: ctx.accounts.juror.key(),
        amount: return_amount,
        slashed: slash_amount,
        timestamp: clock.unix_timestamp,
    });

    msg!("Juror stake withdrawn: {} returned, {} slashed", return_amount, slash_amount);
    Ok(())
}

/// Close juror pool and withdraw all
#[derive(Accounts)]
pub struct UnregisterJuror<'info> {
    #[account(mut)]
    pub juror: Signer<'info>,

    #[account(
        mut,
        constraint = juror_pool.owner == juror.key() @ ScaleCraftError::Unauthorized,
        seeds = [JUROR_POOL_SEED, juror.key().as_ref()],
        bump = juror_pool.bump,
        close = juror,
    )]
    pub juror_pool: Account<'info, JurorPool>,

    pub system_program: Program<'info, System>,
}

pub fn unregister_juror(ctx: Context<UnregisterJuror>) -> Result<()> {
    let juror_pool = &ctx.accounts.juror_pool;

    // Calculate return based on reputation
    let (return_amount, slash_amount) = juror_pool.calculate_withdrawal(
        juror_pool.balance,
        SLASH_THRESHOLD,
    );

    // Slash amount is burned when account closes
    // The close = juror will return remaining lamports

    msg!("Juror unregistered: {} returned, {} slashed", return_amount, slash_amount);
    Ok(())
}
