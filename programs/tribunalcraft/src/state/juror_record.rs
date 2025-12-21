use anchor_lang::prelude::*;
use crate::state::dispute::ResolutionOutcome;

/// Vote choice for disputes
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default, Debug)]
pub enum VoteChoice {
    #[default]
    ForChallenger,  // Vote for the challenger (dispute is valid)
    ForDefender,    // Vote for the defender (dispute is invalid)
}

/// Vote choice for restorations
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default, Debug)]
pub enum RestoreVoteChoice {
    #[default]
    ForRestoration,    // Vote to restore subject to Valid status
    AgainstRestoration, // Vote to keep subject Invalid
}

/// Juror's vote record for a specific subject round
/// Seeds: [JUROR_RECORD_SEED, subject_id, juror, round]
/// Created per round, closed after claim
#[account]
#[derive(Default)]
pub struct JurorRecord {
    /// The subject_id this record belongs to
    pub subject_id: Pubkey,

    /// Juror who cast the vote
    pub juror: Pubkey,

    /// Which round this vote is for
    pub round: u32,

    /// Vote choice for regular disputes
    pub choice: VoteChoice,

    /// Vote choice for restorations (only used when is_restore_vote is true)
    pub restore_choice: RestoreVoteChoice,

    /// Whether this is a restoration vote
    pub is_restore_vote: bool,

    /// Calculated voting power
    pub voting_power: u64,

    /// Stake allocated (locked from juror pool)
    pub stake_allocation: u64,

    /// Whether reward has been claimed
    pub reward_claimed: bool,

    /// Whether stake has been unlocked (7 days after voting ends)
    pub stake_unlocked: bool,

    /// Bump seed for PDA
    pub bump: u8,

    /// Vote timestamp
    pub voted_at: i64,

    /// IPFS CID for vote rationale (optional)
    pub rationale_cid: String,
}

impl JurorRecord {
    pub const MAX_CID_LEN: usize = 64;

    pub const LEN: usize = 8 +  // discriminator
        32 +    // subject_id
        32 +    // juror
        4 +     // round
        1 +     // choice
        1 +     // restore_choice
        1 +     // is_restore_vote
        8 +     // voting_power
        8 +     // stake_allocation
        1 +     // reward_claimed
        1 +     // stake_unlocked
        1 +     // bump
        8 +     // voted_at
        4 + Self::MAX_CID_LEN;  // rationale_cid

    /// Check if vote was correct based on outcome
    pub fn is_correct(&self, outcome: ResolutionOutcome) -> Option<bool> {
        if self.is_restore_vote {
            // Restoration vote logic
            match (self.restore_choice, outcome) {
                (RestoreVoteChoice::ForRestoration, ResolutionOutcome::ChallengerWins) => Some(true),
                (RestoreVoteChoice::AgainstRestoration, ResolutionOutcome::DefenderWins) => Some(true),
                (RestoreVoteChoice::ForRestoration, ResolutionOutcome::DefenderWins) => Some(false),
                (RestoreVoteChoice::AgainstRestoration, ResolutionOutcome::ChallengerWins) => Some(false),
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

    /// Calculate juror's share of reward based on voting power
    pub fn calculate_reward_share(&self, total_reward: u64, total_vote_weight: u64) -> u64 {
        if total_vote_weight == 0 {
            return 0;
        }
        (total_reward as u128 * self.voting_power as u128 / total_vote_weight as u128) as u64
    }
}
