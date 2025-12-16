use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::{REPORTER_ACCOUNT_SEED, CONTENT_REPORT_SEED, REPORTER_RECORD_SEED, CREATOR_POOL_SEED};
use crate::errors::MarshalCraftError;

#[derive(Accounts)]
#[instruction(content: Pubkey)]
pub struct SubmitReport<'info> {
    #[account(mut)]
    pub reporter: Signer<'info>,

    pub config: Account<'info, ProtocolConfig>,

    /// Creator being reported
    /// CHECK: Just need the pubkey to derive creator_pool
    pub creator: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [CREATOR_POOL_SEED, config.key().as_ref(), creator.key().as_ref()],
        bump = creator_pool.bump,
    )]
    pub creator_pool: Account<'info, CreatorPool>,

    #[account(
        init_if_needed,
        payer = reporter,
        space = ReporterAccount::LEN,
        seeds = [REPORTER_ACCOUNT_SEED, config.key().as_ref(), reporter.key().as_ref()],
        bump
    )]
    pub reporter_account: Account<'info, ReporterAccount>,

    #[account(
        init,
        payer = reporter,
        space = ContentReport::LEN,
        seeds = [CONTENT_REPORT_SEED, config.key().as_ref(), content.as_ref()],
        bump
    )]
    pub report: Account<'info, ContentReport>,

    #[account(
        init,
        payer = reporter,
        space = ReporterRecord::LEN,
        seeds = [REPORTER_RECORD_SEED, report.key().as_ref(), reporter.key().as_ref()],
        bump
    )]
    pub reporter_record: Account<'info, ReporterRecord>,

    pub system_program: Program<'info, System>,
}

pub fn submit_report(
    ctx: Context<SubmitReport>,
    content: Pubkey,
    category: ReportCategory,
    details_cid: String,
    bond: u64,
) -> Result<()> {
    let config = &ctx.accounts.config;
    let creator_pool = &mut ctx.accounts.creator_pool;
    let reporter_account = &mut ctx.accounts.reporter_account;
    let report = &mut ctx.accounts.report;
    let reporter_record = &mut ctx.accounts.reporter_record;
    let clock = Clock::get()?;

    require!(!config.is_paused, MarshalCraftError::ProtocolPaused);
    require!(ctx.accounts.reporter.key() != ctx.accounts.creator.key(), MarshalCraftError::CannotSelfReport);

    // Initialize reporter account if new
    if reporter_account.created_at == 0 {
        reporter_account.config = config.key();
        reporter_account.reporter = ctx.accounts.reporter.key();
        reporter_account.reputation = config.initial_reputation;
        reporter_account.bump = ctx.bumps.reporter_account;
        reporter_account.created_at = clock.unix_timestamp;
    }

    // Calculate minimum bond based on reporter reputation
    let min_bond = reporter_account.calculate_min_bond(config.base_reporter_bond);
    require!(bond >= min_bond, MarshalCraftError::BondBelowMinimum);
    require!(bond <= creator_pool.available, MarshalCraftError::BondExceedsAvailable);

    // Transfer bond to report account
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.reporter.to_account_info(),
            to: report.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_context, bond)?;

    // Hold stake from creator pool
    creator_pool.hold_stake(bond)?;

    // Initialize report
    report.config = config.key();
    report.content = content;
    report.creator = ctx.accounts.creator.key();
    report.creator_pool = creator_pool.key();
    report.category = category;
    report.total_bond = bond;
    report.creator_held = bond;
    report.reporter_count = 1;
    report.status = ReportStatus::Pending;
    report.outcome = ResolutionOutcome::None;
    report.votes_remove_weight = 0;
    report.votes_keep_weight = 0;
    report.vote_count = 0;
    report.voting_ends_at = clock.unix_timestamp + config.voting_period;
    report.resolved_at = 0;
    report.bump = ctx.bumps.report;
    report.created_at = clock.unix_timestamp;

    // Initialize reporter record
    reporter_record.report = report.key();
    reporter_record.reporter = ctx.accounts.reporter.key();
    reporter_record.reporter_account = reporter_account.key();
    reporter_record.bond = bond;
    reporter_record.details_cid = details_cid;
    reporter_record.reward_claimed = false;
    reporter_record.bump = ctx.bumps.reporter_record;
    reporter_record.reported_at = clock.unix_timestamp;

    // Update reporter stats
    reporter_account.reports_submitted += 1;
    reporter_account.last_report_at = clock.unix_timestamp;

    msg!("Report submitted for content: {}", content);
    Ok(())
}

