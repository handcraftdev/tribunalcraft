import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/client";
import {
  parseSubject,
  parseDispute,
  parseJurorRecord,
  parseChallengerRecord,
  parseDefenderRecord,
  parseJurorPool,
  parseChallengerPool,
  parseDefenderPool,
  parseEscrow,
} from "@/lib/supabase/parse";
import { PublicKey, Connection } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { PROGRAM_ID } from "@tribunalcraft/sdk";

// Helius webhook payload types
interface HeliusWebhookPayload {
  webhookType: string;
  accountData?: AccountData[];
  nativeTransfers?: unknown[];
  tokenTransfers?: unknown[];
  signature?: string;
  slot?: number;
  timestamp?: number;
  type?: string;
  source?: string;
  // Enhanced transaction format
  description?: string;
  feePayer?: string;
  instructions?: unknown[];
}

interface AccountData {
  account: string;
  nativeBalanceChange: number;
  tokenBalanceChanges: unknown[];
  data?: {
    parsed?: unknown;
    raw?: string;
    program?: string;
    space?: number;
  };
}

// Account discriminators for TribunalCraft program
// These are the first 8 bytes of the account data that identify the account type
const DISCRIMINATORS: Record<string, string> = {
  subject: "subject",
  dispute: "dispute",
  jurorRecord: "juror_record",
  challengerRecord: "challenger_record",
  defenderRecord: "defender_record",
  jurorPool: "juror_pool",
  challengerPool: "challenger_pool",
  defenderPool: "defender_pool",
  escrow: "escrow",
};

// Verify webhook signature from Helius
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string | undefined
): boolean {
  // If no secret configured, skip verification (development mode)
  if (!secret) {
    console.warn("HELIUS_WEBHOOK_SECRET not configured, skipping signature verification");
    return true;
  }

  if (!signature) {
    console.error("No signature provided in webhook request");
    return false;
  }

  // Helius uses HMAC-SHA256 for webhook signatures
  // In production, implement proper HMAC verification here
  // For now, we'll do a simple comparison if the secret matches
  // TODO: Implement proper HMAC verification
  return true;
}

// Parse account data based on account type
async function parseAndUpsertAccount(
  supabase: ReturnType<typeof createServerClient>,
  accountPubkey: string,
  accountData: Buffer,
  slot: number
): Promise<{ success: boolean; accountType?: string }> {
  try {
    // The first 8 bytes are the discriminator
    const discriminator = accountData.slice(0, 8);

    // We need to identify the account type based on the discriminator
    // For now, we'll try to detect based on account size and structure
    // In a more robust implementation, you'd decode the discriminator properly

    const pubkey = new PublicKey(accountPubkey);

    // Try to decode as different account types
    // This is a simplified approach - in production you'd use proper IDL decoding

    // For now, we'll need to fetch the account from RPC to properly decode it
    // since Helius raw data needs Anchor's coder to decode
    console.log(`Received account update for ${accountPubkey}, slot ${slot}`);

    // Mark as needing sync - the account will be synced on next page load
    // or we can trigger an async sync here
    return { success: true, accountType: "unknown" };
  } catch (error) {
    console.error("Error parsing account:", error);
    return { success: false };
  }
}

// Handle enhanced transaction webhook (recommended approach)
async function handleEnhancedTransaction(
  supabase: ReturnType<typeof createServerClient>,
  payload: HeliusWebhookPayload
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  const slot = payload.slot || 0;

  // Process account changes from the transaction
  if (payload.accountData && Array.isArray(payload.accountData)) {
    for (const account of payload.accountData) {
      // Only process accounts owned by our program
      if (account.data?.program === PROGRAM_ID.toBase58()) {
        try {
          if (account.data.raw) {
            const buffer = Buffer.from(account.data.raw, "base64");
            const result = await parseAndUpsertAccount(
              supabase,
              account.account,
              buffer,
              slot
            );
            if (result.success) {
              processed++;
            } else {
              errors++;
            }
          }
        } catch (err) {
          console.error(`Error processing account ${account.account}:`, err);
          errors++;
        }
      }
    }
  }

  return { processed, errors };
}

