use anchor_lang::prelude::*;

/// Report status
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum ReportStatus {
    #[default]
    Pending,
    Resolved,
}

/// Resolution outcome
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum ResolutionOutcome {
    #[default]
    None,
    Upheld,         // Content removed, creator slashed
    Dismissed,      // Report invalid, reporter loses bond
    NoParticipation, // No votes cast, all bonds returned
}

/// Report category
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum ReportCategory {
    #[default]
    Other,
    IllegalContent,
    Harassment,
    Spam,
    Misinformation,
    CopyrightViolation,
    AdultContent,
    Violence,
}

/// Content report (supports cumulative reporters)
#[account]
#[derive(Default)]
pub struct ContentReport {
    /// Protocol config
    pub config: Pubkey,

    /// Content identifier (could be PDA from external program)
    pub content: Pubkey,

    /// Creator being reported
    pub creator: Pubkey,

    /// Creator pool PDA
    pub creator_pool: Pubkey,

    /// Report category
    pub category: ReportCategory,

    /// Total bond from all reporters (cumulative)
    pub total_bond: u64,

    /// Amount held from creator pool
    pub creator_held: u64,

    /// Number of reporters who contributed
    pub reporter_count: u16,

    /// Report status
    pub status: ReportStatus,

    /// Resolution outcome
    pub outcome: ResolutionOutcome,

    /// Cumulative voting power for "Remove" votes (scaled)
    pub votes_remove_weight: u64,

    /// Cumulative voting power for "Keep" votes (scaled)
    pub votes_keep_weight: u64,

    /// Number of marshals who voted
    pub vote_count: u16,

    /// Voting end timestamp
    pub voting_ends_at: i64,

    /// Resolution timestamp
    pub resolved_at: i64,

    /// Bump seed for PDA
    pub bump: u8,

    /// Creation timestamp
    pub created_at: i64,
}

impl ContentReport {
    pub const LEN: usize = 8 +  // discriminator
        32 +    // config
        32 +    // content
        32 +    // creator
        32 +    // creator_pool
        1 +     // category
        8 +     // total_bond
        8 +     // creator_held
        2 +     // reporter_count
        1 +     // status
        1 +     // outcome
        8 +     // votes_remove_weight
        8 +     // votes_keep_weight
        2 +     // vote_count
        8 +     // voting_ends_at
        8 +     // resolved_at
        1 +     // bump
        8;      // created_at

    /// Check if voting period has ended
    pub fn is_voting_ended(&self, current_time: i64) -> bool {
        current_time >= self.voting_ends_at
    }

    /// Determine outcome based on votes
    pub fn determine_outcome(&self) -> ResolutionOutcome {
        let total_power = self.votes_remove_weight + self.votes_keep_weight;

        if total_power == 0 {
            // No votes cast
            ResolutionOutcome::NoParticipation
        } else if self.votes_remove_weight > total_power / 2 {
            // Majority voted to remove (>50%)
            ResolutionOutcome::Upheld
        } else {
            // Majority voted to keep or tied
            ResolutionOutcome::Dismissed
        }
    }
}
