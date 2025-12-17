use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::{CHALLENGER_ACCOUNT_SEED, DISPUTE_SEED, CHALLENGER_RECORD_SEED, INITIAL_REPUTATION, BASE_CHALLENGER_BOND};
use crate::errors::TribunalCraftError;

/// Submit a new dispute against a subject (creates new dispute)
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

    /// Optional: staker pool if subject is linked
    #[account(
        mut,
        constraint = staker_pool.key() == subject.staker_pool @ TribunalCraftError::InvalidConfig,
    )]
    pub staker_pool: Option<Account<'info, StakerPool>>,

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
    let (pool_stake_held, direct_stake_held) = if subject.free_case {
        // Free case - no financial stakes
        (0, 0)
    } else {
        // Regular case - validate and hold stakes
        let min_bond = challenger_account.calculate_min_bond(BASE_CHALLENGER_BOND);
        require!(bond >= min_bond, TribunalCraftError::BondBelowMinimum);

        if subject.match_mode {
            if subject.is_linked() {
                // Linked mode: hold from pool and direct stakers
                let staker_pool = ctx.accounts.staker_pool.as_mut()
                    .ok_or(TribunalCraftError::InvalidConfig)?;

                let total_available = staker_pool.available.saturating_add(subject.total_stake);
                let required_hold = bond.min(subject.max_stake);

                require!(total_available >= required_hold, TribunalCraftError::InsufficientAvailableStake);

                let pool_hold = required_hold.min(staker_pool.available);
                let direct_hold = required_hold.saturating_sub(pool_hold);

                if pool_hold > 0 {
                    staker_pool.hold_stake(pool_hold)?;
                    staker_pool.updated_at = clock.unix_timestamp;
                }

                (pool_hold, direct_hold)
            } else {
                // Standalone mode: hold from direct stakers only
                require!(subject.total_stake >= bond, TribunalCraftError::InsufficientAvailableStake);
                (0, bond)
            }
        } else {
            (0, 0) // Proportional mode: no hold
        }
    };

    // Transfer bond to dispute account (skip for free cases)
    if !subject.free_case && bond > 0 {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.challenger.to_account_info(),
                to: dispute.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, bond)?;
    }

    // Update subject status
    subject.status = SubjectStatus::Disputed;
    subject.dispute = dispute.key();
    subject.dispute_count += 1;
    subject.updated_at = clock.unix_timestamp;

    // Initialize dispute
    dispute.subject = subject.key();
    dispute.dispute_type = dispute_type;
    dispute.total_bond = bond;
    dispute.stake_held = pool_stake_held;
    dispute.direct_stake_held = direct_stake_held;
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

    // Voting starts immediately (match mode is validated upfront)
    dispute.start_voting(clock.unix_timestamp, subject.voting_period);
    msg!("Dispute submitted - voting started (held: {}, bond: {})",
        dispute.total_stake_held(), bond);

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
        constraint = !subject.free_case @ TribunalCraftError::InvalidConfig, // Free subjects don't accept additional bond
    )]
    pub subject: Account<'info, Subject>,

    /// Optional: staker pool if subject is linked
    #[account(
        mut,
        constraint = staker_pool.key() == subject.staker_pool @ TribunalCraftError::InvalidConfig,
    )]
    pub staker_pool: Option<Account<'info, StakerPool>>,

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
    let challenger_record = &mut ctx.accounts.challenger_record;
    let clock = Clock::get()?;

    // Can't add to dispute after voting has ended
    require!(!dispute.is_voting_ended(clock.unix_timestamp), TribunalCraftError::VotingEnded);

    // Initialize challenger account if new
    if challenger_account.created_at == 0 {
        challenger_account.challenger = ctx.accounts.challenger.key();
        challenger_account.reputation = INITIAL_REPUTATION;
        challenger_account.bump = ctx.bumps.challenger_account;
        challenger_account.created_at = clock.unix_timestamp;
    }

    // Calculate minimum bond using fixed base bond
    let min_bond = challenger_account.calculate_min_bond(BASE_CHALLENGER_BOND);
    require!(bond >= min_bond, TribunalCraftError::BondBelowMinimum);

    // Handle match mode: hold additional stake for additional bond
    if subject.match_mode {
        if subject.is_linked() {
            // Linked mode: hold from pool and direct stakers
            let staker_pool = ctx.accounts.staker_pool.as_mut()
                .ok_or(TribunalCraftError::InvalidConfig)?;

            let total_held = dispute.total_stake_held();
            let remaining_capacity = subject.max_stake.saturating_sub(total_held);

            let pool_remaining = staker_pool.available;
            let direct_remaining = subject.total_stake.saturating_sub(dispute.direct_stake_held);
            let total_available = pool_remaining.saturating_add(direct_remaining);

            let required_hold = bond.min(remaining_capacity);
            require!(total_available >= required_hold, TribunalCraftError::InsufficientAvailableStake);

            let pool_hold = required_hold.min(pool_remaining);
            let direct_hold = required_hold.saturating_sub(pool_hold);

            if pool_hold > 0 {
                staker_pool.hold_stake(pool_hold)?;
                staker_pool.updated_at = clock.unix_timestamp;
                dispute.stake_held += pool_hold;
            }
            if direct_hold > 0 {
                dispute.direct_stake_held += direct_hold;
            }
        } else {
            // Standalone mode: hold from direct stakers only
            let remaining_capacity = subject.total_stake.saturating_sub(dispute.direct_stake_held);
            require!(remaining_capacity >= bond, TribunalCraftError::InsufficientAvailableStake);
            dispute.direct_stake_held += bond;
        }
    }

    // Transfer bond
    if bond > 0 {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.challenger.to_account_info(),
                to: dispute.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, bond)?;
    }

    // Update dispute total bond
    dispute.total_bond += bond;

    // Check if this is a new challenger or adding more bond to existing
    let is_new_challenger = challenger_record.challenged_at == 0;

    if is_new_challenger {
        // Initialize new challenger record
        challenger_record.dispute = dispute.key();
        challenger_record.challenger = ctx.accounts.challenger.key();
        challenger_record.challenger_account = challenger_account.key();
        challenger_record.bond = bond;
        challenger_record.details_cid = details_cid;
        challenger_record.reward_claimed = false;
        challenger_record.bump = ctx.bumps.challenger_record;
        challenger_record.challenged_at = clock.unix_timestamp;

        // Update challenger stats (only for new challengers)
        challenger_account.disputes_submitted += 1;
        challenger_account.last_dispute_at = clock.unix_timestamp;
        dispute.challenger_count += 1;

        msg!("New challenger added: {} lamports bond", bond);
    } else {
        // Add to existing bond (don't increment counts or update details)
        challenger_record.bond += bond;
        msg!("Added to existing bond: {} lamports (total: {})", bond, challenger_record.bond);
    }

    Ok(())
}

