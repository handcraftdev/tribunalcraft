use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::{
    CHALLENGER_ACCOUNT_SEED, DISPUTE_SEED, DISPUTE_ESCROW_SEED,
    CHALLENGER_RECORD_SEED, INITIAL_REPUTATION, BASE_CHALLENGER_BOND,
    DEFENDER_POOL_SEED,
};
use crate::errors::TribunalCraftError;

/// Submit a new dispute against a subject (creates dispute + escrow)
#[derive(Accounts)]
pub struct SubmitDispute<'info> {
    #[account(mut)]
    pub challenger: Signer<'info>,

    #[account(
        mut,
        constraint = subject.can_dispute() @ TribunalCraftError::SubjectCannotBeDisputed,
        constraint = !subject.has_active_dispute() @ TribunalCraftError::DisputeAlreadyExists,
    )]
    pub subject: Account<'info, Subject>,

    /// Optional: defender pool if subject is linked
    #[account(
        mut,
        constraint = defender_pool.key() == subject.defender_pool @ TribunalCraftError::InvalidConfig,
    )]
    pub defender_pool: Option<Account<'info, DefenderPool>>,

    #[account(
        init_if_needed,
        payer = challenger,
        space = ChallengerAccount::LEN,
        seeds = [CHALLENGER_ACCOUNT_SEED, challenger.key().as_ref()],
        bump
    )]
    pub challenger_account: Account<'info, ChallengerAccount>,

    #[account(
        init,
        payer = challenger,
        space = Dispute::LEN,
        seeds = [DISPUTE_SEED, subject.key().as_ref(), &subject.dispute_count.to_le_bytes()],
        bump
    )]
    pub dispute: Account<'info, Dispute>,

    /// Escrow PDA holds all funds for this dispute
    #[account(
        init,
        payer = challenger,
        space = DisputeEscrow::LEN,
        seeds = [DISPUTE_ESCROW_SEED, dispute.key().as_ref()],
        bump
    )]
    pub escrow: Account<'info, DisputeEscrow>,

    #[account(
        init,
        payer = challenger,
        space = ChallengerRecord::LEN,
        seeds = [CHALLENGER_RECORD_SEED, dispute.key().as_ref(), challenger.key().as_ref()],
        bump
    )]
    pub challenger_record: Account<'info, ChallengerRecord>,

    pub system_program: Program<'info, System>,
}

