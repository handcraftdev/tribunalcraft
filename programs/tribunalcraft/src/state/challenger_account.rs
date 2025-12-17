use anchor_lang::prelude::*;
use crate::state::juror_account::integer_sqrt;

/// Challenger account tracking reputation - global per wallet
#[account]
#[derive(Default)]
pub struct ChallengerAccount {
    /// Challenger's wallet address
    pub challenger: Pubkey,

    /// Reputation score (basis points)
    pub reputation: u16,

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
        2 +     // reputation
        8 +     // disputes_submitted
        8 +     // disputes_upheld
        8 +     // disputes_dismissed
        1 +     // bump
        8 +     // created_at
        8;      // last_dispute_at

    /// Calculate minimum bond based on reputation
    /// multiplier = sqrt(0.5 / reputation)
    /// min_bond = base_bond * multiplier
    pub fn calculate_min_bond(&self, base_bond: u64) -> u64 {
        // Convert reputation to decimal (reputation / 10000)
        // multiplier = sqrt(5000 / reputation) for integer math
        // This gives: 50% rep = 1.0x, 25% rep = 1.41x, 100% rep = 0.71x

        if self.reputation == 0 {
            // Prevent division by zero, use max multiplier
            return base_bond * 10; // 10x for zero reputation
        }

        // sqrt(5000 / reputation) * base_bond / sqrt(10000)
        // Simplified: base_bond * sqrt(5000) / sqrt(reputation) / 100

        let sqrt_5000 = 70; // sqrt(5000) ≈ 70.7
        let sqrt_rep = integer_sqrt(self.reputation as u64);

        if sqrt_rep == 0 {
            return base_bond * 10;
        }

        // Avoid overflow: (base_bond * sqrt_5000) / (sqrt_rep * 100)
        // Rearranged: (base_bond * sqrt_5000 / 100) / sqrt_rep
        let numerator = base_bond * sqrt_5000;
        let result = numerator / (sqrt_rep * 100);

        // Ensure minimum is at least base_bond for very high reputation
        result.max(base_bond * 7 / 10) // Minimum 0.7x for 100% rep
    }
}
