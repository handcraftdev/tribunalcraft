use anchor_lang::prelude::*;

/// Source of bond funds
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum BondSource {
    #[default]
    Direct,    // From wallet directly
    Pool,      // From DefenderPool
}

/// Individual defender's bond for a specific subject round
/// Seeds: [DEFENDER_RECORD_SEED, subject_id, defender, round]
/// Created per round, closed after claim
#[account]
#[derive(Default)]
pub struct DefenderRecord {
    /// The subject_id this record belongs to
    pub subject_id: Pubkey,

    /// Defender's wallet address
    pub defender: Pubkey,

    /// Which round this bond is for
    pub round: u32,

    /// Bond amount backing the subject
    pub bond: u64,

    /// Source of bond funds
    pub source: BondSource,

    /// Whether reward has been claimed
    pub reward_claimed: bool,

    /// Bump seed for PDA
    pub bump: u8,

    /// Timestamp when this defender bonded
    pub bonded_at: i64,
}

impl DefenderRecord {
    pub const LEN: usize = 8 +  // discriminator
        32 +    // subject_id
        32 +    // defender
        4 +     // round
        8 +     // bond
        1 +     // source
        1 +     // reward_claimed
        1 +     // bump
        8;      // bonded_at

    /// Calculate defender's share of reward based on bond
    /// reward = total_reward * (this_bond / total_bond)
    pub fn calculate_reward_share(&self, total_reward: u64, total_bond: u64) -> u64 {
        if total_bond == 0 {
            return 0;
        }
        (total_reward as u128 * self.bond as u128 / total_bond as u128) as u64
    }
}
