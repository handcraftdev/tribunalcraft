use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::{
    stacked_sigmoid, REPUTATION_GAIN_RATE, REPUTATION_LOSS_RATE,
    JUROR_ACCOUNT_SEED, CHALLENGER_ACCOUNT_SEED, DEFENDER_POOL_SEED, DEFENDER_RECORD_SEED,
    PROTOCOL_CONFIG_SEED, TOTAL_FEE_BPS, JUROR_SHARE_BPS, WINNER_SHARE_BPS,
};
use crate::errors::TribunalCraftError;

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

    /// Optional: defender pool if subject is linked (for releasing/slashing held stake)
    #[account(
        mut,
        constraint = defender_pool.key() == subject.defender_pool @ TribunalCraftError::InvalidConfig,
    )]
    pub defender_pool: Option<Account<'info, DefenderPool>>,

    /// Protocol config for treasury address
    #[account(
        seeds = [PROTOCOL_CONFIG_SEED],
        bump = protocol_config.bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// CHECK: Treasury account receives platform fees
    #[account(
        mut,
        constraint = treasury.key() == protocol_config.treasury @ TribunalCraftError::InvalidConfig,
    )]
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn resolve_dispute(ctx: Context<ResolveDispute>) -> Result<()> {
    let clock = Clock::get()?;

    // Extract read-only values needed for fee calculation before mutable borrows
    let dispute_voting_ended = ctx.accounts.dispute.is_voting_ended(clock.unix_timestamp);
    require!(dispute_voting_ended, TribunalCraftError::VotingNotEnded);

    // Calculate platform fee before mutable borrows
    let platform_fee = if !ctx.accounts.subject.free_case {
        let matched_stake = ctx.accounts.dispute.total_stake_held();
        let stake_for_calc = if matched_stake > 0 { matched_stake } else { ctx.accounts.dispute.snapshot_total_stake };
        let total_pool = ctx.accounts.dispute.total_bond.saturating_add(stake_for_calc);

        if total_pool > 0 {
            let total_fees = total_pool as u128 * TOTAL_FEE_BPS as u128 / 10000;
            (total_fees * (10000 - JUROR_SHARE_BPS) as u128 / 10000) as u64
        } else {
            0
        }
    } else {
        0
    };

    // Now proceed with mutable borrows
    let dispute = &mut ctx.accounts.dispute;
    let subject = &mut ctx.accounts.subject;

    // Determine outcome
    let outcome = dispute.determine_outcome();
    dispute.outcome = outcome;
    dispute.status = DisputeStatus::Resolved;
    dispute.resolved_at = clock.unix_timestamp;

    // Store dispute totals for future appeals (before any fund transfers)
    let dispute_voting_period = dispute.voting_ends_at - dispute.voting_starts_at;
    subject.last_dispute_total = if dispute.is_appeal {
        // For appeals: total is the appeal stake
        dispute.appeal_stake
    } else {
        // For regular disputes: total is bond + stake held
        dispute.total_bond + dispute.total_stake_held()
    };
    subject.last_voting_period = dispute_voting_period;

    // Handle pool stake if linked and match mode (only for non-appeals)
    if !dispute.is_appeal && subject.is_linked() && dispute.stake_held > 0 {
        let defender_pool = ctx.accounts.defender_pool.as_mut()
            .ok_or(TribunalCraftError::InvalidConfig)?;

        match outcome {
            ResolutionOutcome::NoParticipation | ResolutionOutcome::DefenderWins => {
                // Release held stake back to available
                defender_pool.release_stake(dispute.stake_held)?;
            }
            ResolutionOutcome::ChallengerWins => {
                // Slash held stake
                defender_pool.slash_stake(dispute.stake_held)?;
            }
            _ => {}
        }
        defender_pool.updated_at = clock.unix_timestamp;
    }

    // Collect platform fees (1% of total pool) for non-free cases with participation
    if platform_fee > 0 && outcome != ResolutionOutcome::NoParticipation {
        // Transfer from dispute account (holds bonds)
        **dispute.to_account_info().try_borrow_mut_lamports()? -= platform_fee;
        **ctx.accounts.treasury.try_borrow_mut_lamports()? += platform_fee;

        msg!("Platform fee collected: {} lamports", platform_fee);
    }

    // Update subject status based on outcome
    // For appeals: outcomes are inverted (ChallengerWins restores Active, DefenderWins keeps Invalidated)
    if dispute.is_appeal {
        match outcome {
            ResolutionOutcome::ChallengerWins => {
                // Appeal won - subject returns to Active
                // Reset defender count since old stakes are gone after invalidation
                subject.status = SubjectStatus::Active;
                subject.dispute = Pubkey::default();
                subject.defender_count = 0;
                subject.total_stake = 0;
                msg!("Appeal resolved: Challenger wins - subject returns to active (counts reset)");
            }
            ResolutionOutcome::NoParticipation | ResolutionOutcome::DefenderWins => {
                // Appeal failed - subject stays Invalidated
                subject.status = SubjectStatus::Invalidated;
                subject.dispute = Pubkey::default();
                msg!("Appeal resolved: Defender wins - subject remains invalidated");
            }
            ResolutionOutcome::None => {
                return Err(TribunalCraftError::InvalidVoteChoice.into());
            }
        }
    } else {
        // Regular dispute resolution
        match outcome {
            ResolutionOutcome::NoParticipation | ResolutionOutcome::DefenderWins => {
                // Return to active - subject continues operating
                subject.status = SubjectStatus::Active;
                subject.dispute = Pubkey::default();
                msg!("Dispute resolved - defender wins, subject returns to active");
            }
            ResolutionOutcome::ChallengerWins => {
                // Terminal - subject is invalidated
                subject.status = SubjectStatus::Invalidated;
                msg!("Dispute resolved: Challenger wins - subject invalidated");
            }
            ResolutionOutcome::None => {
                return Err(TribunalCraftError::InvalidVoteChoice.into());
            }
        }
    }

    subject.updated_at = clock.unix_timestamp;
    Ok(())
}

