use anchor_lang::prelude::*;

/// Individual reporter's contribution to a report
/// Supports cumulative reports where multiple reporters contribute
#[account]
#[derive(Default)]
pub struct ReporterRecord {
    /// The report this record belongs to
    pub report: Pubkey,

    /// Reporter's wallet address
    pub reporter: Pubkey,

    /// Reporter account PDA
    pub reporter_account: Pubkey,

    /// Bond amount contributed by this reporter
    pub bond: u64,

    /// Evidence CID (IPFS hash)
    pub details_cid: String,

    /// Whether reward has been claimed
    pub reward_claimed: bool,

    /// Bump seed for PDA
    pub bump: u8,

    /// Timestamp when this reporter joined
    pub reported_at: i64,
}

impl ReporterRecord {
    pub const MAX_CID_LEN: usize = 64; // IPFS CID v1 is typically 59 chars

    pub const LEN: usize = 8 +  // discriminator
        32 +    // report
        32 +    // reporter
        32 +    // reporter_account
        8 +     // bond
        4 + Self::MAX_CID_LEN + // details_cid (string with length prefix)
        1 +     // reward_claimed
        1 +     // bump
        8;      // reported_at

    /// Calculate reporter's share of reward based on bond weight
    /// reward = total_reward * (this_bond / total_bond)
    pub fn calculate_reward_share(&self, total_reward: u64, total_bond: u64) -> u64 {
        if total_bond == 0 {
            return 0;
        }
        (total_reward as u128 * self.bond as u128 / total_bond as u128) as u64
    }
}
