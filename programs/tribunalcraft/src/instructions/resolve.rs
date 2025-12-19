use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::{
    stacked_sigmoid, REPUTATION_GAIN_RATE, REPUTATION_LOSS_RATE,
    JUROR_ACCOUNT_SEED, CHALLENGER_ACCOUNT_SEED, DEFENDER_RECORD_SEED,
    TOTAL_FEE_BPS, JUROR_SHARE_BPS, WINNER_SHARE_BPS, PLATFORM_SHARE_BPS,
};
use crate::errors::TribunalCraftError;

// =============================================================================
// RESOLVE DISPUTE
// No escrow - all funds managed on subject with accounting
// Fees already collected upfront when bonds were deposited
// =============================================================================

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(mut)]
    pub resolver: Signer<'info>,

    #[account(
        mut,
        has_one = subject,
        constraint = dispute.status == DisputeStatus::Pending @ TribunalCraftError::DisputeAlreadyResolved,
    )]
    pub dispute: Account<'info, Dispute>,

    #[account(mut)]
    pub subject: Account<'info, Subject>,

    pub system_program: Program<'info, System>,
}

pub fn resolve_dispute(ctx: Context<ResolveDispute>) -> Result<()> {
    let clock = Clock::get()?;

    let dispute_voting_ended = ctx.accounts.dispute.is_voting_ended(clock.unix_timestamp);
    require!(dispute_voting_ended, TribunalCraftError::VotingNotEnded);

    let dispute = &mut ctx.accounts.dispute;
    let subject = &mut ctx.accounts.subject;

    // Determine outcome
    let outcome = dispute.determine_outcome();
    dispute.outcome = outcome;
    dispute.status = DisputeStatus::Resolved;
    dispute.resolved_at = clock.unix_timestamp;

    // Store dispute totals for future appeals
    let dispute_voting_period = dispute.voting_ends_at - dispute.voting_starts_at;
    subject.last_dispute_total = if dispute.is_restore {
        dispute.restore_stake
    } else {
        dispute.total_bond + dispute.total_stake_held()
    };
    subject.last_voting_period = dispute_voting_period;

    // Note: Platform fees (1%) already collected upfront when bonds were deposited
    // Juror share (19%) remains on subject for jurors to claim

    // Update available_stake: subtract stake that was at risk
    if !dispute.is_restore {
        let stake_at_risk = dispute.total_stake_held();
        subject.available_stake = subject.available_stake.saturating_sub(stake_at_risk);
        msg!("Available stake updated: -{} (was at risk)", stake_at_risk);
    }

    // Update subject status based on outcome
    if dispute.is_restore {
        // Calculate restore stake after fees (80% = WINNER_SHARE_BPS)
        let restore_net = (dispute.restore_stake as u128 * WINNER_SHARE_BPS as u128 / 10000) as u64;

        match outcome {
            ResolutionOutcome::ChallengerWins => {
                // Restoration successful - restore subject with restorer's stake (minus fees)
                // Transfer stake from dispute to subject
                **dispute.to_account_info().try_borrow_mut_lamports()? -= restore_net;
                **subject.to_account_info().try_borrow_mut_lamports()? += restore_net;

                subject.available_stake = restore_net;
                subject.status = SubjectStatus::Valid;
                subject.dispute = Pubkey::default();
                subject.defender_count = 1; // Restorer becomes first defender
                msg!("Restoration resolved: Successful - subject valid with {} lamports", restore_net);
            }
            ResolutionOutcome::NoParticipation | ResolutionOutcome::DefenderWins => {
                // Restoration failed - restorer can claim refund via ClaimRestorerRefund
                subject.status = SubjectStatus::Invalid;
                subject.dispute = Pubkey::default();
                msg!("Restoration resolved: Rejected - restorer can claim refund");
            }
            ResolutionOutcome::None => {
                return Err(TribunalCraftError::InvalidVoteChoice.into());
            }
        }
    } else {
        match outcome {
            ResolutionOutcome::NoParticipation | ResolutionOutcome::DefenderWins => {
                // Defender wins - check if stake remains after settlement
                if subject.available_stake > 0 {
                    subject.status = SubjectStatus::Valid;
                    msg!("Dispute resolved - defender wins, subject valid");
                } else {
                    subject.status = SubjectStatus::Dormant;
                    msg!("Dispute resolved - defender wins, subject dormant (no stake)");
                }
                subject.dispute = Pubkey::default();
            }
            ResolutionOutcome::ChallengerWins => {
                subject.status = SubjectStatus::Invalid;
                msg!("Dispute resolved: Challenger wins - subject invalid");
            }
            ResolutionOutcome::None => {
                return Err(TribunalCraftError::InvalidVoteChoice.into());
            }
        }
    }

    subject.updated_at = clock.unix_timestamp;
    Ok(())
}

