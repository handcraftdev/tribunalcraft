import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { createServerClient } from "@/lib/supabase/client";
import { ScaleCraftClient, pda, PROGRAM_ID } from "@scalecraft/sdk";
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

/**
 * Full sync endpoint - fetches ALL program accounts from RPC and syncs to Supabase
 * This is meant to be run once or periodically for initial data population
 * Protected by a secret key to prevent abuse
 */
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

    const connection = new Connection(endpoint, "confirmed");
    const client = new ScaleCraftClient({ connection });
    const slot = await connection.getSlot();

    const results = {
      subjects: { synced: 0, errors: 0 },
      disputes: { synced: 0, errors: 0 },
      jurorRecords: { synced: 0, errors: 0 },
      challengerRecords: { synced: 0, errors: 0 },
      defenderRecords: { synced: 0, errors: 0 },
      jurorPools: { synced: 0, errors: 0 },
      challengerPools: { synced: 0, errors: 0 },
      defenderPools: { synced: 0, errors: 0 },
      escrows: { synced: 0, errors: 0 },
    };

    // Fetch all subjects
    console.log("Fetching all subjects...");
    const allSubjects = await client.fetchAllSubjects();
    for (const subject of allSubjects) {
      try {
        const row = parseSubject(subject.publicKey, subject.account, slot);
        const { error } = await (supabase as any)
          .from("subjects")
          .upsert(row, { onConflict: "id" });
        if (error) {
          console.error(`Error syncing subject ${subject.publicKey.toBase58()}:`, error);
          results.subjects.errors++;
        } else {
          results.subjects.synced++;
        }
      } catch (err) {
        console.error(`Error parsing subject ${subject.publicKey.toBase58()}:`, err);
        results.subjects.errors++;
      }
    }

    // Fetch all disputes
    console.log("Fetching all disputes...");
    const allDisputes = await client.fetchAllDisputes();
    for (const dispute of allDisputes) {
      try {
        const row = parseDispute(dispute.publicKey, dispute.account, slot);

        // If dispute is resolved, try to get escrow data
        if (dispute.account.status && "resolved" in dispute.account.status) {
          try {
            const [escrowPda] = pda.escrow(dispute.account.subjectId);
            const escrow = await client.fetchEscrow(escrowPda);
            if (escrow?.rounds) {
              const roundResult = escrow.rounds.find(r => r.round === dispute.account.round);
              if (roundResult) {
                row.safe_bond = roundResult.safeBond?.toNumber() ?? 0;
                row.winner_pool = roundResult.winnerPool?.toNumber() ?? 0;
                row.juror_pool = roundResult.jurorPool?.toNumber() ?? 0;
              }
            }
          } catch {
            // Escrow might not exist
          }
        }

        const { error } = await (supabase as any)
          .from("disputes")
          .upsert(row, { onConflict: "id" });
        if (error) {
          console.error(`Error syncing dispute ${dispute.publicKey.toBase58()}:`, error);
          results.disputes.errors++;
        } else {
          results.disputes.synced++;
        }
      } catch (err) {
        console.error(`Error parsing dispute ${dispute.publicKey.toBase58()}:`, err);
        results.disputes.errors++;
      }
    }

    // Fetch all juror pools
    console.log("Fetching all juror pools...");
    const allJurorPools = await client.fetchAllJurorPools();
    for (const pool of allJurorPools) {
      try {
        const row = parseJurorPool(pool.publicKey, pool.account, slot);
        const { error } = await (supabase as any)
          .from("juror_pools")
          .upsert(row, { onConflict: "id" });
        if (error) {
          results.jurorPools.errors++;
        } else {
          results.jurorPools.synced++;
        }
      } catch {
        results.jurorPools.errors++;
      }
    }

    // Fetch all challenger pools
    console.log("Fetching all challenger pools...");
    const allChallengerPools = await client.fetchAllChallengerPools();
    for (const pool of allChallengerPools) {
      try {
        const row = parseChallengerPool(pool.publicKey, pool.account, slot);
        const { error } = await (supabase as any)
          .from("challenger_pools")
          .upsert(row, { onConflict: "id" });
        if (error) {
          results.challengerPools.errors++;
        } else {
          results.challengerPools.synced++;
        }
      } catch {
        results.challengerPools.errors++;
      }
    }

    // Fetch all defender pools
    console.log("Fetching all defender pools...");
    const allDefenderPools = await client.fetchAllDefenderPools();
    for (const pool of allDefenderPools) {
      try {
        const row = parseDefenderPool(pool.publicKey, pool.account, slot);
        const { error } = await (supabase as any)
          .from("defender_pools")
          .upsert(row, { onConflict: "id" });
        if (error) {
          results.defenderPools.errors++;
        } else {
          results.defenderPools.synced++;
        }
      } catch {
        results.defenderPools.errors++;
      }
    }

    // Fetch all escrows
    // Note: Historical disputes are reconstructed from program_events table
    // which is populated by the Helius webhook and backfill-events endpoint
    console.log("Fetching all escrows...");
    const allEscrows = await client.fetchAllEscrows();
    for (const escrow of allEscrows) {
      try {
        const row = parseEscrow(escrow.publicKey, escrow.account, slot);
        const { error } = await (supabase as any)
          .from("escrows")
          .upsert(row, { onConflict: "id" });
        if (error) {
          results.escrows.errors++;
        } else {
          results.escrows.synced++;
        }
      } catch {
        results.escrows.errors++;
      }
    }

    // Fetch records for each subject
    console.log("Fetching records for each subject...");
    for (const subject of allSubjects) {
      const subjectId = subject.account.subjectId;

      // Juror records
      try {
        const jurorRecords = await client.fetchJurorRecordsBySubject(subjectId);
        for (const record of jurorRecords) {
          try {
            const row = parseJurorRecord(record.publicKey, record.account, slot);
            const { error } = await (supabase as any)
              .from("juror_records")
              .upsert(row, { onConflict: "id" });
            if (error) {
              results.jurorRecords.errors++;
            } else {
              results.jurorRecords.synced++;
            }
          } catch {
            results.jurorRecords.errors++;
          }
        }
      } catch {
        // No juror records for this subject
      }

      // Challenger records
      try {
        const challengerRecords = await client.fetchChallengerRecordsBySubject(subjectId);
        for (const record of challengerRecords) {
          try {
            const row = parseChallengerRecord(record.publicKey, record.account, slot);
            const { error } = await (supabase as any)
              .from("challenger_records")
              .upsert(row, { onConflict: "id" });
            if (error) {
              results.challengerRecords.errors++;
            } else {
              results.challengerRecords.synced++;
            }
          } catch {
            results.challengerRecords.errors++;
          }
        }
      } catch {
        // No challenger records for this subject
      }

      // Defender records
      try {
        const defenderRecords = await client.fetchDefenderRecordsBySubject(subjectId);
        for (const record of defenderRecords) {
          try {
            const row = parseDefenderRecord(record.publicKey, record.account, slot);
            const { error } = await (supabase as any)
              .from("defender_records")
              .upsert(row, { onConflict: "id" });
            if (error) {
              results.defenderRecords.errors++;
            } else {
              results.defenderRecords.synced++;
            }
          } catch {
            results.defenderRecords.errors++;
          }
        }
      } catch {
        // No defender records for this subject
      }
    }

    console.log("Full sync completed:", results);

    return NextResponse.json({
      success: true,
      slot,
      results,
      totals: {
        synced: Object.values(results).reduce((sum, r) => sum + r.synced, 0),
        errors: Object.values(results).reduce((sum, r) => sum + r.errors, 0),
      },
    });
  } catch (error) {
    console.error("Full sync error:", error);
    return NextResponse.json(
      { error: "Full sync failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: "ok",
    description: "Full sync endpoint - POST with Authorization: Bearer <ADMIN_SECRET>",
  });
}
