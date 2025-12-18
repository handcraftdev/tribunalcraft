"use client";

import { useState, useEffect, memo, useCallback, useRef, useLayoutEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Navigation } from "@/components/Navigation";
import { useTribunalcraft } from "@/hooks/useTribunalcraft";
import { useUpload, useContentFetch } from "@/hooks/useUpload";
import { PublicKey, LAMPORTS_PER_SOL, Keypair } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import Link from "next/link";
import type { DisputeType, VoteChoice } from "@/hooks/useTribunalcraft";
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
  if (status.invalidated) return { label: "Invalidated", class: "bg-crimson/20 text-crimson" };
  return { label: "Unknown", class: "bg-steel/20 text-steel" };
};

const getOutcomeLabel = (outcome: any) => {
  if (outcome.none) return { label: "Voting", class: "text-gold" };
  if (outcome.challengerWins) return { label: "Challenger Wins", class: "text-crimson" };
  if (outcome.defenderWins) return { label: "Defender Wins", class: "text-sky-400" };
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

const ChevronDownIcon = ({ expanded }: { expanded: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${expanded ? "rotate-180" : ""}`}>
    <polyline points="6 9 12 15 18 9" />
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

// Memoized Create Dispute Modal to prevent focus loss
const CreateDisputeModal = memo(function CreateDisputeModal({
  isOpen,
  onClose,
  onSubmit,
  subjectContent,
  matchMode,
  maxStake,
  freeCase,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (form: { type: string; title: string; reason: string; requestedOutcome: string; bondAmount: string }) => void;
  subjectContent: SubjectContent | null;
  matchMode: boolean;
  maxStake: number;
  freeCase: boolean;
  isLoading: boolean;
}) {
  const [form, setForm] = useState({
    type: "other",
    title: "",
    reason: "",
    requestedOutcome: "",
    bondAmount: "0.05",
  });

  const handleSubmit = () => {
    onSubmit(form);
    setForm({ type: "other", title: "", reason: "", requestedOutcome: "", bondAmount: "0.05" });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-obsidian/90 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate border border-slate-light max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-light flex items-center justify-between">
          <h3 className="text-lg font-semibold text-ivory">File Dispute</h3>
          <button onClick={onClose} className="text-steel hover:text-parchment"><XIcon /></button>
        </div>
        <div className="p-4 space-y-4">
          {subjectContent && (
            <div className="p-3 bg-obsidian border border-slate-light">
              <p className="text-xs text-steel">Against Subject</p>
              <p className="text-sm text-parchment font-medium">{subjectContent.title}</p>
            </div>
          )}
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="input w-full">
            {DISPUTE_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Title" className="input w-full" autoComplete="off" />
          <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Reason" className="input w-full h-20" />
          <textarea value={form.requestedOutcome} onChange={e => setForm(f => ({ ...f, requestedOutcome: e.target.value }))} placeholder="Requested Outcome" className="input w-full h-16" />
          {!freeCase && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-steel">Bond Amount (SOL)</label>
                {matchMode && (
                  <span className="text-xs text-gold">
                    Max: {(maxStake / LAMPORTS_PER_SOL).toFixed(2)} SOL
                  </span>
                )}
              </div>
              <input value={form.bondAmount} onChange={e => setForm(f => ({ ...f, bondAmount: e.target.value }))} className="input w-full" autoComplete="off" />
              {matchMode && (
                <p className="text-[10px] text-steel mt-1">Match mode: bond cannot exceed defender stake</p>
              )}
            </div>
          )}
          <button onClick={handleSubmit} disabled={isLoading} className="btn btn-primary w-full">
            {isLoading ? "Submitting..." : "Submit Dispute"}
          </button>
        </div>
      </div>
    </div>
  );
});

// Memoized Create Subject Modal to prevent focus loss
const CreateSubjectModal = memo(function CreateSubjectModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (form: any, subjectType: string) => void;
  isLoading: boolean;
}) {
  const [subjectType, setSubjectType] = useState<"standalone" | "linked" | "free">("standalone");
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "contract" as SubjectContent["category"],
    termsText: "",
    maxStake: "1",
    matchMode: false,
    votingPeriod: "24",
    initialStake: "0.1",
  });

  const handleSubmit = () => {
    onSubmit(form, subjectType);
    setForm({ title: "", description: "", category: "contract", termsText: "", maxStake: "1", matchMode: false, votingPeriod: "24", initialStake: "0.1" });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-obsidian/90 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate border border-slate-light max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-light flex items-center justify-between">
          <h3 className="text-lg font-semibold text-ivory">Create Subject</h3>
          <button onClick={onClose} className="text-steel hover:text-parchment"><XIcon /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex gap-1">
            {(["standalone", "linked", "free"] as const).map(t => (
              <button key={t} onClick={() => setSubjectType(t)} className={`flex-1 py-2 text-xs uppercase tracking-wide ${subjectType === t ? "bg-gold text-obsidian font-semibold" : "bg-slate-light/50 text-steel hover:text-parchment"}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Title" className="input w-full" autoComplete="off" />
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" className="input w-full h-20" />
            <div className="grid grid-cols-2 gap-3">
              <textarea value={form.termsText} onChange={e => setForm(f => ({ ...f, termsText: e.target.value }))} placeholder="Terms" className="input w-full h-16" />
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as any }))} className="input w-full h-16">
                {SUBJECT_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div className="border-t border-slate-light pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-steel mb-1 block">Voting Period (hours)</label>
                <input value={form.votingPeriod} onChange={e => setForm(f => ({ ...f, votingPeriod: e.target.value }))} className="input w-full" autoComplete="off" />
              </div>
              {subjectType !== "free" && (
                <div>
                  <label className="text-xs text-steel mb-1 block">Protocol Fee</label>
                  <div className="input w-full bg-slate-light/50 text-steel cursor-not-allowed">20% (19% jurors, 1% platform)</div>
                </div>
              )}
            </div>
            {subjectType === "standalone" && (
              <div>
                <label className="text-xs text-steel mb-1 block">Initial Stake (SOL)</label>
                <input value={form.initialStake} onChange={e => setForm(f => ({ ...f, initialStake: e.target.value }))} className="input w-full" autoComplete="off" />
              </div>
            )}
            {subjectType !== "free" && (
              <label className="flex items-center gap-2 text-sm text-parchment cursor-pointer py-1">
                <input type="checkbox" checked={form.matchMode} onChange={e => setForm(f => ({ ...f, matchMode: e.target.checked }))} className="w-4 h-4 accent-gold" />
                Match Mode (stakers match each other)
              </label>
            )}
            {subjectType === "linked" && form.matchMode && (
              <div>
                <label className="text-xs text-steel mb-1 block">Max Stake (SOL)</label>
                <input value={form.maxStake} onChange={e => setForm(f => ({ ...f, maxStake: e.target.value }))} className="input w-full" autoComplete="off" />
              </div>
            )}
          </div>
          <button onClick={handleSubmit} disabled={isLoading} className="btn btn-primary w-full mt-2">
            {isLoading ? "Creating..." : "Create Subject"}
          </button>
        </div>
      </div>
    </div>
  );
});

