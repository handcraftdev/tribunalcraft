// =============================================================================
// PROTOCOL-LEVEL CONSTANTS (Non-configurable, core to protocol design)
// =============================================================================

// Precision for weight calculations
pub const WEIGHT_PRECISION: u64 = 1_000_000_000;    // 1e9

// Maximum basis points
pub const MAX_BPS: u16 = 10000;                     // 100%

// Minimum basis points (asymptotic floor)
pub const MIN_BPS: u16 = 1;                         // 0.01%

// Seeds for PDAs
pub const PROTOCOL_CONFIG_SEED: &[u8] = b"protocol_config";
pub const CREATOR_POOL_SEED: &[u8] = b"creator_pool";
pub const MARSHAL_ACCOUNT_SEED: &[u8] = b"marshal";
pub const REPORTER_ACCOUNT_SEED: &[u8] = b"reporter";
pub const CONTENT_REPORT_SEED: &[u8] = b"report";
pub const REPORTER_RECORD_SEED: &[u8] = b"reporter_record";
pub const VOTE_RECORD_SEED: &[u8] = b"vote";
pub const TREASURY_SEED: &[u8] = b"treasury";

// =============================================================================
// DEFAULT VALUES (Used when client doesn't specify, can be overridden)
// =============================================================================

pub mod defaults {
    // Stake minimums (in lamports)
    pub const MIN_CREATOR_POOL: u64 = 100_000_000;      // 0.1 SOL
    pub const MIN_MARSHAL_STAKE: u64 = 100_000_000;     // 0.1 SOL
    pub const BASE_REPORTER_BOND: u64 = 10_000_000;     // 0.01 SOL

    // Vote allocation (basis points)
    pub const MIN_VOTE_ALLOCATION_BPS: u16 = 1000;      // 10% of reporter bond

    // Time periods (seconds)
    pub const VOTING_PERIOD: i64 = 24 * 60 * 60;        // 1 day
    pub const STAKE_LOCK_PERIOD: i64 = 7 * 24 * 60 * 60; // 7 days

    // Reputation rates (basis points)
    pub const INITIAL_REPUTATION: u16 = 5000;           // 50%
    pub const REPUTATION_GAIN_RATE: u16 = 100;          // 1%
    pub const REPUTATION_LOSS_RATE: u16 = 300;          // 3%

    // S-curve zones (basis points)
    pub const GRACE_ZONE_LOW: u16 = 4000;               // 40%
    pub const GRACE_ZONE_HIGH: u16 = 6000;              // 60%
    pub const GRACE_ZONE_MULTIPLIER: u16 = 1000;        // 0.1x
    pub const EXTREME_ZONE_LOW: u16 = 2500;             // 25%
    pub const EXTREME_ZONE_HIGH: u16 = 7500;            // 75%
    pub const EXTREME_ZONE_MULTIPLIER: u16 = 3000;      // 0.3x
    pub const NORMAL_ZONE_MULTIPLIER: u16 = 10000;      // 1.0x

    // Reward distribution (basis points)
    pub const REPORTER_REWARD_BPS: u16 = 5000;          // 50%

    // Slashing threshold (basis points)
    pub const SLASH_THRESHOLD: u16 = 5000;              // 50%
}
