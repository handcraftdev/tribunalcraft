"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Navigation } from "@/components/Navigation";
import { useTribunalcraft } from "@/hooks/useTribunalcraft";
import { useContentFetch } from "@/hooks/useUpload";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import Link from "next/link";
import type { SubjectContent, DisputeContent } from "@tribunalcraft/sdk";
import { SubjectCard, SubjectModal, SubjectData, DisputeData, VoteData } from "@/components/subject";
import { ShieldIcon, CheckIcon, LockIcon, PlusIcon, MinusIcon, ClockIcon, ChevronDownIcon } from "@/components/Icons";
import { getSubjects, getDisputes } from "@/lib/supabase/queries";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { Subject as SupabaseSubject, Dispute as SupabaseDispute } from "@/lib/supabase/types";

// Safe BN to number conversion (handles overflow and undefined)
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

// ═══════════════════════════════════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════════════════════════════════

const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const VaultIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="12" cy="12" r="4" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const SwordIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M14.5 5.5L18.5 9.5M6 14l4-4m-2.5 6.5l-3 3m11.5-11.5l3-3M9.5 6.5l8 8" />
  </svg>
);

const ScaleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 3v18" />
    <path d="M5 7l7-4 7 4" />
    <path d="M5 7l-2 9h4l-2-9" />
    <path d="M19 7l2 9h-4l2-9" />
  </svg>
);

const TrendUpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23,6 13.5,15.5 8.5,10.5 1,18" />
    <polyline points="17,6 23,6 23,12" />
  </svg>
);

const TrendDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23,18 13.5,8.5 8.5,13.5 1,6" />
    <polyline points="17,18 23,18 23,12" />
  </svg>
);

const ActivityIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
  </svg>
);

const ExternalIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15,3 21,3 21,9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// SUPABASE CONVERTERS
// ═══════════════════════════════════════════════════════════════════════════════

const convertSupabaseSubject = (s: SupabaseSubject): SubjectData | null => {
  try {
    const statusMap: Record<string, any> = {
      dormant: { dormant: {} }, valid: { valid: {} }, disputed: { disputed: {} },
      invalid: { invalid: {} }, restoring: { restoring: {} },
    };
    return {
      publicKey: new PublicKey(s.id),
      account: {
        subjectId: new PublicKey(s.subject_id), creator: new PublicKey(s.creator),
        detailsCid: s.details_cid || "", round: s.round,
        availableBond: new BN(s.available_bond), defenderCount: s.defender_count,
        status: statusMap[s.status] || { dormant: {} }, matchMode: s.match_mode,
        votingPeriod: s.voting_period ? new BN(s.voting_period) : new BN(0),
        dispute: s.dispute ? new PublicKey(s.dispute) : PublicKey.default,
        bump: 255, createdAt: s.created_at ? new BN(s.created_at) : new BN(0),
        updatedAt: s.updated_at ? new BN(s.updated_at) : new BN(0),
        lastDisputeTotal: s.last_dispute_total ? new BN(s.last_dispute_total) : new BN(0),
        lastVotingPeriod: s.voting_period ? new BN(s.voting_period) : new BN(0),
      },
    };
  } catch { return null; }
};

const convertSupabaseDispute = (d: SupabaseDispute): DisputeData | null => {
  try {
    const statusMap: Record<string, any> = { none: { none: {} }, pending: { pending: {} }, resolved: { resolved: {} } };
    const outcomeMap: Record<string, any> = { none: { none: {} }, challengerWins: { challengerWins: {} }, defenderWins: { defenderWins: {} }, noParticipation: { noParticipation: {} } };
    const disputeTypeMap: Record<string, any> = { accuracy: { accuracy: {} }, bias: { bias: {} }, outdated: { outdated: {} }, incomplete: { incomplete: {} }, spam: { spam: {} }, other: { other: {} } };
    return {
      publicKey: new PublicKey(d.id),
      account: {
        subjectId: new PublicKey(d.subject_id), round: d.round,
        status: statusMap[d.status] || { none: {} },
        disputeType: d.dispute_type ? disputeTypeMap[d.dispute_type] || { other: {} } : { other: {} },
        totalStake: new BN(d.total_stake), challengerCount: d.challenger_count,
        bondAtRisk: new BN(d.bond_at_risk), defenderCount: d.defender_count,
        votesForChallenger: new BN(d.votes_for_challenger), votesForDefender: new BN(d.votes_for_defender),
        voteCount: d.vote_count, votingStartsAt: d.voting_starts_at ? new BN(d.voting_starts_at) : new BN(0),
        votingEndsAt: d.voting_ends_at ? new BN(d.voting_ends_at) : new BN(0),
        outcome: outcomeMap[d.outcome || "none"] || { none: {} },
        resolvedAt: d.resolved_at ? new BN(d.resolved_at) : null,
        isRestore: d.is_restore, restoreStake: new BN(d.restore_stake),
        restorer: d.restorer ? new PublicKey(d.restorer) : PublicKey.default,
        detailsCid: d.details_cid || "", bump: 255,
        createdAt: d.created_at ? new BN(d.created_at) : new BN(0),
      },
    };
  } catch { return null; }
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// Circular progress gauge for reputation
const ReputationGauge = ({ value, size = 80, label }: { value: number; size?: number; label?: string }) => {
  const percentage = value / 1_000_000;
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Color based on reputation level
  const getColor = () => {
    if (percentage >= 70) return "#4ade80"; // emerald
    if (percentage >= 50) return "#d4a853"; // gold
    if (percentage >= 30) return "#f59e0b"; // amber
    return "#ef4444"; // red
  };

  return (
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size/2}
          cy={size/2}
          r="36"
          fill="none"
          stroke="rgba(100,116,139,0.2)"
          strokeWidth="6"
        />
        <circle
          cx={size/2}
          cy={size/2}
          r="36"
          fill="none"
          stroke={getColor()}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-display font-bold text-ivory">{percentage.toFixed(1)}</span>
        <span className="text-[10px] text-steel uppercase tracking-wider">%</span>
      </div>
      {label && <span className="text-xs text-steel mt-2 uppercase tracking-wider">{label}</span>}
    </div>
  );
};

// Progress bar component
const ProgressBar = ({ value, max, color = "gold" }: { value: number; max: number; color?: string }) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const colorClasses: Record<string, string> = {
    gold: "bg-gold",
    emerald: "bg-emerald",
    crimson: "bg-crimson",
    sky: "bg-sky-400",
  };

  return (
    <div className="h-2 w-full bg-slate-light/30">
      <div
        className={`h-full ${colorClasses[color] || colorClasses.gold} transition-all duration-500`}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  );
};

