import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";

// Rate limit: 10 uploads per wallet per minute
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;

// Signature validity window: 5 minutes
const SIGNATURE_VALIDITY_MS = 5 * 60 * 1000;

// In-memory rate limit store (use Redis in production for multi-instance)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Verify wallet signature for upload authentication
 * Message format: "TribunalCraft Upload: {timestamp}"
 */
export function verifyWalletSignature(
  walletAddress: string,
  signature: string,
  timestamp: number
): { valid: boolean; error?: string } {
  try {
    // Validate timestamp is recent (within 5 minutes)
    const now = Date.now();
    if (Math.abs(now - timestamp) > SIGNATURE_VALIDITY_MS) {
      return { valid: false, error: "Signature expired. Please sign again." };
    }

    // Validate wallet address format
    let publicKey: PublicKey;
    try {
      publicKey = new PublicKey(walletAddress);
    } catch {
      return { valid: false, error: "Invalid wallet address" };
    }

    // Reconstruct the message that was signed
    const message = `TribunalCraft Upload: ${timestamp}`;
    const messageBytes = new TextEncoder().encode(message);

    // Decode signature from base64
    let signatureBytes: Uint8Array;
    try {
      signatureBytes = Buffer.from(signature, "base64");
    } catch {
      return { valid: false, error: "Invalid signature format" };
    }

    // Verify the signature
    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey.toBytes()
    );

    if (!isValid) {
      return { valid: false, error: "Invalid signature" };
    }

    return { valid: true };
  } catch (error) {
    console.error("Signature verification error:", error);
    return { valid: false, error: "Signature verification failed" };
  }
}

/**
 * Check rate limit for a wallet address
 */
export function checkRateLimit(walletAddress: string): { allowed: boolean; error?: string } {
  const now = Date.now();
  const entry = rateLimitStore.get(walletAddress);

  // Clean up expired entries periodically
  if (rateLimitStore.size > 1000) {
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }

  if (!entry || entry.resetAt < now) {
    // New window
    rateLimitStore.set(walletAddress, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true };
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    const waitSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return {
      allowed: false,
      error: `Rate limit exceeded. Try again in ${waitSeconds} seconds.`,
    };
  }

  // Increment count
  entry.count++;
  return { allowed: true };
}

/**
 * Combined auth check: verify signature and rate limit
 */
export function authenticateUpload(
  walletAddress: string,
  signature: string,
  timestamp: number
): { authenticated: boolean; error?: string } {
  // Verify signature first
  const signatureResult = verifyWalletSignature(walletAddress, signature, timestamp);
  if (!signatureResult.valid) {
    return { authenticated: false, error: signatureResult.error };
  }

  // Check rate limit
  const rateLimitResult = checkRateLimit(walletAddress);
  if (!rateLimitResult.allowed) {
    return { authenticated: false, error: rateLimitResult.error };
  }

  return { authenticated: true };
}
