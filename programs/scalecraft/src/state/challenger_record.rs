use anchor_lang::prelude::*;

/// Individual challenger's stake for a specific subject round
/// Seeds: [CHALLENGER_RECORD_SEED, subject_id, challenger, round]
/// Created per round, closed after claim
#[account]
#[derive(Default)]
pub struct ChallengerRecord {
    /// The subject_id this record belongs to
    pub subject_id: Pubkey,

    /// Challenger's wallet address
    pub challenger: Pubkey,

    /// Which round this stake is for
    pub round: u32,

    /// Stake amount contributed to the dispute
    pub stake: u64,

    /// Evidence CID (IPFS hash)
    pub details_cid: String,

    /// Whether reward has been claimed
    pub reward_claimed: bool,

    /// Bump seed for PDA
    pub bump: u8,

    /// Timestamp when this challenger joined
    pub challenged_at: i64,
}

impl ChallengerRecord {
    pub const MAX_CID_LEN: usize = 64; // IPFS CID v1 is typically 59 chars

    pub const LEN: usize = 8 +  // discriminator
        32 +    // subject_id
        32 +    // challenger
        4 +     // round
        8 +     // stake
        4 + Self::MAX_CID_LEN + // details_cid (string with length prefix)
        1 +     // reward_claimed
        1 +     // bump
        8;      // challenged_at

    /// Calculate challenger's share of reward based on stake weight
    /// reward = total_reward * (this_stake / total_stake)
    pub fn calculate_reward_share(&self, total_reward: u64, total_stake: u64) -> u64 {
        if total_stake == 0 {
            return 0;
        }
        (total_reward as u128 * self.stake as u128 / total_stake as u128) as u64
    }
}
