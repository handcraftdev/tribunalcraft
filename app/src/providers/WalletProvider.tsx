"use client";

import { FC, ReactNode, useMemo, useState, useEffect } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";

import "@solana/wallet-adapter-react-ui/styles.css";

interface Props {
  children: ReactNode;
}

export const WalletProvider: FC<Props> = ({ children }) => {
  // Use state to hold the endpoint - only set after mounting on client
  const [endpoint, setEndpoint] = useState<string | null>(null);

  useEffect(() => {
    // Only runs on client, so window is available
    setEndpoint(`${window.location.origin}/api/rpc`);
  }, []);

  // Modern wallets (Phantom, Solflare, etc.) auto-register via Standard Wallet interface
  const wallets = useMemo(() => [], []);

  // Use Helius WSS endpoint directly for transaction confirmations
  const config = useMemo(() => ({
    commitment: "confirmed" as const,
    wsEndpoint: "wss://devnet.helius-rpc.com/?api-key=88ac54a3-8850-4686-a521-70d116779182",
  }), []);

  // Don't render children until endpoint is set to ensure we use the Helius RPC proxy
  if (!endpoint) {
    return null;
  }

  return (
    <ConnectionProvider endpoint={endpoint} config={config}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};