#[derive(Accounts)]
pub struct ProcessVoteResult<'info> {
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
        has_one = subject,
        constraint = dispute.status == DisputeStatus::Resolved @ TribunalCraftError::DisputeNotFound,
    )]
    pub dispute: Account<'info, Dispute>,

    pub subject: Account<'info, Subject>,

    #[account(
        mut,
        has_one = dispute,
        has_one = juror,
        constraint = !vote_record.reputation_processed @ TribunalCraftError::ReputationAlreadyProcessed,
    )]
    pub vote_record: Account<'info, VoteRecord>,
}

pub fn process_vote_result(ctx: Context<ProcessVoteResult>) -> Result<()> {
    let juror_account = &mut ctx.accounts.juror_account;
    let subject = &ctx.accounts.subject;
    let dispute = &ctx.accounts.dispute;
    let vote_record = &mut ctx.accounts.vote_record;
    let clock = Clock::get()?;

    // Free cases don't affect reputation
    if !subject.free_case {
        if let Some(is_correct) = vote_record.is_correct(dispute.outcome) {
            let multiplier = stacked_sigmoid(juror_account.reputation);

            if is_correct {
                juror_account.correct_votes += 1;
                let remaining = 10000u16.saturating_sub(juror_account.reputation);
                let gain = (remaining as u32 * REPUTATION_GAIN_RATE as u32 * multiplier as u32 / 10000 / 10000) as u16;
                juror_account.reputation = juror_account.reputation.saturating_add(gain);
            } else {
                let loss = (juror_account.reputation as u32 * REPUTATION_LOSS_RATE as u32 * multiplier as u32 / 10000 / 10000) as u16;
                juror_account.reputation = juror_account.reputation.saturating_sub(loss);
            }
        }
    }

    if vote_record.can_unlock(clock.unix_timestamp) {
        juror_account.available_stake += vote_record.stake_allocated;
        vote_record.stake_unlocked = true;
    }

    vote_record.reputation_processed = true;
    msg!("Vote result processed{}", if subject.free_case { " (free case - no reputation change)" } else { "" });
    Ok(())
}

