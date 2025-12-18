use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::{
    stacked_sigmoid, REPUTATION_GAIN_RATE, REPUTATION_LOSS_RATE,
    JUROR_ACCOUNT_SEED, CHALLENGER_ACCOUNT_SEED, DEFENDER_RECORD_SEED,
    PROTOCOL_CONFIG_SEED, DISPUTE_ESCROW_SEED,
    TOTAL_FEE_BPS, JUROR_SHARE_BPS, WINNER_SHARE_BPS,
};
use crate::errors::TribunalCraftError;

// =============================================================================
// RESOLVE DISPUTE
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

    /// Escrow PDA holds all funds for this dispute
    #[account(
        mut,
        seeds = [DISPUTE_ESCROW_SEED, dispute.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, DisputeEscrow>,

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

    let dispute_voting_ended = ctx.accounts.dispute.is_voting_ended(clock.unix_timestamp);
    require!(dispute_voting_ended, TribunalCraftError::VotingNotEnded);

    // Calculate platform fee from escrow
    let platform_fee = if !ctx.accounts.subject.free_case {
        let total_pool = ctx.accounts.escrow.total_bonds
            .saturating_add(ctx.accounts.escrow.total_stakes);

        if total_pool > 0 {
            let total_fees = total_pool as u128 * TOTAL_FEE_BPS as u128 / 10000;
            (total_fees * (10000 - JUROR_SHARE_BPS) as u128 / 10000) as u64
        } else {
            0
        }
    } else {
        0
    };

    let dispute = &mut ctx.accounts.dispute;
    let subject = &mut ctx.accounts.subject;
    let escrow = &mut ctx.accounts.escrow;

    // Determine outcome
    let outcome = dispute.determine_outcome();
    dispute.outcome = outcome;
    dispute.status = DisputeStatus::Resolved;
    dispute.resolved_at = clock.unix_timestamp;

    // Store dispute totals for future appeals
    let dispute_voting_period = dispute.voting_ends_at - dispute.voting_starts_at;
    subject.last_dispute_total = if dispute.is_appeal {
        dispute.appeal_stake
    } else {
        dispute.total_bond + dispute.total_stake_held()
    };
    subject.last_voting_period = dispute_voting_period;

    // Collect platform fees from escrow
    if platform_fee > 0 && outcome != ResolutionOutcome::NoParticipation {
        **escrow.to_account_info().try_borrow_mut_lamports()? -= platform_fee;
        **ctx.accounts.treasury.try_borrow_mut_lamports()? += platform_fee;
        escrow.record_platform_fee(platform_fee);
        msg!("Platform fee collected: {} lamports", platform_fee);
    }

    // Update subject status based on outcome
    if dispute.is_appeal {
        match outcome {
            ResolutionOutcome::ChallengerWins => {
                subject.status = SubjectStatus::Active;
                subject.dispute = Pubkey::default();
                subject.defender_count = 0;
                subject.total_stake = 0;
                msg!("Appeal resolved: Challenger wins - subject returns to active");
            }
            ResolutionOutcome::NoParticipation | ResolutionOutcome::DefenderWins => {
                subject.status = SubjectStatus::Invalidated;
                subject.dispute = Pubkey::default();
                msg!("Appeal resolved: Defender wins - subject remains invalidated");
            }
            ResolutionOutcome::None => {
                return Err(TribunalCraftError::InvalidVoteChoice.into());
            }
        }
    } else {
        match outcome {
            ResolutionOutcome::NoParticipation | ResolutionOutcome::DefenderWins => {
                subject.status = SubjectStatus::Active;
                subject.dispute = Pubkey::default();
                msg!("Dispute resolved - defender wins, subject returns to active");
            }
            ResolutionOutcome::ChallengerWins => {
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
// CLAIM JUROR REWARD (from escrow to JurorAccount)
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

    pub subject: Account<'info, Subject>,

    #[account(
        has_one = subject,
        constraint = dispute.status == DisputeStatus::Resolved @ TribunalCraftError::DisputeNotFound,
    )]
    pub dispute: Account<'info, Dispute>,

    /// Escrow PDA holds all funds
    #[account(
        mut,
        seeds = [DISPUTE_ESCROW_SEED, dispute.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, DisputeEscrow>,

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
    let dispute = &ctx.accounts.dispute;
    let escrow = &mut ctx.accounts.escrow;
    let juror_account = &mut ctx.accounts.juror_account;
    let vote_record = &mut ctx.accounts.vote_record;
    let clock = Clock::get()?;

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
                let gain = (remaining as u32 * REPUTATION_GAIN_RATE as u32 * multiplier as u32 / 10000 / 10000) as u16;
                juror_account.reputation = juror_account.reputation.saturating_add(gain);
                msg!("Reputation gain: +{}", gain);
            } else {
                let loss = (juror_account.reputation as u32 * REPUTATION_LOSS_RATE as u32 * multiplier as u32 / 10000 / 10000) as u16;
                juror_account.reputation = juror_account.reputation.saturating_sub(loss);
                msg!("Reputation loss: -{}", loss);
            }
        }

        // Note: Stake unlock is handled separately via unlock_juror_stake after 7 days
        vote_record.reputation_processed = true;
    }

    // =========================================================================
    // CLAIM REWARD (all voters get reward - incentivizes calling this function)
    // =========================================================================

    // Calculate juror pot from escrow totals
    let total_pool = escrow.total_bonds.saturating_add(escrow.total_stakes);
    let total_fees = total_pool as u128 * TOTAL_FEE_BPS as u128 / 10000;
    let juror_pot = (total_fees * JUROR_SHARE_BPS as u128 / 10000) as u64;

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

    // Transfer reward from escrow to JurorAccount PDA
    **escrow.to_account_info().try_borrow_mut_lamports()? -= reward;
    **juror_account.to_account_info().try_borrow_mut_lamports()? += reward;

    // Update juror balance accounting
    juror_account.add_reward(reward);
    escrow.record_juror_reward(reward);

    vote_record.reward_claimed = true;
    msg!("Juror reward claimed: {} lamports (added to balance)", reward);
    Ok(())
}

