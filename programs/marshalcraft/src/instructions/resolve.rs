use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::TREASURY_SEED;
use crate::errors::MarshalCraftError;

#[derive(Accounts)]
pub struct ResolveReport<'info> {
    #[account(mut)]
    pub resolver: Signer<'info>,

    pub config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        has_one = config,
        has_one = creator_pool,
        constraint = report.status == ReportStatus::Pending @ MarshalCraftError::ReportAlreadyResolved,
    )]
    pub report: Account<'info, ContentReport>,

    #[account(mut)]
    pub creator_pool: Account<'info, CreatorPool>,

    #[account(
        mut,
        seeds = [TREASURY_SEED, config.key().as_ref()],
        bump = treasury.bump,
    )]
    pub treasury: Account<'info, Treasury>,

    pub system_program: Program<'info, System>,
}

pub fn resolve_report(ctx: Context<ResolveReport>) -> Result<()> {
    let report = &mut ctx.accounts.report;
    let creator_pool = &mut ctx.accounts.creator_pool;
    let clock = Clock::get()?;

    require!(report.is_voting_ended(clock.unix_timestamp), MarshalCraftError::VotingNotEnded);

    // Determine outcome
    let outcome = report.determine_outcome();
    report.outcome = outcome;
    report.status = ReportStatus::Resolved;
    report.resolved_at = clock.unix_timestamp;

    match outcome {
        ResolutionOutcome::NoParticipation => {
            // Return all bonds - no votes were cast
            // Creator's held stake is released
            creator_pool.available += report.creator_held;
            creator_pool.held -= report.creator_held;
            creator_pool.pending_reports = creator_pool.pending_reports.saturating_sub(1);

            // Reporter bonds are returned via claim_reporter_reward
            msg!("Report resolved: NoParticipation - all bonds returned");
        }
        ResolutionOutcome::Upheld => {
            // Content removed, creator slashed
            // Slash creator's held stake (already held, just reduce total)
            creator_pool.slash_stake(report.creator_held)?;

            // Rewards distributed via claim instructions
            msg!("Report resolved: Upheld - content removed, creator slashed {} lamports", report.creator_held);
        }
        ResolutionOutcome::Dismissed => {
            // Report invalid, creator stake released
            creator_pool.release_stake(report.creator_held)?;

            // Reporter bond goes to marshals via claim instructions
            msg!("Report resolved: Dismissed - reporter loses bond");
        }
        ResolutionOutcome::None => {
            // Should not happen
            return Err(MarshalCraftError::InvalidVoteChoice.into());
        }
    }

    creator_pool.updated_at = clock.unix_timestamp;
    Ok(())
}

#[derive(Accounts)]
pub struct ProcessVoteResult<'info> {
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
        has_one = config,
        constraint = report.status == ReportStatus::Resolved @ MarshalCraftError::ReportNotFound,
    )]
    pub report: Account<'info, ContentReport>,

    #[account(
        mut,
        has_one = report,
        has_one = marshal,
        constraint = !vote_record.reputation_processed @ MarshalCraftError::ReputationAlreadyProcessed,
    )]
    pub vote_record: Account<'info, VoteRecord>,
}

pub fn process_vote_result(ctx: Context<ProcessVoteResult>) -> Result<()> {
    let config = &ctx.accounts.config;
    let marshal_account = &mut ctx.accounts.marshal_account;
    let report = &ctx.accounts.report;
    let vote_record = &mut ctx.accounts.vote_record;
    let clock = Clock::get()?;

    // Check if vote was correct
    if let Some(is_correct) = vote_record.is_correct(report.outcome) {
        if is_correct {
            // Gain reputation
            marshal_account.correct_votes += 1;
            let remaining = 10000u16.saturating_sub(marshal_account.reputation);
            let multiplier = get_s_curve_multiplier(marshal_account.reputation, config);
            let gain = (remaining as u32 * config.reputation_gain_rate as u32 * multiplier as u32 / 10000 / 10000) as u16;
            marshal_account.reputation = marshal_account.reputation.saturating_add(gain);
        } else {
            // Lose reputation
            let multiplier = get_s_curve_multiplier(marshal_account.reputation, config);
            let loss = (marshal_account.reputation as u32 * config.reputation_loss_rate as u32 * multiplier as u32 / 10000 / 10000) as u16;
            marshal_account.reputation = marshal_account.reputation.saturating_sub(loss);
        }
    }
    // Abstain: no reputation change

    // Unlock stake if lock period passed
    if vote_record.can_unlock(clock.unix_timestamp) {
        marshal_account.available_stake += vote_record.stake_allocated;
        vote_record.stake_unlocked = true;
    }

    vote_record.reputation_processed = true;

    msg!("Vote result processed, new reputation: {}", marshal_account.reputation);
    Ok(())
}

#[derive(Accounts)]
pub struct ClaimMarshalReward<'info> {
    #[account(mut)]
    pub marshal: Signer<'info>,

    pub config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        has_one = config,
        constraint = report.status == ReportStatus::Resolved @ MarshalCraftError::ReportNotFound,
    )]
    pub report: Account<'info, ContentReport>,

    #[account(
        mut,
        has_one = report,
        has_one = marshal,
        constraint = !vote_record.reward_claimed @ MarshalCraftError::RewardAlreadyClaimed,
    )]
    pub vote_record: Account<'info, VoteRecord>,

    pub system_program: Program<'info, System>,
}

