use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::{
    SUBJECT_SEED, ESCROW_SEED, DEFENDER_RECORD_SEED,
    CHALLENGER_RECORD_SEED, JUROR_RECORD_SEED, DEFENDER_POOL_SEED,
    CHALLENGER_POOL_SEED, JUROR_POOL_SEED, PROTOCOL_CONFIG_SEED,
    CLAIM_GRACE_PERIOD, TREASURY_SWEEP_PERIOD, BOT_REWARD_BPS,
    STAKE_UNLOCK_BUFFER,
    REPUTATION_GAIN_RATE, REPUTATION_LOSS_RATE, REP_100_PERCENT,
    stacked_sigmoid,
};
use crate::errors::TribunalCraftError;
use crate::events::{RewardClaimedEvent, RecordClosedEvent, RoundSweptEvent, StakeUnlockedEvent, ClaimRole};

// =============================================================================
// Claim Instructions
// =============================================================================

/// Claim defender reward
#[derive(Accounts)]
#[instruction(round: u32)]
pub struct ClaimDefender<'info> {
    #[account(mut)]
    pub defender: Signer<'info>,

    #[account(
        seeds = [SUBJECT_SEED, subject.subject_id.as_ref()],
        bump = subject.bump,
    )]
    pub subject: Account<'info, Subject>,

    #[account(
        mut,
        seeds = [ESCROW_SEED, subject.subject_id.as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
        seeds = [DEFENDER_RECORD_SEED, subject.subject_id.as_ref(), defender.key().as_ref(), &round.to_le_bytes()],
        bump = defender_record.bump,
        constraint = !defender_record.reward_claimed @ TribunalCraftError::RewardAlreadyClaimed,
    )]
    pub defender_record: Account<'info, DefenderRecord>,

    #[account(
        mut,
        seeds = [DEFENDER_POOL_SEED, defender.key().as_ref()],
        bump = defender_pool.bump,
    )]
    pub defender_pool: Account<'info, DefenderPool>,

    pub system_program: Program<'info, System>,
}

pub fn claim_defender(ctx: Context<ClaimDefender>, round: u32) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;
    let defender_record = &mut ctx.accounts.defender_record;
    let defender_pool = &mut ctx.accounts.defender_pool;
    let clock = Clock::get()?;

    // Find round result and extract needed data
    let round_idx = escrow.rounds.iter().position(|r| r.round == round)
        .ok_or(TribunalCraftError::DisputeNotFound)?;

    let outcome = escrow.rounds[round_idx].outcome;
    let winner_pool = escrow.rounds[round_idx].winner_pool;
    let bond_at_risk = escrow.rounds[round_idx].bond_at_risk;
    let safe_bond = escrow.rounds[round_idx].safe_bond;
    let total_stake = escrow.rounds[round_idx].total_stake;

    // Total available bond = bond_at_risk + safe_bond (sum of all defender contributions)
    let available_bond = bond_at_risk.saturating_add(safe_bond);

    // Calculate defender's share of safe bond
    // Distributed proportionally based on their contribution to total available bond
    let safe_bond_share = if available_bond > 0 {
        (safe_bond as u128 * defender_record.bond as u128 / available_bond as u128) as u64
    } else {
        0
    };

    // Calculate defender's at-risk portion (proportional to their bond contribution)
    let defender_at_risk = if available_bond > 0 {
        (bond_at_risk as u128 * defender_record.bond as u128 / available_bond as u128) as u64
    } else {
        0
    };

    // Defenders claim based on outcome
    // At-risk bond goes into contested pool, NOT returned separately
    // Safe bond is always returned regardless of outcome
    let reward = match outcome {
        ResolutionOutcome::DefenderWins => {
            // Defender gets: share of winner pool + safe bond share
            // Winner pool share is proportional to their at-risk contribution
            // NOTE: at-risk is NOT returned separately - it's part of the contested pool
            let winner_share = if bond_at_risk > 0 {
                (winner_pool as u128 * defender_at_risk as u128 / bond_at_risk as u128) as u64
            } else {
                0
            };
            winner_share.saturating_add(safe_bond_share)
        }
        ResolutionOutcome::NoParticipation => {
            // Treasury took 1%, refund 99% proportionally + safe bond
            let total_pool = total_stake.saturating_add(bond_at_risk);
            let winner_share = if total_pool > 0 {
                (winner_pool as u128 * defender_at_risk as u128 / total_pool as u128) as u64
            } else {
                0
            };
            winner_share.saturating_add(safe_bond_share)
        }
        ResolutionOutcome::ChallengerWins => {
            // Lost at-risk portion (went to winner pool), but still get safe bond share
            safe_bond_share
        }
        ResolutionOutcome::None => 0,
    };

    if reward > 0 {
        // Transfer from escrow to defender pool
        **escrow.to_account_info().try_borrow_mut_lamports()? -= reward;
        **defender_pool.to_account_info().try_borrow_mut_lamports()? += reward;

        escrow.balance = escrow.balance.saturating_sub(reward);
        defender_pool.add_reward(reward);
    }

    // Mark as claimed
    defender_record.reward_claimed = true;
    escrow.rounds[round_idx].defender_claims += 1;

    emit!(RewardClaimedEvent {
        subject_id: ctx.accounts.subject.subject_id,
        round,
        claimer: ctx.accounts.defender.key(),
        role: ClaimRole::Defender,
        amount: reward,
        timestamp: clock.unix_timestamp,
    });

    msg!("Defender claimed {} lamports", reward);
    Ok(())
}

