use anchor_lang::prelude::*;

/// Individual defender's contribution to backing a subject
/// Supports cumulative staking where multiple defenders back a subject
#[account]
#[derive(Default)]
pub struct DefenderRecord {
    /// The subject this record belongs to
    pub subject: Pubkey,

    /// Defender's wallet address
    pub defender: Pubkey,

    /// Amount staked to back the subject
    pub stake: u64,

    /// Whether reward has been claimed
    pub reward_claimed: bool,

    /// Bump seed for PDA
    pub bump: u8,

    /// Timestamp when this defender joined
    pub staked_at: i64,
}

impl DefenderRecord {
    pub const LEN: usize = 8 +  // discriminator
        32 +    // subject
        32 +    // defender
        8 +     // stake
        1 +     // reward_claimed
        1 +     // bump
        8;      // staked_at

    /// Calculate defender's share of reward based on stake weight
    /// reward = total_reward * (this_stake / total_stake)
    pub fn calculate_reward_share(&self, total_reward: u64, total_stake: u64) -> u64 {
        if total_stake == 0 {
            return 0;
        }
        (total_reward as u128 * self.stake as u128 / total_stake as u128) as u64
    }
}
