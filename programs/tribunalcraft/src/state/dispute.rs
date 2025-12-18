use anchor_lang::prelude::*;

/// Dispute status
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum DisputeStatus {
    #[default]
    Pending,
    Resolved,
}

/// Resolution outcome
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum ResolutionOutcome {
    #[default]
    None,
    ChallengerWins,  // Dispute valid, defender slashed
    DefenderWins,    // Dispute invalid, challenger loses bond
    NoParticipation, // No votes cast, all bonds returned
}

/// Dispute type (generic categories)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum DisputeType {
    #[default]
    Other,
    Breach,           // Contract/agreement breach
    Fraud,            // Fraudulent behavior
    QualityDispute,   // Quality of deliverable
    NonDelivery,      // Failure to deliver
    Misrepresentation, // False claims
    PolicyViolation,  // Platform policy violation
    DamagesClaim,     // Claim for damages
}

/// Dispute (supports cumulative challengers)
#[account]
#[derive(Default)]
pub struct Dispute {
    /// Subject account being disputed
    pub subject: Pubkey,

    /// Dispute type
    pub dispute_type: DisputeType,

    /// Total bond from all challengers (cumulative)
    pub total_bond: u64,

    /// Stake held from pool (match mode, linked subjects)
    pub stake_held: u64,

    /// Stake held from direct stakers on subject (match mode)
    pub direct_stake_held: u64,

    /// Number of challengers who contributed
    pub challenger_count: u16,

    /// Dispute status
    pub status: DisputeStatus,

    /// Resolution outcome
    pub outcome: ResolutionOutcome,

    /// Cumulative voting power for "ForChallenger" votes
    pub votes_favor_weight: u64,

    /// Cumulative voting power for "ForDefender" votes
    pub votes_against_weight: u64,

    /// Number of jurors who voted
    pub vote_count: u16,

    /// Whether voting has started (match mode waits for matching)
    pub voting_started: bool,

    /// Voting start timestamp (0 if not started)
    pub voting_starts_at: i64,

    /// Voting end timestamp (0 if not started)
    pub voting_ends_at: i64,

    /// Resolution timestamp
    pub resolved_at: i64,

    /// Bump seed for PDA
    pub bump: u8,

    /// Creation timestamp
    pub created_at: i64,

    /// Pool reward claimed (for linked mode)
    pub pool_reward_claimed: bool,

    // =========================================================================
    // Snapshot fields (captured at dispute creation for historical record)
    // =========================================================================

    /// Snapshot of subject's total_stake at dispute creation
    pub snapshot_total_stake: u64,

    /// Snapshot of subject's defender_count at dispute creation
    pub snapshot_defender_count: u16,

    // =========================================================================
    // Claim tracking
    // =========================================================================

    /// Number of challengers who have claimed their reward/refund
    pub challengers_claimed: u16,

    /// Number of direct defenders who have claimed their reward/refund
    pub defenders_claimed: u16,

    // =========================================================================
    // Restoration fields
    // =========================================================================

    /// True if this dispute is a restoration request (reverses the meaning of outcomes)
    pub is_restore: bool,

    /// Stake posted by restorer (for restorations only)
    pub restore_stake: u64,

    /// Restorer's pubkey (for restorations only, used for refunds)
    pub restorer: Pubkey,

    /// Details CID for restoration requests (stored here since no ChallengerRecord)
    pub details_cid: String,
}

impl Dispute {
    pub const MAX_CID_LEN: usize = 64;

    pub const LEN: usize = 8 +  // discriminator
        32 +    // subject
        1 +     // dispute_type
        8 +     // total_bond
        8 +     // stake_held
        8 +     // direct_stake_held
        2 +     // challenger_count
        1 +     // status
        1 +     // outcome
        8 +     // votes_favor_weight
        8 +     // votes_against_weight
        2 +     // vote_count
        1 +     // voting_started
        8 +     // voting_starts_at
        8 +     // voting_ends_at
        8 +     // resolved_at
        1 +     // bump
        8 +     // created_at
        1 +     // pool_reward_claimed
        8 +     // snapshot_total_stake
        2 +     // snapshot_defender_count
        2 +     // challengers_claimed
        2 +     // defenders_claimed
        1 +     // is_restore
        8 +     // restore_stake
        32 +    // restorer
        4 + Self::MAX_CID_LEN; // details_cid (string with length prefix)

    /// Total stake held from all sources (pool + direct)
    pub fn total_stake_held(&self) -> u64 {
        self.stake_held + self.direct_stake_held
    }

    /// Check if matching condition is met (stake >= bond)
    pub fn is_matched(&self) -> bool {
        self.total_stake_held() >= self.total_bond
    }

    /// Start voting period (called when match condition met or immediately for proportional)
    pub fn start_voting(&mut self, current_time: i64, voting_period: i64) {
        self.voting_started = true;
        self.voting_starts_at = current_time;
        self.voting_ends_at = current_time + voting_period;
    }

    /// Check if voting period has ended
    pub fn is_voting_ended(&self, current_time: i64) -> bool {
        self.voting_started && current_time >= self.voting_ends_at
    }

    /// Check if voting is active (started but not ended)
    pub fn is_voting_active(&self, current_time: i64) -> bool {
        self.voting_started && current_time < self.voting_ends_at
    }

    /// Determine outcome based on votes
    pub fn determine_outcome(&self) -> ResolutionOutcome {
        let total_power = self.votes_favor_weight + self.votes_against_weight;

        if total_power == 0 {
            // No votes cast
            ResolutionOutcome::NoParticipation
        } else if self.votes_favor_weight > total_power / 2 {
            // Majority voted for challenger (>50%)
            ResolutionOutcome::ChallengerWins
        } else {
            // Majority voted for defender or tied
            ResolutionOutcome::DefenderWins
        }
    }
}
