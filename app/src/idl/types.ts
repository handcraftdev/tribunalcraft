import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

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

export interface ProtocolConfig {
  authority: PublicKey;
  treasury: PublicKey;
  bump: number;
}

export type SubjectStatus =
  | { active: {} }
  | { disputed: {} }
  | { invalidated: {} };

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

export type DisputeStatus =
  | { pending: {} }
  | { resolved: {} };

export type ResolutionOutcome =
  | { none: {} }
  | { challengerWins: {} }
  | { defenderWins: {} }
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

export type VoteChoice =
  | { forChallenger: {} }
  | { forDefender: {} };

export type AppealVoteChoice =
  | { forRestoration: {} }
  | { againstRestoration: {} };

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
