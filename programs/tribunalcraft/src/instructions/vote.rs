use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::{JUROR_RECORD_SEED, JUROR_POOL_SEED, SUBJECT_SEED, DISPUTE_SEED};
use crate::errors::TribunalCraftError;
use crate::events::{VoteEvent, RestoreVoteEvent};

/// Vote on a dispute
#[derive(Accounts)]
pub struct VoteOnDispute<'info> {
    #[account(mut)]
    pub juror: Signer<'info>,

    #[account(
        mut,
        constraint = juror_pool.owner == juror.key() @ TribunalCraftError::Unauthorized,
        seeds = [JUROR_POOL_SEED, juror.key().as_ref()],
        bump = juror_pool.bump
    )]
    pub juror_pool: Account<'info, JurorPool>,

    #[account(
        seeds = [SUBJECT_SEED, subject.subject_id.as_ref()],
        bump = subject.bump,
    )]
    pub subject: Account<'info, Subject>,

    #[account(
        mut,
        seeds = [DISPUTE_SEED, subject.subject_id.as_ref()],
        bump = dispute.bump,
        constraint = dispute.status == DisputeStatus::Pending @ TribunalCraftError::DisputeAlreadyResolved,
        constraint = !dispute.is_restore @ TribunalCraftError::InvalidConfig, // Use vote_on_restore for restorations
    )]
    pub dispute: Account<'info, Dispute>,

    #[account(
        init,
        payer = juror,
        space = JurorRecord::LEN,
        seeds = [
            JUROR_RECORD_SEED,
            subject.subject_id.as_ref(),
            juror.key().as_ref(),
            &subject.round.to_le_bytes()
        ],
        bump
    )]
    pub juror_record: Account<'info, JurorRecord>,

    pub system_program: Program<'info, System>,
}

pub fn vote_on_dispute(
    ctx: Context<VoteOnDispute>,
    choice: VoteChoice,
    stake_allocation: u64,
    rationale_cid: String,
) -> Result<()> {
    require!(rationale_cid.len() <= JurorRecord::MAX_CID_LEN, TribunalCraftError::InvalidConfig);
    let juror_pool = &mut ctx.accounts.juror_pool;
    let subject = &ctx.accounts.subject;
    let dispute = &mut ctx.accounts.dispute;
    let juror_record = &mut ctx.accounts.juror_record;
    let clock = Clock::get()?;

    require!(!dispute.is_voting_ended(clock.unix_timestamp), TribunalCraftError::VotingEnded);
    require!(stake_allocation > 0, TribunalCraftError::VoteAllocationBelowMinimum);
    require!(stake_allocation <= juror_pool.balance, TribunalCraftError::InsufficientAvailableStake);

    // Calculate voting power using juror pool reputation
    let voting_power = juror_pool.calculate_voting_power(stake_allocation);

    // Lock stake from pool (stake stays in juror_pool, just marked as unavailable)
    juror_pool.balance = juror_pool.balance.saturating_sub(stake_allocation);

    // Update dispute vote weights
    match choice {
        VoteChoice::ForChallenger => {
            dispute.votes_for_challenger += voting_power;
        }
        VoteChoice::ForDefender => {
            dispute.votes_for_defender += voting_power;
        }
    }
    dispute.vote_count += 1;

    // Initialize juror record
    juror_record.subject_id = subject.subject_id;
    juror_record.juror = ctx.accounts.juror.key();
    juror_record.round = subject.round;
    juror_record.choice = choice;
    juror_record.restore_choice = RestoreVoteChoice::default();
    juror_record.is_restore_vote = false;
    juror_record.voting_power = voting_power;
    juror_record.stake_allocation = stake_allocation;
    juror_record.reward_claimed = false;
    juror_record.stake_unlocked = false;
    juror_record.bump = ctx.bumps.juror_record;
    juror_record.voted_at = clock.unix_timestamp;
    juror_record.rationale_cid = rationale_cid;

    emit!(VoteEvent {
        subject_id: subject.subject_id,
        round: subject.round,
        juror: ctx.accounts.juror.key(),
        choice,
        voting_power,
        rationale_cid: juror_record.rationale_cid.clone(),
        timestamp: clock.unix_timestamp,
    });

    msg!("Vote cast: {:?} with {} voting power", choice, voting_power);
    Ok(())
}

