use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::{stacked_sigmoid, REPUTATION_GAIN_RATE, REPUTATION_LOSS_RATE, JUROR_ACCOUNT_SEED, CHALLENGER_ACCOUNT_SEED, STAKER_POOL_SEED};
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

    /// Optional: staker pool if subject is linked (for releasing/slashing held stake)
    #[account(
        mut,
        constraint = staker_pool.key() == subject.staker_pool @ TribunalCraftError::InvalidConfig,
    )]
    pub staker_pool: Option<Account<'info, StakerPool>>,

    pub system_program: Program<'info, System>,
}

pub fn resolve_dispute(ctx: Context<ResolveDispute>) -> Result<()> {
    let dispute = &mut ctx.accounts.dispute;
    let subject = &mut ctx.accounts.subject;
    let clock = Clock::get()?;

    require!(dispute.is_voting_ended(clock.unix_timestamp), TribunalCraftError::VotingNotEnded);

    // Determine outcome
    let outcome = dispute.determine_outcome();
    dispute.outcome = outcome;
    dispute.status = DisputeStatus::Resolved;
    dispute.resolved_at = clock.unix_timestamp;

    // Handle pool stake if linked and match mode
    if subject.is_linked() && dispute.stake_held > 0 {
        let staker_pool = ctx.accounts.staker_pool.as_mut()
            .ok_or(TribunalCraftError::InvalidConfig)?;

        match outcome {
            ResolutionOutcome::NoParticipation | ResolutionOutcome::Dismissed => {
                // Release held stake back to available
                staker_pool.release_stake(dispute.stake_held)?;
            }
            ResolutionOutcome::Upheld => {
                // Slash held stake
                staker_pool.slash_stake(dispute.stake_held)?;
            }
            _ => {}
        }
        staker_pool.updated_at = clock.unix_timestamp;
    }

    // Update subject status based on outcome
    match outcome {
        ResolutionOutcome::NoParticipation | ResolutionOutcome::Dismissed => {
            // Return to active - subject continues operating
            subject.status = SubjectStatus::Active;
            subject.dispute = Pubkey::default();
            msg!("Dispute resolved - subject returns to active");
        }
        ResolutionOutcome::Upheld => {
            // Terminal - subject is invalidated
            subject.status = SubjectStatus::Invalidated;
            msg!("Dispute resolved: Upheld - subject invalidated");
        }
        ResolutionOutcome::None => {
            return Err(TribunalCraftError::InvalidVoteChoice.into());
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

    /// Optional: staker pool if subject is linked
    #[account(
        mut,
        constraint = staker_pool.key() == subject.staker_pool @ TribunalCraftError::InvalidConfig,
    )]
    pub staker_pool: Option<Account<'info, StakerPool>>,

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

    // Calculate loser pool size (total stake held from all sources)
    let loser_pool = match dispute.outcome {
        ResolutionOutcome::Upheld => {
            // Loser = stakers. Use total stake held (pool + direct)
            // For match mode: total_stake_held(), for proportional: subject.total_stake
            let total_held = dispute.total_stake_held();
            if total_held > 0 {
                total_held
            } else {
                // Proportional mode - use total stake
                subject.total_stake
            }
        }
        ResolutionOutcome::Dismissed => dispute.total_bond,
        _ => 0,
    };

    // Jurors get remainder after winner's share
    let juror_pot = (loser_pool as u128 * (10000 - subject.winner_reward_bps) as u128 / 10000) as u64;

    if juror_pot == 0 {
        return Err(TribunalCraftError::NotEligibleForReward.into());
    }

    let total_correct_weight = match dispute.outcome {
        ResolutionOutcome::Upheld => dispute.votes_favor_weight,
        ResolutionOutcome::Dismissed => dispute.votes_against_weight,
        _ => 0,
    };

    if total_correct_weight == 0 {
        return Err(TribunalCraftError::NotEligibleForReward.into());
    }

    let reward = (juror_pot as u128 * vote_record.voting_power as u128 / total_correct_weight as u128) as u64;

    // Transfer from appropriate source
    if dispute.outcome == ResolutionOutcome::Upheld {
        // Staker funds - from pool and/or subject based on proportions
        let total_held = dispute.total_stake_held();
        if total_held > 0 {
            // Transfer proportionally from pool and subject
            let pool_portion = (reward as u128 * dispute.stake_held as u128 / total_held as u128) as u64;
            let direct_portion = reward.saturating_sub(pool_portion);

            if pool_portion > 0 && dispute.stake_held > 0 {
                let staker_pool = ctx.accounts.staker_pool.as_ref()
                    .ok_or(TribunalCraftError::InvalidConfig)?;
                **staker_pool.to_account_info().try_borrow_mut_lamports()? -= pool_portion;
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

    /// Optional: staker pool if subject is linked
    #[account(
        mut,
        constraint = staker_pool.key() == subject.staker_pool @ TribunalCraftError::InvalidConfig,
    )]
    pub staker_pool: Option<Account<'info, StakerPool>>,

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
    let challenger_account = &mut ctx.accounts.challenger_account;
    let subject = &ctx.accounts.subject;
    let dispute = &mut ctx.accounts.dispute;
    let challenger_record = &mut ctx.accounts.challenger_record;

    // Free cases have no rewards or reputation changes
    require!(!subject.free_case, TribunalCraftError::NotEligibleForReward);

    match dispute.outcome {
        ResolutionOutcome::Upheld => {
            // Challenger wins - get share of staker's funds
            let total_held = dispute.total_stake_held();
            let loser_pool = if total_held > 0 {
                total_held
            } else {
                // Proportional mode
                subject.total_stake
            };

            let winner_pot = (loser_pool as u128 * subject.winner_reward_bps as u128 / 10000) as u64;
            let reward = challenger_record.calculate_reward_share(winner_pot, dispute.total_bond);
            let total_return = reward + challenger_record.bond;

            // Transfer reward from pool and/or subject proportionally, bond from dispute
            if total_held > 0 {
                let pool_portion = (reward as u128 * dispute.stake_held as u128 / total_held as u128) as u64;
                let direct_portion = reward.saturating_sub(pool_portion);

                if pool_portion > 0 && dispute.stake_held > 0 {
                    let staker_pool = ctx.accounts.staker_pool.as_ref()
                        .ok_or(TribunalCraftError::InvalidConfig)?;
                    **staker_pool.to_account_info().try_borrow_mut_lamports()? -= pool_portion;
                }
                if direct_portion > 0 {
                    **ctx.accounts.subject.to_account_info().try_borrow_mut_lamports()? -= direct_portion;
                }
            } else {
                // Proportional mode - all from subject
                **ctx.accounts.subject.to_account_info().try_borrow_mut_lamports()? -= reward;
            }
            **ctx.accounts.dispute.to_account_info().try_borrow_mut_lamports()? -= challenger_record.bond;
            **ctx.accounts.challenger.to_account_info().try_borrow_mut_lamports()? += total_return;

            // Update reputation using fixed constants
            let remaining = 10000u16.saturating_sub(challenger_account.reputation);
            let multiplier = stacked_sigmoid(challenger_account.reputation);
            let gain = (remaining as u32 * REPUTATION_GAIN_RATE as u32 * multiplier as u32 / 10000 / 10000) as u16;
            challenger_account.reputation = challenger_account.reputation.saturating_add(gain);
            challenger_account.disputes_upheld += 1;

            msg!("Challenger reward claimed: {} lamports (including bond)", total_return);
        }
        ResolutionOutcome::Dismissed => {
            // Challenger loses bond
            let multiplier = stacked_sigmoid(challenger_account.reputation);
            let loss = (challenger_account.reputation as u32 * REPUTATION_LOSS_RATE as u32 * multiplier as u32 / 10000 / 10000) as u16;
            challenger_account.reputation = challenger_account.reputation.saturating_sub(loss);
            challenger_account.disputes_dismissed += 1;

            msg!("Dispute dismissed - challenger loses bond");
        }
        ResolutionOutcome::NoParticipation => {
            // Return bond only
            **ctx.accounts.dispute.to_account_info().try_borrow_mut_lamports()? -= challenger_record.bond;
            **ctx.accounts.challenger.to_account_info().try_borrow_mut_lamports()? += challenger_record.bond;

            msg!("No participation - bond returned: {} lamports", challenger_record.bond);
        }
        _ => {
            return Err(TribunalCraftError::DisputeNotFound.into());
        }
    }

    challenger_record.reward_claimed = true;
    Ok(())
}

/// Claim staker reward (direct stakers on any subject type)
#[derive(Accounts)]
pub struct ClaimStakerReward<'info> {
    #[account(mut)]
    pub staker: Signer<'info>,

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
        has_one = staker,
        constraint = !staker_record.reward_claimed @ TribunalCraftError::RewardAlreadyClaimed,
    )]
    pub staker_record: Account<'info, StakerRecord>,

    pub system_program: Program<'info, System>,
}

