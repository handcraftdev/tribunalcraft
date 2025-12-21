"use client";

import { useEffect, useState, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Navigation } from "@/components/Navigation";
import { useTribunalcraft } from "@/hooks/useTribunalcraft";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import Link from "next/link";

// Icons
const ChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const GavelIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M14.5 5.5L18.5 9.5M6 14l4-4m-2.5 6.5l-3 3m11.5-11.5l3-3M9.5 6.5l8 8" />
    <rect x="2" y="17" width="5" height="5" rx="1" />
  </svg>
);

const UsersIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const ScaleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 3v18" />
    <path d="M5 7l7-4 7 4" />
    <path d="M5 7l-2 9h4l-2-9" />
    <path d="M19 7l2 9h-4l2-9" />
    <circle cx="3" cy="16" r="2" />
    <circle cx="21" cy="16" r="2" />
  </svg>
);

const ChartIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 3v18h18" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </svg>
);

const CoinsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="6" />
    <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
    <path d="M7 6h1v4" />
  </svg>
);

export default function Dashboard() {
  const { publicKey } = useWallet();
  const {
    client,
    fetchDefenderPool,
    getDefenderPoolPDA,
    fetchAllSubjects,
    fetchAllDisputes,
    fetchAllJurorPools,
    fetchJurorPool,
    getJurorPoolPDA
  } = useTribunalcraft();

  const [pool, setPool] = useState<any>(null);
  const [jurorAccount, setJurorAccount] = useState<any>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [jurors, setJurors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!client) return;
    setLoading(true);
    try {
      const [subjectsData, disputesData, jurorsData] = await Promise.all([
        fetchAllSubjects(),
        fetchAllDisputes(),
        fetchAllJurorPools(),
      ]);
      setSubjects(subjectsData || []);
      setDisputes(disputesData || []);
      setJurors(jurorsData || []);

      if (publicKey) {
        const [poolPda] = getDefenderPoolPDA(publicKey);
        try {
          const poolData = await fetchDefenderPool(poolPda);
          setPool(poolData);
        } catch {
          setPool(null);
        }

        const [jurorPda] = getJurorPoolPDA(publicKey);
        try {
          const jurorData = await fetchJurorPool(jurorPda);
          setJurorAccount(jurorData);
        } catch {
          setJurorAccount(null);
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [publicKey, client]);

  // Computed statistics
  const stats = useMemo(() => {
    const activeDisputes = disputes.filter(d => "pending" in d.account.status);
    const resolvedDisputes = disputes.filter(d => "resolved" in d.account.status);

    // Subject stats
    const validSubjects = subjects.filter(s => "valid" in s.account.status);
    const disputedSubjects = subjects.filter(s => "disputed" in s.account.status);
    const invalidSubjects = subjects.filter(s => "invalid" in s.account.status);

    // Outcome stats
    const challengerWins = resolvedDisputes.filter(d => "challengerWins" in d.account.outcome);
    const defenderWins = resolvedDisputes.filter(d => "defenderWins" in d.account.outcome);

    // Juror stats
    const activeJurors = jurors.filter(j => j.account.isActive);
    const totalJurorStake = jurors.reduce((sum, j) => sum + j.account.totalStake.toNumber(), 0);
    const totalVotes = jurors.reduce((sum, j) => sum + j.account.votesCast.toNumber(), 0);
    const avgReputation = jurors.length > 0
      ? jurors.reduce((sum, j) => sum + (j.account.reputation?.toNumber?.() ?? j.account.reputation ?? 0), 0) / jurors.length
      : 50_000_000;

    // Pool calculations
    const activePools = activeDisputes.reduce((sum, d) =>
      sum + d.account.totalBond.toNumber() + d.account.stakeHeld.toNumber() + d.account.directStakeHeld.toNumber(), 0);

    // TVL
    const tvl = totalJurorStake + activePools;

    // Defender stake (V2: availableBond)
    const totalDefenderStake = subjects.reduce((sum, s) => sum + (s.account.availableBond?.toNumber() || 0), 0);

    return {
      totalSubjects: subjects.length,
      validCount: validSubjects.length,
      disputedCount: disputedSubjects.length,
      invalidCount: invalidSubjects.length,
      activeDisputes: activeDisputes.length,
      resolvedDisputes: resolvedDisputes.length,
      totalDisputes: disputes.length,
      challengerWinRate: resolvedDisputes.length > 0 ? (challengerWins.length / resolvedDisputes.length) * 100 : 0,
      defenderWinRate: resolvedDisputes.length > 0 ? (defenderWins.length / resolvedDisputes.length) * 100 : 0,
      totalJurors: jurors.length,
      activeJurors: activeJurors.length,
      totalJurorStake,
      totalVotes,
      avgReputation,
      tvl,
      totalDefenderStake,
      activePools,
    };
  }, [subjects, disputes, jurors]);

  const formatSOL = (lamports: number) => (lamports / LAMPORTS_PER_SOL).toFixed(4);
  const formatReputation = (rep: number) => `${(rep / 1_000_000).toFixed(1)}%`;

  return (
    <div className="min-h-screen bg-obsidian">
      <Navigation />

      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="mb-12 animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-[1px] bg-gradient-to-r from-gold to-transparent" />
            <span className="text-xs uppercase tracking-[0.2em] text-gold font-medium">Protocol Overview</span>
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-bold text-ivory mb-4">
            The Digital
            <span className="block text-gold">Tribunal</span>
          </h1>
          <p className="text-steel text-lg max-w-2xl">
            A sovereign court for the digital age. Stake, challenge, arbitrate, and enforce
            agreements through decentralized consensus.
          </p>
        </div>

        {loading ? (
          <div className="tribunal-card p-12 text-center animate-slide-up">
            <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin mx-auto mb-4" />
            <p className="text-steel">Loading protocol data...</p>
          </div>
        ) : (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-slide-up stagger-1">
              <div className="stat-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-gold opacity-60"><CoinsIcon /></div>
                </div>
                <p className="stat-label">Total Value Locked</p>
                <p className="stat-value stat-value-gold">{formatSOL(stats.tvl)}</p>
                <p className="text-xs text-steel mt-1">SOL</p>
              </div>

              <div className="stat-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-crimson opacity-60"><GavelIcon /></div>
                </div>
                <p className="stat-label">Active Disputes</p>
                <p className="stat-value stat-value-crimson">{stats.activeDisputes}</p>
                <p className="text-xs text-steel mt-1">{formatSOL(stats.activePools)} SOL at stake</p>
              </div>

              <div className="stat-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-emerald opacity-60"><UsersIcon /></div>
                </div>
                <p className="stat-label">Active Jurors</p>
                <p className="stat-value stat-value-emerald">{stats.activeJurors}</p>
                <p className="text-xs text-steel mt-1">of {stats.totalJurors} registered</p>
              </div>

              <div className="stat-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-sky opacity-60"><ShieldIcon /></div>
                </div>
                <p className="stat-label">Subjects</p>
                <p className="stat-value">{stats.totalSubjects}</p>
                <p className="text-xs text-steel mt-1">{stats.validCount} valid</p>
              </div>
            </div>

            {/* Protocol Health */}
            <div className="tribunal-card p-6 mb-8 animate-slide-up stagger-2">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full border border-gold/50 flex items-center justify-center text-gold">
                    <ScaleIcon />
                  </div>
                  <h2 className="font-display text-xl font-semibold text-ivory">Protocol Health</h2>
                </div>
                <Link href="/analytics" className="text-xs text-gold hover:text-gold-light flex items-center gap-1">
                  View Analytics <ChevronRight />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Subject Status */}
                <div>
                  <p className="text-sm text-steel mb-3">Subject Status</p>
                  <div className="h-3 rounded overflow-hidden flex mb-2">
                    {stats.totalSubjects > 0 && (
                      <>
                        <div className="h-full bg-emerald" style={{ width: `${(stats.validCount / stats.totalSubjects) * 100}%` }} />
                        <div className="h-full bg-gold" style={{ width: `${(stats.disputedCount / stats.totalSubjects) * 100}%` }} />
                        <div className="h-full bg-crimson" style={{ width: `${(stats.invalidCount / stats.totalSubjects) * 100}%` }} />
                      </>
                    )}
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-emerald">{stats.validCount} valid</span>
                    <span className="text-gold">{stats.disputedCount} disputed</span>
                    <span className="text-crimson">{stats.invalidCount} invalid</span>
                  </div>
                </div>

                {/* Win Rates */}
                <div>
                  <p className="text-sm text-steel mb-3">Resolution Outcomes</p>
                  <div className="h-3 rounded overflow-hidden flex mb-2">
                    {stats.resolvedDisputes > 0 && (
                      <>
                        <div className="h-full bg-crimson" style={{ width: `${stats.challengerWinRate}%` }} />
                        <div className="h-full bg-sky" style={{ width: `${stats.defenderWinRate}%` }} />
                      </>
                    )}
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-crimson">Challengers {stats.challengerWinRate.toFixed(0)}%</span>
                    <span className="text-sky">Defenders {stats.defenderWinRate.toFixed(0)}%</span>
                  </div>
                </div>

                {/* Juror Stats */}
                <div>
                  <p className="text-sm text-steel mb-3">Juror Network</p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-steel">Total Staked</span>
                      <span className="text-sm font-semibold text-gold">{formatSOL(stats.totalJurorStake)} SOL</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-steel">Total Votes</span>
                      <span className="text-sm font-semibold text-ivory">{stats.totalVotes}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-steel">Avg Reputation</span>
                      <span className="text-sm font-semibold text-emerald">{formatReputation(stats.avgReputation)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            {!publicKey ? (
              <div className="tribunal-card-gold p-12 text-center animate-slide-up stagger-3">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full border-2 border-gold flex items-center justify-center text-gold">
                  <ShieldIcon />
                </div>
                <h2 className="font-display text-3xl font-semibold text-ivory mb-3">
                  Enter the Tribunal
                </h2>
                <p className="text-steel mb-8 max-w-md mx-auto">
                  Connect your wallet to participate in decentralized arbitration as a staker, challenger, or juror.
                </p>
                <span className="text-xs uppercase tracking-[0.15em] text-steel">
                  Use the button above to connect
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-slide-up stagger-3">
                <Link
                  href="/profile"
                  className="tribunal-card p-5 group cursor-pointer transition-all hover:border-gold/50"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded border border-slate-light flex items-center justify-center text-gold group-hover:border-gold/50 transition-colors">
                      <UsersIcon />
                    </div>
                    <ChevronRight />
                  </div>
                  <h3 className="font-display text-base font-semibold text-ivory mb-1">
                    {pool ? "Manage Accounts" : "Setup Account"}
                  </h3>
                  <p className="text-steel text-xs">
                    {pool ? "Defender pool & juror status" : "Create a defender pool"}
                  </p>
                </Link>

                <Link
                  href="/registry"
                  className="tribunal-card p-5 group cursor-pointer transition-all hover:border-gold/50"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded border border-slate-light flex items-center justify-center text-gold group-hover:border-gold/50 transition-colors">
                      <GavelIcon />
                    </div>
                    <ChevronRight />
                  </div>
                  <h3 className="font-display text-base font-semibold text-ivory mb-1">
                    Registry
                  </h3>
                  <p className="text-steel text-xs">
                    Browse subjects & disputes
                  </p>
                </Link>

                <Link
                  href="/analytics"
                  className="tribunal-card p-5 group cursor-pointer transition-all hover:border-gold/50"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded border border-slate-light flex items-center justify-center text-gold group-hover:border-gold/50 transition-colors">
                      <ChartIcon />
                    </div>
                    <ChevronRight />
                  </div>
                  <h3 className="font-display text-base font-semibold text-ivory mb-1">
                    Analytics
                  </h3>
                  <p className="text-steel text-xs">
                    Protocol metrics & trends
                  </p>
                </Link>

                <Link
                  href="/profile"
                  className="tribunal-card p-5 group cursor-pointer transition-all hover:border-gold/50"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded border border-slate-light flex items-center justify-center text-gold group-hover:border-gold/50 transition-colors">
                      <ShieldIcon />
                    </div>
                    <ChevronRight />
                  </div>
                  <h3 className="font-display text-base font-semibold text-ivory mb-1">
                    {jurorAccount ? "Juror Dashboard" : "Become a Juror"}
                  </h3>
                  <p className="text-steel text-xs">
                    {jurorAccount ? "Vote & earn rewards" : "Register as juror"}
                  </p>
                </Link>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-light mt-24 py-8">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between text-xs text-steel">
            <span>TribunalCraft Protocol v2.0</span>
            <span>Powered by Solana</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
