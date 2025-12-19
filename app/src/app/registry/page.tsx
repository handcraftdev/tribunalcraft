"use client";

import { useState, useEffect, memo, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Navigation } from "@/components/Navigation";
import { useTribunalcraft, calculateMinBond, INITIAL_REPUTATION } from "@/hooks/useTribunalcraft";
import { useUpload, useContentFetch } from "@/hooks/useUpload";
import { PublicKey, LAMPORTS_PER_SOL, Keypair } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import type { DisputeType, ChallengerAccount } from "@/hooks/useTribunalcraft";
import type { SubjectContent, DisputeContent } from "@/lib/content-types";
import { SubjectCard, SubjectModal, DISPUTE_TYPES, SUBJECT_CATEGORIES, SubjectData, DisputeData, VoteData } from "@/components/subject";
import { FileIcon, GavelIcon, PlusIcon, XIcon, MoonIcon } from "@/components/Icons";

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
  minBond,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (form: { type: string; title: string; reason: string; requestedOutcome: string; bondAmount: string }) => void;
  subjectContent: SubjectContent | null;
  matchMode: boolean;
  maxStake: number;
  freeCase: boolean;
  isLoading: boolean;
  minBond: number;
}) {
  // Calculate default bond as minBond in SOL
  const minBondSol = minBond / LAMPORTS_PER_SOL;
  const [form, setForm] = useState({
    type: "other",
    title: "",
    reason: "",
    requestedOutcome: "",
    bondAmount: minBondSol.toFixed(6),
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setForm({ type: "other", title: "", reason: "", requestedOutcome: "", bondAmount: minBondSol.toFixed(6) });
    }
  }, [isOpen, minBondSol]);

  const handleSubmit = () => {
    onSubmit(form);
  };

  // Check if entered bond is below minimum
  const enteredBond = parseFloat(form.bondAmount) * LAMPORTS_PER_SOL;
  const isBelowMin = !freeCase && enteredBond < minBond;

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
                <div className="flex gap-2">
                  <span className="text-xs text-gold">
                    Min: {minBondSol.toFixed(6)} SOL
                  </span>
                  {matchMode && (
                    <span className="text-xs text-steel">
                      | Max: {(maxStake / LAMPORTS_PER_SOL).toFixed(6)} SOL
                    </span>
                  )}
                </div>
              </div>
              <input
                value={form.bondAmount}
                onChange={e => setForm(f => ({ ...f, bondAmount: e.target.value }))}
                className={`input w-full ${isBelowMin ? 'border-crimson' : ''}`}
                autoComplete="off"
              />
              {isBelowMin && (
                <p className="text-[10px] text-crimson mt-1">Bond must be at least {minBondSol.toFixed(6)} SOL</p>
              )}
              {matchMode && !isBelowMin && (
                <p className="text-[10px] text-steel mt-1">Match mode: bond cannot exceed defender stake</p>
              )}
            </div>
          )}
          <button onClick={handleSubmit} disabled={isLoading || isBelowMin} className="btn btn-primary w-full">
            {isLoading ? "Submitting..." : "Submit Dispute"}
          </button>
        </div>
      </div>
    </div>
  );
});

