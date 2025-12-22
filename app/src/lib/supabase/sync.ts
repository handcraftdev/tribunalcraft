import { Connection, PublicKey } from "@solana/web3.js";
import { TribunalCraftClient, pda } from "@tribunalcraft/sdk";
import { supabase, isSupabaseConfigured } from "./client";
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
} from "./parse";

// =============================================================================
// Sync Utilities
// =============================================================================

// Create a shared client for sync operations
let syncClient: TribunalCraftClient | null = null;

const getSyncClient = (connection: Connection): TribunalCraftClient => {
  if (!syncClient) {
    syncClient = new TribunalCraftClient({ connection });
  }
  return syncClient;
};

// Get current slot for tracking data freshness
const getCurrentSlot = async (connection: Connection): Promise<number> => {
  try {
    return await connection.getSlot();
  } catch {
    return 0;
  }
};

/**
 * Slot-based upsert helper
 * Only updates if incoming slot is greater than or equal to existing slot
 * This prevents stale data from overwriting fresh data
 */
async function slotAwareUpsert(
  table: string,
  row: Record<string, unknown>,
  idField: string = "id"
): Promise<{ success: boolean; skipped: boolean; error?: string }> {
  if (!supabase) return { success: false, skipped: false, error: "Supabase not configured" };

  const id = row[idField];
  const incomingSlot = (row.slot as number) || 0;

  try {
    // Check if record exists and get its slot
    const { data: existing, error: fetchError } = await (supabase as any)
      .from(table)
      .select("slot")
      .eq(idField, id)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 = no rows returned, which is fine
      console.error(`Error checking existing ${table}:`, fetchError);
      return { success: false, skipped: false, error: fetchError.message };
    }

    // If record exists with newer slot, skip update
    if (existing && existing.slot && existing.slot > incomingSlot) {
      console.log(`Skipping ${table} update: existing slot ${existing.slot} > incoming ${incomingSlot}`);
      return { success: true, skipped: true };
    }

    // Proceed with upsert
    const { error: upsertError } = await (supabase as any)
      .from(table)
      .upsert(row, { onConflict: idField });

    if (upsertError) {
      console.error(`Error upserting ${table}:`, upsertError);
      return { success: false, skipped: false, error: upsertError.message };
    }

    return { success: true, skipped: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Error in slotAwareUpsert for ${table}:`, err);
    return { success: false, skipped: false, error: message };
  }
}

/**
 * Sync result tracking for retry logic
 */
interface SyncResult {
  success: boolean;
  table: string;
  id: string;
  error?: string;
  retryable: boolean;
}

// Track failed syncs for potential retry
const failedSyncs: SyncResult[] = [];
const MAX_FAILED_SYNCS = 100;

function trackSyncResult(result: SyncResult): void {
  if (!result.success && result.retryable) {
    failedSyncs.push(result);
    // Keep only the most recent failures
    if (failedSyncs.length > MAX_FAILED_SYNCS) {
      failedSyncs.shift();
    }
  }
}

/**
 * Get failed syncs for retry (useful for background retry jobs)
 */
export function getFailedSyncs(): SyncResult[] {
  return [...failedSyncs];
}

/**
 * Clear failed syncs (after successful retry)
 */
export function clearFailedSyncs(): void {
  failedSyncs.length = 0;
}

// =============================================================================
// Individual Sync Functions
// =============================================================================

export async function syncSubject(
  connection: Connection,
  subjectId: PublicKey
): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) return false;

  try {
    const client = getSyncClient(connection);
    const [subjectPda] = pda.subject(subjectId);
    const account = await client.fetchSubject(subjectPda);

    if (!account) return false;

    const slot = await getCurrentSlot(connection);
    const row = parseSubject(subjectPda, account, slot);

    const result = await slotAwareUpsert("subjects", row);
    trackSyncResult({
      success: result.success,
      table: "subjects",
      id: subjectPda.toBase58(),
      error: result.error,
      retryable: !result.skipped,
    });

    return result.success;
  } catch (err) {
    console.error("Error syncing subject:", err);
    trackSyncResult({
      success: false,
      table: "subjects",
      id: subjectId.toBase58(),
      error: err instanceof Error ? err.message : "Unknown error",
      retryable: true,
    });
    return false;
  }
}

export async function syncDispute(
  connection: Connection,
  subjectId: PublicKey
): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) return false;

  try {
    const client = getSyncClient(connection);
    const [disputePda] = pda.dispute(subjectId);
    const account = await client.fetchDispute(disputePda);

    if (!account) return false;

    const slot = await getCurrentSlot(connection);
    const row = parseDispute(disputePda, account, slot);

    const result = await slotAwareUpsert("disputes", row);
    trackSyncResult({
      success: result.success,
      table: "disputes",
      id: disputePda.toBase58(),
      error: result.error,
      retryable: !result.skipped,
    });

    return result.success;
  } catch (err) {
    console.error("Error syncing dispute:", err);
    trackSyncResult({
      success: false,
      table: "disputes",
      id: subjectId.toBase58(),
      error: err instanceof Error ? err.message : "Unknown error",
      retryable: true,
    });
    return false;
  }
}

export async function syncJurorRecord(
  connection: Connection,
  subjectId: PublicKey,
  juror: PublicKey,
  round: number
): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) return false;

  try {
    const client = getSyncClient(connection);
    const [recordPda] = pda.jurorRecord(subjectId, juror, round);
    const account = await client.fetchJurorRecord(recordPda);

    if (!account) return false;

    const slot = await getCurrentSlot(connection);
    const row = parseJurorRecord(recordPda, account, slot);

    const result = await slotAwareUpsert("juror_records", row);
    trackSyncResult({
      success: result.success,
      table: "juror_records",
      id: recordPda.toBase58(),
      error: result.error,
      retryable: !result.skipped,
    });

    return result.success;
  } catch (err) {
    console.error("Error syncing juror record:", err);
    return false;
  }
}

export async function syncChallengerRecord(
  connection: Connection,
  subjectId: PublicKey,
  challenger: PublicKey,
  round: number
): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) return false;

  try {
    const client = getSyncClient(connection);
    const [recordPda] = pda.challengerRecord(subjectId, challenger, round);
    const account = await client.fetchChallengerRecord(recordPda);

    if (!account) return false;

    const slot = await getCurrentSlot(connection);
    const row = parseChallengerRecord(recordPda, account, slot);

    const result = await slotAwareUpsert("challenger_records", row);
    trackSyncResult({
      success: result.success,
      table: "challenger_records",
      id: recordPda.toBase58(),
      error: result.error,
      retryable: !result.skipped,
    });

    return result.success;
  } catch (err) {
    console.error("Error syncing challenger record:", err);
    return false;
  }
}

export async function syncDefenderRecord(
  connection: Connection,
  subjectId: PublicKey,
  defender: PublicKey,
  round: number
): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) return false;

  try {
    const client = getSyncClient(connection);
    const [recordPda] = pda.defenderRecord(subjectId, defender, round);
    const account = await client.fetchDefenderRecord(recordPda);

    if (!account) return false;

    const slot = await getCurrentSlot(connection);
    const row = parseDefenderRecord(recordPda, account, slot);

    const result = await slotAwareUpsert("defender_records", row);
    trackSyncResult({
      success: result.success,
      table: "defender_records",
      id: recordPda.toBase58(),
      error: result.error,
      retryable: !result.skipped,
    });

    return result.success;
  } catch (err) {
    console.error("Error syncing defender record:", err);
    return false;
  }
}

export async function syncJurorPool(
  connection: Connection,
  owner: PublicKey
): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) return false;

  try {
    const client = getSyncClient(connection);
    const [poolPda] = pda.jurorPool(owner);
    const account = await client.fetchJurorPool(poolPda);

    if (!account) return false;

    const slot = await getCurrentSlot(connection);
    const row = parseJurorPool(poolPda, account, slot);

    const result = await slotAwareUpsert("juror_pools", row);
    trackSyncResult({
      success: result.success,
      table: "juror_pools",
      id: poolPda.toBase58(),
      error: result.error,
      retryable: !result.skipped,
    });

    return result.success;
  } catch (err) {
    console.error("Error syncing juror pool:", err);
    return false;
  }
}

export async function syncChallengerPool(
  connection: Connection,
  owner: PublicKey
): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) return false;

  try {
    const client = getSyncClient(connection);
    const [poolPda] = pda.challengerPool(owner);
    const account = await client.fetchChallengerPool(poolPda);

    if (!account) return false;

    const slot = await getCurrentSlot(connection);
    const row = parseChallengerPool(poolPda, account, slot);

    const result = await slotAwareUpsert("challenger_pools", row);
    trackSyncResult({
      success: result.success,
      table: "challenger_pools",
      id: poolPda.toBase58(),
      error: result.error,
      retryable: !result.skipped,
    });

    return result.success;
  } catch (err) {
    console.error("Error syncing challenger pool:", err);
    return false;
  }
}

export async function syncDefenderPool(
  connection: Connection,
  owner: PublicKey
): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) return false;

  try {
    const client = getSyncClient(connection);
    const [poolPda] = pda.defenderPool(owner);
    const account = await client.fetchDefenderPool(poolPda);

    if (!account) return false;

    const slot = await getCurrentSlot(connection);
    const row = parseDefenderPool(poolPda, account, slot);

    const result = await slotAwareUpsert("defender_pools", row);
    trackSyncResult({
      success: result.success,
      table: "defender_pools",
      id: poolPda.toBase58(),
      error: result.error,
      retryable: !result.skipped,
    });

    return result.success;
  } catch (err) {
    console.error("Error syncing defender pool:", err);
    return false;
  }
}

export async function syncEscrow(
  connection: Connection,
  subjectId: PublicKey
): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) return false;

  try {
    const client = getSyncClient(connection);
    const [escrowPda] = pda.escrow(subjectId);
    const account = await client.fetchEscrow(escrowPda);

    if (!account) return false;

    const slot = await getCurrentSlot(connection);
    const row = parseEscrow(escrowPda, account, slot);

    const result = await slotAwareUpsert("escrows", row);
    trackSyncResult({
      success: result.success,
      table: "escrows",
      id: escrowPda.toBase58(),
      error: result.error,
      retryable: !result.skipped,
    });

    return result.success;
  } catch (err) {
    console.error("Error syncing escrow:", err);
    return false;
  }
}

// =============================================================================
// Composite Sync Functions (fire-and-forget)
// =============================================================================

/**
 * Sync after creating a subject
 * Syncs: Subject, DefenderRecord (if creator added bond)
 * @param round - The round number (0 for new subjects)
 */
export function syncAfterCreateSubject(
  connection: Connection,
  subjectId: PublicKey,
  creator: PublicKey,
  round: number = 0
): void {
  Promise.all([
    syncSubject(connection, subjectId),
    syncDefenderRecord(connection, subjectId, creator, round),
    syncDefenderPool(connection, creator),
  ]).catch(console.error);
}

/**
 * Sync after adding bond to a subject
 * Syncs: Subject, DefenderRecord, DefenderPool
 */
export function syncAfterAddBond(
  connection: Connection,
  subjectId: PublicKey,
  defender: PublicKey,
  round: number
): void {
  Promise.all([
    syncSubject(connection, subjectId),
    syncDefenderRecord(connection, subjectId, defender, round),
    syncDefenderPool(connection, defender),
  ]).catch(console.error);
}

/**
 * Sync after creating a dispute
 * Syncs: Subject, Dispute, ChallengerRecord, ChallengerPool
 */
export function syncAfterCreateDispute(
  connection: Connection,
  subjectId: PublicKey,
  challenger: PublicKey,
  round: number
): void {
  Promise.all([
    syncSubject(connection, subjectId),
    syncDispute(connection, subjectId),
    syncChallengerRecord(connection, subjectId, challenger, round),
    syncChallengerPool(connection, challenger),
  ]).catch(console.error);
}

/**
 * Sync after joining challengers
 * Syncs: Dispute, ChallengerRecord, ChallengerPool
 */
export function syncAfterJoinChallengers(
  connection: Connection,
  subjectId: PublicKey,
  challenger: PublicKey,
  round: number
): void {
  Promise.all([
    syncDispute(connection, subjectId),
    syncChallengerRecord(connection, subjectId, challenger, round),
    syncChallengerPool(connection, challenger),
  ]).catch(console.error);
}

/**
 * Sync after voting on a dispute
 * Syncs: Dispute, JurorRecord, JurorPool
 */
export function syncAfterVote(
  connection: Connection,
  subjectId: PublicKey,
  juror: PublicKey,
  round: number
): void {
  Promise.all([
    syncDispute(connection, subjectId),
    syncJurorRecord(connection, subjectId, juror, round),
    syncJurorPool(connection, juror),
  ]).catch(console.error);
}

/**
 * Sync after resolving a dispute
 * Syncs: Subject, Dispute, Escrow
 */
export function syncAfterResolve(
  connection: Connection,
  subjectId: PublicKey
): void {
  Promise.all([
    syncSubject(connection, subjectId),
    syncDispute(connection, subjectId),
    syncEscrow(connection, subjectId),
  ]).catch(console.error);
}

/**
 * Sync after claiming juror reward
 * Syncs: JurorRecord, JurorPool, Escrow
 */
export function syncAfterClaimJuror(
  connection: Connection,
  subjectId: PublicKey,
  juror: PublicKey,
  round: number
): void {
  Promise.all([
    syncJurorRecord(connection, subjectId, juror, round),
    syncJurorPool(connection, juror),
    syncEscrow(connection, subjectId),
  ]).catch(console.error);
}

/**
 * Sync after claiming challenger reward
 * Syncs: ChallengerRecord, ChallengerPool, Escrow
 */
export function syncAfterClaimChallenger(
  connection: Connection,
  subjectId: PublicKey,
  challenger: PublicKey,
  round: number
): void {
  Promise.all([
    syncChallengerRecord(connection, subjectId, challenger, round),
    syncChallengerPool(connection, challenger),
    syncEscrow(connection, subjectId),
  ]).catch(console.error);
}

/**
 * Sync after claiming defender reward
 * Syncs: DefenderRecord, DefenderPool, Escrow
 */
export function syncAfterClaimDefender(
  connection: Connection,
  subjectId: PublicKey,
  defender: PublicKey,
  round: number
): void {
  Promise.all([
    syncDefenderRecord(connection, subjectId, defender, round),
    syncDefenderPool(connection, defender),
    syncEscrow(connection, subjectId),
  ]).catch(console.error);
}

/**
 * Sync after unlocking juror stake
 * Syncs: JurorRecord, JurorPool
 */
export function syncAfterUnlockJurorStake(
  connection: Connection,
  subjectId: PublicKey,
  juror: PublicKey,
  round: number
): void {
  Promise.all([
    syncJurorRecord(connection, subjectId, juror, round),
    syncJurorPool(connection, juror),
  ]).catch(console.error);
}

/**
 * Sync after registering as juror
 * Syncs: JurorPool
 */
export function syncAfterRegisterJuror(
  connection: Connection,
  owner: PublicKey
): void {
  syncJurorPool(connection, owner).catch(console.error);
}

/**
 * Sync after juror stake operations (add/withdraw)
 * Syncs: JurorPool
 */
export function syncAfterJurorStakeChange(
  connection: Connection,
  owner: PublicKey
): void {
  syncJurorPool(connection, owner).catch(console.error);
}

/**
 * Sync after creating defender pool
 * Syncs: DefenderPool
 */
export function syncAfterCreateDefenderPool(
  connection: Connection,
  owner: PublicKey
): void {
  syncDefenderPool(connection, owner).catch(console.error);
}

/**
 * Sync after defender pool operations (deposit/withdraw/updateMaxBond)
 * Syncs: DefenderPool
 */
export function syncAfterDefenderPoolChange(
  connection: Connection,
  owner: PublicKey
): void {
  syncDefenderPool(connection, owner).catch(console.error);
}

/**
 * Sync after challenger stake operations (add/withdraw)
 * Syncs: ChallengerPool
 */
export function syncAfterChallengerStakeChange(
  connection: Connection,
  owner: PublicKey
): void {
  syncChallengerPool(connection, owner).catch(console.error);
}

/**
 * Sync after submitting restore
 * Syncs: Subject, Dispute
 */
export function syncAfterSubmitRestore(
  connection: Connection,
  subjectId: PublicKey,
  restorer: PublicKey
): void {
  Promise.all([
    syncSubject(connection, subjectId),
    syncDispute(connection, subjectId),
    syncChallengerPool(connection, restorer),
  ]).catch(console.error);
}
