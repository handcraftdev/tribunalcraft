# Third-Party App Integration Guide

This document explains how third-party applications can integrate with ScaleCraft and filter disputes specific to their app.

## Overview

ScaleCraft is a permissionless protocol. Any app can:
- Create subjects for their content
- Filter to show only their subjects/disputes
- Run their own indexer or use the shared Supabase

The protocol doesn't require registration or app IDs. Apps manage their own namespace through subject ID derivation.

## Subject ID Derivation (Recommended)

The `subject_id` is a `Pubkey` that can be derived from any source. Apps should derive it deterministically:

```typescript
import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "@scalecraft/sdk";

// App-specific identifier (your program ID or a fixed pubkey)
const APP_ID = new PublicKey("YourAppProgramId...");

// Derive subject_id for your app
function deriveSubjectId(contentHash: Buffer): PublicKey {
    const [subjectId] = PublicKey.findProgramAddressSync(
        [APP_ID.toBuffer(), contentHash],
        PROGRAM_ID
    );
    return subjectId;
}

// Create subject
const subjectId = deriveSubjectId(contentHash);
await client.createSubject(subjectId, detailsCid, ...);
```

### Benefits

1. **Verifiable ownership**: Anyone can verify if a subject belongs to your app by re-deriving
2. **No protocol changes**: Works with existing protocol
3. **Collision-free**: Different apps have different APP_IDs
4. **Deterministic**: Same content always produces same subject_id

## Filtering Options

### Option 1: Derivation Verification

Check if a subject_id matches your app's derivation:

```typescript
function isMySubject(subjectId: PublicKey, contentHash: Buffer): boolean {
    const expected = deriveSubjectId(contentHash);
    return subjectId.equals(expected);
}
```

### Option 2: Creator Address

Filter by the wallet that created subjects:

```sql
-- All subjects created by your backend wallet
SELECT * FROM subjects WHERE creator = 'your_wallet_pubkey';

-- Disputes for your subjects
SELECT d.* FROM disputes d
JOIN subjects s ON d.subject_id = s.subject_id
WHERE s.creator = 'your_wallet_pubkey';
```

### Option 3: Off-Chain Tracking

Store your subject_ids in your own database:

```typescript
// After creating subject
await yourDb.insert({
    subject_id: subjectId.toBase58(),
    content_id: contentId,
    created_at: Date.now()
});

// Query your subjects
const mySubjects = await yourDb.query("SELECT subject_id FROM my_subjects");
const subjectIds = mySubjects.map(s => s.subject_id);

// Query ScaleCraft data for your subjects
const disputes = await supabase
    .from("disputes")
    .select("*")
    .in("subject_id", subjectIds);
```

### Option 4: IPFS Metadata

Include app identifier in the subject's `details_cid` content:

```json
{
    "app_id": "your_app_identifier",
    "app_version": "1.0.0",
    "title": "Content Title",
    "description": "Content description",
    ...
}
```

Then index and filter by `app_id` in your database.

## Data Access Options

### 1. Use Shared Supabase (Easiest)

Query the ScaleCraft Supabase directly:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.SCALECRAFT_SUPABASE_URL,
    process.env.SCALECRAFT_SUPABASE_ANON_KEY
);

// Query subjects
const { data: subjects } = await supabase
    .from("subjects")
    .select("*")
    .eq("creator", yourWallet);

// Query disputes
const { data: disputes } = await supabase
    .from("disputes")
    .select("*")
    .eq("status", "pending");
```

### 2. Run Your Own Indexer

Set up your own Helius webhook and Supabase instance:

1. Create Supabase project
2. Run schema migrations from ScaleCraft
3. Configure Helius webhook pointing to your API
4. Filter events for your subjects only

```typescript
// Your webhook handler
export async function POST(req: Request) {
    const payload = await req.json();

    for (const tx of payload) {
        const events = parseEvents(tx.logs);

        for (const event of events) {
            // Only index if it's your subject
            if (isMySubject(event.subject_id)) {
                await indexEvent(event);
            }
        }
    }
}
```

### 3. Direct RPC Queries

Query on-chain accounts directly (no indexer):

```typescript
import { ScaleCraftClient } from "@scalecraft/sdk";