// =============================================================================
// UNLOCK JUROR STAKE (after 7 day buffer)
// =============================================================================

#[derive(Accounts)]
pub struct UnlockJurorStake<'info> {
    #[account(mut)]
    pub juror: Signer<'info>,

    #[account(
        mut,
        has_one = juror @ TribunalCraftError::Unauthorized,
        seeds = [JUROR_ACCOUNT_SEED, juror.key().as_ref()],
        bump = juror_account.bump
    )]
    pub juror_account: Account<'info, JurorAccount>,

    #[account(
        constraint = dispute.status == DisputeStatus::Resolved @ TribunalCraftError::DisputeNotFound,
    )]
    pub dispute: Account<'info, Dispute>,

    #[account(
        mut,
        has_one = dispute,
        has_one = juror,
        constraint = !vote_record.stake_unlocked @ TribunalCraftError::StakeAlreadyUnlocked,
    )]
    pub vote_record: Account<'info, VoteRecord>,
}

pub fn unlock_juror_stake(ctx: Context<UnlockJurorStake>) -> Result<()> {
    let juror_account = &mut ctx.accounts.juror_account;
    let vote_record = &mut ctx.accounts.vote_record;
    let clock = Clock::get()?;

    // Check 7-day buffer has passed
    require!(
        vote_record.can_unlock(clock.unix_timestamp),
        TribunalCraftError::StakeStillLocked
    );

    // Release held stake back to available (accounting only - SOL stays in JurorAccount PDA)
    juror_account.release_from_vote(vote_record.stake_allocated);
    vote_record.stake_unlocked = true;

    msg!("Juror stake unlocked: {} lamports", vote_record.stake_allocated);
    Ok(())
}

// =============================================================================
// CLAIM JUROR REWARD (from subject to JurorAccount)
// Fees already collected upfront - juror pot comes from total bond
// =============================================================================

#[derive(Accounts)]
pub struct ClaimJurorReward<'info> {
    #[account(mut)]
    pub juror: Signer<'info>,

    #[account(
        mut,
        has_one = juror @ TribunalCraftError::Unauthorized,
        seeds = [JUROR_ACCOUNT_SEED, juror.key().as_ref()],
        bump = juror_account.bump
    )]
    pub juror_account: Account<'info, JurorAccount>,

    #[account(mut)]
    pub subject: Account<'info, Subject>,

    #[account(
        mut,
        has_one = subject,
        constraint = dispute.status == DisputeStatus::Resolved @ TribunalCraftError::DisputeNotFound,
    )]
    pub dispute: Account<'info, Dispute>,

    #[account(
        mut,
        has_one = dispute,
        has_one = juror,
        constraint = !vote_record.reward_claimed @ TribunalCraftError::RewardAlreadyClaimed,
    )]
    pub vote_record: Account<'info, VoteRecord>,

    pub system_program: Program<'info, System>,
}

