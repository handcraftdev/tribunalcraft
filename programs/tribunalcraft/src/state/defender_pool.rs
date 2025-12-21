use anchor_lang::prelude::*;

/// Defender's pool for holding bond funds
/// Seeds: [DEFENDER_POOL_SEED, owner]
/// One per user, persistent
#[account]
#[derive(Default)]
pub struct DefenderPool {
    /// Pool owner's wallet address
    pub owner: Pubkey,

    /// Available balance (not locked in active bonds)
    pub balance: u64,

    /// Max bond per subject (for auto-allocation)
    pub max_bond: u64,

    /// Bump seed for PDA
    pub bump: u8,

    /// Creation timestamp
    pub created_at: i64,

    /// Last update timestamp
    pub updated_at: i64,
}

impl DefenderPool {
    pub const LEN: usize = 8 +  // discriminator
        32 +    // owner
        8 +     // balance
        8 +     // max_bond
        1 +     // bump
        8 +     // created_at
        8;      // updated_at

    /// Deposit funds to pool
    pub fn deposit(&mut self, amount: u64) {
        self.balance = self.balance.saturating_add(amount);
    }

    /// Withdraw funds from pool
    pub fn withdraw(&mut self, amount: u64) -> Result<()> {
        require!(self.balance >= amount, DefenderPoolError::InsufficientBalance);
        self.balance = self.balance.saturating_sub(amount);
        Ok(())
    }

    /// Use balance for bonding (reduces available balance)
    pub fn use_for_bond(&mut self, amount: u64) -> Result<()> {
        require!(self.balance >= amount, DefenderPoolError::InsufficientBalance);
        self.balance = self.balance.saturating_sub(amount);
        Ok(())
    }

    /// Add reward to balance
    pub fn add_reward(&mut self, amount: u64) {
        self.balance = self.balance.saturating_add(amount);
    }

    /// Calculate auto-bond amount (capped by max_bond and balance)
    pub fn auto_bond_amount(&self) -> u64 {
        self.balance.min(self.max_bond)
    }
}

#[error_code]
pub enum DefenderPoolError {
    #[msg("Insufficient balance in defender pool")]
    InsufficientBalance,
}
