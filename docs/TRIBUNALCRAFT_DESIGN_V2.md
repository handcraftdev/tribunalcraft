# TribunalCraft Design V2

## Overview

This document describes the redesigned dispute resolution system with:
- Round-based DefenderRecords
- Unified Pool system for all user types
- Single Escrow per subject for claims
- Simplified fund flows

---

## Terminology

| Term | Description |
|------|-------------|
| **Bond** | Defender's stake backing a subject |
| **Stake** | Challenger's stake disputing a subject |
| **Round** | Dispute cycle number (0, 1, 2, ...) |
| **Match Mode** | Bond at risk = challenger stake (capped) |
| **Prop Mode** | Bond at risk = all available bond |

---

## PDA Structures

### Persistent PDAs (created once, reused)

```rust
Subject [SUBJECT_SEED, subject_id] {
    subject_id: Pubkey,
    creator: Pubkey,           // For auto-bond on reset
    round: u32,                // Current round counter
    available_bond: u64,       // Total bond for current round
    defender_count: u16,       // Defenders in current round
    status: SubjectStatus,     // None | Valid | Disputed | Dormant | Invalid
    match_mode: bool,
    voting_period: i64,
    dispute: Pubkey,           // Active dispute (or default)
    bump: u8,
    created_at: i64,
}

enum SubjectStatus {
    None,       // Not initialized
    Valid,      // Has bond, can be disputed
    Disputed,   // Active dispute
    Dormant,    // No bond, waiting for defenders
    Invalid,    // Challenger won, subject invalidated
}

Dispute [DISPUTE_SEED, subject_id] {
    subject_id: Pubkey,
    round: u32,                // Which round
    status: DisputeStatus,     // None | Pending | Resolved

    // Challenger side
    total_stake: u64,
    challenger_count: u16,

    // Defender side
    bond_at_risk: u64,         // Running total
    defender_count: u16,       // Running count

    // Voting
    votes_for_challenger: u64,
    votes_for_defender: u64,
    vote_count: u16,
    voting_starts_at: i64,
    voting_ends_at: i64,

    // Resolution
    outcome: Outcome,
    resolved_at: i64,

    bump: u8,
    created_at: i64,
}

enum DisputeStatus {
    None,       // No active dispute
    Pending,    // Voting in progress
    Resolved,   // Outcome determined
}

enum Outcome {
    None,
    ChallengerWins,
    DefenderWins,
    NoAction,   // No votes cast
}

Escrow [ESCROW_SEED, subject_id] {
    subject_id: Pubkey,
    balance: u64,              // Claim funds
    rounds: Vec<RoundResult>,  // Historical data for claims
    bump: u8,
}

struct RoundResult {
    round: u32,
    creator: Pubkey,           // Dispute creator (for rent refund + sweep)
    resolved_at: i64,          // Timestamp for grace period
    outcome: Outcome,
    total_stake: u64,          // Challenger side
    bond_at_risk: u64,         // Defender side
    total_vote_weight: u64,
    winner_pool: u64,          // 80%
    juror_pool: u64,           // 19%

    // Participant counts (set at resolution)
    defender_count: u16,
    challenger_count: u16,
    juror_count: u16,

    // Claim tracking
    defender_claims: u16,
    challenger_claims: u16,
    juror_claims: u16,
}

const CLAIM_GRACE_PERIOD: i64 = 30 * 24 * 60 * 60;    // 30 days
const TREASURY_SWEEP_PERIOD: i64 = 90 * 24 * 60 * 60; // 90 days
const BOT_REWARD_BPS: u64 = 100;                       // 1% reward for caller
```

### User Pool PDAs (one per user per role)

```rust
DefenderPool [DEFENDER_POOL_SEED, owner] {
    owner: Pubkey,
    balance: u64,              // Available funds
    max_bond: u64,             // Max auto-allocation per subject
    bump: u8,
}

ChallengerPool [CHALLENGER_POOL_SEED, owner] {
    owner: Pubkey,
    balance: u64,
    bump: u8,
}

JurorPool [JUROR_POOL_SEED, owner] {
    owner: Pubkey,
    balance: u64,
    reputation: u64,           // Voting reputation
    bump: u8,
}
```

### Per-Round PDAs (created per round, closed after claim)

