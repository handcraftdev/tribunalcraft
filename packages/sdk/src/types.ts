import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

// =============================================================================
// Account Types
// =============================================================================

export interface ProtocolConfig {
  authority: PublicKey;
  treasury: PublicKey;
  bump: number;
}

export interface DefenderPool {
  owner: PublicKey;
  totalStake: BN;
  available: BN;
  held: BN;
  subjectCount: number;
  pendingDisputes: number;
  bump: number;
  createdAt: BN;
  updatedAt: BN;
}

export interface Subject {
  subjectId: PublicKey;
  defenderPool: PublicKey;
  detailsCid: string;
  status: SubjectStatus;
  availableStake: BN;
  maxStake: BN;
  votingPeriod: BN;
  defenderCount: number;
  disputeCount: number;
  matchMode: boolean;
  freeCase: boolean;
  dispute: PublicKey;
  bump: number;
  createdAt: BN;
  updatedAt: BN;
  lastDisputeTotal: BN;
  lastVotingPeriod: BN;
}

export interface Dispute {
  subject: PublicKey;
  disputeType: DisputeType;
  totalBond: BN;
  stakeHeld: BN;
  directStakeHeld: BN;
  challengerCount: number;
  status: DisputeStatus;
  outcome: ResolutionOutcome;
  votesFavorWeight: BN;
  votesAgainstWeight: BN;
  voteCount: number;
  votingStarted: boolean;
  votingStartsAt: BN;
  votingEndsAt: BN;
  resolvedAt: BN;
  bump: number;
  createdAt: BN;
  poolRewardClaimed: boolean;
  snapshotTotalStake: BN;
  snapshotDefenderCount: number;
  challengersClaimed: number;
  defendersClaimed: number;
  isRestore: boolean;
  restoreStake: BN;
  restorer: PublicKey;
}

// NOTE: DisputeEscrow removed - no escrow in simplified model

export interface JurorAccount {
  juror: PublicKey;
  totalStake: BN;
  availableStake: BN;
  reputation: number;
  votesCast: BN;
  correctVotes: BN;
  isActive: boolean;
  bump: number;
  joinedAt: BN;
  lastVoteAt: BN;
}

export interface VoteRecord {
  dispute: PublicKey;
  juror: PublicKey;
  jurorAccount: PublicKey;
  choice: VoteChoice;
  restoreChoice: RestoreVoteChoice;
  isRestoreVote: boolean;
  stakeAllocated: BN;
  votingPower: BN;
  unlockAt: BN;
  reputationProcessed: boolean;
  rewardClaimed: boolean;
  stakeUnlocked: boolean;
  bump: number;
  votedAt: BN;
  rationaleCid: string;
}

export interface ChallengerAccount {
  challenger: PublicKey;
  reputation: number;
  disputesSubmitted: BN;
  disputesUpheld: BN;
  disputesDismissed: BN;
  bump: number;
  createdAt: BN;
  lastDisputeAt: BN;
}

export interface ChallengerRecord {
  dispute: PublicKey;
  challenger: PublicKey;
  challengerAccount: PublicKey;
  bond: BN;
  detailsCid: string;
  rewardClaimed: boolean;
  bump: number;
  challengedAt: BN;
}

export interface DefenderRecord {
  subject: PublicKey;
  defender: PublicKey;
  stake: BN;
  rewardClaimed: boolean;
  bump: number;
  stakedAt: BN;
}

// =============================================================================
// Enum Types
// =============================================================================

export type SubjectStatus =
  | { valid: Record<string, never> }
  | { disputed: Record<string, never> }
  | { invalid: Record<string, never> }
  | { dormant: Record<string, never> }
  | { restoring: Record<string, never> };

export type DisputeStatus =
  | { pending: Record<string, never> }
  | { resolved: Record<string, never> };

export type ResolutionOutcome =
  | { none: Record<string, never> }
  | { challengerWins: Record<string, never> }
  | { defenderWins: Record<string, never> }
  | { noParticipation: Record<string, never> };

export type DisputeType =
  | { other: Record<string, never> }
  | { breach: Record<string, never> }
  | { fraud: Record<string, never> }
  | { qualityDispute: Record<string, never> }
  | { nonDelivery: Record<string, never> }
  | { misrepresentation: Record<string, never> }
  | { policyViolation: Record<string, never> }
  | { damagesClaim: Record<string, never> };

export type VoteChoice =
  | { forChallenger: Record<string, never> }
  | { forDefender: Record<string, never> };

export type RestoreVoteChoice =
  | { forRestoration: Record<string, never> }
  | { againstRestoration: Record<string, never> };

// =============================================================================
// Enum Helpers
// =============================================================================

export const SubjectStatusEnum = {
  Valid: { valid: {} } as SubjectStatus,
  Disputed: { disputed: {} } as SubjectStatus,
  Invalid: { invalid: {} } as SubjectStatus,
  Dormant: { dormant: {} } as SubjectStatus,
  Restoring: { restoring: {} } as SubjectStatus,
};

