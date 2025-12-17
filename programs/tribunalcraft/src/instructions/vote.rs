use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::{VOTE_RECORD_SEED, JUROR_ACCOUNT_SEED, STAKE_UNLOCK_BUFFER};
use crate::errors::TribunalCraftError;

#[derive(Accounts)]
pub struct VoteOnDispute<'info> {
    #[account(mut)]
    pub juror: Signer<'info>,

    #[account(
        mut,
        has_one = juror @ TribunalCraftError::Unauthorized,
        constraint = juror_account.is_active @ TribunalCraftError::JurorNotActive,
        seeds = [JUROR_ACCOUNT_SEED, juror.key().as_ref()],
        bump = juror_account.bump
    )]
    pub juror_account: Account<'info, JurorAccount>,

    #[account(
        constraint = subject.key() == dispute.subject @ TribunalCraftError::InvalidConfig,
    )]
    pub subject: Account<'info, Subject>,

    #[account(
        mut,
        has_one = subject,
        constraint = dispute.status == DisputeStatus::Pending @ TribunalCraftError::DisputeAlreadyResolved,
    )]
    pub dispute: Account<'info, Dispute>,

    #[account(
        init,
        payer = juror,
        space = VoteRecord::LEN,
        seeds = [VOTE_RECORD_SEED, dispute.key().as_ref(), juror.key().as_ref()],
        bump
    )]
    pub vote_record: Account<'info, VoteRecord>,

    pub system_program: Program<'info, System>,
}

pub fn vote_on_dispute(
    ctx: Context<VoteOnDispute>,
    choice: VoteChoice,
    stake_allocation: u64,
    rationale_cid: String,
) -> Result<()> {
    require!(rationale_cid.len() <= VoteRecord::MAX_CID_LEN, TribunalCraftError::InvalidConfig);
    let juror_account = &mut ctx.accounts.juror_account;
    let subject = &ctx.accounts.subject;
    let dispute = &mut ctx.accounts.dispute;
    let vote_record = &mut ctx.accounts.vote_record;
    let clock = Clock::get()?;

    require!(!dispute.is_voting_ended(clock.unix_timestamp), TribunalCraftError::VotingEnded);

    // Ensure this is not an appeal (use vote_on_appeal for appeals)
    require!(!dispute.is_appeal, TribunalCraftError::InvalidConfig);

    // Validate stake allocation (any amount > 0 is allowed - platform can enforce minimums)
    require!(stake_allocation > 0, TribunalCraftError::VoteAllocationBelowMinimum);
    require!(stake_allocation <= juror_account.available_stake, TribunalCraftError::InsufficientAvailableStake);

    // Calculate voting power
    let voting_power = juror_account.calculate_voting_power(stake_allocation);

    // Lock stake
    juror_account.available_stake -= stake_allocation;

    // Update dispute vote weights
    match choice {
        VoteChoice::ForChallenger => {
            dispute.votes_favor_weight += voting_power;
        }
        VoteChoice::ForDefender => {
            dispute.votes_against_weight += voting_power;
        }
    }
    dispute.vote_count += 1;

    // Initialize vote record
    vote_record.dispute = dispute.key();
    vote_record.juror = ctx.accounts.juror.key();
    vote_record.juror_account = juror_account.key();
    vote_record.choice = choice;
    vote_record.appeal_choice = AppealVoteChoice::default();
    vote_record.is_appeal_vote = false;
    vote_record.stake_allocated = stake_allocation;
    vote_record.voting_power = voting_power;
    // Free cases: no lock, stake can be unlocked immediately after voting ends
    // Regular cases: stake unlocks 7 days after voting ends
    vote_record.unlock_at = if subject.free_case {
        dispute.voting_ends_at
    } else {
        dispute.voting_ends_at + STAKE_UNLOCK_BUFFER
    };
    vote_record.reputation_processed = false;
    vote_record.reward_claimed = false;
    vote_record.stake_unlocked = false;
    vote_record.bump = ctx.bumps.vote_record;
    vote_record.voted_at = clock.unix_timestamp;
    vote_record.rationale_cid = rationale_cid;

    // Update juror stats
    juror_account.votes_cast += 1;
    juror_account.last_vote_at = clock.unix_timestamp;

    msg!("Vote cast: {:?} with {} voting power", choice, voting_power);
    Ok(())
}

