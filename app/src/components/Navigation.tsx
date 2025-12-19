"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";

const WalletButton = dynamic(
  () => import("./wallet/WalletButton").then((mod) => mod.WalletButtonInner),
  {
    ssr: false,
    loading: () => (
      <button className="btn btn-primary opacity-50">
        Connecting...
      </button>
    ),
  }
);

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/registry", label: "Registry" },
  { href: "/profile", label: "Profile" },
  { href: "/account", label: "Account" },
];

// Scale of Justice SVG Icon
const ScaleIcon = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-gold"
  >
    <path d="M12 3v18" />
    <path d="M5 7l7-4 7 4" />
    <path d="M5 7l-2 9h4l-2-9" />
    <path d="M19 7l2 9h-4l2-9" />
    <circle cx="3" cy="16" r="2" />
    <circle cx="21" cy="16" r="2" />
  </svg>
);

export const Navigation = () => {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 bg-obsidian/95 backdrop-blur-sm border-b border-slate-light">
      {/* Top accent line */}
      <div className="h-[3px] bg-gradient-to-r from-gold via-gold-dark to-transparent" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <ScaleIcon />
              <div className="absolute inset-0 bg-gold/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-xl font-semibold text-ivory tracking-tight">
                TribunalCraft
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-steel">
                Decentralized Arbitration
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center">
            <div className="flex items-center border-l border-r border-slate-light">
              {navItems.map((item, index) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      relative px-5 py-6 text-sm font-medium uppercase tracking-wider
                      transition-all duration-200
                      ${isActive
                        ? "text-gold bg-slate/50"
                        : "text-steel hover:text-parchment hover:bg-slate/30"
                      }
                      ${index !== navItems.length - 1 ? "border-r border-slate-light/50" : ""}
                    `}
                  >
                    {item.label}
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gold" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Wallet Button */}
          <div className="flex items-center gap-4">
            <WalletButton />
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden border-t border-slate-light">
        <div className="flex overflow-x-auto scrollbar-hide">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex-shrink-0 px-4 py-3 text-xs font-medium uppercase tracking-wider
                  border-r border-slate-light/50 last:border-r-0
                  ${isActive ? "text-gold bg-slate/50" : "text-steel"}
                `}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
