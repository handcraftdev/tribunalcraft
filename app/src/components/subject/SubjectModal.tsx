"use client";

import { memo, useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { XIcon, ClockIcon, CheckIcon, ChevronDownIcon, LinkIcon } from "@/components/Icons";
import { getStatusBadge, getOutcomeLabel, getDisputeTypeLabel, SUBJECT_CATEGORIES, DISPUTE_TYPES, SubjectModalProps, VoteData, DisputeData, UserRoles, ChallengerRecordData, DefenderRecordData } from "./types";
import {
  useTribunalcraft,
  calculateMinBond,
  INITIAL_REPUTATION,
  MIN_DEFENDER_STAKE,
  DisputeType,
  type Escrow,
  type RoundResult,
  calculateUserRewards,
  lamportsToSol,
  isDisputeNone,
} from "@/hooks/useTribunalcraft";
import { useUpload, useContentFetch } from "@/hooks/useUpload";
import { getUserFriendlyErrorMessage, getErrorHelp, isUserCancellation } from "@/lib/error-utils";
import { EvidenceViewer } from "./EvidenceViewer";
import type { DisputeContent } from "@tribunalcraft/sdk";
import {
  getJurorRecords,
  getChallengerRecords,
  getDefenderRecords,
  getEscrowBySubject,
  getDisputeBySubject,
  getAllDisputesBySubject,
  getDisputeHistoryFromEvents,
  getUserRolesFromEvents,
  type JurorRecord as SupabaseJurorRecord,
  type ChallengerRecord as SupabaseChallengerRecord,
  type DefenderRecord as SupabaseDefenderRecord,
  type Dispute as SupabaseDispute,
  type DisputeFromEvents,
} from "@/lib/supabase/queries";

// Helper to format a key for display (camelCase/snake_case to Title Case)
const formatKey = (key: string): string => {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase());
};

// Helper to check if a value is a primitive
const isPrimitive = (value: unknown): value is string | number | boolean | null | undefined => {
  return value === null || value === undefined || typeof value !== 'object';
};