pub fn claim_marshal_reward(ctx: Context<ClaimMarshalReward>) -> Result<()> {
    let config = &ctx.accounts.config;
    let report = &mut ctx.accounts.report;
    let vote_record = &mut ctx.accounts.vote_record;

    // Check if eligible for reward
    let is_correct = vote_record.is_correct(report.outcome);
    require!(is_correct == Some(true), MarshalCraftError::NotEligibleForReward);

    // Calculate reward share
    // Marshals get: (for Upheld) 50% of creator_held, (for Dismissed) 100% of reporter bond
    let pot = match report.outcome {
        ResolutionOutcome::Upheld => {
            (report.creator_held as u128 * (10000 - config.reporter_reward_bps) as u128 / 10000) as u64
        }
        ResolutionOutcome::Dismissed => report.total_bond,
        _ => 0,
    };

    if pot == 0 {
        return Err(MarshalCraftError::NotEligibleForReward.into());
    }

    // Calculate this marshal's share based on voting power weight
    let total_correct_weight = match report.outcome {
        ResolutionOutcome::Upheld => report.votes_remove_weight,
        ResolutionOutcome::Dismissed => report.votes_keep_weight,
        _ => 0,
    };

    if total_correct_weight == 0 {
        return Err(MarshalCraftError::NotEligibleForReward.into());
    }

    let reward = (pot as u128 * vote_record.voting_power as u128 / total_correct_weight as u128) as u64;

    // Transfer reward from report account to marshal
    **report.to_account_info().try_borrow_mut_lamports()? -= reward;
    **ctx.accounts.marshal.to_account_info().try_borrow_mut_lamports()? += reward;

    vote_record.reward_claimed = true;

    msg!("Marshal reward claimed: {} lamports", reward);
    Ok(())
}

#[derive(Accounts)]
pub struct ClaimReporterReward<'info> {
    #[account(mut)]
    pub reporter: Signer<'info>,

    pub config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        has_one = config,
    )]
    pub reporter_account: Account<'info, ReporterAccount>,

    #[account(
        mut,
        has_one = config,
        constraint = report.status == ReportStatus::Resolved @ MarshalCraftError::ReportNotFound,
    )]
    pub report: Account<'info, ContentReport>,

    #[account(
        mut,
        has_one = report,
        has_one = reporter,
        constraint = !reporter_record.reward_claimed @ MarshalCraftError::RewardAlreadyClaimed,
    )]
    pub reporter_record: Account<'info, ReporterRecord>,

    pub system_program: Program<'info, System>,
}

pub fn claim_reporter_reward(ctx: Context<ClaimReporterReward>) -> Result<()> {
    let config = &ctx.accounts.config;
    let reporter_account = &mut ctx.accounts.reporter_account;
    let report = &mut ctx.accounts.report;
    let reporter_record = &mut ctx.accounts.reporter_record;

    match report.outcome {
        ResolutionOutcome::Upheld => {
            // Reporter wins - get share of creator's slashed stake
            let reporter_pot = (report.creator_held as u128 * config.reporter_reward_bps as u128 / 10000) as u64;
            let reward = reporter_record.calculate_reward_share(reporter_pot, report.total_bond);

            // Also return original bond
            let total_return = reward + reporter_record.bond;

            // Transfer from report account
            **report.to_account_info().try_borrow_mut_lamports()? -= total_return;
            **ctx.accounts.reporter.to_account_info().try_borrow_mut_lamports()? += total_return;

            // Update reputation - correct report
            let remaining = 10000u16.saturating_sub(reporter_account.reputation);
            let multiplier = get_s_curve_multiplier(reporter_account.reputation, config);
            let gain = (remaining as u32 * config.reputation_gain_rate as u32 * multiplier as u32 / 10000 / 10000) as u16;
            reporter_account.reputation = reporter_account.reputation.saturating_add(gain);
            reporter_account.reports_upheld += 1;

            msg!("Reporter reward claimed: {} lamports (including bond)", total_return);
        }
        ResolutionOutcome::Dismissed => {
            // Reporter loses bond - update reputation
            let multiplier = get_s_curve_multiplier(reporter_account.reputation, config);
            let loss = (reporter_account.reputation as u32 * config.reputation_loss_rate as u32 * multiplier as u32 / 10000 / 10000) as u16;
            reporter_account.reputation = reporter_account.reputation.saturating_sub(loss);
            reporter_account.reports_dismissed += 1;

            msg!("Report dismissed - reporter loses bond, reputation decreased");
        }
        ResolutionOutcome::NoParticipation => {
            // Return bond only - no reputation change
            **report.to_account_info().try_borrow_mut_lamports()? -= reporter_record.bond;
            **ctx.accounts.reporter.to_account_info().try_borrow_mut_lamports()? += reporter_record.bond;

            msg!("No participation - bond returned: {} lamports", reporter_record.bond);
        }
        _ => {
            return Err(MarshalCraftError::ReportNotFound.into());
        }
    }

    reporter_record.reward_claimed = true;
    Ok(())
}

/// Calculate S-curve multiplier based on reputation zone
fn get_s_curve_multiplier(reputation: u16, config: &ProtocolConfig) -> u16 {
    if reputation >= config.grace_zone_low && reputation <= config.grace_zone_high {
        // Grace zone (around 50%)
        config.grace_zone_multiplier
    } else if reputation < config.extreme_zone_low || reputation > config.extreme_zone_high {
        // Extreme zones (below 25% or above 75%)
        config.extreme_zone_multiplier
    } else {
        // Normal accountability zone
        config.normal_zone_multiplier
    }
}
