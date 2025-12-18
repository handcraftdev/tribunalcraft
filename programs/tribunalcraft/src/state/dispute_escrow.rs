use anchor_lang::prelude::*;

/// DisputeEscrow holds all funds for a single dispute.
/// One PDA per dispute - consolidates bonds and stakes in one place.
#[account]
pub struct DisputeEscrow {
    /// Associated dispute account
    pub dispute: Pubkey,
    /// Associated subject account
    pub subject: Pubkey,

    // === Fund Tracking ===
    /// Total challenger bonds deposited
    pub total_bonds: u64,
    /// Total defender stakes deposited (from subject + pool)
    pub total_stakes: u64,

    // === Claim Tracking ===
    /// Bonds withdrawn via challenger claims
    pub bonds_claimed: u64,
    /// Stakes withdrawn via defender claims
    pub stakes_claimed: u64,
    /// Rewards paid to jurors
    pub juror_rewards_paid: u64,
    /// Platform fee sent to treasury
    pub platform_fee_paid: u64,

    // === Participant Counters ===
    /// Number of challengers who have claimed
    pub challengers_claimed: u8,
    /// Number of defenders who have claimed
    pub defenders_claimed: u8,
    /// Expected number of challengers (for close validation)
    pub expected_challengers: u8,
    /// Expected number of defenders (snapshot at dispute creation)
    pub expected_defenders: u8,

    /// PDA bump
    pub bump: u8,
    /// Creation timestamp
    pub created_at: i64,
}

impl DisputeEscrow {
    pub const LEN: usize = 8  // discriminator
        + 32  // dispute
        + 32  // subject
        + 8   // total_bonds
        + 8   // total_stakes
        + 8   // bonds_claimed
        + 8   // stakes_claimed
        + 8   // juror_rewards_paid
        + 8   // platform_fee_paid
        + 1   // challengers_claimed
        + 1   // defenders_claimed
        + 1   // expected_challengers
        + 1   // expected_defenders
        + 1   // bump
        + 8;  // created_at

    /// Calculate current balance in escrow (lamports held - lamports paid out)
    pub fn available_balance(&self) -> u64 {
        let total_in = self.total_bonds.saturating_add(self.total_stakes);
        let total_out = self.bonds_claimed
            .saturating_add(self.stakes_claimed)
            .saturating_add(self.juror_rewards_paid)
            .saturating_add(self.platform_fee_paid);
        total_in.saturating_sub(total_out)
    }

    /// Check if all expected claims have been processed
    pub fn all_claims_complete(&self) -> bool {
        self.challengers_claimed >= self.expected_challengers
            && self.defenders_claimed >= self.expected_defenders
    }

    /// Add bond to escrow (called when challenger joins)
    pub fn add_bond(&mut self, amount: u64) {
        self.total_bonds = self.total_bonds.saturating_add(amount);
    }

    /// Add stake to escrow (called when stakes transferred from subject/pool)
    pub fn add_stake(&mut self, amount: u64) {
        self.total_stakes = self.total_stakes.saturating_add(amount);
    }

    /// Record bond claimed by challenger
    pub fn record_bond_claim(&mut self, amount: u64) {
        self.bonds_claimed = self.bonds_claimed.saturating_add(amount);
        self.challengers_claimed = self.challengers_claimed.saturating_add(1);
    }

    /// Record stake claimed by defender
    pub fn record_stake_claim(&mut self, amount: u64) {
        self.stakes_claimed = self.stakes_claimed.saturating_add(amount);
        self.defenders_claimed = self.defenders_claimed.saturating_add(1);
    }

    /// Record juror reward paid
    pub fn record_juror_reward(&mut self, amount: u64) {
        self.juror_rewards_paid = self.juror_rewards_paid.saturating_add(amount);
    }

    /// Record platform fee paid
    pub fn record_platform_fee(&mut self, amount: u64) {
        self.platform_fee_paid = self.platform_fee_paid.saturating_add(amount);
    }
}
