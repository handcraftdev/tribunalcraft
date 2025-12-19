use anchor_lang::prelude::*;
use crate::state::juror_account::integer_sqrt;

/// Challenger account tracking reputation - global per wallet
#[account]
#[derive(Default)]
pub struct ChallengerAccount {
    /// Challenger's wallet address
    pub challenger: Pubkey,

    /// Reputation score (6 decimals, 100% = 100_000_000)
    pub reputation: u64,

    /// Total disputes submitted
    pub disputes_submitted: u64,

    /// Disputes that were upheld (challenger was correct)
    pub disputes_upheld: u64,

    /// Disputes that were dismissed (challenger was wrong)
    pub disputes_dismissed: u64,

    /// Bump seed for PDA
    pub bump: u8,

    /// First dispute timestamp
    pub created_at: i64,

    /// Last dispute timestamp
    pub last_dispute_at: i64,
}

impl ChallengerAccount {
    pub const LEN: usize = 8 +  // discriminator
        32 +    // challenger
        8 +     // reputation (u64)
        8 +     // disputes_submitted
        8 +     // disputes_upheld
        8 +     // disputes_dismissed
        1 +     // bump
        8 +     // created_at
        8;      // last_dispute_at

    /// Calculate minimum bond based on reputation
    /// multiplier = sqrt(0.5 / reputation_pct)
    /// min_bond = base_bond * multiplier
    pub fn calculate_min_bond(&self, base_bond: u64) -> u64 {
        // sqrt(0.5 / reputation_pct) = sqrt(50_000_000 / reputation)
        // min_bond = base_bond * sqrt(50_000_000) / sqrt(reputation)
        // This gives: 50% rep = 1.0x, 25% rep = 1.41x, 100% rep = 0.71x

        if self.reputation == 0 {
            // Prevent division by zero, use max multiplier
            return base_bond * 10; // 10x for zero reputation
        }

        let sqrt_half = 7071u128; // sqrt(50_000_000) ≈ 7071
        let sqrt_rep = integer_sqrt(self.reputation) as u128;

        if sqrt_rep == 0 {
            return base_bond * 10;
        }

        // (base_bond * sqrt_half) / sqrt_rep
        let result = ((base_bond as u128 * sqrt_half) / sqrt_rep) as u64;

        // Ensure minimum is at least base_bond * 0.7 for very high reputation
        result.max(base_bond * 7 / 10)
    }
}
