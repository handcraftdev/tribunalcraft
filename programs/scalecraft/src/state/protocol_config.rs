use anchor_lang::prelude::*;

/// Protocol-wide configuration account
/// Stores treasury address and admin authority for fee collection
#[account]
pub struct ProtocolConfig {
    /// Admin who can update config (deployer initially)
    pub authority: Pubkey,
    /// Platform fee recipient address
    pub treasury: Pubkey,
    /// PDA bump seed
    pub bump: u8,
}

impl ProtocolConfig {
    pub const LEN: usize = 8   // discriminator
        + 32                   // authority
        + 32                   // treasury
        + 1;                   // bump
}