/// Claim challenger reward
#[derive(Accounts)]
#[instruction(round: u32)]
pub struct ClaimChallenger<'info> {
    #[account(mut)]
    pub challenger: Signer<'info>,

    #[account(
        seeds = [SUBJECT_SEED, subject.subject_id.as_ref()],
        bump = subject.bump,
    )]
    pub subject: Account<'info, Subject>,

    #[account(
        mut,
        seeds = [ESCROW_SEED, subject.subject_id.as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
        seeds = [CHALLENGER_RECORD_SEED, subject.subject_id.as_ref(), challenger.key().as_ref(), &round.to_le_bytes()],
        bump = challenger_record.bump,
        constraint = !challenger_record.reward_claimed @ TribunalCraftError::RewardAlreadyClaimed,
    )]
    pub challenger_record: Account<'info, ChallengerRecord>,

    #[account(
        mut,
        seeds = [CHALLENGER_POOL_SEED, challenger.key().as_ref()],
        bump = challenger_pool.bump,
    )]
    pub challenger_pool: Account<'info, ChallengerPool>,

    pub system_program: Program<'info, System>,
}

pub fn claim_challenger(ctx: Context<ClaimChallenger>, round: u32) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;
    let challenger_record = &mut ctx.accounts.challenger_record;
    let challenger_pool = &mut ctx.accounts.challenger_pool;
    let clock = Clock::get()?;

    // Find round result and extract needed data
    let round_idx = escrow.rounds.iter().position(|r| r.round == round)
        .ok_or(TribunalCraftError::DisputeNotFound)?;

    let outcome = escrow.rounds[round_idx].outcome;
    let winner_pool = escrow.rounds[round_idx].winner_pool;
    let total_stake = escrow.rounds[round_idx].total_stake;
    let bond_at_risk = escrow.rounds[round_idx].bond_at_risk;
    let is_restore = escrow.rounds[round_idx].is_restore();

    // Challengers claim based on outcome
    // For restorations: restorer always gets 80% back regardless of outcome
    // For normal disputes: stake goes into contested pool
    let reward = if is_restore {
        // Restoration: restorer always gets their share of winner pool (80%)
        // Update reputation based on outcome
        match outcome {
            ResolutionOutcome::ChallengerWins => {
                // Restoration succeeded - gain reputation
                let multiplier = stacked_sigmoid(challenger_pool.reputation);
                let actual_gain = (REPUTATION_GAIN_RATE as u128 * multiplier as u128 / REP_100_PERCENT as u128) as u64;
                challenger_pool.reputation = challenger_pool.reputation
                    .saturating_add(actual_gain)
                    .min(REP_100_PERCENT);
            }
            ResolutionOutcome::DefenderWins => {
                // Restoration failed - lose reputation
                let multiplier = stacked_sigmoid(challenger_pool.reputation);
                let actual_loss = (REPUTATION_LOSS_RATE as u128 * multiplier as u128 / REP_100_PERCENT as u128) as u64;
                challenger_pool.reputation = challenger_pool.reputation
                    .saturating_sub(actual_loss);
            }
            _ => {}
        }
        // Always return 80% to restorer regardless of outcome
        challenger_record.calculate_reward_share(winner_pool, total_stake)
    } else {
        // Normal dispute: outcome determines reward
        match outcome {
            ResolutionOutcome::ChallengerWins => {
                // Challenger wins - gain reputation scaled by sigmoid multiplier
                let multiplier = stacked_sigmoid(challenger_pool.reputation);
                let actual_gain = (REPUTATION_GAIN_RATE as u128 * multiplier as u128 / REP_100_PERCENT as u128) as u64;
                challenger_pool.reputation = challenger_pool.reputation
                    .saturating_add(actual_gain)
                    .min(REP_100_PERCENT);
                // Challenger gets share of winner pool only
                challenger_record.calculate_reward_share(winner_pool, total_stake)
            }
            ResolutionOutcome::NoParticipation => {
                // No participation - no reputation change
                // Treasury took 1%, refund 99% proportionally from winner_pool
                let total_pool = total_stake.saturating_add(bond_at_risk);
                if total_pool > 0 {
                    (winner_pool as u128 * challenger_record.stake as u128 / total_pool as u128) as u64
                } else {
                    0
                }
            }
            ResolutionOutcome::DefenderWins => {
                // Challenger loses - lose reputation scaled by sigmoid multiplier
                let multiplier = stacked_sigmoid(challenger_pool.reputation);
                let actual_loss = (REPUTATION_LOSS_RATE as u128 * multiplier as u128 / REP_100_PERCENT as u128) as u64;
                challenger_pool.reputation = challenger_pool.reputation
                    .saturating_sub(actual_loss);
                // Lost - no reward (stake went to winner pool)
                0
            }
            ResolutionOutcome::None => 0,
        }
    };

    if reward > 0 {
        // Transfer from escrow to challenger pool
        **escrow.to_account_info().try_borrow_mut_lamports()? -= reward;
        **challenger_pool.to_account_info().try_borrow_mut_lamports()? += reward;

        escrow.balance = escrow.balance.saturating_sub(reward);
        challenger_pool.deposit(reward);
    }

    // Mark as claimed
    challenger_record.reward_claimed = true;
    escrow.rounds[round_idx].challenger_claims += 1;

    emit!(RewardClaimedEvent {
        subject_id: ctx.accounts.subject.subject_id,
        round,
        claimer: ctx.accounts.challenger.key(),
        role: ClaimRole::Challenger,
        amount: reward,
        timestamp: clock.unix_timestamp,
    });

    msg!("Challenger claimed {} lamports", reward);
    Ok(())
}

