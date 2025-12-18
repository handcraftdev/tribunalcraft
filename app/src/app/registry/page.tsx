"use client";

import { useState, useEffect, memo, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Navigation } from "@/components/Navigation";
import { useTribunalcraft } from "@/hooks/useTribunalcraft";
import { useUpload, useContentFetch } from "@/hooks/useUpload";
import { PublicKey, LAMPORTS_PER_SOL, Keypair } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import type { DisputeType } from "@/hooks/useTribunalcraft";
import type { SubjectContent, DisputeContent } from "@/lib/content-types";
import { SubjectCard, SubjectModal, DISPUTE_TYPES, SUBJECT_CATEGORIES, SubjectData, DisputeData, VoteData } from "@/components/subject";
import { FileIcon, GavelIcon, PlusIcon, XIcon } from "@/components/Icons";

// Create Dispute Modal
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

// Create Subject Modal
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
  } = useTribunalcraft();

  const { uploadSubject, uploadDispute, isUploading } = useUpload();
  const { fetchSubject: fetchSubjectContent, fetchDispute: fetchDisputeContent, getUrl } = useContentFetch();

  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [disputes, setDisputes] = useState<DisputeData[]>([]);
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
  const [existingVotes, setExistingVotes] = useState<Record<string, VoteData>>({});
  const [disputeVotes, setDisputeVotes] = useState<VoteData[]>([]);

  // Challenger/Defender records for claims (only used in modal)
  const [challengerRecords, setChallengerRecords] = useState<Record<string, any>>({});
  const [defenderRecords, setDefenderRecords] = useState<Record<string, any>>({});

  // Modal state
  const [selectedItem, setSelectedItem] = useState<{ subject: SubjectData; dispute: DisputeData | null } | null>(null);
  const [showCreateSubject, setShowCreateSubject] = useState(false);
  const [showCreateDispute, setShowCreateDispute] = useState<string | null>(null);

  // Section filter - only global data (Valid and Disputed)
  const [activeFilter, setActiveFilter] = useState<"valid" | "disputed">("valid");

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

          // Fetch vote records for pending disputes (for voting UI)
          const pendingDisputes = disputesData.filter((d: any) => d.account.status.pending);
          const votes: Record<string, VoteData> = {};
          for (const d of pendingDisputes) {
            const [voteRecordPda] = getVoteRecordPDA(d.publicKey, publicKey);
            try {
              const voteRecord = await fetchVoteRecord(voteRecordPda);
              if (voteRecord) votes[d.publicKey.toBase58()] = { publicKey: voteRecordPda, account: voteRecord };
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
    if (client) {
      loadData();
    }
  }, [publicKey, client]);

  // Fetch votes and records when a subject is selected
  useEffect(() => {
    const fetchSelectedData = async () => {
      if (!selectedItem || !publicKey) {
        setDisputeVotes([]);
        return;
      }

      const { subject, dispute } = selectedItem;
      const subjectKey = subject.publicKey.toBase58();

      // Fetch dispute votes
      if (dispute) {
        const votes = await fetchVotesByDispute(dispute.publicKey);
        setDisputeVotes(votes || []);

        // Fetch challenger record for resolved disputes
        if (dispute.account.status.resolved) {
          const [challengerRecordPda] = getChallengerRecordPDA(dispute.publicKey, publicKey);
          try {
            const record = await fetchChallengerRecord(challengerRecordPda);
            if (record) setChallengerRecords(prev => ({ ...prev, [dispute.publicKey.toBase58()]: record }));
          } catch {}

          // Fetch defender record
          const [defenderRecordPda] = getDefenderRecordPDA(subject.publicKey, publicKey);
          try {
            const record = await fetchDefenderRecord(defenderRecordPda);
            if (record) setDefenderRecords(prev => ({ ...prev, [subjectKey]: record }));
          } catch {}

          // Fetch vote record for resolved disputes
          const [voteRecordPda] = getVoteRecordPDA(dispute.publicKey, publicKey);
          try {
            const voteRecord = await fetchVoteRecord(voteRecordPda);
            if (voteRecord) setExistingVotes(prev => ({
              ...prev,
              [dispute.publicKey.toBase58()]: { publicKey: voteRecordPda, account: voteRecord }
            }));
          } catch {}
        }
      } else {
        setDisputeVotes([]);
      }
    };
    fetchSelectedData();
  }, [selectedItem, publicKey]);

  // Filter data for sections
  const validSubjects = subjects.filter(s => s.account.status.valid);
  const disputedItems = disputes.filter(d => d.account.status.pending);
  const invalidSubjects = subjects.filter(s => s.account.status.invalid);

  // Get items based on active filter
  const getActiveItems = () => {
    switch (activeFilter) {
      case "valid":
        return validSubjects.map(s => ({ subject: s, dispute: null as DisputeData | null }));
      case "disputed":
        return disputedItems.map(d => {
          const subject = subjects.find(s => s.publicKey.toBase58() === d.account.subject.toBase58());
          return subject ? { subject, dispute: d } : null;
        }).filter((item): item is { subject: SubjectData; dispute: DisputeData } => item !== null);
    }
  };
  const activeItems = getActiveItems();

  // Get past disputes for history (only for selected subject)
  const getPastDisputes = (subjectKey: string, currentDisputeKey?: string) => {
    return disputes.filter(d =>
      d.account.subject.toBase58() === subjectKey &&
      d.account.status.resolved &&
      d.publicKey.toBase58() !== currentDisputeKey
    );
  };

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

  const handleVote = useCallback(async (stakeAmount: string, choice: "forChallenger" | "forDefender", rationale: string) => {
    if (!publicKey || !jurorAccount || !selectedItem?.dispute) return;
    setActionLoading(true);
    setError(null);
    try {
      const disputeKey = selectedItem.dispute.publicKey.toBase58();
      const stake = new BN(parseFloat(stakeAmount) * LAMPORTS_PER_SOL);
      const hasExistingVote = existingVotes[disputeKey];

      if (hasExistingVote) {
        await addToVote(selectedItem.dispute.publicKey, stake);
        setSuccess(`Added ${stakeAmount} SOL to vote`);
      } else {
        const voteChoice = { [choice]: {} } as any;
        await voteOnDispute(selectedItem.dispute.publicKey, voteChoice, stake, rationale);
        setSuccess("Vote cast");
      }
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to vote");
    }
    setActionLoading(false);
  }, [publicKey, jurorAccount, selectedItem, existingVotes, addToVote, voteOnDispute, loadData]);

  const handleAddStake = useCallback(async (amount: string) => {
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

  const handleJoinChallengers = useCallback(async (amount: string) => {
    if (!publicKey || !selectedItem) return;
    setActionLoading(true);
    setError(null);
    try {
      const subject = selectedItem.subject;
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
  }, [publicKey, selectedItem, getDisputePDA, addToDispute, loadData]);

  const handleResolve = useCallback(async () => {
    if (!publicKey || !selectedItem?.dispute) return;
    setActionLoading(true);
    setError(null);
    try {
      await resolveDispute(selectedItem.dispute.publicKey, selectedItem.subject.publicKey);
      setSuccess("Dispute resolved");
      setSelectedItem(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to resolve");
    }
    setActionLoading(false);
  }, [publicKey, selectedItem, resolveDispute, loadData]);

  const handleClaimJurorReward = useCallback(async () => {
    if (!publicKey || !selectedItem?.dispute) return;
    setActionLoading(true);
    setError(null);
    try {
      const [voteRecordPda] = getVoteRecordPDA(selectedItem.dispute.publicKey, publicKey);
      await claimJurorReward(selectedItem.dispute.publicKey, selectedItem.subject.publicKey, voteRecordPda);
      setSuccess("Juror reward claimed!");
      setSelectedItem(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to claim juror reward");
    }
    setActionLoading(false);
  }, [publicKey, selectedItem, getVoteRecordPDA, claimJurorReward, loadData]);

  const handleClaimChallengerReward = useCallback(async () => {
    if (!publicKey || !selectedItem?.dispute) return;
    setActionLoading(true);
    setError(null);
    try {
      const [challengerRecordPda] = getChallengerRecordPDA(selectedItem.dispute.publicKey, publicKey);
      await claimChallengerReward(selectedItem.dispute.publicKey, selectedItem.subject.publicKey, challengerRecordPda);
      setSuccess("Challenger reward claimed!");
      setSelectedItem(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to claim challenger reward");
    }
    setActionLoading(false);
  }, [publicKey, selectedItem, getChallengerRecordPDA, claimChallengerReward, loadData]);

  const handleClaimDefenderReward = useCallback(async () => {
    if (!publicKey || !selectedItem?.dispute) return;
    setActionLoading(true);
    setError(null);
    try {
      const [defenderRecordPda] = getDefenderRecordPDA(selectedItem.subject.publicKey, publicKey);
      await claimDefenderReward(selectedItem.dispute.publicKey, selectedItem.subject.publicKey, defenderRecordPda);
      setSuccess("Defender reward claimed!");
      setSelectedItem(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to claim defender reward");
    }
    setActionLoading(false);
  }, [publicKey, selectedItem, getDefenderRecordPDA, claimDefenderReward, loadData]);

  // Get dispute subject data for create dispute modal
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
                <h2 className="text-sm font-semibold text-ivory uppercase tracking-wider">Browse</h2>
                <span className="text-xs text-steel ml-auto">{activeItems.length}</span>
              </div>
              {/* Filter Tabs - only Valid and Disputed */}
              <div className="flex gap-1 mb-4 max-w-md">
                {(["valid", "disputed"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={`flex-1 py-1.5 text-xs uppercase tracking-wide ${
                      activeFilter === f
                        ? "bg-gold text-obsidian font-semibold"
                        : "bg-slate-light/50 text-steel hover:text-parchment"
                    }`}
                  >
                    {f} ({f === "valid" ? validSubjects.length : disputedItems.length})
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeItems.length === 0 ? (
                  <p className="text-steel text-xs text-center py-4 col-span-full">
                    {activeFilter === "valid" ? "No valid subjects" : "No active disputes"}
                  </p>
                ) : (
                  activeItems.map((item, i) => (
                    <SubjectCard
                      key={i}
                      subject={item.subject}
                      dispute={item.dispute}
                      existingVote={item.dispute ? existingVotes[item.dispute.publicKey.toBase58()] : null}
                      subjectContent={subjectContents[item.subject.publicKey.toBase58()]}
                      disputeContent={item.dispute ? disputeContents[item.dispute.publicKey.toBase58()] : null}
                      onClick={() => setSelectedItem(item)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Invalid Section */}
            <div className="bg-slate/30 border border-slate-light p-4">
              <div className="flex items-center gap-2 mb-4">
                <GavelIcon />
                <h2 className="text-sm font-semibold text-ivory uppercase tracking-wider">Invalid</h2>
                <span className="text-xs text-steel ml-auto">{invalidSubjects.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {invalidSubjects.length === 0 ? (
                  <p className="text-steel text-xs text-center py-4 col-span-full">No invalid subjects</p>
                ) : (
                  invalidSubjects.map((s, i) => {
                    const invalidatingDispute = disputes.find(d =>
                      d.account.subject.toBase58() === s.publicKey.toBase58() &&
                      d.account.status.resolved &&
                      d.account.outcome.challengerWins
                    );
                    return (
                      <SubjectCard
                        key={i}
                        subject={s}
                        dispute={invalidatingDispute}
                        isResolved={true}
                        subjectContent={subjectContents[s.publicKey.toBase58()]}
                        disputeContent={invalidatingDispute ? disputeContents[invalidatingDispute.publicKey.toBase58()] : null}
                        onClick={() => setSelectedItem({ subject: s, dispute: invalidatingDispute || null })}
                      />
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Subject Detail Modal */}
      {selectedItem && (
        <SubjectModal
          subject={selectedItem.subject}
          dispute={selectedItem.dispute}
          subjectContent={subjectContents[selectedItem.subject.publicKey.toBase58()]}
          disputeContent={selectedItem.dispute ? disputeContents[selectedItem.dispute.publicKey.toBase58()] : null}
          existingVote={selectedItem.dispute ? existingVotes[selectedItem.dispute.publicKey.toBase58()] : null}
          jurorAccount={jurorAccount}
          disputeVotes={disputeVotes}
          pastDisputes={getPastDisputes(
            selectedItem.subject.publicKey.toBase58(),
            selectedItem.dispute?.publicKey.toBase58()
          )}
          pastDisputeContents={disputeContents}
          challengerRecord={selectedItem.dispute ? challengerRecords[selectedItem.dispute.publicKey.toBase58()] : null}
          defenderRecord={defenderRecords[selectedItem.subject.publicKey.toBase58()]}
          onClose={() => setSelectedItem(null)}
          onVote={handleVote}
          onAddStake={handleAddStake}
          onJoinChallengers={handleJoinChallengers}
          onResolve={handleResolve}
          onClaimJuror={handleClaimJurorReward}
          onClaimChallenger={handleClaimChallengerReward}
          onClaimDefender={handleClaimDefenderReward}
          onFileDispute={() => {
            setSelectedItem(null);
            setShowCreateDispute(selectedItem.subject.publicKey.toBase58());
          }}
          actionLoading={actionLoading}
          getIpfsUrl={getUrl}
          disputeCid={selectedItem.dispute ? disputeCids[selectedItem.dispute.publicKey.toBase58()] : undefined}
        />
      )}

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