```rust
DefenderRecord [DEFENDER_RECORD_SEED, subject_id, defender, round] {
    subject_id: Pubkey,
    defender: Pubkey,
    round: u32,
    bond: u64,
    source: BondSource,        // Direct | Pool
    reward_claimed: bool,
    bump: u8,
}

enum BondSource {
    Direct,    // From wallet
    Pool,      // From DefenderPool
}

ChallengerRecord [CHALLENGER_RECORD_SEED, subject_id, challenger, round] {
    subject_id: Pubkey,
    challenger: Pubkey,
    round: u32,
    stake: u64,
    reward_claimed: bool,
    bump: u8,
}

JurorRecord [JUROR_RECORD_SEED, subject_id, juror, round] {
    subject_id: Pubkey,
    juror: Pubkey,
    round: u32,
    choice: VoteChoice,
    voting_power: u64,
    reward_claimed: bool,
    bump: u8,
}

enum VoteChoice {
    ForChallenger,
    ForDefender,
}
```

---

## Process Flow

```
┌─────────────┐
│ 1. CREATE   │ Subject + Escrow + Dispute PDAs
└──────┬──────┘
       ▼
┌─────────────┐
│ 2. BOND     │ Defenders add bond
└──────┬──────┘
       ▼
┌─────────────┐
│ 3. DISPUTE  │ Challenger stakes, voting starts
└──────┬──────┘
       ▼
┌─────────────┐
│ 4. VOTING   │ Jurors vote
└──────┬──────┘
       ▼
┌─────────────┐
│ 5. RESOLVE  │ Outcome, funds to Escrow, reset
└──────┬──────┘
       ▼
┌─────────────┐
│ 6. CLAIM    │ Winners claim from Escrow → Pool
│             │ (Auto-compact on last claim)
└──────┬──────┘
       ▼
┌─────────────┐
│ 7. CLOSE    │ Close records, reclaim rent
└──────┬──────┘
       ▼
     (Next round)

┌─────────────────────────────────────────────────────────┐
│ 8. SWEEP    │ Day 30-90: Creator sweeps                 │
│             │ Day 90+: Anyone sweeps (1% bot reward)    │
└─────────────────────────────────────────────────────────┘
```

---

## Phase Details

### Phase 1: CREATE SUBJECT

**Instruction:** `create_subject(subject_id, match_mode, voting_period)`

**Signer:** Creator (pays rent)

**PDAs Created:**
- Subject
- Dispute
- Escrow

**Data Flow:**
```
Subject:
  subject_id = subject_id
  creator = signer
  round = 0
  available_bond = 0
  defender_count = 0
  status = Dormant

Dispute:
  subject_id = subject_id
  status = None

Escrow:
  subject_id = subject_id
  balance = 0
  rounds = []
```

**Funds:** Creator pays rent for 3 PDAs

---

### Phase 2: ADD BOND

**Instruction:** `add_bond(subject_id, amount, source)`

**Signer:** Defender

**Constraints:**
- Subject.status != Invalid
- If source = Pool: amount capped to DefenderPool.max_bond

**Data Flow:**
```
Create or update DefenderRecord:
  subject_id = subject_id
  defender = signer
  round = Subject.round
  bond += amount
  source = source

Subject:
  available_bond += amount
  defender_count++ (if new defender)
  status = Valid (if was Dormant)
```

**Funds Flow:**
```
If Direct:
  Wallet → Subject PDA

If Pool:
  DefenderPool.balance -= amount
  Pool PDA → Subject PDA
```

---

### Phase 3: CREATE DISPUTE

**Instruction:** `create_dispute(subject_id, stake)`

**Signer:** Challenger (pays rent + realloc)

**Constraints:**
- Subject.status == Valid
- Dispute.status == None
- Match mode: stake <= Subject.available_bond

**Data Flow:**
```
Calculate bond_at_risk:
  Match: bond_at_risk = stake
  Prop:  bond_at_risk = Subject.available_bond

Realloc Escrow (+RoundResult slot)
RoundResult.creator = signer  // For rent refund on last claim

Dispute:
  round = Subject.round
  status = Pending
  total_stake = stake
  challenger_count = 1
  bond_at_risk = bond_at_risk
  defender_count = Subject.defender_count
  voting_starts_at = now
  voting_ends_at = now + Subject.voting_period

ChallengerRecord:
  subject_id = subject_id
  challenger = signer
  round = Subject.round
  stake = stake
  reward_claimed = false

Subject:
  status = Disputed
  dispute = Dispute.key()
```

**Funds Flow:**
```
Wallet → Subject PDA: stake
Challenger pays: ChallengerRecord rent + Escrow realloc (~0.0003 SOL)
```

---

### Phase 4: JOIN (During Dispute)

**Challengers can add stake:**
```
Dispute.total_stake += stake
Dispute.challenger_count++
ChallengerRecord.stake += stake

Match mode:
  Dispute.bond_at_risk = min(total_stake, available_bond)
```

