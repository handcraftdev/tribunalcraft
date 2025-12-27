use anchor_lang::prelude::*;

/// Dispute status
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum DisputeStatus {
    #[default]
    None,       // No active dispute
    Pending,    // Voting in progress
    Resolved,   // Outcome determined (temporary state during claim processing)
}

/// Resolution outcome
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default, Debug)]
pub enum ResolutionOutcome {
    #[default]
    None,
    ChallengerWins,  // Dispute valid, defender slashed
    DefenderWins,    // Dispute invalid, challenger loses stake
    NoParticipation, // No votes cast, all funds returned (minus fees)
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

/// Dispute - Persistent PDA, reset after each round
/// Seeds: [DISPUTE_SEED, subject_id]
#[account]
#[derive(Default)]
pub struct Dispute {
    /// Subject being disputed (subject_id, not Subject PDA)
    pub subject_id: Pubkey,

    /// Which round this dispute is for
    pub round: u32,

    /// Dispute status
    pub status: DisputeStatus,

    /// Dispute type
    pub dispute_type: DisputeType,

    // =========================================================================
    // Challenger side
    // =========================================================================

    /// Total stake from all challengers
    pub total_stake: u64,

    /// Number of challengers
    pub challenger_count: u16,

    // =========================================================================
    // Defender side
    // =========================================================================

    /// Bond at risk (calculated based on mode)
    /// Match: min(total_stake, available_bond)
    /// Prop: available_bond
    pub bond_at_risk: u64,

    /// Number of defenders (snapshot at dispute creation, updated if new defenders join)
    pub defender_count: u16,

    // =========================================================================
    // Voting
    // =========================================================================

    /// Cumulative voting power for challenger
    pub votes_for_challenger: u64,

    /// Cumulative voting power for defender
    pub votes_for_defender: u64,

    /// Number of jurors who voted
    pub vote_count: u16,

    /// Voting start timestamp
    pub voting_starts_at: i64,

    /// Voting end timestamp
    pub voting_ends_at: i64,

    // =========================================================================
    // Resolution
    // =========================================================================

    /// Resolution outcome
    pub outcome: ResolutionOutcome,

    /// Resolution timestamp
    pub resolved_at: i64,

    // =========================================================================
    // Restoration fields
    // =========================================================================

    /// True if this dispute is a restoration request
    pub is_restore: bool,

    /// Stake posted by restorer (for restorations only)
    pub restore_stake: u64,

    /// Restorer's pubkey (for restorations only)
    pub restorer: Pubkey,

    // =========================================================================
    // Metadata
    // =========================================================================

    /// Details CID (IPFS hash for dispute details)
    pub details_cid: String,

    /// Bump seed for PDA
    pub bump: u8,

    /// Creation timestamp
    pub created_at: i64,
}

impl Dispute {
    pub const MAX_CID_LEN: usize = 64;

    pub const LEN: usize = 8 +  // discriminator
        32 +    // subject_id
        4 +     // round
        1 +     // status
        1 +     // dispute_type
        8 +     // total_stake
        2 +     // challenger_count
        8 +     // bond_at_risk
        2 +     // defender_count
        8 +     // votes_for_challenger
        8 +     // votes_for_defender
        2 +     // vote_count
        8 +     // voting_starts_at
        8 +     // voting_ends_at
        1 +     // outcome
        8 +     // resolved_at
        1 +     // is_restore
        8 +     // restore_stake
        32 +    // restorer
        4 + Self::MAX_CID_LEN + // details_cid (string with length prefix)
        1 +     // bump
        8;      // created_at

    /// Start voting period
    pub fn start_voting(&mut self, current_time: i64, voting_period: i64) {
        self.voting_starts_at = current_time;
        self.voting_ends_at = current_time + voting_period;
    }

    /// Check if voting period has ended
    pub fn is_voting_ended(&self, current_time: i64) -> bool {
        self.status == DisputeStatus::Pending && current_time >= self.voting_ends_at
    }

    /// Check if voting is active (started but not ended)
    pub fn is_voting_active(&self, current_time: i64) -> bool {
        self.status == DisputeStatus::Pending && current_time < self.voting_ends_at
    }

    /// Determine outcome based on votes
    pub fn determine_outcome(&self) -> ResolutionOutcome {
        let total_power = self.votes_for_challenger + self.votes_for_defender;

        if total_power == 0 {
            // No votes cast
            ResolutionOutcome::NoParticipation
        } else if self.votes_for_challenger > total_power / 2 {
            // Majority voted for challenger (>50%)
            ResolutionOutcome::ChallengerWins
        } else {
            // Majority voted for defender or tied
            ResolutionOutcome::DefenderWins
        }
    }

    /// Reset dispute for next round
    pub fn reset(&mut self) {
        self.round = 0;
        self.status = DisputeStatus::None;
        self.dispute_type = DisputeType::Other;
        self.total_stake = 0;
        self.challenger_count = 0;
        self.bond_at_risk = 0;
        self.defender_count = 0;
        self.votes_for_challenger = 0;
        self.votes_for_defender = 0;
        self.vote_count = 0;
        self.voting_starts_at = 0;
        self.voting_ends_at = 0;
        self.outcome = ResolutionOutcome::None;
        self.resolved_at = 0;
        self.is_restore = false;
        self.restore_stake = 0;
        self.restorer = Pubkey::default();
        self.details_cid = String::new();
    }
}
