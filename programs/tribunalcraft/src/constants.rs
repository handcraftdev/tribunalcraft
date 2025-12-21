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

/// Reputation precision: 6 decimals (100% = 100_000_000)
pub const REP_PRECISION: u64 = 1_000_000;
pub const REP_100_PERCENT: u64 = 100_000_000;

/// Initial reputation for new jurors/challengers (50%)
pub const INITIAL_REPUTATION: u64 = 50_000_000;

/// Reputation gain rate on correct vote (1%)
pub const REPUTATION_GAIN_RATE: u64 = 1_000_000;

/// Reputation loss rate on wrong vote (2%) - 1:2 ratio
pub const REPUTATION_LOSS_RATE: u64 = 2_000_000;

/// Reputation threshold below which stake is slashed on withdrawal (50%)
pub const SLASH_THRESHOLD: u64 = 50_000_000;

/// Minimum sigmoid multiplier floor (20%)
pub const MIN_SIGMOID_MULTIPLIER: u64 = 20_000_000;

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
pub const CHALLENGER_POOL_SEED: &[u8] = b"challenger_pool";
pub const JUROR_POOL_SEED: &[u8] = b"juror_pool";
pub const SUBJECT_SEED: &[u8] = b"subject";
pub const DISPUTE_SEED: &[u8] = b"dispute";
pub const ESCROW_SEED: &[u8] = b"escrow";
pub const CHALLENGER_RECORD_SEED: &[u8] = b"challenger_record";
pub const DEFENDER_RECORD_SEED: &[u8] = b"defender_record";
pub const JUROR_RECORD_SEED: &[u8] = b"juror_record";

// =============================================================================
// CLAIM AND SWEEP CONSTANTS
// =============================================================================

/// Grace period before creator can sweep (30 days in seconds)
pub const CLAIM_GRACE_PERIOD: i64 = 30 * 24 * 60 * 60;

/// Period after which anyone can sweep (90 days in seconds)
pub const TREASURY_SWEEP_PERIOD: i64 = 90 * 24 * 60 * 60;

/// Bot reward for treasury sweep (1% = 100 basis points)
pub const BOT_REWARD_BPS: u64 = 100;

// =============================================================================
// STACKED SIGMOID SYSTEM
// =============================================================================
//
// Formula: f(x) = max(0.2, 1/(1 + e^(-0.15(x-25))) + 1/(1 + e^(-0.15(x-75))))
//
// Two sigmoid curves stacked (added):
//   - Sigmoid 1: midpoint at 25%
//   - Sigmoid 2: midpoint at 75%
//   - Steepness k = 0.15
//   - Minimum floor = 20%
//
// Output range: 0.2 to 2.0 (scaled to 20_000_000 to 200_000_000)
//   - At 0% rep: 0.2 (floor)
//   - At 25% rep: ~0.5
//   - At 50% rep: ~1.0
//   - At 75% rep: ~1.5
//   - At 100% rep: ~2.0

/// Compute e^x approximation for x in range [-15, 0] using Taylor series
/// Returns result scaled by 1_000_000 (6 decimals)
fn exp_neg_approx(x_scaled: i64) -> u64 {
    // x_scaled is x * 1_000_000
    // For e^(-x) where x > 0, we use: e^(-x) = 1 / e^x
    // Taylor series for e^x: 1 + x + x²/2! + x³/3! + x⁴/4! + ...

    // Clamp to prevent overflow
    let x = if x_scaled > 15_000_000 { 15_000_000i64 } else { x_scaled };

    // We compute e^x then invert for e^(-x)
    // Using precomputed e^x values for efficiency
    // For x from 0 to 15, e^x ranges from 1 to ~3.3 million

    // Simplified: use lookup + interpolation for key points
    // e^0 = 1, e^1 = 2.718, e^2 = 7.389, e^3 = 20.09, e^5 = 148.4, e^10 = 22026

    // Scale factor for intermediate calculations
    const SCALE: i64 = 1_000_000;

    // For small |x|, use Taylor series (more accurate)
    if x < 3_000_000 {
        // e^x ≈ 1 + x + x²/2 + x³/6 + x⁴/24
        let x_f = x as i128;
        let x2 = x_f * x_f / SCALE as i128;
        let x3 = x2 * x_f / SCALE as i128;
        let x4 = x3 * x_f / SCALE as i128;

        let exp_x = SCALE as i128 + x_f + x2 / 2 + x3 / 6 + x4 / 24;

        // e^(-x) = SCALE² / e^x
        let result = (SCALE as i128 * SCALE as i128 / exp_x) as u64;
        return result;
    }

    // For larger x, use: e^(-x) ≈ e^(-3) * e^(-(x-3))
    // e^(-3) ≈ 0.0498 ≈ 49800 / 1_000_000
    let remainder = x - 3_000_000;
    let exp_neg_3: u64 = 49787; // e^(-3) * 1_000_000

    if remainder < 3_000_000 {
        let x_f = remainder as i128;
        let x2 = x_f * x_f / SCALE as i128;
        let exp_rem = SCALE as i128 + x_f + x2 / 2;
        let exp_neg_rem = (SCALE as i128 * SCALE as i128 / exp_rem) as u64;
        return exp_neg_3 * exp_neg_rem / SCALE as u64;
    }

    // For very large x (> 6), result is essentially 0
    if x > 10_000_000 {
        return 45; // e^(-10) ≈ 0.0000454
    }

    // e^(-6) ≈ 0.00248
    let exp_neg_6: u64 = 2479;
    let remainder2 = x - 6_000_000;
    let x_f = remainder2 as i128;
    let exp_rem = SCALE as i128 + x_f;
    let exp_neg_rem = (SCALE as i128 * SCALE as i128 / exp_rem) as u64;
    exp_neg_6 * exp_neg_rem / SCALE as u64
}

