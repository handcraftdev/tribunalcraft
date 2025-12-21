use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::{SUBJECT_SEED, DISPUTE_SEED, ESCROW_SEED, DEFENDER_POOL_SEED, DEFENDER_RECORD_SEED};
use crate::errors::TribunalCraftError;
use crate::events::*;

/// Create a subject with all persistent PDAs (Subject + Dispute + Escrow)
/// Creator becomes first defender if they have a DefenderPool with balance
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
        space = Dispute::LEN,
        seeds = [DISPUTE_SEED, subject_id.as_ref()],
        bump
    )]
    pub dispute: Account<'info, Dispute>,

    #[account(
        init,
        payer = creator,
        space = Escrow::size_for_rounds(0),
        seeds = [ESCROW_SEED, subject_id.as_ref()],
        bump
    )]
    pub escrow: Account<'info, Escrow>,

    pub system_program: Program<'info, System>,
}

pub fn create_subject(
    ctx: Context<CreateSubject>,
    subject_id: Pubkey,
    details_cid: String,
    match_mode: bool,
    voting_period: i64,
) -> Result<()> {
    let subject = &mut ctx.accounts.subject;
    let dispute = &mut ctx.accounts.dispute;
    let escrow = &mut ctx.accounts.escrow;
    let clock = Clock::get()?;

    require!(voting_period > 0, TribunalCraftError::InvalidConfig);
    require!(details_cid.len() <= Subject::MAX_CID_LEN, TribunalCraftError::InvalidConfig);

    // Initialize Subject
    subject.subject_id = subject_id;
    subject.creator = ctx.accounts.creator.key();
    subject.details_cid = details_cid;
    subject.round = 0;
    subject.available_bond = 0;
    subject.defender_count = 0;
    subject.status = SubjectStatus::Dormant;
    subject.match_mode = match_mode;
    subject.voting_period = voting_period;
    subject.dispute = dispute.key();
    subject.bump = ctx.bumps.subject;
    subject.created_at = clock.unix_timestamp;
    subject.updated_at = clock.unix_timestamp;
    subject.last_dispute_total = 0;
    subject.last_voting_period = voting_period;

    // Initialize Dispute (empty, status = None)
    dispute.subject_id = subject_id;
    dispute.round = 0;
    dispute.status = DisputeStatus::None;
    dispute.dispute_type = DisputeType::Other;
    dispute.total_stake = 0;
    dispute.challenger_count = 0;
    dispute.bond_at_risk = 0;
    dispute.defender_count = 0;
    dispute.votes_for_challenger = 0;
    dispute.votes_for_defender = 0;
    dispute.vote_count = 0;
    dispute.voting_starts_at = 0;
    dispute.voting_ends_at = 0;
    dispute.outcome = ResolutionOutcome::None;
    dispute.resolved_at = 0;
    dispute.is_restore = false;
    dispute.restore_stake = 0;
    dispute.restorer = Pubkey::default();
    dispute.bump = ctx.bumps.dispute;
    dispute.created_at = clock.unix_timestamp;

    // Initialize Escrow
    escrow.subject_id = subject_id;
    escrow.balance = 0;
    escrow.rounds = Vec::new();
    escrow.bump = ctx.bumps.escrow;

    emit!(SubjectCreatedEvent {
        subject_id,
        creator: ctx.accounts.creator.key(),
        match_mode,
        voting_period,
        timestamp: clock.unix_timestamp,
    });

    msg!("Subject created: {} (match_mode: {})", subject_id, match_mode);
    Ok(())
}

