import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

export interface StakerPool {
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
  stakerPool: PublicKey;
  detailsCid: string;
  status: SubjectStatus;
  totalStake: BN;
  maxStake: BN;
  stakerCount: number;
  disputeCount: number;
  matchMode: boolean;
  freeCase: boolean;
  votingPeriod: BN;
  winnerRewardBps: number;
  dispute: PublicKey;
  bump: number;
  createdAt: BN;
  updatedAt: BN;
}

export type SubjectStatus =
  | { active: {} }
  | { disputed: {} }
  | { validated: {} }
  | { invalidated: {} };

export interface Dispute {
  subject: PublicKey;
  disputeType: DisputeType;
  totalBond: BN;
  stakeHeld: BN;
  challengerCount: number;
  status: DisputeStatus;
  outcome: ResolutionOutcome;
  votesFavorWeight: BN;
  votesAgainstWeight: BN;
  voteCount: number;
  votingEndsAt: BN;
  resolvedAt: BN;
  bump: number;
  createdAt: BN;
  poolRewardClaimed: boolean;
}

export type DisputeStatus =
  | { pending: {} }
  | { resolved: {} };

export type ResolutionOutcome =
  | { none: {} }
  | { upheld: {} }
  | { dismissed: {} }
  | { noParticipation: {} };

export type DisputeType =
  | { other: {} }
  | { breach: {} }
  | { fraud: {} }
  | { qualityDispute: {} }
  | { nonDelivery: {} }
  | { misrepresentation: {} }
  | { policyViolation: {} }
  | { damagesClaim: {} };

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
  stakeAllocated: BN;
  votingPower: BN;
  unlockAt: BN;
  reputationProcessed: boolean;
  rewardClaimed: boolean;
  stakeUnlocked: boolean;
  bump: number;
  votedAt: BN;
}

export type VoteChoice =
  | { uphold: {} }
  | { dismiss: {} };

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

export interface StakerRecord {
  subject: PublicKey;
  staker: PublicKey;
  stake: BN;
  rewardClaimed: boolean;
  bump: number;
  stakedAt: BN;
}
