"use client";

import { useEffect, useState } from "react";
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

export default function Dashboard() {
  const { publicKey } = useWallet();
  const {
    fetchDefenderPool,
    getDefenderPoolPDA,
    fetchAllSubjects,
    fetchAllDisputes,
    fetchAllJurors,
    fetchJurorAccount,
    getJurorPDA
  } = useTribunalcraft();

  const [pool, setPool] = useState<any>(null);
  const [jurorAccount, setJurorAccount] = useState<any>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [jurors, setJurors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch global data
      const subjectsData = await fetchAllSubjects();
      setSubjects(subjectsData);

      const disputesData = await fetchAllDisputes();
      setDisputes(disputesData);

      const jurorsData = await fetchAllJurors();
      setJurors(jurorsData);

      // Fetch user-specific data if connected
      if (publicKey) {
        const [poolPda] = getDefenderPoolPDA(publicKey);
        try {
          const poolData = await fetchDefenderPool(poolPda);
          setPool(poolData);
        } catch {
          setPool(null);
        }

        const [jurorPda] = getJurorPDA(publicKey);
        try {
          const jurorData = await fetchJurorAccount(jurorPda);
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
  }, [publicKey]);

  const activeDisputes = disputes.filter(d => d.account.status.pending);
  const totalStaked = subjects.reduce((acc, s) => acc + (s.account.totalStake?.toNumber() || 0), 0);

  return (
    <div className="min-h-screen bg-obsidian">
      <Navigation />

      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="mb-16 animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-[1px] bg-gold" />
            <span className="text-xs uppercase tracking-[0.2em] text-gold">Protocol Overview</span>
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

        {/* Protocol Stats - Always visible */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="stat-card animate-slide-up stagger-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-gold opacity-60"><GavelIcon /></div>
            </div>
            <p className="stat-label">Registered Subjects</p>
            <p className="stat-value">{loading ? "..." : subjects.length}</p>
          </div>

          <div className="stat-card animate-slide-up stagger-2">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-crimson opacity-60"><ShieldIcon /></div>
            </div>
            <p className="stat-label">Active Disputes</p>
            <p className="stat-value stat-value-crimson">
              {loading ? "..." : activeDisputes.length}
            </p>
          </div>

          <div className="stat-card animate-slide-up stagger-3">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-emerald opacity-60"><UsersIcon /></div>
            </div>
            <p className="stat-label">Active Jurors</p>
            <p className="stat-value stat-value-emerald">
              {loading ? "..." : jurors.filter(j => j.account.isActive).length}
            </p>
          </div>

          <div className="stat-card animate-slide-up stagger-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-gold opacity-60"><ScaleIcon /></div>
            </div>
            <p className="stat-label">Total Staked</p>
            <p className="stat-value stat-value-gold">
              {loading ? "..." : (totalStaked / LAMPORTS_PER_SOL).toFixed(2)}
              <span className="text-lg ml-1">SOL</span>
            </p>
          </div>
        </div>

        {!publicKey ? (
          /* Connect Wallet CTA */
          <div className="tribunal-card-gold p-12 text-center animate-slide-up stagger-5">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full border-2 border-gold flex items-center justify-center">
              <ShieldIcon />
            </div>
            <h2 className="font-display text-3xl font-semibold text-ivory mb-3">
              Enter the Tribunal
            </h2>
            <p className="text-steel mb-8 max-w-md mx-auto">
              Connect your wallet to participate in decentralized arbitration as a staker, challenger, or juror.
            </p>
            <div className="inline-block">
              <span className="text-xs uppercase tracking-[0.15em] text-steel">
                Use the button above to connect
              </span>
            </div>
          </div>
        ) : (
          <>
            {/* Your Status */}
            <div className="tribunal-card p-8 mb-8 animate-slide-up stagger-5">
              <h2 className="font-display text-xl font-semibold text-ivory mb-6">
                Your Status
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="vertical-rule">
                  <p className="text-xs uppercase tracking-wider text-steel mb-1">Staker Pool</p>
                  <p className="text-ivory font-medium">
                    {pool ? `${(pool.totalStake.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL` : "Not Created"}
                  </p>
                </div>
                <div className="vertical-rule">
                  <p className="text-xs uppercase tracking-wider text-steel mb-1">Pool Available</p>
                  <p className="text-emerald font-medium">
                    {pool ? `${(pool.available.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL` : "—"}
                  </p>
                </div>
                <div className="vertical-rule">
                  <p className="text-xs uppercase tracking-wider text-steel mb-1">Juror Status</p>
                  <p className={`font-medium ${jurorAccount?.isActive ? "text-emerald" : "text-steel"}`}>
                    {jurorAccount ? (jurorAccount.isActive ? "Active" : "Inactive") : "Not Registered"}
                  </p>
                </div>
                <div className="vertical-rule">
                  <p className="text-xs uppercase tracking-wider text-steel mb-1">Juror Reputation</p>
                  <p className="text-gold font-medium">
                    {jurorAccount ? `${(jurorAccount.reputation / 100).toFixed(1)}%` : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href="/account"
                className="tribunal-card p-6 group cursor-pointer transition-all hover:border-gold/50"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded border border-slate-light flex items-center justify-center text-gold group-hover:border-gold/50 transition-colors">
                    <UsersIcon />
                  </div>
                  <ChevronRight />
                </div>
                <h3 className="font-display text-lg font-semibold text-ivory mb-2">
                  {pool ? "Account Settings" : "Setup Account"}
                </h3>
                <p className="text-steel text-sm">
                  {pool ? "Manage your staker pool and view activity" : "Create a staker pool to back linked subjects"}
                </p>
              </Link>

              <Link
                href="/registry"
                className="tribunal-card p-6 group cursor-pointer transition-all hover:border-gold/50"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded border border-slate-light flex items-center justify-center text-gold group-hover:border-gold/50 transition-colors">
                    <GavelIcon />
                  </div>
                  <ChevronRight />
                </div>
                <h3 className="font-display text-lg font-semibold text-ivory mb-2">
                  Registry
                </h3>
                <p className="text-steel text-sm">
                  Browse subjects, file disputes, and track arbitration outcomes
                </p>
              </Link>

              <Link
                href="/juror"
                className="tribunal-card p-6 group cursor-pointer transition-all hover:border-gold/50"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded border border-slate-light flex items-center justify-center text-gold group-hover:border-gold/50 transition-colors">
                    <ShieldIcon />
                  </div>
                  <ChevronRight />
                </div>
                <h3 className="font-display text-lg font-semibold text-ivory mb-2">
                  {jurorAccount ? "Juror Dashboard" : "Become a Juror"}
                </h3>
                <p className="text-steel text-sm">
                  {jurorAccount ? "View your juror status and vote on disputes" : "Register as a juror to vote on disputes and earn rewards"}
                </p>
              </Link>
            </div>

            {/* Recent Disputes */}
            {activeDisputes.length > 0 && (
              <div className="tribunal-card p-8 mt-8 animate-slide-up stagger-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display text-xl font-semibold text-ivory">
                    Active Disputes
                  </h2>
                  <Link
                    href="/registry"
                    className="text-gold text-sm uppercase tracking-wider hover:text-gold-light transition-colors flex items-center gap-1"
                  >
                    View All <ChevronRight />
                  </Link>
                </div>
                <div className="space-y-4">
                  {activeDisputes.slice(0, 3).map((dispute, i) => (
                    <div key={i} className="bg-obsidian p-4 border border-slate-light flex items-center justify-between">
                      <div>
                        <p className="text-ivory font-medium text-sm">
                          Dispute #{i + 1}
                        </p>
                        <p className="text-steel text-xs mt-1">
                          Bond: {(dispute.account.totalBond.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL
                          {" | "}
                          Votes: {dispute.account.voteCount}
                        </p>
                      </div>
                      <span className="text-xs uppercase tracking-wider px-2 py-1 bg-crimson/20 text-crimson border border-crimson/30">
                        Pending
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-light mt-24 py-8">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between text-xs text-steel">
            <span>TribunalCraft Protocol v2.0 - Global</span>
            <span>Powered by Solana</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