// Memoized Vote Form to prevent focus loss
const VoteForm = memo(function VoteForm({
  existingVote,
  onVote,
  isLoading,
}: {
  existingVote: any;
  onVote: (stake: string, choice: "forChallenger" | "forDefender", rationale: string) => void;
  isLoading: boolean;
}) {
  const [voteStake, setVoteStake] = useState("0.01");
  const [voteChoice, setVoteChoice] = useState<"forChallenger" | "forDefender">("forDefender");
  const [voteRationale, setVoteRationale] = useState("");

  const handleSubmit = () => {
    onVote(voteStake, voteChoice, voteRationale);
    if (!existingVote) setVoteRationale("");
  };

  return (
    <>
      {existingVote && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-steel">Your Vote:</span>
          <span className={`font-medium ${existingVote.choice.forChallenger ? "text-crimson" : "text-sky-400"}`}>
            {existingVote.choice.forChallenger ? "FOR CHALLENGER" : existingVote.choice.forDefender ? "FOR DEFENDER" : "ABSTAIN"} - {(existingVote.stakeAllocated.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL
          </span>
        </div>
      )}
      {existingVote ? (
        <p className="text-xs text-steel">Add more stake to your vote:</p>
      ) : (
        <>
          <div className="flex gap-2">
            {(["forDefender", "forChallenger"] as const).map((choice) => (
              <button
                key={choice}
                onClick={() => setVoteChoice(choice)}
                className={`flex-1 py-2 text-xs font-medium uppercase tracking-wider transition-all ${
                  voteChoice === choice
                    ? choice === "forDefender" ? "bg-sky-500 text-obsidian"
                    : "bg-crimson text-ivory"
                    : "bg-slate-light hover:bg-slate text-parchment"
                }`}
              >
                {choice === "forDefender" ? "For Defender" : "For Challenger"}
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
          onClick={handleSubmit}
          disabled={isLoading}
          className="btn btn-primary py-2 px-4"
        >
          {isLoading ? "..." : existingVote ? "Add" : "Vote"}
        </button>
      </div>
    </>
  );
});

// Memoized Join Form to prevent focus loss
const JoinForm = memo(function JoinForm({
  type,
  onJoin,
  isLoading,
}: {
  type: "defender" | "challenger";
  onJoin: (amount: string) => void;
  isLoading: boolean;
}) {
  const [amount, setAmount] = useState(type === "defender" ? "0.1" : "0.05");

  return (
    <div className="flex gap-2 flex-1">
      {type === "defender" ? (
        <>
          <button onClick={() => onJoin(amount)} disabled={isLoading} className="btn btn-secondary py-1.5 px-3 text-sm border-sky-500/50 hover:border-sky-400 shrink-0">
            <span className="text-sky-400">Join Defenders</span>
          </button>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input flex-1 min-w-0 text-sm py-1.5"
            placeholder="Amount"
          />
          <span className="text-steel text-sm shrink-0">SOL</span>
        </>
      ) : (
        <>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input flex-1 min-w-0 text-sm py-1.5"
            placeholder="Bond"
          />
          <span className="text-steel text-sm shrink-0">SOL</span>
          <button onClick={() => onJoin(amount)} disabled={isLoading} className="btn btn-secondary py-1.5 px-3 text-sm border-crimson/50 hover:border-crimson shrink-0">
            <span className="text-crimson">Join Challengers</span>
          </button>
        </>
      )}
    </div>
  );
});

export default function RegistryPage() {
  const { publicKey } = useWallet();
  const {
    client,
    createSubject,
    createLinkedSubject,
    createFreeSubject,
    submitDispute,
    submitFreeDispute,
    addToDispute,
    resolveDispute,
    addToStake,
    fetchAllSubjects,
    fetchAllDisputes,
    fetchSubject,
    getDefenderPoolPDA,
    getDisputePDA,
    fetchDefenderPool,
    fetchChallengersByDispute,
    voteOnDispute,
    addToVote,
    fetchJurorAccount,
    fetchVoteRecord,
    getJurorPDA,
    getVoteRecordPDA,
    fetchVotesByDispute,
    claimJurorReward,
    claimChallengerReward,
    claimDefenderReward,
    getChallengerRecordPDA,
    getDefenderRecordPDA,
    fetchChallengerRecord,
    fetchDefenderRecord,
    getEscrowPDA,
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
  const [disputeVotes, setDisputeVotes] = useState<any[]>([]);

  // Challenger/Defender records for claims
  const [challengerRecords, setChallengerRecords] = useState<Record<string, any>>({});
  const [defenderRecords, setDefenderRecords] = useState<Record<string, any>>({});

  // Modal state
  const [selectedItem, setSelectedItem] = useState<{ type: "subject" | "dispute"; data: any; subjectData?: any } | null>(null);
  const [showCreateSubject, setShowCreateSubject] = useState(false);
  const [showCreateDispute, setShowCreateDispute] = useState<string | null>(null);

  // Scroll preservation for modal
  const modalScrollRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef(0);

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

  // History collapse state
  const [historyExpanded, setHistoryExpanded] = useState(false);

  // Section filter
  const [activeFilter, setActiveFilter] = useState<"active" | "disputed" | "voted" | "claims">("active");


  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [subjectsData, disputesData] = await Promise.all([
        fetchAllSubjects(),
        fetchAllDisputes(),
      ]);
      setSubjects(subjectsData || []);
      setDisputes(disputesData || []);

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
        const [poolPda] = getDefenderPoolPDA(publicKey);
        try {
          setPool(await fetchDefenderPool(poolPda));
        } catch {
          setPool(null);
        }

        const [jurorPda] = getJurorPDA(publicKey);
        try {
          const jurorData = await fetchJurorAccount(jurorPda);
          setJurorAccount(jurorData);

          // Fetch vote records for pending and resolved disputes (for claims)
          const relevantDisputes = disputesData.filter((d: any) =>
            d.account.status.pending || d.account.status.resolved
          );
          const votes: Record<string, any> = {};
          for (const d of relevantDisputes) {
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

        // Fetch challenger records for resolved disputes
        const resolvedDisputes = disputesData.filter((d: any) => d.account.status.resolved);
        const challRecords: Record<string, any> = {};
        for (const d of resolvedDisputes) {
          const [challengerRecordPda] = getChallengerRecordPDA(d.publicKey, publicKey);
          try {
            const record = await fetchChallengerRecord(challengerRecordPda);
            if (record) challRecords[d.publicKey.toBase58()] = record;
          } catch {}
        }
        setChallengerRecords(challRecords);

        // Fetch defender records for subjects with resolved disputes
        const defRecords: Record<string, any> = {};
        for (const d of resolvedDisputes) {
          const [defenderRecordPda] = getDefenderRecordPDA(d.account.subject, publicKey);
          try {
            const record = await fetchDefenderRecord(defenderRecordPda);
            if (record) defRecords[d.account.subject.toBase58()] = record;
          } catch {}
        }
        setDefenderRecords(defRecords);
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

  // Fetch votes when a dispute is selected
  useEffect(() => {
    const fetchDisputeVotes = async () => {
      if (selectedItem?.type === "dispute" && selectedItem.data) {
        const votes = await fetchVotesByDispute(selectedItem.data.publicKey);
        setDisputeVotes(votes || []);
      } else if (selectedItem?.type === "subject") {
        // Check if there's an active dispute for this subject
        const dispute = disputes.find(d =>
          d.account.subject.toBase58() === selectedItem.data.publicKey.toBase58() &&
          d.account.status.pending
        );
        if (dispute) {
          const votes = await fetchVotesByDispute(dispute.publicKey);
          setDisputeVotes(votes || []);
        } else {
          setDisputeVotes([]);
        }
      } else {
        setDisputeVotes([]);
      }
    };
    fetchDisputeVotes();
  }, [selectedItem, disputes, fetchVotesByDispute]);

  // Reset history collapse when changing selection
  useEffect(() => {
    setHistoryExpanded(false);
  }, [selectedItem]);

  // Filter data for sections
  const activeSubjects = subjects.filter(s => s.account.status.active);

  const myVotedDisputes = disputes.filter(d => existingVotes[d.publicKey.toBase58()]);
  const votedKeys = new Set(myVotedDisputes.map(d => d.publicKey.toBase58()));
  const disputedItems = disputes.filter(d => d.account.status.pending && !votedKeys.has(d.publicKey.toBase58()));

  // Invalidated subjects (challenger wins - subject was invalidated)
  const invalidatedSubjects = subjects.filter(s => s.account.status.invalidated);

  // Claimable disputes - resolved disputes where user has any unclaimed reward
  const claimableDisputes = disputes.filter(d => {
    const disputeKey = d.publicKey.toBase58();
    const subjectKey = d.account.subject.toBase58();
    const voteRecord = existingVotes[disputeKey];
    const challengerRecord = challengerRecords[disputeKey];
    const defenderRecord = defenderRecords[subjectKey];

    const hasJurorClaim = voteRecord && !voteRecord.rewardClaimed;
    const hasChallengerClaim = challengerRecord && !challengerRecord.rewardClaimed;
    const hasDefenderClaim = defenderRecord && !defenderRecord.rewardClaimed;

    return d.account.status.resolved && (hasJurorClaim || hasChallengerClaim || hasDefenderClaim);
  });

  // Get items based on active filter - all return subjects with optional dispute
  const getActiveItems = () => {
    switch (activeFilter) {
      case "active":
        return activeSubjects.map(s => ({ subject: s, dispute: null, isResolved: false }));
      case "disputed":
        return disputedItems.map(d => {
          const subject = subjects.find(s => s.publicKey.toBase58() === d.account.subject.toBase58());
          return { subject, dispute: d, isResolved: false };
        }).filter(item => item.subject);
      case "voted":
        return myVotedDisputes.map(d => {
          const subject = subjects.find(s => s.publicKey.toBase58() === d.account.subject.toBase58());
          return { subject, dispute: d, isResolved: false };
        }).filter(item => item.subject);
      case "claims":
        return claimableDisputes.map(d => {
          const subject = subjects.find(s => s.publicKey.toBase58() === d.account.subject.toBase58());
          return { subject, dispute: d, isResolved: true };
        }).filter(item => item.subject);
    }
  };
  const activeItems = getActiveItems();

  // Handlers
  const handleCreateSubject = useCallback(async (form: any, subjectType: string) => {
    if (!publicKey) return;
    setActionLoading(true);
    setError(null);
    try {
      const uploadResult = await uploadSubject({
        title: form.title,
        description: form.description,
        category: form.category,
        termsText: form.termsText,
      });
      if (!uploadResult) throw new Error("Failed to upload content");

      const maxStake = new BN(parseFloat(form.maxStake) * LAMPORTS_PER_SOL);
      const votingPeriod = new BN(parseInt(form.votingPeriod) * 3600);

      const subjectKeypair = Keypair.generate();
      const subjectId = subjectKeypair.publicKey;

      if (subjectType === "free") {
        await createFreeSubject(subjectId, uploadResult.cid, votingPeriod);
      } else if (subjectType === "linked") {
        if (!publicKey) throw new Error("Wallet not connected");
        const [defenderPool] = getDefenderPoolPDA(publicKey);
        await createLinkedSubject(defenderPool, subjectId, uploadResult.cid, maxStake, form.matchMode, votingPeriod);
      } else {
        const initialStake = new BN(parseFloat(form.initialStake) * LAMPORTS_PER_SOL);
        await createSubject(subjectId, uploadResult.cid, maxStake, form.matchMode, votingPeriod, initialStake);
      }

      setSuccess("Subject created");
      setShowCreateSubject(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to create subject");
    }
    setActionLoading(false);
  }, [publicKey, uploadSubject, createFreeSubject, createLinkedSubject, createSubject, getDefenderPoolPDA, loadData]);

  const handleCreateDispute = useCallback(async (form: { type: string; title: string; reason: string; requestedOutcome: string; bondAmount: string }) => {
    if (!publicKey || !showCreateDispute) return;
    setActionLoading(true);
    setError(null);
    try {
      const subject = subjects.find(s => s.publicKey.toBase58() === showCreateDispute);
      if (!subject) throw new Error("Subject not found");

      // Map form type key to content type
      const disputeTypeInfo = DISPUTE_TYPES.find(t => t.key === form.type);
      const contentType = (disputeTypeInfo?.contentKey ?? "other") as "breach" | "fraud" | "non_delivery" | "quality" | "refund" | "other";

      const uploadResult = await uploadDispute({
        title: form.title,
        reason: form.reason,
        type: contentType,
        subjectCid: subject.account.detailsCid,
        requestedOutcome: form.requestedOutcome,
      });
      if (!uploadResult) throw new Error("Failed to upload content");

      const disputeType: DisputeType = { [form.type]: {} } as DisputeType;
      const bond = new BN(parseFloat(form.bondAmount) * LAMPORTS_PER_SOL);

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
          { disputeCount: subject.account.disputeCount, defenderPool: subject.account.defenderPool },
          disputeType,
          uploadResult.cid,
          bond
        );
      }

      setSuccess("Dispute submitted");
      setShowCreateDispute(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to submit dispute");
    }
    setActionLoading(false);
  }, [publicKey, showCreateDispute, subjects, uploadDispute, submitFreeDispute, submitDispute, loadData]);

  const handleVote = useCallback(async (disputeKey: string, stakeAmount: string, choice: "forChallenger" | "forDefender", rationale: string) => {
    if (!publicKey || !jurorAccount) return;
    setActionLoading(true);
    setError(null);
    try {
      const dispute = new PublicKey(disputeKey);
      const stake = new BN(parseFloat(stakeAmount) * LAMPORTS_PER_SOL);
      const hasExistingVote = existingVotes[disputeKey];

      if (hasExistingVote) {
        await addToVote(dispute, stake);
        setSuccess(`Added ${stakeAmount} SOL to vote`);
      } else {
        const voteChoice: VoteChoice = { [choice]: {} } as VoteChoice;
        await voteOnDispute(dispute, voteChoice, stake, rationale);
        setSuccess("Vote cast");
      }
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to vote");
    }
    setActionLoading(false);
  }, [publicKey, jurorAccount, existingVotes, addToVote, voteOnDispute, loadData]);

  const handleAddStake = useCallback(async (subjectKey: string, amount: string) => {
    if (!publicKey) return;
    setActionLoading(true);
    setError(null);
    try {
      const stake = new BN(parseFloat(amount) * LAMPORTS_PER_SOL);
      const subject = subjects.find(s => s.publicKey.toBase58() === subjectKey);

      // Check if subject has active dispute - if so, pass dispute and escrow
      let disputePda: PublicKey | undefined;
      let escrowPda: PublicKey | undefined;

      if (subject && subject.account.dispute.toBase58() !== PublicKey.default.toBase58()) {
        const activeDispute = subject.account.dispute;
        disputePda = activeDispute;
        [escrowPda] = getEscrowPDA(activeDispute);
      }

      await addToStake(new PublicKey(subjectKey), stake, disputePda, escrowPda);
      setSuccess(`Added ${amount} SOL stake`);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to add stake");
    }
    setActionLoading(false);
  }, [publicKey, subjects, getEscrowPDA, addToStake, loadData]);

  const handleJoinChallengers = useCallback(async (subjectKey: string, amount: string) => {
    if (!publicKey) return;
    setActionLoading(true);
    setError(null);
    try {
      const subject = subjects.find(s => s.publicKey.toBase58() === subjectKey);
      if (!subject) throw new Error("Subject not found");

      const bond = new BN(parseFloat(amount) * LAMPORTS_PER_SOL);
      const [disputePda] = getDisputePDA(subject.publicKey, subject.account.disputeCount - 1);
      const defenderPool = subject.account.defenderPool.equals(PublicKey.default) ? null : subject.account.defenderPool;

      await addToDispute(subject.publicKey, disputePda, defenderPool, "", bond);
      setSuccess(`Added ${amount} SOL bond`);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to join challengers");
    }
    setActionLoading(false);
  }, [publicKey, subjects, getDisputePDA, addToDispute, loadData]);

  const handleResolve = async (disputeKey: string) => {
    if (!publicKey) return;
    setActionLoading(true);
    setError(null);
    try {
      const dispute = disputes.find(d => d.publicKey.toBase58() === disputeKey);
      if (!dispute) throw new Error("Dispute not found");
      await resolveDispute(new PublicKey(disputeKey), dispute.account.subject);
      setSuccess("Dispute resolved");
      setSelectedItem(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to resolve");
    }
    setActionLoading(false);
  };

  const handleClaimJurorReward = async (disputeKey: string, subjectKey: string) => {
    if (!publicKey) return;
    setActionLoading(true);
    setError(null);
    try {
      const [voteRecordPda] = getVoteRecordPDA(new PublicKey(disputeKey), publicKey);
      await claimJurorReward(new PublicKey(disputeKey), new PublicKey(subjectKey), voteRecordPda);
      setSuccess("Juror reward claimed!");
      setSelectedItem(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to claim juror reward");
    }
    setActionLoading(false);
  };

  const handleClaimChallengerReward = async (disputeKey: string, subjectKey: string) => {
    if (!publicKey) return;
    setActionLoading(true);
    setError(null);
    try {
      const [challengerRecordPda] = getChallengerRecordPDA(new PublicKey(disputeKey), publicKey);
      await claimChallengerReward(new PublicKey(disputeKey), new PublicKey(subjectKey), challengerRecordPda);
      setSuccess("Challenger reward claimed!");
      setSelectedItem(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to claim challenger reward");
    }
    setActionLoading(false);
  };

  const handleClaimDefenderReward = async (disputeKey: string, subjectKey: string) => {
    if (!publicKey) return;
    setActionLoading(true);
    setError(null);
    try {
      const [defenderRecordPda] = getDefenderRecordPDA(new PublicKey(subjectKey), publicKey);
      await claimDefenderReward(new PublicKey(disputeKey), new PublicKey(subjectKey), defenderRecordPda);
      setSuccess("Defender reward claimed!");
      setSelectedItem(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to claim defender reward");
    }
    setActionLoading(false);
  };


  // Unified card component
  const ItemCard = ({ subject, dispute, isResolved = false }: { subject: any; dispute?: any; isResolved?: boolean }) => {
    const subjectKey = subject.publicKey.toBase58();
    const subjectContent = subjectContents[subjectKey];

    // For resolved disputes, show "Dismissed" status, otherwise show subject's current status
    const status = isResolved && dispute?.account.outcome.defenderWins
      ? { label: "Dismissed", class: "bg-sky-500/20 text-sky-400" }
      : isResolved && dispute?.account.outcome.challengerWins
      ? { label: "Invalidated", class: "bg-crimson/20 text-crimson" }
      : getStatusBadge(subject.account.status);

    // Find active dispute for this subject if not provided (only for non-resolved views)
    const activeDispute = isResolved ? dispute : (dispute || disputes.find(d =>
      d.account.subject.toBase58() === subjectKey && d.account.status.pending
    ));
    const disputeKey = activeDispute?.publicKey.toBase58();
    const disputeContent = disputeKey ? disputeContents[disputeKey] : null;
    const existingVote = disputeKey ? existingVotes[disputeKey] : null;

    // Dispute voting info
    const totalVotes = activeDispute ? activeDispute.account.votesFavorWeight.toNumber() + activeDispute.account.votesAgainstWeight.toNumber() : 0;
    const favorPercent = totalVotes > 0 ? (activeDispute.account.votesFavorWeight.toNumber() / totalVotes) * 100 : 50;

    // Juror fees display - fixed 20% protocol fee (19% jurors, 1% platform)
    const PROTOCOL_FEE_BPS = 2000; // 20%
    const JUROR_SHARE_BPS = 9500; // 95% of fees = 19% of total
    let jurorFees = "FREE";
    if (!subject.account.freeCase) {
      if (activeDispute) {
        // With active dispute: calculate 19% of total pool
        const bondPool = activeDispute.account.totalBond.toNumber();
        const matchedStake = subject.account.matchMode
          ? activeDispute.account.stakeHeld.toNumber() + activeDispute.account.directStakeHeld.toNumber()
          : activeDispute.account.snapshotTotalStake.toNumber();
        const totalPool = bondPool + matchedStake;
        const totalFees = totalPool * PROTOCOL_FEE_BPS / 10000;
        const jurorPot = totalFees * JUROR_SHARE_BPS / 10000;
        jurorFees = `${(jurorPot / LAMPORTS_PER_SOL).toFixed(3)} SOL`;
      } else {
        // Before dispute: show fixed 20% fee
        jurorFees = "20%";
      }
    }

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
              <span className="text-crimson font-medium">{disputeContent?.title || getDisputeTypeLabel(activeDispute.account.disputeType)}</span>
              {existingVote && <span className="text-emerald flex items-center gap-0.5"><CheckIcon /> Voted</span>}
            </div>
            <p className="text-xs text-steel truncate mb-2">{disputeContent?.reason?.slice(0, 50) || "..."}</p>
            {/* Power bar - Defender (blue) left, Challenger (red) right */}
            <div className="h-1.5 rounded overflow-hidden flex mb-1 bg-obsidian">
              <div className="h-full transition-all" style={{ width: `${100 - favorPercent}%`, backgroundColor: '#0ea5e9' }} />
              <div className="h-full transition-all" style={{ width: `${favorPercent}%`, backgroundColor: '#dc2626' }} />
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-sky-400">{(100 - favorPercent).toFixed(0)}%</span>
              <span className="text-steel flex items-center gap-1">
                <ClockIcon />
                <Countdown endTime={activeDispute.account.votingEndsAt.toNumber() * 1000} />
              </span>
              <span className="text-crimson">{favorPercent.toFixed(0)}%</span>
            </div>
          </div>
        )}

        {/* Footer - unified for all card types */}
        <div className="grid grid-cols-3 text-[10px] pt-2 border-t border-slate-light/50">
          <span>
            {!subject.account.freeCase && (
              activeDispute ? (
                <>
                  <span className="text-sky-400">{((activeDispute.account.stakeHeld.toNumber() + activeDispute.account.directStakeHeld.toNumber()) / LAMPORTS_PER_SOL).toFixed(2)}</span>
                  <span className="text-steel"> / </span>
                  <span className="text-crimson">{(activeDispute.account.totalBond.toNumber() / LAMPORTS_PER_SOL).toFixed(2)}</span>
                </>
              ) : (
                <>
                  <span className="text-sky-400">{(subject.account.totalStake.toNumber() / LAMPORTS_PER_SOL).toFixed(2)}</span>
                  {subject.account.matchMode && !subject.account.defenderPool.equals(PublicKey.default) && <span className="text-steel"> (max {(subject.account.maxStake.toNumber() / LAMPORTS_PER_SOL).toFixed(2)})</span>}
                </>
              )
            )}
          </span>
          <span className="text-center">
            <span className="text-sky-400">{subject.account.defenderCount}</span>
            {activeDispute && <><span className="text-steel"> vs </span><span className="text-crimson">{activeDispute.account.challengerCount}</span></>}
          </span>
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

    // For resolved disputes, show resolved state instead of current subject state
    const isResolvedDispute = dispute?.account.status.resolved;
    const subjectStatus = isResolvedDispute && dispute?.account.outcome.defenderWins
      ? { label: "Dismissed", class: "bg-sky-500/20 text-sky-400" }
      : isResolvedDispute && dispute?.account.outcome.challengerWins
      ? { label: "Invalidated", class: "bg-crimson/20 text-crimson" }
      : getStatusBadge(subject.account.status);

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

    // Juror fees for modal - fixed 20% protocol fee (19% jurors, 1% platform)
    const MODAL_PROTOCOL_FEE_BPS = 2000; // 20%
    const MODAL_JUROR_SHARE_BPS = 9500; // 95% of fees = 19% of total

    // Subject section: always show fixed percentage
    const subjectJurorFees = subject.account.freeCase ? "FREE" : "20%";

    // Dispute section: show calculated SOL when there's a dispute
    let disputeJurorFees = "FREE";
    if (!subject.account.freeCase && dispute) {
      const bondPool = dispute.account.totalBond.toNumber();
      const matchedStake = subject.account.matchMode
        ? dispute.account.stakeHeld.toNumber() + dispute.account.directStakeHeld.toNumber()
        : dispute.account.snapshotTotalStake.toNumber();
      const totalPool = bondPool + matchedStake;
      const totalFees = totalPool * MODAL_PROTOCOL_FEE_BPS / 10000;
      const jurorPot = totalFees * MODAL_JUROR_SHARE_BPS / 10000;
      disputeJurorFees = `${(jurorPot / LAMPORTS_PER_SOL).toFixed(3)} SOL`;
    }

    return (
      <div className="fixed inset-0 bg-obsidian/90 flex items-center justify-center z-50 p-4" onClick={() => setSelectedItem(null)}>
        <div ref={modalScrollRef} className="bg-slate border border-slate-light max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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
            {/* ========== SUBJECT SECTION (DEFENDER SIDE) ========== */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-sky-500 rounded"></div>
                <h4 className="text-xs font-semibold text-sky-400 uppercase tracking-wider">Subject (Defender Side)</h4>
              </div>
              <div className="p-4 bg-obsidian border border-sky-500/30 space-y-3">
                {subjectContent?.description && <p className="text-steel text-sm">{subjectContent.description}</p>}
                {/* Stats grid */}
                <div className="grid grid-cols-2 text-sm pt-2 border-t border-slate-light/50">
                  <div>
                    <p className="text-steel text-xs">Stake</p>
                    <p className="text-sky-400">
                      {!subject.account.freeCase ? (
                        <>
                          {`${(subject.account.totalStake.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL`}
                          {subject.account.matchMode && !subject.account.defenderPool.equals(PublicKey.default) && <span className="text-steel text-xs"> (max {(subject.account.maxStake.toNumber() / LAMPORTS_PER_SOL).toFixed(2)})</span>}
                        </>
                      ) : "-"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-steel text-xs">Defenders</p>
                    <p className="text-sky-400">{subject.account.defenderCount}</p>
                  </div>
                </div>
                {/* Subject Actions */}
                <div className="flex gap-2 pt-2 border-t border-slate-light/50">
                  {!subject.account.freeCase && !dispute?.account.status.resolved && (
                    <JoinForm
                      type="defender"
                      onJoin={(amount) => handleAddStake(subjectKey, amount)}
                      isLoading={actionLoading}
                    />
                  )}
                  {subject.account.status.active && !dispute?.account.status.resolved && (
                    <button onClick={() => { setSelectedItem(null); setShowCreateDispute(subjectKey); }} className="btn btn-secondary py-1.5 px-3 text-sm">
                      File Dispute
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ========== VS / POWER BAR SECTION (NEUTRAL) ========== */}
            {dispute && (
              <div className="space-y-3">
                <div className="p-4 bg-slate-light/20 border border-slate-light space-y-3">
                  {/* Side labels with counts */}
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider">
                    <span className="text-sky-400">{subject.account.defenderCount} Defender{subject.account.defenderCount !== 1 ? 's' : ''}</span>
                    <span className="text-steel">VS</span>
                    <span className="text-crimson">{dispute.account.challengerCount} Challenger{dispute.account.challengerCount !== 1 ? 's' : ''}</span>
                  </div>
                  {/* Stakes/Bond amounts */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-sky-400">
                      {!subject.account.freeCase ? (
                        <>
                          <span>{((dispute.account.stakeHeld.toNumber() + dispute.account.directStakeHeld.toNumber()) / LAMPORTS_PER_SOL).toFixed(2)} SOL</span>
                          <span className="text-steel text-xs ml-1">(matched)</span>
                        </>
                      ) : '-'}
                    </div>
                    <span className="text-crimson">
                      {(dispute.account.totalBond.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL
                    </span>
                  </div>
                  {/* Power bar - Defender (blue) on left, Challenger (red) on right */}
                  <div className="space-y-1">
                    <div className="h-3 rounded overflow-hidden flex bg-obsidian">
                      <div className="h-full transition-all" style={{ width: `${100 - favorPercent}%`, backgroundColor: '#0ea5e9' }} />
                      <div className="h-full transition-all" style={{ width: `${favorPercent}%`, backgroundColor: '#dc2626' }} />
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-sky-400">{(100 - favorPercent).toFixed(0)}% for Defender</span>
                      <span className="text-crimson">{favorPercent.toFixed(0)}% for Challenger</span>
                    </div>
                  </div>
                  {/* Neutral data: Timer, Votes, Juror Fees */}
                  <div className="grid grid-cols-3 text-sm pt-2 border-t border-slate-light/50">
                    <div>
                      <p className="text-steel text-xs">Time Left</p>
                      <p className="text-parchment flex items-center gap-1">
                        <ClockIcon />
                        <Countdown endTime={dispute.account.votingEndsAt.toNumber() * 1000} />
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-steel text-xs">Votes</p>
                      <p className="text-parchment">{dispute.account.voteCount}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-steel text-xs">Juror Pot</p>
                      <p className="text-gold">{disputeJurorFees}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========== DISPUTE SECTION (CHALLENGER SIDE) ========== */}
            {dispute && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-crimson rounded"></div>
                  <h4 className="text-xs font-semibold text-crimson uppercase tracking-wider">Dispute (Challenger Side)</h4>
                </div>
                <div className="p-4 bg-obsidian border border-crimson/30 space-y-3">
                  {/* Title row with voted badge */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-crimson font-medium">{disputeContent?.title || getDisputeTypeLabel(dispute.account.disputeType)}</p>
                    <div className="flex items-center gap-2">
                      {outcome && <span className={`text-xs font-medium ${outcome.class}`}>{outcome.label}</span>}
                      {existingVote && <span className="text-emerald flex items-center gap-0.5 text-xs"><CheckIcon /> Voted</span>}
                    </div>
                  </div>
                  {/* Reason */}
                  {disputeContent?.reason && <p className="text-sm text-steel">{disputeContent.reason}</p>}
                  {/* Stats grid */}
                  <div className="grid grid-cols-2 text-sm pt-2 border-t border-slate-light/50">
                    <div>
                      <p className="text-steel text-xs">Total Bond</p>
                      <p className="text-crimson">{(dispute.account.totalBond.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL</p>
                    </div>
                    <div className="text-right">
                      <p className="text-steel text-xs">Challengers</p>
                      <p className="text-crimson">{dispute.account.challengerCount}</p>
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
                      {!subject.account.freeCase && !canResolve && (
                        <JoinForm
                          type="challenger"
                          onJoin={(amount) => handleJoinChallengers(subjectKey, amount)}
                          isLoading={actionLoading}
                        />
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
                    <VoteForm
                      existingVote={existingVote}
                      onVote={(stake, choice, rationale) => handleVote(disputeKey!, stake, choice, rationale)}
                      isLoading={actionLoading}
                    />
                  )}
                </div>
              </div>
            )}

            {/* ========== CLAIM SECTION (for resolved disputes) ========== */}
            {dispute && isResolvedDispute && publicKey && (() => {
              const challengerRecord = disputeKey ? challengerRecords[disputeKey] : null;
              const defenderRecord = defenderRecords[subjectKey];
              const hasJurorClaim = existingVote && !existingVote.rewardClaimed;
              const hasChallengerClaim = challengerRecord && !challengerRecord.rewardClaimed;
              const hasDefenderClaim = defenderRecord && !defenderRecord.rewardClaimed;
              const hasAnyClaim = hasJurorClaim || hasChallengerClaim || hasDefenderClaim;

              if (!hasAnyClaim) return null;

              return (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-gold uppercase tracking-wider">Claim Rewards</h4>
                  <div className="p-4 bg-obsidian border border-gold/30 space-y-3">
                    <p className="text-xs text-steel mb-2">
                      Outcome: <span className={outcome?.class}>{outcome?.label}</span>
                    </p>

                    {/* Juror Claim */}
                    {hasJurorClaim && (
                      <div className="flex items-center justify-between py-2 border-t border-slate-light/30">
                        <div>
                          <p className="text-sm text-parchment">Juror Reward</p>
                          <p className="text-xs text-steel">
                            Voted {existingVote.choice.forChallenger ? "for Challenger" : "for Defender"} •
                            {(existingVote.stakeAllocated.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL
                          </p>
                        </div>
                        <button
                          onClick={() => handleClaimJurorReward(disputeKey!, subjectKey)}
                          disabled={actionLoading}
                          className="btn btn-primary py-1.5 px-3 text-sm"
                        >
                          {actionLoading ? "..." : "Claim"}
                        </button>
                      </div>
                    )}

                    {/* Challenger Claim */}
                    {hasChallengerClaim && (
                      <div className="flex items-center justify-between py-2 border-t border-slate-light/30">
                        <div>
                          <p className="text-sm text-crimson">Challenger Reward</p>
                          <p className="text-xs text-steel">
                            Bond: {(challengerRecord.bond.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL
                          </p>
                        </div>
                        <button
                          onClick={() => handleClaimChallengerReward(disputeKey!, subjectKey)}
                          disabled={actionLoading}
                          className="btn btn-secondary py-1.5 px-3 text-sm border-crimson/50 hover:border-crimson"
                        >
                          <span className="text-crimson">{actionLoading ? "..." : "Claim"}</span>
                        </button>
                      </div>
                    )}

                    {/* Defender Claim */}
                    {hasDefenderClaim && (
                      <div className="flex items-center justify-between py-2 border-t border-slate-light/30">
                        <div>
                          <p className="text-sm text-sky-400">Defender Reward</p>
                          <p className="text-xs text-steel">
                            Stake: {(defenderRecord.stake.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL
                          </p>
                        </div>
                        <button
                          onClick={() => handleClaimDefenderReward(disputeKey!, subjectKey)}
                          disabled={actionLoading}
                          className="btn btn-secondary py-1.5 px-3 text-sm border-sky-500/50 hover:border-sky-400"
                        >
                          <span className="text-sky-400">{actionLoading ? "..." : "Claim"}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ========== ALL JUROR REMARKS SECTION ========== */}
            {dispute && disputeVotes.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-steel uppercase tracking-wider">Juror Remarks ({disputeVotes.length})</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {disputeVotes.map((vote, i) => {
                    const hasRationale = vote.account.rationaleCid && vote.account.rationaleCid.length > 0;
                    const isForChallenger = vote.account.choice.forChallenger;
                    const isForDefender = vote.account.choice.forDefender;
                    const jurorAddress = vote.account.juror.toBase58();
                    const stakeAmount = vote.account.stakeAllocated.toNumber() / LAMPORTS_PER_SOL;
                    const votingPower = vote.account.votingPower.toNumber() / LAMPORTS_PER_SOL;

                    return (
                      <div key={i} className={`p-3 bg-obsidian border ${isForChallenger ? "border-crimson/30" : "border-sky-500/30"}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${isForChallenger ? "text-crimson" : "text-sky-400"}`}>
                              {isForChallenger ? "FOR CHALLENGER" : isForDefender ? "FOR DEFENDER" : "ABSTAIN"}
                            </span>
                            <span className="text-[10px] text-steel">
                              {jurorAddress.slice(0, 4)}...{jurorAddress.slice(-4)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-gold">{stakeAmount.toFixed(4)} SOL</span>
                            {votingPower !== stakeAmount && (
                              <span className="text-[10px] text-steel ml-1">({votingPower.toFixed(4)} power)</span>
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
            {disputeKey && disputeCids[disputeKey] && (
              <a href={getUrl(disputeCids[disputeKey])} target="_blank" rel="noopener noreferrer" className="text-xs text-gold hover:text-gold-light flex items-center gap-1">
                View dispute on IPFS <LinkIcon />
              </a>
            )}

            {/* ========== HISTORY SECTION (collapsible with full details) ========== */}
            {(() => {
              const pastDisputes = disputes.filter(d =>
                d.account.subject.toBase58() === subjectKey &&
                d.account.status.resolved &&
                d.publicKey.toBase58() !== disputeKey
              );
              if (pastDisputes.length === 0) return null;
              return (
                <div className="space-y-3">
                  <button
                    onClick={() => setHistoryExpanded(!historyExpanded)}
                    className="flex items-center gap-2 w-full text-left hover:opacity-80 transition-opacity"
                  >
                    <h4 className="text-xs font-semibold text-steel uppercase tracking-wider">History ({pastDisputes.length})</h4>
                    <ChevronDownIcon expanded={historyExpanded} />
                  </button>
                  {historyExpanded && (
                    <div className="space-y-4">
                      {pastDisputes.map((pastDispute, i) => {
                        const dKey = pastDispute.publicKey.toBase58();
                        const dContent = disputeContents[dKey];
                        const dOutcome = getOutcomeLabel(pastDispute.account.outcome);
                        const totalVotesHist = pastDispute.account.votesFavorWeight.toNumber() + pastDispute.account.votesAgainstWeight.toNumber();
                        const favorPercentHist = totalVotesHist > 0 ? (pastDispute.account.votesFavorWeight.toNumber() / totalVotesHist) * 100 : 50;

                        return (
                          <div key={i} className="border border-slate-light">
                            {/* History dispute header */}
                            <div className="p-3 bg-slate-light/30 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-medium ${dOutcome.class}`}>{dOutcome.label}</span>
                                <span className="text-[10px] text-steel">{new Date(pastDispute.account.resolvedAt.toNumber() * 1000).toLocaleDateString()}</span>
                              </div>
                              <span className="text-[10px] text-steel">{getDisputeTypeLabel(pastDispute.account.disputeType)}</span>
                            </div>

                            {/* History VS / Power bar */}
                            <div className="p-3 bg-slate-light/10 space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-sky-400">{pastDispute.account.snapshotDefenderCount} Defender{pastDispute.account.snapshotDefenderCount !== 1 ? 's' : ''}</span>
                                <span className="text-crimson">{pastDispute.account.challengerCount} Challenger{pastDispute.account.challengerCount !== 1 ? 's' : ''}</span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-sky-400">
                                  {((pastDispute.account.stakeHeld.toNumber() + pastDispute.account.directStakeHeld.toNumber()) / LAMPORTS_PER_SOL).toFixed(2)} SOL
                                </span>
                                <span className="text-crimson">
                                  {(pastDispute.account.totalBond.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL
                                </span>
                              </div>
                              <div className="h-2 rounded overflow-hidden flex bg-obsidian">
                                <div className="h-full" style={{ width: `${100 - favorPercentHist}%`, backgroundColor: '#0ea5e9' }} />
                                <div className="h-full" style={{ width: `${favorPercentHist}%`, backgroundColor: '#dc2626' }} />
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-sky-400">{(100 - favorPercentHist).toFixed(0)}%</span>
                                <span className="text-steel">{pastDispute.account.voteCount} votes</span>
                                <span className="text-crimson">{favorPercentHist.toFixed(0)}%</span>
                              </div>
                            </div>

                            {/* History dispute details */}
                            <div className="p-3 bg-obsidian space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-sm text-crimson font-medium">{dContent?.title || "Dispute"}</p>
                                <span className="text-[10px] text-steel px-1.5 py-0.5 bg-slate-light/30 rounded">
                                  {getDisputeTypeLabel(pastDispute.account.disputeType)}
                                </span>
                              </div>
                              {dContent?.reason && (
                                <div>
                                  <p className="text-[10px] text-steel uppercase tracking-wider mb-0.5">Reason</p>
                                  <p className="text-xs text-parchment">{dContent.reason}</p>
                                </div>
                              )}
                              {dContent?.requestedOutcome && (
                                <div>
                                  <p className="text-[10px] text-steel uppercase tracking-wider mb-0.5">Requested Outcome</p>
                                  <p className="text-xs text-parchment">{dContent.requestedOutcome}</p>
                                </div>
                              )}
                              {/* Resolution info */}
                              <div className="pt-2 border-t border-slate-light/30 grid grid-cols-2 gap-2 text-[10px]">
                                <div>
                                  <span className="text-steel">Resolved: </span>
                                  <span className="text-parchment">{new Date(pastDispute.account.resolvedAt.toNumber() * 1000).toLocaleString()}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-steel">Duration: </span>
                                  <span className="text-parchment">
                                    {Math.round((pastDispute.account.votingEndsAt.toNumber() - pastDispute.account.votingStartsAt.toNumber()) / 3600)}h voting
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  };

  // Get dispute subject data for modal
  const disputeSubject = showCreateDispute ? subjects.find(s => s.publicKey.toBase58() === showCreateDispute) : null;
  const disputeSubjectContent = disputeSubject ? subjectContents[disputeSubject.publicKey.toBase58()] : null;

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
              <div className="flex gap-1 mb-4 max-w-xl">
                {(["active", "disputed", "voted", "claims"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={`flex-1 py-1.5 text-xs uppercase tracking-wide ${activeFilter === f ? (f === "claims" ? "bg-gold text-obsidian font-semibold" : "bg-gold text-obsidian font-semibold") : "bg-slate-light/50 text-steel hover:text-parchment"}`}
                  >
                    {f} ({f === "active" ? activeSubjects.length : f === "disputed" ? disputedItems.length : f === "voted" ? myVotedDisputes.length : claimableDisputes.length})
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeItems.length === 0 ? (
                  <p className="text-steel text-xs text-center py-4 col-span-full">
                    {activeFilter === "active" ? "No active subjects" : activeFilter === "disputed" ? "No active disputes" : activeFilter === "voted" ? (jurorAccount ? "No votes cast" : "Register as juror to vote") : "No pending claims"}
                  </p>
                ) : (
                  activeItems.map((item: any, i: number) => <ItemCard key={i} subject={item.subject} dispute={item.dispute} isResolved={item.isResolved} />)
                )}
              </div>
            </div>

            {/* Invalidated Section */}
            <div className="bg-slate/30 border border-slate-light p-4">
              <div className="flex items-center gap-2 mb-4">
                <GavelIcon />
                <h2 className="text-sm font-semibold text-ivory uppercase tracking-wider">Invalidated</h2>
                <span className="text-xs text-steel ml-auto">{invalidatedSubjects.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {invalidatedSubjects.length === 0 ? (
                  <p className="text-steel text-xs text-center py-4 col-span-full">No invalidated subjects</p>
                ) : (
                  invalidatedSubjects.map((s, i) => {
                    // Find the resolved dispute that invalidated this subject
                    const invalidatingDispute = disputes.find(d =>
                      d.account.subject.toBase58() === s.publicKey.toBase58() &&
                      d.account.status.resolved &&
                      d.account.outcome.challengerWins
                    );
                    return <ItemCard key={i} subject={s} dispute={invalidatingDispute} isResolved={true} />;
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <DetailModal />
      <CreateSubjectModal
        isOpen={showCreateSubject}
        onClose={() => setShowCreateSubject(false)}
        onSubmit={handleCreateSubject}
        isLoading={actionLoading || isUploading}
      />
      <CreateDisputeModal
        isOpen={!!showCreateDispute}
        onClose={() => setShowCreateDispute(null)}
        onSubmit={handleCreateDispute}
        subjectContent={disputeSubjectContent}
        matchMode={disputeSubject?.account.matchMode ?? false}
        maxStake={disputeSubject?.account.maxStake?.toNumber() ?? 0}
        freeCase={disputeSubject?.account.freeCase ?? false}
        isLoading={actionLoading || isUploading}
      />
    </div>
  );
}
