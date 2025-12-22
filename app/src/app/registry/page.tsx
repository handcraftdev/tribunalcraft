"use client";

import { useState, useEffect, memo, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Navigation } from "@/components/Navigation";
import { useTribunalcraft, calculateMinBond, INITIAL_REPUTATION, MIN_DEFENDER_STAKE } from "@/hooks/useTribunalcraft";
import { useUpload, useContentFetch } from "@/hooks/useUpload";
import { PublicKey, LAMPORTS_PER_SOL, Keypair } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import type { DisputeType, JurorPool, ChallengerPool } from "@/hooks/useTribunalcraft";
import type { SubjectContent, DisputeContent } from "@tribunalcraft/sdk";
import { SubjectCard, SubjectModal, DISPUTE_TYPES, SUBJECT_CATEGORIES, SubjectData, DisputeData, VoteData } from "@/components/subject";
import { FileIcon, GavelIcon, PlusIcon, XIcon, MoonIcon } from "@/components/Icons";
import { getSubjects, getDisputes } from "@/lib/supabase/queries";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getUserFriendlyErrorMessage, getErrorHelp, isUserCancellation } from "@/lib/error-utils";
import type { Subject as SupabaseSubject, Dispute as SupabaseDispute } from "@/lib/supabase/types";

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
    <div className="fixed inset-0 bg-obsidian/90 flex items-start justify-center z-50 pt-28 px-4 pb-4" onClick={onClose}>
      <div className="tribunal-modal max-w-lg w-full max-h-[calc(100vh-8rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-light flex items-center justify-between sticky top-0 bg-slate z-10">
          <h3 className="font-display text-lg font-semibold text-ivory">File Dispute</h3>
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
    <div className="fixed inset-0 bg-obsidian/90 flex items-start justify-center z-50 pt-28 px-4 pb-4" onClick={onClose}>
      <div className="tribunal-modal max-w-lg w-full max-h-[calc(100vh-8rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-light flex items-center justify-between sticky top-0 bg-slate z-10">
          <h3 className="font-display text-lg font-semibold text-ivory">Restore Subject</h3>
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
  pool,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (form: any, subjectType: string) => void;
  isLoading: boolean;
  pool: { balance: BN; maxBond: BN } | null;
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "contract" as SubjectContent["category"],
    termsText: "",
    matchMode: true,
    votingPeriod: "24",
    directStake: "0",
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setForm({ title: "", description: "", category: "contract", termsText: "", matchMode: true, votingPeriod: "24", directStake: "0" });
    }
  }, [isOpen]);

  const handleSubmit = () => {
    // Require initial bond if no pool
    if (!hasPool) {
      const bond = parseFloat(form.directStake || "0");
      if (bond <= 0) {
        alert("Initial bond is required when you don't have a funded pool");
        return;
      }
    }
    onSubmit(form, "staked");
  };

  // Pool info (fetchDefenderPool returns account data directly)
  const poolBalance = pool?.balance?.toNumber() ?? 0;
  // maxBond can be u64::MAX which exceeds JS safe integer, check before converting
  const maxBondBN = pool?.maxBond;
  const isMaxBondUnlimited = !maxBondBN || maxBondBN.gte(new BN(Number.MAX_SAFE_INTEGER));
  const maxBond = isMaxBondUnlimited ? 0 : maxBondBN?.toNumber() ?? 0;
  // Effective pool backing = min(balance, maxBond) - but if unlimited, use balance
  const effectivePoolBacking = isMaxBondUnlimited ? poolBalance : Math.min(poolBalance, maxBond);
  // Pool is only considered valid if it meets minimum stake requirement
  const hasPool = pool !== null && effectivePoolBacking >= MIN_DEFENDER_STAKE;
  const poolBelowMinimum = pool !== null && poolBalance > 0 && effectivePoolBacking < MIN_DEFENDER_STAKE;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-obsidian/90 flex items-start justify-center z-50 pt-28 px-4 pb-4" onClick={onClose}>
      <div className="tribunal-modal max-w-lg w-full max-h-[calc(100vh-8rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-light flex items-center justify-between sticky top-0 bg-slate z-10">
          <h3 className="font-display text-lg font-semibold text-ivory">Create Subject</h3>
          <button onClick={onClose} className="text-steel hover:text-parchment"><XIcon /></button>
        </div>
        <div className="p-4 space-y-4">
          {/* Pool Info Banner */}
          <div className={`p-3 rounded border ${hasPool ? 'bg-sky/10 border-sky/30' : poolBelowMinimum ? 'bg-gold/10 border-gold/30' : 'bg-steel/10 border-steel/30'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-steel">Defender Pool</span>
              {hasPool ? (
                <span className="text-xs text-sky">Active ({(effectivePoolBacking / LAMPORTS_PER_SOL).toFixed(2)} SOL)</span>
              ) : poolBelowMinimum ? (
                <span className="text-xs text-gold">Below minimum</span>
              ) : (
                <span className="text-xs text-steel">Not funded</span>
              )}
            </div>
            {(hasPool || poolBelowMinimum) && (
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-steel">Balance:</span>{" "}
                  <span className="text-parchment">{(poolBalance / LAMPORTS_PER_SOL).toFixed(2)} SOL</span>
                </div>
                <div>
                  <span className="text-steel">Max Bond:</span>{" "}
                  <span className="text-parchment">
                    {isMaxBondUnlimited ? "Unlimited" : `${(maxBond / LAMPORTS_PER_SOL).toFixed(2)} SOL`}
                  </span>
                </div>
              </div>
            )}
            <p className="text-[10px] text-steel mt-2">
              {hasPool
                ? "Your pool will auto-contribute when disputes are created"
                : poolBelowMinimum
                ? `Pool backing (${(effectivePoolBacking / LAMPORTS_PER_SOL).toFixed(2)} SOL) is below minimum (${(MIN_DEFENDER_STAKE / LAMPORTS_PER_SOL).toFixed(2)} SOL)`
                : "Fund your pool to auto-defend subjects"
              }
            </p>
            {hasPool && isMaxBondUnlimited && (
              <div className="mt-2 p-2 bg-gold/10 border border-gold/30 rounded">
                <p className="text-[10px] text-gold">
                  ⚠️ Your max bond is unlimited. Consider setting a limit to control risk per subject.
                </p>
              </div>
            )}
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
            <div>
              <label className="text-xs text-steel mb-1 block">
                Initial Bond (SOL) {!hasPool && <span className="text-crimson">*</span>}
              </label>
              <input value={form.directStake} onChange={e => setForm(f => ({ ...f, directStake: e.target.value }))} className="input w-full" autoComplete="off" placeholder={hasPool ? "0 (optional)" : "Required"} />
              <p className="text-[10px] text-steel mt-1">
                {hasPool ? "Optional bond from wallet" : "Required - no pool to back this subject"}
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
    addBondFromPool,
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

  // Creator pool backings: min(pool.balance, pool.maxBond) for each subject
  const [creatorPoolBackings, setCreatorPoolBackings] = useState<Record<string, number>>({});

  // Modal state
  const [selectedItem, setSelectedItem] = useState<{ subject: SubjectData; dispute: DisputeData | null } | null>(null);
  const [showCreateSubject, setShowCreateSubject] = useState(false);
  const [showCreateDispute, setShowCreateDispute] = useState<string | null>(null);
  const [showRestore, setShowRestore] = useState<string | null>(null);
  const [userChallengerPool, setUserChallengerPool] = useState<ChallengerPool | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showMySubjects, setShowMySubjects] = useState(false);

  // Convert Supabase subject to SubjectData format
  const convertSupabaseSubject = (s: SupabaseSubject): SubjectData | null => {
    try {
      // Map status string to enum-like object
      const statusMap: Record<string, any> = {
        dormant: { dormant: {} },
        valid: { valid: {} },
        disputed: { disputed: {} },
        invalid: { invalid: {} },
        restoring: { restoring: {} },
      };
      return {
        publicKey: new PublicKey(s.id),
        account: {
          subjectId: new PublicKey(s.subject_id),
          creator: new PublicKey(s.creator),
          detailsCid: s.details_cid || "",
          round: s.round,
          availableBond: new BN(s.available_bond),
          defenderCount: s.defender_count,
          status: statusMap[s.status] || { dormant: {} },
          matchMode: s.match_mode,
          votingPeriod: s.voting_period ? new BN(s.voting_period) : new BN(0),
          dispute: s.dispute ? new PublicKey(s.dispute) : PublicKey.default,
          bump: 255, // Placeholder - not stored in Supabase
          createdAt: s.created_at ? new BN(s.created_at) : new BN(0),
          updatedAt: s.updated_at ? new BN(s.updated_at) : new BN(0),
          lastDisputeTotal: s.last_dispute_total ? new BN(s.last_dispute_total) : new BN(0),
          lastVotingPeriod: s.voting_period ? new BN(s.voting_period) : new BN(0), // Same as votingPeriod
        },
      };
    } catch {
      return null;
    }
  };

  // Convert Supabase dispute to DisputeData format
  const convertSupabaseDispute = (d: SupabaseDispute): DisputeData | null => {
    try {
      // Map status/outcome strings to enum-like objects
      const statusMap: Record<string, any> = {
        none: { none: {} },
        pending: { pending: {} },
        resolved: { resolved: {} },
      };
      const outcomeMap: Record<string, any> = {
        none: { none: {} },
        challengerWins: { challengerWins: {} },
        defenderWins: { defenderWins: {} },
        noParticipation: { noParticipation: {} },
      };
      const disputeTypeMap: Record<string, any> = {
        accuracy: { accuracy: {} },
        bias: { bias: {} },
        outdated: { outdated: {} },
        incomplete: { incomplete: {} },
        spam: { spam: {} },
        other: { other: {} },
      };
      return {
        publicKey: new PublicKey(d.id),
        account: {
          subjectId: new PublicKey(d.subject_id),
          round: d.round,
          status: statusMap[d.status] || { none: {} },
          disputeType: d.dispute_type ? disputeTypeMap[d.dispute_type] || { other: {} } : { other: {} },
          totalStake: new BN(d.total_stake),
          challengerCount: d.challenger_count,
          bondAtRisk: new BN(d.bond_at_risk),
          defenderCount: d.defender_count,
          votesForChallenger: new BN(d.votes_for_challenger),
          votesForDefender: new BN(d.votes_for_defender),
          voteCount: d.vote_count,
          votingStartsAt: d.voting_starts_at ? new BN(d.voting_starts_at) : new BN(0),
          votingEndsAt: d.voting_ends_at ? new BN(d.voting_ends_at) : new BN(0),
          outcome: outcomeMap[d.outcome || "none"] || { none: {} },
          resolvedAt: d.resolved_at ? new BN(d.resolved_at) : null,
          isRestore: d.is_restore,
          restoreStake: new BN(d.restore_stake),
          restorer: d.restorer ? new PublicKey(d.restorer) : PublicKey.default,
          detailsCid: d.details_cid || "",
          bump: 255, // Placeholder - not stored in Supabase
          createdAt: d.created_at ? new BN(d.created_at) : new BN(0),
        },
      };
    } catch {
      return null;
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      let subjectsData: SubjectData[] = [];
      let disputesData: DisputeData[] = [];

      // Try Supabase first for faster initial load
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

      // If no disputes fetched but there are disputed subjects, fetch disputes individually
      let finalDisputes = disputesData;
      if (finalDisputes.length === 0 && subjectsData.length > 0 && client) {
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

      // Fetch creator pools for all subjects to show pool backing
      const poolBackings: Record<string, number> = {};
      const uniqueCreators = [...new Set(subjectsData.map((s: SubjectData) => s.account.creator.toBase58()))];
      for (const creatorKey of uniqueCreators) {
        try {
          const [creatorPoolPda] = getDefenderPoolPDA(new PublicKey(creatorKey));
          const creatorPool = await fetchDefenderPool(creatorPoolPda);
          if (creatorPool) {
            // Calculate min(balance, maxBond)
            const balance = creatorPool.balance?.toNumber() ?? 0;
            const maxBond = creatorPool.maxBond?.toNumber() ?? 0;
            const backing = Math.min(balance, maxBond > 0 ? maxBond : balance);
            // Assign to all subjects by this creator
            for (const s of subjectsData) {
              if (s.account.creator.toBase58() === creatorKey) {
                poolBackings[s.publicKey.toBase58()] = backing;
              }
            }
          }
        } catch {
          // Pool doesn't exist for this creator
        }
      }
      setCreatorPoolBackings(poolBackings);

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

  // Filter function for search and category
  const filterSubject = useCallback((s: SubjectData): boolean => {
    // Search filter - check title and description from content
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const content = subjectContents[s.publicKey.toBase58()];
      const titleMatch = content?.title?.toLowerCase().includes(query);
      const descMatch = content?.description?.toLowerCase().includes(query);
      const idMatch = s.publicKey.toBase58().toLowerCase().includes(query);
      if (!titleMatch && !descMatch && !idMatch) return false;
    }

    // Category filter
    if (categoryFilter !== "all") {
      const content = subjectContents[s.publicKey.toBase58()];
      if (content?.category !== categoryFilter) return false;
    }

    // My subjects filter
    if (showMySubjects && publicKey) {
      if (s.account.creator.toBase58() !== publicKey.toBase58()) return false;
    }

    return true;
  }, [searchQuery, categoryFilter, showMySubjects, publicKey, subjectContents]);

  // Filter data for sections
  const allValidSubjects = subjects.filter(s => s.account.status.valid);
  const allDisputedItems = disputes.filter(d => d.account.status.pending && !d.account.isRestore);
  const allInvalidSubjects = subjects.filter(s => s.account.status.invalid);
  const allDormantSubjects = subjects.filter(s => s.account.status.dormant);
  const allRestoringSubjects = subjects.filter(s => s.account.status.restoring);

  // Apply search/filter
  const validSubjects = allValidSubjects.filter(filterSubject);
  const disputedSubjectsForFilter = allDisputedItems.map(d =>
    subjects.find(s => s.account.subjectId.toBase58() === d.account.subjectId.toBase58())
  ).filter((s): s is SubjectData => s !== undefined);
  const disputedItems = allDisputedItems.filter(d => {
    const subject = subjects.find(s => s.account.subjectId.toBase58() === d.account.subjectId.toBase58());
    return subject ? filterSubject(subject) : false;
  });
  const invalidSubjects = allInvalidSubjects.filter(filterSubject);
  const dormantSubjects = allDormantSubjects.filter(filterSubject);
  const restoringSubjects = allRestoringSubjects.filter(filterSubject);

  // Get unique categories from loaded content
  const availableCategories = [...new Set(
    Object.values(subjectContents)
      .filter((c): c is SubjectContent => c !== null)
      .map(c => c.category)
  )];

  // Count totals for status filter badges
  const statusCounts = {
    all: subjects.length,
    valid: allValidSubjects.length,
    disputed: allDisputedItems.length,
    invalid: allInvalidSubjects.length,
    dormant: allDormantSubjects.length,
    restoring: allRestoringSubjects.length,
  };

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
      const initialBond = parseFloat(form.directStake || "0");

      // Create subject with initialBond - creator's pool is auto-linked
      await createSubject({
        subjectId,
        detailsCid: uploadResult.cid,
        votingPeriod,
        matchMode: form.matchMode,
        initialBond: new BN(initialBond * LAMPORTS_PER_SOL),
      });

      setSuccess("Subject created");
      setShowCreateSubject(false);
      await loadData();
    } catch (err: any) {
      if (isUserCancellation(err)) return;
      const message = getUserFriendlyErrorMessage(err);
      const help = getErrorHelp(err);
      setError(help ? `${message} ${help}` : message);
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
      if (isUserCancellation(err)) return;
      const message = getUserFriendlyErrorMessage(err);
      const help = getErrorHelp(err);
      setError(help ? `${message} ${help}` : message);
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
      if (isUserCancellation(err)) return;
      const message = getUserFriendlyErrorMessage(err);
      const help = getErrorHelp(err);
      setError(help ? `${message} ${help}` : message);
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
        await voteOnRestore(subjectId, restoreChoice, stake, rationale, round);
        setSuccess("Vote cast on restoration request");
      } else {
        const voteChoice = { [choice]: {} } as any;
        await voteOnDispute(subjectId, voteChoice, stake, rationale, round);
        setSuccess("Vote cast");
      }
      await loadData();
    } catch (err: any) {
      if (isUserCancellation(err)) return;
      const message = getUserFriendlyErrorMessage(err);
      const help = getErrorHelp(err);
      setError(help ? `${message} ${help}` : message);
    }
    setActionLoading(false);
  }, [publicKey, jurorPool, voteOnDispute, voteOnRestore, loadData]);

  // V2: handleAddBond uses addBondDirect or addBondFromPool
  const handleAddBond = useCallback(async (subjectIdKey: string, amount: string, fromPool: boolean) => {
    if (!publicKey || !selectedItem) return;
    setActionLoading(true);
    setError(null);
    try {
      const subject = selectedItem.subject;
      const isDormant = subject.account.status.dormant;
      const bond = new BN(parseFloat(amount || "0") * LAMPORTS_PER_SOL);

      const round = subject.account.round;
      if (fromPool) {
        // Revive from pool - just link pool, no fund transfer (funds transfer on dispute)
        await addBondFromPool(subject.account.subjectId, new BN(0), round);
        const poolBacking = creatorPoolBackings[subject.publicKey.toBase58()] ?? 0;
        setSuccess(isDormant ? `Subject revived (backed by pool: ${(poolBacking / LAMPORTS_PER_SOL).toFixed(6)} SOL)` : "Linked to pool");
      } else {
        // Direct bond from wallet
        await addBondDirect(subject.account.subjectId, bond, round);
        setSuccess(isDormant ? `Subject revived with ${amount} SOL` : `Added ${amount} SOL bond`);
      }
      await loadData();
    } catch (err: any) {
      if (isUserCancellation(err)) return;
      const message = getUserFriendlyErrorMessage(err);
      const help = getErrorHelp(err);
      setError(help ? `${message} ${help}` : message);
    }
    setActionLoading(false);
  }, [publicKey, selectedItem, addBondDirect, addBondFromPool, creatorPoolBackings, loadData]);

  // V2: handleJoinChallengers uses joinChallengers with params object
  const handleJoinChallengers = useCallback(async (subjectIdKey: string, amount: string, detailsCid: string = "") => {
    if (!publicKey || !selectedItem) return;
    setActionLoading(true);
    setError(null);
    try {
      const subject = selectedItem.subject;
      const subjectId = subject.account.subjectId;
      const round = subject.account.round;
      const stake = new BN(parseFloat(amount) * LAMPORTS_PER_SOL);

      await joinChallengers({ subjectId, stake, detailsCid, round });
      setSuccess(`Added ${amount} SOL stake as challenger`);
      await loadData();
    } catch (err: any) {
      if (isUserCancellation(err)) return;
      const message = getUserFriendlyErrorMessage(err);
      const help = getErrorHelp(err);
      setError(help ? `${message} ${help}` : message);
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
      if (isUserCancellation(err)) return;
      const message = getUserFriendlyErrorMessage(err);
      const help = getErrorHelp(err);
      setError(help ? `${message} ${help}` : message);
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
      if (isUserCancellation(err)) return;
      const message = getUserFriendlyErrorMessage(err);
      const help = getErrorHelp(err);
      setError(help ? `${message} ${help}` : message);
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
      if (isUserCancellation(err)) return;
      const message = getUserFriendlyErrorMessage(err);
      const help = getErrorHelp(err);
      setError(help ? `${message} ${help}` : message);
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
    <div className="min-h-screen bg-obsidian relative overflow-hidden">
      {/* Atmospheric Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/3 w-[500px] h-[350px] bg-gradient-radial from-gold/[0.025] to-transparent blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 w-[400px] h-[300px] bg-gradient-radial from-crimson/[0.015] to-transparent blur-3xl" />
      </div>

      <Navigation />

      <main className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 pt-28 pb-12">
        {/* Header */}
        <div className="mb-6 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h1 className="font-display text-3xl md:text-4xl font-semibold text-ivory leading-tight tracking-tight">
              Subject <span className="text-gold">Registry</span>
            </h1>
            {publicKey && (
              <button onClick={() => setShowCreateSubject(true)} className="bg-gold hover:bg-gold-light text-obsidian font-medium px-5 py-2.5 text-sm transition-all flex items-center gap-2">
                <PlusIcon /> New Subject
              </button>
            )}
          </div>
          <p className="text-steel text-sm max-w-lg leading-relaxed mb-4">
            Browse and manage registered subjects, disputes, and restorations
          </p>

          {/* Search and Filter Bar */}
          <div className="tribunal-card p-4">
            <div className="flex flex-col md:flex-row gap-3 md:items-center">
              {/* Search Input - takes remaining space */}
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title, description, or ID..."
                  className="input w-full !pl-10"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-steel" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-steel hover:text-parchment"
                  >
                    <XIcon />
                  </button>
                )}
              </div>

              {/* Filters row */}
              <div className="flex gap-2 flex-none">
                {/* Category Filter */}
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="input w-24"
                >
                  <option value="all">All</option>
                  {SUBJECT_CATEGORIES.map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>

                {/* My Subjects Toggle */}
                {publicKey && (
                  <button
                    onClick={() => setShowMySubjects(!showMySubjects)}
                    className={`px-3 py-2 text-sm font-medium transition-all border whitespace-nowrap ${
                      showMySubjects
                        ? "bg-gold/20 border-gold text-gold"
                        : "bg-slate-light/20 border-slate-light text-steel hover:text-parchment"
                    }`}
                  >
                    Mine
                  </button>
                )}
              </div>
            </div>

            {/* Status Filter Pills */}
            <div className="flex flex-wrap gap-2 mt-3">
              {[
                { key: "all", label: "All", count: statusCounts.all },
                { key: "valid", label: "Valid", count: statusCounts.valid },
                { key: "disputed", label: "Disputed", count: statusCounts.disputed },
                { key: "restoring", label: "Restoring", count: statusCounts.restoring },
                { key: "invalid", label: "Invalid", count: statusCounts.invalid },
                { key: "dormant", label: "Dormant", count: statusCounts.dormant },
              ].map(status => (
                <button
                  key={status.key}
                  onClick={() => setStatusFilter(status.key)}
                  className={`px-3 py-1 text-xs font-medium transition-all border ${
                    statusFilter === status.key
                      ? "bg-gold/20 border-gold text-gold"
                      : "bg-slate-light/10 border-slate-light/50 text-steel hover:text-parchment hover:border-steel"
                  }`}
                >
                  {status.label} ({status.count})
                </button>
              ))}
            </div>

            {/* Active Filters Summary */}
            {(searchQuery || categoryFilter !== "all" || showMySubjects || statusFilter !== "all") && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-light/30">
                <span className="text-xs text-steel">Active filters:</span>
                {searchQuery && (
                  <span className="px-2 py-0.5 bg-sky/20 text-sky text-xs rounded">
                    Search: "{searchQuery}"
                  </span>
                )}
                {categoryFilter !== "all" && (
                  <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">
                    {SUBJECT_CATEGORIES.find(c => c.key === categoryFilter)?.label}
                  </span>
                )}
                {showMySubjects && (
                  <span className="px-2 py-0.5 bg-gold/20 text-gold text-xs rounded">
                    My Subjects
                  </span>
                )}
                {statusFilter !== "all" && (
                  <span className="px-2 py-0.5 bg-emerald/20 text-emerald text-xs rounded">
                    {statusFilter}
                  </span>
                )}
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setCategoryFilter("all");
                    setShowMySubjects(false);
                    setStatusFilter("all");
                  }}
                  className="ml-auto text-xs text-steel hover:text-crimson"
                >
                  Clear all
                </button>
              </div>
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
            {/* No Results Message */}
            {statusFilter !== "all" && (
              (statusFilter === "valid" && validSubjects.length === 0) ||
              (statusFilter === "disputed" && disputedItems.length === 0) ||
              (statusFilter === "restoring" && restoringSubjects.length === 0) ||
              (statusFilter === "invalid" && invalidSubjects.length === 0) ||
              (statusFilter === "dormant" && dormantSubjects.length === 0)
            ) && (
              <div className="tribunal-card p-8 text-center">
                <p className="text-steel">No {statusFilter} subjects found matching your filters</p>
                {(searchQuery || categoryFilter !== "all" || showMySubjects) && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setCategoryFilter("all");
                      setShowMySubjects(false);
                    }}
                    className="mt-2 text-gold text-sm hover:text-gold-light"
                  >
                    Clear search filters
                  </button>
                )}
              </div>
            )}

            {/* Valid Section */}
            {(statusFilter === "all" || statusFilter === "valid") && (
              <div className="tribunal-card p-5">
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
                        creatorPoolBacking={creatorPoolBackings[s.publicKey.toBase58()]}
                        onClick={() => setSelectedItem({ subject: s, dispute: null })}
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Disputed Section */}
            {(statusFilter === "all" || statusFilter === "disputed") && (
              <div className="tribunal-card p-5">
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
            )}

            {/* Restoring Section */}
            {(statusFilter === "all" || statusFilter === "restoring") && (
              <div className="tribunal-card p-5">
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
            )}

            {/* Invalid Section */}
            {(statusFilter === "all" || statusFilter === "invalid") && (
              <div className="tribunal-card p-5">
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
            )}

            {/* Dormant Section */}
            {(statusFilter === "all" || statusFilter === "dormant") && (
              <div className="tribunal-card p-5">
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
                          creatorPoolBacking={creatorPoolBackings[s.publicKey.toBase58()]}
                          onClick={() => setSelectedItem({ subject: s, dispute: lastDispute || null })}
                        />
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Subject Detail Modal */}
      {selectedItem && (
        <SubjectModal
          subject={selectedItem.subject}
          subjectContent={subjectContents[selectedItem.subject.publicKey.toBase58()]}
          jurorPool={jurorPool}
          creatorPoolBacking={creatorPoolBackings[selectedItem.subject.publicKey.toBase58()]}
          userPoolBacking={pool ? (() => {
            const balance = pool.balance?.toNumber() ?? 0;
            // Handle u64::MAX for unlimited maxBond
            try {
              const maxBond = pool.maxBond?.toNumber() ?? 0;
              return maxBond > 0 ? Math.min(balance, maxBond) : balance;
            } catch {
              // u64::MAX throws - treat as unlimited, use balance
              return balance;
            }
          })() : undefined}
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
        pool={pool}
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