pub fn claim_staker_reward(ctx: Context<ClaimStakerReward>) -> Result<()> {
    let subject = &ctx.accounts.subject;
    let dispute = &mut ctx.accounts.dispute;
    let staker_record = &mut ctx.accounts.staker_record;

    // Free cases have no rewards to claim
    require!(!subject.free_case, TribunalCraftError::NotEligibleForReward);

    // For linked subjects with hybrid backing, direct stakers only get reward
    // proportional to direct_stake_held (pool owner gets pool portion via claim_pool_reward)
    let total_held = dispute.total_stake_held();

    match dispute.outcome {
        ResolutionOutcome::Dismissed => {
            // Stakers win - get share of challenger's lost bond
            let total_winner_pot = (dispute.total_bond as u128 * subject.winner_reward_bps as u128 / 10000) as u64;

            // Calculate direct staker's portion of winner pot
            let direct_winner_pot = if subject.is_linked() && total_held > 0 {
                // For linked subjects, direct stakers only get reward for direct_stake_held portion
                (total_winner_pot as u128 * dispute.direct_stake_held as u128 / total_held as u128) as u64
            } else {
                // Standalone: all reward goes to direct stakers
                total_winner_pot
            };

            if direct_winner_pot > 0 && subject.total_stake > 0 {
                let reward = staker_record.calculate_reward_share(direct_winner_pot, subject.total_stake);
                let total_return = reward + staker_record.stake;

                **ctx.accounts.dispute.to_account_info().try_borrow_mut_lamports()? -= reward;
                **ctx.accounts.subject.to_account_info().try_borrow_mut_lamports()? -= staker_record.stake;
                **ctx.accounts.staker.to_account_info().try_borrow_mut_lamports()? += total_return;

                msg!("Staker reward claimed: {} lamports (including stake)", total_return);
            } else {
                // No reward, just return stake
                **ctx.accounts.subject.to_account_info().try_borrow_mut_lamports()? -= staker_record.stake;
                **ctx.accounts.staker.to_account_info().try_borrow_mut_lamports()? += staker_record.stake;

                msg!("Staker stake returned: {} lamports", staker_record.stake);
            }
        }
        ResolutionOutcome::Upheld => {
            // Dispute upheld - staker loses stake (already transferred out via challenger/juror claims)
            msg!("Dispute upheld - staker loses stake");
        }
        ResolutionOutcome::NoParticipation => {
            // No participation - return stake
            **ctx.accounts.subject.to_account_info().try_borrow_mut_lamports()? -= staker_record.stake;
            **ctx.accounts.staker.to_account_info().try_borrow_mut_lamports()? += staker_record.stake;

            msg!("No participation - stake returned: {} lamports", staker_record.stake);
        }
        _ => {
            return Err(TribunalCraftError::DisputeNotFound.into());
        }
    }

    staker_record.reward_claimed = true;
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
        constraint = staker_pool.key() == subject.staker_pool @ TribunalCraftError::InvalidConfig,
        seeds = [STAKER_POOL_SEED, owner.key().as_ref()],
        bump = staker_pool.bump
    )]
    pub staker_pool: Account<'info, StakerPool>,

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
    // Pool only gets reward proportional to pool's stake_held (not direct stakers' portion)
    let outcome = dispute.outcome;
    let total_winner_pot = match outcome {
        ResolutionOutcome::Dismissed => {
            (dispute.total_bond as u128 * subject.winner_reward_bps as u128 / 10000) as u64
        }
        _ => 0,
    };

    // Calculate pool's portion of winner pot
    let total_held = dispute.total_stake_held();
    let pool_winner_pot = if total_held > 0 {
        (total_winner_pot as u128 * dispute.stake_held as u128 / total_held as u128) as u64
    } else {
        0
    };

    // Perform transfers
    match outcome {
        ResolutionOutcome::Dismissed => {
            if pool_winner_pot > 0 {
                // Transfer pool's reward portion from dispute to pool
                **ctx.accounts.dispute.to_account_info().try_borrow_mut_lamports()? -= pool_winner_pot;
                **ctx.accounts.staker_pool.to_account_info().try_borrow_mut_lamports()? += pool_winner_pot;

                // Add to pool's available stake
                let staker_pool = &mut ctx.accounts.staker_pool;
                staker_pool.total_stake += pool_winner_pot;
                staker_pool.available += pool_winner_pot;

                msg!("Pool reward claimed: {} lamports", pool_winner_pot);
            }
        }
        ResolutionOutcome::Upheld => {
            // Pool already slashed in resolve_dispute
            msg!("Dispute upheld - pool was slashed");
        }
        ResolutionOutcome::NoParticipation => {
            // Stake already released in resolve_dispute
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