/// Claim juror reward
#[derive(Accounts)]
#[instruction(round: u32)]
pub struct ClaimJuror<'info> {
    #[account(mut)]
    pub juror: Signer<'info>,

    #[account(
        seeds = [SUBJECT_SEED, subject.subject_id.as_ref()],
        bump = subject.bump,
    )]
    pub subject: Account<'info, Subject>,

    #[account(
        mut,
        seeds = [ESCROW_SEED, subject.subject_id.as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
        seeds = [JUROR_RECORD_SEED, subject.subject_id.as_ref(), juror.key().as_ref(), &round.to_le_bytes()],
        bump = juror_record.bump,
        constraint = !juror_record.reward_claimed @ TribunalCraftError::RewardAlreadyClaimed,
    )]
    pub juror_record: Account<'info, JurorRecord>,

    #[account(
        mut,
        seeds = [JUROR_POOL_SEED, juror.key().as_ref()],
        bump = juror_pool.bump,
    )]
    pub juror_pool: Account<'info, JurorPool>,

    pub system_program: Program<'info, System>,
}

pub fn claim_juror(ctx: Context<ClaimJuror>, round: u32) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;
    let juror_record = &mut ctx.accounts.juror_record;
    let juror_pool = &mut ctx.accounts.juror_pool;
    let clock = Clock::get()?;

    // Find round result and extract needed data
    let round_idx = escrow.rounds.iter().position(|r| r.round == round)
        .ok_or(TribunalCraftError::DisputeNotFound)?;

    let outcome = escrow.rounds[round_idx].outcome;
    let juror_pool_amount = escrow.rounds[round_idx].juror_pool;
    let total_vote_weight = escrow.rounds[round_idx].total_vote_weight;

    // Check if juror voted correctly
    let is_correct = juror_record.is_correct(outcome);

    let reward = match is_correct {
        Some(true) => {
            // Correct vote - get share of juror pool
            // Update reputation: gain scaled by sigmoid multiplier (0.2x to 2x based on current rep)
            let multiplier = stacked_sigmoid(juror_pool.reputation);
            let actual_gain = (REPUTATION_GAIN_RATE as u128 * multiplier as u128 / REP_100_PERCENT as u128) as u64;
            juror_pool.reputation = juror_pool.reputation
                .saturating_add(actual_gain)
                .min(REP_100_PERCENT);
            juror_record.calculate_reward_share(juror_pool_amount, total_vote_weight)
        }
        Some(false) => {
            // Wrong vote - no reward, lose stake (already transferred to subject)
            // Update reputation: lose scaled by sigmoid multiplier (0.2x to 2x based on current rep)
            let multiplier = stacked_sigmoid(juror_pool.reputation);
            let actual_loss = (REPUTATION_LOSS_RATE as u128 * multiplier as u128 / REP_100_PERCENT as u128) as u64;
            juror_pool.reputation = juror_pool.reputation
                .saturating_sub(actual_loss);
            0
        }
        None => {
            // NoParticipation - no reputation change
            0
        }
    };

    if reward > 0 {
        // Transfer from escrow to juror pool
        **escrow.to_account_info().try_borrow_mut_lamports()? -= reward;
        **juror_pool.to_account_info().try_borrow_mut_lamports()? += reward;

        escrow.balance = escrow.balance.saturating_sub(reward);
        juror_pool.add_reward(reward);
    }

    // Mark as claimed
    juror_record.reward_claimed = true;
    escrow.rounds[round_idx].juror_claims += 1;

    emit!(RewardClaimedEvent {
        subject_id: ctx.accounts.subject.subject_id,
        round,
        claimer: ctx.accounts.juror.key(),
        role: ClaimRole::Juror,
        amount: reward,
        timestamp: clock.unix_timestamp,
    });

    msg!("Juror claimed {} lamports", reward);
    Ok(())
}