const client = new ScaleCraftClient({ connection });

// Fetch subject account
const subject = await client.getSubject(subjectId);

// Fetch dispute
const dispute = await client.getDispute(subjectId);

// Fetch all juror records for a subject
const jurorRecords = await client.getJurorRecords(subjectId);
```

## Architecture Patterns

### Pattern A: Shared Index (Recommended for MVP)

```
Your App
    │
    ▼
ScaleCraft Supabase (shared)
    │
    ▼
Filter by creator/subject_id
```

Pros: No infrastructure to maintain
Cons: Dependent on ScaleCraft availability

### Pattern B: Own Index (Recommended for Production)

```
Solana Program
    │
    ├──▶ Your Helius Webhook ──▶ Your Supabase
    │
    └──▶ ScaleCraft Webhook ──▶ ScaleCraft Supabase

Your App
    │
    ▼
Your Supabase (filtered)
```

Pros: Full control, can add custom fields
Cons: Infrastructure overhead

### Pattern C: Hybrid

```
Your App
    │
    ├──▶ Your DB (subject_id mapping)
    │
    └──▶ ScaleCraft Supabase (dispute data)
```

Track which subjects are yours, query dispute data from shared index.

## Event Filtering

When running your own webhook, filter by subject_id:

```typescript
const MY_SUBJECTS = new Set([...]); // Your tracked subjects

function shouldIndex(event: ProgramEvent): boolean {
    // Always index if it's your subject
    if (event.subject_id && MY_SUBJECTS.has(event.subject_id)) {
        return true;
    }

    // Index SubjectCreatedEvent if creator is your wallet
    if (event.event_type === "SubjectCreatedEvent" &&
        event.actor === YOUR_WALLET) {
        MY_SUBJECTS.add(event.subject_id);
        return true;
    }

    return false;
}
```

## SDK Usage

```typescript
import { ScaleCraftClient, PDA } from "@scalecraft/sdk";

// Initialize client
const client = new ScaleCraftClient({
    connection,
    wallet,
});

// Create subject for your app
const contentHash = sha256(contentData);
const subjectId = deriveSubjectId(contentHash);

const result = await client.createSubject(
    subjectId,
    detailsCid,
    true,  // matchMode
    86400, // votingPeriod (1 day)
    1_000_000_000 // initialBond (1 SOL)
);

// Later: verify it's your subject
const isYours = isMySubject(subjectId, contentHash);
```

## Best Practices

1. **Use deterministic derivation**: Don't use random subject_ids
2. **Store mappings**: Keep content_id → subject_id mapping in your DB
3. **Index early**: Start indexing before going live
4. **Handle missing data**: Subject may exist on-chain but not in index yet
5. **Verify ownership**: Always verify subject belongs to your app before displaying

## Common Patterns by Use Case

### Content Moderation Platform

```typescript
// Each piece of content gets a subject
const subjectId = deriveSubjectId(sha256(articleUrl));
await client.createSubject(subjectId, metadataCid, ...);

// Users can dispute inaccurate content
await client.createDispute(subjectId, stake, disputeType, detailsCid);
```

### NFT Authenticity Verification

```typescript
// Each NFT collection gets a subject
const subjectId = deriveSubjectId(collectionMint.toBuffer());
await client.createSubject(subjectId, verificationCid, ...);

// Community disputes fake collections
await client.createDispute(subjectId, stake, "accuracy", evidenceCid);
```

### DAO Proposal Validation

```typescript
// Each proposal gets a subject
const subjectId = deriveSubjectId(proposalPda.toBuffer());
await client.createSubject(subjectId, proposalCid, ...);

// Members can dispute misleading proposals
await client.createDispute(subjectId, stake, "bias", analysisCid);
```

## Summary

- Protocol is permissionless - no app registration needed
- Apps filter subjects through derivation, creator address, or off-chain tracking
- Can use shared Supabase or run own indexer
- Subject ID derivation is the recommended pattern (Solana-native, verifiable)
