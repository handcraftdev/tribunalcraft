"use client";

import { useState, useEffect, memo, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Navigation } from "@/components/Navigation";
import { useTribunalcraft, calculateMinBond, INITIAL_REPUTATION } from "@/hooks/useTribunalcraft";
import { useUpload, useContentFetch } from "@/hooks/useUpload";
import { PublicKey, LAMPORTS_PER_SOL, Keypair } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import type { DisputeType, JurorPool, ChallengerPool } from "@/hooks/useTribunalcraft";
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
    createDispute,
    submitRestore,
    joinChallengers,
    resolveDispute,
    addBondDirect,
    fetchAllSubjects,
    fetchAllDisputes,
    getDefenderPoolPDA,
    getDisputePDA,
    fetchDefenderPool,
    fetchChallengerRecordsBySubject,
    voteOnDispute,
    voteOnRestore,
    fetchJurorPool,
    fetchJurorRecord,
    getJurorPoolPDA,
    getJurorRecordPDA,
    fetchJurorRecordsBySubject,
    batchClaimRewards,
    batchCloseRecords,
    getChallengerRecordPDA,
    getDefenderRecordPDA,
    fetchChallengerRecord,
    fetchDefenderRecord,
    fetchProtocolConfig,
    getChallengerPoolPDA,
    fetchChallengerPool,
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
  const [jurorPool, setJurorPool] = useState<any>(null);
  const [existingVotes, setExistingVotes] = useState<Record<string, VoteData>>({});
  const [disputeVotes, setDisputeVotes] = useState<VoteData[]>([]);
  const [disputeVoteCounts, setDisputeVoteCounts] = useState<Record<string, { forChallenger: number; forDefender: number }>>({});

  // Challenger/Defender records for claims (only used in modal)
  const [challengerRecords, setChallengerRecords] = useState<Record<string, any>>({});
  const [defenderRecords, setDefenderRecords] = useState<Record<string, any>>({});
  const [disputeCreatorReputation, setDisputeCreatorReputation] = useState<number | null>(null);

  // Modal state
  const [selectedItem, setSelectedItem] = useState<{ subject: SubjectData; dispute: DisputeData | null } | null>(null);
  const [showCreateSubject, setShowCreateSubject] = useState(false);
  const [showCreateDispute, setShowCreateDispute] = useState<string | null>(null);
  const [showRestore, setShowRestore] = useState<string | null>(null);
  const [userChallengerPool, setUserChallengerPool] = useState<ChallengerPool | null>(null);

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

      // Fetch content for all subjects using detailsCid
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
          // V2: dispute has detailsCid directly
          const cid = d.account.detailsCid;
          if (cid) {
            setDisputeCids(prev => ({ ...prev, [disputeKey]: cid }));
            fetchDisputeContent(cid).then(content => {
              if (content) setDisputeContents(prev => ({ ...prev, [disputeKey]: content }));
            });
          } else {
            // Fallback: get CID from first challenger record
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

      if (publicKey) {
        const [poolPda] = getDefenderPoolPDA(publicKey);
        try {
          setPool(await fetchDefenderPool(poolPda));
        } catch {
          setPool(null);
        }

        const [jurorPda] = getJurorPoolPDA(publicKey);
        try {
          const jurorData = await fetchJurorPool(jurorPda);
          setJurorPool(jurorData);

          // Fetch juror records for pending disputes (for voting UI)
          const pendingDisputes = disputesData.filter((d: any) => d.account.status.pending);
          const votes: Record<string, VoteData> = {};
          for (const d of pendingDisputes) {
            const [jurorRecordPda] = getJurorRecordPDA(d.account.subjectId, publicKey, d.account.round);
            try {
              const jurorRecord = await fetchJurorRecord(jurorRecordPda);
              if (jurorRecord) votes[d.publicKey.toBase58()] = { publicKey: jurorRecordPda, account: jurorRecord };
            } catch {}
          }
          setExistingVotes(votes);

          // Fetch vote counts for pending disputes (for SubjectCard display)
          const counts: Record<string, { forChallenger: number; forDefender: number }> = {};
          for (const d of pendingDisputes) {
            try {
              const allVotes = await fetchJurorRecordsBySubject(d.account.subjectId);
              if (allVotes) {
                let forChallenger = 0;
                let forDefender = 0;
                for (const v of allVotes) {
                  // For restorations: forRestoration is forChallenger, againstRestoration is forDefender
                  // For regular disputes: forChallenger, forDefender
                  if (d.account.isRestore) {
                    if ("forRestoration" in v.account.restoreChoice) forChallenger++;
                    else if ("againstRestoration" in v.account.restoreChoice) forDefender++;
                  } else {
                    if ("forChallenger" in v.account.choice) forChallenger++;
                    else if ("forDefender" in v.account.choice) forDefender++;
                  }
                }
                counts[d.publicKey.toBase58()] = { forChallenger, forDefender };
              }
            } catch {}
          }
          setDisputeVoteCounts(counts);
        } catch {
          setJurorPool(null);
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
        if (updatedDispute.account.votesForChallenger.toNumber() !== selectedItem.dispute.account.votesForChallenger.toNumber() ||
            updatedDispute.account.votesForDefender.toNumber() !== selectedItem.dispute.account.votesForDefender.toNumber()) {
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
        d.account.subjectId.toBase58() === subject.account.subjectId.toBase58()
      );

      // V2: Fetch records for ALL disputes on this subject (for history)
      for (const d of subjectDisputes) {
        const dKey = d.publicKey.toBase58();

        // Fetch juror record
        const [jurorRecordPda] = getJurorRecordPDA(d.account.subjectId, publicKey, d.account.round);
        try {
          const jurorRecord = await fetchJurorRecord(jurorRecordPda);
          if (jurorRecord) setExistingVotes(prev => ({
            ...prev,
            [dKey]: { publicKey: jurorRecordPda, account: jurorRecord }
          }));
        } catch {}

        // Fetch challenger record
        const [challengerRecordPda] = getChallengerRecordPDA(d.account.subjectId, publicKey, d.account.round);
        try {
          const record = await fetchChallengerRecord(challengerRecordPda);
          if (record) setChallengerRecords(prev => ({ ...prev, [dKey]: record }));
        } catch {}

        // Fetch defender record
        const [defenderRecordPda] = getDefenderRecordPDA(d.account.subjectId, publicKey, d.account.round);
        try {
          const record = await fetchDefenderRecord(defenderRecordPda);
          if (record) setDefenderRecords(prev => ({ ...prev, [dKey]: record }));
        } catch {}
      }

      // Fetch current dispute specific data
      if (dispute) {
        const votes = await fetchJurorRecordsBySubject(dispute.account.subjectId);
        // Filter to only this round
        const roundVotes = votes.filter(v => v.account.round === dispute.account.round);
        setDisputeVotes(roundVotes || []);

        // Fetch the dispute creator's reputation from their challenger pool
        try {
          const challengers = await fetchChallengerRecordsBySubject(dispute.account.subjectId);
          // Find challengers from this round
          const roundChallengers = challengers.filter(c => c.account.round === dispute.account.round);
          if (roundChallengers && roundChallengers.length > 0) {
            const creatorPubkey = roundChallengers[0].account.challenger;
            // V2: Challenger reputation is on ChallengerPool
            const [creatorChallengerPoolPda] = getChallengerPoolPDA(creatorPubkey);
            const creatorChallengerPool = await fetchChallengerPool(creatorChallengerPoolPda);
            if (creatorChallengerPool) {
              const rep = creatorChallengerPool.reputation;
              setDisputeCreatorReputation(
                typeof rep === 'number' ? rep : (rep as any).toNumber?.() ?? null
              );
            } else {
              // No challenger pool means default reputation
              setDisputeCreatorReputation(INITIAL_REPUTATION);
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
      d.account.subjectId.toBase58() === subjectKey &&
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
      const initialStake = parseFloat(form.directStake || "0");

      // V2: Create subject with detailsCid for IPFS content linking
      await createSubject({
        subjectId,
        detailsCid: uploadResult.cid,
        votingPeriod,
        matchMode: form.matchMode,
      });

      // Add initial bond if specified (wait for subject account to be confirmed)
      if (initialStake > 0) {
        // Brief delay to ensure subject account is available
        await new Promise(resolve => setTimeout(resolve, 2000));
        await addBondDirect(subjectId, new BN(initialStake * LAMPORTS_PER_SOL));
      }

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

      // V2: Use subjectId.toBase58() as the subject CID for linking
      const uploadResult = await uploadDispute({
        title: form.title,
        reason: form.reason,
        type: contentType,
        subjectCid: subject.account.subjectId.toBase58(),
        requestedOutcome: form.requestedOutcome,
      });
      if (!uploadResult) throw new Error("Failed to upload content");

      const disputeType: DisputeType = { [form.type]: {} } as DisputeType;
      const stake = new BN(parseFloat(form.bondAmount) * LAMPORTS_PER_SOL);

      // V2: Single createDispute call with subjectId, no free cases
      await createDispute({
        subjectId: subject.account.subjectId,
        disputeType,
        detailsCid: uploadResult.cid,
        stake,
      });

      setSuccess("Dispute submitted");
      setShowCreateDispute(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to submit dispute");
    }
    setActionLoading(false);
  }, [publicKey, showCreateDispute, subjects, uploadDispute, createDispute, loadData]);

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
        subjectCid: subject.account.subjectId.toBase58(),
        requestedOutcome: "Restore subject to valid status",
      });
      if (!uploadResult) throw new Error("Failed to upload content");

      const stakeAmount = new BN(parseFloat(form.stakeAmount) * LAMPORTS_PER_SOL);
      const disputeType: DisputeType = { other: {} } as DisputeType;

      // V2: submitRestore takes params object
      await submitRestore({
        subjectId: subject.account.subjectId,
        disputeType,
        detailsCid: uploadResult.cid,
        stakeAmount,
      });

      setSuccess("Restoration request submitted");
      setShowRestore(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to submit restoration request");
    }
    setActionLoading(false);
  }, [publicKey, showRestore, subjects, uploadDispute, submitRestore, loadData]);

  // V2: handleVote takes subjectId instead of disputeKey
  const handleVote = useCallback(async (subjectIdKey: string, round: number, stakeAmount: string, choice: "forChallenger" | "forDefender" | "forRestoration" | "againstRestoration", rationale: string) => {
    if (!publicKey || !jurorPool) return;
    setActionLoading(true);
    setError(null);
    try {
      const subjectId = new PublicKey(subjectIdKey);
      const stake = new BN(parseFloat(stakeAmount) * LAMPORTS_PER_SOL);
      const isRestore = choice === "forRestoration" || choice === "againstRestoration";

      // V2: No addToVote - users vote once per dispute round
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
  }, [publicKey, jurorPool, voteOnDispute, voteOnRestore, loadData]);

  // V2: handleAddBond uses addBondDirect
  const handleAddBond = useCallback(async (subjectIdKey: string, amount: string, fromPool: boolean) => {
    if (!publicKey || !selectedItem) return;
    setActionLoading(true);
    setError(null);
    try {
      const subject = selectedItem.subject;
      const isDormant = subject.account.status.dormant;
      const bond = new BN(parseFloat(amount) * LAMPORTS_PER_SOL);

      // V2: Simple bond addition with subjectId
      await addBondDirect(subject.account.subjectId, bond);
      setSuccess(isDormant ? `Subject revived with ${amount} SOL` : `Added ${amount} SOL bond`);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to add bond");
    }
    setActionLoading(false);
  }, [publicKey, selectedItem, addBondDirect, loadData]);

  // V2: handleJoinChallengers uses joinChallengers with params object
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

  // V2: handleResolve uses subjectId
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

  // V2: handleClaimAll uses subjectId and round
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

      // Process all claims in a single transaction
      await batchClaimRewards(batchParams);

      setSuccess(`${claimedRewards.join(", ")} reward${claimedRewards.length > 1 ? "s" : ""} claimed!`);
      await loadData();
    } catch (err: any) {
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

  // Get dispute subject data for create dispute modal
  const disputeSubject = showCreateDispute ? subjects.find(s => s.publicKey.toBase58() === showCreateDispute) : null;
  const disputeSubjectContent = disputeSubject ? subjectContents[disputeSubject.publicKey.toBase58()] : null;

  // Fetch user's challenger pool for reputation when dispute modal opens
  useEffect(() => {
    const fetchUserChallengerPool = async () => {
      if (showCreateDispute && publicKey) {
        try {
          const [challengerPoolPda] = getChallengerPoolPDA(publicKey);
          const account = await fetchChallengerPool(challengerPoolPda);
          setUserChallengerPool(account);
        } catch {
          // Account doesn't exist yet - new user
          setUserChallengerPool(null);
        }
      } else {
        setUserChallengerPool(null);
      }
    };
    fetchUserChallengerPool();
  }, [showCreateDispute, publicKey, getChallengerPoolPDA, fetchChallengerPool]);

  // Calculate minimum bond based on user's reputation from ChallengerPool
  // reputation is stored as u64 on-chain, which may come as number or BN
  const rawRep = userChallengerPool?.reputation;
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
                    const subject = subjects.find(s => s.account.subjectId.toBase58() === d.account.subjectId.toBase58());
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
                      d.account.subjectId.toBase58() === s.account.subjectId.toBase58() &&
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
                      d.account.subjectId.toBase58() === s.account.subjectId.toBase58() &&
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
                      d.account.subjectId.toBase58() === s.account.subjectId.toBase58() &&
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
          jurorPool={jurorPool}
          onClose={() => setSelectedItem(null)}
          onVote={handleVote}
          onAddBond={handleAddBond}
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
