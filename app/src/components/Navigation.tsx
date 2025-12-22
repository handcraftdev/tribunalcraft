"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const WalletButton = dynamic(
  () => import("./wallet/WalletButton").then((mod) => mod.WalletButtonInner),
  {
    ssr: false,
    loading: () => (
      <button className="bg-gold/10 border border-gold/30 text-gold px-4 py-2 text-sm opacity-50">
        Connecting...
      </button>
    ),
  }
);

const navItems = [
  { href: "/overview", label: "Overview" },
  { href: "/registry", label: "Registry" },
  { href: "/analytics", label: "Analytics" },
  { href: "/profile", label: "Profile" },
];

export const Navigation = () => {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Check initial state
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 bg-obsidian/98 backdrop-blur-md transition-all duration-300 ${
        scrolled ? "border-b border-slate-light/30" : "border-b border-transparent"
      }`}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 border border-gold/50 flex items-center justify-center group-hover:border-gold transition-colors">
              <span className="font-display text-gold text-sm font-semibold">T</span>
            </div>
            <span className="font-display text-lg text-ivory hidden sm:block">TribunalCraft</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    relative px-4 py-2 text-sm transition-colors
                    ${isActive
                      ? "text-gold"
                      : "text-steel hover:text-parchment"
                    }
                  `}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-gold" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Wallet Button */}
          <WalletButton />
      </div>

      {/* Mobile Navigation */}
      <div className={`md:hidden transition-all duration-300 ${
        scrolled ? "border-t border-slate-light/30" : "border-t border-transparent"
      }`}>
        <div className="flex overflow-x-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex-1 text-center px-4 py-3 text-xs font-medium transition-colors
                  ${isActive ? "text-gold border-b-2 border-gold" : "text-steel"}
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