export const DisputeStatusEnum = {
  Pending: { pending: {} } as DisputeStatus,
  Resolved: { resolved: {} } as DisputeStatus,
};

export const ResolutionOutcomeEnum = {
  None: { none: {} } as ResolutionOutcome,
  ChallengerWins: { challengerWins: {} } as ResolutionOutcome,
  DefenderWins: { defenderWins: {} } as ResolutionOutcome,
  NoParticipation: { noParticipation: {} } as ResolutionOutcome,
};

export const DisputeTypeEnum = {
  Other: { other: {} } as DisputeType,
  Breach: { breach: {} } as DisputeType,
  Fraud: { fraud: {} } as DisputeType,
  QualityDispute: { qualityDispute: {} } as DisputeType,
  NonDelivery: { nonDelivery: {} } as DisputeType,
  Misrepresentation: { misrepresentation: {} } as DisputeType,
  PolicyViolation: { policyViolation: {} } as DisputeType,
  DamagesClaim: { damagesClaim: {} } as DisputeType,
};

export const VoteChoiceEnum = {
  ForChallenger: { forChallenger: {} } as VoteChoice,
  ForDefender: { forDefender: {} } as VoteChoice,
};

export const RestoreVoteChoiceEnum = {
  ForRestoration: { forRestoration: {} } as RestoreVoteChoice,
  AgainstRestoration: { againstRestoration: {} } as RestoreVoteChoice,
};

// =============================================================================
// Helper Functions
// =============================================================================

export function isSubjectValid(status: SubjectStatus): boolean {
  return "valid" in status;
}

export function isSubjectDisputed(status: SubjectStatus): boolean {
  return "disputed" in status;
}

export function isSubjectInvalid(status: SubjectStatus): boolean {
  return "invalid" in status;
}

export function isSubjectDormant(status: SubjectStatus): boolean {
  return "dormant" in status;
}

export function isSubjectRestoring(status: SubjectStatus): boolean {
  return "restoring" in status;
}

export function isDisputePending(status: DisputeStatus): boolean {
  return "pending" in status;
}

export function isDisputeResolved(status: DisputeStatus): boolean {
  return "resolved" in status;
}

export function isChallengerWins(outcome: ResolutionOutcome): boolean {
  return "challengerWins" in outcome;
}

export function isDefenderWins(outcome: ResolutionOutcome): boolean {
  return "defenderWins" in outcome;
}

export function isNoParticipation(outcome: ResolutionOutcome): boolean {
  return "noParticipation" in outcome;
}

export function getDisputeTypeName(disputeType: DisputeType): string {
  if ("other" in disputeType) return "Other";
  if ("breach" in disputeType) return "Breach";
  if ("fraud" in disputeType) return "Fraud";
  if ("qualityDispute" in disputeType) return "Quality Dispute";
  if ("nonDelivery" in disputeType) return "Non-Delivery";
  if ("misrepresentation" in disputeType) return "Misrepresentation";
  if ("policyViolation" in disputeType) return "Policy Violation";
  if ("damagesClaim" in disputeType) return "Damages Claim";
  return "Unknown";
}

export function getOutcomeName(outcome: ResolutionOutcome): string {
  if ("none" in outcome) return "None";
  if ("challengerWins" in outcome) return "Challenger Wins";
  if ("defenderWins" in outcome) return "Defender Wins";
  if ("noParticipation" in outcome) return "No Participation";
  return "Unknown";
}

/**
 * Check if a linked subject can be disputed based on pool availability.
 * For linked match-mode subjects, validates pool has enough balance.
 * Returns true if subject can be disputed, false if pool is drained.
 */
export function canLinkedSubjectBeDisputed(
  subject: Subject,
  pool: DefenderPool | null,
  minBond: BN
): boolean {
  // Non-linked subjects don't depend on pool
  if (subject.defenderPool.equals(new PublicKey(0))) {
    return true;
  }

  // Must have pool for linked subjects
  if (!pool) {
    return false;
  }

  // Match mode: need pool.available + subject.availableStake >= min(minBond, maxStake)
  if (subject.matchMode) {
    const totalAvailable = pool.available.add(subject.availableStake);
    const requiredHold = BN.min(minBond, subject.maxStake);
    return totalAvailable.gte(requiredHold);
  }

  // Proportional mode: pool just needs some available for contribution
  // Even with 0 pool.available, proportional mode can still work with direct stake
  return true;
}

/**
 * Get effective status for a subject, considering pool balance for linked subjects.
 * Returns "dormant" for linked match-mode subjects if pool is drained below minimum.
 */
export function getEffectiveStatus(
  subject: Subject,
  pool: DefenderPool | null,
  minBond: BN
): SubjectStatus {
  // If already disputed/invalid/dormant/restoring, return as-is
  if (!isSubjectValid(subject.status)) {
    return subject.status;
  }

  // Check if linked subject can actually be disputed
  if (!canLinkedSubjectBeDisputed(subject, pool, minBond)) {
    return SubjectStatusEnum.Dormant;
  }

  return subject.status;
}
