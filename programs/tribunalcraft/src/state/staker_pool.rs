use anchor_lang::prelude::*;

/// Staker's pool that can back multiple subjects - global per wallet
#[account]
#[derive(Default)]
pub struct StakerPool {
    /// Pool owner's wallet address
    pub owner: Pubkey,

    /// Total stake deposited
    pub total_stake: u64,

    /// Available stake (not held by disputes)
    pub available: u64,

    /// Held stake (locked by pending disputes)
    pub held: u64,

    /// Number of subjects linked to this pool
    pub subject_count: u32,

    /// Number of pending disputes against subjects in this pool
    pub pending_disputes: u32,

    /// Bump seed for PDA
    pub bump: u8,

    /// Creation timestamp
    pub created_at: i64,

    /// Last update timestamp
    pub updated_at: i64,
}

impl StakerPool {
    pub const LEN: usize = 8 +  // discriminator
        32 +    // owner
        8 +     // total_stake
        8 +     // available
        8 +     // held
        4 +     // subject_count
        4 +     // pending_disputes
        1 +     // bump
        8 +     // created_at
        8;      // updated_at

    /// Hold stake for a dispute (match mode)
    pub fn hold_stake(&mut self, amount: u64) -> Result<()> {
        require!(self.available >= amount, StakerPoolError::InsufficientAvailable);
        self.available -= amount;
        self.held += amount;
        self.pending_disputes += 1;
        Ok(())
    }

    /// Release held stake (dispute dismissed or no participation)
    pub fn release_stake(&mut self, amount: u64) -> Result<()> {
        require!(self.held >= amount, StakerPoolError::InsufficientHeld);
        self.held -= amount;
        self.available += amount;
        self.pending_disputes = self.pending_disputes.saturating_sub(1);
        Ok(())
    }

    /// Slash stake (dispute upheld)
    pub fn slash_stake(&mut self, amount: u64) -> Result<()> {
        require!(self.held >= amount, StakerPoolError::InsufficientHeld);
        self.held -= amount;
        self.total_stake -= amount;
        self.pending_disputes = self.pending_disputes.saturating_sub(1);
        Ok(())
    }
}

#[error_code]
pub enum StakerPoolError {
    #[msg("Insufficient available stake")]
    InsufficientAvailable,
    #[msg("Insufficient held stake")]
    InsufficientHeld,
}