#[derive(Accounts)]
pub struct ClaimJurorReward<'info> {
    #[account(mut)]
    pub juror: Signer<'info>,

    #[account(mut)]
    pub subject: Account<'info, Subject>,

    /// Optional: defender pool if subject is linked
    #[account(
        mut,
        constraint = defender_pool.key() == subject.defender_pool @ TribunalCraftError::InvalidConfig,
    )]
    pub defender_pool: Option<Account<'info, DefenderPool>>,

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
    let subject = &ctx.accounts.subject;
    let dispute = &mut ctx.accounts.dispute;
    let vote_record = &mut ctx.accounts.vote_record;

    // Free cases have no rewards to claim
    require!(!subject.free_case, TribunalCraftError::NotEligibleForReward);

    let is_correct = vote_record.is_correct(dispute.outcome);
    require!(is_correct == Some(true), TribunalCraftError::NotEligibleForReward);

    // Calculate total pool (bond + matched stake)
    let matched_stake = dispute.total_stake_held();
    let stake_for_calc = if matched_stake > 0 { matched_stake } else { dispute.snapshot_total_stake };
    let total_pool = dispute.total_bond.saturating_add(stake_for_calc);

    // Juror pot = 19% of total pool (95% of 20% fees)
    let total_fees = total_pool as u128 * TOTAL_FEE_BPS as u128 / 10000;
    let juror_pot = (total_fees * JUROR_SHARE_BPS as u128 / 10000) as u64;

    if juror_pot == 0 {
        return Err(TribunalCraftError::NotEligibleForReward.into());
    }

    let total_correct_weight = match dispute.outcome {
        ResolutionOutcome::ChallengerWins => dispute.votes_favor_weight,
        ResolutionOutcome::DefenderWins => dispute.votes_against_weight,
        _ => 0,
    };

    if total_correct_weight == 0 {
        return Err(TribunalCraftError::NotEligibleForReward.into());
    }

    let reward = (juror_pot as u128 * vote_record.voting_power as u128 / total_correct_weight as u128) as u64;

    // Transfer from appropriate source
    if dispute.outcome == ResolutionOutcome::ChallengerWins {
        // Defender funds - from pool and/or subject based on proportions
        let total_held = dispute.total_stake_held();
        if total_held > 0 {
            // Transfer proportionally from pool and subject
            let pool_portion = (reward as u128 * dispute.stake_held as u128 / total_held as u128) as u64;
            let direct_portion = reward.saturating_sub(pool_portion);

            if pool_portion > 0 && dispute.stake_held > 0 {
                let defender_pool = ctx.accounts.defender_pool.as_ref()
                    .ok_or(TribunalCraftError::InvalidConfig)?;
                **defender_pool.to_account_info().try_borrow_mut_lamports()? -= pool_portion;
            }
            if direct_portion > 0 {
                **ctx.accounts.subject.to_account_info().try_borrow_mut_lamports()? -= direct_portion;
            }
        } else {
            // Proportional mode - all from subject
            **ctx.accounts.subject.to_account_info().try_borrow_mut_lamports()? -= reward;
        }
    } else {
        // Challenger funds - from dispute account
        **ctx.accounts.dispute.to_account_info().try_borrow_mut_lamports()? -= reward;
    }
    **ctx.accounts.juror.to_account_info().try_borrow_mut_lamports()? += reward;

    vote_record.reward_claimed = true;
    msg!("Juror reward claimed: {} lamports", reward);
    Ok(())
}

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

    /// Optional: defender pool if subject is linked
    #[account(
        mut,
        constraint = defender_pool.key() == subject.defender_pool @ TribunalCraftError::InvalidConfig,
    )]
    pub defender_pool: Option<Account<'info, DefenderPool>>,

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
    let subject = &ctx.accounts.subject;
    let dispute = &ctx.accounts.dispute;
    let challenger_record = &mut ctx.accounts.challenger_record;
    let challenger_account = &mut ctx.accounts.challenger_account;

    // Free cases have no rewards or reputation changes
    require!(!subject.free_case, TribunalCraftError::NotEligibleForReward);

    // Extract values from dispute first (before mutable operations)
    let outcome = dispute.outcome;
    let total_held = dispute.total_stake_held();
    let matched_stake = if total_held > 0 { total_held } else { dispute.snapshot_total_stake };
    let total_bond = dispute.total_bond;
    let stake_held = dispute.stake_held;
    let bond = challenger_record.bond;

    match outcome {
        ResolutionOutcome::ChallengerWins => {
            // Challenger wins:
            // - Gets 80% of defender's stake (proportional to their bond)
            // - Gets 80% of own bond back (20% went to fees)
            let defender_contribution = (matched_stake as u128 * WINNER_SHARE_BPS as u128 / 10000) as u64;
            let reward = challenger_record.calculate_reward_share(defender_contribution, total_bond);
            let bond_return = (bond as u128 * WINNER_SHARE_BPS as u128 / 10000) as u64;
            let total_return = reward + bond_return;

            // Transfer reward from pool and/or subject proportionally
            if total_held > 0 {
                let pool_portion = (reward as u128 * stake_held as u128 / total_held as u128) as u64;
                let direct_portion = reward.saturating_sub(pool_portion);

                if pool_portion > 0 && stake_held > 0 {
                    let defender_pool = ctx.accounts.defender_pool.as_ref()
                        .ok_or(TribunalCraftError::InvalidConfig)?;
                    **defender_pool.to_account_info().try_borrow_mut_lamports()? -= pool_portion;
                }
                if direct_portion > 0 {
                    **ctx.accounts.subject.to_account_info().try_borrow_mut_lamports()? -= direct_portion;
                }
            } else {
                // Proportional mode - all from subject
                **ctx.accounts.subject.to_account_info().try_borrow_mut_lamports()? -= reward;
            }
            // Bond return comes from dispute account
            **ctx.accounts.dispute.to_account_info().try_borrow_mut_lamports()? -= bond_return;
            **ctx.accounts.challenger.to_account_info().try_borrow_mut_lamports()? += total_return;

            // Update reputation using fixed constants
            let remaining = 10000u16.saturating_sub(challenger_account.reputation);
            let multiplier = stacked_sigmoid(challenger_account.reputation);
            let gain = (remaining as u32 * REPUTATION_GAIN_RATE as u32 * multiplier as u32 / 10000 / 10000) as u16;
            challenger_account.reputation = challenger_account.reputation.saturating_add(gain);
            challenger_account.disputes_upheld += 1;

            msg!("Challenger reward claimed: {} lamports (80% bond + reward)", total_return);
        }
        ResolutionOutcome::DefenderWins => {
            // Challenger loses bond (20% went to fees, 80% goes to defenders)
            let multiplier = stacked_sigmoid(challenger_account.reputation);
            let loss = (challenger_account.reputation as u32 * REPUTATION_LOSS_RATE as u32 * multiplier as u32 / 10000 / 10000) as u16;
            challenger_account.reputation = challenger_account.reputation.saturating_sub(loss);
            challenger_account.disputes_dismissed += 1;

            msg!("Dispute dismissed - challenger loses bond");
        }
        ResolutionOutcome::NoParticipation => {
            // Return bond only
            **ctx.accounts.dispute.to_account_info().try_borrow_mut_lamports()? -= bond;
            **ctx.accounts.challenger.to_account_info().try_borrow_mut_lamports()? += bond;

            msg!("No participation - bond returned: {} lamports", bond);
        }
        _ => {
            return Err(TribunalCraftError::DisputeNotFound.into());
        }
    }

    challenger_record.reward_claimed = true;
    ctx.accounts.dispute.challengers_claimed += 1;
    Ok(())
}

