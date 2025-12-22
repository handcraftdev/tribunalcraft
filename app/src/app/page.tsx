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
      {/* Ethereal glow layers */}
      <div className="absolute inset-0 bg-gradient-radial from-gold/20 via-gold/5 to-transparent blur-3xl scale-110" />
      <div className="absolute inset-0 bg-gradient-radial from-gold/10 to-transparent blur-2xl scale-90" />

      <svg
        viewBox="0 0 300 280"
        className="w-full h-full relative z-10"
        style={{ filter: "drop-shadow(0 0 80px rgba(201, 162, 39, 0.25))" }}
      >
        {/* Ornate top finial */}
        <circle cx="150" cy="18" r="6" fill="none" stroke="var(--gold)" strokeWidth="1.5" opacity="0.8" />
        <circle cx="150" cy="18" r="2.5" fill="var(--gold)" />

        {/* Center pillar with taper */}
        <path d="M150 24 L150 215" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" />

        {/* Main beam with elegant rotation */}
        <g style={{
          transform: `rotate(${tilt}deg)`,
          transformOrigin: "150px 50px",
          transition: "transform 2s cubic-bezier(0.25, 0.1, 0.25, 1)"
        }}>
          {/* Beam with slight curve illusion */}
          <path d="M35 50 Q150 48 265 50" fill="none" stroke="var(--gold)" strokeWidth="2.5" />

          {/* Left chain - delicate links */}
          <path d="M55 50 L55 95" stroke="var(--gold)" strokeWidth="1.5" strokeDasharray="3,3" opacity="0.9" />

          {/* Right chain */}
          <path d="M245 50 L245 95" stroke="var(--gold)" strokeWidth="1.5" strokeDasharray="3,3" opacity="0.9" />

          {/* Left bowl - refined shape */}
          <ellipse cx="55" cy="110" rx="38" ry="12" fill="none" stroke="var(--gold)" strokeWidth="2" />
          <path d="M17 110 Q55 140 93 110" fill="none" stroke="var(--gold)" strokeWidth="1.5" opacity="0.7" />

          {/* Right bowl */}
          <ellipse cx="245" cy="110" rx="38" ry="12" fill="none" stroke="var(--gold)" strokeWidth="2" />
          <path d="M207 110 Q245 140 283 110" fill="none" stroke="var(--gold)" strokeWidth="1.5" opacity="0.7" />
        </g>

        {/* Elegant base */}
        <path d="M105 215 L150 195 L195 215" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinejoin="round" />
        <rect x="90" y="220" width="120" height="6" rx="3" fill="none" stroke="var(--gold)" strokeWidth="1.5" />
        <rect x="80" y="232" width="140" height="3" rx="1.5" fill="var(--gold)" opacity="0.4" />
      </svg>
    </div>
  );
};