**Defenders can add bond:**
```
Subject.available_bond += amount
DefenderRecord.bond += amount

Prop mode:
  Dispute.bond_at_risk = Subject.available_bond

Match mode:
  Dispute.bond_at_risk = min(total_stake, available_bond)
```

---

### Phase 5: VOTING

**Instruction:** `vote(subject_id, choice, voting_power)`

**Signer:** Juror

**Constraints:**
- Dispute.status == Pending
- Within voting period
- Juror has voting power

**Data Flow:**
```
JurorRecord:
  subject_id = subject_id
  juror = signer
  round = Subject.round
  choice = choice
  voting_power = voting_power
  reward_claimed = false

Dispute:
  If ForChallenger: votes_for_challenger += voting_power
  If ForDefender: votes_for_defender += voting_power
  vote_count++
```

---

### Phase 6: RESOLVE

**Instruction:** `resolve(subject_id)`

**Signer:** Anyone (permissionless)

**Constraints:**
- Dispute.status == Pending
- Voting period ended

**Data Flow:**
```
1. Determine outcome:
   If no votes: NoAction
   If votes_for_challenger > votes_for_defender: ChallengerWins
   Else: DefenderWins

2. Calculate pools:
   total_pool = total_stake + bond_at_risk
   winner_pool = total_pool × 80%
   juror_pool = total_pool × 19%
   platform_fee = total_pool × 1%

3. Calculate non_risked (match mode direct only):
   non_risked = available_bond - bond_at_risk

4. Fill RoundResult in Escrow:
   round = Subject.round
   outcome = outcome
   total_stake = Dispute.total_stake
   bond_at_risk = Dispute.bond_at_risk
   total_vote_weight = votes_for + votes_against
   winner_pool = winner_pool
   juror_pool = juror_pool
   defender_count = Dispute.defender_count
   challenger_count = Dispute.challenger_count
   juror_count = Dispute.vote_count
   defender_claims = 0
   challenger_claims = 0
   juror_claims = 0

5. Reset Dispute:
   status = None
   (clear all fields)

6. Reset Subject:
   round++
   defender_count = 0
   available_bond = 0
   status = Dormant

7. Auto-bond from creator's pool:
   amount = min(DefenderPool.balance, DefenderPool.max_bond)
   If amount > 0:
     Create DefenderRecord(creator, new_round, amount, Pool)
     DefenderPool.balance -= amount
     Subject.available_bond = amount
     Subject.defender_count = 1
     Subject.status = Valid
```

**Funds Flow:**
```
Subject PDA → Escrow PDA: total_stake + bond_at_risk
Subject PDA → Treasury: platform_fee
Pool PDA → Subject PDA: auto-bond amount (if any)
```

---

### Phase 7: CLAIM

**Claim Defender:**
```
result = Escrow.rounds[round]
my_bond = DefenderRecord.bond
my_share = my_bond / result.bond_at_risk

Match Direct:
  non_risked = my_bond - (my_bond × result.bond_at_risk / total_bond_snapshot)
  If DefenderWins: payout = non_risked + (at_risk × 80%) + winner_pool × share
  If ChallengerWins: payout = non_risked
  If NoAction: payout = non_risked + (at_risk × 99%)

Match Pool / Prop (all at risk):
  If DefenderWins: payout = (my_bond × 80%) + winner_pool × share
  If ChallengerWins: payout = 0
  If NoAction: payout = my_bond × 99%

DefenderRecord.reward_claimed = true
Escrow.balance -= payout
DefenderPool.balance += payout
RoundResult.defender_claims++
```

**Claim Challenger:**
```
result = Escrow.rounds[round]
my_stake = ChallengerRecord.stake
my_share = my_stake / result.total_stake

If ChallengerWins: payout = (my_stake × 80%) + winner_pool × share
If DefenderWins: payout = 0
If NoAction: payout = my_stake × 99%

ChallengerRecord.reward_claimed = true
Escrow.balance -= payout
ChallengerPool.balance += payout
RoundResult.challenger_claims++
```

**Claim Juror:**
```
result = Escrow.rounds[round]
my_power = JurorRecord.voting_power
my_share = my_power / result.total_vote_weight

payout = result.juror_pool × my_share

JurorRecord.reward_claimed = true
Escrow.balance -= payout
JurorPool.balance += payout
RoundResult.juror_claims++
```

---

### Phase 8: CLOSE RECORDS

**Instruction:** `close_record(record, escrow)`

**Constraints:**
```rust
let round_swept = escrow.find_round(record.round).is_none();

require!(
    record.reward_claimed || round_swept,
    "Must claim first or wait for sweep"
);
```

