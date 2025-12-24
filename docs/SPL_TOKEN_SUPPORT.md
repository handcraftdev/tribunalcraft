# SPL Token Support Design

This document outlines the design for adding SPL token support to TribunalCraft, allowing subjects to use any SPL token (USDC, BONK, etc.) instead of native SOL.

## Overview

TribunalCraft will support **per-subject token selection**:
- Each subject specifies its token mint at creation
- All bonds, stakes, and rewards for that subject use the same token
- Juror voting power remains SOL-based (protocol-level)
- No token whitelist - fully permissionless

## Design Decisions

### 1. Per-Subject Token

Each subject chooses its token at creation:

```rust
pub struct Subject {
    pub mint: Pubkey,  // Pubkey::default() = native SOL
    // ... existing fields
}
```

- `Pubkey::default()` (all zeros) = native SOL
- Any other pubkey = SPL token mint

### 2. Token Consistency Per Subject

All participants in a subject must use the subject's token:

| Action | Token |
|--------|-------|
| Defender bonds | Subject's mint |
| Challenger stakes | Subject's mint |
| Rewards distribution | Subject's mint |

Enforcement via validation:
```rust
require!(
    token_account.mint == subject.mint,
    TribunalCraftError::MintMismatch
);
```

### 3. Juror Voting Power Stays SOL-Based

Jurors are different from defenders/challengers:
- **Voting power**: Based on SOL balance in JurorPool (unchanged)
- **Rewards**: Received in subject's token

Rationale:
- Jurors don't impact reward distribution (they only receive)
- Voting power should be consistent across all subjects
- Simplifies juror economics

### 4. Pool PDAs Are Token-Agnostic

Pool accounts store reputation and SOL balance only:

```rust
pub struct JurorPool {
    pub owner: Pubkey,
    pub balance: u64,      // SOL only (voting power)
    pub reputation: u64,   // Token-agnostic score
    // ...
}
```

Reputation is a number that increases/decreases based on dispute outcomes, regardless of which token the subject used.

### 5. Rewards Flow to Pool ATAs

When claiming rewards:
- Pool PDA owns Associated Token Accounts (ATAs) for each token
- User pays rent for ATA creation (~0.002 SOL per token)
- Rewards deposited to pool's ATA for that token

```
JurorPool PDA
├── Native lamports (SOL for voting power)
├── ATA for USDC (USDC rewards)
├── ATA for BONK (BONK rewards)
└── ... (created on-demand when claiming)
```

## What Changes

### Account Structures

```rust
// Subject - add mint field
pub struct Subject {
    pub mint: Pubkey,           // NEW: Token mint (default = SOL)
    pub subject_id: Pubkey,
    pub creator: Pubkey,
    // ... rest unchanged
}
```

### Instructions - Add Token Accounts

For instructions that transfer funds, add optional token accounts:

```rust
#[derive(Accounts)]
pub struct AddBond<'info> {
    #[account(mut)]
    pub defender: Signer<'info>,

    #[account(mut)]
    pub subject: Account<'info, Subject>,

    // Token accounts (only used if subject.mint != native SOL)
    #[account(mut)]
    pub defender_token_account: Option<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub subject_token_account: Option<Account<'info, TokenAccount>>,

    pub token_program: Option<Program<'info, Token>>,
    pub system_program: Program<'info, System>,
}
```

### Transfer Logic - Conditional

```rust
fn transfer_to_subject(
    subject: &Subject,
    amount: u64,
    from_wallet: AccountInfo,
    from_token: Option<AccountInfo>,
    to_pda: AccountInfo,
    to_token: Option<AccountInfo>,
    system_program: AccountInfo,
    token_program: Option<AccountInfo>,
) -> Result<()> {
    if subject.mint == Pubkey::default() {
        // Native SOL transfer
        let cpi_ctx = CpiContext::new(
            system_program,
            system_program::Transfer {
                from: from_wallet,
                to: to_pda,
            },
        );
        system_program::transfer(cpi_ctx, amount)
    } else {
        // SPL token transfer
        let cpi_ctx = CpiContext::new(
            token_program.unwrap(),
            token::Transfer {
                from: from_token.unwrap(),
                to: to_token.unwrap(),
                authority: from_wallet,
            },
        );
        token::transfer(cpi_ctx, amount)
    }
}
```

