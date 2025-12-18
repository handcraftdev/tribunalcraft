# Hybrid Escrow Model Implementation

## Overview

Replace current multi-PDA fund storage with:
1. **DisputeEscrow** - One per dispute, holds defender stakes + challenger bonds
2. **JurorAccount** - One per juror, balance-based accounting (no per-vote PDAs)
3. **Treasury** - Protocol-wide, receives platform fees

## Account Structures

### DisputeEscrow (NEW)

```rust
#[account]
pub struct DisputeEscrow {
    pub dispute: Pubkey,           // Associated dispute
    pub subject: Pubkey,           // Associated subject

    // Fund tracking
    pub total_bonds: u64,          // Total challenger bonds deposited
    pub total_stakes: u64,         // Total defender stakes deposited

    // Claim tracking
    pub bonds_claimed: u64,        // Bonds withdrawn via claims
    pub stakes_claimed: u64,       // Stakes withdrawn via claims
    pub juror_rewards_paid: u64,   // Rewards paid to jurors
    pub platform_fee_paid: u64,    // Fee sent to treasury

    // Claim counters (for close validation)
    pub challengers_claimed: u8,
    pub defenders_claimed: u8,
    pub expected_challengers: u8,
    pub expected_defenders: u8,

    pub bump: u8,
    pub created_at: i64,
}

impl DisputeEscrow {
    pub const LEN: usize = 8 + 32 + 32 + 8*6 + 4 + 1 + 8;

    pub fn total_balance(&self) -> u64 {
        (self.total_bonds + self.total_stakes)
            .saturating_sub(self.bonds_claimed)
            .saturating_sub(self.stakes_claimed)
            .saturating_sub(self.juror_rewards_paid)
            .saturating_sub(self.platform_fee_paid)
    }

    pub fn all_claimed(&self) -> bool {
        self.challengers_claimed >= self.expected_challengers &&
        self.defenders_claimed >= self.expected_defenders
    }
}
```

PDA Seeds: `["escrow", dispute.key()]`

### JurorAccount (UPDATED)

```rust
#[account]
pub struct JurorAccount {
    pub juror: Pubkey,

    // Balance accounting (NEW)
    pub balance: u64,              // Available to vote or withdraw
    pub held: u64,                 // Locked in active disputes

    // Reputation (existing)
    pub reputation: u16,
    pub votes_cast: u64,
    pub correct_votes: u64,

    pub is_active: bool,
    pub bump: u8,
    pub joined_at: i64,
    pub last_vote_at: i64,
}
```

### VoteRecord (SIMPLIFIED)

```rust
#[account]
pub struct VoteRecord {
    pub dispute: Pubkey,
    pub juror: Pubkey,
    pub juror_account: Pubkey,
    pub choice: VoteChoice,
    pub appeal_choice: AppealVoteChoice,
    pub is_appeal_vote: bool,

    pub stake_allocated: u64,      // From juror's held balance
    pub voting_power: u64,

    // Status flags
    pub reward_claimed: bool,
    pub stake_released: bool,      // NEW: track if held stake returned to balance

    pub bump: u8,
    pub voted_at: i64,
    pub rationale_cid: String,
}
```

Note: VoteRecord still exists for tracking votes, but:
- No SOL stored in it (stake stays in JurorAccount)
- Can be closed after claim to return rent

---

## Instruction Changes

### 1. Juror Balance Management (NEW)

```rust
// Deposit SOL to juror balance
pub fn deposit_juror(ctx: Context<DepositJuror>, amount: u64) -> Result<()> {
    // Transfer: User wallet → JurorAccount PDA
    transfer(user → juror_account, amount);
    juror_account.balance += amount;
}

// Withdraw SOL from juror balance
pub fn withdraw_juror(ctx: Context<WithdrawJuror>, amount: u64) -> Result<()> {
    require!(juror_account.balance >= amount);
    // Transfer: JurorAccount PDA → User wallet
    transfer(juror_account → user, amount);
    juror_account.balance -= amount;
}
```

### 2. Submit Dispute (UPDATED)

```rust
pub fn submit_dispute(ctx, dispute_type, details_cid, bond) -> Result<()> {
    // 1. Create DisputeEscrow PDA
    // 2. Transfer bond: Challenger wallet → DisputeEscrow
    // 3. Calculate stake to hold from defenders
    // 4. Transfer stakes: Subject PDA → DisputeEscrow (for direct stakes)
    // 5. Transfer stakes: DefenderPool PDA → DisputeEscrow (for pool stakes)

    escrow.total_bonds = bond;
    escrow.total_stakes = stake_held;
    escrow.expected_challengers = 1;
    escrow.expected_defenders = subject.defender_count;
}
```

### 3. Add to Dispute (UPDATED)

```rust
pub fn add_to_dispute(ctx, details_cid, bond) -> Result<()> {
    // Transfer additional bond: Challenger wallet → DisputeEscrow
    // Transfer additional stake hold: Subject/Pool → DisputeEscrow

    escrow.total_bonds += bond;
    escrow.total_stakes += additional_stake;
    escrow.expected_challengers += 1; // if new challenger
}
```

### 4. Vote on Dispute (UPDATED)

```rust
pub fn vote_on_dispute(ctx, choice, stake_allocation, rationale_cid) -> Result<()> {
    // NO SOL transfer - just accounting
    require!(juror_account.balance >= stake_allocation);

    juror_account.balance -= stake_allocation;
    juror_account.held += stake_allocation;

    vote_record.stake_allocated = stake_allocation;
    // ... rest of voting logic
}
```