/// Claim defender reward (direct defenders on any subject type)
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
    let subject = &ctx.accounts.subject;
    let dispute = &ctx.accounts.dispute;
    let defender_record = &mut ctx.accounts.defender_record;

    // Free cases have no rewards to claim
    require!(!subject.free_case, TribunalCraftError::NotEligibleForReward);

    // Extract values from dispute first (before mutable operations)
    let outcome = dispute.outcome;
    let total_held = dispute.total_stake_held();
    let total_bond = dispute.total_bond;
    let direct_stake_held = dispute.direct_stake_held;
    let snapshot_total_stake = dispute.snapshot_total_stake;
    let stake = defender_record.stake;

    match outcome {
        ResolutionOutcome::DefenderWins => {
            // Defenders win:
            // - Get 80% of challenger's bond (proportional to their stake)
            // - Get 80% of own stake back (20% went to fees)
            let bond_contribution = (total_bond as u128 * WINNER_SHARE_BPS as u128 / 10000) as u64;

            // Calculate direct defender's portion of winner pot
            let direct_winner_pot = if subject.is_linked() && total_held > 0 {
                // For linked subjects, direct defenders only get reward for direct_stake_held portion
                (bond_contribution as u128 * direct_stake_held as u128 / total_held as u128) as u64
            } else {
                // Standalone: all reward goes to direct defenders
                bond_contribution
            };

            // Stake return is 80% of original stake
            let stake_return = (stake as u128 * WINNER_SHARE_BPS as u128 / 10000) as u64;

            // Use snapshot_total_stake for proportional calculation (historical value)
            if direct_winner_pot > 0 && snapshot_total_stake > 0 {
                let reward = defender_record.calculate_reward_share(direct_winner_pot, snapshot_total_stake);
                let total_return = reward + stake_return;

                **ctx.accounts.dispute.to_account_info().try_borrow_mut_lamports()? -= reward;
                **ctx.accounts.subject.to_account_info().try_borrow_mut_lamports()? -= stake_return;
                **ctx.accounts.defender.to_account_info().try_borrow_mut_lamports()? += total_return;

                msg!("Defender reward claimed: {} lamports (80% stake + reward)", total_return);
            } else {
                // No reward from bond, just return 80% of stake
                **ctx.accounts.subject.to_account_info().try_borrow_mut_lamports()? -= stake_return;
                **ctx.accounts.defender.to_account_info().try_borrow_mut_lamports()? += stake_return;

                msg!("Defender stake returned: {} lamports (80%)", stake_return);
            }
        }
        ResolutionOutcome::ChallengerWins => {
            // Challenger wins - defender loses stake (20% to fees, 80% to challengers)
            msg!("Challenger wins - defender loses stake");
        }
        ResolutionOutcome::NoParticipation => {
            // No participation - return full stake (no fees taken)
            **ctx.accounts.subject.to_account_info().try_borrow_mut_lamports()? -= stake;
            **ctx.accounts.defender.to_account_info().try_borrow_mut_lamports()? += stake;

            msg!("No participation - stake returned: {} lamports", stake);
        }
        _ => {
            return Err(TribunalCraftError::DisputeNotFound.into());
        }
    }

    defender_record.reward_claimed = true;
    ctx.accounts.dispute.defenders_claimed += 1;
    Ok(())
}

