// =============================================================================
// PROTOCOL-LEVEL CONSTANTS (Non-configurable, core to protocol design)
// =============================================================================

// Precision for weight calculations
pub const WEIGHT_PRECISION: u64 = 1_000_000_000;    // 1e9

// Maximum basis points
pub const MAX_BPS: u16 = 10000;                     // 100%

// =============================================================================
// REPUTATION SYSTEM CONSTANTS (Fixed by protocol design)
// =============================================================================

/// Initial reputation for new jurors/challengers (50% = 5000 bps)
pub const INITIAL_REPUTATION: u16 = 5000;

/// Reputation gain rate on correct vote (5% of remaining = 500 bps)
pub const REPUTATION_GAIN_RATE: u16 = 500;

/// Reputation loss rate on wrong vote (10% of current = 1000 bps)
pub const REPUTATION_LOSS_RATE: u16 = 1000;

/// Reputation threshold below which stake is slashed on withdrawal (50% = 5000 bps)
pub const SLASH_THRESHOLD: u16 = 5000;

// =============================================================================
// STAKE UNLOCK BUFFER (Fixed by protocol design)
// =============================================================================

/// Buffer period after voting ends before stake unlocks (7 days)
/// This gives time for resolution and result processing
pub const STAKE_UNLOCK_BUFFER: i64 = 604_800;

// =============================================================================
// BASE CHALLENGER BOND (Minimum for reputation calculation)
// =============================================================================

/// Base challenger bond for reputation-based multiplier calculation (0.01 SOL)
/// This is the base amount used to calculate minimum bond based on challenger reputation
/// Platform can enforce higher requirements at application layer
pub const BASE_CHALLENGER_BOND: u64 = 10_000_000;

// =============================================================================
// FIXED FEE CONSTANTS (Protocol-wide, non-configurable)
// =============================================================================

/// Total fee from combined pool (20% = 2000 bps)
/// Fee is collected from defender stake + challenger bond combined
pub const TOTAL_FEE_BPS: u16 = 2000;

/// Platform share of fees (5% of fees = 1% of total pool = 500 bps of fees)
pub const PLATFORM_SHARE_BPS: u16 = 500;

/// Juror share of fees (95% of fees = 19% of total pool = 9500 bps of fees)
pub const JUROR_SHARE_BPS: u16 = 9500;

/// Winner share of loser's contribution (80% = 8000 bps)
pub const WINNER_SHARE_BPS: u16 = 8000;

// =============================================================================
// PDA SEEDS (Global - no config dependency)
// =============================================================================

pub const PROTOCOL_CONFIG_SEED: &[u8] = b"protocol_config";
pub const DEFENDER_POOL_SEED: &[u8] = b"defender_pool";
pub const SUBJECT_SEED: &[u8] = b"subject";
pub const JUROR_ACCOUNT_SEED: &[u8] = b"juror";
pub const CHALLENGER_ACCOUNT_SEED: &[u8] = b"challenger";
pub const DISPUTE_SEED: &[u8] = b"dispute";
pub const DISPUTE_ESCROW_SEED: &[u8] = b"escrow";
pub const CHALLENGER_RECORD_SEED: &[u8] = b"challenger_record";
pub const DEFENDER_RECORD_SEED: &[u8] = b"defender_record";
pub const VOTE_RECORD_SEED: &[u8] = b"vote";

// =============================================================================
// STACKED SIGMOID SYSTEM (Two sigmoids added together)
// =============================================================================
//
// Two sigmoid curves stacked (added):
//   - Sigmoid 1: midpoint at 25%, transition 15-35%
//   - Sigmoid 2: midpoint at 75%, transition 65-85%
//
// Output range: 0 to 10000 (0% to 100%)
//   - At 0% rep: ~0
//   - At 25% rep: ~2500 (25%)
//   - At 50% rep: ~5000 (50%)
//   - At 75% rep: ~7500 (75%)
//   - At 100% rep: ~10000 (100%)
//
// Formula: f(x) = (σ(x, m=25%) + σ(x, m=75%)) / 2
// Uses smoothstep as sigmoid approximation: 3x² - 2x³

/// Sigmoid approximation using smoothstep
/// Transitions smoothly from 0 to 5000 around the midpoint
///
/// - midpoint: center of transition (basis points)
/// - width: width of transition zone (basis points)
fn sigmoid(x: u16, midpoint: u16, width: u16) -> u16 {
    let half_width = width / 2;
    let start = midpoint.saturating_sub(half_width);
    let end = midpoint.saturating_add(half_width);

    if x <= start {
        return 0;
    }
    if x >= end {
        return 5000;
    }

    // Normalize to 0-10000 range within transition zone
    let range = end - start;
    let normalized = ((x - start) as u64 * 10000 / range as u64) as u16;

    // Apply smoothstep: 3x² - 2x³, scaled to 0-5000
    let n = normalized as u64;
    ((n * n * (30000 - 2 * n)) / 200_000_000) as u16
}

/// Stacked sigmoid multiplier for reputation changes
///
/// Two sigmoids added together:
///   - Sigmoid 1: midpoint=25% (2500), width=20% (2000)
///   - Sigmoid 2: midpoint=75% (7500), width=20% (2000)
///
/// Output: 0-10000 (0% to 100%)
///   - rep=0%: ~0
///   - rep=25%: ~2500 (25%)
///   - rep=50%: ~5000 (50%)
///   - rep=75%: ~7500 (75%)
///   - rep=100%: ~10000 (100%)
pub fn stacked_sigmoid(reputation: u16) -> u16 {
    // Sigmoid 1: centered at 25%
    let s1 = sigmoid(reputation, 2500, 2000);

    // Sigmoid 2: centered at 75%
    let s2 = sigmoid(reputation, 7500, 2000);

    // Sum of both sigmoids (max 10000)
    s1.saturating_add(s2)
}