### Claim Instructions - Create ATAs

```rust
#[derive(Accounts)]
pub struct ClaimJurorReward<'info> {
    #[account(mut)]
    pub juror: Signer<'info>,  // Pays rent for ATA if created

    #[account(mut)]
    pub juror_pool: Account<'info, JurorPool>,

    #[account(mut)]
    pub escrow: Account<'info, Escrow>,

    pub subject: Account<'info, Subject>,

    // Pool's ATA for subject's mint - created if needed
    #[account(
        init_if_needed,
        payer = juror,
        associated_token::mint = mint,
        associated_token::authority = juror_pool,
    )]
    pub juror_pool_token_account: Account<'info, TokenAccount>,

    // Escrow's token account (source of rewards)
    #[account(mut)]
    pub escrow_token_account: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
```

## What Stays the Same

| Component | Change? | Notes |
|-----------|---------|-------|
| Pool PDAs (JurorPool, ChallengerPool, DefenderPool) | No | Still store reputation + SOL |
| PDA derivation seeds | No | Same seeds |
| Reputation calculation | No | Token-agnostic |
| Voting power formula | No | sqrt(SOL_stake * reputation) |
| Dispute resolution logic | No | Same rules |
| Events | Minimal | Add mint field to relevant events |

## Instructions Affected

| Instruction | Changes |
|-------------|---------|
| `create_subject` | Add `mint` parameter, create subject ATA |
| `add_bond` | Add token accounts, conditional transfer |
| `create_dispute` | Add token accounts, create escrow ATA, conditional transfer |
| `join_challengers` | Add token accounts, conditional transfer |
| `vote` | No change (voting power from SOL) |
| `resolve_dispute` | Add token accounts, create treasury ATA, conditional transfer |
| `claim_juror_reward` | Add token accounts, create juror pool ATA |
| `claim_challenger_reward` | Add token accounts, create challenger pool ATA |
| `claim_defender_reward` | Add token accounts, create defender pool ATA |
| `sweep_round_treasury` | Add token accounts for treasury transfer |
| `register_juror` | No change (SOL only) |
| `deposit_to_pool` | No change (SOL only) |
| `withdraw_from_pool` | Add optional token withdrawal from pool ATAs |

## Token Account Architecture

```
Subject PDA
└── subject_token_account (ATA for subject.mint)
    └── Holds bonds + stakes during dispute

Escrow PDA
└── escrow_token_account (ATA for subject.mint)
    └── Holds funds for claims after resolution

Treasury (wallet/multisig from ProtocolConfig)
└── treasury_token_account_X (ATA per token received)
    └── Holds platform fees (1%) in various tokens

JurorPool PDA
├── Native lamports (SOL for voting power)
└── pool_token_account_X (ATA per token received)
    └── Holds rewards in various tokens

ChallengerPool PDA
├── Native lamports (SOL balance)
└── pool_token_account_X (ATA per token received)
    └── Holds rewards in various tokens

DefenderPool PDA
├── Native lamports (SOL balance)
└── pool_token_account_X (ATA per token received)
    └── Holds rewards in various tokens
```

### Treasury Token Accounts

Treasury receives platform fees (1%) during dispute resolution. With SPL support:

```rust
#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(mut)]
    pub resolver: Signer<'info>,  // Pays rent for treasury ATA if needed

    // ... other accounts

    /// Treasury wallet from protocol_config
    /// CHECK: Validated against protocol_config.treasury
    pub treasury: AccountInfo<'info>,

    /// Treasury's ATA for subject's mint - created if needed
    #[account(
        init_if_needed,
        payer = resolver,
        associated_token::mint = mint,
        associated_token::authority = treasury,
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,
    // ...
}
```

