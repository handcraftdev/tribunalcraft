import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { BorshCoder, EventParser } from "@coral-xyz/anchor";
import { createServerClient } from "@/lib/supabase/client";
import { TribunalCraftClient, pda, PROGRAM_ID, IDL } from "@tribunalcraft/sdk";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
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
import type { ProgramEventInsert } from "@/lib/supabase/types";

// Sync request types
type SyncType =
  | "subject"
  | "dispute"
  | "jurorRecord"
  | "challengerRecord"
  | "defenderRecord"
  | "jurorPool"
  | "challengerPool"
  | "defenderPool"
  | "escrow"
  | "markClosed"
  | "transaction";

interface SyncRequest {
  type: SyncType;
  subjectId?: string;
  owner?: string;
  round?: number;
  // For markClosed type
  recordType?: "jurorRecord" | "challengerRecord" | "defenderRecord";
  recordId?: string;
  // For transaction type
  signature?: string;
}

// =============================================================================
// Event Parsing (for transaction sync)
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
  } catch {
    // Ignore parse errors
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

  // Map event fields based on event type (IDL uses snake_case)
  switch (event.name) {
    case "SubjectCreatedEvent":
      return { ...base, subject_id: toPubkeyString(d.subject_id), actor: toPubkeyString(d.creator), data: { matchMode: d.match_mode, votingPeriod: toNumber(d.voting_period), timestamp: toNumber(d.timestamp) } };
    case "BondAddedEvent":
      return { ...base, subject_id: toPubkeyString(d.subject_id), round: toNumber(d.round), actor: toPubkeyString(d.defender), amount: toNumber(d.amount), data: { source: getEnumVariant(d.source), timestamp: toNumber(d.timestamp) } };
    case "DisputeCreatedEvent":
      return { ...base, subject_id: toPubkeyString(d.subject_id), round: toNumber(d.round), actor: toPubkeyString(d.creator), amount: toNumber(d.stake), data: { bondAtRisk: toNumber(d.bond_at_risk), votingEndsAt: toNumber(d.voting_ends_at), timestamp: toNumber(d.timestamp) } };
    case "ChallengerJoinedEvent":
      return { ...base, subject_id: toPubkeyString(d.subject_id), round: toNumber(d.round), actor: toPubkeyString(d.challenger), amount: toNumber(d.stake), data: { totalStake: toNumber(d.total_stake), timestamp: toNumber(d.timestamp) } };
    case "VoteEvent":
      return { ...base, subject_id: toPubkeyString(d.subject_id), round: toNumber(d.round), actor: toPubkeyString(d.juror), amount: toNumber(d.voting_power), data: { choice: getEnumVariant(d.choice), votingPower: toNumber(d.voting_power), rationaleCid: d.rationale_cid || null, timestamp: toNumber(d.timestamp) } };
    case "RestoreVoteEvent":
      return { ...base, subject_id: toPubkeyString(d.subject_id), round: toNumber(d.round), actor: toPubkeyString(d.juror), amount: toNumber(d.voting_power), data: { choice: getEnumVariant(d.choice), votingPower: toNumber(d.voting_power), rationaleCid: d.rationale_cid || null, timestamp: toNumber(d.timestamp) } };
    case "AddToVoteEvent":
      return { ...base, subject_id: toPubkeyString(d.subject_id), round: toNumber(d.round), actor: toPubkeyString(d.juror), amount: toNumber(d.additional_stake), data: { additionalVotingPower: toNumber(d.additional_voting_power), totalStake: toNumber(d.total_stake), totalVotingPower: toNumber(d.total_voting_power), timestamp: toNumber(d.timestamp) } };
    case "DisputeResolvedEvent":
      return { ...base, subject_id: toPubkeyString(d.subject_id), round: toNumber(d.round), amount: toNumber(d.total_stake), data: { outcome: getEnumVariant(d.outcome), totalStake: toNumber(d.total_stake), bondAtRisk: toNumber(d.bond_at_risk), winnerPool: toNumber(d.winner_pool), jurorPool: toNumber(d.juror_pool), resolvedAt: toNumber(d.resolved_at), timestamp: toNumber(d.timestamp) } };
    case "RestoreSubmittedEvent":
      return { ...base, subject_id: toPubkeyString(d.subject_id), round: toNumber(d.round), actor: toPubkeyString(d.restorer), amount: toNumber(d.stake), data: { detailsCid: d.details_cid || null, votingPeriod: toNumber(d.voting_period), timestamp: toNumber(d.timestamp) } };
    case "RewardClaimedEvent":
      return { ...base, subject_id: toPubkeyString(d.subject_id), round: toNumber(d.round), actor: toPubkeyString(d.claimer), amount: toNumber(d.amount), data: { role: getEnumVariant(d.role), timestamp: toNumber(d.timestamp) } };
    case "StakeUnlockedEvent":
      return { ...base, subject_id: toPubkeyString(d.subject_id), round: toNumber(d.round), actor: toPubkeyString(d.juror), amount: toNumber(d.amount), data: { timestamp: toNumber(d.timestamp) } };
    case "RecordClosedEvent":
      return { ...base, subject_id: toPubkeyString(d.subject_id), round: toNumber(d.round), actor: toPubkeyString(d.owner), amount: toNumber(d.rent_returned), data: { role: getEnumVariant(d.role), timestamp: toNumber(d.timestamp) } };
    case "RoundSweptEvent":
      return { ...base, subject_id: toPubkeyString(d.subject_id), round: toNumber(d.round), actor: toPubkeyString(d.sweeper), amount: toNumber(d.unclaimed), data: { botReward: toNumber(d.bot_reward), timestamp: toNumber(d.timestamp) } };
    case "PoolDepositEvent":
      return { ...base, actor: toPubkeyString(d.owner), amount: toNumber(d.amount), data: { poolType: getEnumVariant(d.pool_type), timestamp: toNumber(d.timestamp) } };
    case "PoolWithdrawEvent":
      return { ...base, actor: toPubkeyString(d.owner), amount: toNumber(d.amount), data: { poolType: getEnumVariant(d.pool_type), slashed: toNumber(d.slashed), timestamp: toNumber(d.timestamp) } };
    default:
      return { ...base, data: d };
  }
}

