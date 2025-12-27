import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createServerClient } from "@/lib/supabase/client";
import { PublicKey, Connection } from "@solana/web3.js";
import { BorshCoder, EventParser } from "@coral-xyz/anchor";
import { PROGRAM_ID, IDL } from "@scalecraft/sdk";
import type { ProgramEventInsert } from "@/lib/supabase/types";

// =============================================================================
// Types
// =============================================================================

interface HeliusWebhookPayload {
  // Array format (multiple transactions)
  0?: HeliusTransaction;
  length?: number;
  // Or single transaction format
  signature?: string;
  slot?: number;
  blockTime?: number;
  logs?: string[];
  meta?: {
    logMessages?: string[];
  };
  // Enhanced transaction fields
  accountData?: AccountData[];
  type?: string;
  source?: string;
  description?: string;
  feePayer?: string;
}

interface HeliusTransaction {
  signature: string;
  slot: number;
  blockTime?: number;
  meta?: {
    logMessages?: string[];
  };
  logs?: string[];
  accountData?: AccountData[];
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

// =============================================================================
// Webhook Verification
// =============================================================================

function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string | undefined
): boolean {
  if (!secret) {
    console.warn("HELIUS_WEBHOOK_SECRET not configured - skipping verification");
    return true; // Allow in dev mode
  }

  if (!signature) {
    console.error("No signature provided");
    return false;
  }

  try {
    const hmac = createHmac("sha256", secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest("hex");

    const signatureBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

// =============================================================================
// Event Parsing
// =============================================================================

function createEventParser(): EventParser {
  const coder = new BorshCoder(IDL as any);
  return new EventParser(PROGRAM_ID, coder);
}

interface ParsedEvent {
  name: string;
  data: Record<string, any>;
}

function parseEventsFromLogs(logs: string[]): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  const parser = createEventParser();

  try {
    for (const event of parser.parseLogs(logs)) {
      events.push({
        name: event.name,
        data: event.data as Record<string, any>,
      });
    }
  } catch (error) {
    console.error("Error parsing events:", error);
  }

  return events;
}

// =============================================================================
// Event to DB Row Conversion
// =============================================================================

function toNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (value.toNumber) return value.toNumber();
  if (value.toString) return Number(value.toString());
  return Number(value);
}

function toPubkeyString(value: any): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value.toBase58) return value.toBase58();
  if (value.toString) return value.toString();
  return null;
}

function getEnumVariant(value: any): string {
  if (!value || typeof value !== "object") return "unknown";
  const keys = Object.keys(value);
  return keys.length > 0 ? keys[0] : "unknown";
}

