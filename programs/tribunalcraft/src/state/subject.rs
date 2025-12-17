use anchor_lang::prelude::*;

/// Subject status
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum SubjectStatus {
    #[default]
    Active,      // Can be staked on and disputed
    Disputed,    // Currently has an active dispute
    Invalidated, // Dispute upheld, challengers won (terminal)
}

/// Subject that defenders back - global (identified by subject_id)
#[account]
#[derive(Default)]
pub struct Subject {
    /// Subject identifier (could be PDA from external program)
    pub subject_id: Pubkey,

    /// Optional defender pool (default = standalone mode, set = linked to pool)
    pub defender_pool: Pubkey,

    /// Details/metadata CID (IPFS/Arweave) - context provided by first staker
    pub details_cid: String,

    /// Current status
    pub status: SubjectStatus,

    /// Total stake backing this subject (standalone mode only)
    pub total_stake: u64,

    /// Max stake at risk per dispute (for match mode)
    pub max_stake: u64,

    /// Voting period in seconds for this subject's disputes
    pub voting_period: i64,

    /// Number of defenders (standalone mode only)
    pub defender_count: u16,

    /// Number of disputes (for sequential dispute PDAs)
    pub dispute_count: u32,

    /// Match mode: true = bond must match stake, false = proportionate
    pub match_mode: bool,

    /// Free case mode: no stake/bond required, no rewards, no reputation impact
    pub free_case: bool,

    /// Current active dispute (if any)
    pub dispute: Pubkey,

    /// Bump seed for PDA
    pub bump: u8,

    /// Creation timestamp
    pub created_at: i64,

    /// Last update timestamp
    pub updated_at: i64,

    // =========================================================================
    // Appeal tracking fields
    // =========================================================================

    /// Previous dispute's (stake + bond) - minimum stake required for appeal
    pub last_dispute_total: u64,

    /// Previous dispute's voting period - appeals use 2x this value
    pub last_voting_period: i64,
}

impl Subject {
    pub const LEN: usize = 8 +  // discriminator
        32 +    // subject_id
        32 +    // defender_pool
        (4 + 64) + // details_cid (String: 4 byte length + 64 byte content)
        1 +     // status
        8 +     // total_stake
        8 +     // max_stake
        8 +     // voting_period
        2 +     // defender_count
        4 +     // dispute_count
        1 +     // match_mode
        1 +     // free_case
        32 +    // dispute
        1 +     // bump
        8 +     // created_at
        8 +     // updated_at
        8 +     // last_dispute_total
        8;      // last_voting_period

    /// Check if subject is linked to a pool (vs standalone)
    pub fn is_linked(&self) -> bool {
        self.defender_pool != Pubkey::default()
    }

    /// Check if subject can accept new stakes (both standalone and linked)
    /// Invalidated is terminal - no more staking allowed
    pub fn can_stake(&self) -> bool {
        matches!(self.status, SubjectStatus::Active | SubjectStatus::Disputed)
    }

    /// Check if subject can be disputed (original dispute on active subjects)
    pub fn can_dispute(&self) -> bool {
        self.status == SubjectStatus::Active
    }

    /// Check if subject can be appealed (after being invalidated)
    pub fn can_appeal(&self) -> bool {
        self.status == SubjectStatus::Invalidated
    }

    /// Check if there's an active dispute
    pub fn has_active_dispute(&self) -> bool {
        self.status == SubjectStatus::Disputed && self.dispute != Pubkey::default()
    }

    /// Get the voting period for an appeal (2x previous)
    pub fn appeal_voting_period(&self) -> i64 {
        self.last_voting_period.saturating_mul(2)
    }

    /// Get minimum stake required for appeal
    pub fn min_appeal_stake(&self) -> u64 {
        self.last_dispute_total
    }
}