// RPC endpoint
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

// Slot-aware upsert
async function slotAwareUpsert(
  supabase: ReturnType<typeof createServerClient>,
  table: string,
  row: Record<string, unknown>,
  idField: string = "id"
): Promise<{ success: boolean; error?: string }> {
  const id = row[idField];
  const incomingSlot = (row.slot as number) || 0;

  try {
    // Check existing slot
    const { data: existing, error: fetchError } = await (supabase as any)
      .from(table)
      .select("slot")
      .eq(idField, id)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      return { success: false, error: fetchError.message };
    }

    // Skip if existing is newer
    if (existing?.slot && existing.slot > incomingSlot) {
      return { success: true }; // Skipped, but not an error
    }

    // Upsert
    const { error: upsertError } = await (supabase as any)
      .from(table)
      .upsert(row, { onConflict: idField });

    if (upsertError) {
      return { success: false, error: upsertError.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function POST(request: NextRequest) {
  // Apply strict rate limiting (20 requests per minute per IP)
  const rateLimitResponse = await rateLimit(request, {
    ...RATE_LIMIT_CONFIGS.rpc,
    limit: 20, // Stricter than RPC
    identifier: "sync",
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await request.json();
    const requests: SyncRequest[] = Array.isArray(body) ? body : [body];

    // Limit batch size to prevent abuse
    if (requests.length > 10) {
      return NextResponse.json({ error: "Too many sync requests (max 10)" }, { status: 400 });
    }

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

    const connection = new Connection(endpoint, "confirmed");
    const client = new TribunalCraftClient({ connection });
    const slot = await connection.getSlot();

    const results: { type: string; success: boolean; error?: string }[] = [];

    for (const req of requests) {
      try {
        let success = false;
        let error: string | undefined;

        switch (req.type) {
          case "subject": {
            if (!req.subjectId) {
              results.push({ type: req.type, success: false, error: "subjectId required" });
              continue;
            }
            const subjectPubkey = new PublicKey(req.subjectId);
            const [subjectPda] = pda.subject(subjectPubkey);
            const account = await client.fetchSubject(subjectPda);
            if (account) {
              const row = parseSubject(subjectPda, account, slot);
              const result = await slotAwareUpsert(supabase, "subjects", row);
              success = result.success;
              error = result.error;
            }
            break;
          }

          case "dispute": {
            if (!req.subjectId) {
              results.push({ type: req.type, success: false, error: "subjectId required" });
              continue;
            }
            const subjectPubkey = new PublicKey(req.subjectId);
            const [disputePda] = pda.dispute(subjectPubkey);
            const account = await client.fetchDispute(disputePda);
            if (account) {
              const row = parseDispute(disputePda, account, slot);

              // If dispute is resolved, try to fetch escrow to get safe_bond, winner_pool, juror_pool
              if (account.status && "resolved" in account.status) {
                try {
                  const [escrowPda] = pda.escrow(subjectPubkey);
                  const escrow = await client.fetchEscrow(escrowPda);
                  if (escrow?.rounds) {
                    // Find the round matching this dispute
                    const roundResult = escrow.rounds.find(r => r.round === account.round);
                    if (roundResult) {
                      row.safe_bond = roundResult.safeBond?.toNumber() ?? 0;
                      row.winner_pool = roundResult.winnerPool?.toNumber() ?? 0;
                      row.juror_pool = roundResult.jurorPool?.toNumber() ?? 0;
                    }
                  }
                } catch {
                  // Escrow might not exist or be closed - that's ok, we'll use defaults
                }
              }

              const result = await slotAwareUpsert(supabase, "disputes", row);
              success = result.success;
              error = result.error;
            }
            break;
          }

          case "jurorRecord": {
            if (!req.subjectId || !req.owner || req.round === undefined) {
              results.push({ type: req.type, success: false, error: "subjectId, owner, round required" });
              continue;
            }
            const [recordPda] = pda.jurorRecord(
              new PublicKey(req.subjectId),
              new PublicKey(req.owner),
              req.round
            );
            const account = await client.fetchJurorRecord(recordPda);
            if (account) {
              const row = parseJurorRecord(recordPda, account, slot);
              const result = await slotAwareUpsert(supabase, "juror_records", row);
              success = result.success;
              error = result.error;
            }
            break;
          }

          case "challengerRecord": {
            if (!req.subjectId || !req.owner || req.round === undefined) {
              results.push({ type: req.type, success: false, error: "subjectId, owner, round required" });
              continue;
            }
            const [recordPda] = pda.challengerRecord(
              new PublicKey(req.subjectId),
              new PublicKey(req.owner),
              req.round
            );
            const account = await client.fetchChallengerRecord(recordPda);
            if (account) {
              const row = parseChallengerRecord(recordPda, account, slot);
              const result = await slotAwareUpsert(supabase, "challenger_records", row);
              success = result.success;
              error = result.error;
            }
            break;
          }

          case "defenderRecord": {
            if (!req.subjectId || !req.owner || req.round === undefined) {
              results.push({ type: req.type, success: false, error: "subjectId, owner, round required" });
              continue;
            }
            const [recordPda] = pda.defenderRecord(
              new PublicKey(req.subjectId),
              new PublicKey(req.owner),
              req.round
            );
            const account = await client.fetchDefenderRecord(recordPda);
            if (account) {
              const row = parseDefenderRecord(recordPda, account, slot);
              const result = await slotAwareUpsert(supabase, "defender_records", row);
              success = result.success;
              error = result.error;
            }
            break;
          }

          case "jurorPool": {
            if (!req.owner) {
              results.push({ type: req.type, success: false, error: "owner required" });
              continue;
            }
            const [poolPda] = pda.jurorPool(new PublicKey(req.owner));
            const account = await client.fetchJurorPool(poolPda);
            if (account) {
              const row = parseJurorPool(poolPda, account, slot);
              const result = await slotAwareUpsert(supabase, "juror_pools", row);
              success = result.success;
              error = result.error;
            }
            break;
          }

          case "challengerPool": {
            if (!req.owner) {
              results.push({ type: req.type, success: false, error: "owner required" });
              continue;
            }
            const [poolPda] = pda.challengerPool(new PublicKey(req.owner));
            const account = await client.fetchChallengerPool(poolPda);
            if (account) {
              const row = parseChallengerPool(poolPda, account, slot);
              const result = await slotAwareUpsert(supabase, "challenger_pools", row);
              success = result.success;
              error = result.error;
            }
            break;
          }

          case "defenderPool": {
            if (!req.owner) {
              results.push({ type: req.type, success: false, error: "owner required" });
              continue;
            }
            const [poolPda] = pda.defenderPool(new PublicKey(req.owner));
            const account = await client.fetchDefenderPool(poolPda);
            if (account) {
              const row = parseDefenderPool(poolPda, account, slot);
              const result = await slotAwareUpsert(supabase, "defender_pools", row);
              success = result.success;
              error = result.error;
            }
            break;
          }

          case "escrow": {
            if (!req.subjectId) {
              results.push({ type: req.type, success: false, error: "subjectId required" });
              continue;
            }
            const [escrowPda] = pda.escrow(new PublicKey(req.subjectId));
            const account = await client.fetchEscrow(escrowPda);
            if (account) {
              const row = parseEscrow(escrowPda, account, slot);
              const result = await slotAwareUpsert(supabase, "escrows", row);
              success = result.success;
              error = result.error;
            }
            break;
          }

          case "markClosed": {
            if (!req.recordType || !req.recordId) {
              results.push({ type: req.type, success: false, error: "recordType and recordId required" });
              continue;
            }

            // Map record type to table name
            const tableMap: Record<string, string> = {
              jurorRecord: "juror_records",
              challengerRecord: "challenger_records",
              defenderRecord: "defender_records",
            };
            const tableName = tableMap[req.recordType];

            if (!tableName) {
              results.push({ type: req.type, success: false, error: "Invalid recordType" });
              continue;
            }

            // Update the record to mark it as closed
            const { error: updateError } = await (supabase as any)
              .from(tableName)
              .update({ closed_at: new Date().toISOString() })
              .eq("id", req.recordId);

            if (updateError) {
              success = false;
              error = updateError.message;
            } else {
              success = true;
            }
            break;
          }

          case "transaction": {
            // Sync events from a transaction signature
            if (!req.signature) {
              results.push({ type: req.type, success: false, error: "signature required" });
              continue;
            }

            try {
              // Fetch the transaction
              const tx = await connection.getParsedTransaction(req.signature, {
                maxSupportedTransactionVersion: 0,
              });

              if (!tx?.meta?.logMessages) {
                results.push({ type: req.type, success: true }); // No logs, nothing to sync
                continue;
              }

              // Parse events from logs
              const events = parseEventsFromLogs(tx.meta.logMessages);

              if (events.length === 0) {
                results.push({ type: req.type, success: true }); // No events
                continue;
              }

              // Convert to rows
              const rows = events.map((event, index) =>
                eventToRow(event, req.signature!, index, tx.slot, tx.blockTime ?? null)
              );

              // Upsert events
              const { error: upsertError } = await (supabase as any)
                .from("program_events")
                .upsert(rows, { onConflict: "id" });

              if (upsertError) {
                success = false;
                error = upsertError.message;
              } else {
                success = true;
              }
            } catch (txError) {
              success = false;
              error = txError instanceof Error ? txError.message : "Failed to fetch transaction";
            }
            break;
          }
        }

        results.push({ type: req.type, success, error });
      } catch (err) {
        results.push({
          type: req.type,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({ results, slot });
  } catch (error) {
    console.error("Sync API error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
