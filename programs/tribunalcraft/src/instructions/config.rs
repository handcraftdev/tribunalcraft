use anchor_lang::prelude::*;
use crate::state::ProtocolConfig;
use crate::constants::PROTOCOL_CONFIG_SEED;

/// Initialize protocol config (one-time setup by deployer)
#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = ProtocolConfig::LEN,
        seeds = [PROTOCOL_CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, ProtocolConfig>,

    pub system_program: Program<'info, System>,
}

pub fn initialize_config(ctx: Context<InitializeConfig>) -> Result<()> {
    let config = &mut ctx.accounts.config;

    config.authority = ctx.accounts.authority.key();
    config.treasury = ctx.accounts.authority.key(); // Initially set to deployer
    config.bump = ctx.bumps.config;

    msg!("Protocol config initialized. Treasury: {}", config.treasury);

    Ok(())
}

/// Update treasury address (admin only)
#[derive(Accounts)]
pub struct UpdateTreasury<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [PROTOCOL_CONFIG_SEED],
        bump = config.bump,
        has_one = authority,
    )]
    pub config: Account<'info, ProtocolConfig>,
}

pub fn update_treasury(ctx: Context<UpdateTreasury>, new_treasury: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.treasury = new_treasury;

    msg!("Treasury updated to: {}", new_treasury);

    Ok(())
}