// Stat row with label and value
const StatRow = ({
  label,
  value,
  subValue,
  color = "parchment",
  trend
}: {
  label: string;
  value: string | number;
  subValue?: string;
  color?: string;
  trend?: "up" | "down";
}) => {
  const colorClasses: Record<string, string> = {
    parchment: "text-parchment",
    gold: "text-gold",
    emerald: "text-emerald",
    crimson: "text-crimson",
    sky: "text-sky-400",
    steel: "text-steel",
  };

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-light/20 last:border-0">
      <span className="text-steel text-sm">{label}</span>
      <div className="flex items-center gap-2">
        {trend && (
          <span className={trend === "up" ? "text-emerald" : "text-crimson"}>
            {trend === "up" ? <TrendUpIcon /> : <TrendDownIcon />}
          </span>
        )}
        <span className={`font-mono text-sm ${colorClasses[color]}`}>
          {value}
          {subValue && <span className="text-steel text-xs ml-1">{subValue}</span>}
        </span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function JurorPage() {
  const { publicKey } = useWallet();
  const {
    client,
    registerJuror,
    addJurorStake,
    withdrawJurorStake,
    unregisterJuror,
    fetchJurorPool,
    fetchAllDisputes,
    fetchAllSubjects,
    fetchJurorRecord,
    fetchJurorRecordsBySubject,
    fetchChallengerRecordsBySubject,
    getJurorPoolPDA,
    getJurorRecordPDA,
    getChallengerRecordPDA,
    getDefenderRecordPDA,
    fetchChallengerRecord,
    fetchDefenderRecord,
    voteOnDispute,
    voteOnRestore,
    resolveDispute,
    batchClaimRewards,
    addBondDirect,
    joinChallengers,
    addChallengerStake,
    withdrawChallengerStake,
    unlockJurorStake,
    fetchDefenderPool,
    getDefenderPoolPDA,
    getChallengerPoolPDA,
    fetchChallengerPool,
    createDefenderPool,
    depositDefenderPool,
    withdrawDefenderPool,
    updateMaxBond,
    closeJurorRecord,
    closeChallengerRecord,
    closeDefenderRecord,
    batchCloseRecords,
    scanCollectableRecords,
    collectAll,
    fetchChallengerRecordsByChallenger,
    fetchDefenderRecordsByDefender,
    fetchJurorRecordsByJuror,
  } = useTribunalcraft();

  const { fetchSubject: fetchSubjectContent, fetchDispute: fetchDisputeContent, getUrl } = useContentFetch();

  const [jurorAccount, setJurorAccount] = useState<any>(null);
  const [pool, setPool] = useState<any>(null);
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [disputes, setDisputes] = useState<DisputeData[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, VoteData>>({});
  const [allJurorRecords, setAllJurorRecords] = useState<VoteData[]>([]); // All juror records for locked stake display
  const [subjectContents, setSubjectContents] = useState<Record<string, SubjectContent | null>>({});
  const [disputeContents, setDisputeContents] = useState<Record<string, DisputeContent | null>>({});
  const [disputeCids, setDisputeCids] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collectableData, setCollectableData] = useState<{
    claims: number;
    unlocks: number;
    closes: number;
    estimatedRewards: number;
    estimatedRent: number;
    stakeToUnlock: number;
  } | null>(null);
  const [collectLoading, setCollectLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Selected item state (vote can be null for defender-only items)
  const [selectedItem, setSelectedItem] = useState<{ subject: SubjectData; dispute: DisputeData; vote: VoteData | null; roles?: { juror: boolean; defender: boolean; challenger: boolean } } | null>(null);
  const [disputeVoteCounts, setDisputeVoteCounts] = useState<Record<string, { forChallenger: number; forDefender: number }>>({});
  const [challengerRecords, setChallengerRecords] = useState<Record<string, any>>({});
  const [defenderRecords, setDefenderRecords] = useState<Record<string, any>>({});

  // Juror Forms
  const [registerStake, setRegisterStake] = useState("0.1");
  const [addStakeAmount, setAddStakeAmount] = useState("0.1");
  const [withdrawAmount, setWithdrawAmount] = useState("0.1");
  const [showAddStake, setShowAddStake] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  // Defender/Pool state
  const [challengerAccount, setChallengerAccount] = useState<any>(null);
  const [createAmount, setCreateAmount] = useState("0.1");
  const [poolStakeAmount, setPoolStakeAmount] = useState("0.1");
  const [poolWithdrawAmount, setPoolWithdrawAmount] = useState("0.1");
  const [showPoolDeposit, setShowPoolDeposit] = useState(false);
  const [showPoolWithdraw, setShowPoolWithdraw] = useState(false);
  const [showMaxBondEdit, setShowMaxBondEdit] = useState(false);
  const [maxBondAmount, setMaxBondAmount] = useState("");
  const [showChallengerDeposit, setShowChallengerDeposit] = useState(false);
  const [showChallengerWithdraw, setShowChallengerWithdraw] = useState(false);
  const [challengerStakeAmount, setChallengerStakeAmount] = useState("0.1");
  const [challengerWithdrawAmount, setChallengerWithdrawAmount] = useState("0.1");
  const [copied, setCopied] = useState(false);

  // Expand/collapse state
  const [lockedStakeExpanded, setLockedStakeExpanded] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      let subjectsData: SubjectData[] = [];
      let disputesData: DisputeData[] = [];

      // Try Supabase first
      if (isSupabaseConfigured()) {
        const [supaSubjects, supaDisputes] = await Promise.all([
          getSubjects(),
          getDisputes(),
        ]);
        subjectsData = supaSubjects.map(convertSupabaseSubject).filter((s): s is SubjectData => s !== null);
        disputesData = supaDisputes.map(convertSupabaseDispute).filter((d): d is DisputeData => d !== null);
      }

      // Fallback to RPC if Supabase not configured or returned empty
      if (subjectsData.length === 0 && client) {
        const rpcSubjects = await fetchAllSubjects();
        subjectsData = rpcSubjects || [];
      }
      if (disputesData.length === 0 && client) {
        const rpcDisputes = await fetchAllDisputes();
        disputesData = rpcDisputes || [];
      }

      setSubjects(subjectsData);
      setDisputes(disputesData);

      // Fetch content for subjects using detailsCid
      for (const s of subjectsData) {
        const key = s.publicKey.toBase58();
        if (!subjectContents[key] && s.account.detailsCid) {
          fetchSubjectContent(s.account.detailsCid).then(content => {
            if (content) setSubjectContents(prev => ({ ...prev, [key]: content }));
          });
        }
      }

      // Fetch dispute content using detailsCid from dispute or first challenger
      for (const d of disputesData) {
        const disputeKey = d.publicKey.toBase58();
        if (!disputeCids[disputeKey]) {
          // In V2, dispute has detailsCid directly, or fetch from first challenger
          const cid = d.account.detailsCid;
          if (cid) {
            setDisputeCids(prev => ({ ...prev, [disputeKey]: cid }));
            fetchDisputeContent(cid).then(content => {
              if (content) setDisputeContents(prev => ({ ...prev, [disputeKey]: content }));
            });
          } else {
            // Fallback: fetch from first challenger record
            fetchChallengerRecordsBySubject(d.account.subjectId).then(challengers => {
              if (challengers && challengers.length > 0) {
                const challengerCid = challengers[0].account.detailsCid;
                setDisputeCids(prev => ({ ...prev, [disputeKey]: challengerCid }));
                fetchDisputeContent(challengerCid).then(content => {
                  if (content) setDisputeContents(prev => ({ ...prev, [disputeKey]: content }));
                });
              }
            });
          }
        }
      }

      // Fetch juror account and vote records if connected
      if (publicKey) {
        // Fetch defender pool
        const [poolPda] = getDefenderPoolPDA(publicKey);
        let poolData = null;
        try {
          poolData = await fetchDefenderPool(poolPda);
          console.log("[Profile] DefenderPool fetch result:", poolData ? "found" : "null", poolPda.toBase58());
          setPool(poolData);
        } catch (err) {
          console.error("[Profile] DefenderPool fetch error:", err);
          setPool(null);
        }

        // Fetch challenger account
        const [challengerPoolPda] = getChallengerPoolPDA(publicKey);
        try {
          const challengerPoolData = await fetchChallengerPool(challengerPoolPda);
          console.log("[Profile] ChallengerPool fetch result:", challengerPoolData ? "found" : "null", challengerPoolPda.toBase58());
          setChallengerAccount(challengerPoolData);
        } catch (err) {
          console.error("[Profile] ChallengerPool fetch error:", err);
          setChallengerAccount(null);
        }

        // In V2, find defended subjects via DefenderRecords (subjects user has bonded to)
        const defendedDisputeKeys: string[] = [];
        const userDefenderRecords: Array<{ publicKey: PublicKey; account: any }> = [];
        try {
          const records = await fetchDefenderRecordsByDefender(publicKey);
          userDefenderRecords.push(...records);
          // Find disputes for subjects where user has defender records
          for (const dr of records) {
            const subjectIdKey = dr.account.subjectId.toBase58();
            // Find dispute that matches this subject and round
            const matchingDispute = disputesData.find(
              (d: DisputeData) =>
                d.account.subjectId.toBase58() === subjectIdKey &&
                d.account.round === dr.account.round
            );
            if (matchingDispute && !defendedDisputeKeys.includes(matchingDispute.publicKey.toBase58())) {
              defendedDisputeKeys.push(matchingDispute.publicKey.toBase58());
            }
          }
        } catch (err) {
          console.error("[loadData] Failed to fetch defender records:", err);
        }

        // Fetch all challenger records for the user (disputes they challenged)
        const challengedSubjectKeys: string[] = [];
        const userChallengerRecordsData: Array<{ publicKey: PublicKey; account: any }> = [];
        try {
          const userChallengerRecords = await fetchChallengerRecordsByChallenger(publicKey);
          userChallengerRecordsData.push(...userChallengerRecords);
          for (const cr of userChallengerRecords) {
            challengedSubjectKeys.push(cr.account.subjectId.toBase58());
          }
        } catch (err) {
          console.error("[loadData] Failed to fetch challenger records:", err);
        }

        const [jurorPda] = getJurorPoolPDA(publicKey);
        try {
          const jurorData = await fetchJurorPool(jurorPda);
          setJurorAccount(jurorData);

          // Fetch all juror records for this user directly (more reliable than iterating disputes)
          const votes: Record<string, VoteData> = {};
          const votedDisputeKeys: string[] = [];
          const allRecords: VoteData[] = [];
          try {
            const userJurorRecords = await fetchJurorRecordsByJuror(publicKey);
            console.log("[loadData] Found juror records:", userJurorRecords.length);
            for (const jr of userJurorRecords) {
              // Store all juror records for locked stake display
              allRecords.push({ publicKey: jr.publicKey, account: jr.account });

              // Find the matching dispute for this juror record
              // Handle both BN and number types for round comparison
              const jrRound = typeof jr.account.round === 'number' ? jr.account.round : (jr.account.round as any).toNumber?.() ?? jr.account.round;
              const matchingDispute = disputesData.find((d: DisputeData) => {
                const dRound = typeof d.account.round === 'number' ? d.account.round : (d.account.round as any).toNumber?.() ?? d.account.round;
                return d.account.subjectId.toBase58() === jr.account.subjectId.toBase58() && dRound === jrRound;
              });
              if (matchingDispute) {
                votes[matchingDispute.publicKey.toBase58()] = {
                  publicKey: jr.publicKey,
                  account: jr.account,
                };
                votedDisputeKeys.push(matchingDispute.publicKey.toBase58());
                console.log("[loadData] Matched juror record to dispute:", matchingDispute.publicKey.toBase58(), "round:", jr.account.round);
              } else {
                console.log("[loadData] Juror record has no matching dispute:", jr.account.subjectId.toBase58(), "round:", jr.account.round);
              }
            }
          } catch (err) {
            console.error("[loadData] Failed to fetch juror records:", err);
          }
          setUserVotes(votes);
          setAllJurorRecords(allRecords);

          // Fetch vote counts for disputes user has voted on, defended, OR challenged
          // Map subject keys to dispute keys for comparison
          const challengedDisputeKeys = challengedSubjectKeys.map(subjectKey => {
            const d = disputesData.find((x: DisputeData) => x.account.subjectId.toBase58() === subjectKey);
            return d ? d.publicKey.toBase58() : null;
          }).filter(Boolean) as string[];
          const allRelevantDisputeKeys = [...new Set([...votedDisputeKeys, ...defendedDisputeKeys, ...challengedDisputeKeys])];
          const counts: Record<string, { forChallenger: number; forDefender: number }> = {};
          for (const dKey of allRelevantDisputeKeys) {
            const d = disputesData.find((x: DisputeData) => x.publicKey.toBase58() === dKey);
            if (!d) continue;
            try {
              const allVotes = await fetchJurorRecordsBySubject(d.account.subjectId);
              if (allVotes) {
                let forChallenger = 0;
                let forDefender = 0;
                for (const v of allVotes) {
                  if (d.account.isRestore) {
                    if ("forRestoration" in v.account.restoreChoice) forChallenger++;
                    else if ("againstRestoration" in v.account.restoreChoice) forDefender++;
                  } else {
                    if ("forChallenger" in v.account.choice) forChallenger++;
                    else if ("forDefender" in v.account.choice) forDefender++;
                  }
                }
                counts[dKey] = { forChallenger, forDefender };
              }
            } catch {}
          }
          setDisputeVoteCounts(counts);

        } catch {
          setJurorAccount(null);
          setUserVotes({});
          setAllJurorRecords([]);
        }

        // Build challenger/defender records from already-fetched data
        // This is OUTSIDE the juror try block so it always runs
        // Key by dispute publicKey for lookup
        const challRecords: Record<string, any> = {};
        const defRecords: Record<string, any> = {};

        // Use challenger records we already fetched - key by matching dispute
        for (const cr of userChallengerRecordsData) {
          const matchingDispute = disputesData.find((d: DisputeData) =>
            d.account.subjectId.toBase58() === cr.account.subjectId.toBase58() &&
            d.account.round === cr.account.round
          );
          if (matchingDispute) {
            challRecords[matchingDispute.publicKey.toBase58()] = cr.account;
          }
        }

        // Use defender records we already fetched - key by matching dispute
        for (const dr of userDefenderRecords) {
          const matchingDispute = disputesData.find((d: DisputeData) =>
            d.account.subjectId.toBase58() === dr.account.subjectId.toBase58() &&
            d.account.round === dr.account.round
          );
          if (matchingDispute) {
            defRecords[matchingDispute.publicKey.toBase58()] = dr.account;
          }
        }

        setChallengerRecords(challRecords);
        setDefenderRecords(defRecords);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    }
    setLoading(false);

    // Scan for collectable rewards/closes (V2 - no unlocks)
    if (publicKey && client) {
      try {
        console.log("[Scan collectables] Starting scan...");
        const scan = await scanCollectableRecords();
        console.log("[Scan collectables] Result:", {
          jurorClaims: scan.claims.juror.length,
          challengerClaims: scan.claims.challenger.length,
          defenderClaims: scan.claims.defender.length,
          jurorCloses: scan.closes.juror.length,
          challengerCloses: scan.closes.challenger.length,
          defenderCloses: scan.closes.defender.length,
        });
        setCollectableData({
          claims: scan.claims.juror.length + scan.claims.challenger.length + scan.claims.defender.length,
          unlocks: 0, // V2 doesn't have separate unlocks
          closes: scan.closes.juror.length + scan.closes.challenger.length + scan.closes.defender.length,
          estimatedRewards: scan.totals.estimatedRewards,
          estimatedRent: scan.totals.estimatedRent,
          stakeToUnlock: 0, // V2 doesn't track stakeToUnlock
        });
      } catch (err) {
        console.error("[Scan collectables] Error:", err);
        setCollectableData(null);
      }
    } else {
      console.log("[Scan collectables] Skipped - publicKey:", !!publicKey, "client:", !!client);
    }

  };

  const handleCollectAll = async () => {
    if (!publicKey) return;
    setCollectLoading(true);
    setError(null);
    try {
      const result = await collectAll();
      const total = result.summary.claimCount + result.summary.closeCount;
      if (total > 0) {
        setSuccess(`Collected: ${result.summary.claimCount} claims, ${result.summary.closeCount} records closed`);
        await loadData(); // Refresh data
      } else {
        setSuccess("Nothing to collect");
      }
    } catch (err: any) {
      console.error("[CollectAll]", err);
      setError(err.message || "Failed to collect");
    }
    setCollectLoading(false);
  };

  useEffect(() => {
    if (client) {
      loadData();
    }
  }, [publicKey, client]);

  // Sync selectedItem when disputes/subjects change (after loadData)
  useEffect(() => {
    if (selectedItem?.dispute) {
      const disputeKey = selectedItem.dispute.publicKey.toBase58();
      const subjectKey = selectedItem.subject.publicKey.toBase58();
      const updatedDispute = disputes.find(d => d.publicKey.toBase58() === disputeKey);
      const updatedSubject = subjects.find(s => s.publicKey.toBase58() === subjectKey);
      if (updatedDispute && updatedSubject) {
        // Only update if data actually changed
        if (updatedDispute.account.votesFavorWeight.toNumber() !== selectedItem.dispute.account.votesFavorWeight.toNumber() ||
            updatedDispute.account.votesAgainstWeight.toNumber() !== selectedItem.dispute.account.votesAgainstWeight.toNumber()) {
          setSelectedItem(prev => prev ? { ...prev, subject: updatedSubject, dispute: updatedDispute } : null);
        }
      }
    }
  }, [disputes, subjects]);

  // Fetch challenger/defender records when a dispute is selected (for claim status)
  useEffect(() => {
    const fetchSelectedData = async () => {
      if (!selectedItem || !publicKey) {
        return;
      }

      const { subject, dispute } = selectedItem;
      const subjectKey = subject.publicKey.toBase58();

      // Fetch challenger/defender records for resolved disputes (used for claim buttons in profile list)
      if (dispute.account.status.resolved) {
        const [challengerRecordPda] = getChallengerRecordPDA(dispute.account.subjectId, publicKey, dispute.account.round);
        try {
          const record = await fetchChallengerRecord(challengerRecordPda);
          if (record) setChallengerRecords(prev => ({ ...prev, [dispute.publicKey.toBase58()]: record }));
        } catch {}

        const [defenderRecordPda] = getDefenderRecordPDA(dispute.account.subjectId, publicKey, dispute.account.round);
        try {
          const record = await fetchDefenderRecord(defenderRecordPda);
          if (record) setDefenderRecords(prev => ({ ...prev, [dispute.publicKey.toBase58()]: record }));
        } catch {}
      }
    };
    fetchSelectedData();
  }, [selectedItem, publicKey, disputes]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════════

  const handleRegister = async () => {
    if (!publicKey) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const stake = new BN(parseFloat(registerStake) * LAMPORTS_PER_SOL);
      await registerJuror(stake);
      setSuccess("Registered as juror successfully");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to register");
    }
    setActionLoading(false);
  };

  const handleAddJurorStake = async () => {
    if (!publicKey) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const amount = new BN(parseFloat(addStakeAmount) * LAMPORTS_PER_SOL);
      await addJurorStake(amount);
      setSuccess(`Added ${addStakeAmount} SOL to stake`);
      setShowAddStake(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to add stake");
    }
    setActionLoading(false);
  };

  const handleWithdraw = async () => {
    if (!publicKey) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const amount = new BN(parseFloat(withdrawAmount) * LAMPORTS_PER_SOL);
      await withdrawJurorStake(amount);
      setSuccess(`Withdrew ${withdrawAmount} SOL`);
      setShowWithdraw(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to withdraw");
    }
    setActionLoading(false);
  };

  const handleUnregister = async () => {
    if (!publicKey) return;
    if (!confirm("Are you sure you want to unregister? You will withdraw all available stake.")) return;

    setActionLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await unregisterJuror();
      setSuccess("Unregistered successfully");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to unregister");
    }
    setActionLoading(false);
  };

  const handleCreatePool = async () => {
    if (!publicKey) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const amount = new BN(parseFloat(createAmount) * LAMPORTS_PER_SOL);
      await createDefenderPool(amount);
      setSuccess("Defender pool created successfully");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to create pool");
    }
    setActionLoading(false);
  };

  const handlePoolStake = async () => {
    if (!publicKey) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const amount = new BN(parseFloat(poolStakeAmount) * LAMPORTS_PER_SOL);
      await depositDefenderPool(amount);
      setSuccess("Stake added to pool successfully");
      setShowPoolDeposit(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to stake to pool");
    }
    setActionLoading(false);
  };

  const handlePoolWithdraw = async () => {
    if (!publicKey) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const amount = new BN(parseFloat(poolWithdrawAmount) * LAMPORTS_PER_SOL);
      await withdrawDefenderPool(amount);
      setSuccess("Withdrawal from pool successful");
      setShowPoolWithdraw(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to withdraw from pool");
    }
    setActionLoading(false);
  };

  const handleUpdateMaxBond = async () => {
    if (!publicKey) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      // Parse amount - empty or 0 means unlimited (u64::MAX)
      const inputValue = parseFloat(maxBondAmount);
      let newMaxBond: BN;
      if (!maxBondAmount || isNaN(inputValue) || inputValue <= 0) {
        // Set to u64::MAX for unlimited
        newMaxBond = new BN("18446744073709551615");
      } else {
        newMaxBond = new BN(inputValue * LAMPORTS_PER_SOL);
      }
      await updateMaxBond(newMaxBond);
      setSuccess("Max bond updated successfully");
      setShowMaxBondEdit(false);
      setMaxBondAmount("");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to update max bond");
    }
    setActionLoading(false);
  };

  const handleChallengerDeposit = async () => {
    if (!publicKey) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const amount = new BN(parseFloat(challengerStakeAmount) * LAMPORTS_PER_SOL);
      await addChallengerStake(amount);
      setSuccess("Stake added to challenger pool successfully");
      setShowChallengerDeposit(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to stake to challenger pool");
    }
    setActionLoading(false);
  };

  const handleChallengerWithdraw = async () => {
    if (!publicKey) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const amount = new BN(parseFloat(challengerWithdrawAmount) * LAMPORTS_PER_SOL);
      await withdrawChallengerStake(amount);
      setSuccess("Withdrawal from challenger pool successful");
      setShowChallengerWithdraw(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to withdraw from challenger pool");
    }
    setActionLoading(false);
  };

  const copyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Handlers for dispute actions (V2 uses subjectId, not disputePubkey)
  const handleVote = useCallback(async (subjectIdKey: string, round: number, stakeAmount: string, choice: "forChallenger" | "forDefender" | "forRestoration" | "againstRestoration", rationale: string) => {
    if (!publicKey || !jurorAccount) return;
    setActionLoading(true);
    setError(null);
    try {
      const subjectId = new PublicKey(subjectIdKey);
      const stake = new BN(parseFloat(stakeAmount) * LAMPORTS_PER_SOL);
      const isRestore = choice === "forRestoration" || choice === "againstRestoration";

      // V2: No addToVote - users can only vote once per dispute round
      if (isRestore) {
        const restoreChoice = { [choice]: {} } as any;
        await voteOnRestore(subjectId, restoreChoice, stake, rationale);
        setSuccess("Vote cast on restoration request");
      } else {
        const voteChoice = { [choice]: {} } as any;
        await voteOnDispute(subjectId, voteChoice, stake, rationale);
        setSuccess("Vote cast");
      }
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to vote");
    }
    setActionLoading(false);
  }, [publicKey, jurorAccount, voteOnDispute, voteOnRestore, loadData]);

  const handleResolve = useCallback(async (subjectIdKey: string) => {
    if (!publicKey || !selectedItem) return;
    setActionLoading(true);
    setError(null);
    try {
      const subjectId = new PublicKey(subjectIdKey);
      await resolveDispute(subjectId);
      setSuccess("Dispute resolved");
      setSelectedItem(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to resolve");
    }
    setActionLoading(false);
  }, [publicKey, selectedItem, resolveDispute, loadData]);

  const handleClaimAll = useCallback(async (subjectIdKey: string, round: number, claims: { juror: boolean; challenger: boolean; defender: boolean }) => {
    if (!publicKey || !selectedItem) return;
    setActionLoading(true);
    setError(null);
    const claimedRewards: string[] = [];
    try {
      const subjectId = new PublicKey(subjectIdKey);

      // V2: Build batch claim params with subjectId and round
      const batchParams: {
        jurorClaims?: Array<{ subjectId: PublicKey; round: number }>;
        challengerClaims?: Array<{ subjectId: PublicKey; round: number }>;
        defenderClaims?: Array<{ subjectId: PublicKey; round: number }>;
      } = {};

      if (claims.juror) {
        batchParams.jurorClaims = [{ subjectId, round }];
        claimedRewards.push("Juror");
      }

      if (claims.challenger) {
        batchParams.challengerClaims = [{ subjectId, round }];
        claimedRewards.push("Challenger");
      }

      if (claims.defender) {
        batchParams.defenderClaims = [{ subjectId, round }];
        claimedRewards.push("Defender");
      }

      await batchClaimRewards(batchParams);
      setSuccess(`${claimedRewards.join(", ")} reward${claimedRewards.length > 1 ? "s" : ""} claimed!`);
      await loadData();
    } catch (err: any) {
      console.error("[ClaimAll] Error:", err);
      setError(err.message || "Failed to claim rewards");
    }
    setActionLoading(false);
  }, [publicKey, selectedItem, batchClaimRewards, loadData]);

  // Close records to reclaim rent (after rewards claimed)
  const handleCloseRecords = useCallback(async (subjectIdKey: string, round: number, recordTypes: { juror: boolean; challenger: boolean; defender: boolean }) => {
    if (!publicKey || !selectedItem) return;
    setActionLoading(true);
    setError(null);
    const closedRecords: string[] = [];
    try {
      const subjectId = new PublicKey(subjectIdKey);
      const records: Array<{ type: "juror" | "challenger" | "defender"; subjectId: PublicKey; round: number }> = [];

      if (recordTypes.juror) {
        records.push({ type: "juror", subjectId, round });
        closedRecords.push("Juror");
      }
      if (recordTypes.challenger) {
        records.push({ type: "challenger", subjectId, round });
        closedRecords.push("Challenger");
      }
      if (recordTypes.defender) {
        records.push({ type: "defender", subjectId, round });
        closedRecords.push("Defender");
      }

      if (records.length > 0) {
        await batchCloseRecords(records);
        setSuccess(`${closedRecords.join(", ")} record${closedRecords.length > 1 ? "s" : ""} closed! Rent reclaimed.`);
        await loadData();
      }
    } catch (err: any) {
      console.error("[CloseRecords] Error:", err);
      setError(err.message || "Failed to close records");
    }
    setActionLoading(false);
  }, [publicKey, selectedItem, batchCloseRecords, loadData]);

  const handleAddDefenderStake = useCallback(async (amount: string) => {
    if (!publicKey || !selectedItem) return;
    setActionLoading(true);
    setError(null);
    try {
      const stake = new BN(parseFloat(amount) * LAMPORTS_PER_SOL);
      await addBondDirect(selectedItem.subject.account.subjectId, stake);
      setSuccess(`Added ${amount} SOL bond`);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to add bond");
    }
    setActionLoading(false);
  }, [publicKey, selectedItem, addBondDirect, loadData]);

  const handleJoinChallengers = useCallback(async (subjectIdKey: string, amount: string, detailsCid: string = "") => {
    if (!publicKey || !selectedItem) return;
    setActionLoading(true);
    setError(null);
    try {
      const subjectId = selectedItem.subject.account.subjectId;
      const stake = new BN(parseFloat(amount) * LAMPORTS_PER_SOL);

      await joinChallengers({ subjectId, stake, detailsCid });
      setSuccess(`Added ${amount} SOL stake as challenger`);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to join challengers");
    }
    setActionLoading(false);
  }, [publicKey, selectedItem, joinChallengers, loadData]);

  // Unlock juror stake (7 days after resolution)
  const handleUnlockStake = useCallback(async (subjectId: PublicKey, round: number) => {
    if (!publicKey) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await unlockJurorStake(subjectId, round);
      setSuccess("Stake unlocked successfully");
      await loadData();
    } catch (err: any) {
      console.error("[UnlockStake] Error:", err);
      setError(err.message || "Failed to unlock stake");
    }
    setActionLoading(false);
  }, [publicKey, unlockJurorStake, loadData]);

  // Batch unlock all ready stakes - takes items as parameter to avoid initialization order issues
  const handleBatchUnlock = useCallback(async (items: Array<{
    vote: VoteData;
    round: number;
    isResolved: boolean;
    unlockAt: number;
  }>) => {
    if (!publicKey) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      // Only unlock items where dispute is resolved AND time has passed
      const readyItems = items.filter(item =>
        item.isResolved && Date.now() / 1000 >= item.unlockAt
      );
      let unlockCount = 0;
      for (const item of readyItems) {
        try {
          await unlockJurorStake(item.vote.account.subjectId, item.round);
          unlockCount++;
        } catch (err) {
          console.error("[BatchUnlock] Failed to unlock:", err);
        }
      }
      if (unlockCount > 0) {
        setSuccess(`Unlocked ${unlockCount} stake${unlockCount > 1 ? 's' : ''}`);
        await loadData();
      } else {
        setError("No stakes ready to unlock (must be resolved + 7 days)");
      }
    } catch (err: any) {
      console.error("[BatchUnlock] Error:", err);
      setError(err.message || "Failed to unlock stakes");
    }
    setActionLoading(false);
  }, [publicKey, unlockJurorStake, loadData]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // COMPUTED VALUES
  // ═══════════════════════════════════════════════════════════════════════════════

  const formatReputation = (rep: number) => `${(rep / 1_000_000).toFixed(1)}%`;

  const formatTimeRemaining = (unlockAt: number) => {
    const now = Date.now() / 1000;
    const diff = unlockAt - now;
    if (diff <= 0) return "Ready";

    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    const mins = Math.floor((diff % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };


  // Type for activity items with separate role flags
  type ActivityItem = {
    subject: SubjectData;
    dispute: DisputeData;
    vote: VoteData | null;
    roles: { juror: boolean; defender: boolean; challenger: boolean };
  };

  // Get pool PDA for comparison
  const [poolPda] = publicKey ? getDefenderPoolPDA(publicKey) : [null];

  // Helper to check if user is challenger on a dispute
  const isUserChallenger = (disputeKey: string): boolean => {
    return !!challengerRecords[disputeKey];
  };

  // Get disputes where user has voted (for locked stake breakdown)
  const getVotedDisputes = (): ActivityItem[] => {
    const votedDisputeKeys = Object.keys(userVotes);
    const items = votedDisputeKeys.map(key => {
      const dispute = disputes.find(d => d.publicKey.toBase58() === key);
      if (!dispute) return null;
      const subject = subjects.find(s => s.account.subjectId.toBase58() === dispute.account.subjectId.toBase58());
      if (!subject) return null;
      const vote = userVotes[key];
      // Check all roles - defender has defender record for this subject
      const isDefender = !!defenderRecords[subject.publicKey.toBase58()];
      const isChallenger = isUserChallenger(key);
      const item: ActivityItem = {
        subject,
        dispute,
        vote,
        roles: { juror: true, defender: !!isDefender, challenger: isChallenger }
      };
      return item;
    });
    return items.filter((item): item is ActivityItem => item !== null);
  };

  // Get disputes where user is defender or challenger (but NOT already voted - to avoid duplicates)
  const getOtherDisputes = (): ActivityItem[] => {
    const votedDisputeKeys = new Set(Object.keys(userVotes));
    const result: ActivityItem[] = [];
    const addedDisputes = new Set<string>();

    // Find subjects where user has defender records
    if (pool && poolPda) {
      const defendedSubjects = subjects.filter(
        s => !!defenderRecords[s.publicKey.toBase58()]
      );

      for (const subject of defendedSubjects) {
        const subjectDisputes = disputes.filter(
          d => d.account.subjectId.toBase58() === subject.publicKey.toBase58()
        );
        for (const dispute of subjectDisputes) {
          const disputeKey = dispute.publicKey.toBase58();
          if (votedDisputeKeys.has(disputeKey)) continue;
          if (addedDisputes.has(disputeKey)) continue;

          const isChallenger = isUserChallenger(disputeKey);
          result.push({
            subject,
            dispute,
            vote: null,
            roles: { juror: false, defender: true, challenger: isChallenger }
          });
          addedDisputes.add(disputeKey);
        }
      }
    }

    // Find disputes where user has defender records (staked on someone else's subject)
    for (const subjectKey of Object.keys(defenderRecords)) {
      const subject = subjects.find(s => s.publicKey.toBase58() === subjectKey);
      if (!subject) continue;

      const subjectDisputes = disputes.filter(
        d => d.account.subjectId.toBase58() === subjectKey
      );
      for (const dispute of subjectDisputes) {
        const disputeKey = dispute.publicKey.toBase58();
        if (votedDisputeKeys.has(disputeKey)) continue;
        if (addedDisputes.has(disputeKey)) continue;

        const isChallenger = isUserChallenger(disputeKey);
        result.push({
          subject,
          dispute,
          vote: null,
          roles: { juror: false, defender: true, challenger: isChallenger }
        });
        addedDisputes.add(disputeKey);
      }
    }

    // Find disputes where user is challenger (not already added)
    for (const disputeKey of Object.keys(challengerRecords)) {
      if (votedDisputeKeys.has(disputeKey)) continue;
      if (addedDisputes.has(disputeKey)) continue;

      const dispute = disputes.find(d => d.publicKey.toBase58() === disputeKey);
      if (!dispute) continue;
      const subject = subjects.find(s => s.account.subjectId.toBase58() === dispute.account.subjectId.toBase58());
      if (!subject) continue;

      const isDefender = !!defenderRecords[subject.publicKey.toBase58()];
      result.push({
        subject,
        dispute,
        vote: null,
        roles: { juror: false, defender: !!isDefender, challenger: true }
      });
      addedDisputes.add(disputeKey);
    }

    return result;
  };

  const votedDisputes = getVotedDisputes();
  const otherDisputes = getOtherDisputes();

  // Combine all user's disputes (voted + defender/challenger only)
  const allUserDisputes = [...votedDisputes, ...otherDisputes];

  // Get locked stake items (votes where stake hasn't been unlocked yet)
  // Uses allJurorRecords to include records from past rounds (where dispute moved to new round)
  const getLockedStakeItems = () => {
    const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

    return allJurorRecords
      .filter(jr => !jr.account.stakeUnlocked)
      .map(jr => {
        const stakeAmount = safeToNumber(jr.account.stakeAllocation);
        const jrSubjectId = jr.account.subjectId.toBase58();
        const jrRound = typeof jr.account.round === 'number' ? jr.account.round : (jr.account.round as any).toNumber?.() ?? jr.account.round;

        // Find the subject for this juror record
        const subject = subjects.find(s => s.account.subjectId.toBase58() === jrSubjectId);

        // Find the dispute for this subject (may be different round if dispute moved on)
        const dispute = disputes.find(d => d.account.subjectId.toBase58() === jrSubjectId);

        // Determine if this round is resolved
        // If dispute exists and is on a different (higher) round, the old round is resolved
        // If dispute exists and is on same round, check dispute status
        // If dispute doesn't exist, consider it resolved (subject may have been invalidated)
        let isResolved = true;
        let unlockAt = safeToNumber(jr.account.votedAt) + SEVEN_DAYS_SECONDS; // Fallback estimate

        if (dispute) {
          const disputeRound = typeof dispute.account.round === 'number' ? dispute.account.round : (dispute.account.round as any).toNumber?.() ?? dispute.account.round;
          if (disputeRound === jrRound) {
            // Same round - check dispute status
            isResolved = "resolved" in dispute.account.status;
            unlockAt = safeToNumber(dispute.account.votingEndsAt) + SEVEN_DAYS_SECONDS;
          } else if (disputeRound > jrRound) {
            // Dispute moved to new round - old round is resolved
            isResolved = true;
            // Estimate unlock time based on votedAt + typical voting period + 7 days
            // We don't have exact resolvedAt for past rounds without fetching escrow
            unlockAt = safeToNumber(jr.account.votedAt) + (24 * 60 * 60) + SEVEN_DAYS_SECONDS; // votedAt + 1 day (voting) + 7 days
          }
        }

        const subjectContent = subject ? subjectContents[subject.publicKey.toBase58()] : null;

        return {
          vote: jr,
          subject: subject || null,
          dispute: dispute || null,
          stakeAmount,
          unlockAt,
          isResolved,
          round: jrRound,
          subjectName: subjectContent?.title || (subject ? `Subject ${subject.publicKey.toBase58().slice(0, 8)}...` : `Round ${jrRound}`)
        };
      })
      .filter(item => item.stakeAmount > 0); // Only include items with actual stake
  };

  const lockedStakeItems = getLockedStakeItems();

  // Calculate total locked stake from items
  const lockedStake = lockedStakeItems.reduce((sum, item) => sum + item.stakeAmount, 0);

  // Categorize disputes - now includes defended subjects
  const activeDisputes = allUserDisputes.filter(item => {
    const isPending = "pending" in item.dispute.account.status;
    const votingEnded = Date.now() > item.dispute.account.votingEndsAt.toNumber() * 1000;
    return isPending && !votingEnded;
  });

  const pendingActionDisputes = allUserDisputes.filter(item => {
    const isPending = "pending" in item.dispute.account.status;
    const isResolved = "resolved" in item.dispute.account.status;
    const votingEnded = Date.now() > item.dispute.account.votingEndsAt.toNumber() * 1000;
    const needsResolution = isPending && votingEnded;

    if (!isResolved) return needsResolution;

    // Check if it's a free case (no rewards to claim)
    const d = item.dispute.account;
    const totalPool = d.isRestore
      ? d.restoreStake?.toNumber() || 0
      : (d.totalBond?.toNumber() || 0) + (d.stakeHeld?.toNumber() || 0) + (d.directStakeHeld?.toNumber() || 0);
    if (totalPool === 0) return false; // Free cases have no claims

    // Check all possible claims for resolved disputes
    const jurorNeedsClaim = item.vote && !item.vote.account.rewardClaimed;
    const challengerRecord = challengerRecords[item.dispute.publicKey.toBase58()];
    const defenderRecord = defenderRecords[item.subject.publicKey.toBase58()];
    const challengerNeedsClaim = challengerRecord && !challengerRecord.rewardClaimed;
    const defenderNeedsClaim = defenderRecord && !defenderRecord.rewardClaimed;

    return jurorNeedsClaim || challengerNeedsClaim || defenderNeedsClaim;
  });

  // Historical disputes (resolved, all claims processed) - PDA-based only
  const historicalDisputes = allUserDisputes.filter(item => {
    if (!("resolved" in item.dispute.account.status)) return false;

    // All claims must be processed
    const jurorClaimed = !item.vote || item.vote.account.rewardClaimed;
    const challengerRecord = challengerRecords[item.dispute.publicKey.toBase58()];
    const defenderRecord = defenderRecords[item.subject.publicKey.toBase58()];
    const challengerClaimed = !challengerRecord || challengerRecord.rewardClaimed;
    const defenderClaimed = !defenderRecord || defenderRecord.rewardClaimed;

    return jurorClaimed && challengerClaimed && defenderClaimed;
  });

  // Deduplicate historical disputes by subject (show one card per subject)
  const historicalSubjects = historicalDisputes.reduce((acc, item) => {
    const subjectKey = item.subject.publicKey.toBase58();
    if (!acc.some(x => x.subject.publicKey.toBase58() === subjectKey)) {
      acc.push(item);
    }
    return acc;
  }, [] as typeof historicalDisputes);

  // Batch claim handler - claims all pending rewards across all disputes (V2)
  const handleBatchClaim = useCallback(async () => {
    if (!publicKey) return;
    setActionLoading(true);
    setError(null);
    try {
      // Helper to check if dispute has rewards (not a free case)
      const hasRewards = (item: typeof allUserDisputes[0]) => {
        const d = item.dispute.account;
        const totalPool = d.isRestore
          ? d.restoreStake?.toNumber() || 0
          : (d.totalStake?.toNumber() || 0) + (d.bondAtRisk?.toNumber() || 0);
        return totalPool > 0;
      };

      // Find claimable juror rewards (resolved disputes with votes not claimed, excluding free cases)
      const claimableJurorDisputes = allUserDisputes.filter(item => {
        const hasVote = !!item.vote;
        const notClaimed = item.vote && !item.vote.account.rewardClaimed;
        return hasVote && item.dispute.account.status.resolved && notClaimed && hasRewards(item);
      });

      // Find claimable challenger rewards (excluding free cases)
      const claimableChallengerDisputes = allUserDisputes.filter(item => {
        const challengerRecord = challengerRecords[item.dispute.publicKey.toBase58()];
        return challengerRecord && item.dispute.account.status.resolved && !challengerRecord.rewardClaimed && hasRewards(item);
      });

      // Find claimable defender rewards (excluding free cases)
      const claimableDefenderDisputes = allUserDisputes.filter(item => {
        const defenderRecord = defenderRecords[item.dispute.publicKey.toBase58()];
        return defenderRecord && item.dispute.account.status.resolved && !defenderRecord.rewardClaimed && hasRewards(item);
      });

      const totalClaims = claimableJurorDisputes.length + claimableChallengerDisputes.length + claimableDefenderDisputes.length;

      if (totalClaims === 0) {
        setError("No rewards to claim");
        setActionLoading(false);
        return;
      }

      // V2: Build batch claim params with subjectId and round
      const batchParams: {
        jurorClaims?: Array<{ subjectId: PublicKey; round: number }>;
        challengerClaims?: Array<{ subjectId: PublicKey; round: number }>;
        defenderClaims?: Array<{ subjectId: PublicKey; round: number }>;
      } = {};

      if (claimableJurorDisputes.length > 0) {
        batchParams.jurorClaims = claimableJurorDisputes.map(item => ({
          subjectId: item.dispute.account.subjectId,
          round: item.dispute.account.round,
        }));
      }

      if (claimableChallengerDisputes.length > 0) {
        batchParams.challengerClaims = claimableChallengerDisputes.map(item => ({
          subjectId: item.dispute.account.subjectId,
          round: item.dispute.account.round,
        }));
      }

      if (claimableDefenderDisputes.length > 0) {
        batchParams.defenderClaims = claimableDefenderDisputes.map(item => ({
          subjectId: item.dispute.account.subjectId,
          round: item.dispute.account.round,
        }));
      }

      await batchClaimRewards(batchParams);

      const parts = [];
      if (claimableJurorDisputes.length > 0) parts.push(`${claimableJurorDisputes.length} juror`);
      if (claimableChallengerDisputes.length > 0) parts.push(`${claimableChallengerDisputes.length} challenger`);
      if (claimableDefenderDisputes.length > 0) parts.push(`${claimableDefenderDisputes.length} defender`);

      setSuccess(`Claimed ${parts.join(", ")} reward(s) in a single transaction!`);
      await loadData();
    } catch (err: any) {
      console.error("[BatchClaim] Error:", err);
      setError(err.message || "Failed to batch claim");
    }
    setActionLoading(false);
  }, [publicKey, allUserDisputes, challengerRecords, defenderRecords, batchClaimRewards, loadData]);

  // Past disputes helper
  const getPastDisputes = (subjectKey: string, currentDisputeKey?: string) => {
    return disputes.filter(d =>
      d.account.subjectId.toBase58() === subjectKey &&
      d.account.status.resolved &&
      d.publicKey.toBase58() !== currentDisputeKey
    );
  };

  // Get current active dispute for a subject (pending and voting not ended)
  const getCurrentActiveDispute = (subjectKey: string): DisputeData | null => {
    return disputes.find(d =>
      d.account.subjectId.toBase58() === subjectKey &&
      d.account.status.pending &&
      Date.now() <= d.account.votingEndsAt.toNumber() * 1000
    ) || null;
  };

  // Handler to open modal - always shows current state of subject
  const handleOpenModal = useCallback((item: ActivityItem) => {
    const subjectKey = item.subject.publicKey.toBase58();
    const currentDispute = getCurrentActiveDispute(subjectKey);

    // If subject has a current active dispute, show that instead
    if (currentDispute && currentDispute.publicKey.toBase58() !== item.dispute.publicKey.toBase58()) {
      // Find user's vote for the current dispute
      const currentVote = userVotes[currentDispute.publicKey.toBase58()] || null;
      // Check user roles for current dispute
      const isDefender = !!defenderRecords[item.subject.publicKey.toBase58()];
      const isChallenger = !!challengerRecords[currentDispute.publicKey.toBase58()];
      const isJuror = !!currentVote;

      setSelectedItem({
        subject: item.subject,
        dispute: currentDispute,
        vote: currentVote,
        roles: { juror: isJuror, defender: !!isDefender, challenger: isChallenger }
      });
    } else {
      // Use the clicked dispute (it's the current one or no active dispute)
      setSelectedItem({
        subject: item.subject,
        dispute: item.dispute,
        vote: item.vote,
        roles: item.roles
      });
    }
  }, [disputes, userVotes, poolPda, challengerRecords]);

  // Calculate accuracy rate from actual votes (V2: not tracked on-chain, calculate from userVotes)
  const userVotesArray = Object.values(userVotes);
  const votesCast = userVotesArray.length;
  const correctVotes = userVotesArray.filter(v => {
    // Find the dispute for this vote
    const dispute = disputes.find(d =>
      d.account.subjectId.equals(v.account.subjectId) &&
      d.account.round === v.account.round
    );
    if (!dispute || !("resolved" in dispute.account.status)) return false;
    // Check if vote was correct (Anchor enum: check with "in" operator)
    const votedForChallenger = v.account.choice && "forChallenger" in v.account.choice;
    const votedForDefender = v.account.choice && "forDefender" in v.account.choice;
    const challengerWon = dispute.account.outcome && "challengerWins" in dispute.account.outcome;
    const defenderWon = dispute.account.outcome && "defenderWins" in dispute.account.outcome;
    return (votedForChallenger && challengerWon) || (votedForDefender && defenderWon);
  }).length;
  const accuracyRate = votesCast > 0 ? (correctVotes / votesCast) * 100 : 0;

  // Calculate challenger success rate from actual records (V2: not tracked on-chain)
  const challengerRecordsArray = Object.values(challengerRecords);
  const userChallengerRecords = challengerRecordsArray.filter((r: any) =>
    publicKey && r.account?.challenger?.equals?.(publicKey)
  );
  const disputesSubmitted = userChallengerRecords.length;
  const disputesUpheld = userChallengerRecords.filter((r: any) => {
    const dispute = disputes.find(d =>
      d.account.subjectId.equals(r.account.subjectId) &&
      d.account.round === r.account.round
    );
    return dispute && dispute.account.outcome && "challengerWins" in dispute.account.outcome;
  }).length;
  const challengerSuccessRate = disputesSubmitted > 0 ? (disputesUpheld / disputesSubmitted) * 100 : 0;

  // Calculate defender utilization (V2: use balance as proxy)
  const defenderBalance = safeToNumber(pool?.balance);
  const defenderUtilization = 0; // V2: no held/totalStake tracking

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-obsidian">
      <Navigation />

      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-10 animate-slide-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate/50 border border-slate-light/50 mb-6">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald"></span>
            </span>
            <span className="text-xs text-steel">Your Dashboard</span>
          </div>
          <h1 className="font-display mb-4">
            <span className="block text-3xl md:text-4xl font-semibold text-ivory leading-tight">
              Your
            </span>
            <span className="block text-3xl md:text-4xl font-semibold text-gold leading-tight">
              Profile
            </span>
          </h1>
          <p className="text-steel text-sm max-w-md">
            Manage your accounts, track your activity, and claim rewards
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-red-800/10 border border-red-800/50 p-4 mb-6 animate-slide-up">
            <p className="text-crimson text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-emerald-700/10 border border-emerald-700/50 p-4 mb-6 animate-slide-up">
            <p className="text-emerald text-sm">{success}</p>
          </div>
        )}

        {/* Collect All Banner */}
        {collectableData && (collectableData.claims > 0 || collectableData.unlocks > 0 || collectableData.closes > 0) && (
          <div className="mb-6 p-4 bg-gold/10 border border-gold/30 animate-slide-up">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gold">Rewards Available</p>
                <p className="text-xs text-steel mt-1">
                  {collectableData.claims > 0 && `${collectableData.claims} claims`}
                  {collectableData.claims > 0 && collectableData.unlocks > 0 && " • "}
                  {collectableData.unlocks > 0 && `${collectableData.unlocks} unlocks`}
                  {(collectableData.claims > 0 || collectableData.unlocks > 0) && collectableData.closes > 0 && " • "}
                  {collectableData.closes > 0 && `${collectableData.closes} rent to reclaim`}
                </p>
              </div>
              <button
                onClick={handleCollectAll}
                disabled={collectLoading}
                className="btn btn-primary text-sm px-5 py-2"
              >
                {collectLoading ? "Collecting..." : "Collect All"}
              </button>
            </div>
          </div>
        )}

        {!publicKey ? (
          <div className="tribunal-card-gold p-12 text-center animate-slide-up stagger-2">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full border-2 border-gold flex items-center justify-center text-gold">
              <ShieldIcon />
            </div>
            <h2 className="font-display text-2xl font-semibold text-ivory mb-3">
              Oath Required
            </h2>
            <p className="text-steel max-w-md mx-auto">
              Connect your wallet to access your profile and participate in arbitration.
            </p>
          </div>
        ) : loading ? (
          <div className="tribunal-card p-12 text-center animate-slide-up stagger-2">
            <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin mx-auto mb-4" />
            <p className="text-steel">Loading profile data...</p>
          </div>
        ) : (
          <>
            {/* Wallet Info Bar */}
            <div className="flex items-center justify-between bg-slate/30 border border-slate-light/50 px-5 py-3 mb-8 animate-slide-up stagger-1">
              <div className="flex items-center gap-4">
                <div className="w-9 h-9 bg-gold/10 flex items-center justify-center text-gold">
                  <UserIcon />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-steel mb-0.5">Connected Wallet</p>
                  <p className="font-mono text-parchment text-sm">
                    {publicKey.toBase58().slice(0, 12)}...{publicKey.toBase58().slice(-8)}
                  </p>
                </div>
              </div>
              <button
                onClick={copyAddress}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-steel hover:text-parchment border border-slate-light/50 hover:border-gold/50 transition-colors"
              >
                <CopyIcon />
                {copied ? "Copied!" : "Copy Address"}
              </button>
            </div>

            {/* Account Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 animate-slide-up stagger-2">

              {/* ═══════════════════════════════════════════════════════════════════════════════
                  DEFENDER CARD
                  ═══════════════════════════════════════════════════════════════════════════════ */}
              <div className="bg-gradient-to-b from-slate/40 to-slate/20 border border-slate-light/50 overflow-hidden">
                {/* Card Header */}
                <div className="px-5 py-4 border-b border-slate-light/30 bg-slate/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-sky-400/10 border border-sky-400/30 flex items-center justify-center text-sky-400">
                        <VaultIcon />
                      </div>
                      <div>
                        <h3 className="font-display text-lg font-semibold text-ivory">Defender</h3>
                        <p className="text-[10px] uppercase tracking-wider text-steel">Staker Pool</p>
                      </div>
                    </div>
                    {pool && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-1 bg-sky-400/10 text-sky-400 border border-sky-400/30">
                        Active
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5">
                  {pool ? (
                    <>
                      {/* Pool Balance */}
                      <div className="mb-5">
                        <p className="text-[10px] uppercase tracking-wider text-steel mb-2">Pool Balance</p>
                        <p className="text-3xl font-display font-bold text-ivory">
                          {(safeToNumber(pool.balance) / LAMPORTS_PER_SOL).toFixed(4)}
                          <span className="text-lg text-steel ml-2">SOL</span>
                        </p>
                      </div>

                      {/* Stats */}
                      <div className="space-y-0 border-t border-slate-light/20 pt-3">
                        <StatRow
                          label="Balance"
                          value={(safeToNumber(pool.balance) / LAMPORTS_PER_SOL).toFixed(4)}
                          subValue="SOL"
                          color="emerald"
                        />
                        <StatRow
                          label="Max Bond"
                          value={(() => {
                            try {
                              const maxBond = pool.maxBond?.toNumber?.() ?? 0;
                              if (maxBond === 0 || maxBond > 1e15) return "Unlimited";
                              return (maxBond / LAMPORTS_PER_SOL).toFixed(4);
                            } catch {
                              return "Unlimited";
                            }
                          })()}
                          subValue={(() => {
                            try {
                              const maxBond = pool.maxBond?.toNumber?.() ?? 0;
                              if (maxBond === 0 || maxBond > 1e15) return "";
                              return "SOL";
                            } catch {
                              return "";
                            }
                          })()}
                          color="gold"
                        />
                        <StatRow
                          label="Linked Subjects"
                          value={safeToNumber((pool as any).subjectCount)}
                          color="parchment"
                        />
                      </div>

                      {/* Actions */}
                      <div className="mt-5 pt-4 border-t border-slate-light/20">
                        {showPoolDeposit ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={poolStakeAmount}
                              onChange={(e) => setPoolStakeAmount(e.target.value)}
                              className="input flex-1 text-sm"
                              placeholder="Amount in SOL"
                            />
                            <button onClick={handlePoolStake} disabled={actionLoading} className="btn btn-success text-xs px-3">
                              {actionLoading ? "..." : "Add"}
                            </button>
                            <button onClick={() => setShowPoolDeposit(false)} className="btn btn-secondary text-xs px-2">
                              ✕
                            </button>
                          </div>
                        ) : showPoolWithdraw ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={poolWithdrawAmount}
                              onChange={(e) => setPoolWithdrawAmount(e.target.value)}
                              className="input flex-1 text-sm"
                              placeholder="Amount in SOL"
                            />
                            <button onClick={handlePoolWithdraw} disabled={actionLoading} className="btn btn-danger text-xs px-3">
                              {actionLoading ? "..." : "Withdraw"}
                            </button>
                            <button onClick={() => setShowPoolWithdraw(false)} className="btn btn-secondary text-xs px-2">
                              ✕
                            </button>
                          </div>
                        ) : showMaxBondEdit ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={maxBondAmount}
                                onChange={(e) => setMaxBondAmount(e.target.value)}
                                className="input flex-1 text-sm"
                                placeholder="Max bond per subject (SOL)"
                              />
                              <button onClick={handleUpdateMaxBond} disabled={actionLoading} className="btn btn-primary text-xs px-3">
                                {actionLoading ? "..." : "Save"}
                              </button>
                              <button onClick={() => { setShowMaxBondEdit(false); setMaxBondAmount(""); }} className="btn btn-secondary text-xs px-2">
                                ✕
                              </button>
                            </div>
                            <p className="text-[10px] text-steel">Leave empty or 0 for unlimited. This limits how much your pool auto-contributes per subject.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <button
                                onClick={() => setShowPoolDeposit(true)}
                                className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium text-emerald bg-emerald-700/10 border border-emerald-700/30 hover:bg-emerald-700/20 transition-colors"
                              >
                                <PlusIcon /> Deposit
                              </button>
                              <button
                                onClick={() => setShowPoolWithdraw(true)}
                                disabled={safeToNumber(pool.balance) === 0}
                                className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium text-crimson bg-red-800/10 border border-red-800/30 hover:bg-red-800/20 transition-colors disabled:opacity-30"
                              >
                                <MinusIcon /> Withdraw
                              </button>
                            </div>
                            <button
                              onClick={() => setShowMaxBondEdit(true)}
                              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-gold bg-gold/10 border border-gold/30 hover:bg-gold/20 transition-colors"
                            >
                              <LockIcon /> Edit Max Bond Limit
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-6">
                      <div className="w-10 h-10 mx-auto mb-4 bg-slate/50 flex items-center justify-center text-steel">
                        <VaultIcon />
                      </div>
                      <p className="text-steel text-sm mb-4">Create a defender pool to back subjects and earn from successful defenses</p>
                      <div className="flex gap-2 justify-center">
                        <input
                          type="text"
                          value={createAmount}
                          onChange={(e) => setCreateAmount(e.target.value)}
                          className="input w-24 text-sm"
                          placeholder="SOL"
                        />
                        <button onClick={handleCreatePool} disabled={actionLoading} className="btn btn-primary text-sm px-4">
                          {actionLoading ? "Creating..." : "Create Pool"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ═══════════════════════════════════════════════════════════════════════════════
                  JUROR CARD
                  ═══════════════════════════════════════════════════════════════════════════════ */}
              <div className="bg-gradient-to-b from-slate/40 to-slate/20 border border-slate-light/50 overflow-hidden">
                {/* Card Header */}
                <div className="px-5 py-4 border-b border-slate-light/30 bg-slate/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gold/10 flex items-center justify-center text-gold">
                        <ScaleIcon />
                      </div>
                      <div>
                        <h3 className="font-display text-lg font-semibold text-ivory">Juror</h3>
                        <p className="text-[10px] uppercase tracking-wider text-steel">Arbitration</p>
                      </div>
                    </div>
                    {jurorAccount && (
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-1 ${
                        safeToNumber(jurorAccount.balance) > 0 || Object.keys(userVotes).length > 0
                          ? "bg-emerald-700/10 text-emerald border border-emerald-700/30"
                          : "bg-steel/10 text-steel border border-steel/30"
                      }`}>
                        {safeToNumber(jurorAccount.balance) > 0 || Object.keys(userVotes).length > 0 ? "Active" : "Inactive"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5">
                  {jurorAccount ? (
                    <>
                      {/* Reputation Gauge */}
                      <div className="flex items-start gap-5 mb-5">
                        <ReputationGauge value={safeToNumber(jurorAccount.reputation)} label="Reputation" />
                        <div className="flex-1 pt-2">
                          <div className="mb-3">
                            <p className="text-[10px] uppercase tracking-wider text-steel mb-1">Balance</p>
                            <p className="text-2xl font-display font-bold text-ivory">
                              {(safeToNumber(jurorAccount.balance) / LAMPORTS_PER_SOL).toFixed(4)}
                              <span className="text-sm text-steel ml-1">SOL</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs ${accuracyRate >= 50 ? "text-emerald" : "text-crimson"}`}>
                              {accuracyRate >= 50 ? <TrendUpIcon /> : <TrendDownIcon />}
                            </span>
                            <span className="text-xs text-steel">
                              {accuracyRate.toFixed(0)}% accuracy
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="space-y-0 border-t border-slate-light/20 pt-3">
                        <StatRow
                          label="Balance"
                          value={(jurorAccount.balance.toNumber() / LAMPORTS_PER_SOL).toFixed(4)}
                          subValue="SOL"
                          color="emerald"
                        />
                      </div>

                      {/* Actions */}
                      <div className="mt-5 pt-4 border-t border-slate-light/20">
                        {showAddStake ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={addStakeAmount}
                              onChange={(e) => setAddStakeAmount(e.target.value)}
                              className="input flex-1 text-sm"
                              placeholder="Amount in SOL"
                            />
                            <button onClick={handleAddJurorStake} disabled={actionLoading} className="btn btn-success text-xs px-3">
                              {actionLoading ? "..." : "Add"}
                            </button>
                            <button onClick={() => setShowAddStake(false)} className="btn btn-secondary text-xs px-2">
                              ✕
                            </button>
                          </div>
                        ) : showWithdraw ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={withdrawAmount}
                              onChange={(e) => setWithdrawAmount(e.target.value)}
                              className="input flex-1 text-sm"
                              placeholder="Amount in SOL"
                            />
                            <button onClick={handleWithdraw} disabled={actionLoading} className="btn btn-danger text-xs px-3">
                              {actionLoading ? "..." : "Withdraw"}
                            </button>
                            <button onClick={() => setShowWithdraw(false)} className="btn btn-secondary text-xs px-2">
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setShowAddStake(true)}
                              className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium text-emerald bg-emerald-700/10 border border-emerald-700/30 hover:bg-emerald-700/20 transition-colors"
                            >
                              <PlusIcon /> Add Stake
                            </button>
                            <button
                              onClick={() => setShowWithdraw(true)}
                              disabled={jurorAccount.balance.toNumber() === 0}
                              className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium text-crimson bg-red-800/10 border border-red-800/30 hover:bg-red-800/20 transition-colors disabled:opacity-30"
                            >
                              <MinusIcon /> Withdraw
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-6">
                      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate/50 flex items-center justify-center text-steel">
                        <ScaleIcon />
                      </div>
                      <p className="text-steel text-sm mb-4">Register as a juror to vote on disputes and earn rewards for correct verdicts</p>
                      <div className="flex gap-2 justify-center">
                        <input
                          type="text"
                          value={registerStake}
                          onChange={(e) => setRegisterStake(e.target.value)}
                          className="input w-24 text-sm"
                          placeholder="SOL"
                        />
                        <button onClick={handleRegister} disabled={actionLoading} className="btn btn-primary text-sm px-4">
                          {actionLoading ? "Registering..." : "Register"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ═══════════════════════════════════════════════════════════════════════════════
                  CHALLENGER CARD
                  ═══════════════════════════════════════════════════════════════════════════════ */}
              <div className="bg-gradient-to-b from-slate/40 to-slate/20 border border-slate-light/50 overflow-hidden">
                {/* Card Header */}
                <div className="px-5 py-4 border-b border-slate-light/30 bg-slate/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-red-800/10 flex items-center justify-center text-crimson">
                        <SwordIcon />
                      </div>
                      <div>
                        <h3 className="font-display text-lg font-semibold text-ivory">Challenger</h3>
                        <p className="text-[10px] uppercase tracking-wider text-steel">Disputes</p>
                      </div>
                    </div>
                    {challengerAccount && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-1 bg-red-800/10 text-crimson border border-red-800/30">
                        Active
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5">
                  {challengerAccount ? (
                    <>
                      {/* Reputation & Success Rate */}
                      <div className="flex items-start gap-5 mb-5">
                        <ReputationGauge value={safeToNumber(challengerAccount.reputation)} label="Reputation" />
                        <div className="flex-1 pt-2">
                          <div className="mb-3">
                            <p className="text-[10px] uppercase tracking-wider text-steel mb-1">Success Rate</p>
                            <p className="text-2xl font-display font-bold text-ivory">
                              {challengerSuccessRate.toFixed(0)}
                              <span className="text-sm text-steel">%</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs ${challengerSuccessRate >= 50 ? "text-emerald" : "text-crimson"}`}>
                              {challengerSuccessRate >= 50 ? <TrendUpIcon /> : <TrendDownIcon />}
                            </span>
                            <span className="text-xs text-steel">
                              {disputesUpheld}/{disputesSubmitted} upheld
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="space-y-0 border-t border-slate-light/20 pt-3">
                        <StatRow
                          label="Balance"
                          value={(safeToNumber(challengerAccount.balance) / LAMPORTS_PER_SOL).toFixed(4)}
                          subValue="SOL"
                          color="parchment"
                        />
                        <StatRow
                          label="Reputation"
                          value={safeToNumber(challengerAccount.reputation)}
                          color="emerald"
                        />
                      </div>

                      {/* Actions */}
                      <div className="mt-5 pt-4 border-t border-slate-light/20">
                        {showChallengerDeposit ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={challengerStakeAmount}
                              onChange={(e) => setChallengerStakeAmount(e.target.value)}
                              className="input flex-1 text-sm"
                              placeholder="Amount in SOL"
                            />
                            <button onClick={handleChallengerDeposit} disabled={actionLoading} className="btn btn-success text-xs px-3">
                              {actionLoading ? "..." : "Add"}
                            </button>
                            <button onClick={() => setShowChallengerDeposit(false)} className="btn btn-secondary text-xs px-2">
                              ✕
                            </button>
                          </div>
                        ) : showChallengerWithdraw ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={challengerWithdrawAmount}
                              onChange={(e) => setChallengerWithdrawAmount(e.target.value)}
                              className="input flex-1 text-sm"
                              placeholder="Amount in SOL"
                            />
                            <button onClick={handleChallengerWithdraw} disabled={actionLoading} className="btn btn-danger text-xs px-3">
                              {actionLoading ? "..." : "Withdraw"}
                            </button>
                            <button onClick={() => setShowChallengerWithdraw(false)} className="btn btn-secondary text-xs px-2">
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setShowChallengerDeposit(true)}
                              className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium text-emerald bg-emerald-700/10 border border-emerald-700/30 hover:bg-emerald-700/20 transition-colors"
                            >
                              <PlusIcon /> Deposit
                            </button>
                            <button
                              onClick={() => setShowChallengerWithdraw(true)}
                              disabled={safeToNumber(challengerAccount.balance) === 0}
                              className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium text-crimson bg-red-800/10 border border-red-800/30 hover:bg-red-800/20 transition-colors disabled:opacity-30"
                            >
                              <MinusIcon /> Withdraw
                            </button>
                          </div>
                        )}
                      </div>

                      {/* CTA */}
                      <div className="mt-3">
                        <Link
                          href="/registry"
                          className="flex items-center justify-center gap-2 w-full py-2 text-xs font-medium text-gold bg-gold/10 border border-gold/30 hover:bg-gold/20 transition-colors"
                        >
                          File New Dispute <ExternalIcon />
                        </Link>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-6">
                      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate/50 flex items-center justify-center text-steel">
                        <SwordIcon />
                      </div>
                      <p className="text-steel text-sm mb-2">No challenger account yet</p>
                      <p className="text-steel/60 text-xs mb-4">Account is created automatically when you file your first dispute</p>
                      <Link
                        href="/registry"
                        className="inline-flex items-center gap-2 text-sm text-gold hover:text-gold-light transition-colors"
                      >
                        Browse Registry <ExternalIcon />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════════════════
                LOCKED STAKE SECTION (Under Juror)
                ═══════════════════════════════════════════════════════════════════════════════ */}
            {jurorAccount && lockedStakeItems.length > 0 && (
              <div className="mb-8 animate-slide-up stagger-3">
                <div className="bg-gradient-to-r from-gold/5 to-transparent border border-gold/20 overflow-hidden">
                  {/* Header */}
                  <div
                    className="px-5 py-4 bg-gold/5 flex items-center justify-between cursor-pointer hover:bg-gold/10 transition-colors"
                    onClick={() => setLockedStakeExpanded(!lockedStakeExpanded)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center text-gold">
                        <LockIcon />
                      </div>
                      <div>
                        <h3 className="font-display text-base font-semibold text-ivory">Locked Stake</h3>
                        <p className="text-[10px] uppercase tracking-wider text-steel">
                          {lockedStakeItems.length} item{lockedStakeItems.length !== 1 ? 's' : ''} · Stake committed to active votes
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xl font-display font-bold text-gold">
                          {(lockedStake / LAMPORTS_PER_SOL).toFixed(4)}
                          <span className="text-sm text-steel ml-1">SOL</span>
                        </p>
                      </div>
                      {lockedStakeItems.some(item =>
                        item.isResolved && Date.now() / 1000 >= item.unlockAt
                      ) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBatchUnlock(lockedStakeItems);
                          }}
                          disabled={actionLoading}
                          className="btn btn-primary text-xs py-1.5 px-4"
                        >
                          {actionLoading ? "Unlocking..." : "Unlock All"}
                        </button>
                      )}
                      <span className="text-gold">
                        <ChevronDownIcon expanded={lockedStakeExpanded} />
                      </span>
                    </div>
                  </div>

                  {/* Breakdown */}
                  {lockedStakeExpanded && (
                    <div className="p-5 border-t border-gold/20">
                      <div className="grid gap-3">
                        {lockedStakeItems.map((item, idx) => {
                          const timeReady = Date.now() / 1000 >= item.unlockAt;
                          const canUnlock = item.isResolved && timeReady;
                          const statusText = !item.isResolved
                            ? "Awaiting resolution"
                            : timeReady
                              ? "Ready to unlock"
                              : formatTimeRemaining(item.unlockAt);
                          const isRestore = item.dispute?.account.isRestore ?? false;
                          const subjectIdStr = item.vote.account.subjectId.toBase58();
                          return (
                            <div
                              key={idx}
                              className={`flex items-center justify-between py-3 px-4 bg-slate/30 border transition-colors ${
                                canUnlock ? 'border-emerald-500/30 hover:border-emerald-500/50' : 'border-slate-light/20 hover:border-gold/30'
                              }`}
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <div className={`w-2 h-2 rounded-full ${canUnlock ? 'bg-emerald' : item.isResolved ? 'bg-gold' : 'bg-amber-500 animate-pulse'}`} />
                                <div>
                                  <p className="text-sm text-parchment">{item.subjectName}</p>
                                  <p className="text-xs text-steel">
                                    {isRestore ? "Restoration" : "Dispute"} R{item.round} · {subjectIdStr.slice(0, 8)}...
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="text-sm font-mono text-gold">
                                    {(item.stakeAmount / LAMPORTS_PER_SOL).toFixed(4)} SOL
                                  </p>
                                  <p className={`text-xs flex items-center gap-1 justify-end ${canUnlock ? 'text-emerald' : 'text-steel'}`}>
                                    <ClockIcon size={10} />
                                    {statusText}
                                  </p>
                                </div>
                                {canUnlock && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUnlockStake(item.vote.account.subjectId, item.round);
                                    }}
                                    disabled={actionLoading}
                                    className="btn btn-primary text-xs py-1.5 px-3"
                                  >
                                    {actionLoading ? "..." : "Unlock"}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-steel mt-4 text-center">
                        Stake unlocks 7 days after dispute resolution.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════════════════
                ACTIVITY SECTIONS
                ═══════════════════════════════════════════════════════════════════════════════ */}

            {/* Active Section */}
            {activeDisputes.length > 0 && (
              <div className="bg-slate/30 border border-slate-light p-5 mb-6 animate-slide-up stagger-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-emerald-700/10 flex items-center justify-center text-emerald">
                    <ActivityIcon />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-sm font-semibold text-ivory uppercase tracking-wider">Active</h2>
                    <p className="text-xs text-steel">Ongoing disputes - voting in progress</p>
                  </div>
                  <span className="text-xs text-emerald bg-emerald-700/10 px-2 py-1 rounded">{activeDisputes.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeDisputes.map((item, i) => (
                    <SubjectCard
                      key={i}
                      subject={item.subject}
                      dispute={item.dispute}
                      subjectContent={subjectContents[item.subject.publicKey.toBase58()]}
                      disputeContent={disputeContents[item.dispute.publicKey.toBase58()]}
                      voteCounts={disputeVoteCounts[item.dispute.publicKey.toBase58()]}
                      onClick={() => handleOpenModal(item)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Pending Action Section */}
            {pendingActionDisputes.length > 0 && (
              <div className="bg-slate/30 border border-gold/30 p-5 mb-6 animate-slide-up stagger-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center text-gold">
                    <ShieldIcon />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-sm font-semibold text-gold uppercase tracking-wider">Pending Action</h2>
                    <p className="text-xs text-steel">Requires your attention: resolve disputes or claim rewards</p>
                  </div>
                  <span className="text-xs text-gold bg-gold/10 px-2 py-1 rounded">{pendingActionDisputes.length}</span>
                  {pendingActionDisputes.some(item => {
                    const isResolved = item.dispute.account.status.resolved;
                    if (!isResolved) return false;
                    // Check if it's a free case (no rewards)
                    const d = item.dispute.account;
                    const totalPool = d.isRestore
                      ? d.restoreStake?.toNumber() || 0
                      : (d.totalBond?.toNumber() || 0) + (d.stakeHeld?.toNumber() || 0) + (d.directStakeHeld?.toNumber() || 0);
                    if (totalPool === 0) return false; // Skip free cases
                    const jurorNeedsClaim = item.vote && !item.vote.account.rewardClaimed;
                    const challengerRecord = challengerRecords[item.dispute.publicKey.toBase58()];
                    const defenderRecord = defenderRecords[item.subject.publicKey.toBase58()];
                    const challengerNeedsClaim = challengerRecord && !challengerRecord.rewardClaimed;
                    const defenderNeedsClaim = defenderRecord && !defenderRecord.rewardClaimed;
                    return jurorNeedsClaim || challengerNeedsClaim || defenderNeedsClaim;
                  }) && (
                    <button
                      onClick={handleBatchClaim}
                      disabled={actionLoading}
                      className="btn btn-primary text-xs py-1.5 px-4"
                    >
                      {actionLoading ? "Claiming..." : "Claim All"}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pendingActionDisputes.map((item, i) => (
                    <SubjectCard
                      key={i}
                      subject={item.subject}
                      dispute={item.dispute}
                      isResolved={"resolved" in item.dispute.account.status}
                      subjectContent={subjectContents[item.subject.publicKey.toBase58()]}
                      disputeContent={disputeContents[item.dispute.publicKey.toBase58()]}
                      voteCounts={disputeVoteCounts[item.dispute.publicKey.toBase58()]}
                      onClick={() => handleOpenModal(item)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Historical Section - PDA-based only */}
            {historicalSubjects.length > 0 && (
              <div className="bg-slate/30 border border-slate-light p-5 mb-6 animate-slide-up stagger-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-slate/30 flex items-center justify-center text-steel">
                    <CheckIcon />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-sm font-semibold text-ivory uppercase tracking-wider">History</h2>
                    <p className="text-xs text-steel">Completed disputes with rewards claimed</p>
                  </div>
                  <span className="text-xs text-steel bg-slate/30 px-2 py-1 rounded">{historicalSubjects.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {historicalSubjects.map((item, i) => (
                    <SubjectCard
                      key={item.subject.publicKey.toBase58()}
                      subject={item.subject}
                      dispute={null}
                      isResolved={true}
                      subjectContent={subjectContents[item.subject.publicKey.toBase58()]}
                      onClick={() => handleOpenModal(item)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty State CTA */}
            {activeDisputes.length === 0 && pendingActionDisputes.length === 0 && historicalSubjects.length === 0 && (jurorAccount || pool) && (
              <div className="tribunal-card-gold p-8 text-center animate-slide-up stagger-4">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gold/10 flex items-center justify-center text-gold">
                  <ScaleIcon />
                </div>
                <p className="text-steel mb-4">
                  No active disputes. Browse subjects in the registry to participate.
                </p>
                <Link href="/registry" className="btn btn-primary">
                  Go to Registry
                </Link>
              </div>
            )}
          </>
        )}
      </main>

      {/* Subject Detail Modal */}
      {selectedItem && (
        <SubjectModal
          subject={selectedItem.subject}
          subjectContent={subjectContents[selectedItem.subject.publicKey.toBase58()]}
          jurorPool={jurorAccount}
          onClose={() => setSelectedItem(null)}
          onVote={handleVote}
          onAddBond={handleAddDefenderStake}
          onJoinChallengers={handleJoinChallengers}
          onResolve={handleResolve}
          onClaimAll={handleClaimAll}
          onCloseRecords={handleCloseRecords}
          onRefresh={loadData}
          actionLoading={actionLoading}
          showActions={true}
          getIpfsUrl={getUrl}
        />
      )}
    </div>
  );
}