// =============================================================================
// Unlock Stake Instructions
// =============================================================================

/// Unlock juror stake after 7 days post-resolution
#[derive(Accounts)]
#[instruction(round: u32)]
pub struct UnlockJurorStake<'info> {
    #[account(mut)]
    pub juror: Signer<'info>,

    #[account(
        seeds = [SUBJECT_SEED, subject.subject_id.as_ref()],
        bump = subject.bump,
    )]
    pub subject: Account<'info, Subject>,

    #[account(
        seeds = [ESCROW_SEED, subject.subject_id.as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
        seeds = [JUROR_RECORD_SEED, subject.subject_id.as_ref(), juror.key().as_ref(), &round.to_le_bytes()],
        bump = juror_record.bump,
        constraint = !juror_record.stake_unlocked @ TribunalCraftError::StakeAlreadyUnlocked,
    )]
    pub juror_record: Account<'info, JurorRecord>,

    #[account(
        mut,
        seeds = [JUROR_POOL_SEED, juror.key().as_ref()],
        bump = juror_pool.bump,
    )]
    pub juror_pool: Account<'info, JurorPool>,

    pub system_program: Program<'info, System>,
}

pub fn unlock_juror_stake(ctx: Context<UnlockJurorStake>, round: u32) -> Result<()> {
    let escrow = &ctx.accounts.escrow;
    let juror_record = &mut ctx.accounts.juror_record;
    let juror_pool = &mut ctx.accounts.juror_pool;
    let clock = Clock::get()?;

    // Find round result to get resolved_at
    let round_result = escrow.find_round(round)
        .ok_or(TribunalCraftError::DisputeNotFound)?;

    // Check that 7 days have passed since resolution
    let unlock_time = round_result.resolved_at + STAKE_UNLOCK_BUFFER;
    require!(
        clock.unix_timestamp >= unlock_time,
        TribunalCraftError::StakeStillLocked
    );

    // Return stake to juror pool
    let stake_amount = juror_record.stake_allocation;
    juror_pool.balance = juror_pool.balance.saturating_add(stake_amount);

    // Mark stake as unlocked
    juror_record.stake_unlocked = true;

    emit!(StakeUnlockedEvent {
        subject_id: ctx.accounts.subject.subject_id,
        round,
        juror: ctx.accounts.juror.key(),
        amount: stake_amount,
        timestamp: clock.unix_timestamp,
    });

    msg!("Juror stake unlocked: {} lamports", stake_amount);
    Ok(())
}

