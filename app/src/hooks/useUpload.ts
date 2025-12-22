"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  SubjectContent,
  DisputeContent,
  createSubjectContent,
  createDisputeContent,
  Evidence,
} from "@tribunalcraft/sdk";

export interface UploadState {
  isUploading: boolean;
  error: string | null;
}

export interface ContentUploadResult {
  cid: string;
  url: string;
  size: number;
}

/**
 * Generate upload auth signature
 * Message format: "TribunalCraft Upload: {timestamp}"
 */
async function generateUploadAuth(
  walletAddress: string,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
): Promise<{ wallet: string; signature: string; timestamp: number }> {
  const timestamp = Date.now();
  const message = `TribunalCraft Upload: ${timestamp}`;
  const messageBytes = new TextEncoder().encode(message);

  const signatureBytes = await signMessage(messageBytes);
  const signature = Buffer.from(signatureBytes).toString("base64");

  return { wallet: walletAddress, signature, timestamp };
}

/**
 * Hook for uploading TribunalCraft content to IPFS
 * Requires wallet connection for authentication
 */
export function useUpload() {
  const { publicKey, signMessage } = useWallet();
  const [state, setState] = useState<UploadState>({
    isUploading: false,
    error: null,
  });

  /**
   * Upload evidence file (image, document, etc.)
   */
  const uploadEvidence = useCallback(
    async (file: File): Promise<ContentUploadResult | null> => {
      if (!publicKey || !signMessage) {
        setState({ isUploading: false, error: "Wallet not connected" });
        return null;
      }

      setState({ isUploading: true, error: null });

      try {
        // Generate auth signature
        const auth = await generateUploadAuth(publicKey.toBase58(), signMessage);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("wallet", auth.wallet);
        formData.append("signature", auth.signature);
        formData.append("timestamp", auth.timestamp.toString());

        const response = await fetch("/api/upload/evidence", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Upload failed");
        }

        const result = await response.json();
        setState({ isUploading: false, error: null });

        return {
          cid: result.cid,
          url: result.url,
          size: result.size,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        setState({ isUploading: false, error: message });
        return null;
      }
    },
    [publicKey, signMessage]
  );

  /**
   * Upload subject content to IPFS
   */
  const uploadSubject = useCallback(
    async (
      data: {
        title: string;
        description: string;
        category: SubjectContent["category"];
        termsText: string;
        termsDocumentCid?: string;
        evidence?: Evidence[];
        parties?: SubjectContent["parties"];
        platformData?: Record<string, unknown>;
      }
    ): Promise<ContentUploadResult | null> => {
      if (!publicKey || !signMessage) {
        setState({ isUploading: false, error: "Wallet not connected" });
        return null;
      }

      setState({ isUploading: true, error: null });

      try {
        // Generate auth signature
        const auth = await generateUploadAuth(publicKey.toBase58(), signMessage);

        const content = createSubjectContent({
          title: data.title,
          description: data.description,
          category: data.category,
          terms: {
            text: data.termsText,
            documentCid: data.termsDocumentCid,
          },
          evidence: data.evidence,
          parties: data.parties,
          platformData: data.platformData,
        });

        const response = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "subject", content, auth }),
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Upload failed");
        }

        const result = await response.json();
        setState({ isUploading: false, error: null });

        return {
          cid: result.cid,
          url: result.url,
          size: result.size,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        setState({ isUploading: false, error: message });
        return null;
      }
    },
    [publicKey, signMessage]
  );

  /**
   * Upload dispute content to IPFS
   */
  const uploadDispute = useCallback(
    async (
      data: {
        title: string;
        reason: string;
        type: DisputeContent["type"];
        subjectCid: string;
        requestedOutcome: string;
        evidence?: Evidence[];
        platformData?: Record<string, unknown>;
      }
    ): Promise<ContentUploadResult | null> => {
      if (!publicKey || !signMessage) {
        setState({ isUploading: false, error: "Wallet not connected" });
        return null;
      }

      setState({ isUploading: true, error: null });

      try {
        // Generate auth signature
        const auth = await generateUploadAuth(publicKey.toBase58(), signMessage);

        const content = createDisputeContent({
          title: data.title,
          reason: data.reason,
          type: data.type,
          subjectCid: data.subjectCid,
          requestedOutcome: data.requestedOutcome,
          evidence: data.evidence || [],
          platformData: data.platformData,
        });

        const response = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "dispute", content, auth }),
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Upload failed");
        }

        const result = await response.json();
        setState({ isUploading: false, error: null });

        return {
          cid: result.cid,
          url: result.url,
          size: result.size,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        setState({ isUploading: false, error: message });
        return null;
      }
    },
    [publicKey, signMessage]
  );

  /**
   * Reset error state
   */
  const reset = useCallback(() => {
    setState({ isUploading: false, error: null });
  }, []);

  return {
    ...state,
    uploadEvidence,
    uploadSubject,
    uploadDispute,
    reset,
  };
}

/**
 * Hook for fetching content from IPFS
 */
export function useContentFetch() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const IPFS_GATEWAY = "https://ipfs.filebase.io/ipfs/";

  /**
   * Fetch content from IPFS by CID
   */
  const fetchContent = useCallback(
    async <T = unknown>(cid: string): Promise<T | null> => {
      if (!cid) return null;

      setIsLoading(true);
      setError(null);

      try {
        const url = cid.startsWith("http") ? cid : `${IPFS_GATEWAY}${cid}`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error("Failed to fetch content");
        }

        const data = await response.json();
        setIsLoading(false);
        return data as T;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Fetch failed";
        setError(message);
        setIsLoading(false);
        return null;
      }
    },
    []
  );

  /**
   * Fetch subject content
   */
  const fetchSubject = useCallback(
    async (cid: string): Promise<SubjectContent | null> => {
      return fetchContent<SubjectContent>(cid);
    },
    [fetchContent]
  );

  /**
   * Fetch dispute content
   */
  const fetchDispute = useCallback(
    async (cid: string): Promise<DisputeContent | null> => {
      return fetchContent<DisputeContent>(cid);
    },
    [fetchContent]
  );

  return {
    isLoading,
    error,
    fetchContent,
    fetchSubject,
    fetchDispute,
    getUrl: (cid: string) => (cid ? (cid.startsWith("http") ? cid : `${IPFS_GATEWAY}${cid}`) : ""),
  };
}