**Can close if:**
1. `reward_claimed = true` (already claimed), OR
2. RoundResult doesn't exist (already swept)

**Action:**
- Close PDA
- Rent → owner wallet

**Scenarios:**
| Situation | Funds | Close | Rent |
|-----------|-------|-------|------|
| Claimed before sweep | Received | Yes | Returned |
| Swept before claim | Lost | Yes | Returned |
| Never claimed, not swept | Can claim | No | Locked |

---

### Auto-Compact on Last Claim

When the last claim for a round is processed, automatically compact:

**On every claim:**
```rust
// Increment claim counter
RoundResult.{role}_claims++

// Check if this was the last claim
if is_fully_claimed(result) {
    // Remove RoundResult from Escrow.rounds
    // Realloc Escrow (shrink)
    // Rent refund → RoundResult.creator
}
```

**Check if all claimed:**
```rust
fn is_fully_claimed(result: &RoundResult) -> bool {
    result.defender_claims == result.defender_count &&
    result.challenger_claims == result.challenger_count &&
    result.juror_claims == result.juror_count
}
```

**Benefits:**
- Automatic cleanup, no separate instruction
- Last claimer triggers compact
- Rent refunded to dispute creator
- Escrow stays lean

---

### Sweep Tiers

**Tier 1: Claims (0-30 days)**
- Normal claim period
- Winners claim from Escrow → Pool

**Tier 2: Creator Sweep (30-90 days)**

**Instruction:** `sweep_round(subject_id, round)`

**Signer:** RoundResult.creator only

**Constraints:**
```rust
now >= resolved_at + CLAIM_GRACE_PERIOD      // 30 days passed
now < resolved_at + TREASURY_SWEEP_PERIOD    // Before 90 days
```

**Action:**
```rust
remaining = calculate_unclaimed(result)
Escrow.balance -= remaining
Transfer: Escrow → RoundResult.creator

// Compact
Remove from Escrow.rounds
Realloc Escrow (shrink)
Rent refund → RoundResult.creator
```

**Tier 3: Treasury Sweep (90+ days)**

**Instruction:** `treasury_sweep(subject_id, round)`

**Signer:** Anyone (bot incentivized)

**Constraints:**
```rust
now >= resolved_at + TREASURY_SWEEP_PERIOD   // 90 days passed
```

**Action:**
```rust
remaining = calculate_unclaimed(result)
bot_reward = remaining * BOT_REWARD_BPS / 10000  // 1%
treasury_amount = remaining - bot_reward

Escrow.balance -= remaining
Transfer: Escrow → caller (bot_reward)
Transfer: Escrow → Treasury (treasury_amount)

// Compact
Remove from Escrow.rounds
Realloc Escrow (shrink)
Rent refund → Treasury
```

**Timeline:**
```
Day 0-30:   Claimers can claim (safe window)
Day 30-90:  Claimers can still claim, creator can sweep unclaimed
Day 90+:    Claimers can still claim, anyone can sweep (1% + rent to bot)
```

**Race condition after 30 days:**
- Claim first → receive funds
- Swept first → funds lost, but can still close record for rent

**Benefits:**
- Fair grace period for claimers (30 days)
- Dispute creator incentivized (30-90 days)
- Bot cleanup guaranteed (90+ days)
- Users always recover rent (even if swept)
- No permanent lock

---

## Pool Deposits & Withdrawals

### Deposits

**DefenderPool:**
- Via `add_bond` instruction
- Via `create_subject` (creator becomes first defender)
- Funds flow: Wallet → Action → Pool

**ChallengerPool:**
- Via `create_dispute` instruction
- Via `join_challengers` instruction
- Funds flow: Wallet → Action → Pool

**JurorPool:**
- Must deposit before voting
- Via `deposit_juror` instruction
- Funds flow: Wallet → JurorPool

### Withdrawals

**JurorPool:**
- No restrictions
- Can withdraw anytime (existing process)

**ChallengerPool:**
- No restrictions
- Can withdraw anytime

**DefenderPool:**
- Restricted: must maintain defense
- Can only withdraw: `balance - held_for_subjects`
- `held_for_subjects` = sum of active bonds across subjects

```rust
fn withdraw_defender(pool, amount) {
    let available = pool.balance - calculate_held(pool.owner);
    require!(amount <= available, "Funds locked for defense");
    transfer(pool → wallet, amount);
}
```

---

## Events

Emit events for analytics, indexing, and bot discovery:

