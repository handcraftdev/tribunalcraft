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
      setTilt(prev => prev === 0 ? -8 : prev === -8 ? 8 : 0);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gold/10 blur-3xl rounded-full scale-75" />

      <svg
        viewBox="0 0 300 280"
        className="w-full h-full relative z-10"
        style={{
          filter: "drop-shadow(0 0 60px rgba(201, 162, 39, 0.3))",
        }}
      >
        {/* Ornate top finial */}
        <circle cx="150" cy="20" r="8" fill="none" stroke="var(--gold)" strokeWidth="2" />
        <circle cx="150" cy="20" r="4" fill="var(--gold)" />

        {/* Center pillar */}
        <line x1="150" y1="28" x2="150" y2="220" stroke="var(--gold)" strokeWidth="3" />

        {/* Main beam with rotation */}
        <g style={{
          transform: `rotate(${tilt}deg)`,
          transformOrigin: "150px 55px",
          transition: "transform 1.5s cubic-bezier(0.4, 0, 0.2, 1)"
        }}>
          {/* Beam */}
          <line x1="30" y1="55" x2="270" y2="55" stroke="var(--gold)" strokeWidth="3" />

          {/* Left chain */}
          <line x1="50" y1="55" x2="50" y2="100" stroke="var(--gold)" strokeWidth="2" strokeDasharray="4,4" />

          {/* Right chain */}
          <line x1="250" y1="55" x2="250" y2="100" stroke="var(--gold)" strokeWidth="2" strokeDasharray="4,4" />

          {/* Left bowl */}
          <ellipse cx="50" cy="115" rx="40" ry="15" fill="none" stroke="var(--gold)" strokeWidth="2.5" />
          <path d="M10 115 Q50 145 90 115" fill="none" stroke="var(--gold)" strokeWidth="2" />

          {/* Right bowl */}
          <ellipse cx="250" cy="115" rx="40" ry="15" fill="none" stroke="var(--gold)" strokeWidth="2.5" />
          <path d="M210 115 Q250 145 290 115" fill="none" stroke="var(--gold)" strokeWidth="2" />

          {/* Bowl labels */}
          <text x="50" y="120" textAnchor="middle" fill="var(--gold)" fontSize="10" fontFamily="var(--font-display)">TRUTH</text>
          <text x="250" y="120" textAnchor="middle" fill="var(--gold)" fontSize="10" fontFamily="var(--font-display)">STAKE</text>
        </g>

        {/* Base */}
        <path d="M100 220 L150 200 L200 220 Z" fill="none" stroke="var(--gold)" strokeWidth="2" />
        <rect x="80" y="225" width="140" height="8" fill="none" stroke="var(--gold)" strokeWidth="2" />
        <rect x="70" y="238" width="160" height="4" fill="var(--gold)" opacity="0.5" />

        {/* Decorative corners */}
        <path d="M120 248 L130 248 L130 252" fill="none" stroke="var(--gold)" strokeWidth="1" opacity="0.5" />
        <path d="M180 248 L170 248 L170 252" fill="none" stroke="var(--gold)" strokeWidth="1" opacity="0.5" />
      </svg>
    </div>
  );
};

// Economics pie visualization
const EconomicsVisualization = () => {
  const [animated, setAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setAnimated(true);
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative">
      <svg viewBox="0 0 200 200" className="w-48 h-48 mx-auto">
        {/* Background circle */}
        <circle cx="100" cy="100" r="90" fill="none" stroke="var(--slate-light)" strokeWidth="2" />

        {/* 80% Winners arc */}
        <circle
          cx="100"
          cy="100"
          r="80"
          fill="none"
          stroke="var(--gold)"
          strokeWidth="16"
          strokeDasharray={animated ? "402 503" : "0 503"}
          strokeDashoffset="0"
          transform="rotate(-90 100 100)"
          style={{ transition: "stroke-dasharray 1.5s ease-out" }}
        />

        {/* 19% Jurors arc */}
        <circle
          cx="100"
          cy="100"
          r="80"
          fill="none"
          stroke="var(--emerald)"
          strokeWidth="16"
          strokeDasharray={animated ? "95 503" : "0 503"}
          strokeDashoffset="-402"
          transform="rotate(-90 100 100)"
          style={{ transition: "stroke-dasharray 1.5s ease-out 0.3s" }}
        />

        {/* 1% Treasury arc */}
        <circle
          cx="100"
          cy="100"
          r="80"
          fill="none"
          stroke="var(--steel)"
          strokeWidth="16"
          strokeDasharray={animated ? "5 503" : "0 503"}
          strokeDashoffset="-497"
          transform="rotate(-90 100 100)"
          style={{ transition: "stroke-dasharray 1.5s ease-out 0.6s" }}
        />

        {/* Center text */}
        <text x="100" y="95" textAnchor="middle" fill="var(--ivory)" fontSize="28" fontFamily="var(--font-display)" fontWeight="600">20%</text>
        <text x="100" y="115" textAnchor="middle" fill="var(--steel)" fontSize="10" fontFamily="var(--font-body)">TOTAL FEES</text>
      </svg>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gold" />
          <span className="text-steel">80% Winners</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-emerald" />
          <span className="text-steel">19% Jurors</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-steel" />
          <span className="text-steel">1% Protocol</span>
        </div>
      </div>
    </div>
  );
};

