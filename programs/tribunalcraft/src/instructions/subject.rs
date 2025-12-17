use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::{SUBJECT_SEED, STAKER_RECORD_SEED, STAKER_POOL_SEED};
use crate::errors::TribunalCraftError;

/// Create a standalone subject (not linked to pool)
#[derive(Accounts)]
#[instruction(subject_id: Pubkey)]
pub struct CreateSubject<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = Subject::LEN,
        seeds = [SUBJECT_SEED, subject_id.as_ref()],
        bump
    )]
    pub subject: Account<'info, Subject>,

    #[account(
        init,
        payer = creator,
        space = StakerRecord::LEN,
        seeds = [STAKER_RECORD_SEED, subject.key().as_ref(), creator.key().as_ref()],
        bump
    )]
    pub staker_record: Account<'info, StakerRecord>,

    pub system_program: Program<'info, System>,
}

pub fn create_subject(
    ctx: Context<CreateSubject>,
    subject_id: Pubkey,
    details_cid: String,
    max_stake: u64,
    match_mode: bool,
    free_case: bool,
    voting_period: i64,
    winner_reward_bps: u16,
    stake: u64,
) -> Result<()> {
    let subject = &mut ctx.accounts.subject;
    let staker_record = &mut ctx.accounts.staker_record;
    let clock = Clock::get()?;

    // Free cases don't require stake, regular cases do
    if !free_case {
        require!(stake > 0, TribunalCraftError::StakeBelowMinimum);
    }
    require!(voting_period > 0, TribunalCraftError::InvalidConfig);
    require!(winner_reward_bps <= 10000, TribunalCraftError::InvalidConfig);

    // Transfer stake to subject account (if any)
    if stake > 0 {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.creator.to_account_info(),
                to: subject.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, stake)?;
    }

    // Initialize subject (standalone mode)
    subject.subject_id = subject_id;
    subject.staker_pool = Pubkey::default(); // standalone
    subject.details_cid = details_cid;
    subject.status = SubjectStatus::Active;
    subject.total_stake = stake;
    subject.max_stake = max_stake;
    subject.voting_period = voting_period;
    subject.winner_reward_bps = winner_reward_bps;
    subject.staker_count = if stake > 0 { 1 } else { 0 };
    subject.dispute_count = 0;
    subject.match_mode = match_mode;
    subject.free_case = free_case;
    subject.dispute = Pubkey::default();
    subject.bump = ctx.bumps.subject;
    subject.created_at = clock.unix_timestamp;
    subject.updated_at = clock.unix_timestamp;

    // Initialize staker record (even for free cases, to track creator)
    staker_record.subject = subject.key();
    staker_record.staker = ctx.accounts.creator.key();
    staker_record.stake = stake;
    staker_record.reward_claimed = false;
    staker_record.bump = ctx.bumps.staker_record;
    staker_record.staked_at = clock.unix_timestamp;

    msg!("Subject created: {} (free_case: {})", subject_id, free_case);
    Ok(())
}

/// Create a subject linked to a staker pool
#[derive(Accounts)]
#[instruction(subject_id: Pubkey)]
pub struct CreateLinkedSubject<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner @ TribunalCraftError::Unauthorized,
        seeds = [STAKER_POOL_SEED, owner.key().as_ref()],
        bump = staker_pool.bump
    )]
    pub staker_pool: Account<'info, StakerPool>,

    #[account(
        init,
        payer = owner,
        space = Subject::LEN,
        seeds = [SUBJECT_SEED, subject_id.as_ref()],
        bump
    )]
    pub subject: Account<'info, Subject>,

    pub system_program: Program<'info, System>,
}

