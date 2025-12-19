"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Navigation } from "@/components/Navigation";
import { useTribunalcraft } from "@/hooks/useTribunalcraft";
import { useContentFetch } from "@/hooks/useUpload";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import Link from "next/link";
import type { SubjectContent, DisputeContent } from "@/lib/content-types";
import { SubjectCard, SubjectModal, SubjectData, DisputeData, VoteData } from "@/components/subject";
import { ShieldIcon, CheckIcon, LockIcon, PlusIcon, MinusIcon, ClockIcon, ChevronDownIcon } from "@/components/Icons";

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
    <div className="h-1.5 w-full bg-slate-light/30 rounded-full overflow-hidden">
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
    fetchJurorAccount,
    fetchAllDisputes,
    fetchAllSubjects,
    fetchVoteRecord,
    fetchVotesByDispute,
    fetchChallengersByDispute,
    getJurorPDA,
    getVoteRecordPDA,
    getChallengerRecordPDA,
    getDefenderRecordPDA,
    fetchChallengerRecord,
    fetchDefenderRecord,
    voteOnDispute,
    voteOnRestore,
    addToVote,
    resolveDispute,
    batchClaimRewards,
    addToStake,
    addToDispute,
    fetchDefenderPool,
    getDefenderPoolPDA,
    getChallengerPDA,
    fetchChallengerAccount,
    createPool,
    stakePool,
    withdrawPool,
    unlockJurorStake,
    batchUnlockStake,
  } = useTribunalcraft();

  const { fetchSubject: fetchSubjectContent, fetchDispute: fetchDisputeContent, getUrl } = useContentFetch();

  const [jurorAccount, setJurorAccount] = useState<any>(null);
  const [pool, setPool] = useState<any>(null);
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [disputes, setDisputes] = useState<DisputeData[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, VoteData>>({});
  const [subjectContents, setSubjectContents] = useState<Record<string, SubjectContent | null>>({});
  const [disputeContents, setDisputeContents] = useState<Record<string, DisputeContent | null>>({});
  const [disputeCids, setDisputeCids] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Selected item state (vote can be null for defender-only items)
  const [selectedItem, setSelectedItem] = useState<{ subject: SubjectData; dispute: DisputeData; vote: VoteData | null; roles?: { juror: boolean; defender: boolean; challenger: boolean } } | null>(null);
  const [disputeVoteCounts, setDisputeVoteCounts] = useState<Record<string, { favor: number; against: number }>>({});
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
  const [copied, setCopied] = useState(false);

  // Expand/collapse state
  const [lockedStakeExpanded, setLockedStakeExpanded] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all data
      const [subjectsData, disputesData] = await Promise.all([
        fetchAllSubjects(),
        fetchAllDisputes(),
      ]);
      setSubjects(subjectsData || []);
      setDisputes(disputesData || []);

      // Fetch content for subjects
      for (const s of subjectsData) {
        const key = s.publicKey.toBase58();
        if (!subjectContents[key]) {
          fetchSubjectContent(s.account.detailsCid).then(content => {
            if (content) setSubjectContents(prev => ({ ...prev, [key]: content }));
          });
        }
      }

      // Fetch dispute CIDs
      for (const d of disputesData) {
        const disputeKey = d.publicKey.toBase58();
        if (!disputeCids[disputeKey]) {
          fetchChallengersByDispute(d.publicKey).then(challengers => {
            if (challengers && challengers.length > 0) {
              const cid = challengers[0].account.detailsCid;
              setDisputeCids(prev => ({ ...prev, [disputeKey]: cid }));
              fetchDisputeContent(cid).then(content => {
                if (content) setDisputeContents(prev => ({ ...prev, [disputeKey]: content }));
              });
            }
          });
        }
      }

      // Fetch juror account and vote records if connected
      if (publicKey) {
        // Fetch defender pool
        const [poolPda] = getDefenderPoolPDA(publicKey);
        let poolData = null;
        try {
          poolData = await fetchDefenderPool(poolPda);
          setPool(poolData);
        } catch {
          setPool(null);
        }

        // Fetch challenger account
        const [challengerPda] = getChallengerPDA(publicKey);
        try {
          const challengerData = await fetchChallengerAccount(challengerPda);
          setChallengerAccount(challengerData);
        } catch {
          setChallengerAccount(null);
        }

        // Find subjects linked to user's defender pool
        const defendedSubjects = poolData
          ? subjectsData.filter((s: SubjectData) => s.account.defenderPool.toBase58() === poolPda.toBase58())
          : [];

        // Find disputes on defended subjects
        const defendedDisputeKeys: string[] = [];
        for (const subject of defendedSubjects) {
          const subjectDisputes = disputesData.filter(
            (d: DisputeData) => d.account.subject.toBase58() === subject.publicKey.toBase58()
          );
          for (const d of subjectDisputes) {
            defendedDisputeKeys.push(d.publicKey.toBase58());
          }
        }

        const [jurorPda] = getJurorPDA(publicKey);
        try {
          const jurorData = await fetchJurorAccount(jurorPda);
          setJurorAccount(jurorData);

          // Fetch vote records for all disputes
          const votes: Record<string, VoteData> = {};
          const votedDisputeKeys: string[] = [];
          for (const d of disputesData) {
            const [voteRecordPda] = getVoteRecordPDA(d.publicKey, publicKey);
            try {
              const voteRecord = await fetchVoteRecord(voteRecordPda);
              if (voteRecord) {
                votes[d.publicKey.toBase58()] = {
                  publicKey: voteRecordPda,
                  account: voteRecord,
                };
                votedDisputeKeys.push(d.publicKey.toBase58());
              }
            } catch {}
          }
          setUserVotes(votes);

          // Fetch vote counts for disputes user has voted on OR defended
          const allRelevantDisputeKeys = [...new Set([...votedDisputeKeys, ...defendedDisputeKeys])];
          const counts: Record<string, { favor: number; against: number }> = {};
          for (const dKey of allRelevantDisputeKeys) {
            const d = disputesData.find((x: DisputeData) => x.publicKey.toBase58() === dKey);
            if (!d) continue;
            try {
              const allVotes = await fetchVotesByDispute(d.publicKey);
              if (allVotes) {
                let favor = 0;
                let against = 0;
                for (const v of allVotes) {
                  if (d.account.isRestore) {
                    if ("forRestoration" in v.account.restoreChoice) favor++;
                    else if ("againstRestoration" in v.account.restoreChoice) against++;
                  } else {
                    if ("forChallenger" in v.account.choice) favor++;
                    else if ("forDefender" in v.account.choice) against++;
                  }
                }
                counts[dKey] = { favor, against };
              }
            } catch {}
          }
          setDisputeVoteCounts(counts);

          // Fetch challenger/defender records for all relevant disputes (voted or defended)
          const challRecords: Record<string, any> = {};
          const defRecords: Record<string, any> = {};
          for (const dKey of allRelevantDisputeKeys) {
            const d = disputesData.find((x: DisputeData) => x.publicKey.toBase58() === dKey);
            if (!d) continue;
            const subject = subjectsData.find((s: SubjectData) => s.publicKey.toBase58() === d.account.subject.toBase58());
            if (!subject) continue;

            // Check challenger record
            const [challengerRecordPda] = getChallengerRecordPDA(d.publicKey, publicKey);
            try {
              const record = await fetchChallengerRecord(challengerRecordPda);
              if (record) challRecords[dKey] = record;
            } catch {}

            // Check defender record (for both resolved and pending - to track involvement)
            const [defenderRecordPda] = getDefenderRecordPDA(subject.publicKey, publicKey);
            try {
              const record = await fetchDefenderRecord(defenderRecordPda);
              if (record) defRecords[subject.publicKey.toBase58()] = record;
            } catch {}
          }
          setChallengerRecords(challRecords);
          setDefenderRecords(defRecords);
        } catch {
          setJurorAccount(null);
          setUserVotes({});
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    }
    setLoading(false);
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
        const [challengerRecordPda] = getChallengerRecordPDA(dispute.publicKey, publicKey);
        try {
          const record = await fetchChallengerRecord(challengerRecordPda);
          if (record) setChallengerRecords(prev => ({ ...prev, [dispute.publicKey.toBase58()]: record }));
        } catch {}

        const [defenderRecordPda] = getDefenderRecordPDA(subject.publicKey, publicKey);
        try {
          const record = await fetchDefenderRecord(defenderRecordPda);
          if (record) setDefenderRecords(prev => ({ ...prev, [subjectKey]: record }));
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
      await createPool(amount);
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
      await stakePool(amount);
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
      await withdrawPool(amount);
      setSuccess("Withdrawal from pool successful");
      setShowPoolWithdraw(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to withdraw from pool");
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

  // Handlers for dispute actions
  const handleVote = useCallback(async (disputeKey: string, stakeAmount: string, choice: "forChallenger" | "forDefender" | "forRestoration" | "againstRestoration", rationale: string) => {
    if (!publicKey || !jurorAccount) return;
    setActionLoading(true);
    setError(null);
    try {
      const disputePubkey = new PublicKey(disputeKey);
      const stake = new BN(parseFloat(stakeAmount) * LAMPORTS_PER_SOL);
      const hasExistingVote = userVotes[disputeKey];
      const isRestore = choice === "forRestoration" || choice === "againstRestoration";

      if (hasExistingVote) {
        await addToVote(disputePubkey, stake);
        setSuccess(`Added ${stakeAmount} SOL to vote`);
      } else if (isRestore) {
        const restoreChoice = { [choice]: {} } as any;
        await voteOnRestore(disputePubkey, restoreChoice, stake, rationale);
        setSuccess("Vote cast on restoration request");
      } else {
        const voteChoice = { [choice]: {} } as any;
        await voteOnDispute(disputePubkey, voteChoice, stake, rationale);
        setSuccess("Vote cast");
      }
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to vote");
    }
    setActionLoading(false);
  }, [publicKey, jurorAccount, userVotes, addToVote, voteOnDispute, voteOnRestore, loadData]);

  const handleResolve = useCallback(async (disputeKey: string) => {
    if (!publicKey || !selectedItem) return;
    setActionLoading(true);
    setError(null);
    try {
      const disputePubkey = new PublicKey(disputeKey);
      await resolveDispute(disputePubkey, selectedItem.subject.publicKey);
      setSuccess("Dispute resolved");
      setSelectedItem(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to resolve");
    }
    setActionLoading(false);
  }, [publicKey, selectedItem, resolveDispute, loadData]);

  const handleClaimAll = useCallback(async (disputeKey: string, claims: { juror: boolean; challenger: boolean; defender: boolean }) => {
    console.log("[ClaimAll] Called with:", { disputeKey, claims, hasPublicKey: !!publicKey, hasSelectedItem: !!selectedItem });
    if (!publicKey || !selectedItem) {
      console.log("[ClaimAll] Early return - missing publicKey or selectedItem");
      return;
    }
    setActionLoading(true);
    setError(null);
    const claimedRewards: string[] = [];
    try {
      const disputePubkey = new PublicKey(disputeKey);
      const subjectPubkey = selectedItem.subject.publicKey;
      console.log("[ClaimAll] Dispute:", disputePubkey.toBase58(), "Subject:", subjectPubkey.toBase58());

      // Build batch claim params
      const batchParams: {
        jurorClaims?: Array<{ dispute: PublicKey; subject: PublicKey; voteRecord: PublicKey }>;
        challengerClaims?: Array<{ dispute: PublicKey; subject: PublicKey; challengerRecord: PublicKey }>;
        defenderClaims?: Array<{ dispute: PublicKey; subject: PublicKey; defenderRecord: PublicKey }>;
      } = {};

      if (claims.juror) {
        const [voteRecordPda] = getVoteRecordPDA(disputePubkey, publicKey);
        batchParams.jurorClaims = [{ dispute: disputePubkey, subject: subjectPubkey, voteRecord: voteRecordPda }];
        claimedRewards.push("Juror");
        console.log("[ClaimAll] Added juror claim, voteRecord:", voteRecordPda.toBase58());
      }

      if (claims.challenger) {
        const [challengerRecordPda] = getChallengerRecordPDA(disputePubkey, publicKey);
        batchParams.challengerClaims = [{ dispute: disputePubkey, subject: subjectPubkey, challengerRecord: challengerRecordPda }];
        claimedRewards.push("Challenger");
        console.log("[ClaimAll] Added challenger claim, challengerRecord:", challengerRecordPda.toBase58());
      }

      if (claims.defender) {
        const [defenderRecordPda] = getDefenderRecordPDA(subjectPubkey, publicKey);
        batchParams.defenderClaims = [{ dispute: disputePubkey, subject: subjectPubkey, defenderRecord: defenderRecordPda }];
        claimedRewards.push("Defender");
        console.log("[ClaimAll] Added defender claim, defenderRecord:", defenderRecordPda.toBase58());
      }

      console.log("[ClaimAll] Batch params:", {
        jurorClaims: batchParams.jurorClaims?.length || 0,
        challengerClaims: batchParams.challengerClaims?.length || 0,
        defenderClaims: batchParams.defenderClaims?.length || 0,
      });

      // Process all claims in a single transaction
      await batchClaimRewards(batchParams);

      console.log("[ClaimAll] Success!");
      setSuccess(`${claimedRewards.join(", ")} reward${claimedRewards.length > 1 ? "s" : ""} claimed!`);
      await loadData();
    } catch (err: any) {
      console.error("[ClaimAll] Error:", err);
      setError(err.message || "Failed to claim rewards");
    }
    setActionLoading(false);
  }, [publicKey, selectedItem, getVoteRecordPDA, getChallengerRecordPDA, getDefenderRecordPDA, batchClaimRewards, loadData]);

  const handleAddDefenderStake = useCallback(async (amount: string) => {
    if (!publicKey || !selectedItem) return;
    setActionLoading(true);
    setError(null);
    try {
      const stake = new BN(parseFloat(amount) * LAMPORTS_PER_SOL);
      await addToStake(selectedItem.subject.publicKey, stake);
      setSuccess(`Added ${amount} SOL stake`);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to add stake");
    }
    setActionLoading(false);
  }, [publicKey, selectedItem, addToStake, loadData]);

  const handleJoinChallengers = useCallback(async (disputeKey: string, amount: string) => {
    if (!publicKey || !selectedItem) return;
    setActionLoading(true);
    setError(null);
    try {
      const subject = selectedItem.subject;
      const bond = new BN(parseFloat(amount) * LAMPORTS_PER_SOL);
      const disputePubkey = new PublicKey(disputeKey);
      const defenderPool = subject.account.defenderPool.equals(PublicKey.default) ? null : subject.account.defenderPool;

      // Get pool owner if subject is linked
      let poolOwner: PublicKey | null = null;
      if (defenderPool) {
        const defenderPoolData = await fetchDefenderPool(defenderPool);
        if (defenderPoolData) {
          poolOwner = defenderPoolData.owner;
        }
      }

      await addToDispute(subject.publicKey, disputePubkey, defenderPool, poolOwner, "", bond);
      setSuccess(`Added ${amount} SOL bond`);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to join challengers");
    }
    setActionLoading(false);
  }, [publicKey, selectedItem, addToDispute, loadData, fetchDefenderPool]);

  const handleUnlockStake = useCallback(async (disputePubkey: PublicKey, voteRecordPubkey: PublicKey) => {
    if (!publicKey) return;
    setActionLoading(true);
    setError(null);
    try {
      await unlockJurorStake(disputePubkey, voteRecordPubkey);
      setSuccess("Stake unlocked successfully!");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to unlock stake");
    }
    setActionLoading(false);
  }, [publicKey, unlockJurorStake, loadData]);

  const handleBatchUnlock = useCallback(async () => {
    if (!publicKey) return;
    // Find votes that haven't had stake unlocked yet
    const votedDisputeKeys = Object.keys(userVotes);
    const readyItems: Array<{ dispute: DisputeData; vote: VoteData; unlockAt: number }> = [];

    for (const key of votedDisputeKeys) {
      const vote = userVotes[key];
      if (!vote || vote.account.stakeUnlocked) continue;

      const dispute = disputes.find(d => d.publicKey.toBase58() === key);
      if (!dispute) continue;

      const unlockAt = vote.account.unlockAt?.toNumber?.() ||
        (dispute.account.votingEndsAt.toNumber() + 604800);

      if (Date.now() / 1000 >= unlockAt) {
        readyItems.push({ dispute, vote, unlockAt });
      }
    }

    if (readyItems.length === 0) {
      setError("No stakes ready to unlock");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const unlocks = readyItems.map(item => ({
        dispute: item.dispute.publicKey,
        voteRecord: item.vote.publicKey,
      }));
      await batchUnlockStake(unlocks);
      setSuccess(`Unlocked ${readyItems.length} stake${readyItems.length > 1 ? 's' : ''} successfully!`);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to batch unlock stakes");
    }
    setActionLoading(false);
  }, [publicKey, userVotes, disputes, batchUnlockStake, loadData]);

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

  // Calculate locked stake
  const lockedStake = jurorAccount
    ? jurorAccount.totalStake.toNumber() - jurorAccount.availableStake.toNumber()
    : 0;

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
      const subject = subjects.find(s => s.publicKey.toBase58() === dispute.account.subject.toBase58());
      if (!subject) return null;
      const vote = userVotes[key];
      // Check all roles
      const isDefender = poolPda && subject.account.defenderPool.toBase58() === poolPda.toBase58();
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

    // Find subjects linked to user's defender pool
    if (pool && poolPda) {
      const defendedSubjects = subjects.filter(
        s => s.account.defenderPool.toBase58() === poolPda.toBase58()
      );

      for (const subject of defendedSubjects) {
        const subjectDisputes = disputes.filter(
          d => d.account.subject.toBase58() === subject.publicKey.toBase58()
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

    // Find disputes where user is challenger (not already added)
    for (const disputeKey of Object.keys(challengerRecords)) {
      if (votedDisputeKeys.has(disputeKey)) continue;
      if (addedDisputes.has(disputeKey)) continue;

      const dispute = disputes.find(d => d.publicKey.toBase58() === disputeKey);
      if (!dispute) continue;
      const subject = subjects.find(s => s.publicKey.toBase58() === dispute.account.subject.toBase58());
      if (!subject) continue;

      const isDefender = poolPda && subject.account.defenderPool.toBase58() === poolPda.toBase58();
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
  const getLockedStakeItems = () => {
    return votedDisputes
      .filter(item => {
        // Include any vote where stake is not yet unlocked
        return item.vote && !item.vote.account.stakeUnlocked;
      })
      .map(item => {
        const stakeAmount = item.vote!.account.stakeAllocated.toNumber();
        // Use unlockAt from vote record if available, otherwise calculate from voting end
        const unlockAt = item.vote!.account.unlockAt?.toNumber?.() ||
          (item.dispute.account.votingEndsAt.toNumber() + 604800);
        const subjectContent = subjectContents[item.subject.publicKey.toBase58()];
        return {
          ...item,
          stakeAmount,
          unlockAt,
          subjectName: subjectContent?.title || `Subject ${item.subject.publicKey.toBase58().slice(0, 8)}...`
        };
      });
  };

  const lockedStakeItems = getLockedStakeItems();

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

  // Batch claim handler - claims all pending rewards across all disputes
  const handleBatchClaim = useCallback(async () => {
    console.log("[BatchClaim] Called, publicKey:", publicKey?.toBase58());
    console.log("[BatchClaim] allUserDisputes count:", allUserDisputes.length);
    console.log("[BatchClaim] challengerRecords:", Object.keys(challengerRecords));
    console.log("[BatchClaim] defenderRecords:", Object.keys(defenderRecords));

    if (!publicKey) {
      console.log("[BatchClaim] Early return - no publicKey");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      // Helper to check if dispute has rewards (not a free case)
      const hasRewards = (item: typeof allUserDisputes[0]) => {
        const d = item.dispute.account;
        const totalPool = d.isRestore
          ? d.restoreStake?.toNumber() || 0
          : (d.totalBond?.toNumber() || 0) + (d.stakeHeld?.toNumber() || 0) + (d.directStakeHeld?.toNumber() || 0);
        return totalPool > 0;
      };

      // Find claimable juror rewards (resolved disputes with votes not claimed, excluding free cases)
      const claimableJurorDisputes = allUserDisputes.filter(item => {
        const isResolved = item.dispute.account.status.resolved;
        const hasVote = !!item.vote;
        const notClaimed = item.vote && !item.vote.account.rewardClaimed;
        const notFree = hasRewards(item);
        console.log("[BatchClaim] Juror check:", item.dispute.publicKey.toBase58().slice(0,8), { isResolved, hasVote, notClaimed, notFree });
        return hasVote && isResolved && notClaimed && notFree;
      });

      // Find claimable challenger rewards (excluding free cases)
      const claimableChallengerDisputes = allUserDisputes.filter(item => {
        const challengerRecord = challengerRecords[item.dispute.publicKey.toBase58()];
        const isResolved = item.dispute.account.status.resolved;
        const hasRecord = !!challengerRecord;
        const notClaimed = challengerRecord && !challengerRecord.rewardClaimed;
        const notFree = hasRewards(item);
        console.log("[BatchClaim] Challenger check:", item.dispute.publicKey.toBase58().slice(0,8), { isResolved, hasRecord, notClaimed, notFree });
        return hasRecord && isResolved && notClaimed && notFree;
      });

      // Find claimable defender rewards (excluding free cases)
      const claimableDefenderDisputes = allUserDisputes.filter(item => {
        const defenderRecord = defenderRecords[item.subject.publicKey.toBase58()];
        const isResolved = item.dispute.account.status.resolved;
        const hasRecord = !!defenderRecord;
        const notClaimed = defenderRecord && !defenderRecord.rewardClaimed;
        const notFree = hasRewards(item);
        console.log("[BatchClaim] Defender check:", item.subject.publicKey.toBase58().slice(0,8), { isResolved, hasRecord, notClaimed, notFree });
        return hasRecord && isResolved && notClaimed && notFree;
      });

      const totalClaims = claimableJurorDisputes.length + claimableChallengerDisputes.length + claimableDefenderDisputes.length;
      console.log("[BatchClaim] Claimable counts:", {
        juror: claimableJurorDisputes.length,
        challenger: claimableChallengerDisputes.length,
        defender: claimableDefenderDisputes.length,
        total: totalClaims,
      });

      if (totalClaims === 0) {
        setError("No rewards to claim");
        setActionLoading(false);
        return;
      }

      // Build batch claim params
      const batchParams: {
        jurorClaims?: { dispute: PublicKey; subject: PublicKey; voteRecord: PublicKey }[];
        challengerClaims?: { dispute: PublicKey; subject: PublicKey; challengerRecord: PublicKey }[];
        defenderClaims?: { dispute: PublicKey; subject: PublicKey; defenderRecord: PublicKey }[];
      } = {};

      if (claimableJurorDisputes.length > 0) {
        batchParams.jurorClaims = claimableJurorDisputes.map(item => {
          const [voteRecordPda] = getVoteRecordPDA(item.dispute.publicKey, publicKey);
          console.log("[BatchClaim] Juror claim:", item.dispute.publicKey.toBase58().slice(0,8), "voteRecord:", voteRecordPda.toBase58().slice(0,8));
          return {
            dispute: item.dispute.publicKey,
            subject: item.subject.publicKey,
            voteRecord: voteRecordPda,
          };
        });
      }

      if (claimableChallengerDisputes.length > 0) {
        batchParams.challengerClaims = claimableChallengerDisputes.map(item => {
          const [challengerRecordPda] = getChallengerRecordPDA(item.dispute.publicKey, publicKey);
          console.log("[BatchClaim] Challenger claim:", item.dispute.publicKey.toBase58().slice(0,8), "challengerRecord:", challengerRecordPda.toBase58().slice(0,8));
          return {
            dispute: item.dispute.publicKey,
            subject: item.subject.publicKey,
            challengerRecord: challengerRecordPda,
          };
        });
      }

      if (claimableDefenderDisputes.length > 0) {
        batchParams.defenderClaims = claimableDefenderDisputes.map(item => {
          const [defenderRecordPda] = getDefenderRecordPDA(item.subject.publicKey, publicKey);
          console.log("[BatchClaim] Defender claim:", item.subject.publicKey.toBase58().slice(0,8), "defenderRecord:", defenderRecordPda.toBase58().slice(0,8));
          return {
            dispute: item.dispute.publicKey,
            subject: item.subject.publicKey,
            defenderRecord: defenderRecordPda,
          };
        });
      }

      console.log("[BatchClaim] Sending batchClaimRewards with:", {
        jurorClaims: batchParams.jurorClaims?.length || 0,
        challengerClaims: batchParams.challengerClaims?.length || 0,
        defenderClaims: batchParams.defenderClaims?.length || 0,
      });

      await batchClaimRewards(batchParams);
      console.log("[BatchClaim] Success!");

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
  }, [publicKey, allUserDisputes, challengerRecords, defenderRecords, getVoteRecordPDA, getChallengerRecordPDA, getDefenderRecordPDA, batchClaimRewards, loadData]);

  // Past disputes helper
  const getPastDisputes = (subjectKey: string, currentDisputeKey?: string) => {
    return disputes.filter(d =>
      d.account.subject.toBase58() === subjectKey &&
      d.account.status.resolved &&
      d.publicKey.toBase58() !== currentDisputeKey
    );
  };

  // Get current active dispute for a subject (pending and voting not ended)
  const getCurrentActiveDispute = (subjectKey: string): DisputeData | null => {
    return disputes.find(d =>
      d.account.subject.toBase58() === subjectKey &&
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
      const isDefender = poolPda && item.subject.account.defenderPool.toBase58() === poolPda.toBase58();
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

  // Calculate accuracy rate
  const accuracyRate = jurorAccount && jurorAccount.votesCast.toNumber() > 0
    ? (jurorAccount.correctVotes.toNumber() / jurorAccount.votesCast.toNumber()) * 100
    : 0;

  // Calculate challenger success rate
  const challengerSuccessRate = challengerAccount && challengerAccount.disputesSubmitted.toNumber() > 0
    ? (challengerAccount.disputesUpheld.toNumber() / challengerAccount.disputesSubmitted.toNumber()) * 100
    : 0;

  // Calculate defender utilization
  const defenderUtilization = pool && pool.totalStake.toNumber() > 0
    ? (pool.held.toNumber() / pool.totalStake.toNumber()) * 100
    : 0;

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-obsidian">
      <Navigation />

      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-10 animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-[1px] bg-gradient-to-r from-gold to-transparent" />
            <span className="text-xs uppercase tracking-[0.2em] text-gold font-medium">Dashboard</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-ivory mb-3">
            Profile
          </h1>
          <p className="text-steel text-lg">
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
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold/20 to-gold/5 flex items-center justify-center text-gold">
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
                          {(pool.totalStake.toNumber() / LAMPORTS_PER_SOL).toFixed(4)}
                          <span className="text-lg text-steel ml-2">SOL</span>
                        </p>
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-steel mb-1">
                            <span>Utilization</span>
                            <span className="text-sky-400">{defenderUtilization.toFixed(1)}%</span>
                          </div>
                          <ProgressBar value={pool.held.toNumber()} max={pool.totalStake.toNumber()} color="sky" />
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="space-y-0 border-t border-slate-light/20 pt-3">
                        <StatRow
                          label="Available"
                          value={(pool.available.toNumber() / LAMPORTS_PER_SOL).toFixed(4)}
                          subValue="SOL"
                          color="emerald"
                        />
                        <StatRow
                          label="Held in Disputes"
                          value={(pool.held.toNumber() / LAMPORTS_PER_SOL).toFixed(4)}
                          subValue="SOL"
                          color="gold"
                        />
                        <StatRow
                          label="Linked Subjects"
                          value={pool.subjectCount}
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
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setShowPoolDeposit(true)}
                              className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium text-emerald bg-emerald-700/10 border border-emerald-700/30 hover:bg-emerald-700/20 transition-colors"
                            >
                              <PlusIcon /> Deposit
                            </button>
                            <button
                              onClick={() => setShowPoolWithdraw(true)}
                              disabled={pool.available.toNumber() === 0}
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
                      <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center text-gold">
                        <ScaleIcon />
                      </div>
                      <div>
                        <h3 className="font-display text-lg font-semibold text-ivory">Juror</h3>
                        <p className="text-[10px] uppercase tracking-wider text-steel">Arbitration</p>
                      </div>
                    </div>
                    {jurorAccount && (
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-1 ${
                        jurorAccount.isActive
                          ? "bg-emerald-700/10 text-emerald border border-emerald-700/30"
                          : "bg-steel/10 text-steel border border-steel/30"
                      }`}>
                        {jurorAccount.isActive ? "Active" : "Inactive"}
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
                        <ReputationGauge value={jurorAccount.reputation} label="Reputation" />
                        <div className="flex-1 pt-2">
                          <div className="mb-3">
                            <p className="text-[10px] uppercase tracking-wider text-steel mb-1">Total Stake</p>
                            <p className="text-2xl font-display font-bold text-ivory">
                              {(jurorAccount.totalStake.toNumber() / LAMPORTS_PER_SOL).toFixed(4)}
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
                          label="Available Stake"
                          value={(jurorAccount.availableStake.toNumber() / LAMPORTS_PER_SOL).toFixed(4)}
                          subValue="SOL"
                          color="emerald"
                        />
                        <StatRow
                          label="Locked Stake"
                          value={(lockedStake / LAMPORTS_PER_SOL).toFixed(4)}
                          subValue="SOL"
                          color="gold"
                        />
                        <StatRow
                          label="Votes Cast"
                          value={jurorAccount.votesCast.toNumber()}
                          color="parchment"
                        />
                        <StatRow
                          label="Correct Votes"
                          value={jurorAccount.correctVotes.toNumber()}
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
                              disabled={jurorAccount.availableStake.toNumber() === 0}
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
                      <div className="w-9 h-9 rounded-lg bg-red-800/10 border border-red-800/30 flex items-center justify-center text-crimson">
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
                        <ReputationGauge value={challengerAccount.reputation} label="Reputation" />
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
                              {challengerAccount.disputesUpheld.toNumber()}/{challengerAccount.disputesSubmitted.toNumber()} upheld
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="space-y-0 border-t border-slate-light/20 pt-3">
                        <StatRow
                          label="Disputes Filed"
                          value={challengerAccount.disputesSubmitted.toNumber()}
                          color="parchment"
                        />
                        <StatRow
                          label="Upheld"
                          value={challengerAccount.disputesUpheld.toNumber()}
                          color="emerald"
                          trend={challengerAccount.disputesUpheld.toNumber() > 0 ? "up" : undefined}
                        />
                        <StatRow
                          label="Dismissed"
                          value={challengerAccount.disputesDismissed.toNumber()}
                          color="crimson"
                        />
                        <StatRow
                          label="Pending"
                          value={challengerAccount.disputesSubmitted.toNumber() - challengerAccount.disputesUpheld.toNumber() - challengerAccount.disputesDismissed.toNumber()}
                          color="gold"
                        />
                      </div>

                      {/* CTA */}
                      <div className="mt-5 pt-4 border-t border-slate-light/20">
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
                      {lockedStakeItems.some(item => Date.now() / 1000 >= item.unlockAt) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBatchUnlock();
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
                          const isReady = Date.now() / 1000 >= item.unlockAt;
                          return (
                            <div
                              key={idx}
                              className={`flex items-center justify-between py-3 px-4 bg-slate/30 border transition-colors ${
                                isReady ? 'border-emerald-500/30 hover:border-emerald-500/50' : 'border-slate-light/20 hover:border-gold/30'
                              }`}
                            >
                              <div
                                className="flex items-center gap-3 flex-1 cursor-pointer"
                                onClick={() => setSelectedItem(item)}
                              >
                                <div className={`w-2 h-2 rounded-full ${isReady ? 'bg-emerald' : 'bg-gold animate-pulse'}`} />
                                <div>
                                  <p className="text-sm text-parchment">{item.subjectName}</p>
                                  <p className="text-xs text-steel">
                                    {item.dispute.account.isRestore ? "Restoration" : "Dispute"} #{item.dispute.account.disputeIndex + 1}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="text-sm font-mono text-gold">
                                    {(item.stakeAmount / LAMPORTS_PER_SOL).toFixed(4)} SOL
                                  </p>
                                  <p className={`text-xs flex items-center gap-1 justify-end ${isReady ? 'text-emerald' : 'text-steel'}`}>
                                    <ClockIcon size={10} />
                                    {isReady ? 'Ready to unlock' : `Unlocks: ${formatTimeRemaining(item.unlockAt)}`}
                                  </p>
                                </div>
                                {isReady && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUnlockStake(item.dispute.publicKey, item.vote!.publicKey);
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
                        Stake unlocks 7 days after voting ends. Click an item to view details.
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

            {/* Historical Section */}
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
          jurorAccount={jurorAccount}
          onClose={() => setSelectedItem(null)}
          onVote={handleVote}
          onAddStake={handleAddDefenderStake}
          onJoinChallengers={handleJoinChallengers}
          onResolve={handleResolve}
          onClaimAll={handleClaimAll}
          onRefresh={loadData}
          actionLoading={actionLoading}
          showActions={true}
          getIpfsUrl={getUrl}
        />
      )}
    </div>
  );
}
