use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::{
    SUBJECT_SEED, DISPUTE_SEED, ESCROW_SEED, CHALLENGER_RECORD_SEED,
    CHALLENGER_POOL_SEED, PROTOCOL_CONFIG_SEED, INITIAL_REPUTATION, SLASH_THRESHOLD,
};
use crate::errors::TribunalCraftError;
use crate::events::{DisputeCreatedEvent, ChallengerJoinedEvent, PoolDepositEvent, PoolWithdrawEvent, PoolType};

/// Create a dispute against a subject
/// Reallocs Escrow to add RoundResult slot
/// Also creates ChallengerPool if it doesn't exist
#[derive(Accounts)]
pub struct CreateDispute<'info> {
    #[account(mut)]
    pub challenger: Signer<'info>,

    #[account(
        mut,
        seeds = [SUBJECT_SEED, subject.subject_id.as_ref()],
        bump = subject.bump,
        constraint = subject.can_dispute() @ TribunalCraftError::SubjectCannotBeDisputed,
    )]
    pub subject: Account<'info, Subject>,

    #[account(
        mut,
        seeds = [DISPUTE_SEED, subject.subject_id.as_ref()],
        bump = dispute.bump,
        constraint = dispute.status == DisputeStatus::None @ TribunalCraftError::DisputeAlreadyExists,
    )]
    pub dispute: Account<'info, Dispute>,

    #[account(
        mut,
        seeds = [ESCROW_SEED, subject.subject_id.as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        init,
        payer = challenger,
        space = ChallengerRecord::LEN,
        seeds = [
            CHALLENGER_RECORD_SEED,
            subject.subject_id.as_ref(),
            challenger.key().as_ref(),
            &subject.round.to_le_bytes()
        ],
        bump
    )]
    pub challenger_record: Account<'info, ChallengerRecord>,

    /// Challenger's pool - created if doesn't exist
    #[account(
        init_if_needed,
        payer = challenger,
        space = ChallengerPool::LEN,
        seeds = [CHALLENGER_POOL_SEED, challenger.key().as_ref()],
        bump
    )]
    pub challenger_pool: Account<'info, ChallengerPool>,

    pub system_program: Program<'info, System>,
}