#[derive(Accounts)]
pub struct AddToVote<'info> {
    #[account(mut)]
    pub juror: Signer<'info>,

    #[account(
        mut,
        has_one = juror @ TribunalCraftError::Unauthorized,
        constraint = juror_account.is_active @ TribunalCraftError::JurorNotActive,
        seeds = [JUROR_ACCOUNT_SEED, juror.key().as_ref()],
        bump = juror_account.bump
    )]
    pub juror_account: Account<'info, JurorAccount>,

    #[account(
        constraint = subject.key() == dispute.subject @ TribunalCraftError::InvalidConfig,
    )]
    pub subject: Account<'info, Subject>,

    #[account(
        mut,
        has_one = subject,
        constraint = dispute.status == DisputeStatus::Pending @ TribunalCraftError::DisputeAlreadyResolved,
    )]
    pub dispute: Account<'info, Dispute>,

    #[account(
        mut,
        has_one = dispute,
        has_one = juror,
        seeds = [VOTE_RECORD_SEED, dispute.key().as_ref(), juror.key().as_ref()],
        bump = vote_record.bump
    )]
    pub vote_record: Account<'info, VoteRecord>,

    pub system_program: Program<'info, System>,
}

/// Add more stake to an existing vote (same choice, more weight)
pub fn add_to_vote(
    ctx: Context<AddToVote>,
    additional_stake: u64,
) -> Result<()> {
    let juror_account = &mut ctx.accounts.juror_account;
    let subject = &ctx.accounts.subject;
    let dispute = &mut ctx.accounts.dispute;
    let vote_record = &mut ctx.accounts.vote_record;
    let clock = Clock::get()?;

    // Ensure voting is still active
    require!(!dispute.is_voting_ended(clock.unix_timestamp), TribunalCraftError::VotingEnded);

    // Validate stake allocation
    require!(additional_stake > 0, TribunalCraftError::VoteAllocationBelowMinimum);
    require!(additional_stake <= juror_account.available_stake, TribunalCraftError::InsufficientAvailableStake);

    // Calculate additional voting power
    let additional_voting_power = juror_account.calculate_voting_power(additional_stake);

    // Lock additional stake
    juror_account.available_stake -= additional_stake;

    // Update dispute vote weights based on original choice
    // Handle both regular disputes and appeals
    if vote_record.is_appeal_vote {
        match vote_record.appeal_choice {
            AppealVoteChoice::ForRestoration => {
                dispute.votes_favor_weight += additional_voting_power;
            }
            AppealVoteChoice::AgainstRestoration => {
                dispute.votes_against_weight += additional_voting_power;
            }
        }
    } else {
        match vote_record.choice {
            VoteChoice::ForChallenger => {
                dispute.votes_favor_weight += additional_voting_power;
            }
            VoteChoice::ForDefender => {
                dispute.votes_against_weight += additional_voting_power;
            }
        }
    }

    // Update vote record totals
    vote_record.stake_allocated += additional_stake;
    vote_record.voting_power += additional_voting_power;

    // Extend unlock time if needed (use latest voting_ends_at)
    let new_unlock_at = if subject.free_case {
        dispute.voting_ends_at
    } else {
        dispute.voting_ends_at + STAKE_UNLOCK_BUFFER
    };
    if new_unlock_at > vote_record.unlock_at {
        vote_record.unlock_at = new_unlock_at;
    }

    msg!("Added {} stake to vote, new total voting power: {}", additional_stake, vote_record.voting_power);
    Ok(())
}

// =============================================================================
// Appeal Voting
// =============================================================================

