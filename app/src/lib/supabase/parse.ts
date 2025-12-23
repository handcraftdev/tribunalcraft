import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import type {
  Subject as OnChainSubject,
  Dispute as OnChainDispute,
  JurorRecord as OnChainJurorRecord,
  ChallengerRecord as OnChainChallengerRecord,
  DefenderRecord as OnChainDefenderRecord,
  JurorPool as OnChainJurorPool,
  ChallengerPool as OnChainChallengerPool,
  DefenderPool as OnChainDefenderPool,
  Escrow as OnChainEscrow,
  SubjectStatus,
  DisputeStatus,
  ResolutionOutcome,
  DisputeType,
  VoteChoice,
  RestoreVoteChoice,
  BondSource,
} from "@tribunalcraft/sdk";
import type {
  SubjectInsert,
  DisputeInsert,
  JurorRecordInsert,
  ChallengerRecordInsert,
  DefenderRecordInsert,
  JurorPoolInsert,
  ChallengerPoolInsert,
  DefenderPoolInsert,
  EscrowInsert,
} from "./types";

// Helper to safely convert BN to number (for BIGINT columns)
// Uses string conversion to preserve precision for values > 2^53
const bnToNumber = (bn: BN | undefined | null): number | null => {
  if (!bn) return null;
  // BN.toString() always works, then parse as number
  // For PostgreSQL BIGINT, the Supabase client handles this correctly
  const str = bn.toString();
  // Check if value is within safe integer range
  const num = Number(str);
  if (Number.isSafeInteger(num)) {
    return num;
  }
  // For values > 2^53, log warning but still return
  // PostgreSQL BIGINT will store it correctly
  console.warn(`BN value ${str} exceeds safe integer range`);
  return num;
};

// Helper to convert PublicKey to string
const pubkeyToString = (pk: PublicKey | undefined | null): string | null => {
  if (!pk) return null;
  const str = pk.toBase58();
  // Check for default/zero pubkey
  if (str === "11111111111111111111111111111111") return null;
  return str;
};

// Enum converters
const statusToString = (status: SubjectStatus): string => {
  if ("dormant" in status) return "dormant";
  if ("valid" in status) return "valid";
  if ("disputed" in status) return "disputed";
  if ("invalid" in status) return "invalid";
  if ("restoring" in status) return "restoring";
  return "unknown";
};

const disputeStatusToString = (status: DisputeStatus): string => {
  if ("none" in status) return "none";
  if ("pending" in status) return "pending";
  if ("resolved" in status) return "resolved";
  return "unknown";
};

const outcomeToString = (outcome: ResolutionOutcome): string | null => {
  if ("none" in outcome) return "none";
  if ("challengerWins" in outcome) return "challengerWins";
  if ("defenderWins" in outcome) return "defenderWins";
  if ("noParticipation" in outcome) return "noParticipation";
  return null;
};

const disputeTypeToString = (type: DisputeType): string | null => {
  if ("other" in type) return "other";
  if ("breach" in type) return "breach";
  if ("fraud" in type) return "fraud";
  if ("qualityDispute" in type) return "qualityDispute";
  if ("nonDelivery" in type) return "nonDelivery";
  if ("misrepresentation" in type) return "misrepresentation";
  if ("policyViolation" in type) return "policyViolation";
  if ("damagesClaim" in type) return "damagesClaim";
  return null;
};

const voteChoiceToString = (choice: VoteChoice | null | undefined): string | null => {
  if (!choice) return null;
  if ("forChallenger" in choice) return "forChallenger";
  if ("forDefender" in choice) return "forDefender";
  return null;
};

const restoreChoiceToString = (choice: RestoreVoteChoice | null | undefined): string | null => {
  if (!choice) return null;
  if ("forRestoration" in choice) return "forRestoration";
  if ("againstRestoration" in choice) return "againstRestoration";
  return null;
};

const bondSourceToString = (source: BondSource | null | undefined): string | null => {
  if (!source) return null;
  if ("direct" in source) return "direct";
  if ("pool" in source) return "pool";
  return null;
};

// =============================================================================
// Account Parsers
// =============================================================================

export function parseSubject(
  pubkey: PublicKey,
  account: OnChainSubject,
  slot?: number
): SubjectInsert {
  return {
    // Use pda:round as id for historical indexing (subject round is the source of truth)
    id: `${pubkey.toBase58()}:${account.round}`,
    subject_id: account.subjectId.toBase58(),
    creator: account.creator.toBase58(),
    details_cid: account.detailsCid || null,
    round: account.round,
    available_bond: bnToNumber(account.availableBond) ?? 0,
    defender_count: account.defenderCount,
    status: statusToString(account.status),
    match_mode: account.matchMode,
    voting_period: bnToNumber(account.votingPeriod),
    dispute: pubkeyToString(account.dispute),
    created_at: bnToNumber(account.createdAt),
    updated_at: bnToNumber(account.updatedAt),
    last_dispute_total: bnToNumber(account.lastDisputeTotal),
    slot: slot ?? null,
  };
}

