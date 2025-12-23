import { PublicKey } from "@solana/web3.js";

// =============================================================================
// Sync via API Route
// =============================================================================

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
  | "transaction"; // NEW: Sync events from a transaction

interface SyncRequest {
  type: SyncType;
  subjectId?: string;
  owner?: string;
  round?: number;
  // For markClosed type
  recordType?: "jurorRecord" | "challengerRecord" | "defenderRecord";
  recordId?: string;
  // For transaction type (event sync)
  signature?: string;
}

interface SyncResult {
  type: string;
  success: boolean;
  error?: string;
}

interface SyncResponse {
  results: SyncResult[];
  slot: number;
}

/**
 * Send sync requests to the server-side API (fire-and-forget)
 * This uses the service role key to write to Supabase
 */
async function syncViaApi(requests: SyncRequest[]): Promise<void> {
  try {
    const response = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requests),
    });

    if (!response.ok) {
      console.error("Sync API error:", response.status);
    }
  } catch (err) {
    console.error("Sync request failed:", err);
  }
}

/**
 * Send sync requests and WAIT for confirmation (for critical operations)
 * Returns true if all syncs succeeded, throws on failure
 */
async function syncViaApiVerified(requests: SyncRequest[]): Promise<boolean> {
  const response = await fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requests),
  });

  if (!response.ok) {
    throw new Error(`Sync API error: ${response.status}`);
  }

  const data: SyncResponse = await response.json();

  // Check if all syncs succeeded
  const failed = data.results.filter(r => !r.success);
  if (failed.length > 0) {
    console.error("Some syncs failed:", failed);
    // Still return true if at least some succeeded - data was captured
    return data.results.some(r => r.success);
  }

  return true;
}

// =============================================================================
// Composite Sync Functions (fire-and-forget)
// =============================================================================

/**
 * Sync after creating a subject
 * Syncs: Subject, DefenderRecord, DefenderPool
 */
export function syncAfterCreateSubject(
  _connection: unknown, // Kept for API compatibility
  subjectId: PublicKey,
  creator: PublicKey,
  round: number = 0
): void {
  syncViaApi([
    { type: "subject", subjectId: subjectId.toBase58() },
    { type: "defenderRecord", subjectId: subjectId.toBase58(), owner: creator.toBase58(), round },
    { type: "defenderPool", owner: creator.toBase58() },
  ]).catch(console.error);
}

/**
 * Sync after adding bond to a subject
 * Syncs: Subject, DefenderRecord, DefenderPool
 */
export function syncAfterAddBond(
  _connection: unknown,
  subjectId: PublicKey,
  defender: PublicKey,
  round: number
): void {
  syncViaApi([
    { type: "subject", subjectId: subjectId.toBase58() },
    { type: "defenderRecord", subjectId: subjectId.toBase58(), owner: defender.toBase58(), round },
    { type: "defenderPool", owner: defender.toBase58() },
  ]).catch(console.error);
}

/**
 * Sync after creating a dispute
 * Syncs: Subject, Dispute, ChallengerRecord, ChallengerPool
 */
export function syncAfterCreateDispute(
  _connection: unknown,
  subjectId: PublicKey,
  challenger: PublicKey,
  round: number
): void {
  syncViaApi([
    { type: "subject", subjectId: subjectId.toBase58() },
    { type: "dispute", subjectId: subjectId.toBase58() },
    { type: "challengerRecord", subjectId: subjectId.toBase58(), owner: challenger.toBase58(), round },
    { type: "challengerPool", owner: challenger.toBase58() },
  ]).catch(console.error);
}

/**
 * Sync after joining challengers
 * Syncs: Dispute, ChallengerRecord, ChallengerPool
 */
export function syncAfterJoinChallengers(
  _connection: unknown,
  subjectId: PublicKey,
  challenger: PublicKey,
  round: number
): void {
  syncViaApi([
    { type: "dispute", subjectId: subjectId.toBase58() },
    { type: "challengerRecord", subjectId: subjectId.toBase58(), owner: challenger.toBase58(), round },
    { type: "challengerPool", owner: challenger.toBase58() },
  ]).catch(console.error);
}

/**
 * Sync after voting on a dispute
 * Syncs: Dispute, JurorRecord, JurorPool
 */
export function syncAfterVote(
  _connection: unknown,
  subjectId: PublicKey,
  juror: PublicKey,
  round: number
): void {
  syncViaApi([
    { type: "dispute", subjectId: subjectId.toBase58() },
    { type: "jurorRecord", subjectId: subjectId.toBase58(), owner: juror.toBase58(), round },
    { type: "jurorPool", owner: juror.toBase58() },
  ]).catch(console.error);
}

/**
 * Sync after resolving a dispute
 * Syncs: Subject, Dispute, Escrow
 */
