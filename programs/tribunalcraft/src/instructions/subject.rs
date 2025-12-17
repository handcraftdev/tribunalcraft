use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::{SUBJECT_SEED, DEFENDER_RECORD_SEED, DEFENDER_POOL_SEED};
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
        space = DefenderRecord::LEN,
        seeds = [DEFENDER_RECORD_SEED, subject.key().as_ref(), creator.key().as_ref()],
        bump
    )]
    pub defender_record: Account<'info, DefenderRecord>,

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
    stake: u64,
) -> Result<()> {
    let subject = &mut ctx.accounts.subject;
    let defender_record = &mut ctx.accounts.defender_record;
    let clock = Clock::get()?;

    // Free cases don't require stake, regular cases do
    if !free_case {
        require!(stake > 0, TribunalCraftError::StakeBelowMinimum);
    }
    require!(voting_period > 0, TribunalCraftError::InvalidConfig);

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
    subject.defender_pool = Pubkey::default(); // standalone
    subject.details_cid = details_cid;
    subject.status = SubjectStatus::Active;
    subject.total_stake = stake;
    subject.max_stake = max_stake;
    subject.voting_period = voting_period;
    subject.defender_count = if stake > 0 { 1 } else { 0 };
    subject.dispute_count = 0;
    subject.match_mode = match_mode;
    subject.free_case = free_case;
    subject.dispute = Pubkey::default();
    subject.bump = ctx.bumps.subject;
    subject.created_at = clock.unix_timestamp;
    subject.updated_at = clock.unix_timestamp;

    // Initialize staker record (even for free cases, to track creator)
    defender_record.subject = subject.key();
    defender_record.defender = ctx.accounts.creator.key();
    defender_record.stake = stake;
    defender_record.reward_claimed = false;
    defender_record.bump = ctx.bumps.defender_record;
    defender_record.staked_at = clock.unix_timestamp;

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
        seeds = [DEFENDER_POOL_SEED, owner.key().as_ref()],
        bump = defender_pool.bump
    )]
    pub defender_pool: Account<'info, DefenderPool>,

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
) -> Result<()> {
    let defender_pool = &mut ctx.accounts.defender_pool;
    let subject = &mut ctx.accounts.subject;
    let clock = Clock::get()?;

    require!(voting_period > 0, TribunalCraftError::InvalidConfig);

    // Note: max_stake is a risk cap per subject, not a reservation
    // No need to check pool.available >= max_stake here
    // The actual hold amount at dispute time will be min(bond, max_stake, pool.available)

    // Initialize subject (linked mode)
    subject.subject_id = subject_id;
    subject.defender_pool = defender_pool.key(); // linked
    subject.details_cid = details_cid;
    subject.status = SubjectStatus::Active;
    subject.total_stake = 0; // can be added by direct stakers
    subject.max_stake = max_stake;
    subject.voting_period = voting_period;
    subject.defender_count = 0;
    subject.dispute_count = 0;
    subject.match_mode = match_mode;
    subject.free_case = free_case;
    subject.dispute = Pubkey::default();
    subject.bump = ctx.bumps.subject;
    subject.created_at = clock.unix_timestamp;
    subject.updated_at = clock.unix_timestamp;

    // Update pool
    defender_pool.subject_count += 1;
    defender_pool.updated_at = clock.unix_timestamp;

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
    subject.defender_pool = Pubkey::default();
    subject.details_cid = details_cid;
    subject.status = SubjectStatus::Active;
    subject.total_stake = 0;
    subject.max_stake = 0;
    subject.voting_period = voting_period;
    subject.defender_count = 0;
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
        space = DefenderRecord::LEN,
        seeds = [DEFENDER_RECORD_SEED, subject.key().as_ref(), staker.key().as_ref()],
        bump
    )]
    pub defender_record: Account<'info, DefenderRecord>,

    pub system_program: Program<'info, System>,
}

pub fn add_to_stake(ctx: Context<AddToStake>, stake: u64) -> Result<()> {
    let subject = &mut ctx.accounts.subject;
    let defender_record = &mut ctx.accounts.defender_record;
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
    let is_new_staker = defender_record.staked_at == 0;

    if is_new_staker {
        // Initialize new staker record
        defender_record.subject = subject.key();
        defender_record.defender = ctx.accounts.staker.key();
        defender_record.stake = stake;
        defender_record.reward_claimed = false;
        defender_record.bump = ctx.bumps.defender_record;
        defender_record.staked_at = clock.unix_timestamp;

        subject.defender_count += 1;
        msg!("New staker added: {} lamports", stake);
    } else {
        // Add to existing stake (don't increment staker_count)
        defender_record.stake += stake;
        msg!("Added to existing stake: {} lamports (total: {})", stake, defender_record.stake);
    }

    Ok(())
}
