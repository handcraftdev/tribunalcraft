use anchor_lang::prelude::*;

#[error_code]
pub enum ScaleCraftError {
    #[msg("Unauthorized")]
    Unauthorized,

    #[msg("Invalid configuration parameter")]
    InvalidConfig,

    // Stake errors
    #[msg("Stake amount below minimum")]
    StakeBelowMinimum,

    #[msg("Insufficient available stake")]
    InsufficientAvailableStake,

    #[msg("Insufficient held stake")]
    InsufficientHeldStake,

    #[msg("Stake still locked")]
    StakeStillLocked,

    #[msg("Stake already unlocked")]
    StakeAlreadyUnlocked,

    // Bond errors
    #[msg("Bond amount below minimum")]
    BondBelowMinimum,

    #[msg("Bond exceeds staker's available pool")]
    BondExceedsAvailable,

    // Subject errors
    #[msg("Subject cannot accept stakes")]
    SubjectCannotBeStaked,

    #[msg("Subject cannot be disputed")]
    SubjectCannotBeDisputed,

    #[msg("Subject cannot be restored")]
    SubjectCannotBeRestored,

    #[msg("Invalid subject status for this operation")]
    InvalidSubjectStatus,

    // Pool errors
    #[msg("Insufficient pool balance")]
    InsufficientPoolBalance,

    // Restoration errors
    #[msg("Restore stake below minimum (must match previous dispute total)")]
    RestoreStakeBelowMinimum,

    #[msg("This dispute is not a restoration request")]
    NotARestore,

    // Dispute errors
    #[msg("Cannot dispute own subject")]
    CannotSelfDispute,

    #[msg("Dispute already exists for this subject")]
    DisputeAlreadyExists,

    #[msg("Dispute not found")]
    DisputeNotFound,

    #[msg("Dispute already resolved")]
    DisputeAlreadyResolved,

    #[msg("Voting period not ended")]
    VotingNotEnded,

    #[msg("Voting period has ended")]
    VotingEnded,

    // Vote errors
    #[msg("Cannot vote on own dispute")]
    CannotVoteOnOwnDispute,

    #[msg("Already voted on this dispute")]
    AlreadyVoted,

    #[msg("Vote allocation below minimum")]
    VoteAllocationBelowMinimum,

    #[msg("Invalid vote choice")]
    InvalidVoteChoice,

    #[msg("Invalid round number")]
    InvalidRound,

    // Juror errors
    #[msg("Juror not active")]
    JurorNotActive,

    #[msg("Juror already registered")]
    JurorAlreadyRegistered,

    // Challenger errors
    #[msg("Challenger not found")]
    ChallengerNotFound,

    // Reward errors
    #[msg("Reward already claimed")]
    RewardAlreadyClaimed,

    #[msg("Reward not yet claimed")]
    RewardNotClaimed,

    #[msg("Not eligible for reward")]
    NotEligibleForReward,

    #[msg("Reputation already processed")]
    ReputationAlreadyProcessed,

    // Math errors
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,

    #[msg("Division by zero")]
    DivisionByZero,

    // Escrow errors
    #[msg("Not all claims have been processed")]
    ClaimsNotComplete,
}
