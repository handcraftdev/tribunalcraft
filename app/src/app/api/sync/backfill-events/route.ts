import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { BorshCoder, EventParser } from "@coral-xyz/anchor";
import { createServerClient } from "@/lib/supabase/client";
import { PROGRAM_ID, IDL } from "@tribunalcraft/sdk";
import type { ProgramEventInsert } from "@/lib/supabase/types";

// =============================================================================
// Configuration
// =============================================================================

const BATCH_SIZE = 100; // Signatures per batch
const MAX_SIGNATURES = 1000; // Max signatures per request (Helius limit)
const DELAY_MS = 100; // Delay between RPC calls to avoid rate limiting

// =============================================================================
// Event Parsing (same as webhook)
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
    // Ignore parse errors for individual transactions
  }

  return events;
}

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

  switch (event.name) {
    // NOTE: IDL uses snake_case field names (subject_id, bond_at_risk, etc.)
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
      return {
        ...base,
        data: d,
      };
  }
}

// =============================================================================
// RPC Configuration
// =============================================================================

function getRpcEndpoint(): string | null {
  const rpcUrl = process.env.SOLANA_RPC_URL;
  const apiKey = process.env.SOLANA_RPC_API_KEY;
  if (rpcUrl && apiKey) {
    const url = new URL(rpcUrl);
    url.searchParams.set("api-key", apiKey);
    return url.toString();
  }
  return rpcUrl || null;
}

// =============================================================================
// Backfill Logic
// =============================================================================

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  // Check for admin secret
  const authHeader = request.headers.get("authorization");
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const endpoint = getRpcEndpoint();
    if (!endpoint) {
      return NextResponse.json({ error: "RPC not configured" }, { status: 503 });
    }

    let supabase;
    try {
      supabase = createServerClient();
    } catch {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    // Parse request body for options
    const body = await request.json().catch(() => ({}));
    const limit = Math.min(body.limit || MAX_SIGNATURES, MAX_SIGNATURES);
    const beforeSignature = body.before || undefined;

    const connection = new Connection(endpoint, "confirmed");

    console.log(`[Backfill] Starting event backfill, limit: ${limit}`);

    // Get signatures for the program
    const signatures = await connection.getSignaturesForAddress(PROGRAM_ID, {
      limit,
      before: beforeSignature,
    });

    console.log(`[Backfill] Found ${signatures.length} signatures`);

    if (signatures.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No signatures found",
        processed: 0,
        events: 0,
      });
    }

    let totalProcessed = 0;
    let totalEvents = 0;
    let totalErrors = 0;
    let lastSignature = signatures[signatures.length - 1]?.signature;

    // Process in batches
    for (let i = 0; i < signatures.length; i += BATCH_SIZE) {
      const batch = signatures.slice(i, i + BATCH_SIZE);
      const allRows: ProgramEventInsert[] = [];

      for (const sigInfo of batch) {
        try {
          // Fetch transaction
          const tx = await connection.getParsedTransaction(sigInfo.signature, {
            maxSupportedTransactionVersion: 0,
          });

          if (!tx?.meta?.logMessages) {
            totalProcessed++;
            continue;
          }

          // Parse events
          const events = parseEventsFromLogs(tx.meta.logMessages);

          if (events.length > 0) {
            // Convert to rows
            const rows = events.map((event, index) =>
              eventToRow(
                event,
                sigInfo.signature,
                index,
                tx.slot,
                tx.blockTime ?? null
              )
            );
            allRows.push(...rows);
          }

          totalProcessed++;

          // Rate limiting
          await delay(DELAY_MS);
        } catch (error) {
          console.error(`[Backfill] Error processing ${sigInfo.signature}:`, error);
          totalErrors++;
        }
      }

      // Batch insert events
      if (allRows.length > 0) {
        const { error } = await (supabase as any)
          .from("program_events")
          .upsert(allRows, { onConflict: "id" });

        if (error) {
          console.error("[Backfill] Insert error:", error);
          totalErrors += allRows.length;
        } else {
          totalEvents += allRows.length;
          console.log(`[Backfill] Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${allRows.length} events`);
        }
      }
    }

    console.log(`[Backfill] Complete: ${totalProcessed} txs, ${totalEvents} events, ${totalErrors} errors`);

    return NextResponse.json({
      success: true,
      processed: totalProcessed,
      events: totalEvents,
      errors: totalErrors,
      lastSignature,
      hasMore: signatures.length === limit,
    });
  } catch (error) {
    console.error("[Backfill] Error:", error);
    return NextResponse.json(
      { error: "Backfill failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

// Status endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    description: "Event backfill endpoint - POST with Authorization: Bearer <ADMIN_SECRET>",
    options: {
      limit: "Max signatures to process (default: 1000)",
      before: "Start from this signature (for pagination)",
    },
  });
}