pub fn create_dispute(
    ctx: Context<CreateDispute>,
    dispute_type: DisputeType,
    details_cid: String,
    stake: u64,
) -> Result<()> {
    let subject = &mut ctx.accounts.subject;
    let dispute = &mut ctx.accounts.dispute;
    let escrow = &mut ctx.accounts.escrow;
    let challenger_record = &mut ctx.accounts.challenger_record;
    let challenger_pool = &mut ctx.accounts.challenger_pool;
    let clock = Clock::get()?;

    // Initialize challenger pool if newly created
    if challenger_pool.owner == Pubkey::default() {
        challenger_pool.owner = ctx.accounts.challenger.key();
        challenger_pool.balance = 0;
        challenger_pool.reputation = INITIAL_REPUTATION;
        challenger_pool.bump = ctx.bumps.challenger_pool;
        challenger_pool.created_at = clock.unix_timestamp;
    }

    require!(stake > 0, TribunalCraftError::StakeBelowMinimum);

    // In match mode, stake cannot exceed available_bond
    if subject.match_mode {
        require!(
            stake <= subject.available_bond,
            TribunalCraftError::InsufficientAvailableStake
        );
    }

    // Transfer full stake to subject PDA (fees taken during resolution)
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.challenger.to_account_info(),
            to: subject.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_context, stake)?;

    // Calculate bond_at_risk based on mode
    let bond_at_risk = if subject.match_mode {
        stake.min(subject.available_bond)
    } else {
        subject.available_bond
    };

    // Initialize dispute
    dispute.subject_id = subject.subject_id;
    dispute.round = subject.round;
    dispute.status = DisputeStatus::Pending;
    dispute.dispute_type = dispute_type;
    dispute.total_stake = stake;
    dispute.challenger_count = 1;
    dispute.bond_at_risk = bond_at_risk;
    dispute.defender_count = subject.defender_count;
    dispute.votes_for_challenger = 0;
    dispute.votes_for_defender = 0;
    dispute.vote_count = 0;
    dispute.outcome = ResolutionOutcome::None;
    dispute.resolved_at = 0;
    dispute.is_restore = false;
    dispute.restore_stake = 0;
    dispute.restorer = Pubkey::default();
    dispute.details_cid = details_cid.clone();

    // Voting starts immediately
    dispute.start_voting(clock.unix_timestamp, subject.voting_period);

    // Update subject status
    subject.status = SubjectStatus::Disputed;
    subject.updated_at = clock.unix_timestamp;

    // Initialize challenger record
    challenger_record.subject_id = subject.subject_id;
    challenger_record.challenger = ctx.accounts.challenger.key();
    challenger_record.round = subject.round;
    challenger_record.stake = stake;
    challenger_record.details_cid = details_cid.clone();
    challenger_record.reward_claimed = false;
    challenger_record.bump = ctx.bumps.challenger_record;
    challenger_record.challenged_at = clock.unix_timestamp;

    // Add empty RoundResult slot to escrow (to be filled at resolution)
    // The realloc happens here - challenger pays for the new slot
    let new_round_result = RoundResult {
        round: subject.round,
        creator: ctx.accounts.challenger.key(),
        resolved_at: 0,
        outcome: ResolutionOutcome::None,
        total_stake: 0,
        bond_at_risk: 0,
        safe_bond: 0,
        total_vote_weight: 0,
        winner_pool: 0,
        juror_pool: 0,
        defender_count: 0,
        challenger_count: 0,
        juror_count: 0,
        defender_claims: 0,
        challenger_claims: 0,
        juror_claims: 0,
    };
    escrow.add_round(new_round_result);

    // Realloc escrow to fit new round
    let new_size = Escrow::size_for_rounds(escrow.rounds.len());
    let rent = Rent::get()?;
    let new_minimum_balance = rent.minimum_balance(new_size);
    let current_lamports = escrow.to_account_info().lamports();

    if current_lamports < new_minimum_balance {
        let diff = new_minimum_balance - current_lamports;
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.challenger.to_account_info(),
                to: escrow.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, diff)?;
    }

    escrow.to_account_info().resize(new_size)?;

    emit!(DisputeCreatedEvent {
        subject_id: subject.subject_id,
        round: subject.round,
        creator: ctx.accounts.challenger.key(),
        stake,
        bond_at_risk,
        voting_ends_at: dispute.voting_ends_at,
        timestamp: clock.unix_timestamp,
    });

    msg!("Dispute created: round={}, stake={}, bond_at_risk={}", subject.round, stake, bond_at_risk);
    Ok(())
}

/// Join an existing dispute as additional challenger
/// Also creates ChallengerPool if it doesn't exist
#[derive(Accounts)]
pub struct JoinChallengers<'info> {
    #[account(mut)]
    pub challenger: Signer<'info>,

    #[account(
        mut,
        seeds = [SUBJECT_SEED, subject.subject_id.as_ref()],
        bump = subject.bump,
    )]
    pub subject: Account<'info, Subject>,

    #[account(
        mut,
        seeds = [DISPUTE_SEED, subject.subject_id.as_ref()],
        bump = dispute.bump,
        constraint = dispute.status == DisputeStatus::Pending @ TribunalCraftError::DisputeAlreadyResolved,
    )]
    pub dispute: Account<'info, Dispute>,

    #[account(
        init_if_needed,
        payer = challenger,
        space = ChallengerRecord::LEN,
        seeds = [
            CHALLENGER_RECORD_SEED,
            subject.subject_id.as_ref(),
            challenger.key().as_ref(),
            &subject.round.to_le_bytes()
        ],
        bump
    )]
    pub challenger_record: Account<'info, ChallengerRecord>,

    /// Challenger's pool - created if doesn't exist
    #[account(
        init_if_needed,
        payer = challenger,
        space = ChallengerPool::LEN,
        seeds = [CHALLENGER_POOL_SEED, challenger.key().as_ref()],
        bump
    )]
    pub challenger_pool: Account<'info, ChallengerPool>,

    pub system_program: Program<'info, System>,
}

