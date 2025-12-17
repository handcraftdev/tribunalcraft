use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::DISPUTE_SEED;
use crate::errors::TribunalCraftError;

/// Submit an appeal against an invalidated subject
/// Appeals allow community to reverse previous decisions
/// Appellant stakes (no bond required), voting period is 2x previous
#[derive(Accounts)]
pub struct SubmitAppeal<'info> {
    #[account(mut)]
    pub appellant: Signer<'info>,

    #[account(
        mut,
        constraint = subject.can_appeal() @ TribunalCraftError::SubjectCannotBeAppealed,
        constraint = !subject.has_active_dispute() @ TribunalCraftError::DisputeAlreadyExists,
    )]
    pub subject: Account<'info, Subject>,

    #[account(
        init,
        payer = appellant,
        space = Dispute::LEN,
        seeds = [DISPUTE_SEED, subject.key().as_ref(), &subject.dispute_count.to_le_bytes()],
        bump
    )]
    pub dispute: Account<'info, Dispute>,

    pub system_program: Program<'info, System>,
}

pub fn submit_appeal(
    ctx: Context<SubmitAppeal>,
    dispute_type: DisputeType,
    details_cid: String,
    stake_amount: u64,
) -> Result<()> {
    let subject = &mut ctx.accounts.subject;
    let dispute = &mut ctx.accounts.dispute;
    let clock = Clock::get()?;

    // Validate stake meets minimum requirement (previous dispute's stake + bond)
    require!(
        stake_amount >= subject.min_appeal_stake(),
        TribunalCraftError::AppealStakeBelowMinimum
    );

    // Transfer stake to dispute account
    if stake_amount > 0 {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.appellant.to_account_info(),
                to: dispute.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, stake_amount)?;
    }

    // Update subject status
    subject.status = SubjectStatus::Disputed;
    subject.dispute = dispute.key();
    subject.dispute_count += 1;
    subject.updated_at = clock.unix_timestamp;

    // Initialize dispute as an appeal
    dispute.subject = subject.key();
    dispute.dispute_type = dispute_type;
    dispute.total_bond = 0; // Appeals don't have bonds
    dispute.stake_held = 0;
    dispute.direct_stake_held = 0;
    dispute.challenger_count = 0; // No challengers in appeals
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
    dispute.snapshot_total_stake = subject.total_stake;
    dispute.snapshot_defender_count = subject.defender_count;
    dispute.challengers_claimed = 0;
    dispute.defenders_claimed = 0;

    // Appeal-specific fields
    dispute.is_appeal = true;
    dispute.appeal_stake = stake_amount;

    // Voting starts immediately with 2x previous voting period
    let appeal_voting_period = subject.appeal_voting_period();
    dispute.start_voting(clock.unix_timestamp, appeal_voting_period);

    msg!(
        "Appeal submitted with {} lamports stake (voting period: {} seconds)",
        stake_amount,
        appeal_voting_period
    );
    msg!("Details CID: {}", details_cid);

    Ok(())
}
