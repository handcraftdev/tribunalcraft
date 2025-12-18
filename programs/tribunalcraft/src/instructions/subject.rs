use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::{SUBJECT_SEED, DEFENDER_RECORD_SEED, DEFENDER_POOL_SEED, PROTOCOL_CONFIG_SEED, TOTAL_FEE_BPS};
use crate::errors::TribunalCraftError;

/// Create a subject linked to owner's defender pool
/// Pool is auto-created with 0 stake if it doesn't exist
#[derive(Accounts)]
#[instruction(subject_id: Pubkey)]
pub struct CreateLinkedSubject<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init_if_needed,
        payer = owner,
        space = DefenderPool::LEN,
        seeds = [DEFENDER_POOL_SEED, owner.key().as_ref()],
        bump
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

    // Initialize pool if newly created (created_at will be 0 for new accounts)
    if defender_pool.created_at == 0 {
        defender_pool.owner = ctx.accounts.owner.key();
        defender_pool.total_stake = 0;
        defender_pool.available = 0;
        defender_pool.held = 0;
        defender_pool.subject_count = 0;
        defender_pool.pending_disputes = 0;
        defender_pool.bump = ctx.bumps.defender_pool;
        defender_pool.created_at = clock.unix_timestamp;
        msg!("Auto-created defender pool for owner");
    }

    // Initialize subject (linked mode)
    subject.subject_id = subject_id;
    subject.defender_pool = defender_pool.key(); // linked
    subject.details_cid = details_cid;
    subject.status = SubjectStatus::Valid;
    subject.available_stake = 0; // can be added by direct stakers
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
    subject.status = SubjectStatus::Valid;
    subject.available_stake = 0;
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

/// Add stake to subject - no escrow, all funds managed on subject
/// If subject has active dispute in proportional mode, fees are deducted and stake is tracked as at risk
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

    /// Optional: Active dispute (required if subject has active dispute in proportional mode)
    #[account(mut)]
    pub dispute: Option<Account<'info, Dispute>>,

    /// Protocol config for treasury address (required if proportional dispute)
    #[account(
        seeds = [PROTOCOL_CONFIG_SEED],
        bump = protocol_config.bump
    )]
    pub protocol_config: Option<Account<'info, ProtocolConfig>>,

    /// Treasury receives fees (required if proportional dispute)
    /// CHECK: Validated against protocol_config.treasury
    #[account(mut)]
    pub treasury: Option<AccountInfo<'info>>,

    pub system_program: Program<'info, System>,
}

pub fn add_to_stake(ctx: Context<AddToStake>, stake: u64) -> Result<()> {
    let subject = &mut ctx.accounts.subject;
    let defender_record = &mut ctx.accounts.defender_record;
    let clock = Clock::get()?;

    require!(stake > 0, TribunalCraftError::StakeBelowMinimum);

    // Check if there's an active dispute
    let has_active_dispute = subject.has_active_dispute();
    let is_match_mode = subject.match_mode;

    // In the no-escrow model, all stake always goes to subject
    // In proportional mode during dispute, fees are deducted first
    let is_proportional_during_dispute = has_active_dispute && !is_match_mode;

    // Calculate fees and net stake for proportional mode during dispute
    let (fee_amount, net_stake) = if is_proportional_during_dispute {
        let fee = (stake as u128 * TOTAL_FEE_BPS as u128 / 10000) as u64;
        (fee, stake.saturating_sub(fee))
    } else {
        // No dispute or match mode: no fees
        (0, stake)
    };

    // Transfer fee to treasury (if proportional during dispute)
    if fee_amount > 0 {
        let protocol_config = ctx.accounts.protocol_config.as_ref()
            .ok_or(TribunalCraftError::InvalidConfig)?;
        let treasury = ctx.accounts.treasury.as_ref()
            .ok_or(TribunalCraftError::InvalidConfig)?;

        // Validate treasury
        require!(
            treasury.key() == protocol_config.treasury,
            TribunalCraftError::InvalidConfig
        );

        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.staker.to_account_info(),
                to: treasury.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, fee_amount)?;
    }

    // Transfer net stake to subject
    if net_stake > 0 {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.staker.to_account_info(),
                to: subject.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, net_stake)?;
    }

    // Update subject stake with net amount
    subject.available_stake += net_stake;

    // Revive dormant subject when stake is added
    if subject.status == SubjectStatus::Dormant && subject.available_stake > 0 {
        subject.status = SubjectStatus::Valid;
        msg!("Subject revived from dormant to valid");
    }

    // If proportional mode during dispute, update dispute tracking
    if is_proportional_during_dispute {
        let dispute = ctx.accounts.dispute.as_mut()
            .ok_or(TribunalCraftError::DisputeNotFound)?;

        // Validate dispute matches subject's active dispute
        require!(
            dispute.key() == subject.dispute,
            TribunalCraftError::InvalidConfig
        );
        require!(
            dispute.status == DisputeStatus::Pending,
            TribunalCraftError::DisputeAlreadyResolved
        );

        // Update dispute tracking - net stake is at risk
        dispute.direct_stake_held += net_stake;
        dispute.snapshot_total_stake += net_stake;

        msg!("Stake added during proportional dispute: {} gross, {} net (fee: {})",
            stake, net_stake, fee_amount);
    } else if has_active_dispute {
        msg!("Stake added during match mode dispute: {} lamports (available for matching)", stake);
    } else {
        msg!("Stake added to subject: {} lamports", stake);
    }

    subject.updated_at = clock.unix_timestamp;

    // Check if this is a new staker or adding more to existing
    let is_new_staker = defender_record.staked_at == 0;

    if is_new_staker {
        // Initialize new staker record
        defender_record.subject = subject.key();
        defender_record.defender = ctx.accounts.staker.key();
        defender_record.stake = net_stake;
        defender_record.reward_claimed = false;
        defender_record.bump = ctx.bumps.defender_record;
        defender_record.staked_at = clock.unix_timestamp;
        defender_record.stake_in_escrow = 0; // No escrow in new model

        subject.defender_count += 1;
        msg!("New defender added: {} lamports (net)", net_stake);
    } else {
        // Add to existing stake (don't increment counts)
        defender_record.stake += net_stake;
        msg!("Added to existing stake: {} lamports (total: {})", net_stake, defender_record.stake);
    }

    Ok(())
}
