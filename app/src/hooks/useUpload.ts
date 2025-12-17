"use client";

import { useState, useCallback } from "react";
import {
  SubjectContent,
  DisputeContent,
  createSubjectContent,
  createDisputeContent,
  Evidence,
} from "@/lib/content-types";

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
 * Hook for uploading TribunalCraft content to IPFS
 */
export function useUpload() {
  const [state, setState] = useState<UploadState>({
    isUploading: false,
    error: null,
  });

  /**
   * Upload evidence file (image, document, etc.)
   */
  const uploadEvidence = useCallback(
    async (file: File): Promise<ContentUploadResult | null> => {
      setState({ isUploading: true, error: null });

      try {
        const formData = new FormData();
        formData.append("file", file);

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
    []
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
      setState({ isUploading: true, error: null });

      try {
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
          body: JSON.stringify({ type: "subject", content }),
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
    []
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
      setState({ isUploading: true, error: null });

      try {
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
          body: JSON.stringify({ type: "dispute", content }),
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
    []
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