// =============================================================================
// CLAIM CHALLENGER REWARD (from escrow)
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

    pub subject: Account<'info, Subject>,

    #[account(
        mut,
        has_one = subject,
        constraint = dispute.status == DisputeStatus::Resolved @ TribunalCraftError::DisputeNotFound,
    )]
    pub dispute: Account<'info, Dispute>,

    /// Escrow PDA holds all funds
    #[account(
        mut,
        seeds = [DISPUTE_ESCROW_SEED, dispute.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, DisputeEscrow>,

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
    let escrow = &mut ctx.accounts.escrow;
    let challenger_record = &mut ctx.accounts.challenger_record;
    let challenger_account = &mut ctx.accounts.challenger_account;

    require!(!subject.free_case, TribunalCraftError::NotEligibleForReward);

    let outcome = dispute.outcome;
    let bond = challenger_record.bond;
    let total_bond = escrow.total_bonds;
    let matched_stake = escrow.total_stakes;

    match outcome {
        ResolutionOutcome::ChallengerWins => {
            // Winner: 80% of defender's stake + 80% of own bond back
            let defender_contribution = (matched_stake as u128 * WINNER_SHARE_BPS as u128 / 10000) as u64;
            let reward = challenger_record.calculate_reward_share(defender_contribution, total_bond);
            let bond_return = (bond as u128 * WINNER_SHARE_BPS as u128 / 10000) as u64;
            let total_return = reward + bond_return;

            // All from escrow
            **escrow.to_account_info().try_borrow_mut_lamports()? -= total_return;
            **ctx.accounts.challenger.to_account_info().try_borrow_mut_lamports()? += total_return;

            escrow.record_stake_claim(reward);
            escrow.bonds_claimed = escrow.bonds_claimed.saturating_add(bond_return);

            // Update reputation
            let remaining = 10000u16.saturating_sub(challenger_account.reputation);
            let multiplier = stacked_sigmoid(challenger_account.reputation);
            let gain = (remaining as u32 * REPUTATION_GAIN_RATE as u32 * multiplier as u32 / 10000 / 10000) as u16;
            challenger_account.reputation = challenger_account.reputation.saturating_add(gain);
            challenger_account.disputes_upheld += 1;

            msg!("Challenger reward claimed: {} lamports", total_return);
        }
        ResolutionOutcome::DefenderWins => {
            // Loser: loses bond
            let multiplier = stacked_sigmoid(challenger_account.reputation);
            let loss = (challenger_account.reputation as u32 * REPUTATION_LOSS_RATE as u32 * multiplier as u32 / 10000 / 10000) as u16;
            challenger_account.reputation = challenger_account.reputation.saturating_sub(loss);
            challenger_account.disputes_dismissed += 1;

            msg!("Dispute dismissed - challenger loses bond");
        }
        ResolutionOutcome::NoParticipation => {
            // No votes: full bond return
            **escrow.to_account_info().try_borrow_mut_lamports()? -= bond;
            **ctx.accounts.challenger.to_account_info().try_borrow_mut_lamports()? += bond;
            escrow.bonds_claimed = escrow.bonds_claimed.saturating_add(bond);

            msg!("No participation - bond returned: {} lamports", bond);
        }
        _ => {
            return Err(TribunalCraftError::DisputeNotFound.into());
        }
    }

    challenger_record.reward_claimed = true;
    escrow.challengers_claimed += 1;
    ctx.accounts.dispute.challengers_claimed += 1;
    Ok(())
}

