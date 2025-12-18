use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::{DISPUTE_SEED, PROTOCOL_CONFIG_SEED, TOTAL_FEE_BPS, PLATFORM_SHARE_BPS};
use crate::errors::TribunalCraftError;

/// Submit a restoration request for an invalidated subject
/// Restoration allows community to reverse previous invalidation decisions
/// Restorer stakes (no bond required), voting period is 2x previous
/// Platform fee (1%) is collected upfront to treasury
#[derive(Accounts)]
pub struct SubmitRestore<'info> {
    #[account(mut)]
    pub restorer: Signer<'info>,

    #[account(
        mut,
        constraint = subject.can_restore() @ TribunalCraftError::SubjectCannotBeRestored,
        constraint = !subject.has_active_dispute() @ TribunalCraftError::DisputeAlreadyExists,
    )]
    pub subject: Account<'info, Subject>,

    #[account(
        init,
        payer = restorer,
        space = Dispute::LEN,
        seeds = [DISPUTE_SEED, subject.key().as_ref(), &subject.dispute_count.to_le_bytes()],
        bump
    )]
    pub dispute: Account<'info, Dispute>,

    /// Protocol config for treasury address
    #[account(
        seeds = [PROTOCOL_CONFIG_SEED],
        bump = protocol_config.bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// Treasury receives platform fee
    /// CHECK: Validated against protocol_config.treasury
    #[account(
        mut,
        constraint = treasury.key() == protocol_config.treasury @ TribunalCraftError::InvalidConfig
    )]
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn submit_restore(
    ctx: Context<SubmitRestore>,
    dispute_type: DisputeType,
    details_cid: String,
    stake_amount: u64,
) -> Result<()> {
    let subject = &mut ctx.accounts.subject;
    let dispute = &mut ctx.accounts.dispute;
    let clock = Clock::get()?;

    // Validate stake meets minimum requirement (previous dispute's stake + bond)
    require!(
        stake_amount >= subject.min_restore_stake(),
        TribunalCraftError::RestoreStakeBelowMinimum
    );

    // Calculate platform fee (1% of total = TOTAL_FEE_BPS * PLATFORM_SHARE_BPS / 10000 / 10000)
    let platform_fee = (stake_amount as u128 * TOTAL_FEE_BPS as u128 * PLATFORM_SHARE_BPS as u128 / 10000 / 10000) as u64;
    let stake_after_fee = stake_amount.saturating_sub(platform_fee);

    // Transfer platform fee to treasury
    if platform_fee > 0 {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.restorer.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, platform_fee)?;
        msg!("Platform fee transferred to treasury: {} lamports", platform_fee);
    }

    // Transfer remaining stake to dispute account
    if stake_after_fee > 0 {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.restorer.to_account_info(),
                to: dispute.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, stake_after_fee)?;
    }

    // Update subject status
    subject.status = SubjectStatus::Restoring;
    subject.dispute = dispute.key();
    subject.dispute_count += 1;
    subject.updated_at = clock.unix_timestamp;

    // Initialize dispute as a restoration request
    dispute.subject = subject.key();
    dispute.dispute_type = dispute_type;
    dispute.total_bond = 0; // Restorations don't have bonds
    dispute.stake_held = 0;
    dispute.direct_stake_held = 0;
    dispute.challenger_count = 0; // No challengers in restorations
    dispute.status = DisputeStatus::Pending;
    dispute.outcome = ResolutionOutcome::None;
    dispute.votes_favor_weight = 0;
    dispute.votes_against_weight = 0;
    dispute.vote_count = 0;
    dispute.resolved_at = 0;
    dispute.bump = ctx.bumps.dispute;
    dispute.created_at = clock.unix_timestamp;
    dispute.pool_reward_claimed = false;

    // Snapshot state for historical record (likely 0 after invalidation)
    dispute.snapshot_total_stake = subject.available_stake;
    dispute.snapshot_defender_count = subject.defender_count;
    dispute.challengers_claimed = 0;
    dispute.defenders_claimed = 0;

    // Restoration-specific fields
    dispute.is_restore = true;
    dispute.restore_stake = stake_amount;
    dispute.restorer = ctx.accounts.restorer.key();
    dispute.details_cid = details_cid.clone();

    // Voting starts immediately with 2x previous voting period
    let restore_voting_period = subject.restore_voting_period();
    dispute.start_voting(clock.unix_timestamp, restore_voting_period);

    msg!(
        "Restoration submitted with {} lamports stake (voting period: {} seconds)",
        stake_amount,
        restore_voting_period
    );
    msg!("Details CID: {}", details_cid);

    Ok(())
}