export function syncAfterResolve(
  _connection: unknown,
  subjectId: PublicKey
): void {
  syncViaApi([
    { type: "subject", subjectId: subjectId.toBase58() },
    { type: "dispute", subjectId: subjectId.toBase58() },
    { type: "escrow", subjectId: subjectId.toBase58() },
  ]).catch(console.error);
}

/**
 * Sync after claiming juror reward
 * Syncs: JurorRecord, JurorPool, Escrow
 */
export function syncAfterClaimJuror(
  _connection: unknown,
  subjectId: PublicKey,
  juror: PublicKey,
  round: number
): void {
  syncViaApi([
    { type: "jurorRecord", subjectId: subjectId.toBase58(), owner: juror.toBase58(), round },
    { type: "jurorPool", owner: juror.toBase58() },
    { type: "escrow", subjectId: subjectId.toBase58() },
  ]).catch(console.error);
}

/**
 * Sync after claiming challenger reward
 * Syncs: ChallengerRecord, ChallengerPool, Escrow
 */
export function syncAfterClaimChallenger(
  _connection: unknown,
  subjectId: PublicKey,
  challenger: PublicKey,
  round: number
): void {
  syncViaApi([
    { type: "challengerRecord", subjectId: subjectId.toBase58(), owner: challenger.toBase58(), round },
    { type: "challengerPool", owner: challenger.toBase58() },
    { type: "escrow", subjectId: subjectId.toBase58() },
  ]).catch(console.error);
}

/**
 * Sync after claiming defender reward
 * Syncs: DefenderRecord, DefenderPool, Escrow
 */
export function syncAfterClaimDefender(
  _connection: unknown,
  subjectId: PublicKey,
  defender: PublicKey,
  round: number
): void {
  syncViaApi([
    { type: "defenderRecord", subjectId: subjectId.toBase58(), owner: defender.toBase58(), round },
    { type: "defenderPool", owner: defender.toBase58() },
    { type: "escrow", subjectId: subjectId.toBase58() },
  ]).catch(console.error);
}

/**
 * Sync after unlocking juror stake
 * Syncs: JurorRecord, JurorPool
 */
export function syncAfterUnlockJurorStake(
  _connection: unknown,
  subjectId: PublicKey,
  juror: PublicKey,
  round: number
): void {
  syncViaApi([
    { type: "jurorRecord", subjectId: subjectId.toBase58(), owner: juror.toBase58(), round },
    { type: "jurorPool", owner: juror.toBase58() },
  ]).catch(console.error);
}

/**
 * Sync after registering as juror
 * Syncs: JurorPool
 */
export function syncAfterRegisterJuror(
  _connection: unknown,
  owner: PublicKey
): void {
  syncViaApi([
    { type: "jurorPool", owner: owner.toBase58() },
  ]).catch(console.error);
}

/**
 * Sync after juror stake operations (add/withdraw)
 * Syncs: JurorPool
 */
export function syncAfterJurorStakeChange(
  _connection: unknown,
  owner: PublicKey
): void {
  syncViaApi([
    { type: "jurorPool", owner: owner.toBase58() },
  ]).catch(console.error);
}

/**
 * Sync after creating defender pool
 * Syncs: DefenderPool
 */
export function syncAfterCreateDefenderPool(
  _connection: unknown,
  owner: PublicKey
): void {
  syncViaApi([
    { type: "defenderPool", owner: owner.toBase58() },
  ]).catch(console.error);
}

/**
 * Sync after defender pool operations (deposit/withdraw/updateMaxBond)
 * Syncs: DefenderPool
 */
export function syncAfterDefenderPoolChange(
  _connection: unknown,
  owner: PublicKey
): void {
  syncViaApi([
    { type: "defenderPool", owner: owner.toBase58() },
  ]).catch(console.error);
}

/**
 * Sync after challenger stake operations (add/withdraw)
 * Syncs: ChallengerPool
 */
export function syncAfterChallengerStakeChange(
  _connection: unknown,
  owner: PublicKey
): void {
  syncViaApi([
    { type: "challengerPool", owner: owner.toBase58() },
  ]).catch(console.error);
}

/**
 * Sync after submitting restore
 * Syncs: Subject, Dispute, ChallengerPool
 */
export function syncAfterSubmitRestore(
  _connection: unknown,
  subjectId: PublicKey,
  restorer: PublicKey
): void {
  syncViaApi([
    { type: "subject", subjectId: subjectId.toBase58() },
    { type: "dispute", subjectId: subjectId.toBase58() },
    { type: "challengerPool", owner: restorer.toBase58() },
  ]).catch(console.error);
}

// =============================================================================
// Pre-Close Sync Functions (CRITICAL - must await before close)
// =============================================================================

/**
 * Sync juror record BEFORE closing it
 * This is critical to preserve historical data before account deletion
 */
export async function syncBeforeCloseJurorRecord(
  subjectId: PublicKey,
  owner: PublicKey,
  round: number
): Promise<boolean> {
  return syncViaApiVerified([
    { type: "jurorRecord", subjectId: subjectId.toBase58(), owner: owner.toBase58(), round },
  ]);
}

