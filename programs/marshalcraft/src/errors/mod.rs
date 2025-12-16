use anchor_lang::prelude::*;

#[error_code]
pub enum MarshalCraftError {
    // Protocol errors
    #[msg("Protocol is paused")]
    ProtocolPaused,

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

    // Bond errors
    #[msg("Bond amount below minimum")]
    BondBelowMinimum,

    #[msg("Bond exceeds creator's available pool")]
    BondExceedsAvailable,

    // Report errors
    #[msg("Cannot report own content")]
    CannotSelfReport,

    #[msg("Report already exists for this content")]
    ReportAlreadyExists,

    #[msg("Report not found")]
    ReportNotFound,

    #[msg("Report already resolved")]
    ReportAlreadyResolved,

    #[msg("Voting period not ended")]
    VotingNotEnded,

    #[msg("Voting period has ended")]
    VotingEnded,

    // Vote errors
    #[msg("Cannot vote on own report")]
    CannotVoteOnOwnReport,

    #[msg("Already voted on this report")]
    AlreadyVoted,

    #[msg("Vote allocation below minimum")]
    VoteAllocationBelowMinimum,

    #[msg("Invalid vote choice")]
    InvalidVoteChoice,

    // Marshal errors
    #[msg("Marshal not active")]
    MarshalNotActive,

    #[msg("Marshal already registered")]
    MarshalAlreadyRegistered,

    // Reporter errors
    #[msg("Reporter not found")]
    ReporterNotFound,

    // Reward errors
    #[msg("Reward already claimed")]
    RewardAlreadyClaimed,

    #[msg("Not eligible for reward")]
    NotEligibleForReward,

    #[msg("Reputation already processed")]
    ReputationAlreadyProcessed,

    // Treasury errors
    #[msg("Insufficient treasury balance")]
    InsufficientTreasuryBalance,

    // Math errors
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,

    #[msg("Division by zero")]
    DivisionByZero,
}
