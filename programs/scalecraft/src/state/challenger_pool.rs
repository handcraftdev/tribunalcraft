use anchor_lang::prelude::*;

/// Challenger's pool for holding stake funds
/// Seeds: [CHALLENGER_POOL_SEED, owner]
/// One per user, persistent
#[account]
#[derive(Default)]
pub struct ChallengerPool {
    /// Pool owner's wallet address
    pub owner: Pubkey,

    /// Available balance
    pub balance: u64,

    /// Reputation score (6 decimals, 100% = 100_000_000)
    pub reputation: u64,

    /// Bump seed for PDA
    pub bump: u8,

    /// Creation timestamp
    pub created_at: i64,
}

impl ChallengerPool {
    pub const LEN: usize = 8 +  // discriminator
        32 +    // owner
        8 +     // balance
        8 +     // reputation
        1 +     // bump
        8;      // created_at

    /// Deposit funds to pool
    pub fn deposit(&mut self, amount: u64) {
        self.balance = self.balance.saturating_add(amount);
    }

    /// Check available balance
    pub fn available(&self) -> u64 {
        self.balance
    }
}
