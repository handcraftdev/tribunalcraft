"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Navigation } from "@/components/Navigation";
import { useTribunalcraft } from "@/hooks/useTribunalcraft";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import Link from "next/link";
import { getDashboardStats, type DashboardStats } from "@/lib/supabase/queries";
import { isSupabaseConfigured } from "@/lib/supabase/client";

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
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      // Try Supabase first for aggregate stats
      if (isSupabaseConfigured()) {
        const dashboardStats = await getDashboardStats();
        setStats(dashboardStats);
      } else if (client) {
        // Fallback to RPC if Supabase not configured
        const [subjectsData, disputesData, jurorsData] = await Promise.all([
          fetchAllSubjects(),
          fetchAllDisputes(),
          fetchAllJurorPools(),
        ]);
        const subjects = subjectsData || [];
        const disputes = disputesData || [];
        const jurors = jurorsData || [];

        // Compute stats from RPC data
        const activeDisputes = disputes.filter((d: any) => "pending" in d.account.status);
        const resolvedDisputes = disputes.filter((d: any) => "resolved" in d.account.status);
        const challengerWins = resolvedDisputes.filter((d: any) => "challengerWins" in d.account.outcome);
        const defenderWinsArr = resolvedDisputes.filter((d: any) => "defenderWins" in d.account.outcome);
        const activeJurors = jurors.filter((j: any) => (j.account.balance?.toNumber?.() ?? 0) > 0);
        const totalJurorStake = jurors.reduce((sum: number, j: any) => sum + (j.account.balance?.toNumber?.() ?? 0), 0);
        const activePools = activeDisputes.reduce((sum: number, d: any) =>
          sum + (d.account.totalStake?.toNumber?.() ?? 0) + (d.account.bondAtRisk?.toNumber?.() ?? 0), 0);

        setStats({
          totalSubjects: subjects.length,
          validSubjects: subjects.filter((s: any) => "valid" in s.account.status).length,
          disputedSubjects: subjects.filter((s: any) => "disputed" in s.account.status).length,
          invalidSubjects: subjects.filter((s: any) => "invalid" in s.account.status).length,
          restoringSubjects: subjects.filter((s: any) => "restoring" in s.account.status).length,
          totalDefenderBond: subjects.reduce((sum: number, s: any) => sum + (s.account.availableBond?.toNumber() || 0), 0),
          totalDisputes: disputes.length,
          activeDisputes: activeDisputes.length,
          resolvedDisputes: resolvedDisputes.length,
          challengerWins: challengerWins.length,
          defenderWins: defenderWinsArr.length,
          noParticipation: resolvedDisputes.filter((d: any) => "noParticipation" in d.account.outcome).length,
          activePools,
          totalVotes: disputes.reduce((sum: number, d: any) => sum + (d.account.voteCount ?? 0), 0),
          totalJurors: jurors.length,
          activeJurors: activeJurors.length,
          totalJurorStake,
          avgReputation: jurors.length > 0
            ? jurors.reduce((sum: number, j: any) => sum + (j.account.reputation?.toNumber?.() ?? 50_000_000), 0) / jurors.length / 1_000_000
            : 50,
        });
      }

      // Fetch user's pools via RPC for real-time accuracy
      if (publicKey && client) {
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

  // Computed values from stats
  const tvl = stats ? stats.totalJurorStake + stats.activePools : 0;
  const challengerWinRate = stats && stats.resolvedDisputes > 0
    ? (stats.challengerWins / stats.resolvedDisputes) * 100
    : 0;
  const defenderWinRate = stats && stats.resolvedDisputes > 0
    ? (stats.defenderWins / stats.resolvedDisputes) * 100
    : 0;

  const formatSOL = (lamports: number) => (lamports / LAMPORTS_PER_SOL).toFixed(4);
  const formatReputation = (rep: number) => `${rep.toFixed(1)}%`;

  return (
    <div className="min-h-screen bg-obsidian relative overflow-hidden">
      {/* Atmospheric Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-gradient-radial from-gold/[0.03] to-transparent blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[300px] bg-gradient-radial from-emerald/[0.02] to-transparent blur-3xl" />
      </div>

      <Navigation />

      <main className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="mb-12 animate-slide-up">
          <h1 className="font-display text-3xl md:text-4xl font-semibold text-ivory leading-tight tracking-tight mb-4">
            Protocol <span className="text-gold">Overview</span>
          </h1>
          <p className="text-steel text-sm max-w-lg leading-relaxed">
            A sovereign court for the digital age. Stake, challenge, arbitrate, and enforce
            agreements through decentralized consensus.
          </p>
        </div>

        {loading || !stats ? (
          <div className="tribunal-card p-12 text-center animate-slide-up">
            <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin mx-auto mb-4" />
            <p className="text-steel">Loading protocol data...</p>
          </div>
        ) : (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-slide-up stagger-1">
              <div className="tribunal-card p-5 group">
                <div className="w-10 h-10 border border-gold/30 flex items-center justify-center mb-4 text-gold group-hover:border-gold/50 transition-colors">
                  <CoinsIcon />
                </div>
                <p className="text-xs text-steel uppercase tracking-wider mb-1">Total Value Locked</p>
                <p className="font-display text-2xl text-gold">{formatSOL(tvl)}</p>
                <p className="text-xs text-steel mt-1">SOL</p>
              </div>

              <div className="tribunal-card p-5 group">
                <div className="w-10 h-10 border border-crimson/30 flex items-center justify-center mb-4 text-crimson group-hover:border-crimson/50 transition-colors">
                  <GavelIcon />
                </div>
                <p className="text-xs text-steel uppercase tracking-wider mb-1">Active Disputes</p>
                <p className="font-display text-2xl text-crimson">{stats.activeDisputes}</p>
                <p className="text-xs text-steel mt-1">{formatSOL(stats.activePools)} SOL at stake</p>
              </div>

              <div className="tribunal-card p-5 group">
                <div className="w-10 h-10 border border-emerald/30 flex items-center justify-center mb-4 text-emerald group-hover:border-emerald/50 transition-colors">
                  <UsersIcon />
                </div>
                <p className="text-xs text-steel uppercase tracking-wider mb-1">Active Jurors</p>
                <p className="font-display text-2xl text-emerald">{stats.activeJurors}</p>
                <p className="text-xs text-steel mt-1">of {stats.totalJurors} registered</p>
              </div>

              <div className="tribunal-card p-5 group">
                <div className="w-10 h-10 border border-sky-400/30 flex items-center justify-center mb-4 text-sky-400 group-hover:border-sky-400/50 transition-colors">
                  <ShieldIcon />
                </div>
                <p className="text-xs text-steel uppercase tracking-wider mb-1">Subjects</p>
                <p className="font-display text-2xl text-ivory">{stats.totalSubjects}</p>
                <p className="text-xs text-steel mt-1">{stats.validSubjects} valid</p>
              </div>
            </div>

            {/* Protocol Health */}
            <div className="tribunal-card p-6 mb-8 animate-slide-up stagger-2">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 border border-gold/30 flex items-center justify-center text-gold">
                    <ScaleIcon />
                  </div>
                  <h2 className="font-display text-lg text-ivory">Protocol Health</h2>
                </div>
                <Link href="/analytics" className="text-xs text-gold hover:text-gold-light flex items-center gap-1 uppercase tracking-wider">
                  View Analytics <ChevronRight />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Subject Status */}
                <div>
                  <p className="text-sm text-steel mb-3">Subject Status</p>
                  <div className="h-2 flex mb-2">
                    {stats.totalSubjects > 0 && (
                      <>
                        <div className="h-full bg-emerald" style={{ width: `${(stats.validSubjects / stats.totalSubjects) * 100}%` }} />
                        <div className="h-full bg-gold" style={{ width: `${(stats.disputedSubjects / stats.totalSubjects) * 100}%` }} />
                        <div className="h-full bg-crimson" style={{ width: `${(stats.invalidSubjects / stats.totalSubjects) * 100}%` }} />
                      </>
                    )}
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-emerald">{stats.validSubjects} valid</span>
                    <span className="text-gold">{stats.disputedSubjects} disputed</span>
                    <span className="text-crimson">{stats.invalidSubjects} invalid</span>
                  </div>
                </div>

                {/* Win Rates */}
                <div>
                  <p className="text-sm text-steel mb-3">Resolution Outcomes</p>
                  <div className="h-2 flex mb-2">
                    {stats.resolvedDisputes > 0 && (
                      <>
                        <div className="h-full bg-crimson" style={{ width: `${challengerWinRate}%` }} />
                        <div className="h-full bg-sky" style={{ width: `${defenderWinRate}%` }} />
                      </>
                    )}
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-crimson">Challengers {challengerWinRate.toFixed(0)}%</span>
                    <span className="text-sky">Defenders {defenderWinRate.toFixed(0)}%</span>
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
              <div className="tribunal-card-gold p-8 text-center animate-slide-up stagger-3">
                <div className="w-12 h-12 mx-auto mb-4 border border-gold/50 flex items-center justify-center text-gold">
                  <ShieldIcon />
                </div>
                <h2 className="font-display text-2xl text-ivory mb-3">
                  Enter the Tribunal
                </h2>
                <p className="text-steel text-sm mb-6 max-w-md mx-auto leading-relaxed">
                  Connect your wallet to participate in decentralized arbitration as a staker, challenger, or juror.
                </p>
                <span className="text-xs uppercase tracking-wider text-gold/70">
                  Use the button above to connect
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-slide-up stagger-3">
                <Link href="/profile" className="tribunal-card p-5 group cursor-pointer">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 border border-gold/30 flex items-center justify-center text-gold group-hover:border-gold/50 transition-colors">
                      <UsersIcon />
                    </div>
                    <span className="text-steel group-hover:text-gold transition-colors">
                      <ChevronRight />
                    </span>
                  </div>
                  <h3 className="font-display text-base text-ivory mb-1 group-hover:text-gold transition-colors">
                    {pool ? "Manage Accounts" : "Setup Account"}
                  </h3>
                  <p className="text-steel text-xs">
                    {pool ? "Defender pool & juror status" : "Create a defender pool"}
                  </p>
                </Link>

                <Link href="/registry" className="tribunal-card p-5 group cursor-pointer">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 border border-crimson/30 flex items-center justify-center text-crimson group-hover:border-crimson/50 transition-colors">
                      <GavelIcon />
                    </div>
                    <span className="text-steel group-hover:text-gold transition-colors">
                      <ChevronRight />
                    </span>
                  </div>
                  <h3 className="font-display text-base text-ivory mb-1 group-hover:text-gold transition-colors">
                    Registry
                  </h3>
                  <p className="text-steel text-xs">
                    Browse subjects & disputes
                  </p>
                </Link>

                <Link href="/analytics" className="tribunal-card p-5 group cursor-pointer">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 border border-emerald/30 flex items-center justify-center text-emerald group-hover:border-emerald/50 transition-colors">
                      <ChartIcon />
                    </div>
                    <span className="text-steel group-hover:text-gold transition-colors">
                      <ChevronRight />
                    </span>
                  </div>
                  <h3 className="font-display text-base text-ivory mb-1 group-hover:text-gold transition-colors">
                    Analytics
                  </h3>
                  <p className="text-steel text-xs">
                    Protocol metrics & trends
                  </p>
                </Link>

                <Link href="/profile" className="tribunal-card p-5 group cursor-pointer">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 border border-sky-400/30 flex items-center justify-center text-sky-400 group-hover:border-sky-400/50 transition-colors">
                      <ShieldIcon />
                    </div>
                    <span className="text-steel group-hover:text-gold transition-colors">
                      <ChevronRight />
                    </span>
                  </div>
                  <h3 className="font-display text-base text-ivory mb-1 group-hover:text-gold transition-colors">
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
      <footer className="relative z-10 border-t border-slate-light/50 mt-24 py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between text-xs text-steel">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 border border-gold/30 flex items-center justify-center">
                <span className="font-display text-gold text-xs font-semibold">T</span>
              </div>
              <span>TribunalCraft Protocol v2.0</span>
            </div>
            <span className="text-steel/70">Powered by Solana</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
