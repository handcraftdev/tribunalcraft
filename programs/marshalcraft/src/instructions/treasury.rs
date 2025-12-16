use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::TREASURY_SEED;
use crate::errors::MarshalCraftError;

#[derive(Accounts)]
pub struct WithdrawTreasury<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        has_one = authority @ MarshalCraftError::Unauthorized,
        has_one = treasury,
    )]
    pub config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        seeds = [TREASURY_SEED, config.key().as_ref()],
        bump = treasury.bump,
    )]
    pub treasury: Account<'info, Treasury>,

    /// CHECK: Recipient for treasury withdrawal
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn withdraw_treasury(ctx: Context<WithdrawTreasury>, amount: u64) -> Result<()> {
    let treasury = &mut ctx.accounts.treasury;

    require!(treasury.balance >= amount, MarshalCraftError::InsufficientTreasuryBalance);

    // Update treasury balance
    treasury.balance -= amount;

    // Transfer SOL to recipient
    **treasury.to_account_info().try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.recipient.to_account_info().try_borrow_mut_lamports()? += amount;

    msg!("Treasury withdrawal: {} lamports to {}", amount, ctx.accounts.recipient.key());
    Ok(())
}
