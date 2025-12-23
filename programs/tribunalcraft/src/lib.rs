use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod state;
pub mod instructions;

pub use constants::*;
pub use errors::*;
pub use events::*;
pub use state::*;
pub use instructions::*;

declare_id!("YxF3CEwUr5Nhk8FjzZDhKFcSHfgRHYA31Ccm3vd2Mrz");

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

    /// Create a defender pool
    pub fn create_defender_pool(
        ctx: Context<CreatePool>,
        initial_amount: u64,
        max_bond: u64,
    ) -> Result<()> {
        instructions::create_pool(ctx, initial_amount, max_bond)
    }

    /// Deposit to defender pool
    pub fn deposit_defender_pool(
        ctx: Context<StakePool>,
        amount: u64,
    ) -> Result<()> {
        instructions::stake_pool(ctx, amount)
    }

    /// Withdraw from defender pool
    pub fn withdraw_defender_pool(
        ctx: Context<WithdrawPool>,
        amount: u64,
    ) -> Result<()> {
        instructions::withdraw_pool(ctx, amount)
    }

    /// Update max_bond setting for defender pool
    pub fn update_max_bond(
        ctx: Context<UpdateMaxBond>,
        new_max_bond: u64,
    ) -> Result<()> {
        instructions::update_max_bond(ctx, new_max_bond)
    }

    // =========================================================================
    // Subject Instructions
    // =========================================================================

    /// Create a subject with Subject + Dispute + Escrow PDAs
    /// Creator's pool is linked. If initial_bond > 0, transfers from wallet.
    pub fn create_subject(
        ctx: Context<CreateSubject>,
        subject_id: Pubkey,
        details_cid: String,
        match_mode: bool,
        voting_period: i64,
        initial_bond: u64,
    ) -> Result<()> {
        instructions::create_subject(ctx, subject_id, details_cid, match_mode, voting_period, initial_bond)
    }

    /// Add bond directly from wallet
    pub fn add_bond_direct(
        ctx: Context<AddBondDirect>,
        amount: u64,
    ) -> Result<()> {
        instructions::add_bond_direct(ctx, amount)
    }

    /// Add bond from defender pool
    pub fn add_bond_from_pool(
        ctx: Context<AddBondFromPool>,
        amount: u64,
    ) -> Result<()> {
        instructions::add_bond_from_pool(ctx, amount)
    }

    // =========================================================================
    // Juror Instructions
    // =========================================================================

    /// Register as a juror
    pub fn register_juror(
        ctx: Context<RegisterJuror>,
        stake_amount: u64,
    ) -> Result<()> {
        instructions::register_juror(ctx, stake_amount)
    }

    /// Add stake to juror pool
    pub fn add_juror_stake(
        ctx: Context<AddJurorStake>,
        amount: u64,
    ) -> Result<()> {
        instructions::add_juror_stake(ctx, amount)
    }

    /// Withdraw from juror pool
    pub fn withdraw_juror_stake(
        ctx: Context<WithdrawJurorStake>,
        amount: u64,
    ) -> Result<()> {
        instructions::withdraw_juror_stake(ctx, amount)
    }

    /// Unregister juror
    pub fn unregister_juror(
        ctx: Context<UnregisterJuror>,
    ) -> Result<()> {
        instructions::unregister_juror(ctx)
    }

    // =========================================================================
    // Challenger Pool Instructions
    // =========================================================================

    /// Register as a challenger
    pub fn register_challenger(
        ctx: Context<RegisterChallenger>,
        stake_amount: u64,
    ) -> Result<()> {
        instructions::register_challenger(ctx, stake_amount)
    }

    /// Add stake to challenger pool
    pub fn add_challenger_stake(
        ctx: Context<AddChallengerStake>,
        amount: u64,
    ) -> Result<()> {
        instructions::add_challenger_stake(ctx, amount)
    }

    /// Withdraw from challenger pool
    pub fn withdraw_challenger_stake(
        ctx: Context<WithdrawChallengerStake>,
        amount: u64,
    ) -> Result<()> {
        instructions::withdraw_challenger_stake(ctx, amount)
    }

    // =========================================================================
    // Challenger Instructions
    // =========================================================================

    /// Create a dispute against a subject
    pub fn create_dispute(
        ctx: Context<CreateDispute>,
        dispute_type: DisputeType,
        details_cid: String,
        stake: u64,
    ) -> Result<()> {
        instructions::create_dispute(ctx, dispute_type, details_cid, stake)
    }

    /// Join existing dispute as additional challenger
    pub fn join_challengers(
        ctx: Context<JoinChallengers>,
        details_cid: String,
        stake: u64,
    ) -> Result<()> {
        instructions::join_challengers(ctx, details_cid, stake)
    }

    // =========================================================================
    // Voting Instructions
    // =========================================================================

    /// Vote on a dispute
    pub fn vote_on_dispute(
        ctx: Context<VoteOnDispute>,
        choice: VoteChoice,
        stake_allocation: u64,
        rationale_cid: String,
    ) -> Result<()> {
        instructions::vote_on_dispute(ctx, choice, stake_allocation, rationale_cid)
    }

    /// Vote on a restoration
    pub fn vote_on_restore(
        ctx: Context<VoteOnRestore>,
        choice: RestoreVoteChoice,
        stake_allocation: u64,
        rationale_cid: String,
    ) -> Result<()> {
        instructions::vote_on_restore(ctx, choice, stake_allocation, rationale_cid)
    }

    /// Add stake to an existing vote
    pub fn add_to_vote(
        ctx: Context<AddToVote>,
        round: u32,
        additional_stake: u64,
    ) -> Result<()> {
        instructions::add_to_vote(ctx, round, additional_stake)
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

    // =========================================================================
    // Restoration Instructions
    // =========================================================================

    /// Submit a restoration request for an invalidated subject
    pub fn submit_restore(
        ctx: Context<SubmitRestore>,
        dispute_type: DisputeType,
        details_cid: String,
        stake_amount: u64,
    ) -> Result<()> {
        instructions::submit_restore(ctx, dispute_type, details_cid, stake_amount)
    }

    // =========================================================================
    // Claim Instructions
    // =========================================================================

    /// Claim defender reward
    pub fn claim_defender(
        ctx: Context<ClaimDefender>,
        round: u32,
    ) -> Result<()> {
        instructions::claim_defender(ctx, round)
    }

    /// Claim challenger reward
    pub fn claim_challenger(
        ctx: Context<ClaimChallenger>,
        round: u32,
    ) -> Result<()> {
        instructions::claim_challenger(ctx, round)
    }

    /// Claim juror reward
    pub fn claim_juror(
        ctx: Context<ClaimJuror>,
        round: u32,
    ) -> Result<()> {
        instructions::claim_juror(ctx, round)
    }

    // =========================================================================
    // Unlock Instructions
    // =========================================================================

    /// Unlock juror stake (7 days after resolution)
    pub fn unlock_juror_stake(
        ctx: Context<UnlockJurorStake>,
        round: u32,
    ) -> Result<()> {
        instructions::unlock_juror_stake(ctx, round)
    }

    // =========================================================================
    // Cleanup Instructions
    // =========================================================================

    /// Close defender record
    pub fn close_defender_record(ctx: Context<CloseDefenderRecord>, round: u32) -> Result<()> {
        instructions::close_defender_record(ctx, round)
    }

    /// Close challenger record
    pub fn close_challenger_record(ctx: Context<CloseChallengerRecord>, round: u32) -> Result<()> {
        instructions::close_challenger_record(ctx, round)
    }

    /// Close juror record
    pub fn close_juror_record(ctx: Context<CloseJurorRecord>, round: u32) -> Result<()> {
        instructions::close_juror_record(ctx, round)
    }

    // =========================================================================
    // Sweep Instructions
    // =========================================================================

    /// Creator sweep unclaimed funds (after 30 days)
    pub fn sweep_round_creator(ctx: Context<SweepRoundCreator>, round: u32) -> Result<()> {
        instructions::sweep_round_creator(ctx, round)
    }

    /// Treasury sweep unclaimed funds (after 90 days)
    pub fn sweep_round_treasury(ctx: Context<SweepRoundTreasury>, round: u32) -> Result<()> {
        instructions::sweep_round_treasury(ctx, round)
    }
}
