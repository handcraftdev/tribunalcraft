/**
 * Content sanitization utilities to prevent XSS attacks
 * Used when rendering user-provided content from IPFS
 */

// Allowed URL protocols for links
const ALLOWED_PROTOCOLS = ["https:", "http:", "ipfs:"];

// Maximum text length to prevent DoS via long strings
const MAX_TEXT_LENGTH = 10000;
const MAX_URL_LENGTH = 2048;

/**
 * Validate and sanitize a URL
 * Returns null if URL is invalid or potentially malicious
 */
export function sanitizeUrl(url: string | undefined | null): string | null {
  if (!url || typeof url !== "string") return null;

  const trimmed = url.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH) return null;

  try {
    const parsed = new URL(trimmed);

    // Check protocol
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      return null;
    }

    // Block javascript: and data: URLs (extra safety)
    if (parsed.protocol === "javascript:" || parsed.protocol === "data:") {
      return null;
    }

    return trimmed;
  } catch {
    // Invalid URL
    return null;
  }
}

/**
 * Truncate text to prevent DoS via extremely long strings
 */
export function sanitizeText(text: string | undefined | null, maxLength = MAX_TEXT_LENGTH): string {
  if (!text || typeof text !== "string") return "";

  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;

  return trimmed.slice(0, maxLength) + "...";
}

/**
 * Sanitize IPFS CID format
 * Valid CIDs are alphanumeric with some allowed characters
 */
export function sanitizeCid(cid: string | undefined | null): string | null {
  if (!cid || typeof cid !== "string") return null;

  const trimmed = cid.trim();

  // CID v0: starts with Qm, 46 chars
  // CID v1: starts with b, variable length
  const cidPattern = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{58,})$/;

  if (!cidPattern.test(trimmed)) {
    return null;
  }

  return trimmed;
}

/**
 * Build a safe IPFS gateway URL
 */
export function buildIpfsUrl(cid: string | undefined | null, gateway = "https://ipfs.io/ipfs/"): string | null {
  const safeCid = sanitizeCid(cid);
  if (!safeCid) return null;

  return `${gateway}${safeCid}`;
}

/**
 * Sanitize evidence item for display
 */
export interface SanitizedEvidence {
  type: "document" | "image" | "video" | "link" | "text";
  title: string;
  url: string | null;
  text: string;
  description: string;
}

export function sanitizeEvidence(evidence: {
  type?: string;
  title?: string;
  cid?: string;
  url?: string;
  text?: string;
  description?: string;
}): SanitizedEvidence | null {
  const validTypes = ["document", "image", "video", "link", "text"];
  const type = validTypes.includes(evidence.type || "")
    ? (evidence.type as SanitizedEvidence["type"])
    : "text";

  const title = sanitizeText(evidence.title, 200) || "Untitled";
  const description = sanitizeText(evidence.description, 1000);
  const text = sanitizeText(evidence.text, 5000);

  // Build URL from CID or direct URL
  let url: string | null = null;
  if (evidence.cid) {
    url = buildIpfsUrl(evidence.cid);
  } else if (evidence.url) {
    url = sanitizeUrl(evidence.url);
  }

  return { type, title, url, text, description };
}