#[derive(Accounts)]
pub struct VoteOnAppeal<'info> {
    #[account(mut)]
    pub juror: Signer<'info>,

    #[account(
        mut,
        has_one = juror @ TribunalCraftError::Unauthorized,
        constraint = juror_account.is_active @ TribunalCraftError::JurorNotActive,
        seeds = [JUROR_ACCOUNT_SEED, juror.key().as_ref()],
        bump = juror_account.bump
    )]
    pub juror_account: Account<'info, JurorAccount>,

    #[account(
        constraint = subject.key() == dispute.subject @ TribunalCraftError::InvalidConfig,
    )]
    pub subject: Account<'info, Subject>,

    #[account(
        mut,
        has_one = subject,
        constraint = dispute.status == DisputeStatus::Pending @ TribunalCraftError::DisputeAlreadyResolved,
        constraint = dispute.is_appeal @ TribunalCraftError::InvalidConfig, // Must be an appeal
    )]
    pub dispute: Account<'info, Dispute>,

    #[account(
        init,
        payer = juror,
        space = VoteRecord::LEN,
        seeds = [VOTE_RECORD_SEED, dispute.key().as_ref(), juror.key().as_ref()],
        bump
    )]
    pub vote_record: Account<'info, VoteRecord>,

    pub system_program: Program<'info, System>,
}

/// Vote on an appeal with stake allocation
/// ForRestoration = vote to restore subject to Active
/// AgainstRestoration = vote to keep subject Invalidated
pub fn vote_on_appeal(
    ctx: Context<VoteOnAppeal>,
    choice: AppealVoteChoice,
    stake_allocation: u64,
    rationale_cid: String,
) -> Result<()> {
    require!(rationale_cid.len() <= VoteRecord::MAX_CID_LEN, TribunalCraftError::InvalidConfig);
    let juror_account = &mut ctx.accounts.juror_account;
    let _subject = &ctx.accounts.subject; // Kept for account validation
    let dispute = &mut ctx.accounts.dispute;
    let vote_record = &mut ctx.accounts.vote_record;
    let clock = Clock::get()?;

    require!(!dispute.is_voting_ended(clock.unix_timestamp), TribunalCraftError::VotingEnded);

    // Validate stake allocation
    require!(stake_allocation > 0, TribunalCraftError::VoteAllocationBelowMinimum);
    require!(stake_allocation <= juror_account.available_stake, TribunalCraftError::InsufficientAvailableStake);

    // Calculate voting power
    let voting_power = juror_account.calculate_voting_power(stake_allocation);

    // Lock stake
    juror_account.available_stake -= stake_allocation;

    // Update dispute vote weights
    // ForRestoration maps to votes_favor (ChallengerWins = subject restored)
    // AgainstRestoration maps to votes_against (DefenderWins = subject stays invalidated)
    match choice {
        AppealVoteChoice::ForRestoration => {
            dispute.votes_favor_weight += voting_power;
        }
        AppealVoteChoice::AgainstRestoration => {
            dispute.votes_against_weight += voting_power;
        }
    }
    dispute.vote_count += 1;

    // Initialize vote record
    vote_record.dispute = dispute.key();
    vote_record.juror = ctx.accounts.juror.key();
    vote_record.juror_account = juror_account.key();
    vote_record.choice = VoteChoice::default(); // Not used for appeals
    vote_record.appeal_choice = choice;
    vote_record.is_appeal_vote = true;
    vote_record.stake_allocated = stake_allocation;
    vote_record.voting_power = voting_power;
    // Appeals don't use free_case - use standard unlock buffer
    vote_record.unlock_at = dispute.voting_ends_at + STAKE_UNLOCK_BUFFER;
    vote_record.reputation_processed = false;
    vote_record.reward_claimed = false;
    vote_record.stake_unlocked = false;
    vote_record.bump = ctx.bumps.vote_record;
    vote_record.voted_at = clock.unix_timestamp;
    vote_record.rationale_cid = rationale_cid;

    // Update juror stats
    juror_account.votes_cast += 1;
    juror_account.last_vote_at = clock.unix_timestamp;

    msg!("Appeal vote cast: {:?} with {} voting power", choice, voting_power);
    Ok(())
}
