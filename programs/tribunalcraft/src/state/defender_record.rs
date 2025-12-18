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

    /// Total amount staked to back the subject (on subject account)
    pub stake: u64,

    /// Amount of stake currently at risk in escrow (during active dispute)
    /// This is the amount that will be used for claim calculations
    pub stake_in_escrow: u64,

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
        8 +     // stake_in_escrow
        1 +     // reward_claimed
        1 +     // bump
        8;      // staked_at

    /// Calculate defender's share of reward based on stake in escrow
    /// reward = total_reward * (this_stake_in_escrow / total_stakes_in_escrow)
    pub fn calculate_reward_share(&self, total_reward: u64, total_stake_in_escrow: u64) -> u64 {
        if total_stake_in_escrow == 0 {
            return 0;
        }
        (total_reward as u128 * self.stake_in_escrow as u128 / total_stake_in_escrow as u128) as u64
    }
}