/// Vote on a restoration request
#[derive(Accounts)]
pub struct VoteOnRestore<'info> {
    #[account(mut)]
    pub juror: Signer<'info>,

    #[account(
        mut,
        constraint = juror_pool.owner == juror.key() @ TribunalCraftError::Unauthorized,
        seeds = [JUROR_POOL_SEED, juror.key().as_ref()],
        bump = juror_pool.bump
    )]
    pub juror_pool: Account<'info, JurorPool>,

    #[account(
        seeds = [SUBJECT_SEED, subject.subject_id.as_ref()],
        bump = subject.bump,
    )]
    pub subject: Account<'info, Subject>,

    #[account(
        mut,
        seeds = [DISPUTE_SEED, subject.subject_id.as_ref()],
        bump = dispute.bump,
        constraint = dispute.status == DisputeStatus::Pending @ TribunalCraftError::DisputeAlreadyResolved,
        constraint = dispute.is_restore @ TribunalCraftError::InvalidConfig, // Must be a restoration
    )]
    pub dispute: Account<'info, Dispute>,

    #[account(
        init,
        payer = juror,
        space = JurorRecord::LEN,
        seeds = [
            JUROR_RECORD_SEED,
            subject.subject_id.as_ref(),
            juror.key().as_ref(),
            &subject.round.to_le_bytes()
        ],
        bump
    )]
    pub juror_record: Account<'info, JurorRecord>,

    pub system_program: Program<'info, System>,
}

pub fn vote_on_restore(
    ctx: Context<VoteOnRestore>,
    choice: RestoreVoteChoice,
    stake_allocation: u64,
    rationale_cid: String,
) -> Result<()> {
    require!(rationale_cid.len() <= JurorRecord::MAX_CID_LEN, TribunalCraftError::InvalidConfig);
    let juror_pool = &mut ctx.accounts.juror_pool;
    let subject = &ctx.accounts.subject;
    let dispute = &mut ctx.accounts.dispute;
    let juror_record = &mut ctx.accounts.juror_record;
    let clock = Clock::get()?;

    require!(!dispute.is_voting_ended(clock.unix_timestamp), TribunalCraftError::VotingEnded);
    require!(stake_allocation > 0, TribunalCraftError::VoteAllocationBelowMinimum);
    require!(stake_allocation <= juror_pool.balance, TribunalCraftError::InsufficientAvailableStake);

    // Calculate voting power
    let voting_power = juror_pool.calculate_voting_power(stake_allocation);

    // Lock stake from pool (stake stays in juror_pool, just marked as unavailable)
    juror_pool.balance = juror_pool.balance.saturating_sub(stake_allocation);

    // Update dispute vote weights
    // ForRestoration maps to votes_for_challenger (ChallengerWins = subject restored)
    // AgainstRestoration maps to votes_for_defender (DefenderWins = subject stays invalidated)
    match choice {
        RestoreVoteChoice::ForRestoration => {
            dispute.votes_for_challenger += voting_power;
        }
        RestoreVoteChoice::AgainstRestoration => {
            dispute.votes_for_defender += voting_power;
        }
    }
    dispute.vote_count += 1;

    // Initialize juror record
    juror_record.subject_id = subject.subject_id;
    juror_record.juror = ctx.accounts.juror.key();
    juror_record.round = subject.round;
    juror_record.choice = VoteChoice::default();
    juror_record.restore_choice = choice;
    juror_record.is_restore_vote = true;
    juror_record.voting_power = voting_power;
    juror_record.stake_allocation = stake_allocation;
    juror_record.reward_claimed = false;
    juror_record.stake_unlocked = false;
    juror_record.bump = ctx.bumps.juror_record;
    juror_record.voted_at = clock.unix_timestamp;
    juror_record.rationale_cid = rationale_cid;

    emit!(RestoreVoteEvent {
        subject_id: subject.subject_id,
        round: subject.round,
        juror: ctx.accounts.juror.key(),
        choice,
        voting_power,
        rationale_cid: juror_record.rationale_cid.clone(),
        timestamp: clock.unix_timestamp,
    });

    msg!("Restoration vote cast: {:?} with {} voting power", choice, voting_power);
    Ok(())
}
