use anchor_lang::prelude::*;
use crate::state::dispute::ResolutionOutcome;

/// Result data for a completed round, stored in Escrow
/// Used for claim calculations after resolution
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct RoundResult {
    /// Round number
    pub round: u32,

    /// Dispute creator (for rent refund on last claim or sweep)
    pub creator: Pubkey,

    /// Resolution timestamp (for grace period calculation)
    pub resolved_at: i64,

    /// Resolution outcome
    pub outcome: ResolutionOutcome,

    /// Total stake from challengers
    pub total_stake: u64,

    /// Bond at risk from defenders
    pub bond_at_risk: u64,

    /// Safe bond (available_bond - bond_at_risk) returned to defenders
    pub safe_bond: u64,

    /// Total voting power cast
    pub total_vote_weight: u64,

    /// Winner pool amount (80%)
    pub winner_pool: u64,

    /// Juror pool amount (19%)
    pub juror_pool: u64,

    // =========================================================================
    // Participant counts (set at resolution)
    // =========================================================================

    /// Number of defenders
    pub defender_count: u16,

    /// Number of challengers
    pub challenger_count: u16,

    /// Number of jurors
    pub juror_count: u16,

    // =========================================================================
    // Claim tracking
    // =========================================================================

    /// Number of defenders who have claimed
    pub defender_claims: u16,

    /// Number of challengers who have claimed
    pub challenger_claims: u16,

    /// Number of jurors who have claimed
    pub juror_claims: u16,
}

impl RoundResult {
    /// Size of a single RoundResult
    pub const LEN: usize =
        4 +     // round
        32 +    // creator
        8 +     // resolved_at
        1 +     // outcome
        8 +     // total_stake
        8 +     // bond_at_risk
        8 +     // safe_bond
        8 +     // total_vote_weight
        8 +     // winner_pool
        8 +     // juror_pool
        2 +     // defender_count
        2 +     // challenger_count
        2 +     // juror_count
        2 +     // defender_claims
        2 +     // challenger_claims
        2;      // juror_claims

    /// Check if this round is a restoration (bond_at_risk == 0 means restoration)
    pub fn is_restore(&self) -> bool {
        self.bond_at_risk == 0 && self.total_stake > 0
    }

    /// Check if all participants have claimed
    pub fn is_fully_claimed(&self) -> bool {
        self.defender_claims == self.defender_count &&
        self.challenger_claims == self.challenger_count &&
        self.juror_claims == self.juror_count
    }

    /// Calculate unclaimed amount
    pub fn calculate_unclaimed(&self) -> u64 {
        // If all claimed, nothing unclaimed
        if self.is_fully_claimed() {
            return 0;
        }

        // Calculate what remains based on outcome and claim state
        // This is a simplified calculation - actual implementation may need more detail
        let mut unclaimed = 0u64;

        // Unclaimed winner pool
        match self.outcome {
            ResolutionOutcome::ChallengerWins => {
                // Challengers are winners
                let claimed_ratio = if self.challenger_count > 0 {
                    self.challenger_claims as u64 * 10000 / self.challenger_count as u64
                } else {
                    10000
                };
                unclaimed += self.winner_pool * (10000 - claimed_ratio) / 10000;
            }
            ResolutionOutcome::DefenderWins => {
                // Defenders are winners
                let claimed_ratio = if self.defender_count > 0 {
                    self.defender_claims as u64 * 10000 / self.defender_count as u64
                } else {
                    10000
                };
                unclaimed += self.winner_pool * (10000 - claimed_ratio) / 10000;
            }
            _ => {}
        }

        // Unclaimed juror pool
        let juror_claimed_ratio = if self.juror_count > 0 {
            self.juror_claims as u64 * 10000 / self.juror_count as u64
        } else {
            10000
        };
        unclaimed += self.juror_pool * (10000 - juror_claimed_ratio) / 10000;

        // Unclaimed safe bond (defenders always get this regardless of outcome)
        let defender_claimed_ratio = if self.defender_count > 0 {
            self.defender_claims as u64 * 10000 / self.defender_count as u64
        } else {
            10000
        };
        unclaimed += self.safe_bond * (10000 - defender_claimed_ratio) / 10000;

        unclaimed
    }
}

/// Escrow account - holds funds for claims across rounds
/// Seeds: [ESCROW_SEED, subject_id]
/// Persistent PDA - created once, reused
#[account]
#[derive(Default)]
pub struct Escrow {
    /// Subject this escrow belongs to
    pub subject_id: Pubkey,

    /// Current balance available for claims
    pub balance: u64,

    /// Historical round results for claims
    /// Vec grows with realloc on dispute creation, shrinks on last claim
    pub rounds: Vec<RoundResult>,

    /// Bump seed for PDA
    pub bump: u8,
}

impl Escrow {
    /// Base size without Vec data
    pub const BASE_LEN: usize = 8 +  // discriminator
        32 +    // subject_id
        8 +     // balance
        4 +     // rounds vec length prefix
        1;      // bump

    /// Calculate size for N round results
    pub fn size_for_rounds(n: usize) -> usize {
        Self::BASE_LEN + (n * RoundResult::LEN)
    }

    /// Find round result by round number
    pub fn find_round(&self, round: u32) -> Option<&RoundResult> {
        self.rounds.iter().find(|r| r.round == round)
    }

    /// Find mutable round result by round number
    pub fn find_round_mut(&mut self, round: u32) -> Option<&mut RoundResult> {
        self.rounds.iter_mut().find(|r| r.round == round)
    }

    /// Remove a round result (for compaction)
    pub fn remove_round(&mut self, round: u32) -> Option<RoundResult> {
        if let Some(idx) = self.rounds.iter().position(|r| r.round == round) {
            Some(self.rounds.remove(idx))
        } else {
            None
        }
    }

    /// Add a new round result
    pub fn add_round(&mut self, result: RoundResult) {
        self.rounds.push(result);
    }
}
