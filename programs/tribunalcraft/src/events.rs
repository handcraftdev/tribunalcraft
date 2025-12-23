use anchor_lang::prelude::*;
use crate::state::{BondSource, VoteChoice, RestoreVoteChoice, ResolutionOutcome};

// =============================================================================
// Subject Events
// =============================================================================

#[event]
pub struct SubjectCreatedEvent {
    pub subject_id: Pubkey,
    pub creator: Pubkey,
    pub match_mode: bool,
    pub voting_period: i64,
    pub timestamp: i64,
}

#[event]
pub struct SubjectStatusChangedEvent {
    pub subject_id: Pubkey,
    pub old_status: u8,
    pub new_status: u8,
    pub timestamp: i64,
}

// =============================================================================
// Bond Events
// =============================================================================

#[event]
pub struct BondAddedEvent {
    pub subject_id: Pubkey,
    pub defender: Pubkey,
    pub round: u32,
    pub amount: u64,
    pub source: BondSource,
    pub timestamp: i64,
}

#[event]
pub struct BondWithdrawnEvent {
    pub defender: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

// =============================================================================
// Dispute Events
// =============================================================================

#[event]
pub struct DisputeCreatedEvent {
    pub subject_id: Pubkey,
    pub round: u32,
    pub creator: Pubkey,
    pub stake: u64,
    pub bond_at_risk: u64,
    pub voting_ends_at: i64,
    pub timestamp: i64,
}

#[event]
pub struct ChallengerJoinedEvent {
    pub subject_id: Pubkey,
    pub round: u32,
    pub challenger: Pubkey,
    pub stake: u64,
    pub total_stake: u64,
    pub timestamp: i64,
}

// =============================================================================
// Restore Events
// =============================================================================

#[event]
pub struct RestoreSubmittedEvent {
    pub subject_id: Pubkey,
    pub round: u32,
    pub restorer: Pubkey,
    pub stake: u64,
    pub details_cid: String,
    pub voting_period: i64,
    pub timestamp: i64,
}

#[event]
pub struct RestoreResolvedEvent {
    pub subject_id: Pubkey,
    pub round: u32,
    pub outcome: ResolutionOutcome,
    pub timestamp: i64,
}

// =============================================================================
// Vote Events
// =============================================================================

#[event]
pub struct VoteEvent {
    pub subject_id: Pubkey,
    pub round: u32,
    pub juror: Pubkey,
    pub choice: VoteChoice,
    pub voting_power: u64,
    pub rationale_cid: String,
    pub timestamp: i64,
}

#[event]
pub struct RestoreVoteEvent {
    pub subject_id: Pubkey,
    pub round: u32,
    pub juror: Pubkey,
    pub choice: RestoreVoteChoice,
    pub voting_power: u64,
    pub rationale_cid: String,
    pub timestamp: i64,
}

#[event]
pub struct AddToVoteEvent {
    pub subject_id: Pubkey,
    pub round: u32,
    pub juror: Pubkey,
    pub additional_stake: u64,
    pub additional_voting_power: u64,
    pub total_stake: u64,
    pub total_voting_power: u64,
    pub timestamp: i64,
}

// =============================================================================
// Resolution Events
// =============================================================================

#[event]
pub struct DisputeResolvedEvent {
    pub subject_id: Pubkey,
    pub round: u32,
    pub outcome: ResolutionOutcome,
    pub total_stake: u64,
    pub bond_at_risk: u64,
    pub winner_pool: u64,
    pub juror_pool: u64,
    pub resolved_at: i64,
    pub timestamp: i64,
}

// =============================================================================
// Claim Events
// =============================================================================

#[event]
pub struct RewardClaimedEvent {
    pub subject_id: Pubkey,
    pub round: u32,
    pub claimer: Pubkey,
    pub role: ClaimRole,
    pub amount: u64,
    pub timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum ClaimRole {
    Defender,
    Challenger,
    Juror,
}

#[event]
pub struct StakeUnlockedEvent {
    pub subject_id: Pubkey,
    pub round: u32,
    pub juror: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

// =============================================================================
// Cleanup Events
// =============================================================================

#[event]
pub struct RecordClosedEvent {
    pub subject_id: Pubkey,
    pub round: u32,
    pub owner: Pubkey,
    pub role: ClaimRole,
    pub rent_returned: u64,
    pub timestamp: i64,
}

// =============================================================================
// Sweep Events
// =============================================================================

#[event]
pub struct RoundSweptEvent {
    pub subject_id: Pubkey,
    pub round: u32,
    pub sweeper: Pubkey,
    pub unclaimed: u64,
    pub bot_reward: u64,
    pub timestamp: i64,
}

// =============================================================================
// Pool Events
// =============================================================================

#[event]
pub struct PoolDepositEvent {
    pub pool_type: PoolType,
    pub owner: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct PoolWithdrawEvent {
    pub pool_type: PoolType,
    pub owner: Pubkey,
    pub amount: u64,
    pub slashed: u64,
    pub timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PoolType {
    Defender,
    Challenger,
    Juror,
}
