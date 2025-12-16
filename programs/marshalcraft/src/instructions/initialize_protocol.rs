use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::{defaults, PROTOCOL_CONFIG_SEED, TREASURY_SEED};
use crate::errors::MarshalCraftError;

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = ProtocolConfig::LEN,
        seeds = [PROTOCOL_CONFIG_SEED, authority.key().as_ref()],
        bump
    )]
    pub config: Account<'info, ProtocolConfig>,

    #[account(
        init,
        payer = authority,
        space = Treasury::LEN,
        seeds = [TREASURY_SEED, config.key().as_ref()],
        bump
    )]
    pub treasury: Account<'info, Treasury>,

    pub system_program: Program<'info, System>,
}

pub fn initialize_protocol(
    ctx: Context<InitializeProtocol>,
    params: ProtocolConfigParams,
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let treasury = &mut ctx.accounts.treasury;
    let clock = Clock::get()?;

    // Set authority
    config.authority = ctx.accounts.authority.key();
    config.treasury = treasury.key();
    config.is_paused = false;

    // Apply parameters with defaults
    config.min_creator_pool = params.min_creator_pool.unwrap_or(defaults::MIN_CREATOR_POOL);
    config.min_marshal_stake = params.min_marshal_stake.unwrap_or(defaults::MIN_MARSHAL_STAKE);
    config.base_reporter_bond = params.base_reporter_bond.unwrap_or(defaults::BASE_REPORTER_BOND);
    config.min_vote_allocation_bps = params.min_vote_allocation_bps.unwrap_or(defaults::MIN_VOTE_ALLOCATION_BPS);

    config.voting_period = params.voting_period.unwrap_or(defaults::VOTING_PERIOD);
    config.stake_lock_period = params.stake_lock_period.unwrap_or(defaults::STAKE_LOCK_PERIOD);

    config.initial_reputation = params.initial_reputation.unwrap_or(defaults::INITIAL_REPUTATION);
    config.reputation_gain_rate = params.reputation_gain_rate.unwrap_or(defaults::REPUTATION_GAIN_RATE);
    config.reputation_loss_rate = params.reputation_loss_rate.unwrap_or(defaults::REPUTATION_LOSS_RATE);

    config.grace_zone_low = params.grace_zone_low.unwrap_or(defaults::GRACE_ZONE_LOW);
    config.grace_zone_high = params.grace_zone_high.unwrap_or(defaults::GRACE_ZONE_HIGH);
    config.grace_zone_multiplier = params.grace_zone_multiplier.unwrap_or(defaults::GRACE_ZONE_MULTIPLIER);
    config.extreme_zone_low = params.extreme_zone_low.unwrap_or(defaults::EXTREME_ZONE_LOW);
    config.extreme_zone_high = params.extreme_zone_high.unwrap_or(defaults::EXTREME_ZONE_HIGH);
    config.extreme_zone_multiplier = params.extreme_zone_multiplier.unwrap_or(defaults::EXTREME_ZONE_MULTIPLIER);
    config.normal_zone_multiplier = params.normal_zone_multiplier.unwrap_or(defaults::NORMAL_ZONE_MULTIPLIER);

    config.reporter_reward_bps = params.reporter_reward_bps.unwrap_or(defaults::REPORTER_REWARD_BPS);
    config.slash_threshold = params.slash_threshold.unwrap_or(defaults::SLASH_THRESHOLD);

    config.version = 1;
    config.bump = ctx.bumps.config;
    config.created_at = clock.unix_timestamp;
    config.updated_at = clock.unix_timestamp;

    // Initialize treasury
    treasury.config = config.key();
    treasury.authority = ctx.accounts.authority.key();
    treasury.balance = 0;
    treasury.total_collected = 0;
    treasury.total_withdrawn = 0;
    treasury.bump = ctx.bumps.treasury;
    treasury.created_at = clock.unix_timestamp;
    treasury.updated_at = clock.unix_timestamp;

    msg!("MarshalCraft protocol initialized");
    msg!("Config: {}", config.key());
    msg!("Treasury: {}", treasury.key());

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateProtocol<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority @ MarshalCraftError::Unauthorized,
    )]
    pub config: Account<'info, ProtocolConfig>,
}

pub fn update_protocol(
    ctx: Context<UpdateProtocol>,
    params: ProtocolConfigParams,
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let clock = Clock::get()?;

    // Update only provided parameters
    if let Some(v) = params.min_creator_pool { config.min_creator_pool = v; }
    if let Some(v) = params.min_marshal_stake { config.min_marshal_stake = v; }
    if let Some(v) = params.base_reporter_bond { config.base_reporter_bond = v; }
    if let Some(v) = params.min_vote_allocation_bps { config.min_vote_allocation_bps = v; }
    if let Some(v) = params.voting_period { config.voting_period = v; }
    if let Some(v) = params.stake_lock_period { config.stake_lock_period = v; }
    if let Some(v) = params.initial_reputation { config.initial_reputation = v; }
    if let Some(v) = params.reputation_gain_rate { config.reputation_gain_rate = v; }
    if let Some(v) = params.reputation_loss_rate { config.reputation_loss_rate = v; }
    if let Some(v) = params.grace_zone_low { config.grace_zone_low = v; }
    if let Some(v) = params.grace_zone_high { config.grace_zone_high = v; }
    if let Some(v) = params.grace_zone_multiplier { config.grace_zone_multiplier = v; }
    if let Some(v) = params.extreme_zone_low { config.extreme_zone_low = v; }
    if let Some(v) = params.extreme_zone_high { config.extreme_zone_high = v; }
    if let Some(v) = params.extreme_zone_multiplier { config.extreme_zone_multiplier = v; }
    if let Some(v) = params.normal_zone_multiplier { config.normal_zone_multiplier = v; }
    if let Some(v) = params.reporter_reward_bps { config.reporter_reward_bps = v; }
    if let Some(v) = params.slash_threshold { config.slash_threshold = v; }

    config.updated_at = clock.unix_timestamp;

    msg!("Protocol config updated");
    Ok(())
}

#[derive(Accounts)]
pub struct SetProtocolPaused<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority @ MarshalCraftError::Unauthorized,
    )]
    pub config: Account<'info, ProtocolConfig>,
}

pub fn set_protocol_paused(
    ctx: Context<SetProtocolPaused>,
    paused: bool,
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.is_paused = paused;
    config.updated_at = Clock::get()?.unix_timestamp;

    msg!("Protocol paused: {}", paused);
    Ok(())
}