// =============================================================================
// Close Record Instructions
// =============================================================================

/// Close defender record to reclaim rent
#[derive(Accounts)]
#[instruction(round: u32)]
pub struct CloseDefenderRecord<'info> {
    #[account(mut)]
    pub defender: Signer<'info>,

    #[account(
        seeds = [SUBJECT_SEED, subject.subject_id.as_ref()],
        bump = subject.bump,
    )]
    pub subject: Account<'info, Subject>,

    #[account(
        seeds = [ESCROW_SEED, subject.subject_id.as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
        close = defender,
        seeds = [DEFENDER_RECORD_SEED, subject.subject_id.as_ref(), defender.key().as_ref(), &round.to_le_bytes()],
        bump = defender_record.bump,
    )]
    pub defender_record: Account<'info, DefenderRecord>,

    pub system_program: Program<'info, System>,
}

pub fn close_defender_record(ctx: Context<CloseDefenderRecord>, round: u32) -> Result<()> {
    let escrow = &ctx.accounts.escrow;
    let defender_record = &ctx.accounts.defender_record;
    let clock = Clock::get()?;

    // Can close if: claimed OR round was swept
    let round_result = escrow.find_round(round);
    let can_close = defender_record.reward_claimed || round_result.is_none();

    require!(can_close, TribunalCraftError::ClaimsNotComplete);

    emit!(RecordClosedEvent {
        subject_id: ctx.accounts.subject.subject_id,
        round,
        owner: ctx.accounts.defender.key(),
        role: ClaimRole::Defender,
        rent_returned: ctx.accounts.defender_record.to_account_info().lamports(),
        timestamp: clock.unix_timestamp,
    });

    msg!("Defender record closed for round {}", round);
    Ok(())
}

/// Close challenger record
#[derive(Accounts)]
#[instruction(round: u32)]
pub struct CloseChallengerRecord<'info> {
    #[account(mut)]
    pub challenger: Signer<'info>,

    #[account(
        seeds = [SUBJECT_SEED, subject.subject_id.as_ref()],
        bump = subject.bump,
    )]
    pub subject: Account<'info, Subject>,

    #[account(
        seeds = [ESCROW_SEED, subject.subject_id.as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
        close = challenger,
        seeds = [CHALLENGER_RECORD_SEED, subject.subject_id.as_ref(), challenger.key().as_ref(), &round.to_le_bytes()],
        bump = challenger_record.bump,
    )]
    pub challenger_record: Account<'info, ChallengerRecord>,

    pub system_program: Program<'info, System>,
}

