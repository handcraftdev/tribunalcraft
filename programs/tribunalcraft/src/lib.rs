use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod state;
pub mod instructions;

pub use constants::*;
pub use errors::*;
pub use state::*;
pub use instructions::*;

declare_id!("4skvzJnHJomLcMf1pNWVhVg8NFWBYspGW8AKEECtHhaC");

#[program]
pub mod tribunalcraft {
    use super::*;

    // =========================================================================
    // Protocol Config Instructions
    // =========================================================================

    /// Initialize protocol config (one-time setup by deployer)
    pub fn initialize_config(ctx: Context<InitializeConfig>) -> Result<()> {
        instructions::initialize_config(ctx)
    }

    /// Update treasury address (admin only)
    pub fn update_treasury(ctx: Context<UpdateTreasury>, new_treasury: Pubkey) -> Result<()> {
        instructions::update_treasury(ctx, new_treasury)
    }

    // =========================================================================
    // Defender Pool Instructions
    // =========================================================================

    /// Create a defender pool with initial stake
    pub fn create_pool(
        ctx: Context<CreatePool>,
        initial_stake: u64,
    ) -> Result<()> {
        instructions::create_pool(ctx, initial_stake)
    }

    /// Add stake to an existing pool
    pub fn stake_pool(
        ctx: Context<StakePool>,
        amount: u64,
    ) -> Result<()> {
        instructions::stake_pool(ctx, amount)
    }

    /// Withdraw available stake from pool
    pub fn withdraw_pool(
        ctx: Context<WithdrawPool>,
        amount: u64,
    ) -> Result<()> {
        instructions::withdraw_pool(ctx, amount)
    }

    // =========================================================================
    // Subject Instructions
    // =========================================================================

    /// Create a subject linked to a defender pool
    pub fn create_linked_subject(
        ctx: Context<CreateLinkedSubject>,
        subject_id: Pubkey,
        details_cid: String,
        max_stake: u64,
        match_mode: bool,
        free_case: bool,
        voting_period: i64,
    ) -> Result<()> {
        instructions::create_linked_subject(ctx, subject_id, details_cid, max_stake, match_mode, free_case, voting_period)
    }

    /// Create a free subject (no stake required, just Subject account)
    pub fn create_free_subject(
        ctx: Context<CreateFreeSubject>,
        subject_id: Pubkey,
        details_cid: String,
        voting_period: i64,
    ) -> Result<()> {
        instructions::create_free_subject(ctx, subject_id, details_cid, voting_period)
    }

    /// Add stake to a standalone subject
    pub fn add_to_stake(
        ctx: Context<AddToStake>,
        stake: u64,
    ) -> Result<()> {
        instructions::add_to_stake(ctx, stake)
    }

    // =========================================================================
    // Juror Instructions
    // =========================================================================

    /// Register as a juror with initial stake
    pub fn register_juror(
        ctx: Context<RegisterJuror>,
        stake_amount: u64,
    ) -> Result<()> {
        instructions::register_juror(ctx, stake_amount)
    }

    /// Add more stake to juror account
    pub fn add_juror_stake(
        ctx: Context<AddJurorStake>,
        amount: u64,
    ) -> Result<()> {
        instructions::add_juror_stake(ctx, amount)
    }

    /// Withdraw available stake (with reputation-based slashing)
    pub fn withdraw_juror_stake(
        ctx: Context<WithdrawJurorStake>,
        amount: u64,
    ) -> Result<()> {
        instructions::withdraw_juror_stake(ctx, amount)
    }

    /// Unregister juror and withdraw all available stake
    pub fn unregister_juror(
        ctx: Context<UnregisterJuror>,
    ) -> Result<()> {
        instructions::unregister_juror(ctx)
    }

    // =========================================================================
    // Challenger Instructions
    // =========================================================================