### 5. Resolve Dispute (UPDATED)

```rust
pub fn resolve_dispute(ctx) -> Result<()> {
    // Calculate platform fee
    let total_pool = escrow.total_bonds + escrow.total_stakes;
    let platform_fee = total_pool * 1 / 100;  // 1%

    // Transfer platform fee: DisputeEscrow → Treasury
    transfer(escrow → treasury, platform_fee);
    escrow.platform_fee_paid = platform_fee;

    // ... outcome determination (existing logic)
}
```

### 6. Claim Challenger Reward (UPDATED)

```rust
pub fn claim_challenger_reward(ctx) -> Result<()> {
    // Calculate reward based on outcome
    let reward = calculate_challenger_reward(...);

    // Transfer: DisputeEscrow → Challenger wallet
    transfer(escrow → challenger, reward);

    escrow.bonds_claimed += bond_portion;
    escrow.stakes_claimed += reward_from_stakes;
    escrow.challengers_claimed += 1;

    challenger_record.reward_claimed = true;
}
```

### 7. Claim Defender Reward (UPDATED)

```rust
pub fn claim_defender_reward(ctx) -> Result<()> {
    let reward = calculate_defender_reward(...);

    // Transfer: DisputeEscrow → Defender wallet
    transfer(escrow → defender, reward);

    escrow.stakes_claimed += stake_return;
    escrow.bonds_claimed += reward_from_bonds;
    escrow.defenders_claimed += 1;

    defender_record.reward_claimed = true;
}
```

### 8. Claim Juror Reward (UPDATED)

```rust
pub fn claim_juror_reward(ctx) -> Result<()> {
    let reward = calculate_juror_reward(...);

    // Transfer reward: DisputeEscrow → JurorAccount (adds to balance)
    transfer(escrow → juror_account, reward);
    juror_account.balance += reward;

    // Release held stake (accounting only)
    juror_account.held -= vote_record.stake_allocated;
    juror_account.balance += vote_record.stake_allocated;

    escrow.juror_rewards_paid += reward;
    vote_record.reward_claimed = true;
    vote_record.stake_released = true;
}
```

### 9. Close Escrow (NEW)

```rust
pub fn close_escrow(ctx: Context<CloseEscrow>) -> Result<()> {
    require!(escrow.all_claimed(), "Not all claims processed");

    let remaining = escrow.to_account_info().lamports();
    let rent = Rent::get()?.minimum_balance(DisputeEscrow::LEN);
    let dust = remaining - rent;

    if dust > 0 {
        // Send dust to treasury
        transfer(escrow → treasury, dust);
    }

    // Close account, return rent to closer
    close(escrow → closer);
}
```

---

## Migration Plan

### Phase 1: Add New Accounts
1. Create `DisputeEscrow` state
2. Update `JurorAccount` with balance/held fields
3. Add `deposit_juror` / `withdraw_juror` instructions

### Phase 2: Update Dispute Flow
4. Update `submit_dispute` to create escrow
5. Update `add_to_dispute` to deposit to escrow
6. Stakes transfer to escrow on dispute creation

### Phase 3: Update Voting
7. Update `vote_on_dispute` to use balance accounting
8. Update `add_to_vote` similarly

### Phase 4: Update Claims
9. Update all claim instructions to pull from escrow
10. Add `close_escrow` instruction

### Phase 5: Frontend
11. Update hooks for new flow
12. Add deposit/withdraw UI for jurors

---

## Fund Flow Diagram

```
DEPOSIT PHASE:

  Challenger ──bond──►  ┌─────────────┐
                        │   Dispute   │
  Defender ───stake──►  │   Escrow    │
  (from Subject PDA)    │             │
                        │  (1 PDA per │
  Pool ───────stake──►  │   dispute)  │
  (from Pool PDA)       └─────────────┘

  Juror ────deposit───► ┌─────────────┐
                        │   Juror     │
                        │  Account    │
                        │  (1 per     │
                        │   juror)    │
                        └─────────────┘

VOTING PHASE (no transfers):

  JurorAccount.balance -= stake
  JurorAccount.held += stake

RESOLUTION:

  DisputeEscrow ──1% fee──► Treasury

CLAIM PHASE:

  DisputeEscrow ──reward──► Challenger wallet
  DisputeEscrow ──reward──► Defender wallet
  DisputeEscrow ──reward──► JurorAccount.balance

  JurorAccount.held -= stake
  JurorAccount.balance += stake

CLOSE:

  DisputeEscrow ──dust──► Treasury
  DisputeEscrow ──rent──► Closer
  (account closed)
```

---

## Files to Modify

### New Files
- `programs/tribunalcraft/src/state/dispute_escrow.rs`
- `programs/tribunalcraft/src/instructions/escrow.rs`
- `programs/tribunalcraft/src/instructions/juror_balance.rs`

### Modified Files
- `programs/tribunalcraft/src/state/mod.rs` - export DisputeEscrow
- `programs/tribunalcraft/src/state/juror_account.rs` - add balance/held
- `programs/tribunalcraft/src/state/vote_record.rs` - add stake_released
- `programs/tribunalcraft/src/instructions/mod.rs` - export new instructions
- `programs/tribunalcraft/src/instructions/challenger.rs` - escrow deposits
- `programs/tribunalcraft/src/instructions/vote.rs` - balance accounting
- `programs/tribunalcraft/src/instructions/resolve.rs` - escrow claims
- `programs/tribunalcraft/src/lib.rs` - new instruction handlers
- `app/src/idl/types.ts` - new types
- `app/src/hooks/useTribunalcraft.ts` - new methods