The first resolver for a new token pays ~0.002 SOL rent to create the treasury's ATA for that token.

## Validation Rules

### Create Subject
```rust
// If mint provided, verify it's a valid SPL token mint
if mint != Pubkey::default() {
    // Verify mint account exists and is a valid Mint
    require!(mint_account.is_initialized, InvalidMint);
}
```

### Add Bond / Create Dispute / Join Challengers
```rust
// Verify token account matches subject's mint
require!(
    token_account.mint == subject.mint,
    TribunalCraftError::MintMismatch
);
```

### Claims
```rust
// Pool's ATA must be for subject's mint
require!(
    pool_token_account.mint == subject.mint,
    TribunalCraftError::MintMismatch
);
```

## Rent Costs

| Account | Rent (SOL) | Who Pays | When Created |
|---------|------------|----------|--------------|
| Subject token ATA | ~0.002 | Subject creator | `create_subject` |
| Escrow token ATA | ~0.002 | Dispute creator | `create_dispute` |
| Treasury token ATA | ~0.002 | Resolver (first for that token) | `resolve_dispute` |
| JurorPool token ATA | ~0.002 | Juror (first claim in that token) | `claim_juror_reward` |
| ChallengerPool token ATA | ~0.002 | Challenger (first claim in that token) | `claim_challenger_reward` |
| DefenderPool token ATA | ~0.002 | Defender (first claim in that token) | `claim_defender_reward` |

Users only pay for ATAs they actually use. A juror who only participates in SOL subjects never creates additional ATAs.

**Fair cost distribution**: Each participant pays for their own storage. Treasury ATA cost is paid by the first resolver, which is a one-time cost per token for the entire protocol.

## Third-Party App Filtering

Apps implementing the protocol can filter subjects by token:

```sql
-- All USDC subjects
SELECT * FROM subjects WHERE mint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

-- All native SOL subjects
SELECT * FROM subjects WHERE mint = '11111111111111111111111111111111';

-- Or in subject derivation (app-specific)
const subjectId = deriveSubjectId(appId, contentHash, mint);
```

## Migration Path

1. **V1 (Current)**: Native SOL only
2. **V2 (This Design)**: SOL + SPL tokens, per-subject selection
3. **Future**: Per-token pools, auto-compound for SPL rewards

Existing SOL subjects continue to work unchanged. New subjects can choose any token.

## Error Codes

```rust
#[error_code]
pub enum TribunalCraftError {
    // ... existing errors

    #[msg("Token mint does not match subject's mint")]
    MintMismatch,

    #[msg("Invalid token mint account")]
    InvalidMint,

    #[msg("Token account not provided for SPL token subject")]
    MissingTokenAccount,
}
```

## SDK Changes

```typescript
// Create subject with token
await client.createSubject(
    subjectId,
    detailsCid,
    matchMode,
    votingPeriod,
    initialBond,
    mint  // NEW: Optional - defaults to native SOL
);

// SDK handles token account derivation
const subjectAta = getAssociatedTokenAddress(mint, subjectPda, true);
const escrowAta = getAssociatedTokenAddress(mint, escrowPda, true);
```

## Summary

Adding SPL token support requires:
1. Add `mint` field to Subject (+32 bytes)
2. Add token account params to ~12 instructions
3. Conditional transfer logic (SOL vs SPL)
4. Mint validation checks
5. ATA creation:
   - Subject ATA (creator pays)
   - Escrow ATA (dispute creator pays)
   - Treasury ATA (first resolver pays, one-time per token)
   - Pool ATAs (each claimer pays for their own)

The core protocol logic (reputation, voting power, dispute resolution) remains unchanged. The program stays permissionless - any SPL token can be used without protocol approval.

**Cost distribution is fair**: Each participant pays only for the ATAs they need. Native SOL subjects require no ATAs at all.