pub fn close_challenger_record(ctx: Context<CloseChallengerRecord>, round: u32) -> Result<()> {
    let escrow = &ctx.accounts.escrow;
    let challenger_record = &ctx.accounts.challenger_record;
    let clock = Clock::get()?;

    let round_result = escrow.find_round(round);
    let can_close = challenger_record.reward_claimed || round_result.is_none();

    require!(can_close, TribunalCraftError::ClaimsNotComplete);

    emit!(RecordClosedEvent {
        subject_id: ctx.accounts.subject.subject_id,
        round,
        owner: ctx.accounts.challenger.key(),
        role: ClaimRole::Challenger,
        rent_returned: ctx.accounts.challenger_record.to_account_info().lamports(),
        timestamp: clock.unix_timestamp,
    });

    msg!("Challenger record closed for round {}", round);
    Ok(())
}

/// Close juror record
#[derive(Accounts)]
#[instruction(round: u32)]
pub struct CloseJurorRecord<'info> {
    #[account(mut)]
    pub juror: Signer<'info>,

    #[account(
        seeds = [SUBJECT_SEED, subject.subject_id.as_ref()],
        bump = subject.bump,
    )]
    pub subject: Account<'info, Subject>,

    #[account(
        seeds = [ESCROW_SEED, subject.subject_id.as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
        close = juror,
        seeds = [JUROR_RECORD_SEED, subject.subject_id.as_ref(), juror.key().as_ref(), &round.to_le_bytes()],
        bump = juror_record.bump,
    )]
    pub juror_record: Account<'info, JurorRecord>,

    pub system_program: Program<'info, System>,
}

pub fn close_juror_record(ctx: Context<CloseJurorRecord>, round: u32) -> Result<()> {
    let escrow = &ctx.accounts.escrow;
    let juror_record = &ctx.accounts.juror_record;
    let clock = Clock::get()?;

    let round_result = escrow.find_round(round);
    let can_close = juror_record.reward_claimed || round_result.is_none();

    require!(can_close, TribunalCraftError::ClaimsNotComplete);

    emit!(RecordClosedEvent {
        subject_id: ctx.accounts.subject.subject_id,
        round,
        owner: ctx.accounts.juror.key(),
        role: ClaimRole::Juror,
        rent_returned: ctx.accounts.juror_record.to_account_info().lamports(),
        timestamp: clock.unix_timestamp,
    });

    msg!("Juror record closed for round {}", round);
    Ok(())
}

// =============================================================================
// Sweep Instructions
// =============================================================================

/// Creator sweep (after 30 days)
#[derive(Accounts)]
#[instruction(round: u32)]
pub struct SweepRoundCreator<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        seeds = [SUBJECT_SEED, subject.subject_id.as_ref()],
        bump = subject.bump,
    )]
    pub subject: Account<'info, Subject>,

    #[account(
        mut,
        seeds = [ESCROW_SEED, subject.subject_id.as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,

    pub system_program: Program<'info, System>,
}