// Economics ring visualization
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
      <svg viewBox="0 0 200 200" className="w-52 h-52 mx-auto">
        {/* Outer ring */}
        <circle cx="100" cy="100" r="92" fill="none" stroke="var(--slate-light)" strokeWidth="1" opacity="0.3" />

        {/* 80% Winners arc */}
        <circle
          cx="100" cy="100" r="78"
          fill="none" stroke="var(--gold)" strokeWidth="14"
          strokeDasharray={animated ? "392 490" : "0 490"}
          strokeLinecap="round"
          transform="rotate(-90 100 100)"
          style={{ transition: "stroke-dasharray 1.8s cubic-bezier(0.4, 0, 0.2, 1)" }}
        />

        {/* 19% Jurors arc */}
        <circle
          cx="100" cy="100" r="78"
          fill="none" stroke="var(--emerald)" strokeWidth="14"
          strokeDasharray={animated ? "93 490" : "0 490"}
          strokeDashoffset="-392"
          strokeLinecap="round"
          transform="rotate(-90 100 100)"
          style={{ transition: "stroke-dasharray 1.8s cubic-bezier(0.4, 0, 0.2, 1) 0.2s" }}
        />

        {/* 1% Protocol arc */}
        <circle
          cx="100" cy="100" r="78"
          fill="none" stroke="var(--steel)" strokeWidth="14"
          strokeDasharray={animated ? "5 490" : "0 490"}
          strokeDashoffset="-485"
          strokeLinecap="round"
          transform="rotate(-90 100 100)"
          style={{ transition: "stroke-dasharray 1.8s cubic-bezier(0.4, 0, 0.2, 1) 0.4s" }}
        />

        {/* Center content */}
        <text x="100" y="92" textAnchor="middle" fill="var(--ivory)" fontSize="26" fontFamily="var(--font-display)" fontWeight="600">20%</text>
        <text x="100" y="112" textAnchor="middle" fill="var(--steel)" fontSize="9" fontFamily="var(--font-body)" letterSpacing="0.1em">TOTAL FEES</text>
      </svg>

      {/* Legend - horizontal flow */}
      <div className="flex justify-center gap-8 mt-8">
        {[
          { color: "bg-gold", label: "80% Winners" },
          { color: "bg-emerald", label: "19% Jurors" },
          { color: "bg-steel", label: "1% Protocol" },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
            <span className="text-steel text-sm">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// ICON COMPONENTS
// ============================================

const ShieldIcon = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const SwordIcon = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
    <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
    <path d="M13 19l6-6" />
    <path d="M16 16l4 4" />
    <path d="M19 21l2-2" />
  </svg>
);

const GavelIcon = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
    <path d="M14 12l-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L11 9" />
    <path d="M11 9l5-5 4 4-5 5" />
    <path d="M17 3l4 4" />
  </svg>
);

const LockIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const ScaleIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
    <path d="M12 3v18" />
    <path d="M3 7h18" />
    <path d="M5 7l2 8h-4l2-8" />
    <path d="M17 7l2 8h-4l2-8" />
  </svg>
);

const CheckCircleIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

const UsersIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ArrowIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
      {/* ============================================
          NAVIGATION
          ============================================ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? "bg-obsidian/98 backdrop-blur-md border-b border-gold/10" : "bg-transparent"
      }`}>
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-full border border-gold/50 flex items-center justify-center group-hover:border-gold transition-colors">
              <span className="font-display text-gold text-lg font-semibold">T</span>
            </div>
            <div className="hidden sm:block">
              <span className="font-display text-lg text-ivory">TribunalCraft</span>
            </div>
          </Link>

          <div className="hidden lg:flex items-center gap-10">
            <a href="#how-it-works" className="text-steel hover:text-parchment transition-colors text-sm">How It Works</a>
            <a href="#trust" className="text-steel hover:text-parchment transition-colors text-sm">Trust & Security</a>
            <a href="#roles" className="text-steel hover:text-parchment transition-colors text-sm">Roles</a>
            <a href="#use-cases" className="text-steel hover:text-parchment transition-colors text-sm">Use Cases</a>
          </div>

          <div className="flex items-center gap-5">
            <Link href="/overview" className="hidden sm:block text-sm text-steel hover:text-parchment transition-colors">
              Dashboard
            </Link>
            <Link
              href="/registry"
              className="group flex items-center gap-2 bg-gold/10 hover:bg-gold/20 border border-gold/30 hover:border-gold/50 text-gold px-5 py-2.5 rounded-full text-sm transition-all duration-300"
            >
              Launch App
              <ArrowIcon />
            </Link>
          </div>
        </div>
      </nav>

      {/* ============================================
          HERO SECTION
          ============================================ */}
      <section className="relative min-h-screen flex items-center pt-24 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/4 w-[1000px] h-[600px] bg-gradient-radial from-gold/[0.04] to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-obsidian to-transparent" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-6 w-full">
          <div className="grid lg:grid-cols-2 gap-20 items-center min-h-[calc(100vh-6rem)]">
            {/* Left: Content */}
            <div className={`transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              {/* Badge */}
              <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-slate/50 border border-slate-light/50 mb-10">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald"></span>
                </span>
                <span className="text-xs text-steel tracking-wide">Live on Solana Devnet</span>
              </div>

              {/* Main headline */}
              <h1 className="font-display mb-8">
                <span className="block text-5xl md:text-6xl lg:text-7xl font-semibold text-ivory leading-[1.05] tracking-tight">
                  A Sovereign Court
                </span>
                <span className="block text-5xl md:text-6xl lg:text-7xl font-semibold text-gold leading-[1.05] tracking-tight mt-2">
                  for the Digital Age
                </span>
              </h1>

              {/* Subheadline */}
              <p className="text-lg text-steel max-w-md mb-12 leading-relaxed">
                Trustless dispute resolution where economic consensus reveals truth.
                No intermediaries. No bias. Just stakes and outcomes.
              </p>

              {/* CTA buttons */}
              <div className="flex flex-wrap gap-4 mb-16">
                <Link
                  href="/registry"
                  className="group inline-flex items-center gap-3 bg-gold hover:bg-gold-light text-obsidian font-medium px-7 py-3.5 rounded-full transition-all duration-300"
                >
                  Enter Tribunal
                  <ArrowIcon />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 text-parchment hover:text-gold px-7 py-3.5 transition-colors"
                >
                  Learn More
                </a>
              </div>

              {/* Stats row */}
              <div className="flex gap-12 pt-8 border-t border-slate-light/30">
                {[
                  { value: "80%", label: "To Winners" },
                  { value: "~400ms", label: "Finality" },
                  { value: "$0", label: "Legal Fees" },
                ].map((stat, i) => (
                  <div key={i}>
                    <div className="font-display text-3xl text-ivory font-medium">{stat.value}</div>
                    <div className="text-xs text-steel mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Scales */}
            <div className={`hidden lg:block h-[450px] transition-all duration-1000 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              <AnimatedScales />
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          QUOTE SECTION
          ============================================ */}
      <section className="relative py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="font-display text-2xl md:text-3xl text-parchment/90 leading-relaxed italic">
            &ldquo;In matters of dispute, let not authority decide, but the collective wisdom
            of those with <span className="text-gold not-italic">stake</span> in the outcome.&rdquo;
          </div>
        </div>
      </section>

      {/* ============================================
          HOW IT WORKS
          ============================================ */}
      <section id="how-it-works" className="py-28 relative">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="font-display text-4xl md:text-5xl text-ivory font-medium">
              How It Works
            </h2>
            <p className="mt-4 text-steel max-w-lg mx-auto">
              A simple five-step process from creation to resolution
            </p>
          </div>

          {/* Timeline - flowing design */}
          <div className="relative max-w-3xl mx-auto">
            {/* Connecting line */}
            <div className="absolute left-6 top-8 bottom-8 w-px bg-gradient-to-b from-gold via-gold/50 to-gold/20" />

            {[
              { num: "01", title: "Subject Created", desc: "Creator submits a claim with initial bond. Details stored on IPFS." },
              { num: "02", title: "Challenge Filed", desc: "Challenger stakes SOL to dispute. Stakes determine the prize pool." },
              { num: "03", title: "Voting Opens", desc: "Jurors allocate stake to vote. Power proportional to commitment." },
              { num: "04", title: "Resolution", desc: "Majority wins. Funds distributed: 80% winners, 19% jurors, 1% protocol." },
              { num: "05", title: "Rewards Claimed", desc: "Winners claim after 7-day lock. Reputation updates. Subject finalized." },
            ].map((step, i) => (
              <div key={i} className="relative pl-16 pb-12 last:pb-0">
                {/* Number dot */}
                <div className="absolute left-0 w-12 h-12 rounded-full bg-slate border border-gold/30 flex items-center justify-center">
                  <span className="font-display text-gold text-sm">{step.num}</span>
                </div>

                {/* Content */}
                <div className="pt-2">
                  <h3 className="font-display text-xl text-ivory mb-2">{step.title}</h3>
                  <p className="text-steel text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          ECONOMICS SECTION
          ============================================ */}
      <section className="py-28 relative bg-gradient-to-b from-slate/20 to-transparent">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            {/* Left: Visualization */}
            <div className="order-2 lg:order-1">
              <EconomicsVisualization />
            </div>

            {/* Right: Content */}
            <div className="order-1 lg:order-2">
              <h2 className="font-display text-4xl text-ivory font-medium mb-6">
                Transparent Economics
              </h2>
              <p className="text-steel text-lg mb-10 leading-relaxed">
                Every SOL staked is distributed according to immutable on-chain rules.
                No hidden fees. No platform extraction.
              </p>

              <div className="space-y-6">
                {[
                  { pct: "80%", title: "Winner Pool", desc: "Distributed to winning parties proportionally", color: "text-gold" },
                  { pct: "19%", title: "Juror Rewards", desc: "Split among correct voters by voting power", color: "text-emerald-light" },
                  { pct: "1%", title: "Protocol", desc: "Minimal fee for infrastructure sustainability", color: "text-steel-light" },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <span className={`font-display text-2xl ${item.color} w-16`}>{item.pct}</span>
                    <div>
                      <div className="text-ivory font-medium">{item.title}</div>
                      <div className="text-steel text-sm">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          TRUST & SECURITY SECTION
          ============================================ */}
      <section id="trust" className="py-28 relative">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="font-display text-4xl md:text-5xl text-ivory font-medium">
              Trust & Security
            </h2>
            <p className="mt-4 text-steel max-w-xl mx-auto">
              Multiple layers of protection ensure fair outcomes and prevent manipulation
            </p>
          </div>

          {/* Two column grid with flowing cards */}
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Card 1: Unbiased Decisions */}
            <div className="p-8 rounded-2xl bg-gradient-to-br from-slate/50 to-slate/20 border border-slate-light/30">
              <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center mb-6">
                <ScaleIcon className="w-6 h-6 text-gold" />
              </div>
              <h3 className="font-display text-xl text-ivory mb-3">Unbiased Decisions</h3>
              <p className="text-steel text-sm leading-relaxed">
                Jurors have no stake in either side&apos;s outcome. Their only incentive is to vote correctly
                based on evidence, ensuring neutral, fair judgments without predetermined leanings.
              </p>
            </div>

            {/* Card 2: Skin in the Game */}
            <div className="p-8 rounded-2xl bg-gradient-to-br from-slate/50 to-slate/20 border border-slate-light/30">
              <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center mb-6">
                <LockIcon className="w-6 h-6 text-gold" />
              </div>
              <h3 className="font-display text-xl text-ivory mb-3">Skin in the Game</h3>
              <p className="text-steel text-sm leading-relaxed">
                Every participant stakes real value. Jurors lock stake for 7 days post-vote,
                ensuring they can&apos;t vote and run. Commitment persists through resolution.
              </p>
            </div>

            {/* Card 3: Asymmetric Penalties */}
            <div className="p-8 rounded-2xl bg-gradient-to-br from-slate/50 to-slate/20 border border-slate-light/30">
              <div className="w-12 h-12 rounded-full bg-crimson/10 flex items-center justify-center mb-6">
                <CheckCircleIcon className="w-6 h-6 text-crimson-light" />
              </div>
              <h3 className="font-display text-xl text-ivory mb-3">Wrong Votes Cost More</h3>
              <p className="text-steel text-sm leading-relaxed">
                Incorrect votes lose <span className="text-crimson-light">2% reputation</span> while
                correct votes gain only <span className="text-gold">1%</span>. This 2:1 asymmetry
                discourages gambling and rewards careful judgment.
              </p>
            </div>

            {/* Card 4: Anti-Manipulation */}
            <div className="p-8 rounded-2xl bg-gradient-to-br from-slate/50 to-slate/20 border border-slate-light/30">
              <div className="w-12 h-12 rounded-full bg-emerald/10 flex items-center justify-center mb-6">
                <UsersIcon className="w-6 h-6 text-emerald-light" />
              </div>
              <h3 className="font-display text-xl text-ivory mb-3">Collusion Resistant</h3>
              <p className="text-steel text-sm leading-relaxed">
                Voting power scales with square root of stake, preventing whale takeover.
                Splitting accounts reduces total power, making Sybil attacks economically irrational.
              </p>
            </div>
          </div>

          {/* Additional security points */}
          <div className="mt-16 max-w-3xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {[
                { value: "7 Days", label: "Stake Lock" },
                { value: "50%", label: "Slash Threshold" },
                { value: "√x", label: "Quadratic Power" },
                { value: "100%", label: "On-Chain" },
              ].map((item, i) => (
                <div key={i} className="p-4">
                  <div className="font-display text-2xl text-gold mb-1">{item.value}</div>
                  <div className="text-xs text-steel">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          REPUTATION SECTION
          ============================================ */}
      <section className="py-28 relative bg-gradient-to-b from-slate/20 to-transparent">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-display text-4xl text-ivory font-medium mb-6">
              Reputation-Driven Trust
            </h2>
            <p className="text-steel text-lg leading-relaxed mb-12">
              Your reputation reflects your judgment history. Consistently accurate participants
              build trust over time, while bad actors face compounding consequences that make
              manipulation economically unviable.
            </p>

            {/* Reputation mechanics */}
            <div className="grid md:grid-cols-3 gap-8 text-left">
              <div className="p-6 rounded-xl bg-slate/30 border border-slate-light/20">
                <div className="text-gold font-display text-3xl mb-2">+1%</div>
                <div className="text-ivory text-sm font-medium mb-1">Correct Decision</div>
                <div className="text-steel text-xs">Vote with the winning majority</div>
              </div>
              <div className="p-6 rounded-xl bg-slate/30 border border-slate-light/20">
                <div className="text-crimson-light font-display text-3xl mb-2">-2%</div>
                <div className="text-ivory text-sm font-medium mb-1">Wrong Decision</div>
                <div className="text-steel text-xs">Vote against the majority outcome</div>
              </div>
              <div className="p-6 rounded-xl bg-slate/30 border border-slate-light/20">
                <div className="text-steel-light font-display text-3xl mb-2">&lt;50%</div>
                <div className="text-ivory text-sm font-medium mb-1">Stake Slashed</div>
                <div className="text-steel text-xs">Withdrawing below threshold costs</div>
              </div>
            </div>

            <p className="text-steel text-sm mt-10 max-w-xl mx-auto">
              This creates a self-correcting system where honest participation is the only
              sustainable strategy. Bad actors either improve or exit.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================
          THREE ROLES SECTION
          ============================================ */}
      <section id="roles" className="py-28 relative">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="font-display text-4xl md:text-5xl text-ivory font-medium">
              Three Roles
            </h2>
            <p className="mt-4 text-steel max-w-md mx-auto">
              Each participant plays a crucial part in the tribunal
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Defender */}
            <div className="group relative p-10 rounded-3xl bg-gradient-to-b from-sky-500/5 to-transparent border border-sky-500/20 hover:border-sky-500/40 transition-all duration-500">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/10 flex items-center justify-center mb-8 text-sky-400 group-hover:scale-105 transition-transform">
                <ShieldIcon className="w-8 h-8" />
              </div>

              <h3 className="font-display text-2xl text-ivory mb-2">Defender</h3>
              <p className="text-sky-400/80 text-sm mb-6">Protect Truth</p>

              <p className="text-steel text-sm mb-8 leading-relaxed">
                Bond SOL behind subjects you believe are valid. Your stake signals confidence
                and becomes reward if challengers fail.
              </p>

              <ul className="space-y-2.5 text-sm text-parchment/80">
                <li className="flex items-center gap-2"><span className="text-sky-500">•</span>Create & bond subjects</li>
                <li className="flex items-center gap-2"><span className="text-sky-500">•</span>Auto-defend via pool</li>
                <li className="flex items-center gap-2"><span className="text-sky-500">•</span>Win challenger stakes</li>
              </ul>
            </div>

            {/* Challenger */}
            <div className="group relative p-10 rounded-3xl bg-gradient-to-b from-crimson/5 to-transparent border border-crimson/20 hover:border-crimson/40 transition-all duration-500">
              <div className="w-16 h-16 rounded-2xl bg-crimson/10 flex items-center justify-center mb-8 text-crimson-light group-hover:scale-105 transition-transform">
                <SwordIcon className="w-8 h-8" />
              </div>

              <h3 className="font-display text-2xl text-ivory mb-2">Challenger</h3>
              <p className="text-crimson-light/80 text-sm mb-6">Expose Falsehood</p>

              <p className="text-steel text-sm mb-8 leading-relaxed">
                Dispute subjects you believe are false. If proven right, claim the defender&apos;s
                bond as your reward.
              </p>

              <ul className="space-y-2.5 text-sm text-parchment/80">
                <li className="flex items-center gap-2"><span className="text-crimson-light">•</span>File disputes instantly</li>
                <li className="flex items-center gap-2"><span className="text-crimson-light">•</span>Submit evidence on-chain</li>
                <li className="flex items-center gap-2"><span className="text-crimson-light">•</span>Win defender bonds</li>
              </ul>
            </div>

            {/* Juror */}
            <div className="group relative p-10 rounded-3xl bg-gradient-to-b from-gold/5 to-transparent border border-gold/20 hover:border-gold/40 transition-all duration-500">
              <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center mb-8 text-gold group-hover:scale-105 transition-transform">
                <GavelIcon className="w-8 h-8" />
              </div>

              <h3 className="font-display text-2xl text-ivory mb-2">Juror</h3>
              <p className="text-gold/80 text-sm mb-6">Decide Outcomes</p>

              <p className="text-steel text-sm mb-8 leading-relaxed">
                Stake to join the tribunal. Vote on disputes to earn 19% of every resolution.
                Build reputation through accuracy.
              </p>

              <ul className="space-y-2.5 text-sm text-parchment/80">
                <li className="flex items-center gap-2"><span className="text-gold">•</span>Register with stake</li>
                <li className="flex items-center gap-2"><span className="text-gold">•</span>Vote on disputes</li>
                <li className="flex items-center gap-2"><span className="text-gold">•</span>Earn 19% of pool</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          USE CASES
          ============================================ */}
      <section id="use-cases" className="py-28 relative bg-gradient-to-b from-slate/20 to-transparent">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="font-display text-4xl md:text-5xl text-ivory font-medium">
              Use Cases
            </h2>
            <p className="mt-4 text-steel max-w-md mx-auto">
              Any scenario where trust and accountability matter
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: "Freelance Escrow", desc: "Milestone-based payments with built-in dispute resolution.", tag: "Gig Economy" },
              { title: "DAO Governance", desc: "Challenge proposal implementations and treasury allocations.", tag: "Governance" },
              { title: "NFT Authentication", desc: "Verify collection legitimacy through stake-backed claims.", tag: "Digital Art" },
              { title: "Oracle Disputes", desc: "Decentralized resolution for prediction markets.", tag: "DeFi" },
              { title: "Content Verification", desc: "Community-driven fact-checking with economic stakes.", tag: "Media" },
              { title: "Service Agreements", desc: "Automatic SLA enforcement without legal overhead.", tag: "Enterprise" },
            ].map((uc, i) => (
              <div key={i} className="p-6 rounded-2xl bg-slate/30 border border-slate-light/20 hover:border-gold/20 transition-colors">
                <span className="inline-block px-3 py-1 text-xs text-gold/80 bg-gold/10 rounded-full mb-4">
                  {uc.tag}
                </span>
                <h3 className="font-display text-lg text-ivory mb-2">{uc.title}</h3>
                <p className="text-steel text-sm">{uc.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          DIFFERENTIATORS
          ============================================ */}
      <section className="py-28 relative">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-display text-4xl text-ivory font-medium mb-16">
            Why TribunalCraft
          </h2>

          <div className="grid md:grid-cols-3 gap-12">
            <div>
              <div className="font-display text-5xl text-gold mb-3">~400ms</div>
              <h3 className="text-ivory font-medium mb-2">Solana Speed</h3>
              <p className="text-steel text-sm">Sub-second finality. Faster than any L1 competitor.</p>
            </div>
            <div>
              <div className="font-display text-5xl text-gold mb-3">0</div>
              <h3 className="text-ivory font-medium mb-2">Native Tokens</h3>
              <p className="text-steel text-sm">Stake and earn in SOL directly. No token inflation.</p>
            </div>
            <div>
              <div className="font-display text-5xl text-gold mb-3">∞</div>
              <h3 className="text-ivory font-medium mb-2">Restoration</h3>
              <p className="text-steel text-sm">Invalid subjects can be rehabilitated through vote.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          CTA SECTION
          ============================================ */}
      <section className="py-28 relative">
        <div className="absolute inset-0 bg-gradient-radial from-gold/5 via-transparent to-transparent" />

        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate/50 border border-slate-light/50 mb-8">
            <span className="text-xs text-steel">Devnet Live • Mainnet Q1 2025</span>
          </div>

          <h2 className="font-display text-5xl md:text-6xl text-ivory font-medium mb-6">
            The Tribunal Awaits
          </h2>

          <p className="text-lg text-steel mb-12 max-w-xl mx-auto">
            Join the decentralized arbitration protocol. Create subjects, challenge claims,
            or serve as a juror.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/registry"
              className="group inline-flex items-center justify-center gap-3 bg-gold hover:bg-gold-light text-obsidian font-medium px-8 py-4 rounded-full transition-all duration-300"
            >
              Launch App
              <ArrowIcon />
            </Link>
            <a
              href="https://github.com/tribunalcraft"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center text-parchment hover:text-gold px-8 py-4 transition-colors"
            >
              View Source
            </a>
          </div>
        </div>
      </section>

      {/* ============================================
          FOOTER
          ============================================ */}
      <footer className="border-t border-slate-light/20 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full border border-gold/50 flex items-center justify-center">
                  <span className="font-display text-gold text-sm">T</span>
                </div>
                <span className="font-display text-lg text-ivory">TribunalCraft</span>
              </div>
              <p className="text-sm text-steel">
                Decentralized dispute resolution on Solana.
              </p>
            </div>

            <div>
              <h4 className="text-ivory text-sm font-medium mb-4">Protocol</h4>
              <ul className="space-y-2 text-sm text-steel">
                <li><Link href="/registry" className="hover:text-parchment transition-colors">Registry</Link></li>
                <li><Link href="/overview" className="hover:text-parchment transition-colors">Dashboard</Link></li>
                <li><Link href="/analytics" className="hover:text-parchment transition-colors">Analytics</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-ivory text-sm font-medium mb-4">Developers</h4>
              <ul className="space-y-2 text-sm text-steel">
                <li><a href="https://github.com/tribunalcraft" target="_blank" rel="noopener noreferrer" className="hover:text-parchment transition-colors">GitHub</a></li>
                <li><a href="#" className="hover:text-parchment transition-colors">SDK Docs</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-ivory text-sm font-medium mb-4">Community</h4>
              <ul className="space-y-2 text-sm text-steel">
                <li><a href="#" className="hover:text-parchment transition-colors">Discord</a></li>
                <li><a href="#" className="hover:text-parchment transition-colors">Twitter</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-light/20 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-steel">
              &copy; 2025 TribunalCraft
            </p>
            <p className="text-xs text-gold/70 font-display italic">
              Truth through consensus. Justice through code.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
