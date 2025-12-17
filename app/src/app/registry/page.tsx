"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Navigation } from "@/components/Navigation";
import { useTribunalcraft } from "@/hooks/useTribunalcraft";
import { useUpload, useContentFetch } from "@/hooks/useUpload";
import { PublicKey, LAMPORTS_PER_SOL, Keypair } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import Link from "next/link";
import type { DisputeType, VoteChoice } from "@/idl/types";
import type { SubjectContent, DisputeContent } from "@/lib/content-types";

const DISPUTE_TYPES = [
  { key: "other", label: "Other", contentKey: "other" },
  { key: "breach", label: "Breach", contentKey: "breach" },
  { key: "fraud", label: "Fraud", contentKey: "fraud" },
  { key: "qualityDispute", label: "Quality", contentKey: "quality" },
  { key: "nonDelivery", label: "Non-Delivery", contentKey: "non_delivery" },
  { key: "misrepresentation", label: "Misrepresentation", contentKey: "fraud" },
  { key: "policyViolation", label: "Policy Violation", contentKey: "breach" },
  { key: "damagesClaim", label: "Damages", contentKey: "other" },
] as const;

const SUBJECT_CATEGORIES = [
  { key: "contract", label: "Contract" },
  { key: "claim", label: "Claim" },
  { key: "deliverable", label: "Deliverable" },
  { key: "service", label: "Service" },
  { key: "listing", label: "Listing" },
  { key: "proposal", label: "Proposal" },
  { key: "other", label: "Other" },
] as const;

const getStatusBadge = (status: any) => {
  if (status.active) return { label: "Active", class: "bg-emerald/20 text-emerald" };
  if (status.disputed) return { label: "Disputed", class: "bg-gold/20 text-gold" };
  if (status.validated) return { label: "Validated", class: "bg-steel/20 text-steel" };
  if (status.invalidated) return { label: "Invalidated", class: "bg-crimson/20 text-crimson" };
  return { label: "Unknown", class: "bg-steel/20 text-steel" };
};

const getOutcomeLabel = (outcome: any) => {
  if (outcome.none) return { label: "Voting", class: "text-gold" };
  if (outcome.upheld) return { label: "Upheld", class: "text-emerald" };
  if (outcome.dismissed) return { label: "Dismissed", class: "text-crimson" };
  if (outcome.noParticipation) return { label: "No Quorum", class: "text-steel" };
  return { label: "Unknown", class: "text-steel" };
};

const getDisputeTypeLabel = (dt: any) => {
  const found = DISPUTE_TYPES.find((t) => dt[t.key]);
  return found ? found.label : "Unknown";
};

// Icons
const FileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const GavelIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M14.5 5.5L18.5 9.5M6 14l4-4m-2.5 6.5l-3 3m11.5-11.5l3-3M9.5 6.5l8 8" />
    <rect x="2" y="17" width="5" height="5" rx="1" />
  </svg>
);

const ClockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const LinkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

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

