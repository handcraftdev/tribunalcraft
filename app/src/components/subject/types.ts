import { PublicKey } from "@solana/web3.js";
import type { SubjectContent, DisputeContent } from "@tribunalcraft/sdk";

// Dispute types for display
export const DISPUTE_TYPES = [
  { key: "other", label: "Other", contentKey: "other" },
  { key: "breach", label: "Breach", contentKey: "breach" },
  { key: "fraud", label: "Fraud", contentKey: "fraud" },
  { key: "qualityDispute", label: "Quality", contentKey: "quality" },
  { key: "nonDelivery", label: "Non-Delivery", contentKey: "non_delivery" },
  { key: "misrepresentation", label: "Misrepresentation", contentKey: "fraud" },
  { key: "policyViolation", label: "Policy Violation", contentKey: "breach" },
  { key: "damagesClaim", label: "Damages", contentKey: "other" },
] as const;

export const SUBJECT_CATEGORIES = [
  { key: "contract", label: "Contract" },
  { key: "claim", label: "Claim" },
  { key: "deliverable", label: "Deliverable" },
  { key: "service", label: "Service" },
  { key: "listing", label: "Listing" },
  { key: "proposal", label: "Proposal" },
  { key: "other", label: "Other" },
] as const;

// Helper functions
// Priority order: restoring > disputed > invalid > valid > dormant
// This ensures the most actionable status is shown when data may be stale
export const getStatusBadge = (status: any) => {
  if (status.restoring) return { label: "Restoring", class: "bg-violet-500/20 text-violet-400" };
  if (status.disputed) return { label: "Disputed", class: "bg-gold-20 text-gold" };
  if (status.invalid) return { label: "Invalid", class: "bg-crimson-20 text-crimson" };
  if (status.valid) return { label: "Valid", class: "bg-emerald-20 text-emerald" };
  if (status.dormant) return { label: "Dormant", class: "bg-purple-500/20 text-purple-400" };
  return { label: "Unknown", class: "bg-steel-20 text-steel" };
};

export const getOutcomeLabel = (outcome: any) => {
  if (outcome.none) return { label: "Voting", class: "text-gold" };
  if (outcome.challengerWins) return { label: "Challenger Wins", class: "text-crimson" };
  if (outcome.defenderWins) return { label: "Defender Wins", class: "text-sky-400" };
  if (outcome.noParticipation) return { label: "No Quorum", class: "text-steel" };
  return { label: "Unknown", class: "text-steel" };
};

export const getDisputeTypeLabel = (dt: any) => {
  const found = DISPUTE_TYPES.find((t) => dt[t.key]);
  return found ? found.label : "Unknown";
};

// V2 Types for component props

export interface SubjectData {
  publicKey: PublicKey;
  account: {
    subjectId: PublicKey;
    creator: PublicKey;
    round: number;
    availableBond: any; // BN
    defenderCount: number;
    status: any;
    matchMode: boolean;
    votingPeriod: any; // BN
    dispute: PublicKey;
    bump: number;
    createdAt: any; // BN
    updatedAt: any; // BN
    lastDisputeTotal: any; // BN
    lastVotingPeriod: any; // BN
    [key: string]: any;
  };
}

export interface DisputeData {
  publicKey: PublicKey;
  account: {
    subjectId: PublicKey;
    round: number;
    status: any;
    disputeType: any;
    totalStake: any; // BN
    challengerCount: number;
    bondAtRisk: any; // BN
    defenderCount: number;
    votesForChallenger: any; // BN
    votesForDefender: any; // BN
    voteCount: number;
    votingStartsAt: any; // BN
    votingEndsAt: any; // BN
    outcome: any;
    resolvedAt: any; // BN
    isRestore: boolean;
    restoreStake: any; // BN
    restorer: PublicKey;
    detailsCid: string;
    bump: number;
    createdAt: any; // BN
    [key: string]: any;
  };
}

export interface JurorRecordData {
  publicKey: PublicKey;
  account: {
    subjectId: PublicKey;
    juror: PublicKey;
    round: number;
    choice: any;
    restoreChoice: any;
    isRestoreVote: boolean;
    votingPower: any; // BN
    rewardClaimed: boolean;
    bump: number;
    votedAt: any; // BN
    rationaleCid: string;
    [key: string]: any;
  };
}

export interface ChallengerRecordData {
  publicKey: PublicKey;
  account: {
    subjectId: PublicKey;
    challenger: PublicKey;
    round: number;
    stake: any; // BN
    detailsCid: string;
    rewardClaimed: boolean;
    bump: number;
    challengedAt: any; // BN
    [key: string]: any;
  };
}

export interface DefenderRecordData {
  publicKey: PublicKey;
  account: {
    subjectId: PublicKey;
    defender: PublicKey;
    round: number;
    bond: any; // BN
    source: any; // BondSource enum
    rewardClaimed: boolean;
    bump: number;
    bondedAt: any; // BN
    [key: string]: any;
  };
}

export interface JurorPoolData {
  publicKey: PublicKey;
  account: {
    owner: PublicKey;
    balance: any; // BN
    reputation: any; // BN
    bump: number;
    createdAt: any; // BN
    [key: string]: any;
  };
}

export interface VoteCounts {
  forChallenger: number;
  forDefender: number;
}

export interface UserRoles {
  juror: boolean;
  defender: boolean;
  challenger: boolean;
}

export interface SubjectCardProps {
  subject: SubjectData;
  dispute?: DisputeData | null;
  isResolved?: boolean;
  subjectContent?: SubjectContent | null;
  disputeContent?: DisputeContent | null;
  voteCounts?: VoteCounts | null;
  creatorPoolBacking?: number; // min(pool.balance, pool.maxBond) in lamports
  onClick: () => void;
}

export interface RoleHistoryItem {
  type: string;
  signature: string;
  timestamp: number;
  amount?: number;
  rentReclaimed?: number;
  voteChoice?: string;
  outcome?: string;
  disputeKey?: string;
}

export interface SubjectModalProps {
  subject: SubjectData;
  subjectContent?: SubjectContent | null;
  jurorPool?: JurorPoolData | null;
  creatorPoolBacking?: number; // min(pool.balance, pool.maxBond) in lamports
  userPoolBacking?: number; // Current user's pool backing for revive
  onClose: () => void;
  onVote?: (subjectId: string, round: number, stake: string, choice: "forChallenger" | "forDefender" | "forRestoration" | "againstRestoration", rationale: string) => void;
  onAddBond?: (subjectId: string, amount: string, fromPool: boolean) => void;
  onJoinChallengers?: (subjectId: string, amount: string, detailsCid: string) => void;
  onResolve?: (subjectId: string) => void;
  onClaimAll?: (subjectId: string, round: number, claims: { juror: boolean; challenger: boolean; defender: boolean }) => void;
  onCloseRecords?: (subjectId: string, round: number, records: { juror: boolean; challenger: boolean; defender: boolean }) => void;
  onRefresh?: () => void;
  actionLoading: boolean;
  showActions?: boolean;
  getIpfsUrl?: (cid: string) => string;
}

// Legacy type aliases for backward compatibility during migration
export type VoteData = JurorRecordData;
