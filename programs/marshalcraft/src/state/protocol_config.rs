use anchor_lang::prelude::*;

/// Protocol configuration deployed by each client
/// All parameters are customizable at initialization
#[account]
#[derive(Default)]
pub struct ProtocolConfig {
    /// Authority that can update config (client admin)
    pub authority: Pubkey,

    /// Treasury account for slashed funds
    pub treasury: Pubkey,

    /// Whether the protocol is paused
    pub is_paused: bool,

    // =========================================================================
    // Stake Requirements
    // =========================================================================

    /// Minimum creator pool stake (lamports)
    pub min_creator_pool: u64,

    /// Minimum marshal stake (lamports)
    pub min_marshal_stake: u64,

    /// Base reporter bond before reputation multiplier (lamports)
    pub base_reporter_bond: u64,

    /// Minimum vote allocation as basis points of reporter bond
    pub min_vote_allocation_bps: u16,

    // =========================================================================
    // Time Periods
    // =========================================================================

    /// Voting period in seconds
    pub voting_period: i64,

    /// Stake lock period in seconds
    pub stake_lock_period: i64,

    // =========================================================================
    // Reputation Configuration
    // =========================================================================

    /// Initial reputation for new marshals/reporters (basis points)
    pub initial_reputation: u16,

    /// Reputation gain rate (basis points of remaining)
    pub reputation_gain_rate: u16,

    /// Reputation loss rate (basis points of current)
    pub reputation_loss_rate: u16,

    // =========================================================================
    // S-Curve Configuration
    // =========================================================================

    /// Grace zone lower bound (basis points)
    pub grace_zone_low: u16,

    /// Grace zone upper bound (basis points)
    pub grace_zone_high: u16,

    /// Grace zone multiplier (basis points, 1000 = 0.1x)
    pub grace_zone_multiplier: u16,

    /// Extreme zone lower bound (basis points)
    pub extreme_zone_low: u16,

    /// Extreme zone upper bound (basis points)
    pub extreme_zone_high: u16,

    /// Extreme zone multiplier (basis points, 3000 = 0.3x)
    pub extreme_zone_multiplier: u16,

    /// Normal zone multiplier (basis points, 10000 = 1.0x)
    pub normal_zone_multiplier: u16,

    // =========================================================================
    // Reward Distribution
    // =========================================================================

    /// Reporter reward percentage (basis points)
    pub reporter_reward_bps: u16,

    // =========================================================================
    // Slashing Configuration
    // =========================================================================

    /// Reputation threshold below which stake is slashed on withdrawal (basis points)
    pub slash_threshold: u16,

    // =========================================================================
    // Metadata
    // =========================================================================

    /// Protocol version
    pub version: u8,

    /// Bump seed for PDA
    pub bump: u8,

    /// Creation timestamp
    pub created_at: i64,

    /// Last update timestamp
    pub updated_at: i64,
}

impl ProtocolConfig {
    pub const LEN: usize = 8 +  // discriminator
        32 +    // authority
        32 +    // treasury
        1 +     // is_paused
        8 +     // min_creator_pool
        8 +     // min_marshal_stake
        8 +     // base_reporter_bond
        2 +     // min_vote_allocation_bps
        8 +     // voting_period
        8 +     // stake_lock_period
        2 +     // initial_reputation
        2 +     // reputation_gain_rate
        2 +     // reputation_loss_rate
        2 +     // grace_zone_low
        2 +     // grace_zone_high
        2 +     // grace_zone_multiplier
        2 +     // extreme_zone_low
        2 +     // extreme_zone_high
        2 +     // extreme_zone_multiplier
        2 +     // normal_zone_multiplier
        2 +     // reporter_reward_bps
        2 +     // slash_threshold
        1 +     // version
        1 +     // bump
        8 +     // created_at
        8;      // updated_at
}

/// Input parameters for initializing protocol config
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct ProtocolConfigParams {
    pub min_creator_pool: Option<u64>,
    pub min_marshal_stake: Option<u64>,
    pub base_reporter_bond: Option<u64>,
    pub min_vote_allocation_bps: Option<u16>,
    pub voting_period: Option<i64>,
    pub stake_lock_period: Option<i64>,
    pub initial_reputation: Option<u16>,
    pub reputation_gain_rate: Option<u16>,
    pub reputation_loss_rate: Option<u16>,
    pub grace_zone_low: Option<u16>,
    pub grace_zone_high: Option<u16>,
    pub grace_zone_multiplier: Option<u16>,
    pub extreme_zone_low: Option<u16>,
    pub extreme_zone_high: Option<u16>,
    pub extreme_zone_multiplier: Option<u16>,
    pub normal_zone_multiplier: Option<u16>,
    pub reporter_reward_bps: Option<u16>,
    pub slash_threshold: Option<u16>,
}