pub fn join_challengers(
    ctx: Context<JoinChallengers>,
    details_cid: String,
    stake: u64,
) -> Result<()> {
    let subject = &mut ctx.accounts.subject;
    let dispute = &mut ctx.accounts.dispute;
    let challenger_record = &mut ctx.accounts.challenger_record;
    let challenger_pool = &mut ctx.accounts.challenger_pool;
    let clock = Clock::get()?;

    // Initialize challenger pool if newly created
    if challenger_pool.owner == Pubkey::default() {
        challenger_pool.owner = ctx.accounts.challenger.key();
        challenger_pool.balance = 0;
        challenger_pool.reputation = INITIAL_REPUTATION;
        challenger_pool.bump = ctx.bumps.challenger_pool;
        challenger_pool.created_at = clock.unix_timestamp;
    }

    require!(stake > 0, TribunalCraftError::StakeBelowMinimum);
    require!(!dispute.is_voting_ended(clock.unix_timestamp), TribunalCraftError::VotingEnded);

    // In match mode, total stake cannot exceed available_bond
    if subject.match_mode {
        let new_total = dispute.total_stake.saturating_add(stake);
        require!(
            new_total <= subject.available_bond,
            TribunalCraftError::InsufficientAvailableStake
        );
    }

    // Transfer full stake to subject PDA (fees taken during resolution)
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.challenger.to_account_info(),
            to: subject.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_context, stake)?;

    // Update dispute
    dispute.total_stake += stake;

    // Update bond_at_risk based on mode
    if subject.match_mode {
        dispute.bond_at_risk = dispute.total_stake.min(subject.available_bond);
    }
    // Prop mode: bond_at_risk stays at available_bond (set at dispute creation)

    // Check if new challenger
    let is_new_challenger = challenger_record.challenged_at == 0;

    if is_new_challenger {
        challenger_record.subject_id = subject.subject_id;
        challenger_record.challenger = ctx.accounts.challenger.key();
        challenger_record.round = subject.round;
        challenger_record.stake = stake;
        challenger_record.details_cid = details_cid;
        challenger_record.reward_claimed = false;
        challenger_record.bump = ctx.bumps.challenger_record;
        challenger_record.challenged_at = clock.unix_timestamp;

        dispute.challenger_count += 1;
        msg!("New challenger joined: stake={}", stake);
    } else {
        challenger_record.stake += stake;
        msg!("Added to existing stake: {} (total: {})", stake, challenger_record.stake);
    }

    emit!(ChallengerJoinedEvent {
        subject_id: subject.subject_id,
        round: subject.round,
        challenger: ctx.accounts.challenger.key(),
        stake,
        total_stake: dispute.total_stake,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════════════
// Challenger Pool Management
// ═══════════════════════════════════════════════════════════════════════════════

/// Register as a challenger (create ChallengerPool)
#[derive(Accounts)]
pub struct RegisterChallenger<'info> {
    #[account(mut)]
    pub challenger: Signer<'info>,

    #[account(
        init,
        payer = challenger,
        space = ChallengerPool::LEN,
        seeds = [CHALLENGER_POOL_SEED, challenger.key().as_ref()],
        bump
    )]
    pub challenger_pool: Account<'info, ChallengerPool>,

    pub system_program: Program<'info, System>,
}

pub fn register_challenger(ctx: Context<RegisterChallenger>, stake_amount: u64) -> Result<()> {
    let challenger_pool = &mut ctx.accounts.challenger_pool;
    let clock = Clock::get()?;

    // Transfer SOL if any
    if stake_amount > 0 {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.challenger.to_account_info(),
                to: challenger_pool.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, stake_amount)?;
    }

    // Initialize challenger pool
    challenger_pool.owner = ctx.accounts.challenger.key();
    challenger_pool.balance = stake_amount;
    challenger_pool.reputation = INITIAL_REPUTATION;
    challenger_pool.bump = ctx.bumps.challenger_pool;
    challenger_pool.created_at = clock.unix_timestamp;

    if stake_amount > 0 {
        emit!(PoolDepositEvent {
            pool_type: PoolType::Challenger,
            owner: ctx.accounts.challenger.key(),
            amount: stake_amount,
            timestamp: clock.unix_timestamp,
        });
    }

    msg!("Challenger registered with {} lamports", stake_amount);
    Ok(())
}

