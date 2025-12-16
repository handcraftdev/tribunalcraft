use anchor_lang::prelude::*;

/// Vote choice
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default, Debug)]
pub enum VoteChoice {
    #[default]
    Abstain,
    Remove,  // Content should be removed
    Keep,    // Content is acceptable
}

/// Marshal's vote on a report
#[account]
#[derive(Default)]
pub struct VoteRecord {
    /// The report being voted on
    pub report: Pubkey,

    /// Marshal who cast the vote
    pub marshal: Pubkey,

    /// Marshal account PDA
    pub marshal_account: Pubkey,

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
}

impl VoteRecord {
    pub const LEN: usize = 8 +  // discriminator
        32 +    // report
        32 +    // marshal
        32 +    // marshal_account
        1 +     // choice
        8 +     // stake_allocated
        8 +     // voting_power
        8 +     // unlock_at
        1 +     // reputation_processed
        1 +     // reward_claimed
        1 +     // stake_unlocked
        1 +     // bump
        8;      // voted_at

    /// Check if stake can be unlocked
    pub fn can_unlock(&self, current_time: i64) -> bool {
        current_time >= self.unlock_at && !self.stake_unlocked
    }

    /// Check if vote was correct based on outcome
    pub fn is_correct(&self, outcome: crate::state::content_report::ResolutionOutcome) -> Option<bool> {
        use crate::state::content_report::ResolutionOutcome;

        match (self.choice, outcome) {
            (VoteChoice::Remove, ResolutionOutcome::Upheld) => Some(true),
            (VoteChoice::Keep, ResolutionOutcome::Dismissed) => Some(true),
            (VoteChoice::Remove, ResolutionOutcome::Dismissed) => Some(false),
            (VoteChoice::Keep, ResolutionOutcome::Upheld) => Some(false),
            (VoteChoice::Abstain, _) => None, // Abstain has no correctness
            (_, ResolutionOutcome::NoParticipation) => None, // No outcome to judge against
            (_, ResolutionOutcome::None) => None, // Not resolved yet
        }
    }
}