#[derive(Accounts)]
pub struct AddToReport<'info> {
    #[account(mut)]
    pub reporter: Signer<'info>,

    pub config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        has_one = config,
    )]
    pub creator_pool: Account<'info, CreatorPool>,

    #[account(
        init_if_needed,
        payer = reporter,
        space = ReporterAccount::LEN,
        seeds = [REPORTER_ACCOUNT_SEED, config.key().as_ref(), reporter.key().as_ref()],
        bump
    )]
    pub reporter_account: Account<'info, ReporterAccount>,

    #[account(
        mut,
        has_one = config,
        has_one = creator_pool,
        constraint = report.status == ReportStatus::Pending @ MarshalCraftError::ReportAlreadyResolved,
    )]
    pub report: Account<'info, ContentReport>,

    #[account(
        init,
        payer = reporter,
        space = ReporterRecord::LEN,
        seeds = [REPORTER_RECORD_SEED, report.key().as_ref(), reporter.key().as_ref()],
        bump
    )]
    pub reporter_record: Account<'info, ReporterRecord>,

    pub system_program: Program<'info, System>,
}

pub fn add_to_report(
    ctx: Context<AddToReport>,
    details_cid: String,
    bond: u64,
) -> Result<()> {
    let config = &ctx.accounts.config;
    let creator_pool = &mut ctx.accounts.creator_pool;
    let reporter_account = &mut ctx.accounts.reporter_account;
    let report = &mut ctx.accounts.report;
    let reporter_record = &mut ctx.accounts.reporter_record;
    let clock = Clock::get()?;

    require!(!config.is_paused, MarshalCraftError::ProtocolPaused);
    require!(!report.is_voting_ended(clock.unix_timestamp), MarshalCraftError::VotingEnded);

    // Initialize reporter account if new
    if reporter_account.created_at == 0 {
        reporter_account.config = config.key();
        reporter_account.reporter = ctx.accounts.reporter.key();
        reporter_account.reputation = config.initial_reputation;
        reporter_account.bump = ctx.bumps.reporter_account;
        reporter_account.created_at = clock.unix_timestamp;
    }

    // Calculate minimum bond
    let min_bond = reporter_account.calculate_min_bond(config.base_reporter_bond);
    require!(bond >= min_bond, MarshalCraftError::BondBelowMinimum);
    require!(bond <= creator_pool.available, MarshalCraftError::BondExceedsAvailable);

    // Transfer bond
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.reporter.to_account_info(),
            to: report.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_context, bond)?;

    // Hold additional stake from creator
    creator_pool.hold_stake(bond)?;

    // Update report
    report.total_bond += bond;
    report.creator_held += bond;
    report.reporter_count += 1;

    // Initialize reporter record
    reporter_record.report = report.key();
    reporter_record.reporter = ctx.accounts.reporter.key();
    reporter_record.reporter_account = reporter_account.key();
    reporter_record.bond = bond;
    reporter_record.details_cid = details_cid;
    reporter_record.reward_claimed = false;
    reporter_record.bump = ctx.bumps.reporter_record;
    reporter_record.reported_at = clock.unix_timestamp;

    // Update reporter stats
    reporter_account.reports_submitted += 1;
    reporter_account.last_report_at = clock.unix_timestamp;

    msg!("Added to report: {} lamports bond", bond);
    Ok(())
}
