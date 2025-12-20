"use client";

import { FC, ReactNode, useMemo, useState, useEffect } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";

import "@solana/wallet-adapter-react-ui/styles.css";

interface Props {
  children: ReactNode;
}

export const WalletProvider: FC<Props> = ({ children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use RPC proxy to keep API key server-side (client-side only)
  // Falls back to public devnet during SSR/build
  const endpoint = useMemo(() => {
    if (mounted && typeof window !== "undefined") {
      return `${window.location.origin}/api/rpc`;
    }
    // Fallback for SSR - won't actually be used since client will remount
    return clusterApiUrl("devnet");
  }, [mounted]);

  // Modern wallets (Phantom, Solflare, etc.) auto-register via Standard Wallet interface
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};