pub fn submit_dispute(
    ctx: Context<SubmitDispute>,
    dispute_type: DisputeType,
    details_cid: String,
    bond: u64,
) -> Result<()> {
    let subject = &mut ctx.accounts.subject;
    let challenger_account = &mut ctx.accounts.challenger_account;
    let dispute = &mut ctx.accounts.dispute;
    let escrow = &mut ctx.accounts.escrow;
    let challenger_record = &mut ctx.accounts.challenger_record;
    let clock = Clock::get()?;

    // Initialize challenger account if new
    if challenger_account.created_at == 0 {
        challenger_account.challenger = ctx.accounts.challenger.key();
        challenger_account.reputation = INITIAL_REPUTATION;
        challenger_account.bump = ctx.bumps.challenger_account;
        challenger_account.created_at = clock.unix_timestamp;
    }

    // Free cases: no bond required, no stake held, just voting
    let (pool_stake_to_transfer, direct_stake_to_transfer) = if subject.free_case {
        (0, 0)
    } else {
        // Regular case - validate and calculate stakes to transfer
        let min_bond = challenger_account.calculate_min_bond(BASE_CHALLENGER_BOND);
        require!(bond >= min_bond, TribunalCraftError::BondBelowMinimum);

        if subject.match_mode {
            if subject.is_linked() {
                let defender_pool = ctx.accounts.defender_pool.as_mut()
                    .ok_or(TribunalCraftError::InvalidConfig)?;

                let total_available = defender_pool.available.saturating_add(subject.total_stake);
                let required_hold = bond.min(subject.max_stake);

                require!(total_available >= required_hold, TribunalCraftError::InsufficientAvailableStake);

                let pool_transfer = required_hold.min(defender_pool.available);
                let direct_transfer = required_hold.saturating_sub(pool_transfer);

                // Update pool accounting (reduce available, but NOT using hold_stake since we're transferring)
                if pool_transfer > 0 {
                    defender_pool.available = defender_pool.available.saturating_sub(pool_transfer);
                    defender_pool.total_stake = defender_pool.total_stake.saturating_sub(pool_transfer);
                    defender_pool.updated_at = clock.unix_timestamp;
                }

                (pool_transfer, direct_transfer)
            } else {
                // Standalone mode
                require!(subject.total_stake >= bond, TribunalCraftError::InsufficientAvailableStake);
                (0, bond)
            }
        } else {
            (0, 0) // Proportional mode: no transfer
        }
    };

    // Transfer bond from challenger to escrow
    if !subject.free_case && bond > 0 {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.challenger.to_account_info(),
                to: escrow.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, bond)?;
    }

    // Transfer stakes from pool to escrow (if any)
    if pool_stake_to_transfer > 0 {
        let defender_pool = ctx.accounts.defender_pool.as_ref()
            .ok_or(TribunalCraftError::InvalidConfig)?;
        **defender_pool.to_account_info().try_borrow_mut_lamports()? -= pool_stake_to_transfer;
        **escrow.to_account_info().try_borrow_mut_lamports()? += pool_stake_to_transfer;
    }

    // Transfer stakes from subject to escrow (if any)
    if direct_stake_to_transfer > 0 {
        **subject.to_account_info().try_borrow_mut_lamports()? -= direct_stake_to_transfer;
        **escrow.to_account_info().try_borrow_mut_lamports()? += direct_stake_to_transfer;
        // Update subject stake accounting
        subject.total_stake = subject.total_stake.saturating_sub(direct_stake_to_transfer);
    }

    // Initialize escrow
    escrow.dispute = dispute.key();
    escrow.subject = subject.key();
    escrow.total_bonds = bond;
    escrow.total_stakes = pool_stake_to_transfer.saturating_add(direct_stake_to_transfer);
    escrow.bonds_claimed = 0;
    escrow.stakes_claimed = 0;
    escrow.juror_rewards_paid = 0;
    escrow.platform_fee_paid = 0;
    escrow.challengers_claimed = 0;
    escrow.defenders_claimed = 0;
    escrow.expected_challengers = 1;
    escrow.expected_defenders = subject.defender_count as u8;
    escrow.bump = ctx.bumps.escrow;
    escrow.created_at = clock.unix_timestamp;

    // Update subject status
    subject.status = SubjectStatus::Disputed;
    subject.dispute = dispute.key();
    subject.dispute_count += 1;
    subject.updated_at = clock.unix_timestamp;

    // Initialize dispute
    dispute.subject = subject.key();
    dispute.dispute_type = dispute_type;
    dispute.total_bond = bond;
    dispute.stake_held = pool_stake_to_transfer;
    dispute.direct_stake_held = direct_stake_to_transfer;
    dispute.challenger_count = 1;
    dispute.status = DisputeStatus::Pending;
    dispute.outcome = ResolutionOutcome::None;
    dispute.votes_favor_weight = 0;
    dispute.votes_against_weight = 0;
    dispute.vote_count = 0;
    dispute.resolved_at = 0;
    dispute.bump = ctx.bumps.dispute;
    dispute.created_at = clock.unix_timestamp;
    dispute.pool_reward_claimed = false;

    // Snapshot defender state for historical record
    dispute.snapshot_total_stake = subject.total_stake.saturating_add(direct_stake_to_transfer); // Original stake
    dispute.snapshot_defender_count = subject.defender_count;
    dispute.challengers_claimed = 0;
    dispute.defenders_claimed = 0;

    // Voting starts immediately
    dispute.start_voting(clock.unix_timestamp, subject.voting_period);
    msg!("Dispute submitted - escrow created (stakes: {}, bond: {})",
        escrow.total_stakes, bond);

    // Initialize challenger record
    challenger_record.dispute = dispute.key();
    challenger_record.challenger = ctx.accounts.challenger.key();
    challenger_record.challenger_account = challenger_account.key();
    challenger_record.bond = bond;
    challenger_record.details_cid = details_cid;
    challenger_record.reward_claimed = false;
    challenger_record.bump = ctx.bumps.challenger_record;
    challenger_record.challenged_at = clock.unix_timestamp;

    // Update challenger stats
    challenger_account.disputes_submitted += 1;
    challenger_account.last_dispute_at = clock.unix_timestamp;

    Ok(())
}