/// Single sigmoid: 1 / (1 + e^(-k(x - midpoint)))
/// Returns value scaled by REP_PRECISION (0 to 1_000_000 for 0.0 to 1.0)
fn sigmoid_single(x_percent: u64, midpoint: u64) -> u64 {
    // k = 0.15, but we work in scaled integers
    // k * (x - midpoint) where x and midpoint are in percent (0-100 scaled by 1_000_000)
    // k_scaled = 150_000 (0.15 * 1_000_000)

    const K_SCALED: i64 = 150_000; // 0.15 * 1_000_000
    const SCALE: u64 = 1_000_000;

    let x = x_percent as i64;
    let m = midpoint as i64;

    // exponent = -k * (x - m) / 1_000_000 (to get back to proper scale)
    // But we need it scaled for exp_neg_approx
    let diff = x - m; // in units of 1_000_000 = 1%
    let exponent = -K_SCALED * diff / 1_000_000; // result in units where 1_000_000 = 1

    if exponent > 15_000_000 {
        // Large positive exponent means e^exponent is huge, sigmoid ≈ 0
        return 0;
    }
    if exponent < -15_000_000 {
        // Large negative exponent means e^exponent ≈ 0, sigmoid ≈ 1
        return SCALE;
    }

    // sigmoid = 1 / (1 + e^exponent)
    // We need to compute e^exponent for the denominator
    let exp_val = if exponent >= 0 {
        // e^exponent where exponent >= 0 (large value)
        // exp_neg_approx gives e^(-x), so we invert: e^x = SCALE² / e^(-x)
        let exp_neg = exp_neg_approx(exponent);
        if exp_neg == 0 { return 0; }  // e^exponent is huge, sigmoid ≈ 0
        SCALE * SCALE / exp_neg
    } else {
        // e^exponent where exponent < 0 (small value, 0 to 1)
        // e^(-|exponent|) = exp_neg_approx(|exponent|)
        exp_neg_approx(-exponent)
    };

    // sigmoid = SCALE / (1 + exp_val / SCALE) = SCALE² / (SCALE + exp_val)
    let denominator = SCALE + exp_val;
    if denominator == 0 { return SCALE; }

    SCALE * SCALE / denominator
}

/// Stacked sigmoid multiplier for reputation changes
///
/// Formula: f(x) = max(0.2, 1/(1 + e^(-0.15(x-25))) + 1/(1 + e^(-0.15(x-75))))
///
/// Input: reputation (0 to REP_100_PERCENT = 100_000_000)
/// Output: multiplier (MIN_SIGMOID_MULTIPLIER to 200_000_000)
pub fn stacked_sigmoid(reputation: u64) -> u64 {
    // Convert reputation to percentage (0-100 scaled by 1_000_000)
    // reputation is 0 to 100_000_000, we need 0 to 100_000_000 (same scale works)
    let x_percent = reputation; // Already in right scale (1_000_000 = 1%)

    // Sigmoid 1: centered at 25% (25_000_000)
    let s1 = sigmoid_single(x_percent, 25_000_000);

    // Sigmoid 2: centered at 75% (75_000_000)
    let s2 = sigmoid_single(x_percent, 75_000_000);

    // Sum and scale: s1 + s2 gives 0-2 range (0 to 2_000_000)
    // We want output in same scale as reputation (multiply by 100)
    let raw = (s1 + s2) * 100;

    // Apply minimum floor
    raw.max(MIN_SIGMOID_MULTIPLIER)
}