export function parseDispute(
  pubkey: PublicKey,
  account: OnChainDispute,
  slot?: number
): DisputeInsert {
  // Determine the effective status:
  // If status is "none" but outcome is set, the dispute was resolved and reset
  // (this happens after DefenderWins/NoParticipation when subject continues)
  let effectiveStatus = disputeStatusToString(account.status);
  const outcomeStr = outcomeToString(account.outcome);
  if (effectiveStatus === "none" && outcomeStr && outcomeStr !== "none") {
    effectiveStatus = "resolved";
  }

  return {
    // Use pda:round as id since dispute PDA is reused for all rounds
    id: `${pubkey.toBase58()}:${account.round}`,
    subject_id: account.subjectId.toBase58(),
    round: account.round,
    status: effectiveStatus,
    dispute_type: disputeTypeToString(account.disputeType),
    total_stake: bnToNumber(account.totalStake) ?? 0,
    challenger_count: account.challengerCount,
    bond_at_risk: bnToNumber(account.bondAtRisk) ?? 0,
    defender_count: account.defenderCount,
    votes_for_challenger: bnToNumber(account.votesForChallenger) ?? 0,
    votes_for_defender: bnToNumber(account.votesForDefender) ?? 0,
    vote_count: account.voteCount,
    voting_starts_at: bnToNumber(account.votingStartsAt),
    voting_ends_at: bnToNumber(account.votingEndsAt),
    outcome: outcomeToString(account.outcome),
    resolved_at: bnToNumber(account.resolvedAt),
    is_restore: account.isRestore,
    restore_stake: bnToNumber(account.restoreStake) ?? 0,
    restorer: pubkeyToString(account.restorer),
    details_cid: account.detailsCid || null,
    created_at: bnToNumber(account.createdAt),
    // These are populated from escrow in sync API when dispute is resolved
    safe_bond: 0,
    winner_pool: 0,
    juror_pool: 0,
    slot: slot ?? null,
  };
}

export function parseJurorRecord(
  pubkey: PublicKey,
  account: OnChainJurorRecord,
  slot?: number
): JurorRecordInsert {
  return {
    id: pubkey.toBase58(),
    subject_id: account.subjectId.toBase58(),
    juror: account.juror.toBase58(),
    round: account.round,
    choice: voteChoiceToString(account.choice),
    restore_choice: restoreChoiceToString(account.restoreChoice),
    is_restore_vote: account.isRestoreVote,
    voting_power: bnToNumber(account.votingPower) ?? 0,
    stake_allocation: bnToNumber(account.stakeAllocation) ?? 0,
    reward_claimed: account.rewardClaimed,
    stake_unlocked: account.stakeUnlocked,
    voted_at: bnToNumber(account.votedAt),
    rationale_cid: account.rationaleCid || null,
    slot: slot ?? null,
  };
}

export function parseChallengerRecord(
  pubkey: PublicKey,
  account: OnChainChallengerRecord,
  slot?: number
): ChallengerRecordInsert {
  return {
    id: pubkey.toBase58(),
    subject_id: account.subjectId.toBase58(),
    challenger: account.challenger.toBase58(),
    round: account.round,
    stake: bnToNumber(account.stake) ?? 0,
    details_cid: account.detailsCid || null,
    reward_claimed: account.rewardClaimed,
    challenged_at: bnToNumber(account.challengedAt),
    slot: slot ?? null,
  };
}

export function parseDefenderRecord(
  pubkey: PublicKey,
  account: OnChainDefenderRecord,
  slot?: number
): DefenderRecordInsert {
  return {
    id: pubkey.toBase58(),
    subject_id: account.subjectId.toBase58(),
    defender: account.defender.toBase58(),
    round: account.round,
    bond: bnToNumber(account.bond) ?? 0,
    source: bondSourceToString(account.source),
    reward_claimed: account.rewardClaimed,
    bonded_at: bnToNumber(account.bondedAt),
    slot: slot ?? null,
  };
}

export function parseJurorPool(
  pubkey: PublicKey,
  account: OnChainJurorPool,
  slot?: number
): JurorPoolInsert {
  return {
    id: pubkey.toBase58(),
    owner: account.owner.toBase58(),
    balance: bnToNumber(account.balance) ?? 0,
    reputation: bnToNumber(account.reputation) ?? 50000000,
    created_at: bnToNumber(account.createdAt),
    slot: slot ?? null,
  };
}

export function parseChallengerPool(
  pubkey: PublicKey,
  account: OnChainChallengerPool,
  slot?: number
): ChallengerPoolInsert {
  return {
    id: pubkey.toBase58(),
    owner: account.owner.toBase58(),
    balance: bnToNumber(account.balance) ?? 0,
    reputation: bnToNumber(account.reputation) ?? 50000000,
    created_at: bnToNumber(account.createdAt),
    slot: slot ?? null,
  };
}

export function parseDefenderPool(
  pubkey: PublicKey,
  account: OnChainDefenderPool,
  slot?: number
): DefenderPoolInsert {
  return {
    id: pubkey.toBase58(),
    owner: account.owner.toBase58(),
    balance: bnToNumber(account.balance) ?? 0,
    max_bond: bnToNumber(account.maxBond),
    created_at: bnToNumber(account.createdAt),
    updated_at: bnToNumber(account.updatedAt),
    slot: slot ?? null,
  };
}

export function parseEscrow(
  pubkey: PublicKey,
  account: OnChainEscrow,
  slot?: number
): EscrowInsert {
  return {
    id: pubkey.toBase58(),
    subject_id: account.subjectId.toBase58(),
    total_collected: bnToNumber(account.balance) ?? 0,
    round_results: account.rounds.map((r) => ({
      round: r.round,
      creator: r.creator.toBase58(),
      resolved_at: bnToNumber(r.resolvedAt),
      outcome: outcomeToString(r.outcome),
      total_stake: bnToNumber(r.totalStake),
      bond_at_risk: bnToNumber(r.bondAtRisk),
      safe_bond: bnToNumber(r.safeBond),
      total_vote_weight: bnToNumber(r.totalVoteWeight),
      winner_pool: bnToNumber(r.winnerPool),
      juror_pool: bnToNumber(r.jurorPool),
      defender_count: r.defenderCount,
      challenger_count: r.challengerCount,
      juror_count: r.jurorCount,
      defender_claims: r.defenderClaims,
      challenger_claims: r.challengerClaims,
      juror_claims: r.jurorClaims,
    })),
    slot: slot ?? null,
  };
}
