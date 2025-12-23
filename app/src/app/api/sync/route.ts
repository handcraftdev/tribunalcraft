import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { createServerClient } from "@/lib/supabase/client";
import { TribunalCraftClient, pda } from "@tribunalcraft/sdk";
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
  | "escrow";

interface SyncRequest {
  type: SyncType;
  subjectId?: string;
  owner?: string;
  round?: number;
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