/// Add bond to a subject (from wallet directly)
/// Creates DefenderRecord for the current round
#[derive(Accounts)]
/// Add bond directly to a subject
/// Also creates DefenderPool if it doesn't exist
pub struct AddBondDirect<'info> {
    #[account(mut)]
    pub defender: Signer<'info>,

    #[account(
        mut,
        constraint = subject.can_bond() @ TribunalCraftError::SubjectCannotBeStaked,
    )]
    pub subject: Account<'info, Subject>,

    #[account(
        init_if_needed,
        payer = defender,
        space = DefenderRecord::LEN,
        seeds = [
            DEFENDER_RECORD_SEED,
            subject.subject_id.as_ref(),
            defender.key().as_ref(),
            &subject.round.to_le_bytes()
        ],
        bump
    )]
    pub defender_record: Account<'info, DefenderRecord>,

    /// Defender's pool - created if doesn't exist
    #[account(
        init_if_needed,
        payer = defender,
        space = DefenderPool::LEN,
        seeds = [DEFENDER_POOL_SEED, defender.key().as_ref()],
        bump
    )]
    pub defender_pool: Account<'info, DefenderPool>,

    /// Optional: Active dispute (for updating bond_at_risk during dispute)
    #[account(
        mut,
        seeds = [DISPUTE_SEED, subject.subject_id.as_ref()],
        bump = dispute.bump,
    )]
    pub dispute: Option<Account<'info, Dispute>>,

    pub system_program: Program<'info, System>,
}

pub fn add_bond_direct(ctx: Context<AddBondDirect>, amount: u64) -> Result<()> {
    let subject = &mut ctx.accounts.subject;
    let defender_record = &mut ctx.accounts.defender_record;
    let defender_pool = &mut ctx.accounts.defender_pool;
    let clock = Clock::get()?;

    // Initialize defender pool if newly created
    if defender_pool.owner == Pubkey::default() {
        defender_pool.owner = ctx.accounts.defender.key();
        defender_pool.balance = 0;
        defender_pool.max_bond = u64::MAX; // No limit by default
        defender_pool.bump = ctx.bumps.defender_pool;
        defender_pool.created_at = clock.unix_timestamp;
        defender_pool.updated_at = clock.unix_timestamp;
    }

    require!(amount > 0, TribunalCraftError::StakeBelowMinimum);

    // Transfer bond to subject PDA
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.defender.to_account_info(),
            to: subject.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_context, amount)?;

    // Check if this is a new defender for this round
    let is_new_defender = defender_record.bonded_at == 0;

    if is_new_defender {
        // Initialize new defender record
        defender_record.subject_id = subject.subject_id;
        defender_record.defender = ctx.accounts.defender.key();
        defender_record.round = subject.round;
        defender_record.bond = amount;
        defender_record.source = BondSource::Direct;
        defender_record.reward_claimed = false;
        defender_record.bump = ctx.bumps.defender_record;
        defender_record.bonded_at = clock.unix_timestamp;

        subject.defender_count += 1;
        msg!("New defender added for round {}: {} lamports", subject.round, amount);
    } else {
        // Add to existing bond
        defender_record.bond += amount;
        msg!("Added to existing bond: {} lamports (total: {})", amount, defender_record.bond);
    }

    // Update subject
    subject.available_bond += amount;
    subject.updated_at = clock.unix_timestamp;

    // If dormant and now has bond, become valid
    if subject.status == SubjectStatus::Dormant && subject.available_bond > 0 {
        subject.status = SubjectStatus::Valid;
        msg!("Subject revived from dormant to valid");
    }

    // If there's an active dispute, update bond_at_risk based on mode
    if subject.status == SubjectStatus::Disputed {
        if let Some(dispute) = ctx.accounts.dispute.as_mut() {
            if subject.match_mode {
                // Match mode: bond_at_risk = min(total_stake, available_bond)
                dispute.bond_at_risk = dispute.total_stake.min(subject.available_bond);
            } else {
                // Prop mode: bond_at_risk = available_bond
                dispute.bond_at_risk = subject.available_bond;
            }

            // Update defender count for this dispute
            if is_new_defender {
                dispute.defender_count += 1;
            }
        }
    }

    emit!(BondAddedEvent {
        subject_id: subject.subject_id,
        defender: ctx.accounts.defender.key(),
        round: subject.round,
        amount,
        source: BondSource::Direct,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

/// Add bond from DefenderPool
#[derive(Accounts)]
pub struct AddBondFromPool<'info> {
    #[account(mut)]
    pub defender: Signer<'info>,

    #[account(
        mut,
        constraint = subject.can_bond() @ TribunalCraftError::SubjectCannotBeStaked,
    )]
    pub subject: Account<'info, Subject>,

    #[account(
        mut,
        seeds = [DEFENDER_POOL_SEED, defender.key().as_ref()],
        bump = defender_pool.bump,
        constraint = defender_pool.owner == defender.key() @ TribunalCraftError::InvalidConfig,
    )]
    pub defender_pool: Account<'info, DefenderPool>,

    #[account(
        init_if_needed,
        payer = defender,
        space = DefenderRecord::LEN,
        seeds = [
            DEFENDER_RECORD_SEED,
            subject.subject_id.as_ref(),
            defender.key().as_ref(),
            &subject.round.to_le_bytes()
        ],
        bump
    )]
    pub defender_record: Account<'info, DefenderRecord>,

    /// Optional: Active dispute (for updating bond_at_risk during dispute)
    #[account(
        mut,
        seeds = [DISPUTE_SEED, subject.subject_id.as_ref()],
        bump = dispute.bump,
    )]
    pub dispute: Option<Account<'info, Dispute>>,

    pub system_program: Program<'info, System>,
}

