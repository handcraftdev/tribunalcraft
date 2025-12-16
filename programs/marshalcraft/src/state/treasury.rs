use anchor_lang::prelude::*;

/// Protocol treasury for collecting slashed funds
#[account]
#[derive(Default)]
pub struct Treasury {
    /// Protocol config this treasury belongs to
    pub config: Pubkey,

    /// Authority that can withdraw from treasury
    pub authority: Pubkey,

    /// Current balance (lamports)
    pub balance: u64,

    /// Total collected over lifetime (lamports)
    pub total_collected: u64,

    /// Total withdrawn over lifetime (lamports)
    pub total_withdrawn: u64,

    /// Bump seed for PDA
    pub bump: u8,

    /// Creation timestamp
    pub created_at: i64,

    /// Last activity timestamp
    pub updated_at: i64,
}

impl Treasury {
    pub const LEN: usize = 8 +  // discriminator
        32 +    // config
        32 +    // authority
        8 +     // balance
        8 +     // total_collected
        8 +     // total_withdrawn
        1 +     // bump
        8 +     // created_at
        8;      // updated_at

    /// Record incoming slashed funds
    pub fn receive_funds(&mut self, amount: u64) {
        self.balance += amount;
        self.total_collected += amount;
        self.updated_at = Clock::get().unwrap().unix_timestamp;
    }

    /// Withdraw funds (authority only)
    pub fn withdraw(&mut self, amount: u64) -> Result<()> {
        require!(self.balance >= amount, TreasuryError::InsufficientBalance);
        self.balance -= amount;
        self.total_withdrawn += amount;
        self.updated_at = Clock::get().unwrap().unix_timestamp;
        Ok(())
    }
}

#[error_code]
pub enum TreasuryError {
    #[msg("Insufficient treasury balance")]
    InsufficientBalance,
}