// Sync accounts by fetching fresh data from RPC and upserting to Supabase
async function syncAccountsFromRPC(
  supabase: ReturnType<typeof createServerClient>,
  accountPubkeys: string[],
  slot: number
): Promise<{ synced: number; errors: number }> {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (!rpcUrl) {
    console.error("RPC URL not configured");
    return { synced: 0, errors: accountPubkeys.length };
  }

  const connection = new Connection(rpcUrl);
  let synced = 0;
  let errors = 0;

  // Import the SDK client for fetching
  const { TribunalCraftClient } = await import("@tribunalcraft/sdk");
  const client = new TribunalCraftClient({ connection });

  for (const pubkeyStr of accountPubkeys) {
    try {
      const pubkey = new PublicKey(pubkeyStr);

      // Try to fetch and identify the account type
      // We'll try each account type until one works

      // Try Subject
      try {
        const subject = await client.fetchSubject(pubkey);
        if (subject) {
          const row = parseSubject(pubkey, subject, slot);
          await (supabase as any).from("subjects").upsert(row, { onConflict: "id" });
          synced++;
          continue;
        }
      } catch { /* not a subject */ }

      // Try Dispute
      try {
        const dispute = await client.fetchDispute(pubkey);
        if (dispute) {
          const row = parseDispute(pubkey, dispute, slot);
          await (supabase as any).from("disputes").upsert(row, { onConflict: "id" });
          synced++;
          continue;
        }
      } catch { /* not a dispute */ }

      // Try JurorRecord
      try {
        const record = await client.fetchJurorRecord(pubkey);
        if (record) {
          const row = parseJurorRecord(pubkey, record, slot);
          await (supabase as any).from("juror_records").upsert(row, { onConflict: "id" });
          synced++;
          continue;
        }
      } catch { /* not a juror record */ }

      // Try ChallengerRecord
      try {
        const record = await client.fetchChallengerRecord(pubkey);
        if (record) {
          const row = parseChallengerRecord(pubkey, record, slot);
          await (supabase as any).from("challenger_records").upsert(row, { onConflict: "id" });
          synced++;
          continue;
        }
      } catch { /* not a challenger record */ }

      // Try DefenderRecord
      try {
        const record = await client.fetchDefenderRecord(pubkey);
        if (record) {
          const row = parseDefenderRecord(pubkey, record, slot);
          await (supabase as any).from("defender_records").upsert(row, { onConflict: "id" });
          synced++;
          continue;
        }
      } catch { /* not a defender record */ }

      // Try JurorPool
      try {
        const pool = await client.fetchJurorPool(pubkey);
        if (pool) {
          const row = parseJurorPool(pubkey, pool, slot);
          await (supabase as any).from("juror_pools").upsert(row, { onConflict: "id" });
          synced++;
          continue;
        }
      } catch { /* not a juror pool */ }

      // Try ChallengerPool
      try {
        const pool = await client.fetchChallengerPool(pubkey);
        if (pool) {
          const row = parseChallengerPool(pubkey, pool, slot);
          await (supabase as any).from("challenger_pools").upsert(row, { onConflict: "id" });
          synced++;
          continue;
        }
      } catch { /* not a challenger pool */ }

      // Try DefenderPool
      try {
        const pool = await client.fetchDefenderPool(pubkey);
        if (pool) {
          const row = parseDefenderPool(pubkey, pool, slot);
          await (supabase as any).from("defender_pools").upsert(row, { onConflict: "id" });
          synced++;
          continue;
        }
      } catch { /* not a defender pool */ }

      // Try Escrow
      try {
        const escrow = await client.fetchEscrow(pubkey);
        if (escrow) {
          const row = parseEscrow(pubkey, escrow, slot);
          await (supabase as any).from("escrows").upsert(row, { onConflict: "id" });
          synced++;
          continue;
        }
      } catch { /* not an escrow */ }

      // Account type not recognized
      console.log(`Unknown account type for ${pubkeyStr}`);
    } catch (err) {
      console.error(`Error syncing account ${pubkeyStr}:`, err);
      errors++;
    }
  }

  return { synced, errors };
}

export async function POST(request: NextRequest) {
  try {
    // Get the raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get("x-helius-signature");
    const webhookSecret = process.env.HELIUS_WEBHOOK_SECRET;

    // Verify webhook signature
    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    // Parse the payload
    let payload: HeliusWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    // Create server-side Supabase client
    let supabase;
    try {
      supabase = createServerClient();
    } catch (error) {
      console.error("Supabase not configured:", error);
      // Return success to not retry if Supabase isn't configured
      return NextResponse.json({ message: "Supabase not configured, skipping" });
    }

    const slot = payload.slot || 0;

    // Collect all account pubkeys that were affected
    const affectedAccounts: string[] = [];

    if (payload.accountData) {
      for (const account of payload.accountData) {
        // Check if this account is owned by our program
        if (account.data?.program === PROGRAM_ID.toBase58()) {
          affectedAccounts.push(account.account);
        }
      }
    }

    if (affectedAccounts.length > 0) {
      // Sync accounts from RPC to Supabase
      const result = await syncAccountsFromRPC(supabase, affectedAccounts, slot);

      console.log(
        `Webhook processed: ${result.synced} synced, ${result.errors} errors at slot ${slot}`
      );

      return NextResponse.json({
        success: true,
        accountsAffected: affectedAccounts.length,
        synced: result.synced,
        errors: result.errors,
        slot,
      });
    }

    return NextResponse.json({
      success: true,
      accountsAffected: 0,
      slot,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    programId: PROGRAM_ID.toBase58(),
  });
}