/// Add to existing dispute (additional challengers or add more bond)
#[derive(Accounts)]
pub struct AddToDispute<'info> {
    #[account(mut)]
    pub challenger: Signer<'info>,

    #[account(
        mut,
        constraint = !subject.free_case @ TribunalCraftError::InvalidConfig,
    )]
    pub subject: Account<'info, Subject>,

    /// Optional: defender pool if subject is linked
    #[account(
        mut,
        constraint = defender_pool.key() == subject.defender_pool @ TribunalCraftError::InvalidConfig,
    )]
    pub defender_pool: Option<Account<'info, DefenderPool>>,

    #[account(
        init_if_needed,
        payer = challenger,
        space = ChallengerAccount::LEN,
        seeds = [CHALLENGER_ACCOUNT_SEED, challenger.key().as_ref()],
        bump
    )]
    pub challenger_account: Account<'info, ChallengerAccount>,

    #[account(
        mut,
        has_one = subject,
        constraint = dispute.status == DisputeStatus::Pending @ TribunalCraftError::DisputeAlreadyResolved,
    )]
    pub dispute: Account<'info, Dispute>,

    /// Escrow PDA for this dispute
    #[account(
        mut,
        seeds = [DISPUTE_ESCROW_SEED, dispute.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, DisputeEscrow>,

    #[account(
        init_if_needed,
        payer = challenger,
        space = ChallengerRecord::LEN,
        seeds = [CHALLENGER_RECORD_SEED, dispute.key().as_ref(), challenger.key().as_ref()],
        bump
    )]
    pub challenger_record: Account<'info, ChallengerRecord>,

    pub system_program: Program<'info, System>,
}

pub fn add_to_dispute(
    ctx: Context<AddToDispute>,
    details_cid: String,
    bond: u64,
) -> Result<()> {
    let subject = &mut ctx.accounts.subject;
    let challenger_account = &mut ctx.accounts.challenger_account;
    let dispute = &mut ctx.accounts.dispute;
    let escrow = &mut ctx.accounts.escrow;
    let challenger_record = &mut ctx.accounts.challenger_record;
    let clock = Clock::get()?;

    require!(!dispute.is_voting_ended(clock.unix_timestamp), TribunalCraftError::VotingEnded);

    // Initialize challenger account if new
    if challenger_account.created_at == 0 {
        challenger_account.challenger = ctx.accounts.challenger.key();
        challenger_account.reputation = INITIAL_REPUTATION;
        challenger_account.bump = ctx.bumps.challenger_account;
        challenger_account.created_at = clock.unix_timestamp;
    }

    let min_bond = challenger_account.calculate_min_bond(BASE_CHALLENGER_BOND);
    require!(bond >= min_bond, TribunalCraftError::BondBelowMinimum);

    // Calculate additional stake to transfer
    let (pool_transfer, direct_transfer) = if subject.match_mode {
        if subject.is_linked() {
            let defender_pool = ctx.accounts.defender_pool.as_mut()
                .ok_or(TribunalCraftError::InvalidConfig)?;

            let total_held = dispute.total_stake_held();
            let remaining_capacity = subject.max_stake.saturating_sub(total_held);

            let pool_remaining = defender_pool.available;
            let direct_remaining = subject.total_stake;
            let total_available = pool_remaining.saturating_add(direct_remaining);

            let required = bond.min(remaining_capacity);
            require!(total_available >= required, TribunalCraftError::InsufficientAvailableStake);

            let pool_amt = required.min(pool_remaining);
            let direct_amt = required.saturating_sub(pool_amt);

            if pool_amt > 0 {
                defender_pool.available = defender_pool.available.saturating_sub(pool_amt);
                defender_pool.total_stake = defender_pool.total_stake.saturating_sub(pool_amt);
                defender_pool.updated_at = clock.unix_timestamp;
            }

            (pool_amt, direct_amt)
        } else {
            let remaining_capacity = subject.total_stake;
            require!(remaining_capacity >= bond, TribunalCraftError::InsufficientAvailableStake);
            (0, bond)
        }
    } else {
        (0, 0)
    };

    // Transfer bond to escrow
    if bond > 0 {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.challenger.to_account_info(),
                to: escrow.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, bond)?;
    }

    // Transfer stakes from pool to escrow
    if pool_transfer > 0 {
        let defender_pool = ctx.accounts.defender_pool.as_ref()
            .ok_or(TribunalCraftError::InvalidConfig)?;
        **defender_pool.to_account_info().try_borrow_mut_lamports()? -= pool_transfer;
        **escrow.to_account_info().try_borrow_mut_lamports()? += pool_transfer;
    }

    // Transfer stakes from subject to escrow
    if direct_transfer > 0 {
        **subject.to_account_info().try_borrow_mut_lamports()? -= direct_transfer;
        **escrow.to_account_info().try_borrow_mut_lamports()? += direct_transfer;
        subject.total_stake = subject.total_stake.saturating_sub(direct_transfer);
    }

    // Update escrow
    escrow.add_bond(bond);
    escrow.add_stake(pool_transfer.saturating_add(direct_transfer));

    // Update dispute
    dispute.total_bond += bond;
    dispute.stake_held += pool_transfer;
    dispute.direct_stake_held += direct_transfer;

    // Check if new challenger
    let is_new_challenger = challenger_record.challenged_at == 0;

    if is_new_challenger {
        challenger_record.dispute = dispute.key();
        challenger_record.challenger = ctx.accounts.challenger.key();
        challenger_record.challenger_account = challenger_account.key();
        challenger_record.bond = bond;
        challenger_record.details_cid = details_cid;
        challenger_record.reward_claimed = false;
        challenger_record.bump = ctx.bumps.challenger_record;
        challenger_record.challenged_at = clock.unix_timestamp;

        challenger_account.disputes_submitted += 1;
        challenger_account.last_dispute_at = clock.unix_timestamp;
        dispute.challenger_count += 1;
        escrow.expected_challengers += 1;

        msg!("New challenger added: {} bond", bond);
    } else {
        challenger_record.bond += bond;
        msg!("Added to existing bond: {} (total: {})", bond, challenger_record.bond);
    }

    Ok(())
}