// Sigmoid reputation curve
const ReputationCurve = () => {
  const points = [];
  for (let i = 0; i <= 100; i += 2) {
    const x = i;
    // Stacked sigmoid approximation
    const sigmoid1 = 1 / (1 + Math.exp(-0.15 * (x - 25)));
    const sigmoid2 = 1 / (1 + Math.exp(-0.15 * (x - 75)));
    const y = Math.max(0.2, sigmoid1 + sigmoid2);
    points.push({ x: 20 + (x / 100) * 260, y: 150 - (y / 2) * 120 });
  }
  const pathD = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;

  return (
    <svg viewBox="0 0 300 180" className="w-full h-40">
      {/* Grid lines */}
      {[0.5, 1.0, 1.5, 2.0].map((val, i) => (
        <g key={i}>
          <line
            x1="20"
            y1={150 - (val / 2) * 120}
            x2="280"
            y2={150 - (val / 2) * 120}
            stroke="var(--slate-light)"
            strokeWidth="1"
            strokeDasharray="4,4"
          />
          <text x="8" y={154 - (val / 2) * 120} fill="var(--steel)" fontSize="9" fontFamily="var(--font-mono)">{val}x</text>
        </g>
      ))}

      {/* X axis labels */}
      <text x="20" y="168" fill="var(--steel)" fontSize="9" fontFamily="var(--font-mono)">0%</text>
      <text x="140" y="168" fill="var(--steel)" fontSize="9" fontFamily="var(--font-mono)">50%</text>
      <text x="265" y="168" fill="var(--steel)" fontSize="9" fontFamily="var(--font-mono)">100%</text>

      {/* The curve */}
      <path d={pathD} fill="none" stroke="var(--gold)" strokeWidth="3" />

      {/* Key points */}
      <circle cx="20" cy={150 - (0.2 / 2) * 120} r="4" fill="var(--crimson)" />
      <circle cx="150" cy={150 - (1.0 / 2) * 120} r="4" fill="var(--gold)" />
      <circle cx="280" cy={150 - (2.0 / 2) * 120} r="4" fill="var(--emerald)" />
    </svg>
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

const ArrowIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
        scrolled ? "bg-obsidian/98 backdrop-blur-md border-b border-gold/20" : "bg-transparent"
      }`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 border-2 border-gold flex items-center justify-center group-hover:bg-gold/10 transition-all duration-300">
              <span className="font-display text-gold text-2xl font-bold">T</span>
            </div>
            <div className="hidden sm:block">
              <span className="font-display text-xl text-ivory tracking-wide">TribunalCraft</span>
              <span className="block text-[10px] text-steel uppercase tracking-[0.3em]">Decentralized Justice</span>
            </div>
          </Link>

          <div className="hidden lg:flex items-center gap-10">
            <a href="#economics" className="text-steel hover:text-gold transition-colors text-sm tracking-wide">Economics</a>
            <a href="#roles" className="text-steel hover:text-gold transition-colors text-sm tracking-wide">Roles</a>
            <a href="#how-it-works" className="text-steel hover:text-gold transition-colors text-sm tracking-wide">Process</a>
            <a href="#use-cases" className="text-steel hover:text-gold transition-colors text-sm tracking-wide">Use Cases</a>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/overview" className="hidden sm:block text-sm text-steel hover:text-gold transition-colors">
              Dashboard
            </Link>
            <Link
              href="/registry"
              className="group flex items-center gap-2 bg-gold hover:bg-gold-light text-obsidian font-semibold px-5 py-2.5 text-sm transition-all duration-300"
            >
              Enter Tribunal
              <ArrowIcon />
            </Link>
          </div>
        </div>
      </nav>

      {/* ============================================
          HERO SECTION
          ============================================ */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0">
          {/* Radial gradient */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-gold/[0.03] rounded-full blur-3xl" />

          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.015]" style={{
            backgroundImage: `linear-gradient(var(--gold) 1px, transparent 1px), linear-gradient(90deg, var(--gold) 1px, transparent 1px)`,
            backgroundSize: "80px 80px"
          }} />

          {/* Bottom fade */}
          <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-obsidian to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center min-h-[calc(100vh-5rem)]">
            {/* Left: Content */}
            <div className={`transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              {/* Badge */}
              <div className="inline-flex items-center gap-3 px-4 py-2 border border-gold/30 mb-10">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald"></span>
                </span>
                <span className="text-xs text-steel uppercase tracking-[0.2em]">Live on Solana</span>
              </div>

              {/* Main headline */}
              <h1 className="font-display mb-8">
                <span className="block text-6xl md:text-7xl lg:text-8xl font-bold text-ivory leading-[0.9] tracking-tight">
                  A Sovereign
                </span>
                <span className="block text-6xl md:text-7xl lg:text-8xl font-bold text-gold leading-[0.9] tracking-tight">
                  Court
                </span>
                <span className="block text-3xl md:text-4xl text-steel font-normal mt-4 tracking-wide">
                  for the Digital Age
                </span>
              </h1>

              {/* Subheadline */}
              <p className="text-lg md:text-xl text-steel max-w-lg mb-12 leading-relaxed">
                Trustless dispute resolution where <span className="text-parchment">economic consensus</span> reveals truth.
                No lawyers. No delays. Just stakes and outcomes.
              </p>

              {/* CTA buttons */}
              <div className="flex flex-wrap gap-4 mb-16">
                <Link
                  href="/registry"
                  className="group inline-flex items-center gap-3 bg-gold hover:bg-gold-light text-obsidian font-semibold px-8 py-4 text-lg transition-all duration-300"
                >
                  Launch App
                  <ArrowIcon />
                </Link>
                <a
                  href="#economics"
                  className="inline-flex items-center gap-2 border-2 border-slate-light hover:border-gold/50 text-parchment px-8 py-4 transition-all duration-300"
                >
                  See How It Works
                </a>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-8 pt-8 border-t border-slate-light">
                <div>
                  <div className="font-display text-4xl text-gold font-bold">80%</div>
                  <div className="text-xs text-steel uppercase tracking-wider mt-1">To Winners</div>
                </div>
                <div>
                  <div className="font-display text-4xl text-gold font-bold">~400ms</div>
                  <div className="text-xs text-steel uppercase tracking-wider mt-1">Finality</div>
                </div>
                <div>
                  <div className="font-display text-4xl text-gold font-bold">$0</div>
                  <div className="text-xs text-steel uppercase tracking-wider mt-1">Legal Fees</div>
                </div>
              </div>
            </div>

            {/* Right: Animated scales */}
            <div className={`hidden lg:block h-[500px] transition-all duration-1000 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <AnimatedScales />
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <div className="w-px h-12 bg-gradient-to-b from-gold/50 to-transparent animate-pulse" />
        </div>
      </section>

      {/* ============================================
          PROCLAMATION BANNER
          ============================================ */}
      <section className="relative py-20 border-y border-gold/20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gold/5 to-transparent" />

        <div className="relative max-w-5xl mx-auto px-6 text-center">
          <div className="font-display text-2xl md:text-3xl lg:text-4xl text-ivory leading-relaxed">
            <span className="text-gold">&ldquo;</span>
            In matters of dispute, let not authority decide, but the collective wisdom
            of those with <span className="text-gold">stake</span> in the outcome.
            <span className="text-gold">&rdquo;</span>
          </div>
          <div className="mt-6 text-steel text-sm uppercase tracking-[0.3em]">
            The TribunalCraft Manifesto
          </div>
        </div>
      </section>

      {/* ============================================
          ECONOMICS SECTION
          ============================================ */}
      <section id="economics" className="py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          {/* Section header */}
          <div className="text-center mb-20">
            <span className="text-gold text-xs uppercase tracking-[0.3em] mb-4 block">Protocol Economics</span>
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl text-ivory font-bold">
              Transparent <span className="text-gold">Fee Structure</span>
            </h2>
            <p className="mt-6 text-steel max-w-2xl mx-auto text-lg">
              Every SOL staked in a dispute is distributed according to immutable on-chain rules.
              No hidden fees. No platform extraction.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Visualization */}
            <div className="order-2 lg:order-1">
              <EconomicsVisualization />
            </div>

            {/* Right: Breakdown */}
            <div className="order-1 lg:order-2 space-y-8">
              <div className="p-6 border border-gold/30 bg-slate/30">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gold font-display text-xl">Winner Pool</span>
                  <span className="font-mono text-2xl text-gold">80%</span>
                </div>
                <p className="text-steel text-sm">
                  Distributed proportionally to winning parties based on their stake contribution.
                  Defenders win if the challenge fails. Challengers win if the dispute succeeds.
                </p>
              </div>

              <div className="p-6 border border-emerald/30 bg-slate/30">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-emerald-light font-display text-xl">Juror Rewards</span>
                  <span className="font-mono text-2xl text-emerald-light">19%</span>
                </div>
                <p className="text-steel text-sm">
                  Split among jurors who voted with the majority, proportional to their voting power.
                  Vote correctly, earn consistently.
                </p>
              </div>

              <div className="p-6 border border-slate-light bg-slate/30">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-steel-light font-display text-xl">Protocol Treasury</span>
                  <span className="font-mono text-2xl text-steel-light">1%</span>
                </div>
                <p className="text-steel text-sm">
                  Minimal protocol fee for infrastructure and development.
                  No rent extraction—just sustainability.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          REPUTATION SECTION
          ============================================ */}
      <section className="py-32 relative bg-slate/20">
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, var(--gold) 1px, transparent 0)`,
          backgroundSize: "32px 32px"
        }} />

        <div className="relative max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Content */}
            <div>
              <span className="text-gold text-xs uppercase tracking-[0.3em] mb-4 block">Reputation System</span>
              <h2 className="font-display text-4xl md:text-5xl text-ivory font-bold mb-6">
                Earn Your <span className="text-gold">Standing</span>
              </h2>
              <p className="text-steel text-lg mb-8">
                Your reputation determines your minimum bond and maximum earning potential.
                A novel <span className="text-parchment">stacked sigmoid curve</span> ensures
                new participants can join while rewarding consistent accuracy.
              </p>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 bg-crimson rounded-full" />
                  <span className="text-steel">0% reputation: 0.2x minimum bond (low barrier)</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 bg-gold rounded-full" />
                  <span className="text-steel">50% reputation: 1.0x standard bond</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 bg-emerald rounded-full" />
                  <span className="text-steel">100% reputation: 2.0x maximum stake capacity</span>
                </div>
              </div>

              <div className="mt-8 p-4 border-l-2 border-gold bg-slate/50">
                <p className="text-sm text-steel italic">
                  <span className="text-gold">+1%</span> reputation per correct vote/challenge<br />
                  <span className="text-crimson-light">-2%</span> reputation per incorrect vote/challenge
                </p>
              </div>
            </div>

            {/* Right: Curve visualization */}
            <div className="bg-slate/50 border border-slate-light p-8">
              <div className="text-center mb-4">
                <span className="text-sm text-steel uppercase tracking-wider">Bond Multiplier vs Reputation</span>
              </div>
              <ReputationCurve />
              <div className="text-center mt-4">
                <span className="text-xs text-steel">Higher reputation = higher earning potential</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          THREE ROLES SECTION
          ============================================ */}
      <section id="roles" className="py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <span className="text-gold text-xs uppercase tracking-[0.3em] mb-4 block">Participants</span>
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl text-ivory font-bold">
              Three Pillars of <span className="text-gold">Justice</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-0">
            {/* Defender */}
            <div className="group relative border-2 border-sky-500/30 hover:border-sky-500 transition-all duration-500 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-sky-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute top-0 left-0 right-0 h-1 bg-sky-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />

              <div className="relative p-10">
                {/* Icon */}
                <div className="w-20 h-20 border-2 border-sky-500 flex items-center justify-center mb-8 text-sky-400 group-hover:bg-sky-500/10 transition-colors">
                  <ShieldIcon className="w-10 h-10" />
                </div>

                {/* Title */}
                <h3 className="font-display text-3xl text-ivory mb-2">Defender</h3>
                <p className="text-sky-400 text-sm uppercase tracking-wider mb-6">Protect Truth</p>

                {/* Description */}
                <p className="text-steel text-sm mb-8 leading-relaxed">
                  Bond SOL behind subjects you believe are valid. Your stake signals confidence
                  and becomes the prize if challengers fail.
                </p>

                {/* Features */}
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <span className="text-sky-500 mt-0.5">◆</span>
                    <span className="text-parchment">Create & bond subjects</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-sky-500 mt-0.5">◆</span>
                    <span className="text-parchment">Auto-defend via pool</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-sky-500 mt-0.5">◆</span>
                    <span className="text-parchment">Set max bond exposure</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-sky-500 mt-0.5">◆</span>
                    <span className="text-parchment">Win challenger stakes</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Challenger */}
            <div className="group relative border-2 border-crimson/30 hover:border-crimson transition-all duration-500 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-crimson/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute top-0 left-0 right-0 h-1 bg-crimson transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />

              <div className="relative p-10">
                <div className="w-20 h-20 border-2 border-crimson flex items-center justify-center mb-8 text-crimson-light group-hover:bg-crimson/10 transition-colors">
                  <SwordIcon className="w-10 h-10" />
                </div>

                <h3 className="font-display text-3xl text-ivory mb-2">Challenger</h3>
                <p className="text-crimson-light text-sm uppercase tracking-wider mb-6">Expose Falsehood</p>

                <p className="text-steel text-sm mb-8 leading-relaxed">
                  Dispute subjects you believe are false. Stake your conviction—if proven right,
                  claim the defender&apos;s bond as your reward.
                </p>

                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <span className="text-crimson-light mt-0.5">◆</span>
                    <span className="text-parchment">File disputes instantly</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-crimson-light mt-0.5">◆</span>
                    <span className="text-parchment">Coalition with others</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-crimson-light mt-0.5">◆</span>
                    <span className="text-parchment">Submit evidence on-chain</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-crimson-light mt-0.5">◆</span>
                    <span className="text-parchment">Win defender bonds</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Juror */}
            <div className="group relative border-2 border-gold/30 hover:border-gold transition-all duration-500 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-gold/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute top-0 left-0 right-0 h-1 bg-gold transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />

              <div className="relative p-10">
                <div className="w-20 h-20 border-2 border-gold flex items-center justify-center mb-8 text-gold group-hover:bg-gold/10 transition-colors">
                  <GavelIcon className="w-10 h-10" />
                </div>

                <h3 className="font-display text-3xl text-ivory mb-2">Juror</h3>
                <p className="text-gold text-sm uppercase tracking-wider mb-6">Decide Outcomes</p>

                <p className="text-steel text-sm mb-8 leading-relaxed">
                  Stake to join the tribunal. Vote on disputes to earn 19% of every
                  resolution. Your stake is your voting power.
                </p>

                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <span className="text-gold mt-0.5">◆</span>
                    <span className="text-parchment">Register with stake</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-gold mt-0.5">◆</span>
                    <span className="text-parchment">Vote on active disputes</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-gold mt-0.5">◆</span>
                    <span className="text-parchment">Earn 19% of pool</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-gold mt-0.5">◆</span>
                    <span className="text-parchment">Build reputation</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          HOW IT WORKS - TIMELINE
          ============================================ */}
      <section id="how-it-works" className="py-32 relative bg-slate/20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <span className="text-gold text-xs uppercase tracking-[0.3em] mb-4 block">The Process</span>
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl text-ivory font-bold">
              Five Steps to <span className="text-gold">Resolution</span>
            </h2>
          </div>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-px bg-gold/30" />

            {[
              {
                num: "01",
                title: "Subject Created",
                desc: "Creator submits a claim with initial bond. Details stored on IPFS, hash committed on-chain.",
                highlight: "Status: Valid"
              },
              {
                num: "02",
                title: "Challenge Filed",
                desc: "Challenger stakes SOL to dispute. Bond at risk calculated based on match mode settings.",
                highlight: "Status: Disputed"
              },
              {
                num: "03",
                title: "Voting Period",
                desc: "Jurors allocate stake to vote. Voting power proportional to stake. Typical period: 24-72 hours.",
                highlight: "Votes Tallied"
              },
              {
                num: "04",
                title: "Resolution",
                desc: "Majority wins. Funds distributed: 80% to winners, 19% to jurors, 1% to protocol.",
                highlight: "Outcome Final"
              },
              {
                num: "05",
                title: "Claims & Unlock",
                desc: "Winners claim rewards after 7-day lock. Stakes unlock. Reputation updates. Subject status finalized.",
                highlight: "Rewards Distributed"
              }
            ].map((step, i) => (
              <div key={i} className={`relative flex items-start gap-8 mb-16 last:mb-0 ${
                i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
              }`}>
                {/* Number bubble */}
                <div className="absolute left-8 md:left-1/2 -translate-x-1/2 w-16 h-16 bg-obsidian border-2 border-gold flex items-center justify-center z-10">
                  <span className="font-display text-2xl text-gold">{step.num}</span>
                </div>

                {/* Content */}
                <div className={`ml-24 md:ml-0 md:w-1/2 ${i % 2 === 0 ? 'md:pr-24' : 'md:pl-24'}`}>
                  <div className={`p-6 border border-slate-light hover:border-gold/30 transition-colors bg-obsidian ${
                    i % 2 === 0 ? 'md:text-right' : ''
                  }`}>
                    <span className="inline-block px-3 py-1 text-xs text-gold border border-gold/30 mb-4">
                      {step.highlight}
                    </span>
                    <h3 className="font-display text-2xl text-ivory mb-2">{step.title}</h3>
                    <p className="text-steel text-sm">{step.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          USE CASES
          ============================================ */}
      <section id="use-cases" className="py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <span className="text-gold text-xs uppercase tracking-[0.3em] mb-4 block">Applications</span>
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl text-ivory font-bold">
              Where Stakes <span className="text-gold">Matter</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "Freelance Escrow",
                desc: "Milestone-based payments with built-in dispute resolution. No more payment disputes—just stake and deliver.",
                tag: "GIG ECONOMY",
                stat: "90% cost reduction vs traditional arbitration"
              },
              {
                title: "DAO Governance",
                desc: "Challenge proposal implementations. Ensure treasury allocations match approved specs.",
                tag: "GOVERNANCE",
                stat: "Transparent, on-chain accountability"
              },
              {
                title: "NFT Authentication",
                desc: "Verify collection legitimacy. Challenge suspected rugs. Protect buyers through stake-backed verification.",
                tag: "NFT / DIGITAL ART",
                stat: "Community-verified authenticity"
              },
              {
                title: "Oracle Disputes",
                desc: "Decentralized resolution for prediction markets and real-world event outcomes.",
                tag: "DEFI / ORACLES",
                stat: "No single point of failure"
              },
              {
                title: "Content Moderation",
                desc: "Decentralized fact-checking. Stake behind claims. Let community consensus determine truth.",
                tag: "MEDIA / CONTENT",
                stat: "Incentive-aligned verification"
              },
              {
                title: "Service Level Agreements",
                desc: "Automatic SLA enforcement. Bond uptime guarantees. Disputes resolved without lawyers.",
                tag: "ENTERPRISE / B2B",
                stat: "Programmable accountability"
              }
            ].map((uc, i) => (
              <div key={i} className="group p-8 border border-slate-light hover:border-gold/30 transition-all duration-300 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gold/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />

                <span className="inline-block px-3 py-1 text-[10px] text-gold border border-gold/30 mb-4 tracking-wider">
                  {uc.tag}
                </span>
                <h3 className="font-display text-xl text-ivory mb-3">{uc.title}</h3>
                <p className="text-steel text-sm mb-4">{uc.desc}</p>
                <p className="text-xs text-gold/70">{uc.stat}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          DIFFERENTIATORS
          ============================================ */}
      <section className="py-32 relative bg-slate/20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <span className="text-gold text-xs uppercase tracking-[0.3em] mb-4 block">Why TribunalCraft</span>
            <h2 className="font-display text-4xl md:text-5xl text-ivory font-bold">
              Built <span className="text-gold">Different</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-8">
              <div className="font-display text-6xl text-gold mb-4">~400ms</div>
              <h3 className="font-display text-xl text-ivory mb-2">Solana Speed</h3>
              <p className="text-steel text-sm">
                Built on Solana for sub-second finality. No waiting for block confirmations.
                Faster than any L1 competitor.
              </p>
            </div>

            <div className="text-center p-8">
              <div className="font-display text-6xl text-gold mb-4">0</div>
              <h3 className="font-display text-xl text-ivory mb-2">Native Tokens</h3>
              <p className="text-steel text-sm">
                No protocol token required. Stake and earn in SOL directly.
                No token inflation diluting rewards.
              </p>
            </div>

            <div className="text-center p-8">
              <div className="font-display text-6xl text-gold mb-4">∞</div>
              <h3 className="font-display text-xl text-ivory mb-2">Restoration</h3>
              <p className="text-steel text-sm">
                Unique restoration mechanism allows invalid subjects to be rehabilitated.
                Second chances, economically enforced.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          CTA SECTION
          ============================================ */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gold/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 border border-gold/30 mb-8">
            <span className="text-xs text-gold uppercase tracking-[0.2em]">Devnet Live • Mainnet Q1 2025</span>
          </div>

          <h2 className="font-display text-5xl md:text-6xl lg:text-7xl text-ivory font-bold mb-8">
            The Tribunal<br /><span className="text-gold">Awaits</span>
          </h2>

          <p className="text-xl text-steel mb-12 max-w-2xl mx-auto">
            Join the decentralized arbitration protocol. Create subjects, challenge claims,
            or serve as a juror. Truth has never been more profitable.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/registry"
              className="group inline-flex items-center justify-center gap-3 bg-gold hover:bg-gold-light text-obsidian font-semibold px-10 py-5 text-lg transition-all duration-300"
            >
              Launch App
              <ArrowIcon />
            </Link>
            <a
              href="https://github.com/tribunalcraft"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 border-2 border-slate-light hover:border-gold/50 text-parchment px-10 py-5 text-lg transition-all duration-300"
            >
              View Source
            </a>
          </div>
        </div>
      </section>

      {/* ============================================
          FOOTER
          ============================================ */}
      <footer className="border-t border-slate-light py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 border-2 border-gold flex items-center justify-center">
                  <span className="font-display text-gold text-xl font-bold">T</span>
                </div>
                <span className="font-display text-xl text-ivory">TribunalCraft</span>
              </div>
              <p className="text-sm text-steel mb-4">
                A sovereign court for the digital age. Decentralized dispute resolution on Solana.
              </p>
              <p className="text-xs text-steel/50 font-mono">
                Program: FuC2yT14gbZk3ieXoR634QjfKGtJk5ckx59qDpnD4q5q
              </p>
            </div>

            <div>
              <h4 className="font-display text-ivory mb-4">Protocol</h4>
              <ul className="space-y-2 text-sm text-steel">
                <li><Link href="/registry" className="hover:text-gold transition-colors">Registry</Link></li>
                <li><Link href="/overview" className="hover:text-gold transition-colors">Dashboard</Link></li>
                <li><Link href="/analytics" className="hover:text-gold transition-colors">Analytics</Link></li>
                <li><Link href="/profile" className="hover:text-gold transition-colors">Profile</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-display text-ivory mb-4">Developers</h4>
              <ul className="space-y-2 text-sm text-steel">
                <li><a href="https://github.com/tribunalcraft" target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors">GitHub</a></li>
                <li><a href="#" className="hover:text-gold transition-colors">SDK Docs</a></li>
                <li><a href="#" className="hover:text-gold transition-colors">Integration Guide</a></li>
                <li><a href="#" className="hover:text-gold transition-colors">API Reference</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-display text-ivory mb-4">Community</h4>
              <ul className="space-y-2 text-sm text-steel">
                <li><a href="#" className="hover:text-gold transition-colors">Discord</a></li>
                <li><a href="#" className="hover:text-gold transition-colors">Twitter</a></li>
                <li><a href="#" className="hover:text-gold transition-colors">Blog</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-light flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-steel">
              &copy; 2025 TribunalCraft. Open source protocol on Solana.
            </p>
            <p className="text-xs text-gold font-display italic">
              &ldquo;Truth through consensus. Justice through code.&rdquo;
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