```rust
// Subject lifecycle
SubjectCreatedEvent { subject_id, creator, match_mode, timestamp }
SubjectStatusChangedEvent { subject_id, old_status, new_status, timestamp }

// Bonding
BondAddedEvent { subject_id, defender, round, amount, source, timestamp }
BondWithdrawnEvent { defender, amount, timestamp }

// Dispute lifecycle
DisputeCreatedEvent { subject_id, round, creator, stake, timestamp }
ChallengerJoinedEvent { subject_id, round, challenger, stake, timestamp }

// Voting
VoteEvent { subject_id, round, juror, choice, voting_power, timestamp }

// Resolution
DisputeResolvedEvent {
    subject_id,
    round,
    outcome,
    total_stake,
    bond_at_risk,
    winner_pool,
    juror_pool,
    resolved_at,
    timestamp
}

// Claims
RewardClaimedEvent { subject_id, round, claimer, role, amount, timestamp }
RecordClosedEvent { subject_id, round, owner, role, rent_returned, timestamp }

// Sweep
RoundSweptEvent { subject_id, round, sweeper, unclaimed, bot_reward, timestamp }

// Restoration
RestoreRequestedEvent { subject_id, restorer, stake, timestamp }
RestoreResolvedEvent { subject_id, outcome, timestamp }
```

---

## Edge Cases

**Zero defenders:**
- Not possible: subject creator is always first defender
- `create_subject` auto-creates DefenderRecord for creator

**Zero votes (NoAction outcome):**
- Bond returned to challengers (minus 1% treasury)
- Stake returned to defenders (minus 1% treasury)
- Juror pool = 0 (no jurors to pay)

**Zero challengers after dispute created:**
- Not possible: dispute creator is first challenger
- `create_dispute` auto-creates ChallengerRecord

---

## Restoration Flow

When subject becomes Invalid (ChallengerWins):

1. **Request restore:** `request_restore(subject_id, stake)`
   - Subject.status must be Invalid
   - Restorer posts stake
   - Creates restoration dispute

2. **Voting:** Same as regular dispute
   - ForChallenger = support restoration
   - ForDefender = reject restoration

3. **Resolution:**
   - ChallengerWins → Subject restored to Valid, restorer becomes defender
   - DefenderWins → Subject stays Invalid, stake returned (minus fees)

*(Existing process, no changes)*

---

## Scenario Matrix

### Defender Scenarios

| Mode | Source | At Risk | Non-Risked | Win Payout | Lose Payout |
|------|--------|---------|------------|------------|-------------|
| Match | Direct | portion | to Escrow | non_risked + 80% + share | non_risked only |
| Match | Pool | stake amount | stays in Pool | 80% + share | 0 |
| Prop | Direct | all | none | 80% + share | 0 |
| Prop | Pool | max_bond | none | 80% + share | 0 |

### Challenger Scenarios

| Outcome | Payout |
|---------|--------|
| ChallengerWins | 80% of stake + share of winner_pool |
| DefenderWins | 0 (lose stake) |
| NoAction | 99% of stake |

### Juror Scenarios

| Outcome | Payout |
|---------|--------|
| Any | share of juror_pool (19%) |

---

## Fee Distribution

| Fee | Percentage | Recipient |
|-----|------------|-----------|
| Winner Pool | 80% | Winning side |
| Juror Pool | 19% | All jurors |
| Platform Fee | 1% | Treasury |

---

## Rent Costs

| PDA | Paid By | Reclaimed To |
|-----|---------|--------------|
| Subject | Creator | Creator on close |
| Dispute | Creator | Creator on close |
| Escrow | Creator | Creator on close |
| Escrow realloc | Dispute creator | Dispute creator (on last claim or sweep) |
| DefenderPool | User | User on close |
| ChallengerPool | User | User on close |
| JurorPool | User | User on close |
| DefenderRecord | Defender | Defender on close |
| ChallengerRecord | Challenger | Challenger on close |
| JurorRecord | Juror | Juror on close |

---

## Dilution

Adding bond/stake during dispute dilutes existing shares:

```
Before: Alice 60, Bob 40 → Alice 60%, Bob 40%
After:  Alice 60, Bob 40, Charlie 50 → Alice 40%, Bob 27%, Charlie 33%
```

Shares calculated at claim time:
```
share = my_contribution / total_contribution
```

---

## Auto-Bond on Resolution

After each resolution, creator's DefenderPool auto-bonds:

```
amount = min(DefenderPool.balance, DefenderPool.max_bond)

If amount > 0:
  Create DefenderRecord for new round
  Transfer: Pool → Subject
  Subject becomes Valid
```

This maintains continuous defense for the subject.
