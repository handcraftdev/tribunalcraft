"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// Animated scale icon for hero
const AnimatedScale = () => (
  <svg
    viewBox="0 0 200 200"
    className="w-full h-full"
    style={{ filter: "drop-shadow(0 0 40px rgba(201, 162, 39, 0.3))" }}
  >
    {/* Center pillar */}
    <line x1="100" y1="30" x2="100" y2="170" stroke="var(--gold)" strokeWidth="3" className="animate-fade-in" />

    {/* Top beam */}
    <line x1="30" y1="50" x2="170" y2="50" stroke="var(--gold)" strokeWidth="2.5" className="animate-fade-in" style={{ animationDelay: "0.2s" }} />

    {/* Left chain */}
    <line x1="40" y1="50" x2="40" y2="90" stroke="var(--gold)" strokeWidth="1.5" className="animate-fade-in" style={{ animationDelay: "0.4s" }} />

    {/* Right chain */}
    <line x1="160" y1="50" x2="160" y2="90" stroke="var(--gold)" strokeWidth="1.5" className="animate-fade-in" style={{ animationDelay: "0.4s" }} />

    {/* Left bowl - animated */}
    <ellipse cx="40" cy="100" rx="30" ry="10" fill="none" stroke="var(--gold)" strokeWidth="2" className="animate-scale-left" />

    {/* Right bowl - animated */}
    <ellipse cx="160" cy="100" rx="30" ry="10" fill="none" stroke="var(--gold)" strokeWidth="2" className="animate-scale-right" />

    {/* Base */}
    <path d="M70 170 L100 155 L130 170 Z" fill="none" stroke="var(--gold)" strokeWidth="2" className="animate-fade-in" style={{ animationDelay: "0.6s" }} />
    <line x1="60" y1="175" x2="140" y2="175" stroke="var(--gold)" strokeWidth="3" className="animate-fade-in" style={{ animationDelay: "0.7s" }} />
  </svg>
);

// Feature icons
const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const UsersIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const CoinsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
    <circle cx="8" cy="8" r="6" />
    <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
    <path d="M7 6h1v4" />
  </svg>
);

const ZapIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const GlobeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const ChevronRight = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const ArrowRight = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-obsidian overflow-x-hidden">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-obsidian/95 backdrop-blur-md border-b border-slate-light" : "bg-transparent"
      }`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 border-2 border-gold rounded-sm flex items-center justify-center group-hover:bg-gold/10 transition-colors">
              <span className="font-display text-gold text-xl font-bold">T</span>
            </div>
            <span className="font-display text-xl text-ivory tracking-wide">TribunalCraft</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-steel hover:text-parchment transition-colors text-sm">Features</a>
            <a href="#how-it-works" className="text-steel hover:text-parchment transition-colors text-sm">How It Works</a>
            <a href="#use-cases" className="text-steel hover:text-parchment transition-colors text-sm">Use Cases</a>
            <a href="#roles" className="text-steel hover:text-parchment transition-colors text-sm">Roles</a>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/overview" className="text-sm text-parchment hover:text-gold transition-colors">
              Dashboard
            </Link>
            <Link
              href="/registry"
              className="btn btn-primary text-sm px-5 py-2"
            >
              Launch App
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-obsidian via-obsidian to-slate/30" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gold/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />

        {/* Decorative grid */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `linear-gradient(var(--gold) 1px, transparent 1px), linear-gradient(90deg, var(--gold) 1px, transparent 1px)`,
          backgroundSize: "60px 60px"
        }} />

        <div className="relative z-10 max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Text content */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 border border-gold/30 rounded-full mb-8 animate-fade-in">
              <span className="w-2 h-2 bg-emerald rounded-full animate-pulse" />
              <span className="text-xs text-steel uppercase tracking-widest">Live on Solana Devnet</span>
            </div>

            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-semibold text-ivory leading-[1.1] mb-6 animate-slide-up">
              <span className="block">Decentralized</span>
              <span className="block text-gold">Justice</span>
              <span className="block text-4xl md:text-5xl lg:text-6xl text-parchment/80">On-Chain</span>
            </h1>

            <p className="text-lg md:text-xl text-steel max-w-xl mx-auto lg:mx-0 mb-10 animate-slide-up" style={{ animationDelay: "0.1s" }}>
              A trustless dispute resolution protocol where truth emerges through
              <span className="text-parchment"> economic consensus</span>.
              Stake your conviction. Let the tribunal decide.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-slide-up" style={{ animationDelay: "0.2s" }}>
              <Link
                href="/registry"
                className="group inline-flex items-center justify-center gap-3 bg-gold hover:bg-gold-light text-obsidian font-semibold px-8 py-4 transition-all"
              >
                Enter the Tribunal
                <ArrowRight />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 border border-slate-light hover:border-gold/50 text-parchment px-8 py-4 transition-all"
              >
                Learn More
                <ChevronRight />
              </a>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 mt-16 pt-8 border-t border-slate-light animate-slide-up" style={{ animationDelay: "0.3s" }}>
              <div>
                <div className="font-display text-3xl text-gold mb-1">100%</div>
                <div className="text-xs text-steel uppercase tracking-wider">On-Chain</div>
              </div>
              <div>
                <div className="font-display text-3xl text-gold mb-1">7 Days</div>
                <div className="text-xs text-steel uppercase tracking-wider">Stake Lock</div>
              </div>
              <div>
                <div className="font-display text-3xl text-gold mb-1">3 Roles</div>
                <div className="text-xs text-steel uppercase tracking-wider">Ecosystem</div>
              </div>
            </div>
          </div>

          {/* Right: Animated Scale */}
          <div className="hidden lg:flex items-center justify-center animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <div className="w-80 h-80 relative">
              <AnimatedScale />
              {/* Orbital decorations */}
              <div className="absolute -top-4 -right-4 w-8 h-8 border border-gold/30 rotate-45" />
              <div className="absolute -bottom-4 -left-4 w-12 h-12 border border-gold/20 rounded-full" />
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
          <span className="text-xs text-steel uppercase tracking-widest">Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-gold to-transparent" />
        </div>
      </section>

      {/* Value Proposition */}
      <section className="py-32 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-slate/30 to-obsidian" />
        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center mb-20">
            <h2 className="font-display text-4xl md:text-5xl text-ivory mb-6">
              Trust Through <span className="text-gold">Transparency</span>
            </h2>
            <p className="text-lg text-steel">
              In a world of broken promises and opaque arbitration, TribunalCraft brings
              accountability to every agreement. Every stake is visible. Every vote is permanent.
              Every outcome is immutable.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <LockIcon />,
                title: "Immutable Records",
                description: "Every dispute, vote, and resolution is permanently recorded on-chain. No tampering. No revision. Pure truth."
              },
              {
                icon: <CoinsIcon />,
                title: "Economic Alignment",
                description: "Stake-weighted voting ensures participants have skin in the game. Truth becomes profitable; deception becomes costly."
              },
              {
                icon: <UsersIcon />,
                title: "Community Governed",
                description: "No central authority decides outcomes. A decentralized network of jurors reaches consensus through incentive design."
              }
            ].map((item, i) => (
              <div
                key={i}
                className="group p-8 border border-slate-light hover:border-gold/30 bg-slate/30 backdrop-blur transition-all duration-500"
              >
                <div className="text-gold mb-6 group-hover:scale-110 transition-transform duration-300">
                  {item.icon}
                </div>
                <h3 className="font-display text-xl text-ivory mb-3">{item.title}</h3>
                <p className="text-steel text-sm leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <span className="text-gold text-sm uppercase tracking-widest mb-4 block">Protocol Features</span>
            <h2 className="font-display text-4xl md:text-5xl text-ivory">
              Built for <span className="text-gold">Fairness</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <ShieldIcon />,
                title: "Bonded Subjects",
                description: "Creators stake SOL as a bond of good faith. This bond becomes the prize pool if challenged."
              },
              {
                icon: <ZapIcon />,
                title: "Flash Disputes",
                description: "Challenge any subject instantly. Your stake shows conviction; weak claims lose everything."
              },
              {
                icon: <UsersIcon />,
                title: "Juror Pools",
                description: "Stake to join the jury pool. Vote on disputes to earn rewards from losing parties."
              },
              {
                icon: <CoinsIcon />,
                title: "Dynamic Rewards",
                description: "Rewards scale with stake and reputation. Early jurors with strong track records earn more."
              },
              {
                icon: <LockIcon />,
                title: "7-Day Finality",
                description: "Stakes lock for 7 days post-resolution, ensuring commitment and preventing gaming."
              },
              {
                icon: <GlobeIcon />,
                title: "Universal Protocol",
                description: "Any platform can integrate TribunalCraft. One truth layer for all of Web3."
              }
            ].map((feature, i) => (
              <div
                key={i}
                className="group relative p-6 border border-slate-light hover:border-gold/50 transition-all duration-300 overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="text-gold/70 group-hover:text-gold transition-colors mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="font-display text-lg text-ivory mb-2">{feature.title}</h3>
                  <p className="text-sm text-steel">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-32 relative bg-slate/20">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, var(--gold) 1px, transparent 0)`,
          backgroundSize: "40px 40px"
        }} />

        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <span className="text-gold text-sm uppercase tracking-widest mb-4 block">The Process</span>
            <h2 className="font-display text-4xl md:text-5xl text-ivory">
              How <span className="text-gold">Justice</span> Unfolds
            </h2>
          </div>

          <div className="relative">
            {/* Timeline line */}
            <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-gold via-gold/50 to-gold/20" />

            {[
              {
                step: "01",
                title: "Create Subject",
                description: "A creator submits a claim, contract, or statement to the protocol. They bond SOL as a stake in their claim's validity.",
                side: "left"
              },
              {
                step: "02",
                title: "Challenge Filed",
                description: "Anyone can dispute the subject by staking SOL. Multiple challengers can join, pooling resources against the claim.",
                side: "right"
              },
              {
                step: "03",
                title: "Jurors Vote",
                description: "Registered jurors allocate stake to vote. Voting power is proportional to stake and reputation score.",
                side: "left"
              },
              {
                step: "04",
                title: "Resolution",
                description: "After the voting period, the majority wins. Losers forfeit stakes to winners. Subject status updates on-chain.",
                side: "right"
              },
              {
                step: "05",
                title: "Claim Rewards",
                description: "Winners claim proportional rewards after a 7-day lock period. Reputation scores update based on outcomes.",
                side: "left"
              }
            ].map((item, i) => (
              <div key={i} className={`relative flex items-center mb-16 last:mb-0 ${
                item.side === "right" ? "lg:flex-row-reverse" : ""
              }`}>
                <div className={`flex-1 ${item.side === "right" ? "lg:text-right lg:pr-16" : "lg:pl-16"} ${
                  item.side === "left" ? "lg:ml-auto" : ""
                }`}>
                  <div className={`max-w-md ${item.side === "right" ? "lg:ml-auto" : ""}`}>
                    <span className="font-display text-5xl text-gold/30 block mb-2">{item.step}</span>
                    <h3 className="font-display text-2xl text-ivory mb-3">{item.title}</h3>
                    <p className="text-steel">{item.description}</p>
                  </div>
                </div>

                {/* Center dot */}
                <div className="hidden lg:flex absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-gold rounded-full border-4 border-obsidian" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles Section */}
      <section id="roles" className="py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <span className="text-gold text-sm uppercase tracking-widest mb-4 block">Participants</span>
            <h2 className="font-display text-4xl md:text-5xl text-ivory">
              Three Roles, One <span className="text-gold">Tribunal</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Defender */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-b from-sky-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative p-8 border-2 border-sky-500/30 h-full">
                <div className="w-16 h-16 rounded-full border-2 border-sky-500 flex items-center justify-center mb-6">
                  <ShieldIcon />
                </div>
                <h3 className="font-display text-2xl text-ivory mb-2">Defender</h3>
                <p className="text-sky-400 text-sm mb-4">Protect Truth</p>
                <ul className="space-y-3 text-sm text-steel">
                  <li className="flex items-start gap-2">
                    <span className="text-sky-500 mt-1">→</span>
                    Create and bond subjects
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-sky-500 mt-1">→</span>
                    Auto-defend via pool deposits
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-sky-500 mt-1">→</span>
                    Earn when challengers fail
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-sky-500 mt-1">→</span>
                    Build trust through valid claims
                  </li>
                </ul>
              </div>
            </div>

            {/* Challenger */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-b from-crimson/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative p-8 border-2 border-crimson/30 h-full">
                <div className="w-16 h-16 rounded-full border-2 border-crimson flex items-center justify-center mb-6 text-crimson-light">
                  <ZapIcon />
                </div>
                <h3 className="font-display text-2xl text-ivory mb-2">Challenger</h3>
                <p className="text-crimson-light text-sm mb-4">Expose Falsehood</p>
                <ul className="space-y-3 text-sm text-steel">
                  <li className="flex items-start gap-2">
                    <span className="text-crimson-light mt-1">→</span>
                    Dispute invalid subjects
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-crimson-light mt-1">→</span>
                    Stake conviction behind claims
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-crimson-light mt-1">→</span>
                    Win defender bonds on success
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-crimson-light mt-1">→</span>
                    Join forces with other challengers
                  </li>
                </ul>
              </div>
            </div>

            {/* Juror */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-b from-gold/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative p-8 border-2 border-gold/30 h-full">
                <div className="w-16 h-16 rounded-full border-2 border-gold flex items-center justify-center mb-6 text-gold">
                  <UsersIcon />
                </div>
                <h3 className="font-display text-2xl text-ivory mb-2">Juror</h3>
                <p className="text-gold text-sm mb-4">Decide Outcomes</p>
                <ul className="space-y-3 text-sm text-steel">
                  <li className="flex items-start gap-2">
                    <span className="text-gold mt-1">→</span>
                    Register with staked SOL
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gold mt-1">→</span>
                    Vote on active disputes
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gold mt-1">→</span>
                    Earn from losing party stakes
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gold mt-1">→</span>
                    Build reputation over time
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="use-cases" className="py-32 relative bg-slate/20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <span className="text-gold text-sm uppercase tracking-widest mb-4 block">Applications</span>
            <h2 className="font-display text-4xl md:text-5xl text-ivory">
              Where <span className="text-gold">Truth</span> Matters
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                title: "Freelance Contracts",
                description: "Escrow payments with built-in dispute resolution. If work isn't delivered, challengers can claim the bond.",
                tag: "Gig Economy"
              },
              {
                title: "DAO Governance",
                description: "Verify that proposal implementations match their descriptions. Challenge governance violations.",
                tag: "DAOs"
              },
              {
                title: "Content Verification",
                description: "Stake behind the accuracy of information. Let the community verify or debunk claims.",
                tag: "Media"
              },
              {
                title: "Prediction Markets",
                description: "Decentralized oracle for event outcomes. Multiple jurors ensure accurate resolution.",
                tag: "DeFi"
              },
              {
                title: "NFT Authenticity",
                description: "Challenge fraudulent collections. Protect buyers from rug pulls with staked verification.",
                tag: "NFTs"
              },
              {
                title: "Service Agreements",
                description: "SLA enforcement with automatic penalties. Disputes resolved without legal overhead.",
                tag: "Enterprise"
              }
            ].map((useCase, i) => (
              <div
                key={i}
                className="group p-8 border border-slate-light hover:border-gold/30 transition-all duration-300"
              >
                <span className="inline-block px-3 py-1 text-xs text-gold border border-gold/30 rounded-full mb-4">
                  {useCase.tag}
                </span>
                <h3 className="font-display text-xl text-ivory mb-3">{useCase.title}</h3>
                <p className="text-steel text-sm">{useCase.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-gold/5 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gold/10 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-display text-4xl md:text-6xl text-ivory mb-6">
            The Tribunal <span className="text-gold">Awaits</span>
          </h2>
          <p className="text-xl text-steel mb-12 max-w-2xl mx-auto">
            Join the decentralized arbitration revolution. Create subjects, challenge claims,
            or serve as a juror. Truth has never been more profitable.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/registry"
              className="group inline-flex items-center justify-center gap-3 bg-gold hover:bg-gold-light text-obsidian font-semibold px-10 py-5 text-lg transition-all"
            >
              Launch App
              <ArrowRight />
            </Link>
            <a
              href="https://github.com/tribunalcraft"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 border border-slate-light hover:border-gold/50 text-parchment px-10 py-5 text-lg transition-all"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-light py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 border-2 border-gold rounded-sm flex items-center justify-center">
                  <span className="font-display text-gold text-xl font-bold">T</span>
                </div>
                <span className="font-display text-xl text-ivory">TribunalCraft</span>
              </div>
              <p className="text-sm text-steel">
                Decentralized dispute resolution protocol on Solana.
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
              <h4 className="font-display text-ivory mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-steel">
                <li><a href="#" className="hover:text-gold transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-gold transition-colors">SDK Reference</a></li>
                <li><a href="#" className="hover:text-gold transition-colors">Integration Guide</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-display text-ivory mb-4">Community</h4>
              <ul className="space-y-2 text-sm text-steel">
                <li><a href="https://github.com/tribunalcraft" target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors">GitHub</a></li>
                <li><a href="#" className="hover:text-gold transition-colors">Discord</a></li>
                <li><a href="#" className="hover:text-gold transition-colors">Twitter</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-light flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-steel">
              &copy; 2025 TribunalCraft. Built on Solana.
            </p>
            <p className="text-xs text-steel">
              Truth through consensus. Justice through code.
            </p>
          </div>
        </div>
      </footer>

      {/* Custom styles for animations */}
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scale-left {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes scale-right {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(5px); }
        }
        .animate-fade-in {
          animation: fade-in 0.8s ease-out forwards;
          opacity: 0;
        }
        .animate-slide-up {
          animation: slide-up 0.8s ease-out forwards;
          opacity: 0;
        }
        .animate-scale-left {
          animation: scale-left 3s ease-in-out infinite;
        }
        .animate-scale-right {
          animation: scale-right 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
