use anchor_lang::prelude::*;

/// Subject status
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum SubjectStatus {
    #[default]
    Dormant,     // No bond, waiting for defenders
    Valid,       // Has bond, can be disputed
    Disputed,    // Currently has an active dispute
    Invalid,     // Dispute upheld, challengers won
    Restoring,   // Currently has an active restoration request
}

/// Subject that defenders back - identified by subject_id
/// Persistent PDA - created once, reused across rounds
#[account]
#[derive(Default)]
pub struct Subject {
    /// Subject identifier (could be PDA from external program)
    pub subject_id: Pubkey,

    /// Creator of this subject (for auto-bond on reset)
    pub creator: Pubkey,

    /// Content CID (IPFS hash for subject details)
    pub details_cid: String,

    /// Current round counter (0, 1, 2, ...)
    pub round: u32,

    /// Total bond available for current round
    pub available_bond: u64,

    /// Number of defenders in current round
    pub defender_count: u16,

    /// Current status
    pub status: SubjectStatus,

    /// Match mode: true = bond_at_risk matches stake, false = proportionate (all bond at risk)
    pub match_mode: bool,

    /// Voting period in seconds for this subject's disputes
    pub voting_period: i64,

    /// Current active dispute (if any)
    pub dispute: Pubkey,

    /// Bump seed for PDA
    pub bump: u8,

    /// Creation timestamp
    pub created_at: i64,

    /// Last update timestamp
    pub updated_at: i64,

    // =========================================================================
    // Restoration tracking fields
    // =========================================================================

    /// Previous dispute's (stake + bond) - minimum stake required for restoration
    pub last_dispute_total: u64,

    /// Previous dispute's voting period - restorations use 2x this value
    pub last_voting_period: i64,
}

impl Subject {
    pub const MAX_CID_LEN: usize = 64; // IPFS CID v1 is typically 59 chars

    pub const LEN: usize = 8 +  // discriminator
        32 +    // subject_id
        32 +    // creator
        4 + Self::MAX_CID_LEN + // details_cid (string with length prefix)
        4 +     // round
        8 +     // available_bond
        2 +     // defender_count
        1 +     // status
        1 +     // match_mode
        8 +     // voting_period
        32 +    // dispute
        1 +     // bump
        8 +     // created_at
        8 +     // updated_at
        8 +     // last_dispute_total
        8;      // last_voting_period

    /// Check if subject can accept new bonds
    /// Invalid is terminal - no more bonding allowed
    /// Dormant can be revived by bonding
    /// Disputed allows proportional bonding
    /// Restoring doesn't accept bonds
    pub fn can_bond(&self) -> bool {
        matches!(self.status, SubjectStatus::Valid | SubjectStatus::Disputed | SubjectStatus::Dormant)
    }

    /// Check if subject can be disputed (only valid subjects with bond)
    /// Dormant subjects cannot be disputed - need bond first
    pub fn can_dispute(&self) -> bool {
        self.status == SubjectStatus::Valid
    }

    /// Check if subject can be restored (after being invalid)
    pub fn can_restore(&self) -> bool {
        self.status == SubjectStatus::Invalid
    }

    /// Check if there's an active dispute or restoration
    pub fn has_active_dispute(&self) -> bool {
        matches!(self.status, SubjectStatus::Disputed | SubjectStatus::Restoring) && self.dispute != Pubkey::default()
    }

    /// Get the voting period for a restoration (2x previous)
    pub fn restore_voting_period(&self) -> i64 {
        self.last_voting_period.saturating_mul(2)
    }

    /// Get minimum stake required for restoration
    pub fn min_restore_stake(&self) -> u64 {
        self.last_dispute_total
    }

    /// Reset subject for next round (called during resolution)
    pub fn reset_for_next_round(&mut self) {
        self.round += 1;
        self.available_bond = 0;
        self.defender_count = 0;
        self.status = SubjectStatus::Dormant;
        self.dispute = Pubkey::default();
    }
}