pub fn add_bond_from_pool(ctx: Context<AddBondFromPool>, amount: u64) -> Result<()> {
    let subject = &mut ctx.accounts.subject;
    let defender_pool = &mut ctx.accounts.defender_pool;
    let defender_record = &mut ctx.accounts.defender_record;
    let clock = Clock::get()?;

    require!(amount > 0, TribunalCraftError::StakeBelowMinimum);

    // Cap amount to max_bond setting
    let capped_amount = amount.min(defender_pool.max_bond);
    require!(capped_amount > 0, TribunalCraftError::StakeBelowMinimum);

    // Deduct from pool balance
    defender_pool.use_for_bond(capped_amount)?;

    // Transfer from pool PDA to subject PDA
    let owner_key = defender_pool.owner;
    let seeds = &[
        DEFENDER_POOL_SEED,
        owner_key.as_ref(),
        &[defender_pool.bump],
    ];
    let signer = &[&seeds[..]];

    let cpi_context = CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: defender_pool.to_account_info(),
            to: subject.to_account_info(),
        },
        signer,
    );
    anchor_lang::system_program::transfer(cpi_context, capped_amount)?;

    // Check if this is a new defender for this round
    let is_new_defender = defender_record.bonded_at == 0;

    if is_new_defender {
        // Initialize new defender record
        defender_record.subject_id = subject.subject_id;
        defender_record.defender = ctx.accounts.defender.key();
        defender_record.round = subject.round;
        defender_record.bond = capped_amount;
        defender_record.source = BondSource::Pool;
        defender_record.reward_claimed = false;
        defender_record.bump = ctx.bumps.defender_record;
        defender_record.bonded_at = clock.unix_timestamp;

        subject.defender_count += 1;
        msg!("New defender added from pool for round {}: {} lamports", subject.round, capped_amount);
    } else {
        // Add to existing bond
        defender_record.bond += capped_amount;
        msg!("Added to existing pool bond: {} lamports (total: {})", capped_amount, defender_record.bond);
    }

    // Update subject
    subject.available_bond += capped_amount;
    subject.updated_at = clock.unix_timestamp;
    defender_pool.updated_at = clock.unix_timestamp;

    // If dormant and now has bond, become valid
    if subject.status == SubjectStatus::Dormant && subject.available_bond > 0 {
        subject.status = SubjectStatus::Valid;
        msg!("Subject revived from dormant to valid");
    }

    // If there's an active dispute, update bond_at_risk based on mode
    if subject.status == SubjectStatus::Disputed {
        if let Some(dispute) = ctx.accounts.dispute.as_mut() {
            if subject.match_mode {
                dispute.bond_at_risk = dispute.total_stake.min(subject.available_bond);
            } else {
                dispute.bond_at_risk = subject.available_bond;
            }

            if is_new_defender {
                dispute.defender_count += 1;
            }
        }
    }

    emit!(BondAddedEvent {
        subject_id: subject.subject_id,
        defender: ctx.accounts.defender.key(),
        round: subject.round,
        amount: capped_amount,
        source: BondSource::Pool,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
