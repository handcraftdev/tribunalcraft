import { PublicKey } from "@solana/web3.js";
import type { SubjectContent, DisputeContent } from "@/lib/content-types";

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
export const getStatusBadge = (status: any) => {
  if (status.valid) return { label: "Valid", class: "bg-emerald/20 text-emerald" };
  if (status.disputed) return { label: "Disputed", class: "bg-gold/20 text-gold" };
  if (status.invalid) return { label: "Invalid", class: "bg-crimson/20 text-crimson" };
  return { label: "Unknown", class: "bg-steel/20 text-steel" };
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

// Types for component props
export interface SubjectData {
  publicKey: PublicKey;
  account: {
    subjectId: PublicKey;
    defenderPool: PublicKey;
    detailsCid: string;
    status: any;
    availableStake: any;
    maxStake: any;
    votingPeriod: any;
    defenderCount: number;
    disputeCount: number;
    matchMode: boolean;
    freeCase: boolean;
    dispute: PublicKey;
    [key: string]: any;
  };
}

export interface DisputeData {
  publicKey: PublicKey;
  account: {
    subject: PublicKey;
    disputeType: any;
    totalBond: any;
    stakeHeld: any;
    directStakeHeld: any;
    challengerCount: number;
    status: any;
    outcome: any;
    votesFavorWeight: any;
    votesAgainstWeight: any;
    voteCount: number;
    votingStartsAt: any;
    votingEndsAt: any;
    resolvedAt: any;
    snapshotTotalStake: any;
    snapshotDefenderCount: number;
    [key: string]: any;
  };
}

export interface VoteData {
  publicKey: PublicKey;
  account: {
    dispute: PublicKey;
    juror: PublicKey;
    choice: any;
    stakeAllocated: any;
    votingPower: any;
    rationaleCid: string;
    rewardClaimed: boolean;
    stakeUnlocked: boolean;
    unlockAt: any;
    [key: string]: any;
  };
}

export interface ChallengerRecordData {
  bond: any;
  rewardClaimed: boolean;
  [key: string]: any;
}

export interface DefenderRecordData {
  stake: any;
  rewardClaimed: boolean;
  [key: string]: any;
}

export interface SubjectCardProps {
  subject: SubjectData;
  dispute?: DisputeData | null;
  isResolved?: boolean;
  existingVote?: VoteData | null;
  subjectContent?: SubjectContent | null;
  disputeContent?: DisputeContent | null;
  onClick: () => void;
}

export interface SubjectModalProps {
  subject: SubjectData;
  dispute?: DisputeData | null;
  subjectContent?: SubjectContent | null;
  disputeContent?: DisputeContent | null;
  existingVote?: VoteData | null;
  jurorAccount?: any;
  disputeVotes: VoteData[];
  pastDisputes: DisputeData[];
  pastDisputeContents: Record<string, DisputeContent | null>;
  challengerRecord?: ChallengerRecordData | null;
  defenderRecord?: DefenderRecordData | null;
  onClose: () => void;
  onVote?: (stake: string, choice: "forChallenger" | "forDefender", rationale: string) => void;
  onAddStake?: (amount: string) => void;
  onJoinChallengers?: (amount: string) => void;
  onResolve?: () => void;
  onClaimJuror?: () => void;
  onClaimChallenger?: () => void;
  onClaimDefender?: () => void;
  onFileDispute?: () => void;
  actionLoading: boolean;
  showActions?: boolean;
  getIpfsUrl?: (cid: string) => string;
  disputeCid?: string;
}
