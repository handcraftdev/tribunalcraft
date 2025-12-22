"use client";

import { memo } from "react";
import { sanitizeEvidence, type SanitizedEvidence } from "@/lib/sanitize";

interface Evidence {
  type?: string;
  title?: string;
  cid?: string;
  url?: string;
  text?: string;
  description?: string;
}

interface EvidenceViewerProps {
  evidence: Evidence[];
  getIpfsUrl?: (cid: string) => string;
}

const EvidenceIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "image":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case "document":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case "video":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
    case "link":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
  }
};

const EvidenceItem = memo(function EvidenceItem({
  item,
  getIpfsUrl,
}: {
  item: SanitizedEvidence;
  getIpfsUrl?: (cid: string) => string;
}) {
  const url = item.url || (getIpfsUrl && item.url ? getIpfsUrl(item.url) : null);

  return (
    <div className="p-2 bg-obsidian border border-slate-light/30 rounded space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-steel">
          <EvidenceIcon type={item.type} />
        </span>
        <span className="text-xs font-medium text-parchment truncate flex-1">
          {item.title}
        </span>
        <span className="text-[10px] text-steel uppercase">{item.type}</span>
      </div>

      {item.description && (
        <p className="text-[10px] text-steel pl-6">{item.description}</p>
      )}

      {item.text && (
        <div className="pl-6">
          <p className="text-xs text-steel bg-slate-light/10 p-2 rounded max-h-20 overflow-y-auto">
            {item.text}
          </p>
        </div>
      )}

      {url && (
        <div className="pl-6">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-sky-400 hover:text-sky-300 hover:underline truncate block"
          >
            {item.type === "link" ? url : "View file"}
          </a>
        </div>
      )}
    </div>
  );
});

export const EvidenceViewer = memo(function EvidenceViewer({
  evidence,
  getIpfsUrl,
}: EvidenceViewerProps) {
  if (!evidence || evidence.length === 0) return null;

  // Sanitize all evidence items
  const sanitizedItems = evidence
    .map(sanitizeEvidence)
    .filter((item): item is SanitizedEvidence => item !== null);

  if (sanitizedItems.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-steel uppercase tracking-wider">
        Evidence ({sanitizedItems.length})
      </p>
      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {sanitizedItems.map((item, index) => (
          <EvidenceItem key={index} item={item} getIpfsUrl={getIpfsUrl} />
        ))}
      </div>
    </div>
  );
});