export default function RegistryPage() {
  const { publicKey } = useWallet();
  const {
    createSubject,
    createLinkedSubject,
    createFreeSubject,
    submitDispute,
    submitFreeDispute,
    resolveDispute,
    addToStake,
    fetchAllSubjects,
    fetchAllDisputes,
    fetchSubject,
    getStakerPoolPDA,
    fetchStakerPool,
    fetchChallengersByDispute,
    voteOnDispute,
    addToVote,
    fetchJurorAccount,
    fetchVoteRecord,
    getJurorPDA,
    getVoteRecordPDA,
  } = useTribunalcraft();

  const { uploadSubject, uploadDispute, isUploading } = useUpload();
  const { fetchSubject: fetchSubjectContent, fetchDispute: fetchDisputeContent, getUrl } = useContentFetch();

  const [subjects, setSubjects] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [subjectContents, setSubjectContents] = useState<Record<string, SubjectContent | null>>({});
  const [disputeContents, setDisputeContents] = useState<Record<string, DisputeContent | null>>({});
  const [disputeCids, setDisputeCids] = useState<Record<string, string>>({});
  const [pool, setPool] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Juror state
  const [jurorAccount, setJurorAccount] = useState<any>(null);
  const [existingVotes, setExistingVotes] = useState<Record<string, any>>({});

  // Modal state
  const [selectedItem, setSelectedItem] = useState<{ type: "subject" | "dispute"; data: any; subjectData?: any } | null>(null);
  const [showCreateSubject, setShowCreateSubject] = useState(false);
  const [showCreateDispute, setShowCreateDispute] = useState<string | null>(null);

  // Voting state
  const [voteStake, setVoteStake] = useState("0.01");
  const [voteChoice, setVoteChoice] = useState<"uphold" | "dismiss">("uphold");
  const [voteRationale, setVoteRationale] = useState("");
  const [addStakeAmount, setAddStakeAmount] = useState("0.1");

  // Section filter
  const [activeFilter, setActiveFilter] = useState<"active" | "disputed" | "voted">("active");

  // Create forms
  const [subjectType, setSubjectType] = useState<"standalone" | "linked" | "free">("standalone");
  const [subjectForm, setSubjectForm] = useState({
    title: "",
    description: "",
    category: "contract" as SubjectContent["category"],
    termsText: "",
    maxStake: "1",
    matchMode: false,
    votingPeriod: "24",
    winnerReward: "6000",
    initialStake: "0.1",
  });

  const [disputeForm, setDisputeForm] = useState({
    type: "other" as const,
    title: "",
    reason: "",
    requestedOutcome: "",
    bondAmount: "0.05",
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [subjectsData, disputesData] = await Promise.all([
        fetchAllSubjects(),
        fetchAllDisputes(),
      ]);
      setSubjects(subjectsData);
      setDisputes(disputesData);

      // Fetch content for all subjects
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

      if (publicKey) {
        const [poolPda] = getStakerPoolPDA(publicKey);
        try {
          setPool(await fetchStakerPool(poolPda));
        } catch {
          setPool(null);
        }

        const [jurorPda] = getJurorPDA(publicKey);
        try {
          const jurorData = await fetchJurorAccount(jurorPda);
          setJurorAccount(jurorData);

          const pendingDisputes = disputesData.filter((d: any) => d.account.status.pending);
          const votes: Record<string, any> = {};
          for (const d of pendingDisputes) {
            const [voteRecordPda] = getVoteRecordPDA(d.publicKey, publicKey);
            try {
              const voteRecord = await fetchVoteRecord(voteRecordPda);
              if (voteRecord) votes[d.publicKey.toBase58()] = voteRecord;
            } catch {}
          }
          setExistingVotes(votes);
        } catch {
          setJurorAccount(null);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [publicKey]);

  // Filter data for sections
  const activeSubjects = subjects.filter(s => s.account.status.active);

  const myVotedDisputes = disputes.filter(d => existingVotes[d.publicKey.toBase58()]);
  const votedKeys = new Set(myVotedDisputes.map(d => d.publicKey.toBase58()));
  const disputedItems = disputes.filter(d => d.account.status.pending && !votedKeys.has(d.publicKey.toBase58()));

  // Dismissed disputes only (upheld disputes return subject to active)
  const dismissedDisputes = disputes.filter(d => d.account.status.resolved && d.account.outcome.dismissed);

  // Get items based on active filter - all return subjects with optional dispute
  const getActiveItems = () => {
    switch (activeFilter) {
      case "active":
        return activeSubjects.map(s => ({ subject: s, dispute: null }));
      case "disputed":
        return disputedItems.map(d => {
          const subject = subjects.find(s => s.publicKey.toBase58() === d.account.subject.toBase58());
          return { subject, dispute: d };
        }).filter(item => item.subject);
      case "voted":
        return myVotedDisputes.map(d => {
          const subject = subjects.find(s => s.publicKey.toBase58() === d.account.subject.toBase58());
          return { subject, dispute: d };
        }).filter(item => item.subject);
    }
  };
  const activeItems = getActiveItems();

  // Handlers
  const handleCreateSubject = async () => {
    if (!publicKey) return;
    setActionLoading(true);
    setError(null);
    try {
      const uploadResult = await uploadSubject({
        title: subjectForm.title,
        description: subjectForm.description,
        category: subjectForm.category,
        termsText: subjectForm.termsText,
      });
      if (!uploadResult) throw new Error("Failed to upload content");

      const maxStake = new BN(parseFloat(subjectForm.maxStake) * LAMPORTS_PER_SOL);
      const votingPeriod = new BN(parseInt(subjectForm.votingPeriod) * 3600);
      const winnerRewardBps = parseInt(subjectForm.winnerReward);

      const subjectKeypair = Keypair.generate();
      const subjectId = subjectKeypair.publicKey;

      if (subjectType === "free") {
        await createFreeSubject(subjectId, uploadResult.cid, votingPeriod);
      } else if (subjectType === "linked") {
        if (!publicKey) throw new Error("Wallet not connected");
        const [stakerPool] = getStakerPoolPDA(publicKey);
        await createLinkedSubject(stakerPool, subjectId, uploadResult.cid, maxStake, subjectForm.matchMode, votingPeriod, winnerRewardBps);
      } else {
        const initialStake = new BN(parseFloat(subjectForm.initialStake) * LAMPORTS_PER_SOL);
        await createSubject(subjectId, uploadResult.cid, maxStake, subjectForm.matchMode, votingPeriod, winnerRewardBps, initialStake);
      }

      setSuccess("Subject created");
      setShowCreateSubject(false);
      setSubjectForm({ title: "", description: "", category: "contract", termsText: "", maxStake: "1", matchMode: false, votingPeriod: "24", winnerReward: "6000", initialStake: "0.1" });
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to create subject");
    }
    setActionLoading(false);
  };

  const handleCreateDispute = async (subjectKey: string) => {
    if (!publicKey) return;
    setActionLoading(true);
    setError(null);
    try {
      const subject = subjects.find(s => s.publicKey.toBase58() === subjectKey);
      if (!subject) throw new Error("Subject not found");

      const uploadResult = await uploadDispute({
        title: disputeForm.title,
        reason: disputeForm.reason,
        type: disputeForm.type,
        subjectCid: subject.account.detailsCid,
        requestedOutcome: disputeForm.requestedOutcome,
      });
      if (!uploadResult) throw new Error("Failed to upload content");

      const disputeType: DisputeType = { [disputeForm.type]: {} } as DisputeType;
      const bond = new BN(parseFloat(disputeForm.bondAmount) * LAMPORTS_PER_SOL);

      if (subject.account.freeCase) {
        await submitFreeDispute(
          subject.publicKey,
          { disputeCount: subject.account.disputeCount },
          disputeType,
          uploadResult.cid
        );
      } else {
        await submitDispute(
          subject.publicKey,
          { disputeCount: subject.account.disputeCount, stakerPool: subject.account.stakerPool },
          disputeType,
          uploadResult.cid,
          bond
        );
      }

      setSuccess("Dispute submitted");
      setShowCreateDispute(null);
      setDisputeForm({ type: "other", title: "", reason: "", requestedOutcome: "", bondAmount: "0.05" });
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to submit dispute");
    }
    setActionLoading(false);
  };

  const handleVote = async (disputeKey: string) => {
    if (!publicKey || !jurorAccount) return;
    setActionLoading(true);
    setError(null);
    try {
      const dispute = new PublicKey(disputeKey);
      const stake = new BN(parseFloat(voteStake) * LAMPORTS_PER_SOL);
      const hasExistingVote = existingVotes[disputeKey];

      if (hasExistingVote) {
        await addToVote(dispute, stake);
        setSuccess(`Added ${voteStake} SOL to vote`);
      } else {
        const choice: VoteChoice = { [voteChoice]: {} } as VoteChoice;
        await voteOnDispute(dispute, choice, stake, voteRationale);
        setSuccess("Vote cast");
        setVoteRationale("");
      }
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to vote");
    }
    setActionLoading(false);
  };

  const handleAddStake = async (subjectKey: string) => {
    if (!publicKey) return;
    setActionLoading(true);
    setError(null);
    try {
      const stake = new BN(parseFloat(addStakeAmount) * LAMPORTS_PER_SOL);
      await addToStake(new PublicKey(subjectKey), stake);
      setSuccess(`Added ${addStakeAmount} SOL stake`);
      setAddStakeAmount("0.1");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to add stake");
    }
    setActionLoading(false);
  };

  const handleResolve = async (disputeKey: string) => {
    if (!publicKey) return;
    setActionLoading(true);
    setError(null);
    try {
      const dispute = disputes.find(d => d.publicKey.toBase58() === disputeKey);
      if (!dispute) throw new Error("Dispute not found");
      const subjectData = await fetchSubject(dispute.account.subject);
      const stakerPool = subjectData && !subjectData.stakerPool.equals(PublicKey.default) ? subjectData.stakerPool : null;
      await resolveDispute(new PublicKey(disputeKey), dispute.account.subject, stakerPool);
      setSuccess("Dispute resolved");
      setSelectedItem(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to resolve");
    }
    setActionLoading(false);
  };

  // Unified card component
  const ItemCard = ({ subject, dispute }: { subject: any; dispute?: any }) => {
    const subjectKey = subject.publicKey.toBase58();
    const subjectContent = subjectContents[subjectKey];
    const status = getStatusBadge(subject.account.status);

    // Find active dispute for this subject if not provided
    const activeDispute = dispute || disputes.find(d =>
      d.account.subject.toBase58() === subjectKey && d.account.status.pending
    );
    const disputeKey = activeDispute?.publicKey.toBase58();
    const disputeContent = disputeKey ? disputeContents[disputeKey] : null;
    const existingVote = disputeKey ? existingVotes[disputeKey] : null;

    // Dispute voting info
    const totalVotes = activeDispute ? activeDispute.account.votesFavorWeight.toNumber() + activeDispute.account.votesAgainstWeight.toNumber() : 0;
    const favorPercent = totalVotes > 0 ? (activeDispute.account.votesFavorWeight.toNumber() / totalVotes) * 100 : 50;

    // Juror fees calculation
    const jurorFees = subject.account.freeCase
      ? "FREE"
      : activeDispute
        ? `${((activeDispute.account.totalBond.toNumber() * (10000 - subject.account.winnerRewardBps)) / 10000 / LAMPORTS_PER_SOL).toFixed(3)} SOL`
        : `${((subject.account.totalStake.toNumber() * (10000 - subject.account.winnerRewardBps)) / 10000 / LAMPORTS_PER_SOL).toFixed(3)} SOL`;

    return (
      <div
        onClick={() => activeDispute
          ? setSelectedItem({ type: "dispute", data: activeDispute, subjectData: subject })
          : setSelectedItem({ type: "subject", data: subject })
        }
        className={`p-3 bg-obsidian border cursor-pointer transition-all ${existingVote ? "border-emerald/30 hover:border-emerald/50" : "border-slate-light hover:border-gold/50"}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-1">
          <p className="text-sm text-parchment font-medium truncate flex-1">{subjectContent?.title || subjectKey.slice(0, 12) + "..."}</p>
          <div className="flex items-center gap-1 ml-2">
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${subject.account.matchMode ? "bg-gold/20 text-gold" : "bg-steel/20 text-steel"}`}>
              {subject.account.matchMode ? "Match" : "Proportional"}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${status.class}`}>{status.label}</span>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-steel truncate mb-2">{subjectContent?.description?.slice(0, 50) || "Loading..."}</p>

        {/* Dispute Info (conditional) */}
        {activeDispute && (
          <div className="mb-2 pt-2 border-t border-slate-light/50">
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="text-gold">{disputeContent?.title || getDisputeTypeLabel(activeDispute.account.disputeType)}</span>
              {existingVote && <span className="text-emerald flex items-center gap-0.5"><CheckIcon /> Voted</span>}
            </div>
            <p className="text-xs text-steel truncate mb-2">{disputeContent?.reason?.slice(0, 50) || "..."}</p>
            <div className="h-1 rounded overflow-hidden flex mb-1">
              <div className="h-full" style={{ width: `${favorPercent}%`, backgroundColor: '#10b981' }} />
              <div className="h-full" style={{ width: `${100 - favorPercent}%`, backgroundColor: '#dc2626' }} />
            </div>
            <div className="flex items-center justify-between text-[10px] text-steel">
              <span className="flex items-center gap-1">
                <ClockIcon />
                <Countdown endTime={activeDispute.account.votingEndsAt.toNumber() * 1000} />
              </span>
              <span>{activeDispute.account.voteCount} votes</span>
            </div>
          </div>
        )}

        {/* Footer - unified for all card types */}
        <div className="grid grid-cols-3 text-[10px] text-steel pt-2 border-t border-slate-light/50">
          <span>
            {!subject.account.freeCase && (
              <>
                {subject.account.matchMode
                  ? `${(subject.account.maxStake.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL`
                  : `${(subject.account.totalStake.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL`
                }
                {activeDispute && ` / ${(activeDispute.account.totalBond.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL`}
              </>
            )}
          </span>
          <span className="text-center">{subject.account.stakerCount}{activeDispute ? ` vs ${activeDispute.account.challengerCount}` : ""}</span>
          <span className="text-gold text-right">{jurorFees}</span>
        </div>
      </div>
    );
  };

  // Unified Detail Modal - Subject, Dispute, Juror sections
  const DetailModal = () => {
    if (!selectedItem) return null;

    // Get subject and dispute based on selection type
    const subject = selectedItem.type === "subject" ? selectedItem.data : selectedItem.subjectData;
    const dispute = selectedItem.type === "dispute" ? selectedItem.data :
      disputes.find(d => d.account.subject.toBase58() === subject?.publicKey.toBase58() && d.account.status.pending);

    if (!subject) return null;

    const subjectKey = subject.publicKey.toBase58();
    const subjectContent = subjectContents[subjectKey];
    const subjectStatus = getStatusBadge(subject.account.status);

    // Dispute data
    const disputeKey = dispute?.publicKey.toBase58();
    const disputeContent = disputeKey ? disputeContents[disputeKey] : null;
    const outcome = dispute ? getOutcomeLabel(dispute.account.outcome) : null;
    const existingVote = disputeKey ? existingVotes[disputeKey] : null;
    const votingEnded = dispute ? Date.now() > dispute.account.votingEndsAt.toNumber() * 1000 : false;
    const isPending = dispute?.account.status.pending;
    const canVote = isPending && !votingEnded && jurorAccount;
    const canResolve = isPending && votingEnded;
    const totalVotes = dispute ? dispute.account.votesFavorWeight.toNumber() + dispute.account.votesAgainstWeight.toNumber() : 0;
    const favorPercent = totalVotes > 0 ? (dispute.account.votesFavorWeight.toNumber() / totalVotes) * 100 : 50;

    // Calculate juror fees for modal
    const modalJurorFees = subject.account.freeCase
      ? "FREE"
      : dispute
        ? `${((dispute.account.totalBond.toNumber() * (10000 - subject.account.winnerRewardBps)) / 10000 / LAMPORTS_PER_SOL).toFixed(3)} SOL`
        : `${((subject.account.totalStake.toNumber() * (10000 - subject.account.winnerRewardBps)) / 10000 / LAMPORTS_PER_SOL).toFixed(3)} SOL`;

    return (
      <div className="fixed inset-0 bg-obsidian/90 flex items-center justify-center z-50 p-4" onClick={() => setSelectedItem(null)}>
        <div className="bg-slate border border-slate-light max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="p-4 border-b border-slate-light flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-ivory truncate">{subjectContent?.title || "Subject"}</h3>
              <div className="flex items-center gap-1 shrink-0">
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${subject.account.matchMode ? "bg-gold/20 text-gold" : "bg-steel/20 text-steel"}`}>
                  {subject.account.matchMode ? "Match" : "Proportional"}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${subjectStatus.class}`}>{subjectStatus.label}</span>
              </div>
            </div>
            <button onClick={() => setSelectedItem(null)} className="text-steel hover:text-parchment ml-2"><XIcon /></button>
          </div>

          <div className="p-4 space-y-4">
            {/* ========== SUBJECT SECTION ========== */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-steel uppercase tracking-wider">Subject</h4>
              <div className="p-4 bg-obsidian border border-slate-light space-y-3">
                {subjectContent?.description && <p className="text-steel text-sm">{subjectContent.description}</p>}
                {/* Stats grid matching card footer */}
                <div className="grid grid-cols-3 text-sm pt-2 border-t border-slate-light/50">
                  <div>
                    <p className="text-steel text-xs">Stake</p>
                    <p className="text-parchment">
                      {!subject.account.freeCase ? (
                        subject.account.matchMode
                          ? `${(subject.account.maxStake.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL`
                          : `${(subject.account.totalStake.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL`
                      ) : "-"}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-steel text-xs">Stakers</p>
                    <p className="text-parchment">{subject.account.stakerCount}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-steel text-xs">Juror Fees</p>
                    <p className="text-gold">{modalJurorFees}</p>
                  </div>
                </div>
                {/* Subject Actions */}
                <div className="flex gap-2 pt-2 border-t border-slate-light/50">
                  {!subject.account.freeCase && (
                    <>
                      <input
                        type="text"
                        value={addStakeAmount}
                        onChange={(e) => setAddStakeAmount(e.target.value)}
                        className="input flex-1 text-sm py-1.5"
                        placeholder="Amount"
                      />
                      <button onClick={() => handleAddStake(subjectKey)} disabled={actionLoading} className="btn btn-secondary py-1.5 px-3 text-sm">
                        Add Stake
                      </button>
                    </>
                  )}
                  {subject.account.status.active && (
                    <button onClick={() => { setSelectedItem(null); setShowCreateDispute(subjectKey); }} className="btn btn-secondary py-1.5 px-3 text-sm">
                      File Dispute
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ========== DISPUTE SECTION ========== */}
            {dispute && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-steel uppercase tracking-wider">Dispute</h4>
                <div className="p-4 bg-obsidian border border-slate-light space-y-3">
                  {/* Title row with voted badge */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gold font-medium">{disputeContent?.title || getDisputeTypeLabel(dispute.account.disputeType)}</p>
                    <div className="flex items-center gap-2">
                      {outcome && <span className={`text-xs font-medium ${outcome.class}`}>{outcome.label}</span>}
                      {existingVote && <span className="text-emerald flex items-center gap-0.5 text-xs"><CheckIcon /> Voted</span>}
                    </div>
                  </div>
                  {/* Reason */}
                  {disputeContent?.reason && <p className="text-sm text-steel">{disputeContent.reason}</p>}
                  {/* Vote Progress */}
                  <div className="pt-2 border-t border-slate-light/50">
                    <div className="h-1 rounded overflow-hidden flex mb-1">
                      <div className="h-full" style={{ width: `${favorPercent}%`, backgroundColor: '#10b981' }} />
                      <div className="h-full" style={{ width: `${100 - favorPercent}%`, backgroundColor: '#dc2626' }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-steel">
                      <span className="flex items-center gap-1"><ClockIcon /> <Countdown endTime={dispute.account.votingEndsAt.toNumber() * 1000} /></span>
                      <span>{dispute.account.voteCount} votes</span>
                    </div>
                  </div>
                  {/* Stats grid matching card footer */}
                  <div className="grid grid-cols-3 text-sm pt-2 border-t border-slate-light/50">
                    <div>
                      <p className="text-steel text-xs">Bond</p>
                      <p className="text-parchment">{(dispute.account.totalBond.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL</p>
                    </div>
                    <div className="text-center">
                      <p className="text-steel text-xs">Participants</p>
                      <p className="text-parchment">{subject.account.stakerCount} vs {dispute.account.challengerCount}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-steel text-xs">Juror Fees</p>
                      <p className="text-gold">{modalJurorFees}</p>
                    </div>
                  </div>
                  {/* Dispute Actions */}
                  {isPending && (canResolve || !subject.account.freeCase) && (
                    <div className="flex gap-2 pt-2 border-t border-slate-light/50">
                      {canResolve && (
                        <button onClick={() => handleResolve(disputeKey!)} disabled={actionLoading} className="btn btn-primary py-1.5 px-3 text-sm flex-1">
                          {actionLoading ? "..." : "Resolve"}
                        </button>
                      )}
                      {!subject.account.freeCase && (
                        <button onClick={() => { setSelectedItem(null); setShowCreateDispute(subjectKey); }} className="btn btn-secondary py-1.5 px-3 text-sm">
                          Add to Dispute
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ========== JUROR SECTION ========== */}
            {dispute && isPending && !votingEnded && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-steel uppercase tracking-wider">Juror</h4>
                <div className="p-4 bg-obsidian border border-slate-light space-y-3">
                  {!jurorAccount && publicKey ? (
                    <p className="text-steel text-sm text-center">
                      <Link href="/juror" className="text-gold hover:text-gold-light">Register as juror</Link> to vote on this dispute
                    </p>
                  ) : !publicKey ? (
                    <p className="text-steel text-sm text-center">Connect wallet to vote</p>
                  ) : (
                    <>
                      {existingVote && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-steel">Your Vote:</span>
                          <span className="text-emerald font-medium">
                            {existingVote.choice.uphold ? "UPHOLD" : existingVote.choice.dismiss ? "DISMISS" : "ABSTAIN"} - {(existingVote.stakeAllocated.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL
                          </span>
                        </div>
                      )}
                      {existingVote ? (
                        <p className="text-xs text-steel">Add more stake to your vote:</p>
                      ) : (
                        <>
                          <div className="flex gap-2">
                            {(["uphold", "dismiss"] as const).map((choice) => (
                              <button
                                key={choice}
                                onClick={() => setVoteChoice(choice)}
                                className={`flex-1 py-2 text-xs font-medium uppercase tracking-wider transition-all ${
                                  voteChoice === choice
                                    ? choice === "uphold" ? "bg-emerald text-obsidian"
                                    : "bg-crimson text-ivory"
                                    : "bg-slate-light hover:bg-slate text-parchment"
                                }`}
                              >
                                {choice}
                              </button>
                            ))}
                          </div>
                          <textarea
                            value={voteRationale}
                            onChange={(e) => setVoteRationale(e.target.value)}
                            placeholder="Rationale for your vote (optional)"
                            className="input w-full text-sm py-2 h-16 resize-none"
                          />
                        </>
                      )}
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
                          onClick={() => handleVote(disputeKey!)}
                          disabled={actionLoading}
                          className="btn btn-primary py-2 px-4"
                        >
                          {actionLoading ? "..." : existingVote ? "Add" : "Vote"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* IPFS Link */}
            {disputeKey && disputeCids[disputeKey] && (
              <a href={getUrl(disputeCids[disputeKey])} target="_blank" rel="noopener noreferrer" className="text-xs text-gold hover:text-gold-light flex items-center gap-1">
                View dispute on IPFS <LinkIcon />
              </a>
            )}

            {/* ========== HISTORY SECTION ========== */}
            {(() => {
              const pastDisputes = disputes.filter(d =>
                d.account.subject.toBase58() === subjectKey &&
                d.account.status.resolved &&
                d.publicKey.toBase58() !== disputeKey
              );
              if (pastDisputes.length === 0) return null;
              return (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-steel uppercase tracking-wider">History</h4>
                  <div className="space-y-2">
                    {pastDisputes.map((d, i) => {
                      const dKey = d.publicKey.toBase58();
                      const dContent = disputeContents[dKey];
                      const dOutcome = getOutcomeLabel(d.account.outcome);
                      return (
                        <div key={i} className="p-3 bg-obsidian border border-slate-light">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs text-parchment">{dContent?.title || getDisputeTypeLabel(d.account.disputeType)}</p>
                            <span className={`text-[10px] ${dOutcome.class}`}>{dOutcome.label}</span>
                          </div>
                          <div className="grid grid-cols-3 text-[10px] text-steel">
                            <span>{(d.account.totalBond.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL</span>
                            <span className="text-center">{d.account.voteCount} votes</span>
                            <span className="text-right">{new Date(d.account.resolvedAt.toNumber() * 1000).toLocaleDateString()}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  };

  // Create Subject Modal
  const createSubjectModalContent = showCreateSubject ? (
    <div className="fixed inset-0 bg-obsidian/90 flex items-center justify-center z-50 p-4" onClick={() => setShowCreateSubject(false)}>
      <div className="bg-slate border border-slate-light max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-light flex items-center justify-between">
          <h3 className="text-lg font-semibold text-ivory">Create Subject</h3>
          <button onClick={() => setShowCreateSubject(false)} className="text-steel hover:text-parchment"><XIcon /></button>
        </div>
        <div className="p-4 space-y-4">
          {/* Type Selection */}
          <div className="flex gap-1">
            {(["standalone", "linked", "free"] as const).map(t => (
              <button key={t} onClick={() => setSubjectType(t)} className={`flex-1 py-2 text-xs uppercase tracking-wide ${subjectType === t ? "bg-gold text-obsidian font-semibold" : "bg-slate-light/50 text-steel hover:text-parchment"}`}>
                {t}
              </button>
            ))}
          </div>

          {/* Basic Info */}
          <div className="space-y-3">
            <input value={subjectForm.title} onChange={e => setSubjectForm(f => ({ ...f, title: e.target.value }))} placeholder="Title" className="input w-full" />
            <textarea value={subjectForm.description} onChange={e => setSubjectForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" className="input w-full h-20" />
            <div className="grid grid-cols-2 gap-3">
              <textarea value={subjectForm.termsText} onChange={e => setSubjectForm(f => ({ ...f, termsText: e.target.value }))} placeholder="Terms" className="input w-full h-16" />
              <select value={subjectForm.category} onChange={e => setSubjectForm(f => ({ ...f, category: e.target.value as any }))} className="input w-full h-16">
                {SUBJECT_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </div>

          {/* Settings */}
          <div className="border-t border-slate-light pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-steel mb-1 block">Voting Period (hours)</label>
                <input value={subjectForm.votingPeriod} onChange={e => setSubjectForm(f => ({ ...f, votingPeriod: e.target.value }))} className="input w-full" />
              </div>
              {subjectType !== "free" && (
                <div>
                  <label className="text-xs text-steel mb-1 block">Winner Reward (%)</label>
                  <input value={(parseInt(subjectForm.winnerReward) / 100).toString()} onChange={e => setSubjectForm(f => ({ ...f, winnerReward: (parseFloat(e.target.value) * 100).toString() }))} className="input w-full" />
                </div>
              )}
            </div>
            {subjectType === "standalone" && (
              <div>
                <label className="text-xs text-steel mb-1 block">Initial Stake (SOL)</label>
                <input value={subjectForm.initialStake} onChange={e => setSubjectForm(f => ({ ...f, initialStake: e.target.value }))} className="input w-full" />
              </div>
            )}
            {subjectType !== "free" && (
              <label className="flex items-center gap-2 text-sm text-parchment cursor-pointer py-1">
                <input type="checkbox" checked={subjectForm.matchMode} onChange={e => setSubjectForm(f => ({ ...f, matchMode: e.target.checked }))} className="w-4 h-4 accent-gold" />
                Match Mode (stakers match each other)
              </label>
            )}
            {subjectType === "linked" && subjectForm.matchMode && (
              <div>
                <label className="text-xs text-steel mb-1 block">Max Stake (SOL)</label>
                <input value={subjectForm.maxStake} onChange={e => setSubjectForm(f => ({ ...f, maxStake: e.target.value }))} className="input w-full" />
              </div>
            )}
          </div>

          {/* Submit */}
          <button onClick={handleCreateSubject} disabled={actionLoading || isUploading} className="btn btn-primary w-full mt-2">
            {actionLoading || isUploading ? "Creating..." : "Create Subject"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // Create Dispute Modal
  const disputeSubject = showCreateDispute ? subjects.find(s => s.publicKey.toBase58() === showCreateDispute) : null;
  const disputeSubjectContent = disputeSubject ? subjectContents[disputeSubject.publicKey.toBase58()] : null;

  const createDisputeModalContent = showCreateDispute ? (
    <div className="fixed inset-0 bg-obsidian/90 flex items-center justify-center z-50 p-4" onClick={() => setShowCreateDispute(null)}>
      <div className="bg-slate border border-slate-light max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-light flex items-center justify-between">
          <h3 className="text-lg font-semibold text-ivory">File Dispute</h3>
          <button onClick={() => setShowCreateDispute(null)} className="text-steel hover:text-parchment"><XIcon /></button>
        </div>
        <div className="p-4 space-y-4">
          {disputeSubjectContent && (
            <div className="p-3 bg-obsidian border border-slate-light">
              <p className="text-xs text-steel">Against Subject</p>
              <p className="text-sm text-parchment font-medium">{disputeSubjectContent.title}</p>
            </div>
          )}
          <select value={disputeForm.type} onChange={e => setDisputeForm(f => ({ ...f, type: e.target.value as any }))} className="input w-full">
            {DISPUTE_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <input value={disputeForm.title} onChange={e => setDisputeForm(f => ({ ...f, title: e.target.value }))} placeholder="Title" className="input w-full" />
          <textarea value={disputeForm.reason} onChange={e => setDisputeForm(f => ({ ...f, reason: e.target.value }))} placeholder="Reason" className="input w-full h-20" />
          <textarea value={disputeForm.requestedOutcome} onChange={e => setDisputeForm(f => ({ ...f, requestedOutcome: e.target.value }))} placeholder="Requested Outcome" className="input w-full h-16" />
          <div>
            <label className="text-xs text-steel">Bond Amount (SOL)</label>
            <input value={disputeForm.bondAmount} onChange={e => setDisputeForm(f => ({ ...f, bondAmount: e.target.value }))} className="input w-full" />
          </div>
          <button onClick={() => handleCreateDispute(showCreateDispute)} disabled={actionLoading || isUploading} className="btn btn-primary w-full">
            {actionLoading || isUploading ? "Submitting..." : "Submit Dispute"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-obsidian">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl font-bold text-ivory">Registry</h1>
          {publicKey && (
            <button onClick={() => setShowCreateSubject(true)} className="btn btn-primary flex items-center gap-2 text-sm py-2 px-3">
              <PlusIcon /> New Subject
            </button>
          )}
        </div>

        {error && <div className="bg-crimson/10 border border-crimson p-3 mb-4 text-crimson text-sm">{error}</div>}
        {success && <div className="bg-emerald/10 border border-emerald p-3 mb-4 text-emerald text-sm">{success}</div>}

        {loading ? (
          <div className="text-center py-12 text-steel">Loading...</div>
        ) : (
          <div className="space-y-6">
            {/* Active Section */}
            <div className="bg-slate/30 border border-slate-light p-4">
              <div className="flex items-center gap-2 mb-4">
                <FileIcon />
                <h2 className="text-sm font-semibold text-ivory uppercase tracking-wider">Active</h2>
                <span className="text-xs text-steel ml-auto">{activeItems.length}</span>
              </div>
              {/* Filter Tabs */}
              <div className="flex gap-1 mb-4 max-w-md">
                {(["active", "disputed", "voted"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={`flex-1 py-1.5 text-xs uppercase tracking-wide ${activeFilter === f ? "bg-gold text-obsidian font-semibold" : "bg-slate-light/50 text-steel hover:text-parchment"}`}
                  >
                    {f} ({f === "active" ? activeSubjects.length : f === "disputed" ? disputedItems.length : myVotedDisputes.length})
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeItems.length === 0 ? (
                  <p className="text-steel text-xs text-center py-4 col-span-full">
                    {activeFilter === "active" ? "No active subjects" : activeFilter === "disputed" ? "No active disputes" : jurorAccount ? "No votes cast" : "Register as juror to vote"}
                  </p>
                ) : (
                  activeItems.map((item: any, i: number) => <ItemCard key={i} subject={item.subject} dispute={item.dispute} />)
                )}
              </div>
            </div>

            {/* Dismissed Section */}
            <div className="bg-slate/30 border border-slate-light p-4">
              <div className="flex items-center gap-2 mb-4">
                <GavelIcon />
                <h2 className="text-sm font-semibold text-ivory uppercase tracking-wider">Dismissed</h2>
                <span className="text-xs text-steel ml-auto">{dismissedDisputes.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {dismissedDisputes.length === 0 ? (
                  <p className="text-steel text-xs text-center py-4 col-span-full">No dismissed disputes</p>
                ) : (
                  dismissedDisputes.map((d, i) => {
                    const subject = subjects.find(s => s.publicKey.toBase58() === d.account.subject.toBase58());
                    return subject ? <ItemCard key={i} subject={subject} dispute={d} /> : null;
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <DetailModal />
      {createSubjectModalContent}
      {createDisputeModalContent}
    </div>
  );
}
