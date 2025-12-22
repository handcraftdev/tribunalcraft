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

    const { error } = await (supabase as any)
      .from("subjects")
      .upsert(row, { onConflict: "id" });

    if (error) {
      console.error("Error syncing subject:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Error syncing subject:", err);
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

    const { error } = await (supabase as any)
      .from("disputes")
      .upsert(row, { onConflict: "id" });

    if (error) {
      console.error("Error syncing dispute:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Error syncing dispute:", err);
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

    const { error } = await (supabase as any)
      .from("juror_records")
      .upsert(row, { onConflict: "id" });

    if (error) {
      console.error("Error syncing juror record:", error);
      return false;
    }
    return true;
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

    const { error } = await (supabase as any)
      .from("challenger_records")
      .upsert(row, { onConflict: "id" });

    if (error) {
      console.error("Error syncing challenger record:", error);
      return false;
    }
    return true;
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

    const { error } = await (supabase as any)
      .from("defender_records")
      .upsert(row, { onConflict: "id" });

    if (error) {
      console.error("Error syncing defender record:", error);
      return false;
    }
    return true;
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

    const { error } = await (supabase as any)
      .from("juror_pools")
      .upsert(row, { onConflict: "id" });

    if (error) {
      console.error("Error syncing juror pool:", error);
      return false;
    }
    return true;
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

    const { error } = await (supabase as any)
      .from("challenger_pools")
      .upsert(row, { onConflict: "id" });

    if (error) {
      console.error("Error syncing challenger pool:", error);
      return false;
    }
    return true;
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

    const { error } = await (supabase as any)
      .from("defender_pools")
      .upsert(row, { onConflict: "id" });

    if (error) {
      console.error("Error syncing defender pool:", error);
      return false;
    }
    return true;
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

    const { error } = await (supabase as any)
      .from("escrows")
      .upsert(row, { onConflict: "id" });

    if (error) {
      console.error("Error syncing escrow:", error);
      return false;
    }
    return true;
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
 */
export function syncAfterCreateSubject(
  connection: Connection,
  subjectId: PublicKey,
  creator: PublicKey
): void {
  Promise.all([
    syncSubject(connection, subjectId),
    syncDefenderRecord(connection, subjectId, creator, 0),
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