/// Add stake to challenger pool
#[derive(Accounts)]
pub struct AddChallengerStake<'info> {
    #[account(mut)]
    pub challenger: Signer<'info>,

    #[account(
        mut,
        constraint = challenger_pool.owner == challenger.key() @ TribunalCraftError::Unauthorized,
        seeds = [CHALLENGER_POOL_SEED, challenger.key().as_ref()],
        bump = challenger_pool.bump
    )]
    pub challenger_pool: Account<'info, ChallengerPool>,

    pub system_program: Program<'info, System>,
}

pub fn add_challenger_stake(ctx: Context<AddChallengerStake>, amount: u64) -> Result<()> {
    let challenger_pool = &mut ctx.accounts.challenger_pool;
    let clock = Clock::get()?;

    require!(amount > 0, TribunalCraftError::StakeBelowMinimum);

    // Transfer SOL
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.challenger.to_account_info(),
            to: challenger_pool.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_context, amount)?;

    // Update balance
    challenger_pool.deposit(amount);

    emit!(PoolDepositEvent {
        pool_type: PoolType::Challenger,
        owner: ctx.accounts.challenger.key(),
        amount,
        timestamp: clock.unix_timestamp,
    });

    msg!("Challenger stake added: {} lamports", amount);
    Ok(())
}

/// Withdraw stake from challenger pool (with reputation-based slashing)
#[derive(Accounts)]
pub struct WithdrawChallengerStake<'info> {
    #[account(mut)]
    pub challenger: Signer<'info>,

    #[account(
        mut,
        constraint = challenger_pool.owner == challenger.key() @ TribunalCraftError::Unauthorized,
        seeds = [CHALLENGER_POOL_SEED, challenger.key().as_ref()],
        bump = challenger_pool.bump
    )]
    pub challenger_pool: Account<'info, ChallengerPool>,

    /// Protocol config for treasury address
    #[account(
        seeds = [PROTOCOL_CONFIG_SEED],
        bump = protocol_config.bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// Treasury receives slashed amounts
    /// CHECK: Validated against protocol_config.treasury
    #[account(
        mut,
        constraint = treasury.key() == protocol_config.treasury @ TribunalCraftError::InvalidConfig
    )]
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn withdraw_challenger_stake(ctx: Context<WithdrawChallengerStake>, amount: u64) -> Result<()> {
    let challenger_pool = &mut ctx.accounts.challenger_pool;
    let clock = Clock::get()?;

    require!(amount > 0, TribunalCraftError::StakeBelowMinimum);
    require!(challenger_pool.balance >= amount, TribunalCraftError::InsufficientAvailableStake);

    // Calculate withdrawal with reputation-based slashing
    let (return_amount, slash_amount) = calculate_withdrawal(challenger_pool.reputation, amount, SLASH_THRESHOLD);

    // Reduce balance
    challenger_pool.balance = challenger_pool.balance.saturating_sub(amount);

    // Transfer return amount to challenger
    if return_amount > 0 {
        **challenger_pool.to_account_info().try_borrow_mut_lamports()? -= return_amount;
        **ctx.accounts.challenger.to_account_info().try_borrow_mut_lamports()? += return_amount;
    }

    // Transfer slash amount to treasury
    if slash_amount > 0 {
        **challenger_pool.to_account_info().try_borrow_mut_lamports()? -= slash_amount;
        **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? += slash_amount;
    }

    emit!(PoolWithdrawEvent {
        pool_type: PoolType::Challenger,
        owner: ctx.accounts.challenger.key(),
        amount: return_amount,
        slashed: slash_amount,
        timestamp: clock.unix_timestamp,
    });

    msg!("Challenger stake withdrawn: {} returned, {} slashed", return_amount, slash_amount);
    Ok(())
}

/// Calculate withdrawal return based on reputation
/// Returns (return_amount, slash_amount)
fn calculate_withdrawal(reputation: u64, amount: u64, slash_threshold: u64) -> (u64, u64) {
    use crate::constants::REP_100_PERCENT;

    if reputation >= slash_threshold {
        // Full return if reputation >= 50%
        (amount, 0)
    } else {
        // return_percentage = reputation * 2 / REP_100_PERCENT
        // e.g., 25% rep (25_000_000) = 50% return
        let return_pct = reputation * 2;
        let return_amount = (amount as u128 * return_pct as u128 / REP_100_PERCENT as u128) as u64;
        let slash_amount = amount - return_amount;
        (return_amount, slash_amount)
    }
}
