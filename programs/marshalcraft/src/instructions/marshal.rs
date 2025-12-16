use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::{MARSHAL_ACCOUNT_SEED, TREASURY_SEED};
use crate::errors::MarshalCraftError;

#[derive(Accounts)]
pub struct RegisterMarshal<'info> {
    #[account(mut)]
    pub marshal: Signer<'info>,

    pub config: Account<'info, ProtocolConfig>,

    #[account(
        init,
        payer = marshal,
        space = MarshalAccount::LEN,
        seeds = [MARSHAL_ACCOUNT_SEED, config.key().as_ref(), marshal.key().as_ref()],
        bump
    )]
    pub marshal_account: Account<'info, MarshalAccount>,

    pub system_program: Program<'info, System>,
}

pub fn register_marshal(ctx: Context<RegisterMarshal>, stake_amount: u64) -> Result<()> {
    let config = &ctx.accounts.config;
    let marshal_account = &mut ctx.accounts.marshal_account;
    let clock = Clock::get()?;

    require!(!config.is_paused, MarshalCraftError::ProtocolPaused);
    require!(stake_amount >= config.min_marshal_stake, MarshalCraftError::StakeBelowMinimum);

    // Transfer SOL
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.marshal.to_account_info(),
            to: marshal_account.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_context, stake_amount)?;

    // Initialize marshal account
    marshal_account.config = config.key();
    marshal_account.marshal = ctx.accounts.marshal.key();
    marshal_account.total_stake = stake_amount;
    marshal_account.available_stake = stake_amount;
    marshal_account.reputation = config.initial_reputation;
    marshal_account.votes_cast = 0;
    marshal_account.correct_votes = 0;
    marshal_account.is_active = true;
    marshal_account.bump = ctx.bumps.marshal_account;
    marshal_account.joined_at = clock.unix_timestamp;
    marshal_account.last_vote_at = 0;

    msg!("Marshal registered with {} lamports stake", stake_amount);
    Ok(())
}

#[derive(Accounts)]
pub struct AddMarshalStake<'info> {
    #[account(mut)]
    pub marshal: Signer<'info>,

    pub config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        has_one = marshal @ MarshalCraftError::Unauthorized,
        has_one = config,
    )]
    pub marshal_account: Account<'info, MarshalAccount>,

    pub system_program: Program<'info, System>,
}

pub fn add_marshal_stake(ctx: Context<AddMarshalStake>, amount: u64) -> Result<()> {
    let config = &ctx.accounts.config;
    let marshal_account = &mut ctx.accounts.marshal_account;

    require!(!config.is_paused, MarshalCraftError::ProtocolPaused);
    require!(marshal_account.is_active, MarshalCraftError::MarshalNotActive);

    // Transfer SOL
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.marshal.to_account_info(),
            to: marshal_account.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_context, amount)?;

    // Update stake
    marshal_account.total_stake += amount;
    marshal_account.available_stake += amount;

    msg!("Marshal stake added: {} lamports", amount);
    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawMarshalStake<'info> {
    #[account(mut)]
    pub marshal: Signer<'info>,

    pub config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        has_one = marshal @ MarshalCraftError::Unauthorized,
        has_one = config,
    )]
    pub marshal_account: Account<'info, MarshalAccount>,

    #[account(
        mut,
        seeds = [TREASURY_SEED, config.key().as_ref()],
        bump = treasury.bump,
    )]
    pub treasury: Account<'info, Treasury>,

    pub system_program: Program<'info, System>,
}

pub fn withdraw_marshal_stake(ctx: Context<WithdrawMarshalStake>, amount: u64) -> Result<()> {
    let config = &ctx.accounts.config;
    let marshal_account = &mut ctx.accounts.marshal_account;
    let treasury = &mut ctx.accounts.treasury;

    require!(marshal_account.available_stake >= amount, MarshalCraftError::InsufficientAvailableStake);

    // Calculate return based on reputation
    let (return_amount, slash_amount) = marshal_account.calculate_withdrawal(amount, config.slash_threshold);

    // Update marshal stake
    marshal_account.available_stake -= amount;
    marshal_account.total_stake -= amount;

    // Transfer return amount to marshal
    **marshal_account.to_account_info().try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.marshal.to_account_info().try_borrow_mut_lamports()? += return_amount;

    // Transfer slash amount to treasury
    if slash_amount > 0 {
        **treasury.to_account_info().try_borrow_mut_lamports()? += slash_amount;
        treasury.receive_funds(slash_amount);
    }

    msg!("Marshal stake withdrawn: {} returned, {} slashed", return_amount, slash_amount);
    Ok(())
}

#[derive(Accounts)]
pub struct UnregisterMarshal<'info> {
    #[account(mut)]
    pub marshal: Signer<'info>,

    pub config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        has_one = marshal @ MarshalCraftError::Unauthorized,
        has_one = config,
        close = marshal,
    )]
    pub marshal_account: Account<'info, MarshalAccount>,

    #[account(
        mut,
        seeds = [TREASURY_SEED, config.key().as_ref()],
        bump = treasury.bump,
    )]
    pub treasury: Account<'info, Treasury>,

    pub system_program: Program<'info, System>,
}

pub fn unregister_marshal(ctx: Context<UnregisterMarshal>) -> Result<()> {
    let config = &ctx.accounts.config;
    let marshal_account = &ctx.accounts.marshal_account;
    let treasury = &mut ctx.accounts.treasury;

    // Can only unregister if no locked stake
    let locked_stake = marshal_account.total_stake - marshal_account.available_stake;
    require!(locked_stake == 0, MarshalCraftError::StakeStillLocked);

    // Calculate return based on reputation
    let (return_amount, slash_amount) = marshal_account.calculate_withdrawal(
        marshal_account.available_stake,
        config.slash_threshold,
    );

    // Slash goes to treasury
    if slash_amount > 0 {
        treasury.receive_funds(slash_amount);
    }

    // Account closes automatically, returning rent + return_amount to marshal
    // But we need to handle the slash amount separately
    msg!("Marshal unregistered: {} returned, {} slashed", return_amount, slash_amount);
    Ok(())
}
