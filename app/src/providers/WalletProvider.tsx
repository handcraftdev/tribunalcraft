"use client";

import { FC, ReactNode, useMemo, useState, useEffect, useCallback } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
  useWallet,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { WalletError, WalletReadyState } from "@solana/wallet-adapter-base";
import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache,
  createDefaultWalletNotFoundHandler,
} from "@solana-mobile/wallet-adapter-mobile";

import "@solana/wallet-adapter-react-ui/styles.css";

// Debug component to log wallet state changes
const WalletDebugger: FC<{ children: ReactNode }> = ({ children }) => {
  const { wallet, publicKey, connected, connecting, disconnecting, wallets } = useWallet();

  useEffect(() => {
    console.log("[Wallet Debug] State change:", {
      wallet: wallet?.adapter.name,
      publicKey: publicKey?.toBase58(),
      connected,
      connecting,
      disconnecting,
      availableWallets: wallets.map(w => ({
        name: w.adapter.name,
        readyState: WalletReadyState[w.adapter.readyState],
      })),
    });
  }, [wallet, publicKey, connected, connecting, disconnecting, wallets]);

  return <>{children}</>;
};

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

  // Mobile wallet adapter for deep linking to wallet apps on mobile
  // Desktop wallets auto-register via Standard Wallet interface
  const wallets = useMemo(() => [
    new SolanaMobileWalletAdapter({
      addressSelector: createDefaultAddressSelector(),
      appIdentity: {
        name: "TribunalCraft",
        uri: typeof window !== "undefined" ? window.location.origin : undefined,
      },
      authorizationResultCache: createDefaultAuthorizationResultCache(),
      cluster: "devnet",
      onWalletNotFound: createDefaultWalletNotFoundHandler(),
    }),
  ], []);

  // Connection config with WSS for transaction confirmations
  const config = useMemo(() => ({
    commitment: "confirmed" as const,
    wsEndpoint: process.env.NEXT_PUBLIC_SOLANA_WSS_URL,
  }), []);

  // Log detailed wallet errors
  const onError = useCallback((error: WalletError) => {
    console.error("[Wallet] Connection error:", {
      name: error.name,
      message: error.message,
      error: error.error,
      stack: error.stack,
    });
  }, []);

  // Don't render children until endpoint is set to ensure we use the Helius RPC proxy
  if (!endpoint) {
    return null;
  }

  return (
    <ConnectionProvider endpoint={endpoint} config={config}>
      <SolanaWalletProvider wallets={wallets} autoConnect onError={onError}>
        <WalletModalProvider>
          <WalletDebugger>{children}</WalletDebugger>
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};
