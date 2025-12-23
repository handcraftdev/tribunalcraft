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
  | "escrow";

interface SyncRequest {
  type: SyncType;
  subjectId?: string;
  owner?: string;
  round?: number;
}

/**
 * Send sync requests to the server-side API
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
// Legacy exports (for backward compatibility)
// =============================================================================

export function getFailedSyncs(): { success: boolean; table: string; id: string; error?: string; retryable: boolean }[] {
  return [];
}

export function clearFailedSyncs(): void {
  // No-op - API handles retries
}