pub fn sweep_round_creator(ctx: Context<SweepRoundCreator>, round: u32) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;
    let clock = Clock::get()?;

    // Find round result and extract needed data
    let round_idx = escrow.rounds.iter().position(|r| r.round == round)
        .ok_or(TribunalCraftError::DisputeNotFound)?;

    let round_creator = escrow.rounds[round_idx].creator;
    let resolved_at = escrow.rounds[round_idx].resolved_at;

    // Only creator can sweep (30-90 days)
    require!(
        ctx.accounts.creator.key() == round_creator,
        TribunalCraftError::Unauthorized
    );

    let elapsed = clock.unix_timestamp - resolved_at;
    require!(
        elapsed >= CLAIM_GRACE_PERIOD && elapsed < TREASURY_SWEEP_PERIOD,
        TribunalCraftError::InvalidConfig
    );

    // Calculate unclaimed
    let unclaimed = escrow.rounds[round_idx].calculate_unclaimed();

    if unclaimed > 0 {
        // Transfer to creator
        **escrow.to_account_info().try_borrow_mut_lamports()? -= unclaimed;
        **ctx.accounts.creator.to_account_info().try_borrow_mut_lamports()? += unclaimed;

        escrow.balance = escrow.balance.saturating_sub(unclaimed);
    }

    // Remove round from escrow
    escrow.rounds.remove(round_idx);

    // Compact escrow account
    let new_size = Escrow::size_for_rounds(escrow.rounds.len());
    escrow.to_account_info().resize(new_size)?;

    emit!(RoundSweptEvent {
        subject_id: ctx.accounts.subject.subject_id,
        round,
        sweeper: ctx.accounts.creator.key(),
        unclaimed,
        bot_reward: 0,
        timestamp: clock.unix_timestamp,
    });

    msg!("Creator swept round {}: {} unclaimed", round, unclaimed);
    Ok(())
}

/// Treasury sweep (after 90 days, anyone can call, gets 1% reward)
#[derive(Accounts)]
#[instruction(round: u32)]
pub struct SweepRoundTreasury<'info> {
    #[account(mut)]
    pub sweeper: Signer<'info>,

    #[account(
        seeds = [SUBJECT_SEED, subject.subject_id.as_ref()],
        bump = subject.bump,
    )]
    pub subject: Account<'info, Subject>,

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

    /// Treasury receives swept funds
    /// CHECK: Validated against protocol_config.treasury
    #[account(
        mut,
        constraint = treasury.key() == protocol_config.treasury @ TribunalCraftError::InvalidConfig
    )]
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn sweep_round_treasury(ctx: Context<SweepRoundTreasury>, round: u32) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;
    let clock = Clock::get()?;

    // Find round result and extract needed data
    let round_idx = escrow.rounds.iter().position(|r| r.round == round)
        .ok_or(TribunalCraftError::DisputeNotFound)?;

    let resolved_at = escrow.rounds[round_idx].resolved_at;

    // Anyone can sweep after 90 days
    let elapsed = clock.unix_timestamp - resolved_at;
    require!(
        elapsed >= TREASURY_SWEEP_PERIOD,
        TribunalCraftError::InvalidConfig
    );

    // Calculate unclaimed
    let unclaimed = escrow.rounds[round_idx].calculate_unclaimed();

    if unclaimed > 0 {
        // Bot gets 1% as reward
        let bot_reward = (unclaimed as u128 * BOT_REWARD_BPS as u128 / 10000) as u64;
        let treasury_amount = unclaimed.saturating_sub(bot_reward);

        // Transfer to treasury
        **escrow.to_account_info().try_borrow_mut_lamports()? -= unclaimed;
        **ctx.accounts.treasury.try_borrow_mut_lamports()? += treasury_amount;
        **ctx.accounts.sweeper.to_account_info().try_borrow_mut_lamports()? += bot_reward;

        escrow.balance = escrow.balance.saturating_sub(unclaimed);

        emit!(RoundSweptEvent {
            subject_id: ctx.accounts.subject.subject_id,
            round,
            sweeper: ctx.accounts.sweeper.key(),
            unclaimed,
            bot_reward,
            timestamp: clock.unix_timestamp,
        });

        msg!("Treasury swept round {}: {} to treasury, {} bot reward", round, treasury_amount, bot_reward);
    }

    // Remove round from escrow
    escrow.rounds.remove(round_idx);

    // Compact escrow account
    let new_size = Escrow::size_for_rounds(escrow.rounds.len());
    escrow.to_account_info().resize(new_size)?;

    Ok(())
}
