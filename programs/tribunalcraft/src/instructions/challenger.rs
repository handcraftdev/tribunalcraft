use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::{
    CHALLENGER_ACCOUNT_SEED, DISPUTE_SEED, PROTOCOL_CONFIG_SEED,
    CHALLENGER_RECORD_SEED, INITIAL_REPUTATION, BASE_CHALLENGER_BOND,
    TOTAL_FEE_BPS,
};
use crate::errors::TribunalCraftError;

/// Submit a new dispute against a subject
/// Bonds go to subject account (fees deducted to treasury)
/// No escrow - all funds managed on subject with accounting
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

    /// Optional: DefenderRecord for pool owner (required if pool has stake to transfer)
    #[account(mut)]
    pub pool_owner_defender_record: Option<Account<'info, DefenderRecord>>,

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

    /// Protocol config for treasury address
    #[account(
        seeds = [PROTOCOL_CONFIG_SEED],
        bump = protocol_config.bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// Treasury receives fees
    /// CHECK: Validated against protocol_config.treasury
    #[account(
        mut,
        constraint = treasury.key() == protocol_config.treasury @ TribunalCraftError::InvalidConfig
    )]
    pub treasury: AccountInfo<'info>,

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

    // Snapshot available stake BEFORE any changes (for claim calculations)
    let snapshot_total_stake = subject.available_stake;

    // Calculate stakes at risk and pool transfer
    let (pool_stake_to_transfer, direct_stake_at_risk) = if subject.free_case {
        (0, 0)
    } else {
        // Regular case - validate bond
        let min_bond = challenger_account.calculate_min_bond(BASE_CHALLENGER_BOND);
        require!(bond >= min_bond, TribunalCraftError::BondBelowMinimum);

        if subject.match_mode {
            if subject.is_linked() {
                let defender_pool = ctx.accounts.defender_pool.as_mut()
                    .ok_or(TribunalCraftError::InvalidConfig)?;

                let total_available = defender_pool.available.saturating_add(subject.available_stake);
                let required_hold = bond.min(subject.max_stake);
                require!(total_available >= required_hold, TribunalCraftError::InsufficientAvailableStake);

                let pool_transfer = required_hold.min(defender_pool.available);
                let direct_at_risk = required_hold.saturating_sub(pool_transfer);

                // Update pool accounting (available -> held)
                if pool_transfer > 0 {
                    defender_pool.available = defender_pool.available.saturating_sub(pool_transfer);
                    defender_pool.held += pool_transfer;
                    defender_pool.updated_at = clock.unix_timestamp;
                }

                (pool_transfer, direct_at_risk)
            } else {
                // Standalone match mode
                require!(subject.available_stake >= bond, TribunalCraftError::InsufficientAvailableStake);
                (0, bond)
            }
        } else {
            // Proportional mode: all stakes at risk
            if subject.is_linked() {
                let defender_pool = ctx.accounts.defender_pool.as_mut()
                    .ok_or(TribunalCraftError::InvalidConfig)?;

                // Pool contribution capped at max_stake
                let pool_transfer = defender_pool.available.min(subject.max_stake);
                let direct_at_risk = subject.available_stake;

                // Update pool accounting (available -> held)
                if pool_transfer > 0 {
                    defender_pool.available = defender_pool.available.saturating_sub(pool_transfer);
                    defender_pool.held += pool_transfer;
                    defender_pool.updated_at = clock.unix_timestamp;
                }

                (pool_transfer, direct_at_risk)
            } else {
                // Standalone proportional: all direct stake at risk
                (0, subject.available_stake)
            }
        }
    };

    // Calculate fees for bond, pool stake, and direct stake
    let (bond_fee, net_bond) = if !subject.free_case && bond > 0 {
        let fee = (bond as u128 * TOTAL_FEE_BPS as u128 / 10000) as u64;
        (fee, bond.saturating_sub(fee))
    } else {
        (0, bond)
    };

    let (pool_fee, net_pool_stake) = if pool_stake_to_transfer > 0 {
        let fee = (pool_stake_to_transfer as u128 * TOTAL_FEE_BPS as u128 / 10000) as u64;
        (fee, pool_stake_to_transfer.saturating_sub(fee))
    } else {
        (0, 0)
    };

    let (direct_fee, net_direct_stake) = if direct_stake_at_risk > 0 {
        let fee = (direct_stake_at_risk as u128 * TOTAL_FEE_BPS as u128 / 10000) as u64;
        (fee, direct_stake_at_risk.saturating_sub(fee))
    } else {
        (0, 0)
    };

    // Transfer bond fee from challenger to treasury
    if bond_fee > 0 {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.challenger.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, bond_fee)?;
    }

    // Transfer net bond to subject
    if net_bond > 0 {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.challenger.to_account_info(),
                to: subject.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, net_bond)?;
    }

    // Transfer pool stake to subject (minus fee to treasury)
    if pool_stake_to_transfer > 0 {
        let defender_pool = ctx.accounts.defender_pool.as_ref()
            .ok_or(TribunalCraftError::InvalidConfig)?;
        let pool_owner_record = ctx.accounts.pool_owner_defender_record.as_mut()
            .ok_or(TribunalCraftError::InvalidConfig)?;

        // Validate pool owner's record
        require!(
            pool_owner_record.defender == defender_pool.owner,
            TribunalCraftError::Unauthorized
        );
        require!(
            pool_owner_record.subject == subject.key(),
            TribunalCraftError::InvalidConfig
        );

        // Transfer fee from pool to treasury
        if pool_fee > 0 {
            **defender_pool.to_account_info().try_borrow_mut_lamports()? -= pool_fee;
            **ctx.accounts.treasury.try_borrow_mut_lamports()? += pool_fee;
        }

        // Transfer net pool stake to subject
        if net_pool_stake > 0 {
            **defender_pool.to_account_info().try_borrow_mut_lamports()? -= net_pool_stake;
            **subject.to_account_info().try_borrow_mut_lamports()? += net_pool_stake;

            // Consolidate into pool owner's stake (net amount)
            pool_owner_record.stake += net_pool_stake;
            subject.available_stake += net_pool_stake;
        }

        msg!("Pool stake: {} gross, {} net (fee: {})", pool_stake_to_transfer, net_pool_stake, pool_fee);
    }

    // Direct stake: transfer fee from subject to treasury (stake stays on subject)
    if direct_fee > 0 {
        **subject.to_account_info().try_borrow_mut_lamports()? -= direct_fee;
        **ctx.accounts.treasury.try_borrow_mut_lamports()? += direct_fee;
        subject.available_stake = subject.available_stake.saturating_sub(direct_fee);
        msg!("Direct stake fee collected: {}", direct_fee);
    }

    // Update subject status
    subject.status = SubjectStatus::Disputed;
    subject.dispute = dispute.key();
    subject.dispute_count += 1;
    subject.updated_at = clock.unix_timestamp;

    // Initialize dispute with NET amounts (after fees)
    dispute.subject = subject.key();
    dispute.dispute_type = dispute_type;
    dispute.total_bond = net_bond;
    dispute.stake_held = net_pool_stake;
    dispute.direct_stake_held = net_direct_stake;
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

    // Snapshot for claim calculations (use NET amounts after fees)
    // Direct stake is now (snapshot_total_stake - direct_fee), pool stake is net_pool_stake
    dispute.snapshot_total_stake = snapshot_total_stake.saturating_sub(direct_fee) + net_pool_stake;
    dispute.snapshot_defender_count = subject.defender_count;
    dispute.challengers_claimed = 0;
    dispute.defenders_claimed = 0;

    // Voting starts immediately
    dispute.start_voting(clock.unix_timestamp, subject.voting_period);

    // Initialize challenger record
    challenger_record.dispute = dispute.key();
    challenger_record.challenger = ctx.accounts.challenger.key();
    challenger_record.challenger_account = challenger_account.key();
    challenger_record.bond = net_bond;
    challenger_record.details_cid = details_cid;
    challenger_record.reward_claimed = false;
    challenger_record.bump = ctx.bumps.challenger_record;
    challenger_record.challenged_at = clock.unix_timestamp;

    let total_fees = bond_fee + pool_fee + direct_fee;
    msg!("Dispute submitted: bond={} (net), pool={} (net), direct={} (net), total_fees={}",
        net_bond, net_pool_stake, net_direct_stake, total_fees);

    // Update challenger stats
    challenger_account.disputes_submitted += 1;
    challenger_account.last_dispute_at = clock.unix_timestamp;

    Ok(())
}

