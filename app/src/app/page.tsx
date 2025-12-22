"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

// ============================================
// ANIMATED COMPONENTS
// ============================================

const AnimatedScales = () => {
  const [tilt, setTilt] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTilt(prev => prev === 0 ? -6 : prev === -6 ? 6 : 0);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-radial from-gold/15 via-gold/5 to-transparent blur-3xl scale-110" />

      <svg
        viewBox="0 0 300 280"
        className="w-full h-full relative z-10"
        style={{ filter: "drop-shadow(0 0 60px rgba(201, 162, 39, 0.2))" }}
      >
        <circle cx="150" cy="18" r="6" fill="none" stroke="var(--gold)" strokeWidth="1.5" opacity="0.8" />
        <circle cx="150" cy="18" r="2.5" fill="var(--gold)" />
        <path d="M150 24 L150 215" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" />

        <g style={{
          transform: `rotate(${tilt}deg)`,
          transformOrigin: "150px 50px",
          transition: "transform 2s cubic-bezier(0.25, 0.1, 0.25, 1)"
        }}>
          <path d="M35 50 Q150 48 265 50" fill="none" stroke="var(--gold)" strokeWidth="2.5" />
          <path d="M55 50 L55 95" stroke="var(--gold)" strokeWidth="1.5" strokeDasharray="3,3" opacity="0.9" />
          <path d="M245 50 L245 95" stroke="var(--gold)" strokeWidth="1.5" strokeDasharray="3,3" opacity="0.9" />
          <ellipse cx="55" cy="110" rx="38" ry="12" fill="none" stroke="var(--gold)" strokeWidth="2" />
          <path d="M17 110 Q55 140 93 110" fill="none" stroke="var(--gold)" strokeWidth="1.5" opacity="0.7" />
          <ellipse cx="245" cy="110" rx="38" ry="12" fill="none" stroke="var(--gold)" strokeWidth="2" />
          <path d="M207 110 Q245 140 283 110" fill="none" stroke="var(--gold)" strokeWidth="1.5" opacity="0.7" />
        </g>

        <path d="M105 215 L150 195 L195 215" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinejoin="round" />
        <rect x="90" y="220" width="120" height="6" rx="2" fill="none" stroke="var(--gold)" strokeWidth="1.5" />
        <rect x="80" y="232" width="140" height="3" rx="1" fill="var(--gold)" opacity="0.4" />
      </svg>
    </div>
  );
};

