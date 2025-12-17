use anchor_lang::prelude::*;

/// Vote choice
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default, Debug)]
pub enum VoteChoice {
    #[default]
    Uphold,   // Favor the challenger (dispute is valid)
    Dismiss,  // Favor the respondent (dispute is invalid)
}

/// Juror's vote on a dispute
#[account]
#[derive(Default)]
pub struct VoteRecord {
    /// The dispute being voted on
    pub dispute: Pubkey,

    /// Juror who cast the vote
    pub juror: Pubkey,

    /// Juror account PDA
    pub juror_account: Pubkey,

    /// Vote choice
    pub choice: VoteChoice,

    /// Stake allocated to this vote
    pub stake_allocated: u64,

    /// Calculated voting power (scaled by WEIGHT_PRECISION)
    pub voting_power: u64,

    /// When the stake unlocks
    pub unlock_at: i64,

    /// Whether reputation has been processed after resolution
    pub reputation_processed: bool,

    /// Whether reward has been claimed
    pub reward_claimed: bool,

    /// Whether stake has been unlocked/returned
    pub stake_unlocked: bool,

    /// Bump seed for PDA
    pub bump: u8,

    /// Vote timestamp
    pub voted_at: i64,

    /// IPFS CID for vote rationale (optional)
    pub rationale_cid: String,
}

impl VoteRecord {
    pub const MAX_CID_LEN: usize = 64;

    pub const LEN: usize = 8 +  // discriminator
        32 +    // dispute
        32 +    // juror
        32 +    // juror_account
        1 +     // choice
        8 +     // stake_allocated
        8 +     // voting_power
        8 +     // unlock_at
        1 +     // reputation_processed
        1 +     // reward_claimed
        1 +     // stake_unlocked
        1 +     // bump
        8 +     // voted_at
        4 + Self::MAX_CID_LEN;  // rationale_cid (4 bytes length + string)

    /// Check if stake can be unlocked
    pub fn can_unlock(&self, current_time: i64) -> bool {
        current_time >= self.unlock_at && !self.stake_unlocked
    }

    /// Check if vote was correct based on outcome
    pub fn is_correct(&self, outcome: crate::state::dispute::ResolutionOutcome) -> Option<bool> {
        use crate::state::dispute::ResolutionOutcome;

        match (self.choice, outcome) {
            (VoteChoice::Uphold, ResolutionOutcome::Upheld) => Some(true),
            (VoteChoice::Dismiss, ResolutionOutcome::Dismissed) => Some(true),
            (VoteChoice::Uphold, ResolutionOutcome::Dismissed) => Some(false),
            (VoteChoice::Dismiss, ResolutionOutcome::Upheld) => Some(false),
            (_, ResolutionOutcome::NoParticipation) => None, // No outcome to judge against
            (_, ResolutionOutcome::None) => None, // Not resolved yet
        }
    }
}