function eventToRow(
  event: ParsedEvent,
  signature: string,
  eventIndex: number,
  slot: number,
  blockTime: number | null
): ProgramEventInsert {
  const base: ProgramEventInsert = {
    id: `${signature}:${eventIndex}`,
    signature,
    slot,
    block_time: blockTime,
    event_type: event.name,
    subject_id: null,
    round: null,
    actor: null,
    amount: null,
    data: {},
  };

  const d = event.data;

  // NOTE: IDL uses snake_case field names (subject_id, bond_at_risk, etc.)
  switch (event.name) {
    case "SubjectCreatedEvent":
      return {
        ...base,
        subject_id: toPubkeyString(d.subject_id),
        actor: toPubkeyString(d.creator),
        data: {
          matchMode: d.match_mode,
          votingPeriod: toNumber(d.voting_period),
          timestamp: toNumber(d.timestamp),
        },
      };

    case "BondAddedEvent":
      return {
        ...base,
        subject_id: toPubkeyString(d.subject_id),
        round: toNumber(d.round),
        actor: toPubkeyString(d.defender),
        amount: toNumber(d.amount),
        data: {
          source: getEnumVariant(d.source),
          timestamp: toNumber(d.timestamp),
        },
      };

    case "DisputeCreatedEvent":
      return {
        ...base,
        subject_id: toPubkeyString(d.subject_id),
        round: toNumber(d.round),
        actor: toPubkeyString(d.creator),
        amount: toNumber(d.stake),
        data: {
          bondAtRisk: toNumber(d.bond_at_risk),
          votingEndsAt: toNumber(d.voting_ends_at),
          timestamp: toNumber(d.timestamp),
        },
      };

    case "ChallengerJoinedEvent":
      return {
        ...base,
        subject_id: toPubkeyString(d.subject_id),
        round: toNumber(d.round),
        actor: toPubkeyString(d.challenger),
        amount: toNumber(d.stake),
        data: {
          totalStake: toNumber(d.total_stake),
          timestamp: toNumber(d.timestamp),
        },
      };

    case "VoteEvent":
      return {
        ...base,
        subject_id: toPubkeyString(d.subject_id),
        round: toNumber(d.round),
        actor: toPubkeyString(d.juror),
        amount: toNumber(d.voting_power),
        data: {
          choice: getEnumVariant(d.choice),
          votingPower: toNumber(d.voting_power),
          rationaleCid: d.rationale_cid || null,
          timestamp: toNumber(d.timestamp),
        },
      };

    case "RestoreVoteEvent":
      return {
        ...base,
        subject_id: toPubkeyString(d.subject_id),
        round: toNumber(d.round),
        actor: toPubkeyString(d.juror),
        amount: toNumber(d.voting_power),
        data: {
          choice: getEnumVariant(d.choice),
          votingPower: toNumber(d.voting_power),
          rationaleCid: d.rationale_cid || null,
          timestamp: toNumber(d.timestamp),
        },
      };

    case "AddToVoteEvent":
      return {
        ...base,
        subject_id: toPubkeyString(d.subject_id),
        round: toNumber(d.round),
        actor: toPubkeyString(d.juror),
        amount: toNumber(d.additional_stake),
        data: {
          additionalVotingPower: toNumber(d.additional_voting_power),
          totalStake: toNumber(d.total_stake),
          totalVotingPower: toNumber(d.total_voting_power),
          timestamp: toNumber(d.timestamp),
        },
      };

    case "DisputeResolvedEvent":
      return {
        ...base,
        subject_id: toPubkeyString(d.subject_id),
        round: toNumber(d.round),
        amount: toNumber(d.total_stake),
        data: {
          outcome: getEnumVariant(d.outcome),
          totalStake: toNumber(d.total_stake),
          bondAtRisk: toNumber(d.bond_at_risk),
          winnerPool: toNumber(d.winner_pool),
          jurorPool: toNumber(d.juror_pool),
          resolvedAt: toNumber(d.resolved_at),
          timestamp: toNumber(d.timestamp),
        },
      };

    case "RestoreSubmittedEvent":
      return {
        ...base,
        subject_id: toPubkeyString(d.subject_id),
        round: toNumber(d.round),
        actor: toPubkeyString(d.restorer),
        amount: toNumber(d.stake),
        data: {
          detailsCid: d.details_cid || null,
          votingPeriod: toNumber(d.voting_period),
          timestamp: toNumber(d.timestamp),
        },
      };

    case "RewardClaimedEvent":
      return {
        ...base,
        subject_id: toPubkeyString(d.subject_id),
        round: toNumber(d.round),
        actor: toPubkeyString(d.claimer),
        amount: toNumber(d.amount),
        data: {
          role: getEnumVariant(d.role),
          timestamp: toNumber(d.timestamp),
        },
      };

    case "StakeUnlockedEvent":
      return {
        ...base,
        subject_id: toPubkeyString(d.subject_id),
        round: toNumber(d.round),
        actor: toPubkeyString(d.juror),
        amount: toNumber(d.amount),
        data: {
          timestamp: toNumber(d.timestamp),
        },
      };

    case "RecordClosedEvent":
      return {
        ...base,
        subject_id: toPubkeyString(d.subject_id),
        round: toNumber(d.round),
        actor: toPubkeyString(d.owner),
        amount: toNumber(d.rent_returned),
        data: {
          role: getEnumVariant(d.role),
          timestamp: toNumber(d.timestamp),
        },
      };

    case "RoundSweptEvent":
      return {
        ...base,
        subject_id: toPubkeyString(d.subject_id),
        round: toNumber(d.round),
        actor: toPubkeyString(d.sweeper),
        amount: toNumber(d.unclaimed),
        data: {
          botReward: toNumber(d.bot_reward),
          timestamp: toNumber(d.timestamp),
        },
      };

    case "PoolDepositEvent":
      return {
        ...base,
        actor: toPubkeyString(d.owner),
        amount: toNumber(d.amount),
        data: {
          poolType: getEnumVariant(d.pool_type),
          timestamp: toNumber(d.timestamp),
        },
      };

    case "PoolWithdrawEvent":
      return {
        ...base,
        actor: toPubkeyString(d.owner),
        amount: toNumber(d.amount),
        data: {
          poolType: getEnumVariant(d.pool_type),
          slashed: toNumber(d.slashed),
          timestamp: toNumber(d.timestamp),
        },
      };

    default:
      // Store unknown events with raw data
      return {
        ...base,
        data: d,
      };
  }
}