pub fn claim_juror_reward(ctx: Context<ClaimJurorReward>) -> Result<()> {
    let subject = &mut ctx.accounts.subject;
    let dispute = &mut ctx.accounts.dispute;
    let juror_account = &mut ctx.accounts.juror_account;
    let vote_record = &mut ctx.accounts.vote_record;

    require!(!subject.free_case, TribunalCraftError::NotEligibleForReward);

    // =========================================================================
    // PROCESS REPUTATION (if not already done - can't skip)
    // =========================================================================
    let is_correct = vote_record.is_correct(dispute.outcome);

    if !vote_record.reputation_processed {
        if let Some(correct) = is_correct {
            let multiplier = stacked_sigmoid(juror_account.reputation);

            if correct {
                juror_account.correct_votes += 1;
                let remaining = 10000u16.saturating_sub(juror_account.reputation);
                let gain = (remaining as u64 * REPUTATION_GAIN_RATE as u64 * multiplier as u64 / 10000 / 10000) as u16;
                juror_account.reputation = juror_account.reputation.saturating_add(gain);
                msg!("Reputation gain: +{}", gain);
            } else {
                let loss = (juror_account.reputation as u64 * REPUTATION_LOSS_RATE as u64 * multiplier as u64 / 10000 / 10000) as u16;
                juror_account.reputation = juror_account.reputation.saturating_sub(loss);
                msg!("Reputation loss: -{}", loss);
            }
        }

        // Note: Stake unlock is handled separately via unlock_juror_stake after 7 days
        vote_record.reputation_processed = true;
    }

    // =========================================================================
    // CLAIM REWARD (all voters get reward - incentivizes calling this function)
    // Juror pot = JUROR_SHARE of fees from total_bond (fees already collected)
    // =========================================================================

    // Calculate juror pot from dispute bond + stake totals
    // For restorations, use restore_stake instead of bond + stake
    // Note: amounts are the full stake/bond, fees are calculated as 20% of total
    let total_pool = if dispute.is_restore {
        dispute.restore_stake
    } else {
        dispute.total_bond.saturating_add(dispute.total_stake_held())
    };
    let total_fees = (total_pool as u128 * TOTAL_FEE_BPS as u128 / 10000) as u64;
    let juror_pot = (total_fees as u128 * JUROR_SHARE_BPS as u128 / 10000) as u64;

    if juror_pot == 0 {
        vote_record.reward_claimed = true;
        msg!("No juror pot available");
        return Ok(());
    }

    // Total weight of ALL voters (not just correct ones)
    let total_vote_weight = dispute.votes_favor_weight.saturating_add(dispute.votes_against_weight);

    if total_vote_weight == 0 {
        vote_record.reward_claimed = true;
        msg!("No votes cast");
        return Ok(());
    }

    // Reward proportional to voting power (all jurors share the pot)
    let reward = (juror_pot as u128 * vote_record.voting_power as u128 / total_vote_weight as u128) as u64;

    // Transfer reward from appropriate source to JurorAccount PDA
    // For restorations: from dispute account (where restore_stake is)
    // For regular disputes: from subject account (where bonds/stakes are)
    if dispute.is_restore {
        **dispute.to_account_info().try_borrow_mut_lamports()? -= reward;
    } else {
        **subject.to_account_info().try_borrow_mut_lamports()? -= reward;
    }
    **juror_account.to_account_info().try_borrow_mut_lamports()? += reward;

    // Update juror balance accounting
    juror_account.add_reward(reward);

    vote_record.reward_claimed = true;
    msg!("Juror reward claimed: {} lamports (added to balance)", reward);
    Ok(())
}

// =============================================================================
// CLAIM CHALLENGER REWARD (from subject)
// All funds on subject account - use accounting for calculations
// =============================================================================

#[derive(Accounts)]
pub struct ClaimChallengerReward<'info> {
    #[account(mut)]
    pub challenger: Signer<'info>,

    #[account(
        mut,
        seeds = [CHALLENGER_ACCOUNT_SEED, challenger.key().as_ref()],
        bump = challenger_account.bump
    )]
    pub challenger_account: Account<'info, ChallengerAccount>,

    #[account(mut)]
    pub subject: Account<'info, Subject>,

    #[account(
        mut,
        has_one = subject,
        constraint = dispute.status == DisputeStatus::Resolved @ TribunalCraftError::DisputeNotFound,
    )]
    pub dispute: Account<'info, Dispute>,

    #[account(
        mut,
        has_one = dispute,
        has_one = challenger,
        constraint = !challenger_record.reward_claimed @ TribunalCraftError::RewardAlreadyClaimed,
    )]
    pub challenger_record: Account<'info, ChallengerRecord>,

    pub system_program: Program<'info, System>,
}