const EconomicsVisualization = () => {
  const [animated, setAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setAnimated(true); },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative">
      <svg viewBox="0 0 200 200" className="w-44 h-44 mx-auto">
        <circle cx="100" cy="100" r="92" fill="none" stroke="var(--slate-light)" strokeWidth="1" opacity="0.3" />
        <circle cx="100" cy="100" r="78" fill="none" stroke="var(--gold)" strokeWidth="12"
          strokeDasharray={animated ? "392 490" : "0 490"}
          transform="rotate(-90 100 100)"
          style={{ transition: "stroke-dasharray 1.5s cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
        <circle cx="100" cy="100" r="78" fill="none" stroke="var(--emerald)" strokeWidth="12"
          strokeDasharray={animated ? "93 490" : "0 490"}
          strokeDashoffset="-392"
          transform="rotate(-90 100 100)"
          style={{ transition: "stroke-dasharray 1.5s cubic-bezier(0.4, 0, 0.2, 1) 0.2s" }}
        />
        <circle cx="100" cy="100" r="78" fill="none" stroke="var(--steel)" strokeWidth="12"
          strokeDasharray={animated ? "5 490" : "0 490"}
          strokeDashoffset="-485"
          transform="rotate(-90 100 100)"
          style={{ transition: "stroke-dasharray 1.5s cubic-bezier(0.4, 0, 0.2, 1) 0.4s" }}
        />
        <text x="100" y="95" textAnchor="middle" fill="var(--ivory)" fontSize="24" fontFamily="var(--font-display)" fontWeight="600">20%</text>
        <text x="100" y="112" textAnchor="middle" fill="var(--steel)" fontSize="8" fontFamily="var(--font-body)" letterSpacing="0.1em">TOTAL FEES</text>
      </svg>

      <div className="flex justify-center gap-6 mt-6">
        {[
          { color: "bg-gold", label: "80% Winners" },
          { color: "bg-emerald", label: "19% Jurors" },
          { color: "bg-steel", label: "1% Protocol" },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 ${item.color}`} />
            <span className="text-steel text-xs">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// ICON COMPONENTS
// ============================================

const ShieldIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const SwordIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
    <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
    <path d="M13 19l6-6" />
    <path d="M16 16l4 4" />
    <path d="M19 21l2-2" />
  </svg>
);

const GavelIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
    <path d="M14 12l-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L11 9" />
    <path d="M11 9l5-5 4 4-5 5" />
    <path d="M17 3l4 4" />
  </svg>
);

const LockIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const ScaleIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
    <path d="M12 3v18" />
    <path d="M3 7h18" />
    <path d="M5 7l2 8h-4l2-8" />
    <path d="M17 7l2 8h-4l2-8" />
  </svg>
);

const CheckCircleIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

const UsersIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const CoinsIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="9" cy="9" r="6" />
    <path d="M15 9a6 6 0 1 1 0 12 6 6 0 0 1 0-12z" />
  </svg>
);

const FileIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const ArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

// ============================================
// MAIN COMPONENT
// ============================================

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-obsidian overflow-x-hidden">
      {/* NAVIGATION */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? "bg-obsidian/98 backdrop-blur-md border-b border-slate-light/30" : "bg-transparent"
      }`}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 border border-gold/50 flex items-center justify-center group-hover:border-gold transition-colors">
              <span className="font-display text-gold text-sm font-semibold">T</span>
            </div>
            <span className="font-display text-lg text-ivory hidden sm:block">TribunalCraft</span>
          </Link>

          <div className="hidden lg:flex items-center gap-8">
            <a href="#how-it-works" className="text-steel hover:text-parchment transition-colors text-sm">How It Works</a>
            <a href="#trust" className="text-steel hover:text-parchment transition-colors text-sm">Trust & Security</a>
            <a href="#roles" className="text-steel hover:text-parchment transition-colors text-sm">Roles</a>
            <a href="#use-cases" className="text-steel hover:text-parchment transition-colors text-sm">Use Cases</a>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/overview" className="hidden sm:block text-sm text-steel hover:text-parchment transition-colors">
              Overview
            </Link>
            <Link
              href="/registry"
              className="flex items-center gap-1.5 bg-gold/10 hover:bg-gold/20 border border-gold/30 hover:border-gold/50 text-gold px-4 py-2 text-sm transition-all"
            >
              Launch App
              <ArrowIcon />
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative min-h-screen flex items-start pt-36 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/4 w-[800px] h-[500px] bg-gradient-radial from-gold/[0.03] to-transparent blur-3xl" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-obsidian to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[calc(100vh-10rem)]">
            <div className={`transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate/50 border border-slate-light/50 mb-8">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald"></span>
                </span>
                <span className="text-xs text-steel">Live on Solana Devnet</span>
              </div>

              <h1 className="font-display mb-6">
                <span className="block text-4xl md:text-5xl lg:text-6xl font-semibold text-ivory leading-[1.1] tracking-tight">
                  A Sovereign Court
                </span>
                <span className="block text-4xl md:text-5xl lg:text-6xl font-semibold text-gold leading-[1.1] tracking-tight mt-1">
                  for the Digital Age
                </span>
              </h1>

              <p className="text-base text-steel max-w-md mb-8 leading-relaxed">
                Trustless dispute resolution where economic consensus reveals truth.
                No intermediaries. Just stakes and outcomes.
              </p>

              <div className="flex flex-wrap gap-3 mb-10">
                <Link
                  href="/registry"
                  className="inline-flex items-center gap-2 bg-gold hover:bg-gold-light text-obsidian font-medium px-5 py-2.5 text-sm transition-all"
                >
                  Enter Tribunal
                  <ArrowIcon />
                </Link>
                <a href="#how-it-works" className="inline-flex items-center text-parchment hover:text-gold px-4 py-2.5 text-sm transition-colors">
                  Learn More
                </a>
              </div>

              <div className="flex gap-10 pt-6 border-t border-slate-light/30">
                {[
                  { value: "100%", label: "On-Chain" },
                  { value: "Open", label: "All Records" },
                  { value: "Zero", label: "Hidden Data" },
                ].map((stat, i) => (
                  <div key={i}>
                    <div className="font-display text-2xl text-ivory font-medium">{stat.value}</div>
                    <div className="text-xs text-steel mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`hidden lg:block h-[380px] transition-all duration-1000 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <AnimatedScales />
            </div>
          </div>
        </div>
      </section>

      {/* QUOTE */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="font-display text-xl md:text-2xl text-parchment/90 leading-relaxed italic">
            &ldquo;In matters of dispute, let not authority decide, but the collective wisdom
            of those with <span className="text-gold not-italic">stake</span> in the outcome—where
            all evidence is <span className="text-gold not-italic">open</span> and nothing hidden.&rdquo;
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl text-ivory font-medium">How It Works</h2>
            <p className="mt-3 text-steel text-sm max-w-md mx-auto">A simple five-step process from creation to resolution</p>
          </div>

          <div className="relative max-w-2xl mx-auto">
            <div className="absolute left-5 top-6 bottom-6 w-px bg-gradient-to-b from-gold via-gold/50 to-gold/20" />

            {[
              { num: "01", title: "Subject Created", desc: "Creator submits a claim with initial bond. Details stored on IPFS." },
              { num: "02", title: "Challenge Filed", desc: "Challenger stakes SOL to dispute. Stakes determine the prize pool." },
              { num: "03", title: "Voting Opens", desc: "Jurors allocate stake to vote. Power proportional to commitment." },
              { num: "04", title: "Resolution", desc: "Majority wins. Funds distributed: 80% winners, 19% jurors, 1% protocol." },
              { num: "05", title: "Rewards Claimed", desc: "Winners claim after 7-day lock. Reputation updates. Subject finalized." },
            ].map((step, i) => (
              <div key={i} className="relative pl-14 pb-8 last:pb-0">
                <div className="absolute left-0 w-10 h-10 bg-slate border border-gold/30 flex items-center justify-center">
                  <span className="font-display text-gold text-xs">{step.num}</span>
                </div>
                <div className="pt-1">
                  <h3 className="font-display text-lg text-ivory mb-1">{step.title}</h3>
                  <p className="text-steel text-sm">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ECONOMICS */}
      <section className="py-16 bg-gradient-to-b from-slate/20 to-transparent">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <EconomicsVisualization />
            </div>

            <div className="order-1 lg:order-2">
              <h2 className="font-display text-3xl text-ivory font-medium mb-4">Transparent Economics</h2>
              <p className="text-steel mb-8">
                Every SOL staked is distributed according to immutable on-chain rules.
                No hidden fees. No platform extraction.
              </p>

              <div className="space-y-4">
                {[
                  { pct: "80%", title: "Winner Pool", desc: "Distributed to winning parties proportionally", color: "text-gold" },
                  { pct: "19%", title: "Juror Rewards", desc: "Split among correct voters by voting power", color: "text-emerald-light" },
                  { pct: "1%", title: "Protocol", desc: "Minimal fee for infrastructure sustainability", color: "text-steel-light" },
                ].map((item, i) => (
                  <div key={i} className="flex gap-3">
                    <span className={`font-display text-xl ${item.color} w-12`}>{item.pct}</span>
                    <div>
                      <div className="text-ivory text-sm font-medium">{item.title}</div>
                      <div className="text-steel text-xs">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST & SECURITY */}
      <section id="trust" className="py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl text-ivory font-medium">Trust & Security</h2>
            <p className="mt-3 text-steel text-sm max-w-lg mx-auto">
              Built on two principles: everyone sees the same information, and everyone has skin in the game.
            </p>
          </div>

          {/* Core Principles */}
          <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto mb-8">
            <div className="p-5 bg-slate/30 border border-slate-light/20">
              <div className="w-9 h-9 border border-gold/30 flex items-center justify-center mb-4">
                <ScaleIcon className="w-5 h-5 text-gold" />
              </div>
              <h3 className="font-display text-base text-ivory mb-2">Radical Transparency</h3>
              <p className="text-steel text-xs leading-relaxed">
                Every vote, stake, and outcome permanently on-chain. All participants access the same data—nothing hidden, nothing privileged.
              </p>
            </div>
            <div className="p-5 bg-slate/30 border border-slate-light/20">
              <div className="w-9 h-9 border border-gold/30 flex items-center justify-center mb-4">
                <CoinsIcon className="w-5 h-5 text-gold" />
              </div>
              <h3 className="font-display text-base text-ivory mb-2">Economic Consensus</h3>
              <p className="text-steel text-xs leading-relaxed">
                Truth emerges from those willing to stake on it. No intermediaries—just participants putting value behind their judgment.
              </p>
            </div>
          </div>

          {/* Mechanisms */}
          <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {[
              { icon: LockIcon, title: "Stake Lock Period", desc: "Jurors lock stake for 7 days post-vote. No hit-and-run decisions—you stand by your judgment." },
              { icon: CheckCircleIcon, title: "Asymmetric Reputation", desc: "Incorrect votes lose 2% reputation while correct votes gain 1%. Careful judgment rewarded." },
              { icon: UsersIcon, title: "Quadratic Voting Power", desc: "Power scales with √stake, preventing whale takeover. Splitting accounts reduces influence." },
              { icon: FileIcon, title: "Immutable Records", desc: "All actions permanently recorded on Solana. Audit any dispute, verify any outcome." },
            ].map((card, i) => (
              <div key={i} className="p-5 bg-slate/30 border border-slate-light/20">
                <div className="w-9 h-9 border border-slate-light/30 flex items-center justify-center mb-4">
                  <card.icon className="w-5 h-5 text-steel" />
                </div>
                <h3 className="font-display text-base text-ivory mb-2">{card.title}</h3>
                <p className="text-steel text-xs leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 max-w-2xl mx-auto">
            <div className="grid grid-cols-4 gap-4 text-center">
              {[
                { value: "7 Days", label: "Stake Lock" },
                { value: "50%", label: "Slash Threshold" },
                { value: "√x", label: "Quadratic Power" },
                { value: "100%", label: "On-Chain" },
              ].map((item, i) => (
                <div key={i} className="py-3">
                  <div className="font-display text-xl text-gold">{item.value}</div>
                  <div className="text-xs text-steel mt-0.5">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* REPUTATION */}
      <section className="py-16 bg-gradient-to-b from-slate/20 to-transparent">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="font-display text-3xl text-ivory font-medium mb-4">Reputation-Driven Trust</h2>
            <p className="text-steel text-sm mb-8">
              Your reputation reflects your judgment history. Consistently accurate participants
              build trust over time, while bad actors face compounding consequences.
            </p>

            <div className="grid grid-cols-3 gap-4 text-left">
              <div className="p-4 bg-slate/30 border border-slate-light/20">
                <div className="text-gold font-display text-2xl mb-1">+1%</div>
                <div className="text-ivory text-xs font-medium">Correct Decision</div>
                <div className="text-steel text-xs mt-0.5">Vote with the majority</div>
              </div>
              <div className="p-4 bg-slate/30 border border-slate-light/20">
                <div className="text-crimson-light font-display text-2xl mb-1">-2%</div>
                <div className="text-ivory text-xs font-medium">Wrong Decision</div>
                <div className="text-steel text-xs mt-0.5">Vote against outcome</div>
              </div>
              <div className="p-4 bg-slate/30 border border-slate-light/20">
                <div className="text-steel-light font-display text-2xl mb-1">&lt;50%</div>
                <div className="text-ivory text-xs font-medium">Stake Slashed</div>
                <div className="text-steel text-xs mt-0.5">Withdraw penalty</div>
              </div>
            </div>

            <p className="text-steel text-xs mt-6 max-w-md mx-auto">
              Honest participation is the only sustainable strategy. Bad actors either improve or exit.
            </p>
          </div>
        </div>
      </section>

      {/* THREE ROLES */}
      <section id="roles" className="py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl text-ivory font-medium">Three Roles</h2>
            <p className="mt-3 text-steel text-sm">Each participant plays a crucial part in the tribunal</p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Defender */}
            <div
              className="group p-6 border transition-all"
              style={{
                background: 'linear-gradient(to bottom, rgba(56, 189, 248, 0.03), transparent)',
                borderColor: 'rgba(56, 189, 248, 0.2)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.4)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.2)'}
            >
              <div className="w-10 h-10 flex items-center justify-center mb-4 text-sky-400" style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)' }}>
                <ShieldIcon className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg text-ivory mb-1">Defender</h3>
              <p className="text-sky-400 text-xs mb-3" style={{ opacity: 0.8 }}>Protect Truth</p>
              <p className="text-steel text-xs mb-4">
                Bond SOL behind subjects you believe are valid. Your stake becomes reward if challengers fail.
              </p>
              <ul className="space-y-1.5 text-xs text-parchment/80">
                <li className="flex items-center gap-1.5"><span className="text-sky-500">•</span>Create & bond subjects</li>
                <li className="flex items-center gap-1.5"><span className="text-sky-500">•</span>Auto-defend via pool</li>
                <li className="flex items-center gap-1.5"><span className="text-sky-500">•</span>Win challenger stakes</li>
              </ul>
            </div>

            {/* Challenger */}
            <div
              className="group p-6 border transition-all"
              style={{
                background: 'linear-gradient(to bottom, rgba(185, 28, 28, 0.03), transparent)',
                borderColor: 'rgba(185, 28, 28, 0.25)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(185, 28, 28, 0.5)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(185, 28, 28, 0.25)'}
            >
              <div className="w-10 h-10 flex items-center justify-center mb-4 text-crimson-light" style={{ backgroundColor: 'rgba(185, 28, 28, 0.1)' }}>
                <SwordIcon className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg text-ivory mb-1">Challenger</h3>
              <p className="text-crimson-light text-xs mb-3" style={{ opacity: 0.8 }}>Expose Falsehood</p>
              <p className="text-steel text-xs mb-4">
                Dispute subjects you believe are false. If proven right, claim the defender&apos;s bond.
              </p>
              <ul className="space-y-1.5 text-xs text-parchment/80">
                <li className="flex items-center gap-1.5"><span className="text-crimson-light">•</span>File disputes instantly</li>
                <li className="flex items-center gap-1.5"><span className="text-crimson-light">•</span>Submit evidence on-chain</li>
                <li className="flex items-center gap-1.5"><span className="text-crimson-light">•</span>Win defender bonds</li>
              </ul>
            </div>

            {/* Juror */}
            <div
              className="group p-6 border transition-all"
              style={{
                background: 'linear-gradient(to bottom, rgba(201, 162, 39, 0.03), transparent)',
                borderColor: 'rgba(201, 162, 39, 0.25)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(201, 162, 39, 0.5)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(201, 162, 39, 0.25)'}
            >
              <div className="w-10 h-10 flex items-center justify-center mb-4 text-gold" style={{ backgroundColor: 'rgba(201, 162, 39, 0.1)' }}>
                <GavelIcon className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg text-ivory mb-1">Juror</h3>
              <p className="text-gold text-xs mb-3" style={{ opacity: 0.8 }}>Decide Outcomes</p>
              <p className="text-steel text-xs mb-4">
                Stake to join the tribunal. Vote on disputes to earn 19% of every resolution.
              </p>
              <ul className="space-y-1.5 text-xs text-parchment/80">
                <li className="flex items-center gap-1.5"><span className="text-gold">•</span>Register with stake</li>
                <li className="flex items-center gap-1.5"><span className="text-gold">•</span>Vote on disputes</li>
                <li className="flex items-center gap-1.5"><span className="text-gold">•</span>Earn 19% of pool</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* USE CASES */}
      <section id="use-cases" className="py-16 bg-gradient-to-b from-slate/20 to-transparent">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl text-ivory font-medium">Use Cases</h2>
            <p className="mt-3 text-steel text-sm">Any scenario where trust and accountability matter</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { title: "Freelance Escrow", desc: "Milestone-based payments with built-in dispute resolution.", tag: "Gig Economy" },
              { title: "DAO Governance", desc: "Challenge proposal implementations and treasury allocations.", tag: "Governance" },
              { title: "NFT Authentication", desc: "Verify collection legitimacy through stake-backed claims.", tag: "Digital Art" },
              { title: "Oracle Disputes", desc: "Decentralized resolution for prediction markets.", tag: "DeFi" },
              { title: "Content Verification", desc: "Community-driven fact-checking with economic stakes.", tag: "Media" },
              { title: "Service Agreements", desc: "Automatic SLA enforcement without legal overhead.", tag: "Enterprise" },
            ].map((uc, i) => (
              <div key={i} className="p-5 bg-slate/30 border border-slate-light/20 hover:border-gold/20 transition-colors">
                <span className="inline-block px-2 py-0.5 text-xs text-gold/80 bg-gold/10 mb-3">{uc.tag}</span>
                <h3 className="font-display text-base text-ivory mb-1">{uc.title}</h3>
                <p className="text-steel text-xs">{uc.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DIFFERENTIATORS */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl text-ivory font-medium mb-10">Why TribunalCraft</h2>

          <div className="grid grid-cols-3 gap-8">
            <div>
              <div className="font-display text-4xl text-gold mb-2">Open</div>
              <h3 className="text-ivory text-sm font-medium mb-1">Full Visibility</h3>
              <p className="text-steel text-xs">Every record publicly accessible</p>
            </div>
            <div>
              <div className="font-display text-4xl text-gold mb-2">Verifiable</div>
              <h3 className="text-ivory text-sm font-medium mb-1">On-Chain Proof</h3>
              <p className="text-steel text-xs">Immutable, auditable history</p>
            </div>
            <div>
              <div className="font-display text-4xl text-gold mb-2">Equal</div>
              <h3 className="text-ivory text-sm font-medium mb-1">Same Information</h3>
              <p className="text-steel text-xs">No privileged access to data</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="absolute inset-0 bg-gradient-radial from-gold/5 via-transparent to-transparent" />

        <div className="relative z-10 max-w-2xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate/50 border border-slate-light/50 mb-6">
            <span className="text-xs text-steel">Devnet Live • Mainnet Q1 2025</span>
          </div>

          <h2 className="font-display text-4xl md:text-5xl text-ivory font-medium mb-4">
            The Tribunal Awaits
          </h2>

          <p className="text-steel mb-8 max-w-md mx-auto">
            Where stakes speak louder than authority and all records live on-chain.
            Create subjects, challenge claims, or serve as a juror.
          </p>

          <div className="flex gap-3 justify-center">
            <Link
              href="/registry"
              className="inline-flex items-center gap-2 bg-gold hover:bg-gold-light text-obsidian font-medium px-5 py-2.5 text-sm transition-all"
            >
              Launch App
              <ArrowIcon />
            </Link>
            <a
              href="https://github.com/tribunalcraft"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-parchment hover:text-gold px-4 py-2.5 text-sm transition-colors"
            >
              View Source
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-light/20 py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 border border-gold/50 flex items-center justify-center">
                  <span className="font-display text-gold text-xs">T</span>
                </div>
                <span className="font-display text-ivory">TribunalCraft</span>
              </div>
              <p className="text-xs text-steel">Decentralized dispute resolution on Solana.</p>
            </div>

            <div>
              <h4 className="text-ivory text-xs font-medium mb-3">Developers</h4>
              <ul className="space-y-1.5 text-xs text-steel">
                <li><a href="https://github.com/tribunalcraft" target="_blank" rel="noopener noreferrer" className="hover:text-parchment transition-colors">GitHub</a></li>
                <li><a href="#" className="hover:text-parchment transition-colors">SDK Docs</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-ivory text-xs font-medium mb-3">Community</h4>
              <ul className="space-y-1.5 text-xs text-steel">
                <li><a href="#" className="hover:text-parchment transition-colors">Discord</a></li>
                <li><a href="#" className="hover:text-parchment transition-colors">Twitter</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-light/20 flex flex-col md:flex-row justify-between items-center gap-3">
            <p className="text-xs text-steel">&copy; 2025 TribunalCraft</p>
            <p className="text-xs text-gold/70 font-display italic">Truth through consensus. Justice through code.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