/// Add to existing dispute (additional challengers or add more bond)
/// No escrow - bonds go to subject, fees to treasury
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

    /// Optional: DefenderRecord for pool owner (required if pool has stake to transfer)
    #[account(mut)]
    pub pool_owner_defender_record: Option<Account<'info, DefenderRecord>>,

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

    /// Protocol config for treasury address
    #[account(
        seeds = [PROTOCOL_CONFIG_SEED],
        bump = protocol_config.bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// Treasury receives fees
    /// CHECK: Validated against protocol_config.treasury
    #[account(
        mut,
        constraint = treasury.key() == protocol_config.treasury @ TribunalCraftError::InvalidConfig
    )]
    pub treasury: AccountInfo<'info>,

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

    // Calculate additional stake to put at risk (match mode only)
    let (pool_stake_to_transfer, direct_stake_at_risk) = if subject.match_mode {
        if subject.is_linked() {
            let defender_pool = ctx.accounts.defender_pool.as_mut()
                .ok_or(TribunalCraftError::InvalidConfig)?;

            // Calculate remaining capacity up to max_stake
            let total_held = dispute.total_stake_held();
            let remaining_capacity = subject.max_stake.saturating_sub(total_held);

            let pool_available = defender_pool.available;
            let direct_available = subject.available_stake.saturating_sub(dispute.direct_stake_held);
            let total_available = pool_available.saturating_add(direct_available);

            let required = bond.min(remaining_capacity);
            require!(total_available >= required, TribunalCraftError::InsufficientAvailableStake);

            // Pool first, then direct stake
            let pool_amt = required.min(pool_available);
            let direct_amt = required.saturating_sub(pool_amt);

            // Update pool accounting (available -> held)
            if pool_amt > 0 {
                defender_pool.available = defender_pool.available.saturating_sub(pool_amt);
                defender_pool.held += pool_amt;
                defender_pool.updated_at = clock.unix_timestamp;
            }

            (pool_amt, direct_amt)
        } else {
            // Standalone match mode
            let direct_available = subject.available_stake.saturating_sub(dispute.direct_stake_held);
            require!(direct_available >= bond, TribunalCraftError::InsufficientAvailableStake);
            (0, bond)
        }
    } else {
        // Proportional mode: no additional stake matching on add_to_dispute
        (0, 0)
    };

    // Calculate fees for bond, pool stake, and direct stake
    let (bond_fee, net_bond) = if bond > 0 {
        let fee = (bond as u128 * TOTAL_FEE_BPS as u128 / 10000) as u64;
        (fee, bond.saturating_sub(fee))
    } else {
        (0, 0)
    };

    let (pool_fee, net_pool_stake) = if pool_stake_to_transfer > 0 {
        let fee = (pool_stake_to_transfer as u128 * TOTAL_FEE_BPS as u128 / 10000) as u64;
        (fee, pool_stake_to_transfer.saturating_sub(fee))
    } else {
        (0, 0)
    };

    let (direct_fee, net_direct_stake) = if direct_stake_at_risk > 0 {
        let fee = (direct_stake_at_risk as u128 * TOTAL_FEE_BPS as u128 / 10000) as u64;
        (fee, direct_stake_at_risk.saturating_sub(fee))
    } else {
        (0, 0)
    };

    // Transfer bond fee from challenger to treasury
    if bond_fee > 0 {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.challenger.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, bond_fee)?;
    }

    // Transfer net bond to subject
    if net_bond > 0 {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.challenger.to_account_info(),
                to: subject.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, net_bond)?;
    }

    // Transfer pool stake (minus fee) to subject
    if pool_stake_to_transfer > 0 {
        let defender_pool = ctx.accounts.defender_pool.as_ref()
            .ok_or(TribunalCraftError::InvalidConfig)?;
        let pool_owner_record = ctx.accounts.pool_owner_defender_record.as_mut()
            .ok_or(TribunalCraftError::InvalidConfig)?;

        // Validate pool owner's record
        require!(
            pool_owner_record.defender == defender_pool.owner,
            TribunalCraftError::Unauthorized
        );
        require!(
            pool_owner_record.subject == subject.key(),
            TribunalCraftError::InvalidConfig
        );

        // Transfer fee from pool to treasury
        if pool_fee > 0 {
            **defender_pool.to_account_info().try_borrow_mut_lamports()? -= pool_fee;
            **ctx.accounts.treasury.try_borrow_mut_lamports()? += pool_fee;
        }

        // Transfer net pool stake to subject
        if net_pool_stake > 0 {
            **defender_pool.to_account_info().try_borrow_mut_lamports()? -= net_pool_stake;
            **subject.to_account_info().try_borrow_mut_lamports()? += net_pool_stake;

            // Consolidate into pool owner's stake (net amount)
            pool_owner_record.stake += net_pool_stake;
            subject.available_stake += net_pool_stake;

            // Update snapshot to include new pool stake (net)
            dispute.snapshot_total_stake += net_pool_stake;
        }

        msg!("Pool stake: {} gross, {} net (fee: {})", pool_stake_to_transfer, net_pool_stake, pool_fee);
    }

    // Direct stake: transfer fee from subject to treasury
    if direct_fee > 0 {
        **subject.to_account_info().try_borrow_mut_lamports()? -= direct_fee;
        **ctx.accounts.treasury.try_borrow_mut_lamports()? += direct_fee;
        subject.available_stake = subject.available_stake.saturating_sub(direct_fee);
        // Note: Don't add to snapshot_total_stake since we're reducing existing stake
        msg!("Direct stake fee collected: {}", direct_fee);
    }

    // Update dispute accounting with NET amounts
    dispute.total_bond += net_bond;
    dispute.stake_held += net_pool_stake;
    dispute.direct_stake_held += net_direct_stake;

    // Check if new challenger
    let is_new_challenger = challenger_record.challenged_at == 0;

    if is_new_challenger {
        challenger_record.dispute = dispute.key();
        challenger_record.challenger = ctx.accounts.challenger.key();
        challenger_record.challenger_account = challenger_account.key();
        challenger_record.bond = net_bond;
        challenger_record.details_cid = details_cid;
        challenger_record.reward_claimed = false;
        challenger_record.bump = ctx.bumps.challenger_record;
        challenger_record.challenged_at = clock.unix_timestamp;

        challenger_account.disputes_submitted += 1;
        challenger_account.last_dispute_at = clock.unix_timestamp;
        dispute.challenger_count += 1;

        msg!("New challenger added: {} bond (net after fees)", net_bond);
    } else {
        challenger_record.bond += net_bond;
        msg!("Added to existing bond: {} (total: {})", net_bond, challenger_record.bond);
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
