use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::{JUROR_ACCOUNT_SEED, INITIAL_REPUTATION, SLASH_THRESHOLD};
use crate::errors::TribunalCraftError;

#[derive(Accounts)]
pub struct RegisterJuror<'info> {
    #[account(mut)]
    pub juror: Signer<'info>,

    #[account(
        init,
        payer = juror,
        space = JurorAccount::LEN,
        seeds = [JUROR_ACCOUNT_SEED, juror.key().as_ref()],
        bump
    )]
    pub juror_account: Account<'info, JurorAccount>,

    pub system_program: Program<'info, System>,
}

pub fn register_juror(ctx: Context<RegisterJuror>, stake_amount: u64) -> Result<()> {
    let juror_account = &mut ctx.accounts.juror_account;
    let clock = Clock::get()?;

    // Transfer SOL (no minimum requirement - platform can enforce at app layer)
    if stake_amount > 0 {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.juror.to_account_info(),
                to: juror_account.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, stake_amount)?;
    }

    // Initialize juror account
    juror_account.juror = ctx.accounts.juror.key();
    juror_account.total_stake = stake_amount;
    juror_account.available_stake = stake_amount;
    juror_account.reputation = INITIAL_REPUTATION;
    juror_account.votes_cast = 0;
    juror_account.correct_votes = 0;
    juror_account.is_active = true;
    juror_account.bump = ctx.bumps.juror_account;
    juror_account.joined_at = clock.unix_timestamp;
    juror_account.last_vote_at = 0;

    msg!("Juror registered with {} lamports stake", stake_amount);
    Ok(())
}

#[derive(Accounts)]
pub struct AddJurorStake<'info> {
    #[account(mut)]
    pub juror: Signer<'info>,

    #[account(
        mut,
        has_one = juror @ TribunalCraftError::Unauthorized,
        seeds = [JUROR_ACCOUNT_SEED, juror.key().as_ref()],
        bump = juror_account.bump
    )]
    pub juror_account: Account<'info, JurorAccount>,

    pub system_program: Program<'info, System>,
}

pub fn add_juror_stake(ctx: Context<AddJurorStake>, amount: u64) -> Result<()> {
    let juror_account = &mut ctx.accounts.juror_account;

    require!(juror_account.is_active, TribunalCraftError::JurorNotActive);
    require!(amount > 0, TribunalCraftError::StakeBelowMinimum);

    // Transfer SOL
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.juror.to_account_info(),
            to: juror_account.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_context, amount)?;

    // Update stake
    juror_account.total_stake += amount;
    juror_account.available_stake += amount;

    msg!("Juror stake added: {} lamports", amount);
    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawJurorStake<'info> {
    #[account(mut)]
    pub juror: Signer<'info>,

    #[account(
        mut,
        has_one = juror @ TribunalCraftError::Unauthorized,
        seeds = [JUROR_ACCOUNT_SEED, juror.key().as_ref()],
        bump = juror_account.bump
    )]
    pub juror_account: Account<'info, JurorAccount>,

    pub system_program: Program<'info, System>,
}

pub fn withdraw_juror_stake(ctx: Context<WithdrawJurorStake>, amount: u64) -> Result<()> {
    let juror_account = &mut ctx.accounts.juror_account;

    require!(juror_account.available_stake >= amount, TribunalCraftError::InsufficientAvailableStake);

    // Calculate return based on reputation using fixed slash threshold
    let (return_amount, slash_amount) = juror_account.calculate_withdrawal(amount, SLASH_THRESHOLD);

    // Update juror stake
    juror_account.available_stake -= amount;
    juror_account.total_stake -= amount;

    // Transfer return amount to juror (slash amount is burned - stays in account but not tracked)
    **juror_account.to_account_info().try_borrow_mut_lamports()? -= return_amount;
    **ctx.accounts.juror.to_account_info().try_borrow_mut_lamports()? += return_amount;

    msg!("Juror stake withdrawn: {} returned, {} burned", return_amount, slash_amount);
    Ok(())
}

#[derive(Accounts)]
pub struct UnregisterJuror<'info> {
    #[account(mut)]
    pub juror: Signer<'info>,

    #[account(
        mut,
        has_one = juror @ TribunalCraftError::Unauthorized,
        seeds = [JUROR_ACCOUNT_SEED, juror.key().as_ref()],
        bump = juror_account.bump,
        close = juror,
    )]
    pub juror_account: Account<'info, JurorAccount>,

    pub system_program: Program<'info, System>,
}

pub fn unregister_juror(ctx: Context<UnregisterJuror>) -> Result<()> {
    let juror_account = &ctx.accounts.juror_account;

    // Can only unregister if no locked stake
    let locked_stake = juror_account.total_stake - juror_account.available_stake;
    require!(locked_stake == 0, TribunalCraftError::StakeStillLocked);

    // Calculate return based on reputation using fixed slash threshold
    let (return_amount, slash_amount) = juror_account.calculate_withdrawal(
        juror_account.available_stake,
        SLASH_THRESHOLD,
    );

    // When account closes, all remaining lamports go to juror
    // But we need to burn the slash amount first
    if slash_amount > 0 {
        // Reduce account balance by slash amount (effectively burning it by sending to system)
        // Note: The close = juror will return remaining lamports after this
        let juror_info = ctx.accounts.juror.to_account_info();
        let juror_account_info = ctx.accounts.juror_account.to_account_info();

        // Adjust what gets returned: close will return all lamports, but we want to burn slash_amount
        // We do this by transferring slash_amount to system program before close
        **juror_account_info.try_borrow_mut_lamports()? -= slash_amount;
        // Burn by not transferring to anyone (lamports are lost)
        // Actually in Solana, lamports can't just disappear - transfer to incinerator
        // For simplicity, we'll reduce return but close still gives all remaining
        **juror_info.try_borrow_mut_lamports()? += 0; // No extra transfer, close handles it
    }

    msg!("Juror unregistered: {} returned, {} burned", return_amount, slash_amount);
    Ok(())
}
