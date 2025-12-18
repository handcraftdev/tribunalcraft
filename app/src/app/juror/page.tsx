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
import { ShieldIcon, CheckIcon, LockIcon, UsersIcon, PlusIcon, MinusIcon, ClockIcon } from "@/components/Icons";

export default function JurorPage() {
  const { publicKey } = useWallet();
  const {
    client,
    registerJuror,
    addJurorStake,
    withdrawJurorStake,
    unregisterJuror,
    fetchJurorAccount,
    fetchAllJurors,
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
    addToVote,
    resolveDispute,
    claimJurorReward,
    claimChallengerReward,
    claimDefenderReward,
    addToStake,
    addToDispute,
    getDisputePDA,
  } = useTribunalcraft();

  const { fetchSubject: fetchSubjectContent, fetchDispute: fetchDisputeContent, getUrl } = useContentFetch();

  const [jurorAccount, setJurorAccount] = useState<any>(null);
  const [allJurors, setAllJurors] = useState<any[]>([]);
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

  // Selected item state
  const [selectedItem, setSelectedItem] = useState<{ subject: SubjectData; dispute: DisputeData; vote: VoteData } | null>(null);
  const [disputeVotes, setDisputeVotes] = useState<VoteData[]>([]);
  const [challengerRecords, setChallengerRecords] = useState<Record<string, any>>({});
  const [defenderRecords, setDefenderRecords] = useState<Record<string, any>>({});

  // Forms
  const [registerStake, setRegisterStake] = useState("0.1");
  const [addStakeAmount, setAddStakeAmount] = useState("0.1");
  const [withdrawAmount, setWithdrawAmount] = useState("0.1");
  const [showAddStake, setShowAddStake] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all data
      const [jurorsData, subjectsData, disputesData] = await Promise.all([
        fetchAllJurors(),
        fetchAllSubjects(),
        fetchAllDisputes(),
      ]);
      setAllJurors(jurorsData);
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
        const [jurorPda] = getJurorPDA(publicKey);
        try {
          const jurorData = await fetchJurorAccount(jurorPda);
          setJurorAccount(jurorData);

          // Fetch vote records for all disputes
          const votes: Record<string, VoteData> = {};
          for (const d of disputesData) {
            const [voteRecordPda] = getVoteRecordPDA(d.publicKey, publicKey);
            try {
              const voteRecord = await fetchVoteRecord(voteRecordPda);
              if (voteRecord) {
                votes[d.publicKey.toBase58()] = {
                  publicKey: voteRecordPda,
                  account: voteRecord,
                };
              }
            } catch {}
          }
          setUserVotes(votes);
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

  // Fetch votes and records when a dispute is selected
  useEffect(() => {
    const fetchSelectedData = async () => {
      if (!selectedItem || !publicKey) {
        setDisputeVotes([]);
        return;
      }

      const { subject, dispute } = selectedItem;
      const subjectKey = subject.publicKey.toBase58();

      // Fetch dispute votes
      const votes = await fetchVotesByDispute(dispute.publicKey);
      setDisputeVotes(votes || []);

      // Fetch challenger/defender records for resolved disputes
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
  }, [selectedItem, publicKey]);

  // Handlers for juror account
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

  // Handlers for dispute actions
  const handleVote = useCallback(async (stakeAmount: string, choice: "forChallenger" | "forDefender", rationale: string) => {
    if (!publicKey || !jurorAccount || !selectedItem) return;
    setActionLoading(true);
    setError(null);
    try {
      const disputeKey = selectedItem.dispute.publicKey.toBase58();
      const stake = new BN(parseFloat(stakeAmount) * LAMPORTS_PER_SOL);
      const hasExistingVote = userVotes[disputeKey];

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
  }, [publicKey, jurorAccount, selectedItem, userVotes, addToVote, voteOnDispute, loadData]);

  const handleResolve = useCallback(async () => {
    if (!publicKey || !selectedItem) return;
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
    if (!publicKey || !selectedItem) return;
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
    if (!publicKey || !selectedItem) return;
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
    if (!publicKey || !selectedItem) return;
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

  // Helper functions
  const formatReputation = (rep: number) => `${(rep / 100).toFixed(1)}%`;

  const formatTimeRemaining = (unlockAt: number) => {
    const now = Date.now() / 1000;
    const diff = unlockAt - now;
    if (diff <= 0) return "Unlockable";

    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);

    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  // Calculate global stats
  const totalJurors = allJurors.length;
  const activeJurors = allJurors.filter(j => j.account.isActive).length;
  const totalStaked = allJurors.reduce((sum, j) => sum + j.account.totalStake.toNumber(), 0);
  const totalVotesCast = allJurors.reduce((sum, j) => sum + j.account.votesCast.toNumber(), 0);
  const avgReputation = totalJurors > 0
    ? allJurors.reduce((sum, j) => sum + j.account.reputation, 0) / totalJurors
    : 5000;

  // Calculate locked stake
  const lockedStake = jurorAccount
    ? jurorAccount.totalStake.toNumber() - jurorAccount.availableStake.toNumber()
    : 0;

  // Get disputes where user has voted
  const getVotedDisputes = () => {
    const votedDisputeKeys = Object.keys(userVotes);
    return votedDisputeKeys.map(key => {
      const dispute = disputes.find(d => d.publicKey.toBase58() === key);
      if (!dispute) return null;
      const subject = subjects.find(s => s.publicKey.toBase58() === dispute.account.subject.toBase58());
      if (!subject) return null;
      const vote = userVotes[key];
      return { subject, dispute, vote };
    }).filter((item): item is { subject: SubjectData; dispute: DisputeData; vote: VoteData } => item !== null);
  };

  const votedDisputes = getVotedDisputes();

  // Categorize into Active and Past
  // Active: pending disputes OR resolved with unclaimed rewards
  // Past: resolved with claimed rewards
  const activeVotedDisputes = votedDisputes.filter(item => {
    const isPending = item.dispute.account.status.pending;
    const isResolvedWithUnclaimedReward = item.dispute.account.status.resolved && !item.vote.account.rewardClaimed;
    return isPending || isResolvedWithUnclaimedReward;
  });

  const pastVotedDisputes = votedDisputes.filter(item => {
    return item.dispute.account.status.resolved && item.vote.account.rewardClaimed;
  });

  // Get past disputes for history
  const getPastDisputes = (subjectKey: string, currentDisputeKey?: string) => {
    return disputes.filter(d =>
      d.account.subject.toBase58() === subjectKey &&
      d.account.status.resolved &&
      d.publicKey.toBase58() !== currentDisputeKey
    );
  };

  return (
    <div className="min-h-screen bg-obsidian">
      <Navigation />

      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        <div className="mb-12 animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-[1px] bg-gold" />
            <span className="text-xs uppercase tracking-[0.2em] text-gold">Justice</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-ivory mb-4">
            Juror Portal
          </h1>
          <p className="text-steel text-lg">
            Manage your juror account and stake. Vote on disputes in the{" "}
            <Link href="/registry" className="text-gold hover:text-gold-light">Registry</Link>.
          </p>
        </div>

        {error && (
          <div className="bg-crimson/10 border border-crimson p-4 mb-6">
            <p className="text-crimson text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-emerald/10 border border-emerald p-4 mb-6">
            <p className="text-emerald text-sm">{success}</p>
          </div>
        )}

        {/* Global Juror Statistics */}
        <div className="tribunal-card p-6 mb-8 animate-slide-up stagger-1">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full border border-gold/50 flex items-center justify-center text-gold">
              <UsersIcon />
            </div>
            <h2 className="font-display text-xl font-semibold text-ivory">Global Juror Statistics</h2>
          </div>
          {loading ? (
            <p className="text-steel">Loading statistics...</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              <div className="vertical-rule">
                <p className="stat-label">Total Jurors</p>
                <p className="stat-value">{totalJurors}</p>
              </div>
              <div className="vertical-rule">
                <p className="stat-label">Active</p>
                <p className="stat-value stat-value-emerald">{activeJurors}</p>
              </div>
              <div className="vertical-rule">
                <p className="stat-label">Total Staked</p>
                <p className="stat-value">{(totalStaked / LAMPORTS_PER_SOL).toFixed(2)}</p>
                <p className="text-steel text-sm">SOL</p>
              </div>
              <div className="vertical-rule">
                <p className="stat-label">Total Votes</p>
                <p className="stat-value">{totalVotesCast}</p>
              </div>
              <div className="vertical-rule">
                <p className="stat-label">Avg Reputation</p>
                <p className="stat-value stat-value-gold">{formatReputation(avgReputation)}</p>
              </div>
            </div>
          )}
        </div>

        {!publicKey ? (
          <div className="tribunal-card-gold p-12 text-center animate-slide-up stagger-2">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full border-2 border-gold flex items-center justify-center text-gold">
              <ShieldIcon />
            </div>
            <h2 className="font-display text-2xl font-semibold text-ivory mb-3">
              Oath Required
            </h2>
            <p className="text-steel max-w-md mx-auto">
              Connect your wallet to register as a juror and participate in arbitration.
            </p>
          </div>
        ) : loading ? (
          <div className="tribunal-card p-12 text-center animate-slide-up stagger-2">
            <p className="text-steel">Loading juror data...</p>
          </div>
        ) : jurorAccount ? (
          <>
            {/* Juror Account */}
            <div className="tribunal-card p-8 mb-8 animate-slide-up stagger-2">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full border border-gold/50 flex items-center justify-center text-gold">
                    <ShieldIcon />
                  </div>
                  <h2 className="font-display text-xl font-semibold text-ivory">Your Juror Account</h2>
                </div>
                <span className={`text-xs uppercase tracking-wider px-3 py-1 rounded ${jurorAccount.isActive ? "bg-emerald/20 text-emerald" : "bg-steel/20 text-steel"}`}>
                  {jurorAccount.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                <div className="vertical-rule">
                  <p className="stat-label">Total Stake</p>
                  <p className="stat-value">{(jurorAccount.totalStake.toNumber() / LAMPORTS_PER_SOL).toFixed(4)}</p>
                  <p className="text-steel text-sm">SOL</p>
                </div>
                <div className="vertical-rule">
                  <p className="stat-label">Available</p>
                  <p className="stat-value stat-value-emerald">{(jurorAccount.availableStake.toNumber() / LAMPORTS_PER_SOL).toFixed(4)}</p>
                  <p className="text-steel text-sm">SOL</p>
                </div>
                <div className="vertical-rule">
                  <p className="stat-label">Reputation</p>
                  <p className="stat-value stat-value-gold">{formatReputation(jurorAccount.reputation)}</p>
                </div>
                <div className="vertical-rule">
                  <p className="stat-label">Votes Cast</p>
                  <p className="stat-value">{jurorAccount.votesCast.toNumber()}</p>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-light mb-6">
                <div className="flex items-center gap-2 text-sm mb-2">
                  <CheckIcon />
                  <span className="text-steel">
                    Correct Votes: <span className="text-parchment">{jurorAccount.correctVotes.toNumber()}</span> / {jurorAccount.votesCast.toNumber()}
                    {jurorAccount.votesCast.toNumber() > 0 && (
                      <span className="ml-2 text-emerald">
                        ({((jurorAccount.correctVotes.toNumber() / jurorAccount.votesCast.toNumber()) * 100).toFixed(1)}%)
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Stake Management */}
              <div className="flex flex-wrap gap-3">
                {showAddStake ? (
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={addStakeAmount}
                      onChange={(e) => setAddStakeAmount(e.target.value)}
                      className="input w-32"
                      placeholder="Amount"
                    />
                    <span className="text-steel">SOL</span>
                    <button onClick={handleAddJurorStake} disabled={actionLoading} className="btn btn-primary">
                      {actionLoading ? "..." : "Add"}
                    </button>
                    <button onClick={() => setShowAddStake(false)} className="btn btn-secondary">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setShowAddStake(true)} className="btn btn-secondary flex items-center gap-2">
                    <PlusIcon /> Add Stake
                  </button>
                )}

                {showWithdraw ? (
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="input w-32"
                      placeholder="Amount"
                    />
                    <span className="text-steel">SOL</span>
                    <button onClick={handleWithdraw} disabled={actionLoading} className="btn btn-primary">
                      {actionLoading ? "..." : "Withdraw"}
                    </button>
                    <button onClick={() => setShowWithdraw(false)} className="btn btn-secondary">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setShowWithdraw(true)} className="btn btn-secondary flex items-center gap-2">
                    <MinusIcon /> Withdraw
                  </button>
                )}

                <button onClick={handleUnregister} disabled={actionLoading} className="btn btn-secondary text-crimson hover:bg-crimson/10">
                  Unregister
                </button>
              </div>
            </div>

            {/* Locked Stake */}
            {lockedStake > 0 && (
              <div className="tribunal-card p-6 mb-8 animate-slide-up stagger-3">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full border border-gold/50 flex items-center justify-center text-gold">
                    <LockIcon />
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-semibold text-ivory">Locked Stake</h2>
                    <p className="text-steel text-sm">Stake locked in active votes (7 day unlock period after voting ends)</p>
                  </div>
                </div>

                <div className="bg-obsidian border border-slate-light p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-steel">Total Locked</span>
                    <span className="text-gold font-mono">{(lockedStake / LAMPORTS_PER_SOL).toFixed(4)} SOL</span>
                  </div>
                </div>
              </div>
            )}

            {/* Active Disputes Section */}
            {activeVotedDisputes.length > 0 && (
              <div className="bg-slate/30 border border-slate-light p-4 mb-6 animate-slide-up stagger-4">
                <div className="flex items-center gap-2 mb-4">
                  <ClockIcon size={16} />
                  <h2 className="text-sm font-semibold text-ivory uppercase tracking-wider">Active</h2>
                  <span className="text-xs text-steel ml-auto">{activeVotedDisputes.length}</span>
                </div>
                <p className="text-xs text-steel mb-4">Pending votes, resolutions, and unclaimed rewards</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeVotedDisputes.map((item, i) => {
                    const votingEnded = Date.now() > item.dispute.account.votingEndsAt.toNumber() * 1000;
                    const canResolve = item.dispute.account.status.pending && votingEnded;
                    const canClaim = item.dispute.account.status.resolved && !item.vote.account.rewardClaimed;

                    return (
                      <div key={i} className="relative">
                        <SubjectCard
                          subject={item.subject}
                          dispute={item.dispute}
                          existingVote={item.vote}
                          subjectContent={subjectContents[item.subject.publicKey.toBase58()]}
                          disputeContent={disputeContents[item.dispute.publicKey.toBase58()]}
                          onClick={() => setSelectedItem(item)}
                        />
                        {/* Status badge overlay */}
                        <div className="absolute top-1 left-1">
                          {canClaim && (
                            <span className="text-[10px] bg-gold text-obsidian px-1.5 py-0.5 font-semibold">
                              CLAIM
                            </span>
                          )}
                          {canResolve && (
                            <span className="text-[10px] bg-emerald text-obsidian px-1.5 py-0.5 font-semibold">
                              RESOLVE
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Past Disputes Section */}
            {pastVotedDisputes.length > 0 && (
              <div className="bg-slate/30 border border-slate-light p-4 mb-6 animate-slide-up stagger-5">
                <div className="flex items-center gap-2 mb-4">
                  <CheckIcon />
                  <h2 className="text-sm font-semibold text-ivory uppercase tracking-wider">Past</h2>
                  <span className="text-xs text-steel ml-auto">{pastVotedDisputes.length}</span>
                </div>
                <p className="text-xs text-steel mb-4">Historical votes with rewards claimed</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pastVotedDisputes.map((item, i) => (
                    <SubjectCard
                      key={i}
                      subject={item.subject}
                      dispute={item.dispute}
                      isResolved={true}
                      existingVote={item.vote}
                      subjectContent={subjectContents[item.subject.publicKey.toBase58()]}
                      disputeContent={disputeContents[item.dispute.publicKey.toBase58()]}
                      onClick={() => setSelectedItem(item)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Call to Action when no disputes */}
            {activeVotedDisputes.length === 0 && pastVotedDisputes.length === 0 && (
              <div className="tribunal-card-gold p-6 text-center animate-slide-up stagger-4">
                <p className="text-steel mb-4">
                  Ready to vote? Browse subjects and disputes in the registry.
                </p>
                <Link href="/registry" className="btn btn-primary">
                  Go to Registry
                </Link>
              </div>
            )}
          </>
        ) : (
          /* Register as Juror */
          <div className="tribunal-card-gold p-8 animate-slide-up stagger-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full border border-gold/50 flex items-center justify-center text-gold">
                <ShieldIcon />
              </div>
              <h2 className="font-display text-xl font-semibold text-ivory">Take the Oath</h2>
            </div>
            <p className="text-steel mb-6">
              Register as a juror to vote on disputes and earn rewards. Your reputation
              will increase with correct votes and decrease with incorrect votes.
              <br /><br />
              <span className="text-gold">Note:</span> Stake used for voting is locked for 7 days after the voting period ends.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-steel mb-2">Initial Stake</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={registerStake}
                    onChange={(e) => setRegisterStake(e.target.value)}
                    placeholder="Initial stake"
                    className="input flex-1"
                  />
                  <span className="text-steel py-3">SOL</span>
                </div>
              </div>
              <button
                onClick={handleRegister}
                disabled={actionLoading}
                className="btn btn-primary w-full py-4"
              >
                {actionLoading ? "Registering..." : "Register as Juror"}
              </button>
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
          disputeContent={disputeContents[selectedItem.dispute.publicKey.toBase58()]}
          existingVote={selectedItem.vote}
          jurorAccount={jurorAccount}
          disputeVotes={disputeVotes}
          pastDisputes={getPastDisputes(
            selectedItem.subject.publicKey.toBase58(),
            selectedItem.dispute.publicKey.toBase58()
          )}
          pastDisputeContents={disputeContents}
          challengerRecord={challengerRecords[selectedItem.dispute.publicKey.toBase58()]}
          defenderRecord={defenderRecords[selectedItem.subject.publicKey.toBase58()]}
          onClose={() => setSelectedItem(null)}
          onVote={handleVote}
          onAddStake={handleAddDefenderStake}
          onJoinChallengers={handleJoinChallengers}
          onResolve={handleResolve}
          onClaimJuror={handleClaimJurorReward}
          onClaimChallenger={handleClaimChallengerReward}
          onClaimDefender={handleClaimDefenderReward}
          actionLoading={actionLoading}
          showActions={true}
          getIpfsUrl={getUrl}
          disputeCid={disputeCids[selectedItem.dispute.publicKey.toBase58()]}
        />
      )}
    </div>
  );
}