/// Submit a free dispute (no bond, no escrow needed)
#[derive(Accounts)]
pub struct SubmitFreeDispute<'info> {
    #[account(mut)]
    pub challenger: Signer<'info>,

    #[account(
        mut,
        constraint = subject.free_case @ TribunalCraftError::InvalidConfig,
        constraint = subject.can_dispute() @ TribunalCraftError::SubjectCannotBeDisputed,
        constraint = !subject.has_active_dispute() @ TribunalCraftError::DisputeAlreadyExists,
    )]
    pub subject: Account<'info, Subject>,

    #[account(
        init,
        payer = challenger,
        space = Dispute::LEN,
        seeds = [DISPUTE_SEED, subject.key().as_ref(), &subject.dispute_count.to_le_bytes()],
        bump
    )]
    pub dispute: Account<'info, Dispute>,

    pub system_program: Program<'info, System>,
}

pub fn submit_free_dispute(
    ctx: Context<SubmitFreeDispute>,
    dispute_type: DisputeType,
    details_cid: String,
) -> Result<()> {
    let subject = &mut ctx.accounts.subject;
    let dispute = &mut ctx.accounts.dispute;
    let clock = Clock::get()?;

    subject.status = SubjectStatus::Disputed;
    subject.dispute = dispute.key();
    subject.dispute_count += 1;
    subject.updated_at = clock.unix_timestamp;

    dispute.subject = subject.key();
    dispute.dispute_type = dispute_type;
    dispute.total_bond = 0;
    dispute.stake_held = 0;
    dispute.direct_stake_held = 0;
    dispute.challenger_count = 0;
    dispute.status = DisputeStatus::Pending;
    dispute.outcome = ResolutionOutcome::None;
    dispute.votes_favor_weight = 0;
    dispute.votes_against_weight = 0;
    dispute.vote_count = 0;
    dispute.resolved_at = 0;
    dispute.bump = ctx.bumps.dispute;
    dispute.created_at = clock.unix_timestamp;
    dispute.pool_reward_claimed = false;
    dispute.snapshot_total_stake = 0;
    dispute.snapshot_defender_count = 0;
    dispute.challengers_claimed = 0;
    dispute.defenders_claimed = 0;

    dispute.start_voting(clock.unix_timestamp, subject.voting_period);
    msg!("Free dispute submitted: {} - voting started", details_cid);

    Ok(())
}
