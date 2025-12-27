use anchor_lang::prelude::*;
use crate::errors::ScaleCraftError;

/// Juror's pool for holding voting stake
/// Seeds: [JUROR_POOL_SEED, owner]
/// One per user, persistent
#[account]
#[derive(Default)]
pub struct JurorPool {
    /// Juror's wallet address
    pub owner: Pubkey,

    /// Available balance
    pub balance: u64,

    /// Reputation score (6 decimals, 100% = 100_000_000)
    pub reputation: u64,

    /// Bump seed for PDA
    pub bump: u8,

    /// Registration timestamp
    pub created_at: i64,
}

impl JurorPool {
    pub const LEN: usize = 8 +  // discriminator
        32 +    // owner
        8 +     // balance
        8 +     // reputation
        1 +     // bump
        8;      // created_at

    /// Deposit SOL to balance
    pub fn deposit(&mut self, amount: u64) {
        self.balance = self.balance.saturating_add(amount);
    }

    /// Withdraw SOL from balance
    pub fn withdraw(&mut self, amount: u64) -> Result<()> {
        require!(self.balance >= amount, ScaleCraftError::InsufficientAvailableStake);
        self.balance = self.balance.saturating_sub(amount);
        Ok(())
    }

    /// Add reward to balance
    pub fn add_reward(&mut self, amount: u64) {
        self.balance = self.balance.saturating_add(amount);
    }

    /// Calculate voting power: sqrt(stake) * reputation
    /// Returns scaled value (multiplied by WEIGHT_PRECISION)
    pub fn calculate_voting_power(&self, stake_allocated: u64) -> u64 {
        use crate::constants::{WEIGHT_PRECISION, REP_100_PERCENT};

        // sqrt(stake_allocated) - using integer sqrt approximation
        let sqrt_stake = integer_sqrt(stake_allocated);

        // reputation as decimal (divide by REP_100_PERCENT later)
        let rep = self.reputation;

        // voting_power = sqrt(stake) * (rep / 100_000_000)
        // Scale by WEIGHT_PRECISION for precision
        (sqrt_stake as u128 * rep as u128 * WEIGHT_PRECISION as u128 / REP_100_PERCENT as u128) as u64
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