// Restore Subject Modal (for Invalid subjects)
const RestoreModal = memo(function RestoreModal({
  isOpen,
  onClose,
  onSubmit,
  subjectContent,
  minStake,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (form: { title: string; reason: string; stakeAmount: string }) => void;
  subjectContent: SubjectContent | null;
  minStake: number;
  isLoading: boolean;
}) {
  const minStakeSol = (minStake / LAMPORTS_PER_SOL).toFixed(6);
  const [form, setForm] = useState({
    title: "",
    reason: "",
    stakeAmount: minStakeSol,
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setForm({ title: "", reason: "", stakeAmount: minStakeSol });
    }
  }, [isOpen, minStakeSol]);

  const handleSubmit = () => {
    onSubmit(form);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-obsidian/90 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate border border-slate-light max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-light flex items-center justify-between">
          <h3 className="text-lg font-semibold text-ivory">Restore Subject</h3>
          <button onClick={onClose} className="text-steel hover:text-parchment"><XIcon /></button>
        </div>
        <div className="p-4 space-y-4">
          {subjectContent && (
            <div className="p-3 bg-obsidian border border-slate-light">
              <p className="text-xs text-steel">Restoring Subject</p>
              <p className="text-sm text-parchment font-medium">{subjectContent.title}</p>
            </div>
          )}
          <div className="p-3 bg-purple-500/10 border border-purple-500/30 text-sm text-purple-300">
            Request to restore this subject from Invalid status. If successful, your stake (minus 20% fees) becomes the subject&apos;s backing and it returns to Valid status. If unsuccessful, your stake (minus 20% fees) is returned to you.
          </div>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Title (e.g., Request for Restoration)" className="input w-full" autoComplete="off" />
          <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Reason for restoration..." className="input w-full h-24" />
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-steel">Stake Amount (SOL)</label>
              <span className="text-xs text-purple-400">
                Min: {(minStake / LAMPORTS_PER_SOL).toFixed(6)} SOL
              </span>
            </div>
            <input value={form.stakeAmount} onChange={e => setForm(f => ({ ...f, stakeAmount: e.target.value }))} className="input w-full" autoComplete="off" />
            <p className="text-[10px] text-steel mt-1">Must be at least the previous dispute&apos;s total (stake + bond)</p>
          </div>
          <button onClick={handleSubmit} disabled={isLoading} className="btn btn-primary w-full bg-purple-600 hover:bg-purple-500">
            {isLoading ? "Submitting..." : "Submit Restoration Request"}
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
  poolBalance,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (form: any, subjectType: string) => void;
  isLoading: boolean;
  poolBalance: number; // Pool available balance in lamports (0 if no pool)
}) {
  const [subjectType, setSubjectType] = useState<"staked" | "free">("staked");
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "contract" as SubjectContent["category"],
    termsText: "",
    maxStake: "1",
    matchMode: true,
    votingPeriod: "24",
    directStake: "0",
  });

  const poolEmpty = poolBalance === 0;

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSubjectType("staked");
      setForm({ title: "", description: "", category: "contract", termsText: "", maxStake: "1", matchMode: true, votingPeriod: "24", directStake: "0" });
    }
  }, [isOpen]);

  const handleSubmit = () => {
    // If pool is empty and staked, require initial stake
    if (subjectType === "staked" && poolEmpty) {
      const stake = parseFloat(form.directStake || "0");
      if (stake <= 0) {
        alert("Initial stake is required when pool is empty");
        return;
      }
    }
    onSubmit(form, subjectType);
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
            {(["staked", "free"] as const).map(t => (
              <button key={t} onClick={() => setSubjectType(t)} className={`flex-1 py-2 text-xs uppercase tracking-wide ${subjectType === t ? "bg-gold text-obsidian font-semibold" : "bg-slate-light/50 text-steel hover:text-parchment"}`}>
                {t === "staked" ? "Staked" : "Free (No Stakes)"}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Title" className="input w-full" autoComplete="off" />
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as any }))} className="input">
                {SUBJECT_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" className="input w-full h-20" />
            <textarea value={form.termsText} onChange={e => setForm(f => ({ ...f, termsText: e.target.value }))} placeholder="Terms" className="input w-full h-16" />
          </div>
          <div className="border-t border-slate-light pt-4 space-y-3">
            <div>
              <label className="text-xs text-steel mb-1 block">Voting Period (hours)</label>
              <input value={form.votingPeriod} onChange={e => setForm(f => ({ ...f, votingPeriod: e.target.value }))} className="input w-full" autoComplete="off" />
            </div>
            {subjectType === "staked" && (
              <>
                <div>
                  <label className="text-xs text-steel mb-1 block">
                    Initial Stake (SOL) {poolEmpty && <span className="text-crimson">*</span>}
                  </label>
                  <input value={form.directStake} onChange={e => setForm(f => ({ ...f, directStake: e.target.value }))} className="input w-full" autoComplete="off" placeholder={poolEmpty ? "Required" : "0 (optional)"} />
                  <p className="text-[10px] text-steel mt-1">
                    {poolEmpty ? "Required - pool has no balance" : "Optional - pool will back this subject"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 p-2 cursor-pointer hover:bg-slate-light/20 rounded">
                    <input type="radio" name="stakeMode" checked={form.matchMode} onChange={() => setForm(f => ({ ...f, matchMode: true }))} className="w-4 h-4 accent-gold" />
                    <span className="text-sm text-parchment">Match</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 cursor-pointer hover:bg-slate-light/20 rounded">
                    <input type="radio" name="stakeMode" checked={!form.matchMode} onChange={() => setForm(f => ({ ...f, matchMode: false }))} className="w-4 h-4 accent-gold" />
                    <span className="text-sm text-parchment">Proportional</span>
                  </label>
                </div>
                {form.matchMode && (
                  <div>
                    <label className="text-xs text-steel mb-1 block">Max Stake per Dispute (SOL)</label>
                    <input value={form.maxStake} onChange={e => setForm(f => ({ ...f, maxStake: e.target.value }))} className="input w-full" autoComplete="off" />
                    <p className="text-[10px] text-steel mt-1">Maximum pool stake at risk per dispute</p>
                  </div>
                )}
              </>
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
    submitDispute,
    submitFreeDispute,
    submitRestore,
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
    voteOnRestore,
    addToVote,
    fetchJurorAccount,
    fetchVoteRecord,
    getJurorPDA,
    getVoteRecordPDA,
    fetchVotesByDispute,
    batchClaimRewards,
    getChallengerRecordPDA,
    getDefenderRecordPDA,
    fetchChallengerRecord,
    fetchDefenderRecord,
    fetchProtocolConfig,
    getChallengerPDA,
    fetchChallengerAccount,
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
  const [disputeVoteCounts, setDisputeVoteCounts] = useState<Record<string, { favor: number; against: number }>>({});

  // Challenger/Defender records for claims (only used in modal)
  const [challengerRecords, setChallengerRecords] = useState<Record<string, any>>({});
  const [defenderRecords, setDefenderRecords] = useState<Record<string, any>>({});
  const [disputeCreatorReputation, setDisputeCreatorReputation] = useState<number | null>(null);

  // Modal state
  const [selectedItem, setSelectedItem] = useState<{ subject: SubjectData; dispute: DisputeData | null } | null>(null);
  const [showCreateSubject, setShowCreateSubject] = useState(false);
  const [showCreateDispute, setShowCreateDispute] = useState<string | null>(null);
  const [showRestore, setShowRestore] = useState<string | null>(null);
  const [challengerAccount, setChallengerAccount] = useState<ChallengerAccount | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [subjectsData, disputesData] = await Promise.all([
        fetchAllSubjects(),
        fetchAllDisputes(),
      ]);
      setSubjects(subjectsData || []);

      // If no disputes fetched but there are disputed subjects, fetch disputes individually
      let finalDisputes = disputesData || [];
      if (finalDisputes.length === 0 && subjectsData && client) {
        const disputedSubjects = subjectsData.filter(s =>
          ("disputed" in s.account.status || "restoring" in s.account.status) &&
          !s.account.dispute.equals(PublicKey.default)
        );
        for (const s of disputedSubjects) {
          try {
            const dispute = await client.fetchDispute(s.account.dispute);
            if (dispute) {
              finalDisputes.push({ publicKey: s.account.dispute, account: dispute });
            }
          } catch (err) {
            console.warn(`Failed to fetch dispute for subject ${s.publicKey.toBase58()}:`, err);
          }
        }
      }
      setDisputes(finalDisputes);

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
          // For restorations, CID is stored directly on dispute account
          if (d.account.isRestore) {
            const cid = d.account.detailsCid;
            if (cid) {
              setDisputeCids(prev => ({ ...prev, [disputeKey]: cid }));
              fetchDisputeContent(cid).then(content => {
                if (content) setDisputeContents(prev => ({ ...prev, [disputeKey]: content }));
              });
            }
          } else {
            // For regular disputes, get CID from first challenger
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

          // Fetch vote counts for pending disputes (for SubjectCard display)
          const counts: Record<string, { favor: number; against: number }> = {};
          for (const d of pendingDisputes) {
            try {
              const allVotes = await fetchVotesByDispute(d.publicKey);
              if (allVotes) {
                let favor = 0;
                let against = 0;
                for (const v of allVotes) {
                  // For restorations: forRestoration is favor, againstRestoration is against
                  // For regular disputes: forChallenger is favor, forDefender is against
                  if (d.account.isRestore) {
                    if ("forRestoration" in v.account.restoreChoice) favor++;
                    else if ("againstRestoration" in v.account.restoreChoice) against++;
                  } else {
                    if ("forChallenger" in v.account.choice) favor++;
                    else if ("forDefender" in v.account.choice) against++;
                  }
                }
                counts[d.publicKey.toBase58()] = { favor, against };
              }
            } catch {}
          }
          setDisputeVoteCounts(counts);
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
          setSelectedItem({ subject: updatedSubject, dispute: updatedDispute });
        }
      }
    }
  }, [disputes, subjects]);

  // Fetch votes and records when a subject is selected
  useEffect(() => {
    const fetchSelectedData = async () => {
      if (!selectedItem || !publicKey) {
        setDisputeVotes([]);
        setDisputeCreatorReputation(null);
        return;
      }

      const { subject, dispute } = selectedItem;
      const subjectKey = subject.publicKey.toBase58();

      // Get all disputes for this subject (current + history)
      const subjectDisputes = disputes.filter(d =>
        d.account.subject.toBase58() === subjectKey
      );

      // Fetch defender record (applies to all disputes on this subject)
      const [defenderRecordPda] = getDefenderRecordPDA(subject.publicKey, publicKey);
      try {
        const record = await fetchDefenderRecord(defenderRecordPda);
        if (record) setDefenderRecords(prev => ({ ...prev, [subjectKey]: record }));
      } catch {}

      // Fetch records for ALL disputes on this subject (for history)
      for (const d of subjectDisputes) {
        const dKey = d.publicKey.toBase58();

        // Fetch vote record
        const [voteRecordPda] = getVoteRecordPDA(d.publicKey, publicKey);
        try {
          const voteRecord = await fetchVoteRecord(voteRecordPda);
          if (voteRecord) setExistingVotes(prev => ({
            ...prev,
            [dKey]: { publicKey: voteRecordPda, account: voteRecord }
          }));
        } catch {}

        // Fetch challenger record
        const [challengerRecordPda] = getChallengerRecordPDA(d.publicKey, publicKey);
        try {
          const record = await fetchChallengerRecord(challengerRecordPda);
          if (record) setChallengerRecords(prev => ({ ...prev, [dKey]: record }));
        } catch {}
      }

      // Fetch current dispute specific data
      if (dispute) {
        const votes = await fetchVotesByDispute(dispute.publicKey);
        setDisputeVotes(votes || []);

        // Fetch the dispute creator's reputation
        try {
          const challengers = await fetchChallengersByDispute(dispute.publicKey);
          if (challengers && challengers.length > 0) {
            const creatorPubkey = challengers[0].account.challenger;
            const [creatorChallengerPda] = getChallengerPDA(creatorPubkey);
            const creatorAccount = await fetchChallengerAccount(creatorChallengerPda);
            if (creatorAccount) {
              const rep = creatorAccount.reputation;
              setDisputeCreatorReputation(
                typeof rep === 'number' ? rep : (rep as any).toNumber?.() ?? null
              );
            } else {
              setDisputeCreatorReputation(null);
            }
          } else {
            setDisputeCreatorReputation(null);
          }
        } catch {
          setDisputeCreatorReputation(null);
        }
      } else {
        setDisputeVotes([]);
        setDisputeCreatorReputation(null);
      }
    };
    fetchSelectedData();
  }, [selectedItem, publicKey, disputes]);

  // Filter data for sections
  const validSubjects = subjects.filter(s => s.account.status.valid);
  const disputedItems = disputes.filter(d => d.account.status.pending && !d.account.isRestore);
  const invalidSubjects = subjects.filter(s => s.account.status.invalid);
  const dormantSubjects = subjects.filter(s => s.account.status.dormant);
  const restoringSubjects = subjects.filter(s => s.account.status.restoring);

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

      const subjectKeypair = Keypair.generate();
      const subjectId = subjectKeypair.publicKey;
      const votingPeriod = new BN(parseInt(form.votingPeriod) * 3600);
      const maxStake = new BN(parseFloat(form.maxStake || "1") * LAMPORTS_PER_SOL);
      const initialStake = parseFloat(form.directStake || "0");

      // Create subject - all staked subjects are linked (pool auto-created)
      await createSubject({
        subjectId,
        detailsCid: uploadResult.cid,
        votingPeriod,
        maxStake,
        matchMode: form.matchMode,
        freeCase: subjectType === "free",
        stake: initialStake > 0 ? new BN(initialStake * LAMPORTS_PER_SOL) : undefined,
      });

      setSuccess("Subject created");
      setShowCreateSubject(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to create subject");
    }
    setActionLoading(false);
  }, [publicKey, uploadSubject, createSubject, loadData]);

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
        // Get pool owner if subject is linked to a pool
        let poolOwner: PublicKey | undefined;
        const isLinked = !subject.account.defenderPool.equals(PublicKey.default);
        if (isLinked) {
          const defenderPoolData = await fetchDefenderPool(subject.account.defenderPool);
          if (defenderPoolData) {
            poolOwner = defenderPoolData.owner;
          }
        }

        await submitDispute(
          subject.publicKey,
          { disputeCount: subject.account.disputeCount, defenderPool: subject.account.defenderPool, poolOwner },
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

  const handleSubmitRestore = useCallback(async (form: { title: string; reason: string; stakeAmount: string }) => {
    if (!publicKey || !showRestore) return;
    setActionLoading(true);
    setError(null);
    try {
      const subject = subjects.find(s => s.publicKey.toBase58() === showRestore);
      if (!subject) throw new Error("Subject not found");

      // Upload restore content (reuse dispute content structure)
      const uploadResult = await uploadDispute({
        title: form.title,
        reason: form.reason,
        type: "other",
        subjectCid: subject.account.detailsCid,
        requestedOutcome: "Restore subject to valid status",
      });
      if (!uploadResult) throw new Error("Failed to upload content");

      const stake = new BN(parseFloat(form.stakeAmount) * LAMPORTS_PER_SOL);
      const disputeType: DisputeType = { other: {} } as DisputeType;

      await submitRestore(
        subject.publicKey,
        { disputeCount: subject.account.disputeCount },
        disputeType,
        uploadResult.cid,
        stake
      );

      setSuccess("Restoration request submitted");
      setShowRestore(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to submit restoration request");
    }
    setActionLoading(false);
  }, [publicKey, showRestore, subjects, uploadDispute, submitRestore, loadData]);

  const handleVote = useCallback(async (disputeKey: string, stakeAmount: string, choice: "forChallenger" | "forDefender" | "forRestoration" | "againstRestoration", rationale: string) => {
    if (!publicKey || !jurorAccount) return;
    setActionLoading(true);
    setError(null);
    try {
      const disputePubkey = new PublicKey(disputeKey);
      const stake = new BN(parseFloat(stakeAmount) * LAMPORTS_PER_SOL);
      const hasExistingVote = existingVotes[disputeKey];
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
  }, [publicKey, jurorAccount, existingVotes, addToVote, voteOnDispute, voteOnRestore, loadData]);

  const handleAddStake = useCallback(async (amount: string) => {
    if (!publicKey || !selectedItem) return;
    setActionLoading(true);
    setError(null);
    try {
      const subject = selectedItem.subject;
      const isDormant = subject.account.status.dormant;
      const isDisputed = subject.account.status.disputed;
      const stake = new BN(parseFloat(amount) * LAMPORTS_PER_SOL);

      // For proportional mode subjects with active dispute, pass the dispute info
      let proportionalDispute: { dispute: PublicKey; treasury: PublicKey } | undefined;
      if (isDisputed && !subject.account.matchMode && !subject.account.dispute.equals(PublicKey.default)) {
        const protocolConfig = await fetchProtocolConfig();
        if (protocolConfig) {
          proportionalDispute = {
            dispute: subject.account.dispute,
            treasury: protocolConfig.treasury,
          };
        }
      }

      await addToStake(subject.publicKey, stake, proportionalDispute);
      setSuccess(isDormant ? `Subject revived with ${amount} SOL` : `Added ${amount} SOL stake`);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to add stake");
    }
    setActionLoading(false);
  }, [publicKey, selectedItem, addToStake, loadData, fetchProtocolConfig]);

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
  }, [publicKey, selectedItem, addToDispute, fetchDefenderPool, loadData]);

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
    if (!publicKey || !selectedItem) return;
    setActionLoading(true);
    setError(null);
    const claimedRewards: string[] = [];
    try {
      const disputePubkey = new PublicKey(disputeKey);
      const subjectPubkey = selectedItem.subject.publicKey;

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
      }

      if (claims.challenger) {
        const [challengerRecordPda] = getChallengerRecordPDA(disputePubkey, publicKey);
        batchParams.challengerClaims = [{ dispute: disputePubkey, subject: subjectPubkey, challengerRecord: challengerRecordPda }];
        claimedRewards.push("Challenger");
      }

      if (claims.defender) {
        const [defenderRecordPda] = getDefenderRecordPDA(subjectPubkey, publicKey);
        batchParams.defenderClaims = [{ dispute: disputePubkey, subject: subjectPubkey, defenderRecord: defenderRecordPda }];
        claimedRewards.push("Defender");
      }

      // Process all claims in a single transaction
      await batchClaimRewards(batchParams);

      setSuccess(`${claimedRewards.join(", ")} reward${claimedRewards.length > 1 ? "s" : ""} claimed!`);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to claim rewards");
    }
    setActionLoading(false);
  }, [publicKey, selectedItem, getVoteRecordPDA, getChallengerRecordPDA, getDefenderRecordPDA, batchClaimRewards, loadData]);

  // Get dispute subject data for create dispute modal
  const disputeSubject = showCreateDispute ? subjects.find(s => s.publicKey.toBase58() === showCreateDispute) : null;
  const disputeSubjectContent = disputeSubject ? subjectContents[disputeSubject.publicKey.toBase58()] : null;

  // Fetch challenger account when dispute modal opens
  useEffect(() => {
    const fetchChallenger = async () => {
      if (showCreateDispute && publicKey) {
        try {
          const [challengerPda] = getChallengerPDA(publicKey);
          const account = await fetchChallengerAccount(challengerPda);
          setChallengerAccount(account);
        } catch {
          // Account doesn't exist yet - new challenger
          setChallengerAccount(null);
        }
      } else {
        setChallengerAccount(null);
      }
    };
    fetchChallenger();
  }, [showCreateDispute, publicKey, getChallengerPDA, fetchChallengerAccount]);

  // Calculate minimum bond based on challenger reputation
  // reputation is stored as u64 on-chain, which may come as number or BN
  const rawRep = challengerAccount?.reputation;
  const challengerReputation = rawRep != null
    ? (typeof rawRep === 'number' ? rawRep : (rawRep as any).toNumber?.() ?? rawRep)
    : null;
  const minBond = calculateMinBond(
    typeof challengerReputation === 'number' ? challengerReputation : INITIAL_REPUTATION
  );

  const restoreSubject = showRestore ? subjects.find(s => s.publicKey.toBase58() === showRestore) : null;
  const restoreSubjectContent = restoreSubject ? subjectContents[restoreSubject.publicKey.toBase58()] : null;

  return (
    <div className="min-h-screen bg-obsidian">
      <Navigation />

      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-10 animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-[1px] bg-gradient-to-r from-gold to-transparent" />
            <span className="text-xs uppercase tracking-[0.2em] text-gold font-medium">Subjects</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-4xl md:text-5xl font-bold text-ivory mb-3">
                Registry
              </h1>
              <p className="text-steel text-lg">
                Browse and manage registered subjects, disputes, and restorations
              </p>
            </div>
            {publicKey && (
              <button onClick={() => setShowCreateSubject(true)} className="btn btn-primary flex items-center gap-2">
                <PlusIcon /> New Subject
              </button>
            )}
          </div>
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

        {loading ? (
          <div className="tribunal-card p-12 text-center animate-slide-up stagger-2">
            <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin mx-auto mb-4" />
            <p className="text-steel">Loading registry data...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Valid Section */}
            <div className="bg-slate/30 border border-slate-light p-4">
              <div className="flex items-center gap-2 mb-4">
                <FileIcon />
                <h2 className="text-sm font-semibold text-ivory uppercase tracking-wider">Valid</h2>
                <span className="text-xs text-steel ml-auto">{validSubjects.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {validSubjects.length === 0 ? (
                  <p className="text-steel text-xs text-center py-4 col-span-full">No valid subjects</p>
                ) : (
                  validSubjects.map((s, i) => (
                    <SubjectCard
                      key={i}
                      subject={s}
                      dispute={null}
                      subjectContent={subjectContents[s.publicKey.toBase58()]}
                      onClick={() => setSelectedItem({ subject: s, dispute: null })}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Disputed Section */}
            <div className="bg-slate/30 border border-slate-light p-4">
              <div className="flex items-center gap-2 mb-4">
                <GavelIcon />
                <h2 className="text-sm font-semibold text-ivory uppercase tracking-wider">Disputed</h2>
                <span className="text-xs text-steel ml-auto">{disputedItems.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {disputedItems.length === 0 ? (
                  <p className="text-steel text-xs text-center py-4 col-span-full">No active disputes</p>
                ) : (
                  disputedItems.map((d, i) => {
                    const subject = subjects.find(s => s.publicKey.toBase58() === d.account.subject.toBase58());
                    if (!subject) return null;
                    return (
                      <SubjectCard
                        key={i}
                        subject={subject}
                        dispute={d}
                        subjectContent={subjectContents[subject.publicKey.toBase58()]}
                        disputeContent={disputeContents[d.publicKey.toBase58()]}
                        voteCounts={disputeVoteCounts[d.publicKey.toBase58()]}
                        onClick={() => setSelectedItem({ subject, dispute: d })}
                      />
                    );
                  })
                )}
              </div>
            </div>

            {/* Restoring Section */}
            <div className="bg-slate/30 border border-slate-light p-4">
              <div className="flex items-center gap-2 mb-4">
                <GavelIcon />
                <h2 className="text-sm font-semibold text-ivory uppercase tracking-wider">Restoring</h2>
                <span className="text-xs text-steel ml-auto">{restoringSubjects.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {restoringSubjects.length === 0 ? (
                  <p className="text-steel text-xs text-center py-4 col-span-full">No subjects being restored</p>
                ) : (
                  restoringSubjects.map((s, i) => {
                    const restoreDispute = disputes.find(d =>
                      d.account.subject.toBase58() === s.publicKey.toBase58() &&
                      d.account.status.pending &&
                      d.account.isRestore
                    );
                    return (
                      <SubjectCard
                        key={i}
                        subject={s}
                        dispute={restoreDispute}
                        subjectContent={subjectContents[s.publicKey.toBase58()]}
                        disputeContent={restoreDispute ? disputeContents[restoreDispute.publicKey.toBase58()] : null}
                        voteCounts={restoreDispute ? disputeVoteCounts[restoreDispute.publicKey.toBase58()] : null}
                        onClick={() => setSelectedItem({ subject: s, dispute: restoreDispute || null })}
                      />
                    );
                  })
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

            {/* Dormant Section */}
            <div className="bg-slate/30 border border-slate-light p-4">
              <div className="flex items-center gap-2 mb-4">
                <MoonIcon />
                <h2 className="text-sm font-semibold text-ivory uppercase tracking-wider">Dormant</h2>
                <span className="text-xs text-steel ml-auto">{dormantSubjects.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {dormantSubjects.length === 0 ? (
                  <p className="text-steel text-xs text-center py-4 col-span-full">No dormant subjects</p>
                ) : (
                  dormantSubjects.map((s, i) => {
                    const lastDispute = disputes.find(d =>
                      d.account.subject.toBase58() === s.publicKey.toBase58() &&
                      d.account.status.resolved
                    );
                    return (
                      <SubjectCard
                        key={i}
                        subject={s}
                        dispute={lastDispute}
                        isResolved={true}
                        subjectContent={subjectContents[s.publicKey.toBase58()]}
                        disputeContent={lastDispute ? disputeContents[lastDispute.publicKey.toBase58()] : null}
                        onClick={() => setSelectedItem({ subject: s, dispute: lastDispute || null })}
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
          subjectContent={subjectContents[selectedItem.subject.publicKey.toBase58()]}
          jurorAccount={jurorAccount}
          onClose={() => setSelectedItem(null)}
          onVote={handleVote}
          onAddStake={handleAddStake}
          onJoinChallengers={handleJoinChallengers}
          onResolve={handleResolve}
          onClaimAll={handleClaimAll}
          onRefresh={loadData}
          actionLoading={actionLoading}
          showActions={true}
          getIpfsUrl={getUrl}
        />
      )}

      <CreateSubjectModal
        isOpen={showCreateSubject}
        onClose={() => setShowCreateSubject(false)}
        onSubmit={handleCreateSubject}
        isLoading={actionLoading || isUploading}
        poolBalance={pool?.account?.available?.toNumber() ?? 0}
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
        minBond={minBond}
      />
      <RestoreModal
        isOpen={!!showRestore}
        onClose={() => setShowRestore(null)}
        onSubmit={handleSubmitRestore}
        subjectContent={restoreSubjectContent}
        minStake={restoreSubject?.account.lastDisputeTotal?.toNumber() ?? 0}
        isLoading={actionLoading || isUploading}
      />
    </div>
  );
}
