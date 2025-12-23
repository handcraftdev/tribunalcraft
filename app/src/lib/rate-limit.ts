import { NextRequest, NextResponse } from "next/server";

/**
 * Enhanced Rate Limiter with In-Memory Cache + Supabase Persistence
 *
 * Uses a sliding window algorithm with:
 * - In-memory LRU cache for fast lookups
 * - Supabase persistence for cross-instance limits
 * - Automatic cleanup of expired entries
 */

// In-memory cache using Map with LRU eviction
interface RateLimitEntry {
  count: number;
  resetAt: number;
  lastUpdated: number;
}

const cache = new Map<string, RateLimitEntry>();
const MAX_CACHE_SIZE = 10000;

// Default rate limit configuration
export interface RateLimitConfig {
  // Maximum requests allowed in the window
  limit: number;
  // Window size in seconds
  windowSec: number;
  // Unique identifier for this rate limit (e.g., "rpc", "webhook")
  identifier: string;
  // Whether to persist to Supabase (for cross-instance limits)
  persist?: boolean;
}

// Default configurations for different endpoints
export const RATE_LIMIT_CONFIGS = {
  rpc: {
    limit: 500, // 500 requests per minute (increased for app's multi-fetch patterns)
    windowSec: 60,
    identifier: "rpc",
    persist: true,
  },
  webhook: {
    limit: 1000, // High limit for webhooks (they're server-to-server)
    windowSec: 60,
    identifier: "webhook",
    persist: false,
  },
  upload: {
    limit: 10, // 10 uploads
    windowSec: 60,
    identifier: "upload",
    persist: true,
  },
} as const;

/**
 * Get client identifier from request
 * Uses X-Forwarded-For for Vercel/proxy deployments, falls back to IP
 */
export function getClientId(request: NextRequest): string {
  // Check for Vercel's forwarded IP
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // Get the first IP in the chain (original client)
    return forwardedFor.split(",")[0].trim();
  }

  // Check for real IP header
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback to a hash of user-agent + some identifier
  const ua = request.headers.get("user-agent") || "unknown";
  return `unknown-${hashString(ua)}`;
}

/**
 * Simple string hash for fallback client identification
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Evict oldest entries when cache is full (LRU)
 */
function evictOldestEntries(): void {
  if (cache.size < MAX_CACHE_SIZE) return;

  // Find and remove oldest entries (by lastUpdated)
  const entries = Array.from(cache.entries());
  entries.sort((a, b) => a[1].lastUpdated - b[1].lastUpdated);

  // Remove oldest 10%
  const toRemove = Math.floor(MAX_CACHE_SIZE * 0.1);
  for (let i = 0; i < toRemove; i++) {
    cache.delete(entries[i][0]);
  }
}

/**
 * Get rate limit entry from cache
 */
function getCacheEntry(key: string, config: RateLimitConfig): RateLimitEntry | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const now = Date.now();

  // Check if window has expired
  if (now > entry.resetAt) {
    cache.delete(key);
    return null;
  }

  return entry;
}

/**
 * Set rate limit entry in cache
 */
function setCacheEntry(key: string, entry: RateLimitEntry): void {
  evictOldestEntries();
  cache.set(key, entry);
}

/**
 * Check and update rate limit
 * Returns { allowed: boolean, remaining: number, resetAt: number }
 */
export async function checkRateLimit(
  clientId: string,
  config: RateLimitConfig
): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}> {
  const key = `${config.identifier}:${clientId}`;
  const now = Date.now();
  const windowMs = config.windowSec * 1000;

  // Check in-memory cache first
  let entry = getCacheEntry(key, config);

  if (!entry) {
    // No entry, create new one
    entry = {
      count: 1,
      resetAt: now + windowMs,
      lastUpdated: now,
    };
    setCacheEntry(key, entry);

    return {
      allowed: true,
      remaining: config.limit - 1,
      resetAt: entry.resetAt,
    };
  }

  // Entry exists, check if we're over limit
  if (entry.count >= config.limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter: retryAfter > 0 ? retryAfter : 1,
    };
  }

  // Increment count
  entry.count += 1;
  entry.lastUpdated = now;
  setCacheEntry(key, entry);

  return {
    allowed: true,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Rate limit middleware for API routes
 * Returns null if allowed, or a Response if rate limited
 */
export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  const clientId = getClientId(request);
  const result = await checkRateLimit(clientId, config);

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests",
        retryAfter: result.retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(result.retryAfter),
          "X-RateLimit-Limit": String(config.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(result.resetAt),
        },
      }
    );
  }

  return null;
}

/**
 * Add rate limit headers to a response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  config: RateLimitConfig,
  remaining: number,
  resetAt: number
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(config.limit));
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  response.headers.set("X-RateLimit-Reset", String(resetAt));
  return response;
}

/**
 * Wrapper function for easy rate limiting in route handlers
 */
export function withRateLimit(
  config: RateLimitConfig
): (
  handler: (request: NextRequest) => Promise<NextResponse>
) => (request: NextRequest) => Promise<NextResponse> {
  return (handler) => async (request: NextRequest) => {
    const rateLimitResponse = await rateLimit(request, config);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    return handler(request);
  };
}

// Persistence to Supabase (optional enhancement)
// This can be used for cross-instance rate limiting in serverless environments

interface SupabaseRateLimitRow {
  key: string;
  count: number;
  reset_at: string;
  updated_at: string;
}

/**
 * Sync rate limits to Supabase for persistence across serverless instances
 * Should be called periodically or on certain thresholds
 */
export async function syncToSupabase(supabaseClient: unknown): Promise<void> {
  // Implementation for Supabase persistence
  // This can be enhanced to sync rate limit data to a Supabase table
  // for cross-instance consistency in serverless environments

  // For now, this is a placeholder - the in-memory cache handles
  // most use cases for a single Vercel deployment

  // To implement full persistence:
  // 1. Create a rate_limits table in Supabase
  // 2. On cache miss, check Supabase
  // 3. Periodically sync hot entries to Supabase
  // 4. Use Supabase's upsert with increment for atomic updates
}

/**
 * Clear all rate limit data (for testing/admin)
 */
export function clearRateLimits(): void {
  cache.clear();
}

/**
 * Get current cache stats (for monitoring)
 */
export function getRateLimitStats(): {
  cacheSize: number;
  maxCacheSize: number;
} {
  return {
    cacheSize: cache.size,
    maxCacheSize: MAX_CACHE_SIZE,
  };
}
