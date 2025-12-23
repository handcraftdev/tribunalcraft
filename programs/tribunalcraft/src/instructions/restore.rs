use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::{
    SUBJECT_SEED, DISPUTE_SEED, ESCROW_SEED, CHALLENGER_RECORD_SEED,
};
use crate::errors::TribunalCraftError;
use crate::events::RestoreSubmittedEvent;

/// Submit a restoration request for an invalidated subject
/// Restoration allows community to reverse previous invalidation decisions
/// Restorer stakes (no bond required), voting period is 2x previous
/// Fees are collected during resolution from total pool
#[derive(Accounts)]
pub struct SubmitRestore<'info> {
    #[account(mut)]
    pub restorer: Signer<'info>,

    #[account(
        mut,
        seeds = [SUBJECT_SEED, subject.subject_id.as_ref()],
        bump = subject.bump,
        constraint = subject.can_restore() @ TribunalCraftError::SubjectCannotBeRestored,
    )]
    pub subject: Account<'info, Subject>,

    #[account(
        mut,
        seeds = [DISPUTE_SEED, subject.subject_id.as_ref()],
        bump = dispute.bump,
        constraint = dispute.status == DisputeStatus::Resolved @ TribunalCraftError::DisputeAlreadyExists,
    )]
    pub dispute: Account<'info, Dispute>,

    #[account(
        mut,
        seeds = [ESCROW_SEED, subject.subject_id.as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,

    /// Challenger record for the restorer (acts as first challenger)
    #[account(
        init,
        payer = restorer,
        space = ChallengerRecord::LEN,
        seeds = [
            CHALLENGER_RECORD_SEED,
            subject.subject_id.as_ref(),
            restorer.key().as_ref(),
            &(subject.round + 1).to_le_bytes()  // Next round
        ],
        bump
    )]
    pub challenger_record: Account<'info, ChallengerRecord>,

    pub system_program: Program<'info, System>,
}

pub fn submit_restore(
    ctx: Context<SubmitRestore>,
    dispute_type: DisputeType,
    details_cid: String,
    stake_amount: u64,
) -> Result<()> {
    require!(details_cid.len() <= Dispute::MAX_CID_LEN, TribunalCraftError::InvalidConfig);

    let subject = &mut ctx.accounts.subject;
    let dispute = &mut ctx.accounts.dispute;
    let escrow = &mut ctx.accounts.escrow;
    let challenger_record = &mut ctx.accounts.challenger_record;
    let clock = Clock::get()?;

    // Validate stake meets minimum requirement (previous dispute's stake + bond)
    require!(
        stake_amount >= subject.min_restore_stake(),
        TribunalCraftError::RestoreStakeBelowMinimum
    );

    // Transfer full stake to subject PDA (fees taken during resolution)
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.restorer.to_account_info(),
            to: subject.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_context, stake_amount)?;

    // Increment round for restoration
    let new_round = subject.round + 1;
    subject.round = new_round;
    subject.status = SubjectStatus::Restoring;
    subject.updated_at = clock.unix_timestamp;

    // Realloc escrow for new round - need to pay for additional rent
    let new_size = Escrow::size_for_rounds(escrow.rounds.len() + 1);
    let current_size = escrow.to_account_info().data_len();
    let rent = Rent::get()?;
    let current_rent = rent.minimum_balance(current_size);
    let new_rent = rent.minimum_balance(new_size);
    let rent_diff = new_rent.saturating_sub(current_rent);

    // Transfer rent difference from restorer to escrow
    if rent_diff > 0 {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.restorer.to_account_info(),
                to: escrow.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, rent_diff)?;
    }

    // Now resize the escrow account
    escrow.to_account_info().resize(new_size)?;

    // Add new round result slot
    escrow.rounds.push(RoundResult {
        round: new_round,
        creator: subject.creator,
        resolved_at: 0,
        outcome: ResolutionOutcome::None,
        total_stake: stake_amount,
        bond_at_risk: 0, // No bond at risk for restoration
        safe_bond: 0,    // No safe bond for restoration
        total_vote_weight: 0,
        winner_pool: 0,
        juror_pool: 0,
        defender_count: 0,
        challenger_count: 1,
        juror_count: 0,
        defender_claims: 0,
        challenger_claims: 0,
        juror_claims: 0,
        is_restore: true, // Mark as restoration round
    });

    // Reset dispute for restoration
    dispute.round = new_round;
    dispute.status = DisputeStatus::Pending;
    dispute.dispute_type = dispute_type;
    dispute.total_stake = stake_amount;
    dispute.bond_at_risk = 0; // No bond at risk
    dispute.defender_count = 0;
    dispute.challenger_count = 1;
    dispute.votes_for_challenger = 0;
    dispute.votes_for_defender = 0;
    dispute.vote_count = 0;
    dispute.outcome = ResolutionOutcome::None;
    dispute.resolved_at = 0;
    dispute.details_cid = details_cid.clone();
    dispute.is_restore = true;
    dispute.restore_stake = stake_amount;
    dispute.restorer = ctx.accounts.restorer.key();

    // Voting starts immediately with 2x previous voting period
    let restore_voting_period = subject.restore_voting_period();
    dispute.start_voting(clock.unix_timestamp, restore_voting_period);

    // Initialize challenger record for restorer
    challenger_record.subject_id = subject.subject_id;
    challenger_record.challenger = ctx.accounts.restorer.key();
    challenger_record.round = new_round;
    challenger_record.stake = stake_amount;
    challenger_record.reward_claimed = false;
    challenger_record.bump = ctx.bumps.challenger_record;
    challenger_record.challenged_at = clock.unix_timestamp;
    challenger_record.details_cid = details_cid.clone();

    emit!(RestoreSubmittedEvent {
        subject_id: subject.subject_id,
        round: new_round,
        restorer: ctx.accounts.restorer.key(),
        stake: stake_amount,
        details_cid,
        voting_period: restore_voting_period,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Restoration submitted for round {} with {} lamports stake (voting period: {} seconds)",
        new_round,
        stake_amount,
        restore_voting_period
    );

    Ok(())
}