// =============================================================================
// Process Transaction
// =============================================================================

async function processTransaction(
  supabase: ReturnType<typeof createServerClient>,
  tx: {
    signature: string;
    slot: number;
    blockTime?: number | null;
    logs: string[];
  }
): Promise<{ events: number; errors: number }> {
  let eventsStored = 0;
  let errors = 0;

  // Parse events from logs
  const events = parseEventsFromLogs(tx.logs);

  if (events.length === 0) {
    return { events: 0, errors: 0 };
  }

  console.log(`[Helius] Tx ${tx.signature.slice(0, 8)}... has ${events.length} events:`, events.map(e => e.name));

  // Convert events to DB rows
  const rows: ProgramEventInsert[] = events.map((event, index) =>
    eventToRow(event, tx.signature, index, tx.slot, tx.blockTime ?? null)
  );

  // Batch upsert events
  const { error } = await (supabase as any)
    .from("program_events")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    console.error("[Helius] Error storing events:", error);
    errors = rows.length;
  } else {
    eventsStored = rows.length;
  }

  return { events: eventsStored, errors };
}

// =============================================================================
// Main Handler
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-helius-signature");
    const webhookSecret = process.env.HELIUS_WEBHOOK_SECRET;

    // Verify signature
    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Parse payload
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Create Supabase client
    let supabase;
    try {
      supabase = createServerClient();
    } catch (error) {
      console.warn("Supabase not configured, skipping");
      return NextResponse.json({ message: "Supabase not configured" });
    }

    let totalEvents = 0;
    let totalErrors = 0;

    // Handle array format (multiple transactions)
    if (Array.isArray(payload)) {
      for (const tx of payload) {
        if (!tx.signature) continue;

        const logs = tx.meta?.logMessages || tx.logs || [];
        if (logs.length === 0) continue;

        // Check if this transaction involves our program
        const programIdStr = PROGRAM_ID.toBase58();
        const involvesScaleCraft = logs.some((log: string) => log.includes(programIdStr));
        if (!involvesScaleCraft) continue;

        const result = await processTransaction(supabase, {
          signature: tx.signature,
          slot: tx.slot || 0,
          blockTime: tx.blockTime,
          logs,
        });

        totalEvents += result.events;
        totalErrors += result.errors;
      }
    }
    // Handle single transaction format
    else if (payload.signature) {
      const logs = payload.meta?.logMessages || payload.logs || [];
      if (logs.length > 0) {
        const programIdStr = PROGRAM_ID.toBase58();
        const involvesScaleCraft = logs.some((log: string) => log.includes(programIdStr));

        if (involvesScaleCraft) {
          const result = await processTransaction(supabase, {
            signature: payload.signature,
            slot: payload.slot || 0,
            blockTime: payload.blockTime,
            logs,
          });

          totalEvents += result.events;
          totalErrors += result.errors;
        }
      }
    }

    if (totalEvents > 0 || totalErrors > 0) {
      console.log(`[Helius] Processed: ${totalEvents} events, ${totalErrors} errors`);
    }

    return NextResponse.json({
      success: true,
      events: totalEvents,
      errors: totalErrors,
    });
  } catch (error) {
    console.error("[Helius] Webhook error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: "ok",
    programId: PROGRAM_ID.toBase58(),
    description: "Helius webhook for ScaleCraft events",
  });
}