// Recursive JSON content renderer for unknown structures
const JsonContentRenderer = memo(function JsonContentRenderer({
  data,
  depth = 0,
  getIpfsUrl,
}: {
  data: unknown;
  depth?: number;
  getIpfsUrl?: (cid: string) => string;
}) {
  if (data === null || data === undefined) {
    return null;
  }

  // Handle primitives
  if (isPrimitive(data)) {
    const strValue = String(data);
    // Check if it looks like a URL
    if (typeof data === 'string' && (data.startsWith('http://') || data.startsWith('https://'))) {
      return (
        <a href={data} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline break-all">
          {data}
        </a>
      );
    }
    // Check if it looks like an IPFS CID
    if (typeof data === 'string' && data.match(/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-zA-Z0-9]{50,})$/)) {
      const url = getIpfsUrl ? getIpfsUrl(data) : `https://ipfs.io/ipfs/${data}`;
      return (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline break-all">
          {data.slice(0, 20)}...
        </a>
      );
    }
    return <span className="text-parchment break-words">{strValue}</span>;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    if (data.length === 0) return null;
    return (
      <div className={depth > 0 ? "ml-3 border-l border-slate-light/30 pl-3" : ""}>
        {data.map((item, index) => (
          <div key={index} className="mb-2">
            {!isPrimitive(item) && <span className="text-steel text-xs">#{index + 1}</span>}
            <JsonContentRenderer data={item} depth={depth + 1} getIpfsUrl={getIpfsUrl} />
          </div>
        ))}
      </div>
    );
  }

  // Handle objects
  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>).filter(
      ([_, value]) => value !== null && value !== undefined && value !== ''
    );
    if (entries.length === 0) return null;

    return (
      <div className={depth > 0 ? "ml-3 border-l border-slate-light/30 pl-3 space-y-2" : "space-y-2"}>
        {entries.map(([key, value]) => {
          // Skip internal/meta fields
          if (key.startsWith('_') || key === 'version' || key === 'schema') return null;

          const isNestedObject = !isPrimitive(value);
          return (
            <div key={key}>
              <div className="text-steel text-xs font-medium">{formatKey(key)}</div>
              {isNestedObject ? (
                <JsonContentRenderer data={value} depth={depth + 1} getIpfsUrl={getIpfsUrl} />
              ) : (
                <div className="text-xs">
                  <JsonContentRenderer data={value} depth={depth + 1} getIpfsUrl={getIpfsUrl} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return null;
});

// Helper to convert Supabase juror record to component format
const supabaseToJurorRecord = (record: SupabaseJurorRecord): VoteData => {
  // Parse choice from string (e.g., "forChallenger" or "forDefender")
  const choice = record.choice === "forChallenger"
    ? { forChallenger: {} }
    : { forDefender: {} };
  const restoreChoice = record.restore_choice === "forRestoration"
    ? { forRestoration: {} }
    : { againstRestoration: {} };

  return {
    publicKey: new PublicKey(record.id),
    account: {
      subjectId: new PublicKey(record.subject_id),
      juror: new PublicKey(record.juror),
      round: record.round,
      choice,
      restoreChoice,
      isRestoreVote: record.is_restore_vote,
      votingPower: new BN(record.voting_power),
      stakeAllocation: new BN(record.stake_allocation),
      rewardClaimed: record.reward_claimed,
      stakeUnlocked: record.stake_unlocked,
      bump: 0,
      votedAt: new BN(record.voted_at || 0),
      rationaleCid: record.rationale_cid || "",
    },
  };
};

// Helper to convert Supabase challenger record to component format
const supabaseToChallengerRecord = (record: SupabaseChallengerRecord): ChallengerRecordData => {
  return {
    publicKey: new PublicKey(record.id),
    account: {
      subjectId: new PublicKey(record.subject_id),
      challenger: new PublicKey(record.challenger),
      round: record.round,
      stake: new BN(record.stake),
      detailsCid: record.details_cid || "",
      rewardClaimed: record.reward_claimed,
      bump: 0,
      challengedAt: new BN(record.challenged_at || 0),
    },
  };
};

// Helper to convert Supabase defender record to component format
const supabaseToDefenderRecord = (record: SupabaseDefenderRecord): DefenderRecordData => {
  const source = record.source === "pool" ? { pool: {} } : { direct: {} };
  return {
    publicKey: new PublicKey(record.id),
    account: {
      subjectId: new PublicKey(record.subject_id),
      defender: new PublicKey(record.defender),
      round: record.round,
      bond: new BN(record.bond),
      source,
      rewardClaimed: record.reward_claimed,
      bump: 0,
      bondedAt: new BN(record.bonded_at || 0),
    },
  };
};

// Helper to convert Supabase escrow round_results to SDK RoundResult format
interface SupabaseRoundResult {
  round: number;
  creator: string;
  resolved_at: number;
  outcome: string;
  total_stake: number;
  bond_at_risk: number;
  safe_bond: number;
  total_vote_weight: number;
  winner_pool: number;
  juror_pool: number;
  defender_count: number;
  challenger_count: number;
  juror_count: number;
  defender_claims: number;
  challenger_claims: number;
  juror_claims: number;
}

const supabaseToEscrow = (record: { id: string; subject_id: string; total_collected: number; round_results: unknown }): Escrow => {
  const roundResults = (record.round_results as SupabaseRoundResult[]) || [];

  const parseOutcome = (outcome: string): any => {
    switch (outcome) {
      case "challengerWins": return { challengerWins: {} };
      case "defenderWins": return { defenderWins: {} };
      case "noParticipation": return { noParticipation: {} };
      default: return { none: {} };
    }
  };

  return {
    subjectId: new PublicKey(record.subject_id),
    balance: new BN(record.total_collected),
    rounds: roundResults.map(r => ({
      round: r.round,
      creator: new PublicKey(r.creator),
      resolvedAt: new BN(r.resolved_at),
      outcome: parseOutcome(r.outcome),
      totalStake: new BN(r.total_stake),
      bondAtRisk: new BN(r.bond_at_risk),
      safeBond: new BN(r.safe_bond),
      totalVoteWeight: new BN(r.total_vote_weight),
      winnerPool: new BN(r.winner_pool),
      jurorPool: new BN(r.juror_pool),
      defenderCount: r.defender_count,
      challengerCount: r.challenger_count,
      jurorCount: r.juror_count,
      defenderClaims: r.defender_claims,
      challengerClaims: r.challenger_claims,
      jurorClaims: r.juror_claims,
    })),
    bump: 0,
  };
};

// Helper to convert Supabase dispute to DisputeData format
const supabaseToDispute = (record: SupabaseDispute): DisputeData => {
  const parseOutcome = (outcome: string | null): any => {
    switch (outcome) {
      case "challengerWins": return { challengerWins: {} };
      case "defenderWins": return { defenderWins: {} };
      case "noParticipation": return { noParticipation: {} };
      default: return { none: {} };
    }
  };

  // Determine effective status: if status is "none" but outcome is set,
  // the dispute was resolved (happens after DefenderWins when subject continues)
  const parseStatus = (status: string, outcome: string | null): any => {
    // If outcome is set (not null/none), treat as resolved even if status is "none"
    if (status === "none" && outcome && outcome !== "none") {
      return { resolved: {} };
    }
    switch (status) {
      case "pending": return { pending: {} };
      case "resolved": return { resolved: {} };
      default: return { none: {} };
    }
  };

  const parseDisputeType = (disputeType: string | null): any => {
    switch (disputeType) {
      case "accuracy": return { accuracy: {} };
      case "bias": return { bias: {} };
      case "outdated": return { outdated: {} };
      case "plagiarism": return { plagiarism: {} };
      case "harmful": return { harmful: {} };
      default: return { other: {} };
    }
  };

  // Extract PDA from id (format: "pda:round" or just "pda" for old records)
  const pdaPart = record.id.includes(':')
    ? record.id.split(':')[0]
    : record.id;

  return {
    publicKey: new PublicKey(pdaPart),
    account: {
      subjectId: new PublicKey(record.subject_id),
      round: record.round,
      status: parseStatus(record.status, record.outcome),
      disputeType: parseDisputeType(record.dispute_type),
      totalStake: new BN(record.total_stake || 0),
      challengerCount: record.challenger_count || 0,
      bondAtRisk: new BN(record.bond_at_risk || 0),
      defenderCount: record.defender_count || 0,
      votesForChallenger: new BN(record.votes_for_challenger || 0),
      votesForDefender: new BN(record.votes_for_defender || 0),
      voteCount: record.vote_count || 0,
      votingStartsAt: new BN(record.voting_starts_at || 0),
      votingEndsAt: new BN(record.voting_ends_at || 0),
      outcome: parseOutcome(record.outcome),
      resolvedAt: new BN(record.resolved_at || 0),
      isRestore: record.is_restore || false,
      restoreStake: new BN(record.restore_stake || 0),
      restorer: record.restorer ? new PublicKey(record.restorer) : PublicKey.default,
      detailsCid: record.details_cid || "",
      bump: 0,
      createdAt: new BN(record.created_at || 0),
      // Extended fields from Supabase
      safeBond: new BN(record.safe_bond || 0),
      winnerPool: new BN(record.winner_pool || 0),
      jurorPool: new BN(record.juror_pool || 0),
    },
  };
};

// Helper to convert event-based dispute data to DisputeData format
// Used for historical disputes reconstructed from program_events table
const eventToDispute = (
  event: DisputeFromEvents,
  disputePda: PublicKey
): DisputeData => {
  const parseOutcome = (outcome: string | undefined): any => {
    // Handle both PascalCase (from events) and camelCase
    const normalizedOutcome = outcome?.toLowerCase();
    switch (normalizedOutcome) {
      case "challengerwins": return { challengerWins: {} };
      case "defenderwins": return { defenderWins: {} };
      case "noparticipation": return { noParticipation: {} };
      default: return { none: {} };
    }
  };

  // If resolved_at exists, the dispute is resolved
  const status = event.resolved_at
    ? { resolved: {} }
    : { pending: {} };

  return {
    publicKey: disputePda,
    account: {
      subjectId: new PublicKey(event.subject_id),
      round: event.round,
      status,
      disputeType: { other: {} }, // Events don't store dispute type
      totalStake: new BN(event.total_stake || event.stake || 0),
      challengerCount: 0, // Not tracked in events
      bondAtRisk: new BN(event.bond_at_risk || 0),
      defenderCount: 0, // Not tracked in events
      votesForChallenger: new BN(event.votes_for_challenger || 0),
      votesForDefender: new BN(event.votes_for_defender || 0),
      voteCount: event.vote_count || 0,
      votingStartsAt: new BN(event.created_at || 0),
      votingEndsAt: new BN(event.voting_ends_at || 0),
      outcome: parseOutcome(event.outcome),
      resolvedAt: new BN(event.resolved_at || 0),
      isRestore: event.is_restore,
      restoreStake: event.is_restore ? new BN(event.stake || 0) : new BN(0),
      restorer: event.is_restore ? new PublicKey(event.creator) : PublicKey.default,
      detailsCid: "",
      bump: 0,
      createdAt: new BN(event.created_at || 0),
      // Reward pools from resolved event data
      safeBond: new BN(0),
      winnerPool: new BN(event.winner_pool || 0),
      jurorPool: new BN(event.juror_pool || 0),
    },
  };
};

// Safe BN to number conversion (handles overflow)
const safeToNumber = (bn: BN | number | undefined, fallback = 0): number => {
  if (bn === undefined) return fallback;
  if (typeof bn === "number") return bn;
  try {
    const num = bn.toNumber();
    return Number.isSafeInteger(num) ? num : fallback;
  } catch {
    return fallback;
  }
};

// Helper to merge Supabase dispute indexed data with on-chain dispute
// This adds safe_bond, winner_pool, juror_pool for reward breakdown display
const mergeSupabaseDisputeData = (
  dispute: DisputeData,
  supabaseDispute: SupabaseDispute | null
): DisputeData => {
  if (!supabaseDispute) return dispute;

  return {
    ...dispute,
    account: {
      ...dispute.account,
      // Add indexed reward pool data from Supabase
      safeBond: supabaseDispute.safe_bond || 0,
      winnerPool: supabaseDispute.winner_pool || 0,
      jurorPool: supabaseDispute.juror_pool || 0,
    },
  };
};

// Role badges component - displays separate J, D, C/R badges
const RoleBadges = ({ roles, isRestore }: { roles?: UserRoles | null; isRestore?: boolean }) => {
  if (!roles) return null;

  const { juror, defender, challenger } = roles;
  if (!juror && !defender && !challenger) return null;

  return (
    <div className="flex items-center gap-0.5">
      {juror && (
        <span className="text-[9px] font-bold w-4 h-4 flex items-center justify-center text-gold rounded-sm">
          J
        </span>
      )}
      {defender && (
        <span className="text-[9px] font-bold w-4 h-4 flex items-center justify-center text-sky-400 rounded-sm">
          D
        </span>
      )}
      {challenger && (
        <span className={`text-[9px] font-bold w-4 h-4 flex items-center justify-center ${isRestore ? 'text-purple-400' : 'text-crimson'} rounded-sm`}>
          {isRestore ? 'R' : 'C'}
        </span>
      )}
    </div>
  );
};

// Countdown component
const Countdown = ({ endTime }: { endTime: number }) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Date.now();
      const diff = endTime - now;
      if (diff <= 0) {
        setTimeLeft("Ended");
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      if (days > 0) setTimeLeft(`${days}d ${hours}h`);
      else if (hours > 0) setTimeLeft(`${hours}h ${minutes}m`);
      else setTimeLeft(`${minutes}m`);
    };
    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 60000);
    return () => clearInterval(interval);
  }, [endTime]);

  const isUrgent = endTime - Date.now() < 1000 * 60 * 60;
  return <span className={isUrgent ? "text-crimson" : "text-gold"}>{timeLeft}</span>;
};

// Vote Form
const VoteForm = memo(function VoteForm({
  existingVote,
  onVote,
  onAddToVote,
  isLoading,
  isRestore = false,
}: {
  existingVote: any;
  onVote: (stake: string, choice: "forChallenger" | "forDefender" | "forRestoration" | "againstRestoration", rationale: string) => void;
  onAddToVote?: (stake: string) => void;
  isLoading: boolean;
  isRestore?: boolean;
}) {
  const [voteStake, setVoteStake] = useState("0.01");
  const [addStake, setAddStake] = useState("0.01");
  const [voteChoice, setVoteChoice] = useState<"forChallenger" | "forDefender" | "forRestoration" | "againstRestoration">(
    isRestore ? "forRestoration" : "forDefender"
  );
  const [voteRationale, setVoteRationale] = useState("");

  const handleSubmit = () => {
    onVote(voteStake, voteChoice, voteRationale);
    if (!existingVote) setVoteRationale("");
  };

  const handleAddToVote = () => {
    if (onAddToVote) {
      onAddToVote(addStake);
    }
  };

  // Get existing vote display based on whether it's a restore vote
  const getExistingVoteLabel = () => {
    if (!existingVote) return "";
    if (existingVote.account.isRestoreVote) {
      const isForRestoration = existingVote.account.restoreChoice && "forRestoration" in existingVote.account.restoreChoice;
      return isForRestoration ? "FOR RESTORATION" : "AGAINST RESTORATION";
    }
    const isForChallenger = existingVote.account.choice && "forChallenger" in existingVote.account.choice;
    return isForChallenger ? "FOR CHALLENGER" : "FOR DEFENDER";
  };

  const getExistingVoteClass = () => {
    if (!existingVote) return "";
    if (existingVote.account.isRestoreVote) {
      const isForRestoration = existingVote.account.restoreChoice && "forRestoration" in existingVote.account.restoreChoice;
      return isForRestoration ? "text-purple-400" : "text-crimson";
    }
    const isForChallenger = existingVote.account.choice && "forChallenger" in existingVote.account.choice;
    return isForChallenger ? "text-crimson" : "text-sky";
  };

  // Vote choices based on restore or regular dispute
  const choices = isRestore
    ? (["forRestoration", "againstRestoration"] as const)
    : (["forDefender", "forChallenger"] as const);

  const getChoiceLabel = (choice: string) => {
    switch (choice) {
      case "forDefender": return "For Defender";
      case "forChallenger": return "For Challenger";
      case "forRestoration": return "For Restoration";
      case "againstRestoration": return "Against Restoration";
      default: return choice;
    }
  };

  const getChoiceClass = (choice: string, isSelected: boolean) => {
    if (!isSelected) return "bg-slate-light hover:bg-slate text-parchment";
    switch (choice) {
      case "forDefender": return "bg-sky-500 text-obsidian";
      case "forChallenger": return "bg-crimson text-ivory";
      case "forRestoration": return "bg-purple-500 text-ivory";
      case "againstRestoration": return "bg-crimson text-ivory";
      default: return "bg-gold text-obsidian";
    }
  };

  // If already voted, show existing vote and add stake option
  if (existingVote) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm p-3 bg-slate-light/10 rounded">
          <span className="text-steel">Your Vote:</span>
          <span className={`font-medium ${getExistingVoteClass()}`}>
            {getExistingVoteLabel()} - {(safeToNumber(existingVote.account.stakeAllocation) / LAMPORTS_PER_SOL).toFixed(6)} SOL
          </span>
        </div>
        {onAddToVote && (
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={addStake}
              onChange={(e) => setAddStake(e.target.value)}
              className="input flex-1 text-sm py-2"
              placeholder="Additional stake"
            />
            <span className="text-steel text-sm">SOL</span>
            <button
              onClick={handleAddToVote}
              disabled={isLoading}
              className="btn btn-primary py-2 px-4"
            >
              {isLoading ? "..." : "Add Stake"}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-2">
        {choices.map((choice) => (
          <button
            key={choice}
            onClick={() => setVoteChoice(choice)}
            className={`flex-1 py-2 text-xs font-medium uppercase tracking-wider transition-all ${getChoiceClass(choice, voteChoice === choice)}`}
          >
            {getChoiceLabel(choice)}
          </button>
        ))}
      </div>
      <textarea
        value={voteRationale}
        onChange={(e) => setVoteRationale(e.target.value)}
        placeholder="Rationale for your vote (optional)"
        className="input w-full text-sm py-2 h-16 resize-none"
      />
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={voteStake}
          onChange={(e) => setVoteStake(e.target.value)}
          className="input flex-1 text-sm py-2"
          placeholder="Stake amount"
        />
        <span className="text-steel text-sm">SOL</span>
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="btn btn-primary py-2 px-4"
        >
          {isLoading ? "..." : "Vote"}
        </button>
      </div>
    </>
  );
});

// Join Form
const JoinForm = memo(function JoinForm({
  type,
  onJoin,
  onJoinFromPool,
  isLoading,
  label,
  showPoolOption,
  poolBacking,
}: {
  type: "defender" | "challenger";
  onJoin: (amount: string) => void;
  onJoinFromPool?: () => void;
  isLoading: boolean;
  label?: string;
  showPoolOption?: boolean;
  poolBacking?: number;
}) {
  const [amount, setAmount] = useState(type === "defender" ? "0.1" : "0.05");

  return (
    <div className="flex flex-col gap-2 flex-1">
      {/* Pool revive option for dormant subjects */}
      {showPoolOption && onJoinFromPool && poolBacking && poolBacking > 0 && (
        <button
          onClick={onJoinFromPool}
          disabled={isLoading}
          className="btn btn-secondary py-1.5 px-3 text-sm w-full border-emerald-500/50 hover:border-emerald-400"
        >
          <span className="text-emerald">
            Revive from Pool ({(poolBacking / LAMPORTS_PER_SOL).toFixed(6)} SOL)
          </span>
        </button>
      )}
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="input flex-1 min-w-0 text-sm py-1.5"
          placeholder={type === "defender" ? "Bond" : "Stake"}
        />
        <span className="text-steel text-sm shrink-0">SOL</span>
      </div>
      {type === "defender" ? (
        <button onClick={() => onJoin(amount)} disabled={isLoading} className="btn btn-secondary py-1.5 px-3 text-sm w-full border-sky-500/50 hover:border-sky-400">
          <span className="text-sky-400">{label ? (showPoolOption ? "Revive with Direct Bond" : label) : "Join Defenders"}</span>
        </button>
      ) : (
        <button onClick={() => onJoin(amount)} disabled={isLoading} className="btn btn-secondary py-1.5 px-3 text-sm w-full border-red-800/50 hover:border-red-700">
          <span className="text-crimson">Join Challengers</span>
        </button>
      )}
    </div>
  );
});

// Claim data for a dispute (V2: uses wrapped record types with publicKey and account)
interface ClaimData {
  voteRecord?: VoteData | null;
  challengerRecord?: ChallengerRecordData | null;
  defenderRecord?: DefenderRecordData | null;
  // Flags to indicate if records came from Supabase (closed on-chain, not claimable)
  voteRecordFromSupabase?: boolean;
  challengerRecordFromSupabase?: boolean;
  defenderRecordFromSupabase?: boolean;
}

// Collapsible History Item (V2 data with V1 styling)
const HistoryItem = memo(function HistoryItem({
  pastDispute,
  disputeContent,
  votes,
  defaultExpanded = false,
  claimData,
  eventRoles,
  onClaimAll,
  onCloseRecords,
  actionLoading = false,
  escrowRound,
}: {
  pastDispute: DisputeData;
  disputeContent: any;
  votes: VoteData[];
  defaultExpanded?: boolean;
  claimData?: ClaimData | null;
  eventRoles?: { juror: boolean; challenger: boolean; defender: boolean } | null;
  onClaimAll?: (subjectIdKey: string, round: number, claims: { juror: boolean; challenger: boolean; defender: boolean }) => void;
  onCloseRecords?: (subjectIdKey: string, round: number, records: { juror: boolean; challenger: boolean; defender: boolean }) => void;
  actionLoading?: boolean;
  escrowRound?: RoundResult | null;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const claimInitiatedRef = useRef(false);
  const prevActionLoadingRef = useRef(actionLoading);
  const dOutcome = getOutcomeLabel(pastDispute.account.outcome, pastDispute.account.isRestore);

  // Watch actionLoading to detect claim completion
  useEffect(() => {
    // If actionLoading went from true to false and we initiated a claim
    if (prevActionLoadingRef.current && !actionLoading && claimInitiatedRef.current) {
      // Claim completed - show success and close modal
      setClaimSuccess(true);
      claimInitiatedRef.current = false;
      // Close modal after brief delay to show success
      setTimeout(() => {
        setShowClaimModal(false);
        setClaimSuccess(false);
      }, 1500);
    }
    prevActionLoadingRef.current = actionLoading;
  }, [actionLoading]);

  // V2: votesForChallenger/votesForDefender
  const votesForChallenger = safeToNumber(pastDispute.account.votesForChallenger);
  const votesForDefender = safeToNumber(pastDispute.account.votesForDefender);
  const totalVoteWeight = votesForChallenger + votesForDefender;
  const favorPercent = totalVoteWeight > 0 ? (votesForChallenger / totalVoteWeight) * 100 : 50;

  const isRestore = pastDispute.account.isRestore;
  const isPending = pastDispute.account.status.pending;

  // Derive user roles from claim data, with event-based fallback for closed records
  const userRoles = {
    juror: !!claimData?.voteRecord || eventRoles?.juror || false,
    defender: !!claimData?.defenderRecord || eventRoles?.defender || false,
    challenger: !!claimData?.challengerRecord || eventRoles?.challenger || false,
  };

  // Calculate rewards (winner 80%, juror 19%, treasury 1%)
  const PROTOCOL_FEE_BPS = 2000; // 20%
  const JUROR_SHARE_BPS = 9500; // 95% of fees = 19% of total
  const TREASURY_SHARE_BPS = 500; // 5% of fees = 1% of total

  // Check if dispute has indexed reward pool data (from Supabase)
  const disputeHasRewardData = pastDispute.account.safeBond !== undefined && safeToNumber(pastDispute.account.safeBond) > 0;

  // V2: totalStake (challenger) + bondAtRisk (defender)
  const totalChallengerStake = safeToNumber(escrowRound?.totalStake ?? pastDispute.account.totalStake);
  const totalDefenderBond = safeToNumber(escrowRound?.bondAtRisk ?? pastDispute.account.bondAtRisk);

  let totalPool: number;
  if (isRestore) {
    totalPool = safeToNumber(pastDispute.account.restoreStake);
  } else {
    totalPool = totalChallengerStake + totalDefenderBond;
  }

  const totalFees = totalPool * PROTOCOL_FEE_BPS / 10000;
  // Use escrowRound if available, then dispute indexed data, then fallback calculation
  const winnerPot = escrowRound
    ? safeToNumber(escrowRound.winnerPool)
    : disputeHasRewardData
      ? safeToNumber(pastDispute.account.winnerPool)
      : (totalPool - totalFees);
  const jurorPot = escrowRound
    ? safeToNumber(escrowRound.jurorPool)
    : disputeHasRewardData
      ? safeToNumber(pastDispute.account.jurorPool)
      : (totalFees * JUROR_SHARE_BPS / 10000);
  const treasuryPot = totalFees - jurorPot;

  const winnerReward = (winnerPot / LAMPORTS_PER_SOL).toFixed(4);
  const jurorReward = (jurorPot / LAMPORTS_PER_SOL).toFixed(4);
  const treasuryReward = (treasuryPot / LAMPORTS_PER_SOL).toFixed(4);
  const isFreeCase = totalPool === 0;

  // Claim availability checks - no claims for free cases (no rewards)
  // Records from Supabase (closed on-chain) are never claimable
  const isResolved = pastDispute.account.status.resolved;
  const hasJurorClaim = !isFreeCase && claimData?.voteRecord && !claimData.voteRecord.account.rewardClaimed && !claimData.voteRecordFromSupabase;
  const hasChallengerClaim = !isFreeCase && claimData?.challengerRecord && !claimData.challengerRecord.account.rewardClaimed && !claimData.challengerRecordFromSupabase;
  const hasDefenderClaim = !isFreeCase && claimData?.defenderRecord && !claimData.defenderRecord.account.rewardClaimed && !claimData.defenderRecordFromSupabase;
  const hasAnyClaim = hasJurorClaim || hasChallengerClaim || hasDefenderClaim;

  // Check if user has any claim records at all (regardless of claimed status)
  const hasAnyClaimRecord = !isFreeCase && (claimData?.voteRecord || claimData?.challengerRecord || claimData?.defenderRecord);
  const allClaimed = hasAnyClaimRecord && !hasAnyClaim;

  // Determine outcome
  const challengerWins = "challengerWins" in pastDispute.account.outcome;
  const defenderWins = "defenderWins" in pastDispute.account.outcome;
  const noParticipation = "noParticipation" in pastDispute.account.outcome;
  const restorationWins = isRestore && challengerWins;
  const restorationLoses = isRestore && defenderWins;

  // User's stake/bond amounts (V2: challenger has stake, defender has bond)
  const jurorStake = safeToNumber(claimData?.voteRecord?.account.stakeAllocation);
  const jurorVotingPower = safeToNumber(claimData?.voteRecord?.account.votingPower);
  const challengerStake = safeToNumber(claimData?.challengerRecord?.account.stake);
  const defenderBond = safeToNumber(claimData?.defenderRecord?.account.bond);

  // Check if user voted for the winning side
  const userVotedForChallenger = claimData?.voteRecord?.account.choice && "forChallenger" in claimData.voteRecord.account.choice;
  const userVotedForRestoration = claimData?.voteRecord?.account.restoreChoice && "forRestoration" in claimData.voteRecord.account.restoreChoice;
  const userVotedForWinner = isRestore
    ? (restorationWins && userVotedForRestoration) || (restorationLoses && !userVotedForRestoration)
    : (challengerWins && userVotedForChallenger) || (defenderWins && !userVotedForChallenger);

  // Create fallback escrow round from dispute data if real escrowRound is not available
  // This uses safe_bond, winner_pool, juror_pool stored in the disputes table
  const fallbackEscrowRound: RoundResult | null = !escrowRound && pastDispute.account.safeBond !== undefined ? {
    round: pastDispute.account.round,
    creator: pastDispute.account.subjectId, // Placeholder, not used in reward calculation
    resolvedAt: new BN(pastDispute.account.resolvedAt || 0),
    outcome: pastDispute.account.outcome,
    totalStake: new BN(safeToNumber(pastDispute.account.totalStake)),
    bondAtRisk: new BN(safeToNumber(pastDispute.account.bondAtRisk)),
    safeBond: new BN(safeToNumber(pastDispute.account.safeBond)),
    totalVoteWeight: new BN(safeToNumber(pastDispute.account.votesForChallenger) + safeToNumber(pastDispute.account.votesForDefender)),
    winnerPool: new BN(safeToNumber(pastDispute.account.winnerPool)),
    jurorPool: new BN(safeToNumber(pastDispute.account.jurorPool)),
    defenderCount: pastDispute.account.defenderCount || 0,
    challengerCount: pastDispute.account.challengerCount || 0,
    jurorCount: pastDispute.account.voteCount || 0,
    defenderClaims: 0,
    challengerClaims: 0,
    jurorClaims: 0,
  } : null;

  const effectiveEscrowRound = escrowRound || fallbackEscrowRound;

  // Calculate actual rewards using SDK if escrowRound available
  const userRewards = effectiveEscrowRound ? calculateUserRewards(effectiveEscrowRound, {
    jurorRecord: claimData?.voteRecord?.account,
    challengerRecord: claimData?.challengerRecord?.account,
    defenderRecord: claimData?.defenderRecord?.account,
  }) : null;

  // Fallback calculations if no escrowRound
  const jurorRewardShare = totalVoteWeight > 0 ? (jurorVotingPower / totalVoteWeight) * jurorPot : 0;
  const challengerRewardShare = challengerWins && totalChallengerStake > 0 ? (challengerStake / totalChallengerStake) * winnerPot : 0;
  const defenderRewardShare = defenderWins && totalDefenderBond > 0 ? (defenderBond / totalDefenderBond) * winnerPot : 0;

  const jurorRewardAmount = userRewards?.juror?.total ?? jurorRewardShare;
  const challengerRewardAmount = userRewards?.challenger?.total ?? challengerRewardShare;
  const defenderRewardAmount = userRewards?.defender?.total ?? defenderRewardShare;

  // Check if defender reward amount is known (has escrow data OR defender won/noParticipation)
  const defenderAmountKnown = !claimData?.defenderRecord || userRewards?.defender || defenderWins || noParticipation;

  // Total reward amount for user (sum of all applicable rewards)
  // Only include defender amount if we know the exact number
  const totalUserReward = (claimData?.voteRecord ? jurorRewardAmount : 0)
    + (claimData?.challengerRecord ? challengerRewardAmount : 0)
    + (defenderAmountKnown && claimData?.defenderRecord ? defenderRewardAmount : 0);
  const totalUserRewardFormatted = (totalUserReward / LAMPORTS_PER_SOL).toFixed(4);

  // Close record checks - records from Supabase are already closed
  const canCloseJuror = claimData?.voteRecord && claimData.voteRecord.account.rewardClaimed && claimData.voteRecord.account.stakeUnlocked && !claimData.voteRecordFromSupabase;
  const canCloseChallenger = claimData?.challengerRecord && claimData.challengerRecord.account.rewardClaimed && !claimData.challengerRecordFromSupabase;
  const canCloseDefender = claimData?.defenderRecord && claimData.defenderRecord.account.rewardClaimed && !claimData.defenderRecordFromSupabase;
  const hasClosableRecords = canCloseJuror || canCloseChallenger || canCloseDefender;

  const handleClaimAll = () => {
    if (onClaimAll) {
      claimInitiatedRef.current = true;
      onClaimAll(pastDispute.account.subjectId.toBase58(), pastDispute.account.round, {
        juror: !!hasJurorClaim,
        challenger: !!hasChallengerClaim,
        defender: !!hasDefenderClaim,
      });
    }
  };

  // Border color based on outcome
  const getBorderClass = () => {
    if (isPending) return 'border-slate-light';
    if (isRestore) {
      return restorationWins ? 'border-purple-500/50' : 'border-red-800/50';
    }
    return challengerWins ? 'border-red-800/50' : 'border-sky-500/50';
  };

  // V2: defenderCount and challengerCount
  const defenderCount = pastDispute.account.defenderCount || 0;
  const challengerCount = pastDispute.account.challengerCount || 0;
  const voteCount = pastDispute.account.voteCount || 0;

  return (
    <div className={`border ${getBorderClass()}`}>
      {/* Clickable header - V1 style */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 bg-obsidian hover:bg-obsidian/80 transition-colors text-left"
      >
        <div className="flex items-center justify-between mb-2">
          <p className={`text-sm font-medium ${isRestore ? 'text-purple-400' : 'text-crimson'}`}>
            {disputeContent?.title || (isRestore ? "Restoration Request" : `Dispute R${pastDispute.account.round}`)}
          </p>
          <div className="flex items-center gap-1">
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${isRestore ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-light/30 text-steel'}`}>
              {isRestore ? 'Restore' : 'Dispute'}
            </span>
            {isFreeCase ? (
              <span className="text-[10px] text-emerald">Free</span>
            ) : (
              <>
                <span className="text-[10px] text-emerald" title="Winner reward">{winnerReward}</span>
                <span className="text-[10px] text-gold" title="Juror reward">{jurorReward}</span>
                <span className="text-[10px] text-steel" title="Treasury">{treasuryReward}</span>
              </>
            )}
            <RoleBadges roles={userRoles} isRestore={isRestore} />
            {userRoles.juror && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                isRestore
                  ? (userVotedForRestoration ? 'bg-purple-500/20 text-purple-400' : 'bg-red-800/20 text-crimson')
                  : (userVotedForChallenger ? 'bg-red-800/20 text-crimson' : 'bg-sky-500/20 text-sky-400')
              }`}>
                {isRestore
                  ? (userVotedForRestoration ? '→ Restore' : '→ Reject')
                  : (userVotedForChallenger ? '→ Challenger' : '→ Defender')
                }
              </span>
            )}
            {isResolved && hasAnyClaim && (
              <span
                onClick={(e) => { e.stopPropagation(); setShowClaimModal(true); }}
                className="text-[10px] px-1.5 py-0.5 rounded bg-gold-20 text-gold cursor-pointer hover:bg-gold-30"
              >
                Claim +{totalUserRewardFormatted}
              </span>
            )}
            {isResolved && allClaimed && (
              <span
                onClick={(e) => { e.stopPropagation(); setShowClaimModal(true); }}
                className="text-[10px] text-steel cursor-pointer hover:text-parchment"
              >
                +{totalUserRewardFormatted}
              </span>
            )}
            {hasClosableRecords && !hasAnyClaim && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseRecords?.(pastDispute.account.subjectId.toBase58(), pastDispute.account.round, {
                    juror: !!canCloseJuror,
                    challenger: !!canCloseChallenger,
                    defender: !!canCloseDefender,
                  });
                }}
                className="text-[10px] px-1.5 py-0.5 rounded bg-steel/20 text-steel cursor-pointer hover:bg-steel/30"
              >
                Close
              </span>
            )}
            <ChevronDownIcon expanded={expanded} />
          </div>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-steel font-mono text-[9px]">{pastDispute.publicKey.toBase58()}</span>
          <div className="flex items-center gap-2">
            <span className={`font-medium ${dOutcome.class}`}>{isPending ? 'Voting' : dOutcome.label}</span>
            {!isPending && (
              <span className="text-steel">
                {new Date(safeToNumber(pastDispute.account.resolvedAt) * 1000).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Claim Modal - V1 style */}
      {showClaimModal && (
        <div className="fixed inset-0 bg-obsidian/90 flex items-start justify-center z-[60] pt-16 sm:pt-28 px-2 sm:px-4 pb-4" onClick={() => setShowClaimModal(false)}>
          <div className="tribunal-modal w-full max-w-[calc(100vw-1rem)] sm:max-w-md max-h-[calc(100vh-5rem)] sm:max-h-[calc(100vh-8rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-light flex items-center justify-between sticky top-0 bg-slate z-10">
              <h3 className="font-display text-sm font-semibold text-gold">Claim Rewards</h3>
              <button onClick={() => setShowClaimModal(false)} className="text-steel hover:text-parchment">
                <XIcon />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {/* Outcome */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-steel">Outcome</span>
                <span className={`text-sm font-medium ${dOutcome.class}`}>{dOutcome.label}</span>
              </div>

              {/* Rewards by Role */}
              <div className="space-y-2">
                {/* Juror Reward */}
                {claimData?.voteRecord && (
                  <div className={`p-3 bg-obsidian border ${hasJurorClaim ? 'border-gold/30' : 'border-slate-light/30'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gold">J</span>
                        <span className="text-xs text-steel">Juror</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${hasJurorClaim ? 'text-gold' : 'text-steel'}`}>
                          +{(jurorRewardAmount / LAMPORTS_PER_SOL).toFixed(6)} SOL
                        </span>
                        {!hasJurorClaim && (claimData.voteRecord.account.rewardClaimed || claimData.voteRecordFromSupabase) && (
                          <span className="text-emerald text-xs">✓</span>
                        )}
                      </div>
                    </div>
                    <div className="text-[10px] text-steel/60 mt-1">
                      {totalVoteWeight > 0 ? (jurorVotingPower / totalVoteWeight * 100).toFixed(1) : 0}% of vote weight
                    </div>
                  </div>
                )}

                {/* Challenger/Restorer Reward */}
                {claimData?.challengerRecord && (
                  <div className={`p-3 bg-obsidian border ${hasChallengerClaim ? (isRestore ? 'border-purple-500/30' : 'border-crimson/30') : 'border-slate-light/30'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold ${isRestore ? 'text-purple-400' : 'text-crimson'}`}>
                          {isRestore ? 'R' : 'C'}
                        </span>
                        <span className="text-xs text-steel">{isRestore ? 'Restorer' : 'Challenger'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {(challengerWins || noParticipation) ? (
                          <span className={`text-sm font-medium ${hasChallengerClaim ? 'text-emerald' : 'text-steel'}`}>
                            +{(challengerRewardAmount / LAMPORTS_PER_SOL).toFixed(6)} SOL
                          </span>
                        ) : (
                          <span className={`text-sm font-medium ${isRestore ? 'text-purple-400/60' : 'text-crimson/60'}`}>
                            -{(challengerStake / LAMPORTS_PER_SOL).toFixed(6)} SOL
                          </span>
                        )}
                        {!hasChallengerClaim && (claimData.challengerRecord.account.rewardClaimed || claimData.challengerRecordFromSupabase) && (
                          <span className="text-emerald text-xs">✓</span>
                        )}
                      </div>
                    </div>
                    <div className="text-[10px] text-steel/60 mt-1">
                      {challengerWins
                        ? `${totalChallengerStake > 0 ? (challengerStake / totalChallengerStake * 100).toFixed(1) : 0}% of winner pot`
                        : noParticipation
                        ? 'Stake refunded (99%)'
                        : 'Stake forfeited'
                      }
                    </div>
                  </div>
                )}

                {/* Defender Reward */}
                {claimData?.defenderRecord && (
                  <div className={`p-3 bg-obsidian border ${hasDefenderClaim ? 'border-sky-500/30' : 'border-slate-light/30'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-sky-400">D</span>
                        <span className="text-xs text-steel">Defender</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Show amount if we have userRewards or if defender won/noParticipation */}
                        {(userRewards?.defender || defenderWins || noParticipation) ? (
                          <span className={`text-sm font-medium ${hasDefenderClaim ? 'text-emerald' : 'text-steel'}`}>
                            +{(defenderRewardAmount / LAMPORTS_PER_SOL).toFixed(6)} SOL
                          </span>
                        ) : (
                          <span className="text-sm font-medium text-steel/60">
                            Safe bond returned
                          </span>
                        )}
                        {!hasDefenderClaim && (claimData.defenderRecord.account.rewardClaimed || claimData.defenderRecordFromSupabase) && (
                          <span className="text-emerald text-xs">✓</span>
                        )}
                      </div>
                    </div>
                    {/* Defender breakdown: safe bond + winner share */}
                    <div className="text-[10px] text-steel/60 mt-1 space-y-0.5">
                      {userRewards?.defender ? (
                        <>
                          <div className="flex justify-between">
                            <span>Safe bond</span>
                            <span className="text-emerald/80">+{(userRewards.defender.safeBondShare / LAMPORTS_PER_SOL).toFixed(6)}</span>
                          </div>
                          {(defenderWins || noParticipation) && userRewards.defender.winnerPoolShare > 0 && (
                            <div className="flex justify-between">
                              <span>{noParticipation ? 'Bond refund (99%)' : `Winner share (${(userRewards.defender.poolPercentage).toFixed(1)}%)`}</span>
                              <span className="text-emerald/80">+{(userRewards.defender.winnerPoolShare / LAMPORTS_PER_SOL).toFixed(6)}</span>
                            </div>
                          )}
                          {!defenderWins && !noParticipation && (
                            <div className="flex justify-between">
                              <span>Bond at risk (lost)</span>
                              <span className="text-crimson/60">-{((defenderBond - userRewards.defender.safeBondShare) / LAMPORTS_PER_SOL).toFixed(6)}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <span>
                          {defenderWins
                            ? `${totalDefenderBond > 0 ? (defenderBond / totalDefenderBond * 100).toFixed(1) : 0}% of winner pot`
                            : noParticipation
                            ? 'Safe bond + at-risk refunded (99%)'
                            : 'Bond at risk forfeited'
                          }
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Total */}
                {(claimData?.voteRecord || claimData?.challengerRecord || claimData?.defenderRecord) && (
                  <div className={`p-3 bg-slate-light/10 border-t border-slate-light/30`}>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs text-steel">Total Reward</span>
                        {!defenderAmountKnown && claimData?.defenderRecord && (
                          <span className="text-[9px] text-steel/50">+ safe bond (see above)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${hasAnyClaim ? 'text-gold' : 'text-steel'}`}>
                          +{totalUserRewardFormatted} SOL
                        </span>
                        {allClaimed && (
                          <span className="text-emerald">
                            <CheckIcon />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {claimSuccess ? (
                <div className="flex items-center justify-center gap-2 py-2 text-emerald">
                  <CheckIcon />
                  <span>Claimed Successfully!</span>
                </div>
              ) : hasAnyClaim ? (
                <button
                  onClick={handleClaimAll}
                  disabled={actionLoading}
                  className="btn btn-primary w-full py-2"
                >
                  {actionLoading ? "Claiming..." : "Claim All"}
                </button>
              ) : (
                <button
                  onClick={() => setShowClaimModal(false)}
                  className="btn btn-secondary w-full py-2"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Expandable content - V1 style */}
      {expanded && (
        <>
          {/* Dispute content rendered dynamically */}
          <div className="p-3 bg-obsidian space-y-2">
            {disputeContent && (
              <JsonContentRenderer
                data={Object.fromEntries(
                  Object.entries(disputeContent).filter(([key]) =>
                    !['title', 'evidence'].includes(key)
                  )
                )}
              />
            )}
            {disputeContent?.evidence && disputeContent.evidence.length > 0 && (
              <EvidenceViewer evidence={disputeContent.evidence} />
            )}
            {/* Resolution info */}
            {!isPending && (
              <div className="pt-2 border-t border-slate-light/30 grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="text-steel">Resolved: </span>
                  <span className="text-parchment">{new Date(safeToNumber(pastDispute.account.resolvedAt) * 1000).toLocaleString()}</span>
                </div>
                <div className="text-right">
                  <span className="text-steel">Duration: </span>
                  <span className="text-parchment">
                    {Math.round((safeToNumber(pastDispute.account.votingEndsAt) - safeToNumber(pastDispute.account.createdAt)) / 3600)}h
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* VS / Power bar - V1 style with V2 data */}
          <div className="p-3 bg-obsidian space-y-2">
            {isRestore ? (
              <>
                {/* Restoration voting bar */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-400">For Restoration</span>
                  <span className="text-crimson">Against Restoration</span>
                </div>
                <div className="h-1 rounded overflow-hidden flex bg-obsidian">
                  <div className="h-full" style={{ width: `${favorPercent}%`, backgroundColor: '#a855f7' }} />
                  <div className="h-full" style={{ width: `${100 - favorPercent}%`, backgroundColor: '#dc2626' }} />
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span>
                    <span className="text-purple-400">
                      {(safeToNumber(pastDispute.account.restoreStake) / LAMPORTS_PER_SOL).toFixed(6)}
                    </span>
                    <span className="text-steel"> · </span>
                    <span className="text-purple-400">{votes.filter(v => v.account.restoreChoice && "forRestoration" in v.account.restoreChoice).length}</span>
                    <span className="text-steel"> · </span>
                    <span className="text-purple-400">{favorPercent.toFixed(0)}%</span>
                  </span>
                  <span className="text-steel">{voteCount} votes</span>
                  <span>
                    <span className="text-crimson">{(100 - favorPercent).toFixed(0)}%</span>
                    <span className="text-steel"> · </span>
                    <span className="text-crimson">{votes.filter(v => v.account.restoreChoice && "againstRestoration" in v.account.restoreChoice).length}</span>
                  </span>
                </div>
              </>
            ) : (
              <>
                {/* Regular dispute bar */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-sky-400">
                    {defenderCount} Defender{defenderCount !== 1 ? 's' : ''}
                  </span>
                  <span className="text-crimson">
                    {challengerCount} Challenger{challengerCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="h-1 rounded overflow-hidden flex bg-obsidian">
                  <div className="h-full" style={{ width: `${100 - favorPercent}%`, backgroundColor: '#0ea5e9' }} />
                  <div className="h-full" style={{ width: `${favorPercent}%`, backgroundColor: '#dc2626' }} />
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span>
                    <span className="text-sky-400">
                      {(totalDefenderBond / LAMPORTS_PER_SOL).toFixed(6)}
                    </span>
                    <span className="text-steel"> · </span>
                    <span className="text-sky-400">{votes.filter(v => v.account.choice && "forDefender" in v.account.choice).length}</span>
                    <span className="text-steel"> · </span>
                    <span className="text-sky-400">{(100 - favorPercent).toFixed(0)}%</span>
                  </span>
                  <span className="text-steel">{voteCount} votes</span>
                  <span>
                    <span className="text-crimson">{favorPercent.toFixed(0)}%</span>
                    <span className="text-steel"> · </span>
                    <span className="text-crimson">{votes.filter(v => v.account.choice && "forChallenger" in v.account.choice).length}</span>
                    <span className="text-steel"> · </span>
                    <span className="text-crimson">
                      {(totalChallengerStake / LAMPORTS_PER_SOL).toFixed(6)}
                    </span>
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Juror remarks for this history item */}
          {votes.length > 0 && (
            <div className="p-3 bg-obsidian/50 border-t border-slate-light/30">
              <p className="text-[10px] text-steel uppercase tracking-wider mb-2">Juror Remarks ({votes.length})</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {votes.map((vote, i) => {
                  const hasRationale = vote.account.rationaleCid && vote.account.rationaleCid.length > 0;
                  const jurorAddress = vote.account.juror.toBase58();
                  const stakeAmount = safeToNumber(vote.account.stakeAllocation) / LAMPORTS_PER_SOL;

                  // Determine vote display based on whether it's a restore vote
                  const isRestoreVote = vote.account.isRestoreVote;
                  const isForChallenger = vote.account.choice && "forChallenger" in vote.account.choice;
                  const isForRestoration = vote.account.restoreChoice && "forRestoration" in vote.account.restoreChoice;
                  const voteLabel = isRestoreVote
                    ? (isForRestoration ? "FOR RESTORATION" : "AGAINST RESTORATION")
                    : (isForChallenger ? "FOR CHALLENGER" : "FOR DEFENDER");
                  const voteColorClass = isRestoreVote
                    ? (isForRestoration ? "text-purple-400" : "text-crimson")
                    : (isForChallenger ? "text-crimson" : "text-sky");
                  const borderColorClass = isRestoreVote
                    ? (isForRestoration ? "border-purple-500/20" : "border-red-800/20")
                    : (isForChallenger ? "border-red-800/20" : "border-sky-500/20");

                  return (
                    <div key={i} className={`p-2 bg-obsidian border ${borderColorClass}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-medium ${voteColorClass}`}>
                            {voteLabel}
                          </span>
                          <span className="text-[10px] text-steel">
                            {jurorAddress.slice(0, 4)}...{jurorAddress.slice(-4)}
                          </span>
                        </div>
                        <span className="text-[10px] text-gold">{stakeAmount.toFixed(6)} SOL</span>
                      </div>
                      {hasRationale ? (
                        <p className="text-[10px] text-parchment">{vote.account.rationaleCid}</p>
                      ) : (
                        <p className="text-[10px] text-steel/50 italic">No rationale</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
});

export const SubjectModal = memo(function SubjectModal({
  subject,
  subjectContent,
  jurorPool,
  creatorPoolBacking,
  userPoolBacking,
  onClose,
  onVote,
  onAddBond,
  onJoinChallengers,
  onResolve,
  onClaimAll,
  onCloseRecords,
  onRefresh,
  actionLoading,
  showActions = true,
  getIpfsUrl,
  inline = false,
}: SubjectModalProps) {
  const modalScrollRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef(0);

  // Wallet for user-specific data
  const { publicKey } = useWallet();

  // Hooks for internal data fetching (V2 SDK)
  const {
    createDispute,
    submitRestore,
    addToVote,
    fetchDefenderPool,
    fetchChallengerPool,
    getChallengerPoolPDA,
    fetchJurorRecordsBySubject,
    fetchDispute,
    getDisputePDA,
    fetchChallengerRecordsBySubject,
    getJurorRecordPDA,
    getChallengerRecordPDA,
    getDefenderRecordPDA,
    getDefenderPoolPDA,
    fetchJurorPool,
    getJurorPoolPDA,
    getEscrowPDA,
    // Batch fetch - single RPC call for modal data
    fetchModalData,
  } = useTribunalcraft();
  const { uploadDispute, isUploading } = useUpload();
  const { fetchDispute: fetchDisputeContent, getUrl } = useContentFetch();

  // ═══════════════════════════════════════════════════════════════════════════════
  // INTERNAL STATE - Modal fetches everything it needs
  // ═══════════════════════════════════════════════════════════════════════════════

  const [loading, setLoading] = useState(true);

  // All disputes for this subject
  const [allDisputes, setAllDisputes] = useState<DisputeData[]>([]);

  // Votes for all disputes keyed by dispute publicKey
  const [allDisputeVotes, setAllDisputeVotes] = useState<Record<string, VoteData[]>>({});

  // Content for all disputes keyed by dispute publicKey
  const [allDisputeContents, setAllDisputeContents] = useState<Record<string, DisputeContent | null>>({});

  // User's vote records keyed by dispute publicKey
  const [userVoteRecords, setUserVoteRecords] = useState<Record<string, VoteData | null>>({});

  // User's challenger records keyed by dispute publicKey
  const [userChallengerRecords, setUserChallengerRecords] = useState<Record<string, ChallengerRecordData | null>>({});

  // User's defender records keyed by disputePda:round
  const [userDefenderRecords, setUserDefenderRecords] = useState<Record<string, DefenderRecordData | null>>({});

  // Track which records came from Supabase (closed on-chain, not claimable)
  const [recordsFromSupabase, setRecordsFromSupabase] = useState<{
    vote: Record<string, boolean>;
    challenger: Record<string, boolean>;
    defender: Record<string, boolean>;
  }>({ vote: {}, challenger: {}, defender: {} });

  // Event-based user roles (fallback when records are closed)
  // Keyed by round number
  const [userRolesFromEvents, setUserRolesFromEvents] = useState<Map<number, { juror: boolean; challenger: boolean; defender: boolean }>>(new Map());

  // Challenger reputation for active dispute creator
  const [activeDisputeCreatorRep, setActiveDisputeCreatorRep] = useState<number | null>(null);

  // Escrow data for claim calculations (keyed by round)
  const [escrowData, setEscrowData] = useState<Escrow | null>(null);

  // Derived: active dispute (pending, voting not ended) or waiting resolution
  const activeDispute = allDisputes.find(d =>
    d.account.status.pending
  ) || null;

  // Derived: past disputes (resolved)
  const pastDisputes = allDisputes.filter(d =>
    d.account.status.resolved
  );

  // Derived: key for active dispute records (disputePda:round)
  const activeDisputeKey = activeDispute ? `${activeDispute.publicKey.toBase58()}:${activeDispute.account.round}` : null;

  // Derived: current user's vote on active dispute
  const existingVote = activeDisputeKey ? userVoteRecords[activeDisputeKey] : null;

  // Derived: current user's challenger record on active dispute
  const challengerRecord = activeDisputeKey ? userChallengerRecords[activeDisputeKey] : null;

  // Derived: current user's defender record on active dispute
  const userDefenderRecord = activeDisputeKey ? userDefenderRecords[activeDisputeKey] : null;

  // Derived: votes for active dispute
  const disputeVotes = activeDispute ? (allDisputeVotes[activeDispute.publicKey.toBase58()] || []) : [];

  // Derived: content for active dispute
  const disputeContent = activeDispute ? allDisputeContents[activeDispute.publicKey.toBase58()] : null;

  // Derived: user roles for active dispute (V2: check DefenderRecord)
  const isDefender = !!userDefenderRecord;
  const isChallenger = !!challengerRecord;
  const isJuror = !!existingVote;
  const userRoles: UserRoles = { juror: isJuror, defender: !!isDefender, challenger: isChallenger };

  // Internal state for dispute/restore forms
  const [showCreateDispute, setShowCreateDispute] = useState(false);
  const [showRestoreForm, setShowRestoreForm] = useState(false);
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [internalSuccess, setInternalSuccess] = useState<string | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════════
  // DATA FETCHING - Load dispute and related data for this subject (V2)
  // ═══════════════════════════════════════════════════════════════════════════════

  const loadSubjectData = useCallback(async () => {
    setLoading(true);
    try {
      const subjectId = subject.account.subjectId;
      const currentRound = subject.account.round;
      const [disputePda] = getDisputePDA(subjectId);

      // ═══════════════════════════════════════════════════════════════════════
      // BATCH FETCH - Single RPC call for on-chain data (dispute, escrow, user records)
      // ═══════════════════════════════════════════════════════════════════════
      const modalDataPromise = fetchModalData(subjectId, currentRound, publicKey);

      // Parallel: Supabase queries (historical data) + juror records (all voters)
      const supabaseDisputesPromise: Promise<SupabaseDispute[]> = getAllDisputesBySubject(subjectId.toBase58()).catch(() => []);
      const supabaseEscrowPromise = getEscrowBySubject(subjectId.toBase58()).catch(() => null);
      const jurorRecordsPromise = fetchJurorRecordsBySubject(subjectId).catch(() => []);
      // Event-based historical disputes (captures ALL disputes including overwritten ones)
      const eventDisputesPromise: Promise<DisputeFromEvents[]> = getDisputeHistoryFromEvents(subjectId.toBase58()).catch(() => []);

      // Parallel: User's Supabase records (fallback for closed on-chain records)
      // Fetch ALL rounds to support claim modal for past disputes including restore
      const userSupabasePromise = publicKey ? Promise.all([
        getJurorRecords({ subjectId: subjectId.toBase58(), juror: publicKey.toBase58() }).catch(() => []),
        getChallengerRecords({ subjectId: subjectId.toBase58(), challenger: publicKey.toBase58() }).catch(() => []),
        getDefenderRecords({ subjectId: subjectId.toBase58(), defender: publicKey.toBase58() }).catch(() => []),
      ]) : Promise.resolve([[], [], []] as [any[], any[], any[]]);

      // Event-based user roles (fallback when records are closed)
      const userEventRolesPromise = publicKey
        ? getUserRolesFromEvents(subjectId.toBase58(), publicKey.toBase58()).catch(() => new Map())
        : Promise.resolve(new Map<number, { juror: boolean; challenger: boolean; defender: boolean }>());

      // Wait for all parallel fetches
      const [modalData, supabaseDisputesRaw, supabaseEscrow, jurorRecords, userSupabaseRecords, eventDisputes, eventRoles] = await Promise.all([
        modalDataPromise,
        supabaseDisputesPromise,
        supabaseEscrowPromise,
        jurorRecordsPromise,
        userSupabasePromise,
        eventDisputesPromise,
        userEventRolesPromise,
      ]);
      const supabaseDisputes = supabaseDisputesRaw as SupabaseDispute[];

      // Store event-based roles
      setUserRolesFromEvents(eventRoles);

      // ═══════════════════════════════════════════════════════════════════════
      // PROCESS DISPUTE DATA
      // ═══════════════════════════════════════════════════════════════════════
      let dispute: DisputeData | null = null;
      if (modalData.dispute) {
        dispute = { publicKey: disputePda, account: modalData.dispute };
        // Merge Supabase indexed data for reward breakdown display
        const matchingSupabase = supabaseDisputes.find(sd => sd.round === currentRound);
        if (matchingSupabase) {
          dispute = mergeSupabaseDisputeData(dispute, matchingSupabase);
        }
      }

      // Build dispute list (on-chain + Supabase + event-based historical)
      // Priority: on-chain (current) > Supabase (indexed) > events (historical)
      const disputeList: DisputeData[] = [];
      if (dispute) {
        const hasActiveStatus = dispute.account.status.pending || dispute.account.status.resolved;
        const wasResolvedAndReset = dispute.account.status.none &&
          (dispute.account.outcome.challengerWins || dispute.account.outcome.defenderWins || dispute.account.outcome.noParticipation);
        if (hasActiveStatus || wasResolvedAndReset) {
          if (wasResolvedAndReset) {
            dispute.account.status = { resolved: {} };
          }
          disputeList.push(dispute);
        }
      }
      // Add Supabase disputes (for indexed data like vote counts)
      for (const sd of supabaseDisputes) {
        if (!disputeList.some(d => d.account.round === sd.round)) {
          disputeList.push(supabaseToDispute(sd));
        }
      }
      // Add event-based disputes (for historical disputes not in Supabase - e.g., overwritten)
      for (const ed of eventDisputes) {
        if (!disputeList.some(d => d.account.round === ed.round)) {
          disputeList.push(eventToDispute(ed, disputePda));
        }
      }
      disputeList.sort((a, b) => b.account.round - a.account.round);
      setAllDisputes(disputeList);

      // ═══════════════════════════════════════════════════════════════════════
      // PROCESS ESCROW DATA
      // ═══════════════════════════════════════════════════════════════════════
      if (modalData.escrow) {
        setEscrowData(modalData.escrow);
      } else if (supabaseEscrow) {
        setEscrowData(supabaseToEscrow(supabaseEscrow));
      } else {
        setEscrowData(null);
      }

      if (disputeList.length === 0) {
        setLoading(false);
        return;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // PROCESS JUROR RECORDS (all votes for vote distribution display)
      // ═══════════════════════════════════════════════════════════════════════
      const votesMap: Record<string, VoteData[]> = {};
      const recordsByRound: Record<number, VoteData[]> = {};
      for (const jr of jurorRecords || []) {
        const round = jr.account.round;
        if (!recordsByRound[round]) recordsByRound[round] = [];
        recordsByRound[round].push({ publicKey: jr.publicKey, account: jr.account });
      }
      for (const d of disputeList) {
        votesMap[d.publicKey.toBase58()] = recordsByRound[d.account.round] || [];
      }
      setAllDisputeVotes(votesMap);

      // ═══════════════════════════════════════════════════════════════════════
      // FETCH DISPUTE CONTENT (IPFS) - can't batch, do after main data
      // ═══════════════════════════════════════════════════════════════════════
      const contentsMap: Record<string, DisputeContent | null> = {};
      if (dispute && dispute.account.detailsCid) {
        try {
          const content = await fetchDisputeContent(dispute.account.detailsCid);
          contentsMap[dispute.publicKey.toBase58()] = content;
        } catch {
          // Ignore content fetch errors
        }
      }
      setAllDisputeContents(contentsMap);

      // ═══════════════════════════════════════════════════════════════════════
      // PROCESS USER RECORDS (from batch fetch, with Supabase fallback)
      // Key by disputePda:round to support claims for all rounds including restore
      // ═══════════════════════════════════════════════════════════════════════
      if (publicKey) {
        const disputeKey = `${disputePda.toBase58()}:${currentRound}`;
        const supabaseFlags = {
          vote: {} as Record<string, boolean>,
          challenger: {} as Record<string, boolean>,
          defender: {} as Record<string, boolean>,
        };

        // Juror records - on-chain for current round, Supabase for all rounds
        const voteRecordsMap: Record<string, VoteData | null> = {};
        if (modalData.jurorRecord) {
          const [jurorRecordPda] = getJurorRecordPDA(subjectId, publicKey, currentRound);
          voteRecordsMap[disputeKey] = { publicKey: jurorRecordPda, account: modalData.jurorRecord };
        }
        // Add all Supabase juror records (for past rounds including restore)
        for (const sjr of userSupabaseRecords[0] || []) {
          const key = `${disputePda.toBase58()}:${sjr.round}`;
          if (!voteRecordsMap[key]) {
            voteRecordsMap[key] = supabaseToJurorRecord(sjr);
            supabaseFlags.vote[key] = true;
          }
        }
        setUserVoteRecords(voteRecordsMap);

        // Challenger records - on-chain for current round, Supabase for all rounds
        const challRecordsMap: Record<string, ChallengerRecordData | null> = {};
        if (modalData.challengerRecord) {
          const [challRecordPda] = getChallengerRecordPDA(subjectId, publicKey, currentRound);
          challRecordsMap[disputeKey] = { publicKey: challRecordPda, account: modalData.challengerRecord };
        }
        // Add all Supabase challenger records (for past rounds including restore)
        for (const scr of userSupabaseRecords[1] || []) {
          const key = `${disputePda.toBase58()}:${scr.round}`;
          if (!challRecordsMap[key]) {
            challRecordsMap[key] = supabaseToChallengerRecord(scr);
            supabaseFlags.challenger[key] = true;
          }
        }
        setUserChallengerRecords(challRecordsMap);

        // Defender records - on-chain for current round, Supabase for all rounds
        const defRecordsMap: Record<string, DefenderRecordData | null> = {};
        if (modalData.defenderRecord) {
          const [defRecordPda] = getDefenderRecordPDA(subjectId, publicKey, currentRound);
          defRecordsMap[disputeKey] = { publicKey: defRecordPda, account: modalData.defenderRecord };
        }
        // Add all Supabase defender records (for past rounds)
        for (const sdr of userSupabaseRecords[2] || []) {
          const key = `${disputePda.toBase58()}:${sdr.round}`;
          if (!defRecordsMap[key]) {
            defRecordsMap[key] = supabaseToDefenderRecord(sdr);
            supabaseFlags.defender[key] = true;
          }
        }
        setUserDefenderRecords(defRecordsMap);

        setRecordsFromSupabase(supabaseFlags);

        // Fetch dispute creator's reputation (still needs separate call for now)
        if (dispute && dispute.account.status.pending) {
          try {
            const challengers = await fetchChallengerRecordsBySubject(subjectId);
            if (challengers && challengers.length > 0) {
              const creatorPubkey = challengers[0].account.challenger;
              const [creatorChallengerPoolPda] = getChallengerPoolPDA(creatorPubkey);
              const creatorChallengerPool = await fetchChallengerPool(creatorChallengerPoolPda);
              if (creatorChallengerPool) {
                const rep = creatorChallengerPool.reputation;
                setActiveDisputeCreatorRep(
                  typeof rep === 'number' ? rep : (rep as any).toNumber?.() ?? null
                );
              }
            }
          } catch {
            // Ignore
          }
        }
      }
    } catch (error) {
      console.error("Error loading subject data:", error);
    }
    setLoading(false);
  }, [
    subject.account.subjectId,
    subject.account.round,
    subject.publicKey,
    publicKey,
    getDisputePDA,
    fetchModalData,
    fetchJurorRecordsBySubject,
    fetchChallengerRecordsBySubject,
    fetchDisputeContent,
    getJurorRecordPDA,
    getChallengerRecordPDA,
    getDefenderRecordPDA,
    getChallengerPoolPDA,
    fetchChallengerPool,
  ]);

  // Load data when modal opens
  useEffect(() => {
    loadSubjectData();
  }, [loadSubjectData]);

  // Wrapped claim handler that refreshes modal data after claiming (V2: subjectIdKey, round, claims)
  const handleClaimAllWithRefresh = useCallback(async (subjectIdKey: string, round: number, claims: { juror: boolean; challenger: boolean; defender: boolean }) => {
    if (onClaimAll) {
      onClaimAll(subjectIdKey, round, claims);
      // Wait a bit for the transaction to complete, then refresh
      setTimeout(() => {
        loadSubjectData();
      }, 2000);
    }
  }, [onClaimAll, loadSubjectData]);

  // Wrapped close records handler that refreshes modal data after closing (V2: subjectIdKey, round, records)
  const handleCloseRecordsWithRefresh = useCallback(async (subjectIdKey: string, round: number, records: { juror: boolean; challenger: boolean; defender: boolean }) => {
    if (onCloseRecords) {
      onCloseRecords(subjectIdKey, round, records);
      // Wait a bit for the transaction to complete, then refresh
      setTimeout(() => {
        loadSubjectData();
      }, 2000);
    }
  }, [onCloseRecords, loadSubjectData]);

  // Dispute form state
  const [disputeForm, setDisputeForm] = useState({
    type: "other",
    title: "",
    reason: "",
    requestedOutcome: "",
    stakeAmount: "0.01",
  });

  // Restore calculations
  const minRestoreStake = subject.account.lastDisputeTotal?.toNumber() ?? 0;
  const minRestoreStakeSol = minRestoreStake / LAMPORTS_PER_SOL;
  const restoreVotingPeriodHours = Math.floor((subject.account.votingPeriod?.toNumber() ?? 0) * 2 / 3600);

  // Restore form state
  const [restoreForm, setRestoreForm] = useState({
    title: "",
    reason: "",
    stakeAmount: minRestoreStakeSol > 0 ? minRestoreStakeSol.toFixed(6) : "0.1",
  });

  // Calculate min bond based on user's reputation from ChallengerPool (V2)
  const [userChallengerRep, setUserChallengerRep] = useState<number | null>(null);
  useEffect(() => {
    const fetchRep = async () => {
      if (!publicKey) {
        setUserChallengerRep(INITIAL_REPUTATION);
        return;
      }
      try {
        const [challengerPoolPda] = getChallengerPoolPDA(publicKey);
        const challengerPool = await fetchChallengerPool(challengerPoolPda);
        if (challengerPool) {
          const rep = challengerPool.reputation;
          setUserChallengerRep(typeof rep === 'number' ? rep : (rep as any).toNumber?.() ?? INITIAL_REPUTATION);
        } else {
          setUserChallengerRep(INITIAL_REPUTATION);
        }
      } catch {
        setUserChallengerRep(INITIAL_REPUTATION);
      }
    };
    fetchRep();
  }, [publicKey, getChallengerPoolPDA, fetchChallengerPool]);

  const minBond = calculateMinBond(userChallengerRep ?? INITIAL_REPUTATION);
  const minBondSol = minBond / LAMPORTS_PER_SOL;

  // Reset forms when modal state changes
  useEffect(() => {
    if (showCreateDispute) {
      // Round up to 6 decimals to avoid floating-point precision issues
      const roundedMinStake = Math.ceil(minBondSol * 1_000_000) / 1_000_000;
      setDisputeForm({ type: "other", title: "", reason: "", requestedOutcome: "", stakeAmount: roundedMinStake.toFixed(6) });
      setInternalError(null);
      setInternalSuccess(null);
    }
  }, [showCreateDispute, minBondSol]);

  useEffect(() => {
    if (showRestoreForm) {
      setRestoreForm({
        title: "",
        reason: "",
        stakeAmount: minRestoreStakeSol > 0 ? minRestoreStakeSol.toFixed(6) : "0.1",
      });
      setInternalError(null);
      setInternalSuccess(null);
    }
  }, [showRestoreForm, minRestoreStakeSol]);

  // Handle dispute submission
  const handleCreateDispute = useCallback(async () => {
    if (!disputeForm.title || !disputeForm.reason) {
      setInternalError("Title and reason are required");
      return;
    }

    const stakeLamports = Math.floor(parseFloat(disputeForm.stakeAmount) * LAMPORTS_PER_SOL);
    // Use floor for comparison to handle floating-point precision (e.g., 0.010102 * 1e9 might be 10101999.999...)
    if (isNaN(stakeLamports) || stakeLamports < minBond) {
      const roundedMin = Math.ceil(minBondSol * 1_000_000) / 1_000_000;
      setInternalError(`Minimum stake is ${roundedMin.toFixed(6)} SOL`);
      return;
    }

    setInternalLoading(true);
    setInternalError(null);
    setInternalSuccess(null);

    try {
      // Upload dispute content to IPFS
      const disputeType = DISPUTE_TYPES.find(t => t.key === disputeForm.type);
      const uploadResult = await uploadDispute({
        title: disputeForm.title,
        reason: disputeForm.reason,
        requestedOutcome: disputeForm.requestedOutcome,
        type: disputeType?.contentKey || "other",
        subjectCid: subject.account.subjectId.toBase58(), // V2: Use subjectId as CID
      });
      if (!uploadResult) {
        throw new Error("Failed to upload dispute content");
      }

      // V2: Submit dispute on-chain using createDispute with params object
      const disputeTypeEnum = { [disputeForm.type]: {} } as DisputeType;
      await createDispute({
        subjectId: subject.account.subjectId,
        disputeType: disputeTypeEnum,
        detailsCid: uploadResult.cid,
        stake: new BN(stakeLamports),
        round: subject.account.round,
      });

      // Check if dispute was actually created or if subject became dormant
      // (subject marked dormant when no backing available)
      const disputeAfter = await fetchDispute(subject.account.subjectId);
      if (!disputeAfter || isDisputeNone(disputeAfter.status)) {
        setInternalError("Subject has no backing and was marked as Dormant. No dispute created. Your stake was not taken.");
        setShowCreateDispute(false);
      } else {
        setInternalSuccess("Dispute submitted successfully");
        setShowCreateDispute(false);
      }

      // Notify parent to refresh data
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      console.error("Failed to submit dispute:", err);
      if (isUserCancellation(err)) {
        // Don't show error for user cancellations
        return;
      }
      const message = getUserFriendlyErrorMessage(err);
      const help = getErrorHelp(err);
      setInternalError(help ? `${message} ${help}` : message);
    } finally {
      setInternalLoading(false);
    }
  }, [disputeForm, minBond, minBondSol, subject, uploadDispute, createDispute, onRefresh]);

  // Handle restore submission
  const handleSubmitRestore = useCallback(async () => {
    if (!restoreForm.title || !restoreForm.reason) {
      setInternalError("Title and reason are required");
      return;
    }

    const stakeLamports = parseFloat(restoreForm.stakeAmount) * LAMPORTS_PER_SOL;
    if (isNaN(stakeLamports) || stakeLamports <= 0) {
      setInternalError("Invalid stake amount");
      return;
    }

    if (minRestoreStake > 0 && stakeLamports < minRestoreStake) {
      setInternalError(`Minimum stake is ${minRestoreStakeSol.toFixed(6)} SOL`);
      return;
    }

    setInternalLoading(true);
    setInternalError(null);
    setInternalSuccess(null);

    try {
      // Upload restore content to IPFS
      const uploadResult = await uploadDispute({
        title: restoreForm.title,
        reason: restoreForm.reason,
        requestedOutcome: "Restore subject to valid status",
        type: "other", // Restoration uses "other" as content type
        subjectCid: subject.account.subjectId.toBase58(), // V2: Use subjectId as CID
      });
      if (!uploadResult) {
        throw new Error("Failed to upload restoration content");
      }

      // V2: Submit restore on-chain using params object
      const restoreDisputeType = { other: {} } as DisputeType;
      await submitRestore({
        subjectId: subject.account.subjectId,
        disputeType: restoreDisputeType,
        detailsCid: uploadResult.cid,
        stakeAmount: new BN(stakeLamports),
      });

      setInternalSuccess("Restoration request submitted successfully");
      setShowRestoreForm(false);

      // Notify parent to refresh data
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      console.error("Failed to submit restore:", err);
      if (isUserCancellation(err)) {
        // Don't show error for user cancellations
        return;
      }
      const message = getUserFriendlyErrorMessage(err);
      const help = getErrorHelp(err);
      setInternalError(help ? `${message} ${help}` : message);
    } finally {
      setInternalLoading(false);
    }
  }, [restoreForm, subject, uploadDispute, submitRestore, onRefresh, minRestoreStake, minRestoreStakeSol]);

  // Handle adding stake to existing vote
  const handleAddToVote = useCallback(async (stakeAmount: string) => {
    if (!activeDispute) return;

    const stakeLamports = parseFloat(stakeAmount) * LAMPORTS_PER_SOL;
    if (isNaN(stakeLamports) || stakeLamports <= 0) {
      setInternalError("Invalid stake amount");
      return;
    }

    setInternalLoading(true);
    setInternalError(null);
    setInternalSuccess(null);

    try {
      await addToVote(
        subject.account.subjectId,
        activeDispute.account.round,
        new BN(stakeLamports)
      );

      setInternalSuccess("Additional stake added successfully");

      // Refresh data to show updated vote
      await loadSubjectData();
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      console.error("Failed to add to vote:", err);
      if (isUserCancellation(err)) {
        return;
      }
      const message = getUserFriendlyErrorMessage(err);
      const help = getErrorHelp(err);
      setInternalError(help ? `${message} ${help}` : message);
    } finally {
      setInternalLoading(false);
    }
  }, [subject, activeDispute, addToVote, loadSubjectData, onRefresh]);

  // Save scroll position before re-render
  useLayoutEffect(() => {
    if (modalScrollRef.current) {
      scrollPositionRef.current = modalScrollRef.current.scrollTop;
    }
  });

  // Restore scroll position after re-render
  useEffect(() => {
    if (modalScrollRef.current && scrollPositionRef.current > 0) {
      modalScrollRef.current.scrollTop = scrollPositionRef.current;
    }
  });

  const subjectKey = subject.publicKey.toBase58();
  const isInvalid = subject.account.status.invalid;
  const isRestoring = subject.account.status.restoring;
  const isRestore = activeDispute?.account.isRestore;

  // Show subject's current status
  const isResolvedDispute = activeDispute?.account.status.resolved;
  const subjectStatus = getStatusBadge(subject.account.status);

  const outcome = activeDispute ? getOutcomeLabel(activeDispute.account.outcome, activeDispute.account.isRestore) : null;
  const votingEnded = activeDispute ? Date.now() > activeDispute.account.votingEndsAt.toNumber() * 1000 : false;
  const isPending = activeDispute?.account.status.pending;
  const canVote = isPending && !votingEnded && jurorPool;
  const canResolve = isPending && votingEnded;
  // V2: Use votesForChallenger/votesForDefender instead of favor/against
  const totalVotes = activeDispute
    ? activeDispute.account.votesForChallenger.toNumber() + activeDispute.account.votesForDefender.toNumber()
    : 0;
  const favorPercent = totalVotes > 0
    ? (activeDispute!.account.votesForChallenger.toNumber() / totalVotes) * 100
    : 50;

  // Juror fees (V2: all subjects have fees, no freeCase)
  const PROTOCOL_FEE_BPS = 2000;
  const JUROR_SHARE_BPS = 9500;
  let disputeJurorFees = "";
  if (activeDispute) {
    let totalPool: number;
    if (activeDispute.account.isRestore) {
      // For restorations, juror pot is based on restore stake
      totalPool = safeToNumber(activeDispute.account.restoreStake);
    } else {
      // V2: totalPool = totalStake + bondAtRisk
      const stakePool = safeToNumber(activeDispute.account.totalStake);
      const bondPool = safeToNumber(activeDispute.account.bondAtRisk);
      totalPool = stakePool + bondPool;
    }
    const totalFees = totalPool * PROTOCOL_FEE_BPS / 10000;
    const jurorPot = totalFees * JUROR_SHARE_BPS / 10000;
    disputeJurorFees = `${(jurorPot / LAMPORTS_PER_SOL).toFixed(6)} SOL`;
  }

  // History shows all resolved disputes, sorted by resolved date (latest first)
  const sortedHistoryDisputes = [...pastDisputes].sort((a, b) => {
    return b.account.resolvedAt.toNumber() - a.account.resolvedAt.toNumber();
  });

  // Content wrapper - used for both modal and inline modes
  const contentElement = (
    <div
      ref={modalScrollRef}
      className={inline
        ? "w-full overflow-y-auto relative"
        : "tribunal-modal w-full max-w-[calc(100vw-1rem)] sm:max-w-4xl max-h-[calc(100vh-5rem)] sm:max-h-[calc(100vh-8rem)] overflow-y-auto relative"
      }
      onClick={e => e.stopPropagation()}
    >
      {/* Close button - only show in modal mode */}
      {!inline && (
        <button onClick={onClose} className="absolute top-3 right-3 text-steel hover:text-parchment z-10">
          <XIcon />
        </button>
      )}

        <div className="p-3 sm:p-4 space-y-4">
          {/* SUBJECT INFO (when no active dispute) */}
          {(!activeDispute || !isPending) && (
            <div className="space-y-2">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-sky-500 rounded"></div>
                  <h4 className="text-xs font-semibold text-sky-400 uppercase tracking-wider">Subject</h4>
                </div>
                <p className="text-[10px] text-steel mt-1 ml-3 truncate">{subjectKey}</p>
              </div>
              <div className="p-3 bg-obsidian border border-sky-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-sky-400 font-medium">{subjectContent?.title || "Untitled Subject"}</p>
                  <div className="flex items-center gap-1">
                    {subjectContent?.category && (
                      <span className="text-[10px] text-sky">
                        {SUBJECT_CATEGORIES.find(c => c.key === subjectContent.category)?.label || subjectContent.category}
                      </span>
                    )}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      subject.account.matchMode ? "bg-gold-20 text-gold" : "bg-steel-20 text-steel"
                    }`}>
                      {subject.account.matchMode ? "Match" : "Prop"}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${subjectStatus.class}`}>
                      {subjectStatus.label}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-steel-20 text-steel">
                      {Math.floor(subject.account.votingPeriod.toNumber() / 3600)}h
                    </span>
                    {pastDisputes.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-800/20 text-crimson">
                        {pastDisputes.length}
                      </span>
                    )}
                  </div>
                </div>
                {/* Render all subject content fields dynamically */}
                {subjectContent && (
                  <div className="space-y-2">
                    <JsonContentRenderer
                      data={Object.fromEntries(
                        Object.entries(subjectContent).filter(([key]) =>
                          !['title', 'category'].includes(key)
                        )
                      )}
                      getIpfsUrl={getIpfsUrl}
                    />
                  </div>
                )}
                <div className="flex flex-col gap-1 text-xs pt-2 border-t border-slate-light/50">
                  <div>
                    <span className="text-steel">Bond: </span>
                    <span className="text-sky">
                      {/* Pool backing only shown when available_bond == 0 */}
                      {(() => {
                        const availableBond = subject.account.availableBond.toNumber();
                        const poolBacking = creatorPoolBacking ?? 0;
                        if (availableBond > 0) {
                          return (availableBond / LAMPORTS_PER_SOL).toFixed(6);
                        } else if (poolBacking > 0) {
                          return `${(poolBacking / LAMPORTS_PER_SOL).toFixed(6)} (pool)`;
                        }
                        return "0";
                      })()}
                    </span>
                  </div>
                  <div>
                    <span className="text-steel">Defenders: </span>
                    <span className="text-sky-400">{subject.account.defenderCount}</span>
                  </div>
                </div>
                {/* Subject Actions */}
                {showActions && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-slate-light/50">
                    {(subject.account.status.valid || subject.account.status.dormant) && onAddBond && (
                      <JoinForm
                        type="defender"
                        onJoin={(amount) => onAddBond(subject.account.subjectId.toBase58(), amount, false)}
                        onJoinFromPool={subject.account.status.dormant && userPoolBacking && userPoolBacking >= MIN_DEFENDER_STAKE ? () => onAddBond(subject.account.subjectId.toBase58(), "0", true) : undefined}
                        isLoading={actionLoading}
                        label={subject.account.status.dormant ? "Revive Subject" : undefined}
                        showPoolOption={subject.account.status.dormant && userPoolBacking !== undefined && userPoolBacking >= MIN_DEFENDER_STAKE}
                        poolBacking={userPoolBacking}
                      />
                    )}
                    {subject.account.status.valid && !showCreateDispute && (
                      <button onClick={() => setShowCreateDispute(true)} className="btn btn-secondary py-1.5 px-3 text-sm w-full border-red-800/50 hover:border-red-700">
                        <span className="text-crimson">File Dispute</span>
                      </button>
                    )}
                    {isInvalid && !showRestoreForm && (
                      <button onClick={() => setShowRestoreForm(true)} className="btn btn-secondary py-1.5 px-3 text-sm w-full border-purple-500/50 hover:border-purple-400">
                        <span className="text-purple-400">Restore Subject</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* INLINE RESTORE FORM (for invalid subjects without pending dispute) */}
          {(!activeDispute || !isPending) && isInvalid && showRestoreForm && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Request Restoration</h4>
                <button onClick={() => setShowRestoreForm(false)} className="text-steel hover:text-parchment">
                  <XIcon />
                </button>
              </div>
              <div className="p-4 bg-obsidian border border-purple-500/30 space-y-3">
                {internalError && (
                  <div className="p-2 bg-red-800/20 border border-red-800/30 text-crimson text-xs">{internalError}</div>
                )}
                {internalSuccess && (
                  <div className="p-2 bg-emerald-700/20 border border-emerald-700/30 text-emerald text-xs">{internalSuccess}</div>
                )}
                <div>
                  <label className="text-[10px] text-steel uppercase tracking-wider">Title *</label>
                  <input
                    type="text"
                    value={restoreForm.title}
                    onChange={(e) => setRestoreForm({ ...restoreForm, title: e.target.value })}
                    className="input w-full text-sm py-2 mt-1"
                    placeholder="Brief summary of your restoration request"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-steel uppercase tracking-wider">Reason *</label>
                  <textarea
                    value={restoreForm.reason}
                    onChange={(e) => setRestoreForm({ ...restoreForm, reason: e.target.value })}
                    className="input w-full text-sm py-2 mt-1 h-20 resize-none"
                    placeholder="Explain why the subject should be restored"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-steel uppercase tracking-wider">Stake Amount</label>
                    <span className="text-[10px] text-purple-400">
                      Min: {minRestoreStakeSol.toFixed(6)} SOL
                    </span>
                  </div>
                  <div className="flex gap-2 items-center mt-1">
                    <input
                      type="text"
                      value={restoreForm.stakeAmount}
                      onChange={(e) => setRestoreForm({ ...restoreForm, stakeAmount: e.target.value })}
                      className="input flex-1 text-sm py-2"
                    />
                    <span className="text-steel text-sm">SOL</span>
                  </div>
                  <p className="text-[10px] text-steel mt-1">Must be at least the previous dispute&apos;s total (stake + bond)</p>
                </div>
                <div className="p-2 bg-purple-500/10 border border-purple-500/20 text-xs">
                  <span className="text-steel">Voting Period: </span>
                  <span className="text-purple-400">{restoreVotingPeriodHours}h</span>
                  <span className="text-steel"> (2x original)</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowRestoreForm(false)}
                    className="btn btn-secondary py-2 px-4 flex-1"
                    disabled={internalLoading || isUploading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitRestore}
                    className="btn btn-primary py-2 px-4 flex-1"
                    disabled={internalLoading || isUploading}
                  >
                    {internalLoading || isUploading ? "Submitting..." : "Submit Restoration"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* INLINE CREATE DISPUTE FORM */}
          {(!activeDispute || !isPending) && showCreateDispute && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-crimson uppercase tracking-wider">File Dispute</h4>
                <button onClick={() => setShowCreateDispute(false)} className="text-steel hover:text-parchment">
                  <XIcon />
                </button>
              </div>
              <div className="p-4 bg-obsidian border border-red-800/30 space-y-3">
                {internalError && (
                  <div className="p-2 bg-red-800/20 border border-red-800/30 text-crimson text-xs">{internalError}</div>
                )}
                {internalSuccess && (
                  <div className="p-2 bg-emerald-700/20 border border-emerald-700/30 text-emerald text-xs">{internalSuccess}</div>
                )}
                <div>
                  <label className="text-[10px] text-steel uppercase tracking-wider">Dispute Type</label>
                  <select
                    value={disputeForm.type}
                    onChange={(e) => setDisputeForm({ ...disputeForm, type: e.target.value })}
                    className="input w-full text-sm py-2 mt-1"
                  >
                    {DISPUTE_TYPES.map((dt) => (
                      <option key={dt.key} value={dt.key}>{dt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-steel uppercase tracking-wider">Title *</label>
                  <input
                    type="text"
                    value={disputeForm.title}
                    onChange={(e) => setDisputeForm({ ...disputeForm, title: e.target.value })}
                    className="input w-full text-sm py-2 mt-1"
                    placeholder="Brief summary of the dispute"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-steel uppercase tracking-wider">Reason *</label>
                  <textarea
                    value={disputeForm.reason}
                    onChange={(e) => setDisputeForm({ ...disputeForm, reason: e.target.value })}
                    className="input w-full text-sm py-2 mt-1 h-20 resize-none"
                    placeholder="Explain why you are filing this dispute"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-steel uppercase tracking-wider">Requested Outcome</label>
                  <textarea
                    value={disputeForm.requestedOutcome}
                    onChange={(e) => setDisputeForm({ ...disputeForm, requestedOutcome: e.target.value })}
                    className="input w-full text-sm py-2 mt-1 h-16 resize-none"
                    placeholder="What outcome do you seek?"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-steel uppercase tracking-wider">Stake Amount (min: {(Math.ceil(minBondSol * 1_000_000) / 1_000_000).toFixed(6)} SOL)</label>
                  <div className="flex gap-2 items-center mt-1">
                    <input
                      type="text"
                      value={disputeForm.stakeAmount}
                      onChange={(e) => setDisputeForm({ ...disputeForm, stakeAmount: e.target.value })}
                      className="input flex-1 text-sm py-2"
                    />
                    <span className="text-steel text-sm">SOL</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCreateDispute(false)}
                    className="btn btn-secondary py-2 px-4 flex-1"
                    disabled={internalLoading || isUploading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateDispute}
                    className="btn btn-primary py-2 px-4 flex-1"
                    disabled={internalLoading || isUploading}
                  >
                    {internalLoading || isUploading ? "Submitting..." : "Submit Dispute"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SUBJECT + CHALLENGER SIDE BY SIDE (only for pending disputes) */}
          {activeDispute && isPending && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
              {/* SUBJECT (DEFENDER) SECTION */}
              <div className="flex flex-col gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-sky rounded"></div>
                    <h4 className="text-xs font-semibold text-sky uppercase tracking-wider">Defender</h4>
                  </div>
                  <p className="text-[10px] text-steel mt-1 ml-3 truncate">{subjectKey}</p>
                </div>
                <div className="p-3 bg-obsidian border border-sky-500/30 space-y-2 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-sky-400 font-medium">{subjectContent?.title || "Untitled Subject"}</p>
                    <div className="flex items-center gap-1">
                      {subjectContent?.category && (
                        <span className="text-[10px] text-sky">
                          {SUBJECT_CATEGORIES.find(c => c.key === subjectContent.category)?.label || subjectContent.category}
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        subject.account.matchMode ? "bg-gold/20 text-gold" : "bg-steel/20 text-steel"
                      }`}>
                        {subject.account.matchMode ? "Match" : "Prop"}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${subjectStatus.class}`}>
                        {subjectStatus.label}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-steel/20 text-steel">
                        {Math.floor(subject.account.votingPeriod.toNumber() / 3600)}h
                      </span>
                      {pastDisputes.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-800/20 text-crimson">
                          {pastDisputes.length}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Render all subject content fields dynamically */}
                  {subjectContent && (
                    <div className="space-y-2">
                      <JsonContentRenderer
                        data={Object.fromEntries(
                          Object.entries(subjectContent).filter(([key]) =>
                            !['title', 'category'].includes(key)
                          )
                        )}
                        getIpfsUrl={getIpfsUrl}
                      />
                    </div>
                  )}
                  <div className="flex flex-col gap-1 text-xs pt-2 border-t border-slate-light/50">
                    <div>
                      <span className="text-steel">Total Bond: </span>
                      <span className="text-sky-400">
                        {/* For disputed subjects: just available_bond (pool already transferred) */}
                        {(subject.account.availableBond.toNumber() / LAMPORTS_PER_SOL).toFixed(6)}
                      </span>
                    </div>
                    {activeDispute && isPending && !isRestore && (
                      <>
                        <div>
                          <span className="text-steel">At Risk: </span>
                          <span className="text-crimson">
                            {(safeToNumber(activeDispute.account.bondAtRisk) / LAMPORTS_PER_SOL).toFixed(6)}
                          </span>
                        </div>
                        <div>
                          <span className="text-steel">Safe: </span>
                          <span className="text-emerald">
                            {((subject.account.availableBond.toNumber() - safeToNumber(activeDispute.account.bondAtRisk)) / LAMPORTS_PER_SOL).toFixed(6)}
                          </span>
                        </div>
                      </>
                    )}
                    <div>
                      <span className="text-steel">Defenders: </span>
                      <span className="text-sky-400">{subject.account.defenderCount}</span>
                    </div>
                  </div>
                  {/* Defender Actions */}
                  {showActions && (
                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-light/50">
                      {(subject.account.status.valid || (subject.account.status.disputed && !votingEnded) || subject.account.status.dormant) && onAddBond && (
                        <JoinForm
                          type="defender"
                          onJoin={(amount) => onAddBond(subject.account.subjectId.toBase58(), amount, false)}
                          onJoinFromPool={subject.account.status.dormant && userPoolBacking && userPoolBacking >= MIN_DEFENDER_STAKE ? () => onAddBond(subject.account.subjectId.toBase58(), "0", true) : undefined}
                          isLoading={actionLoading}
                          label={subject.account.status.dormant ? "Revive Subject" : undefined}
                          showPoolOption={subject.account.status.dormant && userPoolBacking !== undefined && userPoolBacking >= MIN_DEFENDER_STAKE}
                          poolBacking={userPoolBacking}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* CHALLENGER / RESTORER SECTION */}
              <div className="flex flex-col gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <div className={`w-1 h-4 rounded ${isRestore ? 'bg-purple-500' : 'bg-crimson'}`}></div>
                    <h4 className={`text-xs font-semibold uppercase tracking-wider ${isRestore ? 'text-purple-400' : 'text-crimson'}`}>
                      {isRestore ? 'Restorer' : 'Challenger'}
                    </h4>
                  </div>
                  <p className="text-[10px] text-steel mt-1 ml-3">{activeDispute?.publicKey.toBase58() ?? "No active dispute"}</p>
                </div>
                <div className={`p-3 bg-obsidian border space-y-2 flex-1 ${isRestore ? 'border-purple-500/30' : 'border-red-800/30'}`}>
                  {activeDispute && disputeContent ? (
                    <>
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-medium ${isRestore ? 'text-purple-400' : 'text-crimson'}`}>
                          {disputeContent.title || (isRestore ? "Restoration Request" : "Untitled Dispute")}
                        </p>
                        <div className="flex items-center gap-1">
                          {isRestore ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                              Restore
                            </span>
                          ) : (
                            <>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-800/20 text-crimson">
                                {getDisputeTypeLabel(activeDispute!.account.disputeType)}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-steel/20 text-steel">
                                {activeDisputeCreatorRep !== null && activeDisputeCreatorRep !== undefined
                                  ? `${(activeDisputeCreatorRep / 1_000_000).toFixed(1)}%`
                                  : "50.0%"}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Render all dispute content fields dynamically */}
                      <div className="space-y-2">
                        <JsonContentRenderer
                          data={Object.fromEntries(
                            Object.entries(disputeContent).filter(([key]) =>
                              !['title', 'evidence'].includes(key)
                            )
                          )}
                          getIpfsUrl={getIpfsUrl}
                        />
                      </div>
                      {disputeContent.evidence && disputeContent.evidence.length > 0 && (
                        <EvidenceViewer evidence={disputeContent.evidence} getIpfsUrl={getIpfsUrl} />
                      )}
                    </>
                  ) : (
                    <p className="text-steel text-xs">{isRestore ? "No active restoration" : "No active dispute"}</p>
                  )}
                  <div className="flex flex-col gap-1 text-xs pt-2 border-t border-slate-light/50">
                    {isRestore ? (
                      <>
                        <div>
                          <span className="text-steel">Stake: </span>
                          <span className="text-purple-400">
                            {activeDispute ? (activeDispute.account.restoreStake.toNumber() / LAMPORTS_PER_SOL).toFixed(6) : "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-steel">Voting Period: </span>
                          <span className="text-purple-400">{restoreVotingPeriodHours}h</span>
                          <span className="text-steel"> (2x original)</span>
                        </div>
                        <div>
                          <span className="text-steel">Restorer: </span>
                          <span className="text-purple-400">
                            {activeDispute?.account.restorer?.toBase58().slice(0, 4)}...{activeDispute?.account.restorer?.toBase58().slice(-4)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <span className="text-steel">Stake: </span>
                          <span className="text-crimson">
                            {activeDispute ? (safeToNumber(activeDispute.account.totalStake) / LAMPORTS_PER_SOL).toFixed(6) : "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-steel">Challengers: </span>
                          <span className="text-crimson">{activeDispute?.account.challengerCount ?? 0}</span>
                        </div>
                      </>
                    )}
                  </div>
                  {/* Challenger Actions - only for regular disputes */}
                  {showActions && !isRestore && (
                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-light/50">
                      {activeDispute && isPending && !votingEnded && onJoinChallengers && (
                        <JoinForm
                          type="challenger"
                          onJoin={(amount) => onJoinChallengers(subject.account.subjectId.toBase58(), amount, "")}
                          isLoading={actionLoading}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* VS / POWER BAR SECTION - hide for invalidated, different for restoring */}
          {activeDispute && !isInvalid && isPending && (
            <div className="space-y-3">
              <div className={`p-4 bg-slate-light/20 border ${isRestore ? 'border-purple-500/30' : 'border-slate-light'} space-y-3`}>
                {isRestore ? (
                  <>
                    {/* Restoration voting bar */}
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider">
                      <span className="text-purple-400">For Restoration</span>
                      <span className="text-steel">VOTING</span>
                      <span className="text-crimson">Against Restoration</span>
                    </div>
                    <div className="h-3 rounded overflow-hidden flex bg-obsidian">
                      <div className="h-full transition-all" style={{ width: `${favorPercent}%`, backgroundColor: '#a855f7' }} />
                      <div className="h-full transition-all" style={{ width: `${100 - favorPercent}%`, backgroundColor: '#dc2626' }} />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span>
                        <span className="text-purple-400">
                          {(activeDispute!.account.restoreStake.toNumber() / LAMPORTS_PER_SOL).toFixed(6)}
                        </span>
                        <span className="text-steel"> · </span>
                        <span className="text-purple-400">{disputeVotes.filter(v => "forRestoration" in v.account.restoreChoice).length}</span>
                        <span className="text-steel"> · </span>
                        <span className="text-purple-400">{favorPercent.toFixed(0)}%</span>
                      </span>
                      <span className="text-steel flex items-center gap-1">
                        <ClockIcon />
                        <Countdown endTime={activeDispute!.account.votingEndsAt.toNumber() * 1000} />
                      </span>
                      <span>
                        <span className="text-crimson">{(100 - favorPercent).toFixed(0)}%</span>
                        <span className="text-steel"> · </span>
                        <span className="text-crimson">{disputeVotes.filter(v => "againstRestoration" in v.account.restoreChoice).length}</span>
                        <span className="text-steel"> · </span>
                        <span className="text-purple-400">
                          {activeDispute!.account.restorer.toBase58().slice(0, 4)}...
                        </span>
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Regular dispute vs bar */}
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider">
                      <span className="text-sky-400">{subject.account.defenderCount} Defender{subject.account.defenderCount !== 1 ? 's' : ''}</span>
                      <span className="text-steel">VS</span>
                      <span className="text-crimson">{activeDispute!.account.challengerCount} Challenger{activeDispute!.account.challengerCount !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="h-3 rounded overflow-hidden flex bg-obsidian">
                      <div className="h-full transition-all" style={{ width: `${100 - favorPercent}%`, backgroundColor: '#0ea5e9' }} />
                      <div className="h-full transition-all" style={{ width: `${favorPercent}%`, backgroundColor: '#dc2626' }} />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span>
                        <span className="text-sky-400">
                          {(safeToNumber(activeDispute!.account.bondAtRisk) / LAMPORTS_PER_SOL).toFixed(6)}
                        </span>
                        <span className="text-steel"> · </span>
                        <span className="text-sky-400">{disputeVotes.filter(v => "forDefender" in v.account.choice).length}</span>
                        <span className="text-steel"> · </span>
                        <span className="text-sky-400">{(100 - favorPercent).toFixed(0)}%</span>
                      </span>
                      <span className="text-steel flex items-center gap-1">
                        <ClockIcon />
                        <Countdown endTime={activeDispute!.account.votingEndsAt.toNumber() * 1000} />
                      </span>
                      <span>
                        <span className="text-crimson">{favorPercent.toFixed(0)}%</span>
                        <span className="text-steel"> · </span>
                        <span className="text-crimson">{disputeVotes.filter(v => "forChallenger" in v.account.choice).length}</span>
                        <span className="text-steel"> · </span>
                        <span className="text-crimson">
                          {(safeToNumber(activeDispute!.account.totalStake) / LAMPORTS_PER_SOL).toFixed(6)}
                        </span>
                      </span>
                    </div>
                  </>
                )}

                {/* Reward Distribution */}
                {(() => {
                  const totalPool = (safeToNumber(activeDispute!.account.totalStake) + safeToNumber(activeDispute!.account.bondAtRisk)) / LAMPORTS_PER_SOL;
                  const winnersShare = totalPool * 0.8;
                  const jurorsShare = totalPool * 0.19;
                  const protocolShare = totalPool * 0.01;
                  return (
                    <div className="pt-3 border-t border-slate-light/30">
                      <p className="text-[10px] text-steel uppercase tracking-wider mb-2">Reward Distribution ({totalPool.toFixed(4)} SOL)</p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="text-center">
                          <p className="text-gold font-semibold">{winnersShare.toFixed(4)}</p>
                          <p className="text-steel text-[10px]">Winners (80%)</p>
                        </div>
                        <div className="text-center">
                          <p className="text-emerald font-semibold">{jurorsShare.toFixed(4)}</p>
                          <p className="text-steel text-[10px]">Jurors (19%)</p>
                        </div>
                        <div className="text-center">
                          <p className="text-steel font-semibold">{protocolShare.toFixed(4)}</p>
                          <p className="text-steel text-[10px]">Protocol (1%)</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Resolve action */}
                {showActions && canResolve && onResolve && activeDispute && (
                  <div className="pt-2 border-t border-slate-light/50">
                    <button onClick={() => onResolve(subject.account.subjectId.toBase58())} disabled={actionLoading} className="btn btn-primary py-1.5 px-3 text-sm w-full">
                      {actionLoading ? "..." : isRestore ? "Resolve Restoration" : "Resolve Dispute"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* JUROR SECTION - hide for invalidated */}
          {showActions && activeDispute && !isInvalid && isPending && !votingEnded && onVote && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-steel uppercase tracking-wider">Juror</h4>
              <div className="p-4 bg-obsidian border border-slate-light space-y-3">
                {!jurorPool ? (
                  <p className="text-steel text-sm text-center">
                    <Link href="/profile" className="text-gold hover:text-gold-light">Register as juror</Link> to vote on this dispute
                  </p>
                ) : (
                  <VoteForm
                    existingVote={existingVote}
                    onVote={(stake, choice, rationale) => onVote(subject.account.subjectId.toBase58(), activeDispute!.account.round, stake, choice, rationale)}
                    onAddToVote={handleAddToVote}
                    isLoading={actionLoading || internalLoading}
                    isRestore={activeDispute?.account.isRestore}
                  />
                )}
              </div>
            </div>
          )}

          {/* JUROR REMARKS SECTION (current dispute) - hide for invalidated */}
          {activeDispute && !isInvalid && disputeVotes.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-steel uppercase tracking-wider">Juror Remarks ({disputeVotes.length})</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {disputeVotes.map((vote, i) => {
                  const hasRationale = vote.account.rationaleCid && vote.account.rationaleCid.length > 0;
                  const jurorAddress = vote.account.juror.toBase58();
                  const stakeAmount = safeToNumber(vote.account.stakeAllocation) / LAMPORTS_PER_SOL;
                  const votingPower = vote.account.votingPower.toNumber() / LAMPORTS_PER_SOL;

                  // Determine vote display based on whether it's a restore vote
                  const isRestoreVote = vote.account.isRestoreVote;
                  const isForChallenger = vote.account.choice && "forChallenger" in vote.account.choice;
                  const isForRestoration = vote.account.restoreChoice && "forRestoration" in vote.account.restoreChoice;
                  const voteLabel = isRestoreVote
                    ? (isForRestoration ? "FOR RESTORATION" : "AGAINST RESTORATION")
                    : (isForChallenger ? "FOR CHALLENGER" : "FOR DEFENDER");
                  const voteColorClass = isRestoreVote
                    ? (isForRestoration ? "text-purple-400" : "text-crimson")
                    : (isForChallenger ? "text-crimson" : "text-sky");
                  const borderColorClass = isRestoreVote
                    ? (isForRestoration ? "border-purple-500/30" : "border-red-800/30")
                    : (isForChallenger ? "border-red-800/30" : "border-sky-500/30");

                  return (
                    <div key={i} className={`p-3 bg-obsidian border ${borderColorClass}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${voteColorClass}`}>
                            {voteLabel}
                          </span>
                          <span className="text-[10px] text-steel">
                            {jurorAddress.slice(0, 4)}...{jurorAddress.slice(-4)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-gold">{stakeAmount.toFixed(6)} SOL</span>
                          {votingPower !== stakeAmount && (
                            <span className="text-[10px] text-steel ml-1">({votingPower.toFixed(6)} power)</span>
                          )}
                        </div>
                      </div>
                      {hasRationale ? (
                        <p className="text-xs text-parchment mt-1">{vote.account.rationaleCid}</p>
                      ) : (
                        <p className="text-xs text-steel/50 italic mt-1">No rationale provided</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* IPFS Link */}
          {activeDispute?.account.detailsCid && getIpfsUrl && (
            <a href={getIpfsUrl(activeDispute.account.detailsCid)} target="_blank" rel="noopener noreferrer" className="text-xs text-gold hover:text-gold-light flex items-center gap-1">
              View dispute on IPFS <LinkIcon />
            </a>
          )}

          {/* HISTORY SECTION - collapsible with juror remarks */}
          {sortedHistoryDisputes.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-steel uppercase tracking-wider">
                History ({sortedHistoryDisputes.length})
              </h4>
              <div className="space-y-2">
                {sortedHistoryDisputes.map((historyDispute, i) => {
                  const dPda = historyDispute.publicKey.toBase58();
                  const dRound = historyDispute.account.round;
                  // Key format: disputePda:round to match how records are stored
                  const dKey = `${dPda}:${dRound}`;
                  const isCurrentDispute = activeDispute && dPda === activeDispute.publicKey.toBase58() && dRound === activeDispute.account.round;
                  // Use current disputeContent if this is the current dispute, otherwise from allDisputeContents
                  const dContent = isCurrentDispute
                    ? disputeContent
                    : allDisputeContents[dPda];
                  // Include votes for current dispute or past disputes
                  const dVotes = isCurrentDispute
                    ? disputeVotes
                    : (allDisputeVotes?.[dPda] || []);
                  // Build claim data - use current records for current dispute, past records for historical
                  // Roles are derived from claim data inside HistoryItem
                  // Include Supabase flags to indicate records that are closed on-chain (not claimable)
                  // All records are keyed by disputePda:round
                  const dClaimData = isCurrentDispute ? {
                    voteRecord: existingVote,
                    challengerRecord,
                    defenderRecord: userDefenderRecord,
                    voteRecordFromSupabase: recordsFromSupabase.vote[dKey] || false,
                    challengerRecordFromSupabase: recordsFromSupabase.challenger[dKey] || false,
                    defenderRecordFromSupabase: recordsFromSupabase.defender[dKey] || false,
                  } : {
                    voteRecord: userVoteRecords?.[dKey] || null,
                    challengerRecord: userChallengerRecords?.[dKey] || null,
                    defenderRecord: userDefenderRecords?.[dKey] || null,
                    voteRecordFromSupabase: recordsFromSupabase.vote[dKey] || false,
                    challengerRecordFromSupabase: recordsFromSupabase.challenger[dKey] || false,
                    defenderRecordFromSupabase: recordsFromSupabase.defender[dKey] || false,
                  };
                  // Find the escrow round for this dispute
                  const dEscrowRound = escrowData?.rounds?.find(r => r.round === historyDispute.account.round) || null;
                  // Get event-based roles for this round (fallback when records are closed)
                  const dEventRoles = userRolesFromEvents.get(historyDispute.account.round) || null;
                  return (
                    <HistoryItem
                      key={i}
                      pastDispute={historyDispute}
                      disputeContent={dContent}
                      votes={dVotes}
                      defaultExpanded={i === 0}
                      claimData={dClaimData}
                      eventRoles={dEventRoles}
                      onClaimAll={handleClaimAllWithRefresh}
                      onCloseRecords={handleCloseRecordsWithRefresh}
                      actionLoading={actionLoading}
                      escrowRound={dEscrowRound}
                    />
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
  );

  // Wrap in overlay for modal mode, return directly for inline mode
  if (inline) {
    return contentElement;
  }

  return (
    <div className="fixed inset-0 bg-obsidian/90 flex items-start justify-center z-50 pt-16 sm:pt-28 px-2 sm:px-4 pb-4" onClick={onClose}>
      {contentElement}
    </div>
  );
});