pub fn claim_challenger_reward(ctx: Context<ClaimChallengerReward>) -> Result<()> {
    let subject = &mut ctx.accounts.subject;
    let dispute = &mut ctx.accounts.dispute;
    let challenger_record = &mut ctx.accounts.challenger_record;
    let challenger_account = &mut ctx.accounts.challenger_account;

    require!(!subject.free_case, TribunalCraftError::NotEligibleForReward);

    let outcome = dispute.outcome;
    let bond = challenger_record.bond;
    let total_bond = dispute.total_bond;
    let total_stakes = dispute.total_stake_held();

    match outcome {
        ResolutionOutcome::ChallengerWins => {
            // Winner: 80% of defender's stake + 80% of own bond back
            let defender_contribution = (total_stakes as u128 * WINNER_SHARE_BPS as u128 / 10000) as u64;
            let reward = challenger_record.calculate_reward_share(defender_contribution, total_bond);
            let bond_return = (bond as u128 * WINNER_SHARE_BPS as u128 / 10000) as u64;
            let total_return = reward + bond_return;

            // Transfer from subject
            **subject.to_account_info().try_borrow_mut_lamports()? -= total_return;
            **ctx.accounts.challenger.to_account_info().try_borrow_mut_lamports()? += total_return;

            // Update reputation
            let remaining = 10000u16.saturating_sub(challenger_account.reputation);
            let multiplier = stacked_sigmoid(challenger_account.reputation);
            let gain = (remaining as u32 * REPUTATION_GAIN_RATE as u32 * multiplier as u32 / 10000 / 10000) as u16;
            challenger_account.reputation = challenger_account.reputation.saturating_add(gain);
            challenger_account.disputes_upheld += 1;

            msg!("Challenger reward claimed: {} lamports", total_return);
        }
        ResolutionOutcome::DefenderWins => {
            // Loser: loses bond (bond stays on subject, goes to defenders)
            let multiplier = stacked_sigmoid(challenger_account.reputation);
            let loss = (challenger_account.reputation as u32 * REPUTATION_LOSS_RATE as u32 * multiplier as u32 / 10000 / 10000) as u16;
            challenger_account.reputation = challenger_account.reputation.saturating_sub(loss);
            challenger_account.disputes_dismissed += 1;

            msg!("Dispute dismissed - challenger loses bond");
        }
        ResolutionOutcome::NoParticipation => {
            // No votes: return net bond (99% of gross, platform fee already taken)
            let platform_fee = (bond as u128 * TOTAL_FEE_BPS as u128 * PLATFORM_SHARE_BPS as u128 / 10000 / 10000) as u64;
            let bond_return = bond.saturating_sub(platform_fee);

            // Transfer from subject to this challenger
            **subject.to_account_info().try_borrow_mut_lamports()? -= bond_return;
            **ctx.accounts.challenger.to_account_info().try_borrow_mut_lamports()? += bond_return;

            msg!("No participation - bond returned: {} lamports", bond_return);
        }
        _ => {
            return Err(TribunalCraftError::DisputeNotFound.into());
        }
    }

    challenger_record.reward_claimed = true;
    dispute.challengers_claimed += 1;
    Ok(())
}

// =============================================================================
// CLAIM DEFENDER REWARD (from subject)
// Uses snapshot_total_stake for proportional calculations
// Defender's stake is their DefenderRecord.stake (includes consolidated pool stake)
// =============================================================================

#[derive(Accounts)]
pub struct ClaimDefenderReward<'info> {
    #[account(mut)]
    pub defender: Signer<'info>,

    #[account(mut)]
    pub subject: Account<'info, Subject>,

    #[account(
        mut,
        has_one = subject,
        constraint = dispute.status == DisputeStatus::Resolved @ TribunalCraftError::DisputeNotFound,
    )]
    pub dispute: Account<'info, Dispute>,

    #[account(
        mut,
        has_one = subject,
        has_one = defender,
        constraint = !defender_record.reward_claimed @ TribunalCraftError::RewardAlreadyClaimed,
        seeds = [DEFENDER_RECORD_SEED, subject.key().as_ref(), defender.key().as_ref()],
        bump = defender_record.bump
    )]
    pub defender_record: Account<'info, DefenderRecord>,

    pub system_program: Program<'info, System>,
}

