/**
 * Error handling utilities for the ScaleCraft frontend
 * Uses the SDK's error parsing to provide user-friendly error messages
 */

import {
  parseTransactionError,
  ScaleCraftError,
  type TransactionError,
} from "@scalecraft/sdk";

/**
 * Convert any error into a user-friendly message
 * Uses SDK's error parsing for program errors
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  // If it's already a ScaleCraftError, use its message
  if (error instanceof ScaleCraftError) {
    return error.message;
  }

  // Parse the error using SDK
  const parsed = parseTransactionError(error);

  // Return the parsed message
  return parsed.message;
}

/**
 * Get detailed error info for debugging
 */
export function getErrorDetails(error: unknown): TransactionError {
  if (error instanceof ScaleCraftError) {
    return {
      code: error.code,
      name: error.errorName,
      message: error.message,
      raw: error.raw,
      logs: error.logs,
    };
  }

  return parseTransactionError(error);
}

/**
 * Format error for display with optional details
 */
export function formatError(error: unknown, includeDetails: boolean = false): {
  message: string;
  code?: number;
  name?: string;
  details?: string;
} {
  const parsed = getErrorDetails(error);

  const result: {
    message: string;
    code?: number;
    name?: string;
    details?: string;
  } = {
    message: parsed.message,
  };

  if (parsed.code) {
    result.code = parsed.code;
  }

  if (parsed.name && parsed.name !== "Error" && parsed.name !== "UnknownError") {
    result.name = parsed.name;
  }

  if (includeDetails && parsed.raw && parsed.raw !== parsed.message) {
    result.details = parsed.raw;
  }

  return result;
}

/**
 * Check if error is a user cancellation
 */
export function isUserCancellation(error: unknown): boolean {
  const parsed = getErrorDetails(error);
  return (
    parsed.name === "User rejected" ||
    parsed.message.toLowerCase().includes("cancelled") ||
    parsed.message.toLowerCase().includes("rejected") ||
    parsed.message.toLowerCase().includes("user denied")
  );
}

/**
 * Check if error is related to insufficient funds
 */
export function isInsufficientFundsError(error: unknown): boolean {
  const parsed = getErrorDetails(error);
  return (
    parsed.name === "InsufficientFunds" ||
    parsed.message.toLowerCase().includes("insufficient") ||
    parsed.code === 6003 || // InsufficientAvailableStake
    parsed.code === 6004    // InsufficientHeldStake
  );
}

/**
 * Check if error is a network/timeout error that should be retried
 */
export function isRetryableError(error: unknown): boolean {
  const parsed = getErrorDetails(error);
  return (
    parsed.message.includes("expired") ||
    parsed.message.includes("timeout") ||
    parsed.message.includes("Blockhash not found") ||
    parsed.message.includes("not confirmed")
  );
}

/**
 * Error boundary helper - wrap async operations
 */
export async function withUserFriendlyError<T>(
  operation: () => Promise<T>,
  fallbackMessage: string = "An unexpected error occurred"
): Promise<{ success: true; data: T } | { success: false; error: string; details?: TransactionError }> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    const parsed = getErrorDetails(error);

    // Don't show error toast for user cancellations
    if (isUserCancellation(error)) {
      return {
        success: false,
        error: "Transaction cancelled",
        details: parsed,
      };
    }

    return {
      success: false,
      error: parsed.message || fallbackMessage,
      details: parsed,
    };
  }
}

/**
 * Common error code explanations for help text
 */
export const ERROR_HELP: Record<number, string> = {
  6002: "Try increasing your stake amount to meet the minimum requirement.",
  6003: "You need to add more funds to your pool before performing this action.",
  6004: "Wait for your locked stake to be released before withdrawing.",
  6005: "Your stake will unlock 7 days after the dispute resolution.",
  6007: "The minimum bond required is higher. Check the subject requirements.",
  6009: "This subject is currently in a dispute and cannot accept new bonds.",
  6010: "This subject cannot be disputed (it may be dormant or already disputed).",
  6011: "Only invalid subjects can be restored.",
  6012: "Restoration stake must match or exceed the previous dispute total.",
  6018: "Wait for the voting period to end before resolving.",
  6019: "The voting period has ended. You can no longer vote on this dispute.",
  6020: "Jurors cannot vote on disputes involving their own subjects.",
  6021: "You have already cast your vote on this dispute.",
  6027: "This reward has already been claimed.",
};

/**
 * Get help text for an error code
 */
export function getErrorHelp(error: unknown): string | null {
  const parsed = getErrorDetails(error);
  if (parsed.code && ERROR_HELP[parsed.code]) {
    return ERROR_HELP[parsed.code];
  }
  return null;
}
