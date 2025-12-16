use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod state;
pub mod instructions;

pub use constants::*;
pub use errors::*;
pub use state::*;
pub use instructions::*;

declare_id!("8YELzww62rbPHT9k1LwwwMmUGMHQvrWAAjvWXPCsa3r1");

#[program]
pub mod marshalcraft {
    use super::*;

    /// Initialize a new protocol instance with custom configuration
    pub fn initialize_protocol(
        ctx: Context<InitializeProtocol>,
        params: ProtocolConfigParams,
    ) -> Result<()> {
        instructions::initialize_protocol(ctx, params)
    }

    /// Update protocol configuration (authority only)
    pub fn update_protocol(
        ctx: Context<UpdateProtocol>,
        params: ProtocolConfigParams,
    ) -> Result<()> {
        instructions::update_protocol(ctx, params)
    }

    /// Pause/unpause the protocol (authority only)
    pub fn set_protocol_paused(
        ctx: Context<SetProtocolPaused>,
        paused: bool,
    ) -> Result<()> {
        instructions::set_protocol_paused(ctx, paused)
    }

    // =========================================================================
    // Creator Instructions
    // =========================================================================

    /// Create or add to creator's stake pool
    pub fn stake_creator_pool(
        ctx: Context<StakeCreatorPool>,
        amount: u64,
    ) -> Result<()> {
        instructions::stake_creator_pool(ctx, amount)
    }

    /// Withdraw available stake from creator pool
    pub fn withdraw_creator_pool(
        ctx: Context<WithdrawCreatorPool>,
        amount: u64,
    ) -> Result<()> {
        instructions::withdraw_creator_pool(ctx, amount)
    }

    // =========================================================================
    // Marshal Instructions
    // =========================================================================

    /// Register as a marshal with initial stake
    pub fn register_marshal(
        ctx: Context<RegisterMarshal>,
        stake_amount: u64,
    ) -> Result<()> {
        instructions::register_marshal(ctx, stake_amount)
    }

    /// Add more stake to marshal account
    pub fn add_marshal_stake(
        ctx: Context<AddMarshalStake>,
        amount: u64,
    ) -> Result<()> {
        instructions::add_marshal_stake(ctx, amount)
    }

    /// Withdraw available stake (with reputation-based slashing)
    pub fn withdraw_marshal_stake(
        ctx: Context<WithdrawMarshalStake>,
        amount: u64,
    ) -> Result<()> {
        instructions::withdraw_marshal_stake(ctx, amount)
    }

    /// Unregister marshal and withdraw all available stake
    pub fn unregister_marshal(
        ctx: Context<UnregisterMarshal>,
    ) -> Result<()> {
        instructions::unregister_marshal(ctx)
    }

    // =========================================================================
    // Reporter Instructions
    // =========================================================================

    /// Submit a new report (creates ReporterAccount if needed)
    pub fn submit_report(
        ctx: Context<SubmitReport>,
        content: Pubkey,
        category: ReportCategory,
        details_cid: String,
        bond: u64,
    ) -> Result<()> {
        instructions::submit_report(ctx, content, category, details_cid, bond)
    }

    /// Add to existing report (cumulative reporting)
    pub fn add_to_report(
        ctx: Context<AddToReport>,
        details_cid: String,
        bond: u64,
    ) -> Result<()> {
        instructions::add_to_report(ctx, details_cid, bond)
    }

    // =========================================================================
    // Voting Instructions
    // =========================================================================

    /// Vote on a report
    pub fn vote_on_report(
        ctx: Context<VoteOnReport>,
        choice: VoteChoice,
        stake_allocation: u64,
    ) -> Result<()> {
        instructions::vote_on_report(ctx, choice, stake_allocation)
    }

    // =========================================================================
    // Resolution Instructions
    // =========================================================================

    /// Resolve a report after voting period ends
    pub fn resolve_report(
        ctx: Context<ResolveReport>,
    ) -> Result<()> {
        instructions::resolve_report(ctx)
    }

    /// Process marshal's vote result (update reputation, unlock stake)
    pub fn process_vote_result(
        ctx: Context<ProcessVoteResult>,
    ) -> Result<()> {
        instructions::process_vote_result(ctx)
    }

    /// Claim marshal reward for correct vote
    pub fn claim_marshal_reward(
        ctx: Context<ClaimMarshalReward>,
    ) -> Result<()> {
        instructions::claim_marshal_reward(ctx)
    }

    /// Claim reporter reward (if report upheld)
    pub fn claim_reporter_reward(
        ctx: Context<ClaimReporterReward>,
    ) -> Result<()> {
        instructions::claim_reporter_reward(ctx)
    }

    // =========================================================================
    // Treasury Instructions
    // =========================================================================

    /// Withdraw from treasury (authority only)
    pub fn withdraw_treasury(
        ctx: Context<WithdrawTreasury>,
        amount: u64,
    ) -> Result<()> {
        instructions::withdraw_treasury(ctx, amount)
    }
}
