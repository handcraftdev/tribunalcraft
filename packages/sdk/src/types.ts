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
  totalStake: BN;
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
  isAppeal: boolean;
  appealStake: BN;
}

export interface DisputeEscrow {
  dispute: PublicKey;
  subject: PublicKey;
  totalBonds: BN;
  totalStakes: BN;
  bondsClaimed: BN;
  stakesClaimed: BN;
  jurorRewardsPaid: BN;
  platformFeePaid: BN;
  challengersClaimed: number;
  defendersClaimed: number;
  expectedChallengers: number;
  expectedDefenders: number;
  bump: number;
  createdAt: BN;
}

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
  appealChoice: AppealVoteChoice;
  isAppealVote: boolean;
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
  | { active: Record<string, never> }
  | { disputed: Record<string, never> }
  | { invalidated: Record<string, never> };

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

export type AppealVoteChoice =
  | { forRestoration: Record<string, never> }
  | { againstRestoration: Record<string, never> };

// =============================================================================
// Enum Helpers
// =============================================================================

export const SubjectStatusEnum = {
  Active: { active: {} } as SubjectStatus,
  Disputed: { disputed: {} } as SubjectStatus,
  Invalidated: { invalidated: {} } as SubjectStatus,
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

export const AppealVoteChoiceEnum = {
  ForRestoration: { forRestoration: {} } as AppealVoteChoice,
  AgainstRestoration: { againstRestoration: {} } as AppealVoteChoice,
};

// =============================================================================
// Helper Functions
// =============================================================================

export function isSubjectActive(status: SubjectStatus): boolean {
  return "active" in status;
}

export function isSubjectDisputed(status: SubjectStatus): boolean {
  return "disputed" in status;
}

export function isSubjectInvalidated(status: SubjectStatus): boolean {
  return "invalidated" in status;
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