pub fn claim_defender_reward(ctx: Context<ClaimDefenderReward>) -> Result<()> {
    let subject = &mut ctx.accounts.subject;
    let dispute = &mut ctx.accounts.dispute;
    let defender_record = &mut ctx.accounts.defender_record;

    require!(!subject.free_case, TribunalCraftError::NotEligibleForReward);

    let outcome = dispute.outcome;

    // Defender's stake at risk = their share of total stake held
    // Use snapshot_total_stake for proportional calculations
    let snapshot_total = dispute.snapshot_total_stake;
    let total_stake_held = dispute.total_stake_held();

    // Calculate defender's proportional stake at risk
    let stake_at_risk = if snapshot_total > 0 {
        (defender_record.stake as u128 * total_stake_held as u128 / snapshot_total as u128) as u64
    } else {
        0
    };

    let total_bond = dispute.total_bond;

    match outcome {
        ResolutionOutcome::DefenderWins => {
            // Winner: 80% of challenger's bond + 80% of own stake back
            let bond_contribution = (total_bond as u128 * WINNER_SHARE_BPS as u128 / 10000) as u64;
            // Reward proportional to defender's stake vs total stake
            let reward = if total_stake_held > 0 {
                (bond_contribution as u128 * stake_at_risk as u128 / total_stake_held as u128) as u64
            } else {
                0
            };
            let stake_return = (stake_at_risk as u128 * WINNER_SHARE_BPS as u128 / 10000) as u64;
            let total_return = reward + stake_return;

            // Transfer from subject to defender
            **subject.to_account_info().try_borrow_mut_lamports()? -= total_return;
            **ctx.accounts.defender.to_account_info().try_borrow_mut_lamports()? += total_return;

            msg!("Defender reward claimed: {} lamports (stake_at_risk: {})", total_return, stake_at_risk);
        }
        ResolutionOutcome::ChallengerWins => {
            // Loser: loses stake (stays on subject for challenger to claim)
            msg!("Challenger wins - defender loses stake ({})", stake_at_risk);
        }
        ResolutionOutcome::NoParticipation => {
            // No votes: stake stays on subject, bond is claimable
            msg!("No participation - stake retained on subject: {}", stake_at_risk);
        }
        _ => {
            return Err(TribunalCraftError::DisputeNotFound.into());
        }
    }

    defender_record.reward_claimed = true;
    dispute.defenders_claimed += 1;
    Ok(())
}

// NOTE: CloseEscrow removed - no escrow in simplified model
// All funds managed on subject account with accounting

// =============================================================================
// CLAIM RESTORER REFUND (for failed restorations)
// Returns 80% of restore stake to restorer when restoration is rejected
// =============================================================================

#[derive(Accounts)]
pub struct ClaimRestorerRefund<'info> {
    #[account(mut)]
    pub restorer: Signer<'info>,

    #[account(
        mut,
        constraint = dispute.is_restore @ TribunalCraftError::NotARestore,
        constraint = dispute.status == DisputeStatus::Resolved @ TribunalCraftError::DisputeNotFound,
        constraint = dispute.restorer == restorer.key() @ TribunalCraftError::Unauthorized,
        constraint = !dispute.pool_reward_claimed @ TribunalCraftError::RewardAlreadyClaimed,
    )]
    pub dispute: Account<'info, Dispute>,

    pub system_program: Program<'info, System>,
}

pub fn claim_restorer_refund(ctx: Context<ClaimRestorerRefund>) -> Result<()> {
    let dispute = &mut ctx.accounts.dispute;

    // Only refund on failed restorations (DefenderWins or NoParticipation)
    match dispute.outcome {
        ResolutionOutcome::DefenderWins | ResolutionOutcome::NoParticipation => {
            // Calculate refund (80% after fees)
            let refund = (dispute.restore_stake as u128 * WINNER_SHARE_BPS as u128 / 10000) as u64;

            // Transfer from dispute to restorer
            **dispute.to_account_info().try_borrow_mut_lamports()? -= refund;
            **ctx.accounts.restorer.to_account_info().try_borrow_mut_lamports()? += refund;

            dispute.pool_reward_claimed = true;
            msg!("Restorer refund claimed: {} lamports", refund);
        }
        ResolutionOutcome::ChallengerWins => {
            // Restoration succeeded - stake went to subject, nothing to claim
            return Err(TribunalCraftError::NotEligibleForReward.into());
        }
        _ => {
            return Err(TribunalCraftError::DisputeNotFound.into());
        }
    }

    Ok(())
}
