use anchor_lang::prelude::*;

/// Vote choice for regular disputes
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default, Debug)]
pub enum VoteChoice {
    #[default]
    ForChallenger,  // Vote for the challenger (dispute is valid, subject should be invalidated)
    ForDefender,    // Vote for the defender (dispute is invalid, subject stays active)
}

/// Vote choice for appeals (separate enum for clearer semantics)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default, Debug)]
pub enum AppealVoteChoice {
    #[default]
    ForRestoration,    // Vote to restore subject to Active status
    AgainstRestoration, // Vote to keep subject Invalidated
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

    /// Vote choice for regular disputes
    pub choice: VoteChoice,

    /// Vote choice for appeals (only used when is_appeal_vote is true)
    pub appeal_choice: AppealVoteChoice,

    /// Whether this is an appeal vote
    pub is_appeal_vote: bool,

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
        1 +     // appeal_choice
        1 +     // is_appeal_vote
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
    /// For regular disputes: ForChallenger wins if ChallengerWins, ForDefender wins if DefenderWins
    /// For appeals: ForRestoration wins if ChallengerWins (subject restored), AgainstRestoration wins if DefenderWins
    pub fn is_correct(&self, outcome: crate::state::dispute::ResolutionOutcome) -> Option<bool> {
        use crate::state::dispute::ResolutionOutcome;

        if self.is_appeal_vote {
            // Appeal vote logic
            match (self.appeal_choice, outcome) {
                (AppealVoteChoice::ForRestoration, ResolutionOutcome::ChallengerWins) => Some(true),
                (AppealVoteChoice::AgainstRestoration, ResolutionOutcome::DefenderWins) => Some(true),
                (AppealVoteChoice::ForRestoration, ResolutionOutcome::DefenderWins) => Some(false),
                (AppealVoteChoice::AgainstRestoration, ResolutionOutcome::ChallengerWins) => Some(false),
                (_, ResolutionOutcome::NoParticipation) => None,
                (_, ResolutionOutcome::None) => None,
            }
        } else {
            // Regular dispute vote logic
            match (self.choice, outcome) {
                (VoteChoice::ForChallenger, ResolutionOutcome::ChallengerWins) => Some(true),
                (VoteChoice::ForDefender, ResolutionOutcome::DefenderWins) => Some(true),
                (VoteChoice::ForChallenger, ResolutionOutcome::DefenderWins) => Some(false),
                (VoteChoice::ForDefender, ResolutionOutcome::ChallengerWins) => Some(false),
                (_, ResolutionOutcome::NoParticipation) => None,
                (_, ResolutionOutcome::None) => None,
            }
        }
    }
}
