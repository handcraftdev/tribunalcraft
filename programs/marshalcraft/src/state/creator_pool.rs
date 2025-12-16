use anchor_lang::prelude::*;

/// Creator's stake pool that covers all their content
#[account]
#[derive(Default)]
pub struct CreatorPool {
    /// Protocol config this pool belongs to
    pub config: Pubkey,

    /// Creator's wallet address
    pub creator: Pubkey,

    /// Total stake deposited
    pub total_stake: u64,

    /// Available stake (can be reported against / withdrawn)
    pub available: u64,

    /// Held stake (locked by pending reports)
    pub held: u64,

    /// Number of pending reports against this creator
    pub pending_reports: u16,

    /// Number of upheld reports (content removed)
    pub upheld_reports: u32,

    /// Number of dismissed reports
    pub dismissed_reports: u32,

    /// Bump seed for PDA
    pub bump: u8,

    /// Creation timestamp
    pub created_at: i64,

    /// Last activity timestamp
    pub updated_at: i64,
}

impl CreatorPool {
    pub const LEN: usize = 8 +  // discriminator
        32 +    // config
        32 +    // creator
        8 +     // total_stake
        8 +     // available
        8 +     // held
        2 +     // pending_reports
        4 +     // upheld_reports
        4 +     // dismissed_reports
        1 +     // bump
        8 +     // created_at
        8;      // updated_at

    /// Invariant check: total_stake = available + held
    pub fn check_invariant(&self) -> bool {
        self.total_stake == self.available + self.held
    }

    /// Hold stake for a new report
    pub fn hold_stake(&mut self, amount: u64) -> Result<()> {
        require!(self.available >= amount, ErrorCode::InsufficientAvailableStake);
        self.available -= amount;
        self.held += amount;
        self.pending_reports += 1;
        Ok(())
    }

    /// Release held stake (report dismissed)
    pub fn release_stake(&mut self, amount: u64) -> Result<()> {
        require!(self.held >= amount, ErrorCode::InsufficientHeldStake);
        self.held -= amount;
        self.available += amount;
        self.pending_reports = self.pending_reports.saturating_sub(1);
        self.dismissed_reports += 1;
        Ok(())
    }

    /// Slash stake (report upheld)
    pub fn slash_stake(&mut self, amount: u64) -> Result<()> {
        require!(self.held >= amount, ErrorCode::InsufficientHeldStake);
        self.held -= amount;
        self.total_stake -= amount;
        self.pending_reports = self.pending_reports.saturating_sub(1);
        self.upheld_reports += 1;
        Ok(())
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("Insufficient available stake")]
    InsufficientAvailableStake,
    #[msg("Insufficient held stake")]
    InsufficientHeldStake,
}
