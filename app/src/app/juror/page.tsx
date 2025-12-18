"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Navigation } from "@/components/Navigation";
import { useTribunalcraft } from "@/hooks/useTribunalcraft";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import Link from "next/link";

const ShieldIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const MinusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

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
    fetchVoteRecord,
    getJurorPDA,
    getVoteRecordPDA,
  } = useTribunalcraft();

  const [jurorAccount, setJurorAccount] = useState<any>(null);
  const [allJurors, setAllJurors] = useState<any[]>([]);
  const [lockedVotes, setLockedVotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      // Fetch all jurors for global stats
      const jurorsData = await fetchAllJurors();
      setAllJurors(jurorsData);

      // Fetch juror account if connected
      if (publicKey) {
        const [jurorPda] = getJurorPDA(publicKey);
        try {
          const jurorData = await fetchJurorAccount(jurorPda);
          setJurorAccount(jurorData);

          // Fetch all disputes to find locked votes
          const disputesData = await fetchAllDisputes();
          const votes: any[] = [];

          for (const d of disputesData) {
            const [voteRecordPda] = getVoteRecordPDA(d.publicKey, publicKey);
            try {
              const voteRecord = await fetchVoteRecord(voteRecordPda);
              if (voteRecord && !voteRecord.stakeUnlocked) {
                votes.push({
                  dispute: d.publicKey.toBase58(),
                  disputeStatus: d.account.status,
                  voteRecord,
                });
              }
            } catch {
              // No vote record
            }
          }
          setLockedVotes(votes);
        } catch {
          setJurorAccount(null);
          setLockedVotes([]);
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

  const handleAddStake = async () => {
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
                    <button onClick={handleAddStake} disabled={actionLoading} className="btn btn-primary">
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
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full border border-gold/50 flex items-center justify-center text-gold">
                    <LockIcon />
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-semibold text-ivory">Locked Stake</h2>
                    <p className="text-steel text-sm">Stake locked in active votes (7 day unlock period after voting ends)</p>
                  </div>
                </div>

                <div className="bg-obsidian border border-slate-light p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-steel">Total Locked</span>
                    <span className="text-gold font-mono">{(lockedStake / LAMPORTS_PER_SOL).toFixed(4)} SOL</span>
                  </div>
                </div>

                {lockedVotes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wider text-steel mb-2">Active Vote Locks</p>
                    {lockedVotes.map((v, idx) => (
                      <div key={idx} className="bg-obsidian border border-slate-light p-3 flex items-center justify-between">
                        <div>
                          <p className="text-parchment text-sm font-mono">{v.dispute.slice(0, 20)}...</p>
                          <p className="text-steel text-xs">
                            {v.voteRecord.choice.uphold ? "Uphold" : v.voteRecord.choice.dismiss ? "Dismiss" : "Abstain"} - {(v.voteRecord.stakeAllocated.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-xs">
                            <ClockIcon />
                            <span className={v.voteRecord.unlockAt.toNumber() * 1000 < Date.now() ? "text-emerald" : "text-gold"}>
                              {formatTimeRemaining(v.voteRecord.unlockAt.toNumber())}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Call to Action */}
            <div className="tribunal-card-gold p-6 text-center animate-slide-up stagger-4">
              <p className="text-steel mb-4">
                Ready to vote? Browse subjects and disputes in the registry.
              </p>
              <Link href="/registry" className="btn btn-primary">
                Go to Registry
              </Link>
            </div>
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
    </div>
  );
}