pub fn create_linked_subject(
    ctx: Context<CreateLinkedSubject>,
    subject_id: Pubkey,
    details_cid: String,
    max_stake: u64,
    match_mode: bool,
    free_case: bool,
    voting_period: i64,
    winner_reward_bps: u16,
) -> Result<()> {
    let staker_pool = &mut ctx.accounts.staker_pool;
    let subject = &mut ctx.accounts.subject;
    let clock = Clock::get()?;

    require!(voting_period > 0, TribunalCraftError::InvalidConfig);
    require!(winner_reward_bps <= 10000, TribunalCraftError::InvalidConfig);

    // Note: max_stake is a risk cap per subject, not a reservation
    // No need to check pool.available >= max_stake here
    // The actual hold amount at dispute time will be min(bond, max_stake, pool.available)

    // Initialize subject (linked mode)
    subject.subject_id = subject_id;
    subject.staker_pool = staker_pool.key(); // linked
    subject.details_cid = details_cid;
    subject.status = SubjectStatus::Active;
    subject.total_stake = 0; // can be added by direct stakers
    subject.max_stake = max_stake;
    subject.voting_period = voting_period;
    subject.winner_reward_bps = winner_reward_bps;
    subject.staker_count = 0;
    subject.dispute_count = 0;
    subject.match_mode = match_mode;
    subject.free_case = free_case;
    subject.dispute = Pubkey::default();
    subject.bump = ctx.bumps.subject;
    subject.created_at = clock.unix_timestamp;
    subject.updated_at = clock.unix_timestamp;

    // Update pool
    staker_pool.subject_count += 1;
    staker_pool.updated_at = clock.unix_timestamp;

    msg!("Linked subject created: {} (free_case: {})", subject_id, free_case);
    Ok(())
}

/// Create a free subject (no stake, no staker record - just Subject)
#[derive(Accounts)]
#[instruction(subject_id: Pubkey)]
pub struct CreateFreeSubject<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = Subject::LEN,
        seeds = [SUBJECT_SEED, subject_id.as_ref()],
        bump
    )]
    pub subject: Account<'info, Subject>,

    pub system_program: Program<'info, System>,
}

pub fn create_free_subject(
    ctx: Context<CreateFreeSubject>,
    subject_id: Pubkey,
    details_cid: String,
    voting_period: i64,
) -> Result<()> {
    let subject = &mut ctx.accounts.subject;
    let clock = Clock::get()?;

    require!(voting_period > 0, TribunalCraftError::InvalidConfig);

    // Initialize free subject (no stake, no records)
    subject.subject_id = subject_id;
    subject.staker_pool = Pubkey::default();
    subject.details_cid = details_cid;
    subject.status = SubjectStatus::Active;
    subject.total_stake = 0;
    subject.max_stake = 0;
    subject.voting_period = voting_period;
    subject.winner_reward_bps = 0;
    subject.staker_count = 0;
    subject.dispute_count = 0;
    subject.match_mode = false;
    subject.free_case = true;
    subject.dispute = Pubkey::default();
    subject.bump = ctx.bumps.subject;
    subject.created_at = clock.unix_timestamp;
    subject.updated_at = clock.unix_timestamp;

    msg!("Free subject created: {}", subject_id);
    Ok(())
}

/// Add stake to a standalone subject (or add more if already staked)
#[derive(Accounts)]
pub struct AddToStake<'info> {
    #[account(mut)]
    pub staker: Signer<'info>,

    #[account(
        mut,
        constraint = subject.can_stake() @ TribunalCraftError::SubjectCannotBeStaked,
        constraint = !subject.free_case @ TribunalCraftError::InvalidConfig, // Free subjects don't accept stake
    )]
    pub subject: Account<'info, Subject>,

    #[account(
        init_if_needed,
        payer = staker,
        space = StakerRecord::LEN,
        seeds = [STAKER_RECORD_SEED, subject.key().as_ref(), staker.key().as_ref()],
        bump
    )]
    pub staker_record: Account<'info, StakerRecord>,

    pub system_program: Program<'info, System>,
}

pub fn add_to_stake(ctx: Context<AddToStake>, stake: u64) -> Result<()> {
    let subject = &mut ctx.accounts.subject;
    let staker_record = &mut ctx.accounts.staker_record;
    let clock = Clock::get()?;

    require!(stake > 0, TribunalCraftError::StakeBelowMinimum);

    // Transfer stake to subject account
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.staker.to_account_info(),
            to: subject.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_context, stake)?;

    // Update subject
    subject.total_stake += stake;
    subject.updated_at = clock.unix_timestamp;

    // Check if this is a new staker or adding more to existing
    let is_new_staker = staker_record.staked_at == 0;

    if is_new_staker {
        // Initialize new staker record
        staker_record.subject = subject.key();
        staker_record.staker = ctx.accounts.staker.key();
        staker_record.stake = stake;
        staker_record.reward_claimed = false;
        staker_record.bump = ctx.bumps.staker_record;
        staker_record.staked_at = clock.unix_timestamp;

        subject.staker_count += 1;
        msg!("New staker added: {} lamports", stake);
    } else {
        // Add to existing stake (don't increment staker_count)
        staker_record.stake += stake;
        msg!("Added to existing stake: {} lamports (total: {})", stake, staker_record.stake);
    }

    Ok(())
}
