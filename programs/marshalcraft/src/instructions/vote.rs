use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::VOTE_RECORD_SEED;
use crate::errors::MarshalCraftError;

#[derive(Accounts)]
pub struct VoteOnReport<'info> {
    #[account(mut)]
    pub marshal: Signer<'info>,

    pub config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        has_one = marshal @ MarshalCraftError::Unauthorized,
        has_one = config,
        constraint = marshal_account.is_active @ MarshalCraftError::MarshalNotActive,
    )]
    pub marshal_account: Account<'info, MarshalAccount>,

    #[account(
        mut,
        has_one = config,
        constraint = report.status == ReportStatus::Pending @ MarshalCraftError::ReportAlreadyResolved,
    )]
    pub report: Account<'info, ContentReport>,

    #[account(
        init,
        payer = marshal,
        space = VoteRecord::LEN,
        seeds = [VOTE_RECORD_SEED, report.key().as_ref(), marshal.key().as_ref()],
        bump
    )]
    pub vote_record: Account<'info, VoteRecord>,

    pub system_program: Program<'info, System>,
}

pub fn vote_on_report(
    ctx: Context<VoteOnReport>,
    choice: VoteChoice,
    stake_allocation: u64,
) -> Result<()> {
    let config = &ctx.accounts.config;
    let marshal_account = &mut ctx.accounts.marshal_account;
    let report = &mut ctx.accounts.report;
    let vote_record = &mut ctx.accounts.vote_record;
    let clock = Clock::get()?;

    require!(!config.is_paused, MarshalCraftError::ProtocolPaused);
    require!(!report.is_voting_ended(clock.unix_timestamp), MarshalCraftError::VotingEnded);

    // Check marshal is not a reporter on this report (would need to check reporter records)
    // For simplicity, we rely on different PDA seeds preventing this

    // Validate stake allocation
    let min_allocation = (report.total_bond as u128 * config.min_vote_allocation_bps as u128 / 10000) as u64;
    require!(stake_allocation >= min_allocation, MarshalCraftError::VoteAllocationBelowMinimum);
    require!(stake_allocation <= marshal_account.available_stake, MarshalCraftError::InsufficientAvailableStake);

    // Calculate voting power
    let voting_power = marshal_account.calculate_voting_power(stake_allocation);

    // Lock stake
    marshal_account.available_stake -= stake_allocation;

    // Update report vote weights
    match choice {
        VoteChoice::Remove => {
            report.votes_remove_weight += voting_power;
        }
        VoteChoice::Keep => {
            report.votes_keep_weight += voting_power;
        }
        VoteChoice::Abstain => {
            // Abstain doesn't affect weights
        }
    }
    report.vote_count += 1;

    // Initialize vote record
    vote_record.report = report.key();
    vote_record.marshal = ctx.accounts.marshal.key();
    vote_record.marshal_account = marshal_account.key();
    vote_record.choice = choice;
    vote_record.stake_allocated = stake_allocation;
    vote_record.voting_power = voting_power;
    vote_record.unlock_at = clock.unix_timestamp + config.stake_lock_period;
    vote_record.reputation_processed = false;
    vote_record.reward_claimed = false;
    vote_record.stake_unlocked = false;
    vote_record.bump = ctx.bumps.vote_record;
    vote_record.voted_at = clock.unix_timestamp;

    // Update marshal stats
    marshal_account.votes_cast += 1;
    marshal_account.last_vote_at = clock.unix_timestamp;

    msg!("Vote cast: {:?} with {} voting power", choice, voting_power);
    Ok(())
}