/// Claim pool reward (linked mode - pool owner claims reward for dismissed dispute)
#[derive(Accounts)]
pub struct ClaimPoolReward<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        constraint = subject.is_linked() @ TribunalCraftError::InvalidConfig, // Linked only
    )]
    pub subject: Account<'info, Subject>,

    #[account(
        mut,
        has_one = owner @ TribunalCraftError::Unauthorized,
        constraint = defender_pool.key() == subject.defender_pool @ TribunalCraftError::InvalidConfig,
        seeds = [DEFENDER_POOL_SEED, owner.key().as_ref()],
        bump = defender_pool.bump
    )]
    pub defender_pool: Account<'info, DefenderPool>,

    #[account(
        mut,
        has_one = subject,
        constraint = dispute.status == DisputeStatus::Resolved @ TribunalCraftError::DisputeNotFound,
        constraint = !dispute.pool_reward_claimed @ TribunalCraftError::RewardAlreadyClaimed,
    )]
    pub dispute: Account<'info, Dispute>,

    pub system_program: Program<'info, System>,
}

pub fn claim_pool_reward(ctx: Context<ClaimPoolReward>) -> Result<()> {
    let subject = &ctx.accounts.subject;
    let dispute = &ctx.accounts.dispute;

    // Free cases have no rewards to claim
    require!(!subject.free_case, TribunalCraftError::NotEligibleForReward);

    // Calculate reward before any mutable borrows
    // Pool gets 80% of challenger's bond (proportional to pool's stake held)
    let outcome = dispute.outcome;
    let bond_contribution = match outcome {
        ResolutionOutcome::DefenderWins => {
            (dispute.total_bond as u128 * WINNER_SHARE_BPS as u128 / 10000) as u64
        }
        _ => 0,
    };

    // Calculate pool's portion of winner pot
    let total_held = dispute.total_stake_held();
    let pool_winner_pot = if total_held > 0 {
        (bond_contribution as u128 * dispute.stake_held as u128 / total_held as u128) as u64
    } else {
        0
    };

    // Perform transfers
    match outcome {
        ResolutionOutcome::DefenderWins => {
            if pool_winner_pot > 0 {
                // Transfer pool's reward portion from dispute to pool
                **ctx.accounts.dispute.to_account_info().try_borrow_mut_lamports()? -= pool_winner_pot;
                **ctx.accounts.defender_pool.to_account_info().try_borrow_mut_lamports()? += pool_winner_pot;

                // Add to pool's available stake
                let defender_pool = &mut ctx.accounts.defender_pool;
                defender_pool.total_stake += pool_winner_pot;
                defender_pool.available += pool_winner_pot;

                msg!("Pool reward claimed: {} lamports (80% of bond portion)", pool_winner_pot);
            }
        }
        ResolutionOutcome::ChallengerWins => {
            // Pool already slashed in resolve_dispute (20% to fees, 80% to challengers)
            msg!("Challenger wins - pool was slashed");
        }
        ResolutionOutcome::NoParticipation => {
            // Stake already released in resolve_dispute (no fees taken)
            msg!("No participation - stake was released");
        }
        _ => {
            return Err(TribunalCraftError::DisputeNotFound.into());
        }
    }

    // Mark as claimed
    ctx.accounts.dispute.pool_reward_claimed = true;
    Ok(())
}