    /// Submit a new dispute against a subject (first challenger)
    pub fn submit_dispute(
        ctx: Context<SubmitDispute>,
        dispute_type: DisputeType,
        details_cid: String,
        bond: u64,
    ) -> Result<()> {
        instructions::submit_dispute(ctx, dispute_type, details_cid, bond)
    }

    /// Add to existing dispute (additional challengers)
    pub fn add_to_dispute(
        ctx: Context<AddToDispute>,
        details_cid: String,
        bond: u64,
    ) -> Result<()> {
        instructions::add_to_dispute(ctx, details_cid, bond)
    }

    /// Submit a free dispute (no bond required, just Dispute account)
    pub fn submit_free_dispute(
        ctx: Context<SubmitFreeDispute>,
        dispute_type: DisputeType,
        details_cid: String,
    ) -> Result<()> {
        instructions::submit_free_dispute(ctx, dispute_type, details_cid)
    }

    // =========================================================================
    // Restore Instructions
    // =========================================================================

    /// Submit a restoration request against an invalidated subject
    /// Restorations allow community to reverse previous invalidation decisions
    /// Restorer stakes (no bond required), voting period is 2x previous
    pub fn submit_restore(
        ctx: Context<SubmitRestore>,
        dispute_type: DisputeType,
        details_cid: String,
        stake_amount: u64,
    ) -> Result<()> {
        instructions::submit_restore(ctx, dispute_type, details_cid, stake_amount)
    }

    // =========================================================================
    // Voting Instructions
    // =========================================================================

    /// Vote on a dispute with stake allocation
    pub fn vote_on_dispute(
        ctx: Context<VoteOnDispute>,
        choice: VoteChoice,
        stake_allocation: u64,
        rationale_cid: String,
    ) -> Result<()> {
        instructions::vote_on_dispute(ctx, choice, stake_allocation, rationale_cid)
    }

    /// Vote on a restoration with stake allocation
    /// ForRestoration = vote to restore subject to Valid
    /// AgainstRestoration = vote to keep subject Invalidated
    pub fn vote_on_restore(
        ctx: Context<VoteOnRestore>,
        choice: RestoreVoteChoice,
        stake_allocation: u64,
        rationale_cid: String,
    ) -> Result<()> {
        instructions::vote_on_restore(ctx, choice, stake_allocation, rationale_cid)
    }

    /// Add more stake to an existing vote
    pub fn add_to_vote(
        ctx: Context<AddToVote>,
        additional_stake: u64,
    ) -> Result<()> {
        instructions::add_to_vote(ctx, additional_stake)
    }

    // =========================================================================
    // Resolution Instructions
    // =========================================================================

    /// Resolve a dispute after voting period ends
    pub fn resolve_dispute(
        ctx: Context<ResolveDispute>,
    ) -> Result<()> {
        instructions::resolve_dispute(ctx)
    }

    /// Unlock juror stake after 7-day buffer
    pub fn unlock_juror_stake(
        ctx: Context<UnlockJurorStake>,
    ) -> Result<()> {
        instructions::unlock_juror_stake(ctx)
    }

    /// Claim juror reward for correct vote
    pub fn claim_juror_reward(
        ctx: Context<ClaimJurorReward>,
    ) -> Result<()> {
        instructions::claim_juror_reward(ctx)
    }

    /// Claim challenger reward (if dispute upheld)
    pub fn claim_challenger_reward(
        ctx: Context<ClaimChallengerReward>,
    ) -> Result<()> {
        instructions::claim_challenger_reward(ctx)
    }

    /// Claim defender reward (if dispute dismissed)
    pub fn claim_defender_reward(
        ctx: Context<ClaimDefenderReward>,
    ) -> Result<()> {
        instructions::claim_defender_reward(ctx)
    }

    /// Claim restorer refund for failed restoration request
    pub fn claim_restorer_refund(
        ctx: Context<ClaimRestorerRefund>,
    ) -> Result<()> {
        instructions::claim_restorer_refund(ctx)
    }

    // NOTE: close_escrow removed - no escrow in simplified model
}