/// Submit a free dispute (no bond, no challenger record - just Dispute)
#[derive(Accounts)]
pub struct SubmitFreeDispute<'info> {
    #[account(mut)]
    pub challenger: Signer<'info>,

    #[account(
        mut,
        constraint = subject.free_case @ TribunalCraftError::InvalidConfig, // Only for free subjects
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

    // Update subject status
    subject.status = SubjectStatus::Disputed;
    subject.dispute = dispute.key();
    subject.dispute_count += 1;
    subject.updated_at = clock.unix_timestamp;

    // Initialize dispute (free case - no bonds, no stake held)
    dispute.subject = subject.key();
    dispute.dispute_type = dispute_type;
    dispute.total_bond = 0;
    dispute.stake_held = 0;
    dispute.direct_stake_held = 0;
    dispute.challenger_count = 0; // No challenger records for free disputes
    dispute.status = DisputeStatus::Pending;
    dispute.outcome = ResolutionOutcome::None;
    dispute.votes_favor_weight = 0;
    dispute.votes_against_weight = 0;
    dispute.vote_count = 0;
    dispute.resolved_at = 0;
    dispute.bump = ctx.bumps.dispute;
    dispute.created_at = clock.unix_timestamp;
    dispute.pool_reward_claimed = false;

    // Voting starts immediately for free disputes
    dispute.start_voting(clock.unix_timestamp, subject.voting_period);

    // Store details_cid in msg for indexing (no challenger record to store it)
    msg!("Free dispute submitted: {} - voting started", details_cid);

    Ok(())
}
