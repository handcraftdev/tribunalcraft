use anchor_lang::prelude::*;
use crate::state::marshal_account::integer_sqrt;

/// Reporter account tracking reputation
#[account]
#[derive(Default)]
pub struct ReporterAccount {
    /// Protocol config this reporter belongs to
    pub config: Pubkey,

    /// Reporter's wallet address
    pub reporter: Pubkey,

    /// Reputation score (basis points)
    pub reputation: u16,

    /// Total reports submitted
    pub reports_submitted: u64,

    /// Reports that were upheld (reporter was correct)
    pub reports_upheld: u64,

    /// Reports that were dismissed (reporter was wrong)
    pub reports_dismissed: u64,

    /// Bump seed for PDA
    pub bump: u8,

    /// First report timestamp
    pub created_at: i64,

    /// Last report timestamp
    pub last_report_at: i64,
}

impl ReporterAccount {
    pub const LEN: usize = 8 +  // discriminator
        32 +    // config
        32 +    // reporter
        2 +     // reputation
        8 +     // reports_submitted
        8 +     // reports_upheld
        8 +     // reports_dismissed
        1 +     // bump
        8 +     // created_at
        8;      // last_report_at

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
