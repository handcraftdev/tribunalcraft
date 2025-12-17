use anchor_lang::prelude::*;

/// Individual staker's contribution to backing a subject
/// Supports cumulative staking where multiple stakers back a subject
#[account]
#[derive(Default)]
pub struct StakerRecord {
    /// The subject this record belongs to
    pub subject: Pubkey,

    /// Staker's wallet address
    pub staker: Pubkey,

    /// Amount staked to back the subject
    pub stake: u64,

    /// Whether reward has been claimed
    pub reward_claimed: bool,

    /// Bump seed for PDA
    pub bump: u8,

    /// Timestamp when this staker joined
    pub staked_at: i64,
}

impl StakerRecord {
    pub const LEN: usize = 8 +  // discriminator
        32 +    // subject
        32 +    // staker
        8 +     // stake
        1 +     // reward_claimed
        1 +     // bump
        8;      // staked_at

    /// Calculate staker's share of reward based on stake weight
    /// reward = total_reward * (this_stake / total_stake)
    pub fn calculate_reward_share(&self, total_reward: u64, total_stake: u64) -> u64 {
        if total_stake == 0 {
            return 0;
        }
        (total_reward as u128 * self.stake as u128 / total_stake as u128) as u64
    }
}
