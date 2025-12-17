use anchor_lang::prelude::*;

/// Individual challenger's contribution to a dispute
/// Supports cumulative disputes where multiple challengers contribute
#[account]
#[derive(Default)]
pub struct ChallengerRecord {
    /// The dispute this record belongs to
    pub dispute: Pubkey,

    /// Challenger's wallet address
    pub challenger: Pubkey,

    /// Challenger account PDA
    pub challenger_account: Pubkey,

    /// Bond amount contributed by this challenger
    pub bond: u64,

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
        32 +    // dispute
        32 +    // challenger
        32 +    // challenger_account
        8 +     // bond
        4 + Self::MAX_CID_LEN + // details_cid (string with length prefix)
        1 +     // reward_claimed
        1 +     // bump
        8;      // challenged_at

    /// Calculate challenger's share of reward based on bond weight
    /// reward = total_reward * (this_bond / total_bond)
    pub fn calculate_reward_share(&self, total_reward: u64, total_bond: u64) -> u64 {
        if total_bond == 0 {
            return 0;
        }
        (total_reward as u128 * self.bond as u128 / total_bond as u128) as u64
    }
}
