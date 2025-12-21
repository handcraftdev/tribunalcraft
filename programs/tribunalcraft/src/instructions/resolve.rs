use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::{
    SUBJECT_SEED, DISPUTE_SEED, ESCROW_SEED, PROTOCOL_CONFIG_SEED,
    TOTAL_FEE_BPS, JUROR_SHARE_BPS, PLATFORM_SHARE_BPS,
};
use crate::errors::TribunalCraftError;
use crate::events::DisputeResolvedEvent;

/// Resolve a dispute after voting ends
#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(mut)]
    pub resolver: Signer<'info>,

    #[account(
        mut,
        seeds = [SUBJECT_SEED, subject.subject_id.as_ref()],
        bump = subject.bump,
    )]
    pub subject: Account<'info, Subject>,

    #[account(
        mut,
        seeds = [DISPUTE_SEED, subject.subject_id.as_ref()],
        bump = dispute.bump,
        constraint = dispute.status == DisputeStatus::Pending @ TribunalCraftError::DisputeAlreadyResolved,
    )]
    pub dispute: Account<'info, Dispute>,

    #[account(
        mut,
        seeds = [ESCROW_SEED, subject.subject_id.as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,

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

pub fn resolve_dispute(ctx: Context<ResolveDispute>) -> Result<()> {
    let subject = &mut ctx.accounts.subject;
    let dispute = &mut ctx.accounts.dispute;
    let escrow = &mut ctx.accounts.escrow;
    let clock = Clock::get()?;

    // Ensure voting has ended
    require!(
        dispute.is_voting_ended(clock.unix_timestamp),
        TribunalCraftError::VotingNotEnded
    );

    // Determine outcome
    let outcome = dispute.determine_outcome();

    // Calculate total pool (stake + bond_at_risk) - this is the disputed amount
    let total_pool = dispute.total_stake.saturating_add(dispute.bond_at_risk);
    let total_vote_weight = dispute.votes_for_challenger.saturating_add(dispute.votes_for_defender);

    // Calculate safe bond (available_bond - bond_at_risk) - this is returned to defenders
    let safe_bond = subject.available_bond.saturating_sub(dispute.bond_at_risk);

    // Calculate distribution from total pool (both sides pay fees)
    // For normal outcomes (ChallengerWins/DefenderWins):
    //   - Total fees = 20% of total pool
    //   - Juror pool = 19% of total pool (95% of fees)
    //   - Treasury = 1% of total pool (5% of fees)
    //   - Winner pool = 80% of total pool
    // For NoParticipation:
    //   - Treasury = 1% only (no juror fees since no jurors)
    //   - Refund pool = 99% (returned to both sides proportionally)
    let (treasury_amount, juror_pool, winner_pool) = match outcome {
        ResolutionOutcome::NoParticipation => {
            // Only treasury fee (1%), no juror fee
            // Treasury = 5% of 20% = 1% of total pool
            let total_fees = (total_pool as u128 * TOTAL_FEE_BPS as u128 / 10000) as u64;
            let treasury = (total_fees as u128 * PLATFORM_SHARE_BPS as u128 / 10000) as u64;
            let refund_pool = total_pool.saturating_sub(treasury);
            (treasury, 0u64, refund_pool)
        }
        _ => {
            // Normal fee distribution
            let total_fees = (total_pool as u128 * TOTAL_FEE_BPS as u128 / 10000) as u64;
            let juror = (total_fees as u128 * JUROR_SHARE_BPS as u128 / 10000) as u64;
            let treasury = total_fees.saturating_sub(juror);
            let winner = total_pool.saturating_sub(total_fees);
            (treasury, juror, winner)
        }
    };

    // Transfer treasury fee from subject to treasury
    if treasury_amount > 0 {
        **subject.to_account_info().try_borrow_mut_lamports()? -= treasury_amount;
        **ctx.accounts.treasury.try_borrow_mut_lamports()? += treasury_amount;
    }

    // Transfer remaining pool (winner + juror pools) + safe bond to escrow
    // Safe bond goes to escrow so defenders can claim it back
    let transfer_to_escrow = total_pool.saturating_sub(treasury_amount).saturating_add(safe_bond);
    if transfer_to_escrow > 0 {
        **subject.to_account_info().try_borrow_mut_lamports()? -= transfer_to_escrow;
        **escrow.to_account_info().try_borrow_mut_lamports()? += transfer_to_escrow;
    }

    escrow.balance = escrow.balance.saturating_add(transfer_to_escrow);

    // Update the RoundResult in escrow
    if let Some(round_result) = escrow.find_round_mut(dispute.round) {
        round_result.resolved_at = clock.unix_timestamp;
        round_result.outcome = outcome;
        round_result.total_stake = dispute.total_stake;
        round_result.bond_at_risk = dispute.bond_at_risk;
        round_result.safe_bond = safe_bond;
        round_result.total_vote_weight = total_vote_weight;
        round_result.winner_pool = winner_pool;
        round_result.juror_pool = juror_pool;
        round_result.defender_count = dispute.defender_count;
        round_result.challenger_count = dispute.challenger_count;
        round_result.juror_count = dispute.vote_count;
        // Claims start at 0
        round_result.defender_claims = 0;
        round_result.challenger_claims = 0;
        round_result.juror_claims = 0;
    }

    // Mark dispute as resolved
    dispute.status = DisputeStatus::Resolved;
    dispute.outcome = outcome;
    dispute.resolved_at = clock.unix_timestamp;

    // Update subject based on outcome
    match outcome {
        ResolutionOutcome::ChallengerWins => {
            // Subject is invalidated
            subject.status = SubjectStatus::Invalid;
            subject.last_dispute_total = total_pool;
            subject.last_voting_period = subject.voting_period;
            // Reset bond tracking (bond is now in escrow for claims)
            subject.available_bond = 0;
            subject.defender_count = 0;
        }
        ResolutionOutcome::DefenderWins | ResolutionOutcome::NoParticipation => {
            // Subject continues to next round
            subject.reset_for_next_round();
        }
        ResolutionOutcome::None => {
            // Should not happen
            return Err(TribunalCraftError::InvalidConfig.into());
        }
    }

    subject.updated_at = clock.unix_timestamp;

    emit!(DisputeResolvedEvent {
        subject_id: subject.subject_id,
        round: dispute.round,
        outcome,
        total_stake: dispute.total_stake,
        bond_at_risk: dispute.bond_at_risk,
        winner_pool,
        juror_pool,
        resolved_at: clock.unix_timestamp,
        timestamp: clock.unix_timestamp,
    });

    msg!("Dispute resolved: {:?}, winner_pool={}, juror_pool={}", outcome, winner_pool, juror_pool);
    Ok(())
}