// =============================================================================
// CLAIM DEFENDER REWARD (from escrow)
// =============================================================================

#[derive(Accounts)]
pub struct ClaimDefenderReward<'info> {
    #[account(mut)]
    pub defender: Signer<'info>,

    pub subject: Account<'info, Subject>,

    #[account(
        mut,
        has_one = subject,
        constraint = dispute.status == DisputeStatus::Resolved @ TribunalCraftError::DisputeNotFound,
    )]
    pub dispute: Account<'info, Dispute>,

    /// Escrow PDA holds all funds
    #[account(
        mut,
        seeds = [DISPUTE_ESCROW_SEED, dispute.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, DisputeEscrow>,

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
    let escrow = &mut ctx.accounts.escrow;
    let defender_record = &mut ctx.accounts.defender_record;

    require!(!subject.free_case, TribunalCraftError::NotEligibleForReward);

    let outcome = dispute.outcome;
    let stake = defender_record.stake;
    let total_bond = escrow.total_bonds;
    let total_stakes = escrow.total_stakes;

    match outcome {
        ResolutionOutcome::DefenderWins => {
            // Winner: 80% of challenger's bond + 80% of own stake back
            let bond_contribution = (total_bond as u128 * WINNER_SHARE_BPS as u128 / 10000) as u64;
            let reward = defender_record.calculate_reward_share(bond_contribution, total_stakes);
            let stake_return = (stake as u128 * WINNER_SHARE_BPS as u128 / 10000) as u64;
            let total_return = reward + stake_return;

            // All from escrow
            **escrow.to_account_info().try_borrow_mut_lamports()? -= total_return;
            **ctx.accounts.defender.to_account_info().try_borrow_mut_lamports()? += total_return;

            escrow.bonds_claimed = escrow.bonds_claimed.saturating_add(reward);
            escrow.record_stake_claim(stake_return);

            msg!("Defender reward claimed: {} lamports", total_return);
        }
        ResolutionOutcome::ChallengerWins => {
            // Loser: loses stake (already in escrow, goes to winners)
            msg!("Challenger wins - defender loses stake");
        }
        ResolutionOutcome::NoParticipation => {
            // No votes: full stake return
            **escrow.to_account_info().try_borrow_mut_lamports()? -= stake;
            **ctx.accounts.defender.to_account_info().try_borrow_mut_lamports()? += stake;
            escrow.record_stake_claim(stake);

            msg!("No participation - stake returned: {} lamports", stake);
        }
        _ => {
            return Err(TribunalCraftError::DisputeNotFound.into());
        }
    }

    defender_record.reward_claimed = true;
    escrow.defenders_claimed += 1;
    ctx.accounts.dispute.defenders_claimed += 1;
    Ok(())
}

// =============================================================================
// CLOSE ESCROW (after all claims complete)
// =============================================================================

#[derive(Accounts)]
pub struct CloseEscrow<'info> {
    #[account(mut)]
    pub closer: Signer<'info>,

    #[account(
        constraint = dispute.status == DisputeStatus::Resolved @ TribunalCraftError::DisputeNotFound,
    )]
    pub dispute: Account<'info, Dispute>,

    /// Escrow to close - must have all claims complete
    #[account(
        mut,
        close = closer,
        seeds = [DISPUTE_ESCROW_SEED, dispute.key().as_ref()],
        bump = escrow.bump,
        constraint = escrow.all_claims_complete() @ TribunalCraftError::ClaimsNotComplete,
    )]
    pub escrow: Account<'info, DisputeEscrow>,

    /// Protocol config for treasury
    #[account(
        seeds = [PROTOCOL_CONFIG_SEED],
        bump = protocol_config.bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// CHECK: Treasury receives any remaining dust
    #[account(
        mut,
        constraint = treasury.key() == protocol_config.treasury @ TribunalCraftError::InvalidConfig,
    )]
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn close_escrow(ctx: Context<CloseEscrow>) -> Result<()> {
    let escrow = &ctx.accounts.escrow;

    // Calculate dust (any remaining balance after all claims)
    let rent = Rent::get()?.minimum_balance(DisputeEscrow::LEN);
    let current_balance = escrow.to_account_info().lamports();
    let dust = current_balance.saturating_sub(rent);

    if dust > 0 {
        // Send dust to treasury before closing
        **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= dust;
        **ctx.accounts.treasury.try_borrow_mut_lamports()? += dust;
        msg!("Dust sent to treasury: {} lamports", dust);
    }

    // Account closure handled by `close = closer` attribute
    msg!("Escrow closed, rent returned to closer");
    Ok(())
}
