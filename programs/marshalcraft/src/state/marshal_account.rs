use anchor_lang::prelude::*;

/// Marshal (moderator) account
#[account]
#[derive(Default)]
pub struct MarshalAccount {
    /// Protocol config this marshal belongs to
    pub config: Pubkey,

    /// Marshal's wallet address
    pub marshal: Pubkey,

    /// Total stake deposited
    pub total_stake: u64,

    /// Available stake (not locked in votes)
    pub available_stake: u64,

    /// Reputation score (basis points, 0-10000+)
    pub reputation: u16,

    /// Total votes cast
    pub votes_cast: u64,

    /// Correct votes (aligned with outcome)
    pub correct_votes: u64,

    /// Whether marshal is active
    pub is_active: bool,

    /// Bump seed for PDA
    pub bump: u8,

    /// Registration timestamp
    pub joined_at: i64,

    /// Last activity timestamp
    pub last_vote_at: i64,
}

impl MarshalAccount {
    pub const LEN: usize = 8 +  // discriminator
        32 +    // config
        32 +    // marshal
        8 +     // total_stake
        8 +     // available_stake
        2 +     // reputation
        8 +     // votes_cast
        8 +     // correct_votes
        1 +     // is_active
        1 +     // bump
        8 +     // joined_at
        8;      // last_vote_at

    /// Calculate voting power: sqrt(stake) * reputation * sqrt(votes + 1)
    /// Returns scaled value (multiplied by WEIGHT_PRECISION)
    pub fn calculate_voting_power(&self, stake_allocated: u64) -> u64 {
        use crate::constants::WEIGHT_PRECISION;

        // sqrt(stake_allocated) - using integer sqrt approximation
        let sqrt_stake = integer_sqrt(stake_allocated);

        // sqrt(votes_cast + 1)
        let sqrt_votes = integer_sqrt(self.votes_cast + 1);

        // reputation as decimal (divide by 10000 later)
        let rep = self.reputation as u64;

        // voting_power = sqrt(stake) * (rep / 10000) * sqrt(votes + 1)
        // Scale by WEIGHT_PRECISION for precision
        (sqrt_stake * rep * sqrt_votes * WEIGHT_PRECISION) / 10000
    }

    /// Calculate withdrawal return based on reputation
    /// Returns (return_amount, slash_amount)
    pub fn calculate_withdrawal(&self, amount: u64, slash_threshold: u16) -> (u64, u64) {
        if self.reputation >= slash_threshold {
            // Full return if reputation >= 50%
            (amount, 0)
        } else {
            // return_percentage = reputation * 2 (in basis points)
            // e.g., 25% rep = 50% return
            let return_bps = (self.reputation as u64) * 2;
            let return_amount = (amount * return_bps) / 10000;
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
