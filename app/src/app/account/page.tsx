"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Navigation } from "@/components/Navigation";
import { useTribunalcraft } from "@/hooks/useTribunalcraft";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

const UserIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const VaultIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="12" cy="12" r="4" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

export default function AccountPage() {
  const { publicKey } = useWallet();
  const {
    client,
    createPool,
    stakePool,
    withdrawPool,
    fetchDefenderPool,
    getDefenderPoolPDA,
    fetchJurorAccount,
    getJurorPDA,
    fetchChallengerAccount,
    getChallengerPDA,
  } = useTribunalcraft();

  const [pool, setPool] = useState<any>(null);
  const [jurorAccount, setJurorAccount] = useState<any>(null);
  const [challengerAccount, setChallengerAccount] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [createAmount, setCreateAmount] = useState("0.1");
  const [stakeAmount, setStakeAmount] = useState("0.1");
  const [withdrawAmount, setWithdrawAmount] = useState("0.1");

  const loadData = async () => {
    if (!publicKey) return;
    setLoading(true);
    setError(null);
    try {
      // Load defender pool
      const [poolPda] = getDefenderPoolPDA(publicKey);
      try {
        const poolData = await fetchDefenderPool(poolPda);
        setPool(poolData);
      } catch {
        setPool(null);
      }

      // Load juror account
      const [jurorPda] = getJurorPDA(publicKey);
      try {
        const jurorData = await fetchJurorAccount(jurorPda);
        setJurorAccount(jurorData);
      } catch {
        setJurorAccount(null);
      }

      // Load challenger account
      const [challengerPda] = getChallengerPDA(publicKey);
      try {
        const challengerData = await fetchChallengerAccount(challengerPda);
        setChallengerAccount(challengerData);
      } catch {
        setChallengerAccount(null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load account data");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (client && publicKey) {
      loadData();
    }
  }, [publicKey, client]);

  const handleCreatePool = async () => {
    if (!publicKey) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const amount = new BN(parseFloat(createAmount) * LAMPORTS_PER_SOL);
      await createPool(amount);
      setSuccess("Staker pool created successfully");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to create pool");
    }
    setActionLoading(false);
  };

  const handleStake = async () => {
    if (!publicKey) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const amount = new BN(parseFloat(stakeAmount) * LAMPORTS_PER_SOL);
      await stakePool(amount);
      setSuccess("Stake added successfully");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to stake");
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
      await withdrawPool(amount);
      setSuccess("Withdrawal successful");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to withdraw");
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

  return (
    <div className="min-h-screen bg-obsidian">
      <Navigation />

      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        <div className="mb-12 animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-[1px] bg-gold" />
            <span className="text-xs uppercase tracking-[0.2em] text-gold">Profile</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-ivory mb-4">
            Account
          </h1>
          <p className="text-steel text-lg">
            Manage your staker pool and view your protocol activity.
          </p>
        </div>

        {!publicKey ? (
          <div className="tribunal-card-gold p-12 text-center animate-slide-up stagger-1">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full border-2 border-gold flex items-center justify-center text-gold">
              <UserIcon />
            </div>
            <h2 className="font-display text-2xl font-semibold text-ivory mb-3">
              Connect Wallet
            </h2>
            <p className="text-steel max-w-md mx-auto">
              Connect your wallet to view and manage your account settings.
            </p>
          </div>
        ) : loading ? (
          <div className="tribunal-card p-12 text-center animate-slide-up stagger-1">
            <p className="text-steel">Loading account data...</p>
          </div>
        ) : (
          <>
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

            {/* Wallet Info */}
            <div className="tribunal-card p-6 mb-6 animate-slide-up stagger-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full border border-gold/50 flex items-center justify-center text-gold">
                    <UserIcon />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-steel mb-1">Connected Wallet</p>
                    <p className="font-mono text-parchment">
                      {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={copyAddress}
                  className="btn btn-secondary text-sm py-2 px-3 flex items-center gap-2"
                >
                  <CopyIcon />
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {/* Activity Summary */}
            <div className="grid grid-cols-2 gap-4 mb-6 animate-slide-up stagger-2">
              <div className="tribunal-card p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-gold opacity-60"><ShieldIcon /></div>
                  <span className="text-xs uppercase tracking-wider text-steel">Juror</span>
                </div>
                {jurorAccount ? (
                  <div className="space-y-2">
                    <p className="text-parchment">
                      <span className="text-2xl font-display">{(jurorAccount.reputation / 100).toFixed(1)}%</span>
                      <span className="text-steel text-sm ml-2">reputation</span>
                    </p>
                    <p className="text-steel text-sm">
                      {jurorAccount.votesCast.toNumber()} votes cast
                    </p>
                  </div>
                ) : (
                  <p className="text-steel text-sm">Not registered</p>
                )}
              </div>

              <div className="tribunal-card p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-crimson opacity-60">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14.5 5.5L18.5 9.5M6 14l4-4m-2.5 6.5l-3 3m11.5-11.5l3-3M9.5 6.5l8 8" />
                    </svg>
                  </div>
                  <span className="text-xs uppercase tracking-wider text-steel">Challenger</span>
                </div>
                {challengerAccount ? (
                  <div className="space-y-2">
                    <p className="text-parchment">
                      <span className="text-2xl font-display">{challengerAccount.disputesSubmitted.toNumber()}</span>
                      <span className="text-steel text-sm ml-2">disputes</span>
                    </p>
                    <p className="text-steel text-sm">
                      {challengerAccount.disputesUpheld.toNumber()} upheld
                    </p>
                  </div>
                ) : (
                  <p className="text-steel text-sm">No disputes filed</p>
                )}
              </div>
            </div>

            {/* Staker Pool Section */}
            <div className="tribunal-card p-6 animate-slide-up stagger-3">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded border border-gold/50 flex items-center justify-center text-gold">
                  <VaultIcon />
                </div>
                <div>
                  <h2 className="font-display text-xl font-semibold text-ivory">Staker Pool</h2>
                  <p className="text-steel text-sm">Deposit SOL to back linked subjects</p>
                </div>
              </div>

              {pool ? (
                <>
                  {/* Pool Balance Overview */}
                  <div className="mb-6 p-4 bg-obsidian border border-slate-light">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-steel mb-1">Total Balance</p>
                        <p className="text-parchment font-medium text-lg">{(pool.totalStake.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-steel mb-1">Available</p>
                        <p className="text-emerald font-medium text-lg">{(pool.available.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL</p>
                        <p className="text-steel text-xs">Can be used for new subjects</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-steel mb-1">Held in Disputes</p>
                        <p className="text-gold font-medium text-lg">{(pool.held.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL</p>
                        <p className="text-steel text-xs">Locked until disputes resolve</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-steel mb-1">Linked Subjects</p>
                        <p className="text-parchment font-medium text-lg">{pool.subjectCount}</p>
                        <p className="text-steel text-xs">{pool.pendingDisputes || 0} pending disputes</p>
                      </div>
                    </div>

                    {/* Visual balance bar */}
                    {pool.totalStake.toNumber() > 0 && (
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-emerald">Available ({((pool.available.toNumber() / pool.totalStake.toNumber()) * 100).toFixed(0)}%)</span>
                          <span className="text-gold">Held ({((pool.held.toNumber() / pool.totalStake.toNumber()) * 100).toFixed(0)}%)</span>
                        </div>
                        <div className="h-2 bg-slate rounded overflow-hidden flex">
                          <div
                            className="h-full bg-emerald"
                            style={{ width: `${(pool.available.toNumber() / pool.totalStake.toNumber()) * 100}%` }}
                          />
                          <div
                            className="h-full bg-gold"
                            style={{ width: `${(pool.held.toNumber() / pool.totalStake.toNumber()) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* How it works */}
                  <div className="mb-6 p-3 bg-slate/30 border border-slate-light text-xs text-steel">
                    <p className="font-medium text-parchment mb-1">How Pool Balance Works:</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li><span className="text-emerald">Available</span> can back new linked subjects or be withdrawn</li>
                      <li><span className="text-gold">Held</span> is locked when disputes are filed against your subjects</li>
                      <li>If dispute upheld: held amount is slashed (lost to challengers/jurors)</li>
                      <li>If dispute dismissed: held returns to available + you earn challenger's bond</li>
                    </ul>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-obsidian border border-slate-light">
                      <h3 className="text-sm font-medium text-ivory mb-1">Deposit to Pool</h3>
                      <p className="text-steel text-xs mb-3">Add SOL to increase your available balance</p>
                      <div className="flex gap-2 mb-3">
                        <input
                          type="text"
                          value={stakeAmount}
                          onChange={(e) => setStakeAmount(e.target.value)}
                          className="input flex-1 text-sm"
                        />
                        <span className="text-steel py-2 text-sm">SOL</span>
                      </div>
                      <button
                        onClick={handleStake}
                        disabled={actionLoading}
                        className="btn btn-success w-full text-sm"
                      >
                        {actionLoading ? "Processing..." : "Deposit"}
                      </button>
                    </div>

                    <div className="p-4 bg-obsidian border border-slate-light">
                      <h3 className="text-sm font-medium text-ivory mb-1">Withdraw from Pool</h3>
                      <p className="text-steel text-xs mb-3">
                        Withdraw up to {(pool.available.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL (available balance)
                      </p>
                      <div className="flex gap-2 mb-3">
                        <input
                          type="text"
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          className="input flex-1 text-sm"
                        />
                        <span className="text-steel py-2 text-sm">SOL</span>
                      </div>
                      <button
                        onClick={handleWithdraw}
                        disabled={actionLoading || pool.available.toNumber() === 0}
                        className="btn btn-danger w-full text-sm"
                      >
                        {actionLoading ? "Processing..." : "Withdraw"}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-6 bg-obsidian border border-slate-light">
                  <div className="text-center mb-6">
                    <p className="text-parchment mb-2">Create a staker pool to back linked subjects</p>
                    <p className="text-steel text-sm">
                      Your pool holds SOL that backs all your linked subjects. When disputes are filed,
                      funds are held from your pool until resolution.
                    </p>
                  </div>

                  <div className="max-w-sm mx-auto">
                    <label className="block text-xs uppercase tracking-wider text-steel mb-1">Initial Deposit (SOL)</label>
                    <div className="flex gap-2 mb-4">
                      <input
                        type="text"
                        value={createAmount}
                        onChange={(e) => setCreateAmount(e.target.value)}
                        placeholder="0.1"
                        className="input flex-1"
                      />
                      <span className="text-steel py-2">SOL</span>
                    </div>
                    <button
                      onClick={handleCreatePool}
                      disabled={actionLoading}
                      className="btn btn-primary w-full"
                    >
                      {actionLoading ? "Creating..." : "Create Pool"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
