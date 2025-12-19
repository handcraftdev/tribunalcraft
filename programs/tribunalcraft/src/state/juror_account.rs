use anchor_lang::prelude::*;
use crate::errors::TribunalCraftError;

/// Juror (arbiter) account - global per wallet
///
/// Balance Model:
/// - `total_stake`: Total SOL held in this PDA (actual lamports)
/// - `available_stake`: SOL available to vote or withdraw
/// - Held (locked): `total_stake - available_stake` (locked in active disputes)
///
/// SOL only transfers on deposit/withdraw. Voting is accounting only.
#[account]
#[derive(Default)]
pub struct JurorAccount {
    /// Juror's wallet address
    pub juror: Pubkey,

    /// Total stake held in this PDA (actual lamports)
    pub total_stake: u64,

    /// Available stake (not locked in active disputes)
    pub available_stake: u64,

    /// Reputation score (6 decimals, 100% = 100_000_000)
    pub reputation: u64,

    /// Total votes cast
    pub votes_cast: u64,

    /// Correct votes (aligned with outcome)
    pub correct_votes: u64,

    /// Whether juror is active
    pub is_active: bool,

    /// Bump seed for PDA
    pub bump: u8,

    /// Registration timestamp
    pub joined_at: i64,

    /// Last activity timestamp
    pub last_vote_at: i64,
}

impl JurorAccount {
    pub const LEN: usize = 8 +  // discriminator
        32 +    // juror
        8 +     // total_stake
        8 +     // available_stake
        8 +     // reputation (u64)
        8 +     // votes_cast
        8 +     // correct_votes
        1 +     // is_active
        1 +     // bump
        8 +     // joined_at
        8;      // last_vote_at

    /// Get currently held (locked) stake
    pub fn held_stake(&self) -> u64 {
        self.total_stake.saturating_sub(self.available_stake)
    }

    /// Deposit SOL to balance (after actual transfer to PDA)
    pub fn deposit(&mut self, amount: u64) {
        self.total_stake = self.total_stake.saturating_add(amount);
        self.available_stake = self.available_stake.saturating_add(amount);
    }

    /// Withdraw SOL from balance (before actual transfer from PDA)
    pub fn withdraw(&mut self, amount: u64) -> Result<()> {
        require!(self.available_stake >= amount, TribunalCraftError::InsufficientAvailableStake);
        self.total_stake = self.total_stake.saturating_sub(amount);
        self.available_stake = self.available_stake.saturating_sub(amount);
        Ok(())
    }

    /// Allocate stake for voting (accounting only, no SOL transfer)
    pub fn allocate_for_vote(&mut self, amount: u64) -> Result<()> {
        require!(self.available_stake >= amount, TribunalCraftError::InsufficientAvailableStake);
        self.available_stake = self.available_stake.saturating_sub(amount);
        // Note: total_stake unchanged - SOL stays in PDA, just locked
        Ok(())
    }

    /// Release stake from vote (accounting only, no SOL transfer)
    pub fn release_from_vote(&mut self, amount: u64) {
        self.available_stake = self.available_stake.saturating_add(amount);
        // Note: total_stake unchanged - SOL was always in PDA
    }

    /// Add reward to balance (after actual transfer to PDA)
    pub fn add_reward(&mut self, amount: u64) {
        self.total_stake = self.total_stake.saturating_add(amount);
        self.available_stake = self.available_stake.saturating_add(amount);
    }

    /// Calculate voting power: sqrt(stake) * reputation * sqrt(votes + 1)
    /// Returns scaled value (multiplied by WEIGHT_PRECISION)
    pub fn calculate_voting_power(&self, stake_allocated: u64) -> u64 {
        use crate::constants::{WEIGHT_PRECISION, REP_100_PERCENT};

        // sqrt(stake_allocated) - using integer sqrt approximation
        let sqrt_stake = integer_sqrt(stake_allocated);

        // sqrt(votes_cast + 1)
        let sqrt_votes = integer_sqrt(self.votes_cast + 1);

        // reputation as decimal (divide by REP_100_PERCENT later)
        let rep = self.reputation;

        // voting_power = sqrt(stake) * (rep / 100_000_000) * sqrt(votes + 1)
        // Scale by WEIGHT_PRECISION for precision
        (sqrt_stake as u128 * rep as u128 * sqrt_votes as u128 * WEIGHT_PRECISION as u128 / REP_100_PERCENT as u128) as u64
    }

    /// Calculate withdrawal return based on reputation
    /// Returns (return_amount, slash_amount)
    pub fn calculate_withdrawal(&self, amount: u64, slash_threshold: u64) -> (u64, u64) {
        use crate::constants::REP_100_PERCENT;

        if self.reputation >= slash_threshold {
            // Full return if reputation >= 50%
            (amount, 0)
        } else {
            // return_percentage = reputation * 2 / REP_100_PERCENT
            // e.g., 25% rep (25_000_000) = 50% return
            let return_pct = self.reputation * 2;
            let return_amount = (amount as u128 * return_pct as u128 / REP_100_PERCENT as u128) as u64;
            let slash_amount = amount - return_amount;
            (return_amount, slash_amount)
        }
    }
}

/// Integer square root using Newton's method
pub fn integer_sqrt(n: u64) -> u64 {
    if n == 0 {
        return 0;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}