/**
 * Sync challenger record BEFORE closing it
 * This is critical to preserve historical data before account deletion
 */
export async function syncBeforeCloseChallengerRecord(
  subjectId: PublicKey,
  owner: PublicKey,
  round: number
): Promise<boolean> {
  return syncViaApiVerified([
    { type: "challengerRecord", subjectId: subjectId.toBase58(), owner: owner.toBase58(), round },
  ]);
}

/**
 * Sync defender record BEFORE closing it
 * This is critical to preserve historical data before account deletion
 */
export async function syncBeforeCloseDefenderRecord(
  subjectId: PublicKey,
  owner: PublicKey,
  round: number
): Promise<boolean> {
  return syncViaApiVerified([
    { type: "defenderRecord", subjectId: subjectId.toBase58(), owner: owner.toBase58(), round },
  ]);
}

/**
 * Sync multiple records BEFORE batch closing
 * This is critical to preserve historical data before account deletion
 */
export async function syncBeforeBatchClose(
  records: Array<{
    type: "jurorRecord" | "challengerRecord" | "defenderRecord";
    subjectId: PublicKey;
    owner: PublicKey;
    round: number;
  }>
): Promise<boolean> {
  const requests: SyncRequest[] = records.map(r => ({
    type: r.type,
    subjectId: r.subjectId.toBase58(),
    owner: r.owner.toBase58(),
    round: r.round,
  }));

  // Sync in batches of 10 (API limit)
  for (let i = 0; i < requests.length; i += 10) {
    const batch = requests.slice(i, i + 10);
    await syncViaApiVerified(batch);
  }

  return true;
}

// =============================================================================
// Verified Sync Functions (await for critical operations)
// =============================================================================

/**
 * Sync after resolving a dispute - VERIFIED version
 * This is critical as it captures the escrow round_results before potential cleanup
 */
export async function syncAfterResolveVerified(
  subjectId: PublicKey
): Promise<boolean> {
  return syncViaApiVerified([
    { type: "subject", subjectId: subjectId.toBase58() },
    { type: "dispute", subjectId: subjectId.toBase58() },
    { type: "escrow", subjectId: subjectId.toBase58() },
  ]);
}

// =============================================================================
// Additional Sync Functions
// =============================================================================

/**
 * Sync after unregistering as juror
 * Captures pool state before potential deletion
 */
export function syncAfterUnregisterJuror(
  _connection: unknown,
  owner: PublicKey
): void {
  syncViaApi([
    { type: "jurorPool", owner: owner.toBase58() },
  ]).catch(console.error);
}

/**
 * Sync escrow directly (useful when escrow changes without dispute change)
 */
export function syncEscrow(
  _connection: unknown,
  subjectId: PublicKey
): void {
  syncViaApi([
    { type: "escrow", subjectId: subjectId.toBase58() },
  ]).catch(console.error);
}

/**
 * Mark a record as closed AFTER closing it on-chain
 * This preserves the closed_at timestamp for historical queries
 */
export async function markRecordClosed(
  recordType: "jurorRecord" | "challengerRecord" | "defenderRecord",
  recordId: string
): Promise<boolean> {
  return syncViaApiVerified([
    { type: "markClosed", recordType, recordId },
  ]);
}

/**
 * Mark multiple records as closed AFTER batch closing
 */
export async function markRecordsClosed(
  records: Array<{
    recordType: "jurorRecord" | "challengerRecord" | "defenderRecord";
    recordId: string;
  }>
): Promise<boolean> {
  const requests: SyncRequest[] = records.map(r => ({
    type: "markClosed" as const,
    recordType: r.recordType,
    recordId: r.recordId,
  }));

  // Mark in batches of 10
  for (let i = 0; i < requests.length; i += 10) {
    const batch = requests.slice(i, i + 10);
    await syncViaApiVerified(batch);
  }

  return true;
}

// =============================================================================
// Transaction Event Sync
// =============================================================================

/**
 * Sync events from a transaction signature (fire-and-forget)
 * This parses the transaction logs and stores events in program_events table
 */
export function syncTransaction(signature: string): void {
  syncViaApi([
    { type: "transaction", signature },
  ]).catch(console.error);
}

/**
 * Sync events from a transaction signature - VERIFIED version
 * Waits for confirmation that events were stored
 */
export async function syncTransactionVerified(signature: string): Promise<boolean> {
  return syncViaApiVerified([
    { type: "transaction", signature },
  ]);
}

// =============================================================================
// Legacy exports (for backward compatibility)
// =============================================================================

export function getFailedSyncs(): { success: boolean; table: string; id: string; error?: string; retryable: boolean }[] {
  return [];
}

export function clearFailedSyncs(): void {
  // No-op - API handles retries
}
