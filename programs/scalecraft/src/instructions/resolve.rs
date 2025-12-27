use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::{
    SUBJECT_SEED, DISPUTE_SEED, ESCROW_SEED, PROTOCOL_CONFIG_SEED,
    DEFENDER_RECORD_SEED,
    TOTAL_FEE_BPS, JUROR_SHARE_BPS, PLATFORM_SHARE_BPS,
};
use crate::errors::ScaleCraftError;
use crate::events::{DisputeResolvedEvent, BondAddedEvent};

/// Resolve a dispute after voting ends
#[derive(Accounts)]
#[instruction(next_round: u32)]
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
        constraint = dispute.status == DisputeStatus::Pending @ ScaleCraftError::DisputeAlreadyResolved,
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
        constraint = treasury.key() == protocol_config.treasury @ ScaleCraftError::InvalidConfig
    )]
    pub treasury: AccountInfo<'info>,

    /// Optional: Creator's defender pool to check for auto-rebond
    /// CHECK: Validated in handler if present
    #[account(mut)]
    pub creator_defender_pool: Option<UncheckedAccount<'info>>,

    /// Optional: Creator's defender record - initialized via init_if_needed
    /// Uses subject.creator and next_round for PDA seeds
    #[account(
        init_if_needed,
        payer = resolver,
        space = DefenderRecord::LEN,
        seeds = [
            DEFENDER_RECORD_SEED,
            subject.subject_id.as_ref(),
            subject.creator.as_ref(),
            &next_round.to_le_bytes()
        ],
        bump
    )]
    pub creator_defender_record: Option<Account<'info, DefenderRecord>>,

    pub system_program: Program<'info, System>,
}

pub fn resolve_dispute(ctx: Context<ResolveDispute>, next_round: u32) -> Result<()> {
    let subject = &mut ctx.accounts.subject;
    let dispute = &mut ctx.accounts.dispute;

    // Validate next_round matches expected value
    require!(
        next_round == subject.round + 1,
        ScaleCraftError::InvalidConfig
    );
    let escrow = &mut ctx.accounts.escrow;
    let clock = Clock::get()?;

    // Ensure voting has ended
    require!(
        dispute.is_voting_ended(clock.unix_timestamp),
        ScaleCraftError::VotingNotEnded
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
    // Handle restoration disputes differently - outcomes have reversed meaning
    if dispute.is_restore {
        match outcome {
            ResolutionOutcome::ChallengerWins => {
                // Restoration succeeded - subject is restored to valid
                // Note: In restorations, "challenger" is the restorer
                subject.reset_for_next_round();
                subject.status = SubjectStatus::Valid;

                // Reset dispute status to allow new disputes on this subject
                dispute.status = DisputeStatus::None;

                // Auto-rebond from creator's pool if available
                auto_rebond_from_pool(
                    subject,
                    &ctx.accounts.creator_defender_pool,
                    &mut ctx.accounts.creator_defender_record,
                    clock.unix_timestamp,
                )?;
            }
            ResolutionOutcome::DefenderWins | ResolutionOutcome::NoParticipation => {
                // Restoration failed - subject stays invalid
                // Reset tracking for potential future restoration attempts
                subject.last_dispute_total = total_pool;
                subject.dispute = Pubkey::default();
                subject.status = SubjectStatus::Invalid;
            }
            ResolutionOutcome::None => {
                return Err(ScaleCraftError::InvalidConfig.into());
            }
        }
    } else {
        // Normal dispute resolution
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

                // Reset dispute status to allow new disputes on this subject
                dispute.status = DisputeStatus::None;

                // Auto-rebond from creator's pool if available
                auto_rebond_from_pool(
                    subject,
                    &ctx.accounts.creator_defender_pool,
                    &mut ctx.accounts.creator_defender_record,
                    clock.unix_timestamp,
                )?;
            }
            ResolutionOutcome::None => {
                return Err(ScaleCraftError::InvalidConfig.into());
            }
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

/// Auto-rebond from creator's defender pool if available
/// Uses Anchor's init_if_needed - record is already created by Anchor if needed
fn auto_rebond_from_pool<'info>(
    subject: &mut Account<'info, Subject>,
    creator_pool: &Option<UncheckedAccount<'info>>,
    creator_record: &mut Option<Account<'info, DefenderRecord>>,
    timestamp: i64,
) -> Result<()> {
    // Check if pool is provided
    let pool_info = match creator_pool {
        Some(p) => p,
        None => return Ok(()), // No pool provided, stay dormant
    };

    // Check if record was created by Anchor
    let record = match creator_record {
        Some(r) => r,
        None => return Ok(()), // No record, stay dormant
    };

    // Skip if pool account is not owned by our program
    if pool_info.owner != &crate::ID {
        return Ok(()); // Not a valid pool account, stay dormant
    }

    // Try to read pool data
    let pool_data = pool_info.try_borrow_data()?;
    if pool_data.len() < 8 + 32 + 8 {
        return Ok(()); // Invalid account data
    }

    // Parse pool data
    let pool_balance = u64::from_le_bytes(pool_data[8+32..8+32+8].try_into().unwrap_or([0; 8]));
    let pool_owner = Pubkey::try_from(&pool_data[8..8+32]).unwrap_or_default();
    drop(pool_data);

    // Pool must have balance
    if pool_balance == 0 {
        return Ok(()); // No balance, stay dormant
    }

    // Initialize the defender record (Anchor already created the account)
    record.subject_id = subject.subject_id;
    record.defender = pool_owner;
    record.round = subject.round;
    record.bond = 0; // Pool-backed, no direct bond
    record.source = BondSource::Pool;
    record.reward_claimed = false;
    record.bonded_at = timestamp;

    // Update subject state
    subject.defender_count = 1;
    subject.status = SubjectStatus::Valid;

    emit!(BondAddedEvent {
        subject_id: subject.subject_id,
        defender: pool_owner,
        round: subject.round,
        amount: 0,
        source: BondSource::Pool,
        timestamp,
    });

    msg!("Auto-rebonded from creator's pool (pool-backed)");
    Ok(())
}
