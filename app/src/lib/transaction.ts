"use client";

import {
  Connection,
  Transaction,
  VersionedTransaction,
  SendTransactionError,
  TransactionSignature,
} from "@solana/web3.js";
import { AnchorError, ProgramError } from "@coral-xyz/anchor";

// Program error codes from IDL
const PROGRAM_ERRORS: Record<number, { name: string; message: string }> = {
  6000: { name: "Unauthorized", message: "You are not authorized to perform this action" },
  6001: { name: "InvalidConfig", message: "Invalid configuration parameter" },
  6002: { name: "StakeBelowMinimum", message: "Stake amount is below the minimum required" },
  6003: { name: "InsufficientAvailableStake", message: "You don't have enough available stake" },
  6004: { name: "InsufficientHeldStake", message: "Insufficient held stake for this operation" },
  6005: { name: "StakeStillLocked", message: "Your stake is still locked and cannot be withdrawn yet" },
  6006: { name: "BondBelowMinimum", message: "Bond amount is below the minimum required" },
  6007: { name: "BondExceedsAvailable", message: "Bond amount exceeds your available stake" },
  6008: { name: "SubjectCannotBeStaked", message: "This subject cannot accept additional stakes" },
  6009: { name: "SubjectCannotBeDisputed", message: "This subject cannot be disputed at this time" },
  6010: { name: "CannotSelfDispute", message: "You cannot dispute your own subject" },
  6011: { name: "DisputeAlreadyExists", message: "A dispute already exists for this subject" },
  6012: { name: "DisputeNotFound", message: "The dispute was not found" },
  6013: { name: "DisputeAlreadyResolved", message: "This dispute has already been resolved" },
  6014: { name: "VotingNotEnded", message: "The voting period has not ended yet" },
  6015: { name: "VotingEnded", message: "The voting period has already ended" },
  6016: { name: "CannotVoteOnOwnDispute", message: "You cannot vote on your own dispute" },
  6017: { name: "AlreadyVoted", message: "You have already voted on this dispute" },
  6018: { name: "VoteAllocationBelowMinimum", message: "Vote stake allocation is below the minimum" },
  6019: { name: "InvalidVoteChoice", message: "Invalid vote choice" },
  6020: { name: "JurorNotActive", message: "You must be an active juror to perform this action" },
  6021: { name: "JurorAlreadyRegistered", message: "You are already registered as a juror" },
  6022: { name: "ChallengerNotFound", message: "Challenger record not found" },
  6023: { name: "RewardAlreadyClaimed", message: "This reward has already been claimed" },
  6024: { name: "NotEligibleForReward", message: "You are not eligible for this reward" },
  6025: { name: "ReputationAlreadyProcessed", message: "Reputation has already been processed for this vote" },
  6026: { name: "ArithmeticOverflow", message: "Calculation error: arithmetic overflow" },
  6027: { name: "DivisionByZero", message: "Calculation error: division by zero" },
};

// Common Solana errors
const SOLANA_ERRORS: Record<string, string> = {
  "Blockhash not found": "Transaction expired. Please try again.",
  "insufficient lamports": "Insufficient SOL balance to complete this transaction",
  "insufficient funds": "Insufficient SOL balance to complete this transaction",
  "Transaction simulation failed": "Transaction simulation failed",
  "Account not found": "Required account not found on chain",
  "custom program error": "Program execution error",
  "AccountNotInitialized": "Account has not been initialized",
  "already in use": "This account is already in use",
};

export interface TransactionError {
  code: number | null;
  name: string;
  message: string;
  raw?: string;
}

export interface SimulationResult {
  success: boolean;
  error?: TransactionError;
  logs?: string[];
  unitsConsumed?: number;
}

/**
 * Parse an error from transaction simulation or execution
 */
export function parseTransactionError(error: unknown): TransactionError {
  // Handle Anchor errors
  if (error instanceof AnchorError) {
    const programError = PROGRAM_ERRORS[error.error.errorCode.number];
    if (programError) {
      return {
        code: error.error.errorCode.number,
        name: programError.name,
        message: programError.message,
        raw: error.message,
      };
    }
    return {
      code: error.error.errorCode.number,
      name: error.error.errorCode.code,
      message: error.error.errorMessage || error.message,
      raw: error.message,
    };
  }

  // Handle ProgramError
  if (error instanceof ProgramError) {
    const programError = PROGRAM_ERRORS[error.code];
    if (programError) {
      return {
        code: error.code,
        name: programError.name,
        message: programError.message,
        raw: error.message,
      };
    }
    return {
      code: error.code,
      name: "ProgramError",
      message: error.msg || error.message,
      raw: error.message,
    };
  }

  // Handle SendTransactionError
  if (error instanceof SendTransactionError) {
    const errorMsg = error.message;

    // Try to extract custom program error code
    const customErrorMatch = errorMsg.match(/custom program error: 0x([0-9a-fA-F]+)/);
    if (customErrorMatch) {
      const errorCode = parseInt(customErrorMatch[1], 16);
      const programError = PROGRAM_ERRORS[errorCode];
      if (programError) {
        return {
          code: errorCode,
          name: programError.name,
          message: programError.message,
          raw: errorMsg,
        };
      }
    }

    // Check for known Solana errors
    for (const [key, message] of Object.entries(SOLANA_ERRORS)) {
      if (errorMsg.toLowerCase().includes(key.toLowerCase())) {
        return {
          code: null,
          name: key,
          message,
          raw: errorMsg,
        };
      }
    }

    return {
      code: null,
      name: "TransactionError",
      message: errorMsg,
      raw: errorMsg,
    };
  }

  // Handle generic Error
  if (error instanceof Error) {
    const errorMsg = error.message;

    // Try to extract custom program error code
    const customErrorMatch = errorMsg.match(/custom program error: 0x([0-9a-fA-F]+)/);
    if (customErrorMatch) {
      const errorCode = parseInt(customErrorMatch[1], 16);
      const programError = PROGRAM_ERRORS[errorCode];
      if (programError) {
        return {
          code: errorCode,
          name: programError.name,
          message: programError.message,
          raw: errorMsg,
        };
      }
    }

    // Try to match by error name in message
    for (const [code, err] of Object.entries(PROGRAM_ERRORS)) {
      if (errorMsg.includes(err.name)) {
        return {
          code: parseInt(code),
          name: err.name,
          message: err.message,
          raw: errorMsg,
        };
      }
    }

    // Check for known Solana errors
    for (const [key, message] of Object.entries(SOLANA_ERRORS)) {
      if (errorMsg.toLowerCase().includes(key.toLowerCase())) {
        return {
          code: null,
          name: key,
          message,
          raw: errorMsg,
        };
      }
    }

    // Check for insufficient balance
    if (errorMsg.includes("0x1") || errorMsg.includes("insufficient")) {
      return {
        code: null,
        name: "InsufficientFunds",
        message: "Insufficient SOL balance to complete this transaction",
        raw: errorMsg,
      };
    }

    return {
      code: null,
      name: "Error",
      message: errorMsg,
      raw: errorMsg,
    };
  }

  // Unknown error type
  return {
    code: null,
    name: "UnknownError",
    message: String(error),
    raw: String(error),
  };
}

/**
 * Simulate a transaction before sending
 */
export async function simulateTransaction(
  connection: Connection,
  transaction: Transaction | VersionedTransaction
): Promise<SimulationResult> {
  try {
    let simulation;

    if (transaction instanceof VersionedTransaction) {
      simulation = await connection.simulateTransaction(transaction, {
        sigVerify: false,
        replaceRecentBlockhash: true,
      });
    } else {
      simulation = await connection.simulateTransaction(transaction, undefined, true);
    }

    if (simulation.value.err) {
      // Parse the simulation error
      const errObj = simulation.value.err;

      // Handle InstructionError format
      if (typeof errObj === "object" && "InstructionError" in errObj) {
        const [_idx, instructionError] = (errObj as any).InstructionError;

        if (typeof instructionError === "object" && "Custom" in instructionError) {
          const errorCode = instructionError.Custom;
          const programError = PROGRAM_ERRORS[errorCode];

          if (programError) {
            return {
              success: false,
              error: {
                code: errorCode,
                name: programError.name,
                message: programError.message,
                raw: JSON.stringify(errObj),
              },
              logs: simulation.value.logs || undefined,
              unitsConsumed: simulation.value.unitsConsumed || undefined,
            };
          }
        }
      }

      // Try to find error in logs
      const logs = simulation.value.logs || [];
      for (const log of logs) {
        // Check for "Error Code:" format in logs
        const errorCodeMatch = log.match(/Error Code: (\w+)/);
        if (errorCodeMatch) {
          const errorName = errorCodeMatch[1];
          for (const [code, err] of Object.entries(PROGRAM_ERRORS)) {
            if (err.name === errorName) {
              return {
                success: false,
                error: {
                  code: parseInt(code),
                  name: err.name,
                  message: err.message,
                  raw: log,
                },
                logs,
                unitsConsumed: simulation.value.unitsConsumed || undefined,
              };
            }
          }
        }

        // Check for custom program error in hex
        const customMatch = log.match(/custom program error: 0x([0-9a-fA-F]+)/i);
        if (customMatch) {
          const errorCode = parseInt(customMatch[1], 16);
          const programError = PROGRAM_ERRORS[errorCode];
          if (programError) {
            return {
              success: false,
              error: {
                code: errorCode,
                name: programError.name,
                message: programError.message,
                raw: log,
              },
              logs,
              unitsConsumed: simulation.value.unitsConsumed || undefined,
            };
          }
        }
      }

      return {
        success: false,
        error: {
          code: null,
          name: "SimulationFailed",
          message: "Transaction simulation failed",
          raw: JSON.stringify(errObj),
        },
        logs,
        unitsConsumed: simulation.value.unitsConsumed || undefined,
      };
    }

    return {
      success: true,
      logs: simulation.value.logs || undefined,
      unitsConsumed: simulation.value.unitsConsumed || undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: parseTransactionError(error),
    };
  }
}

/**
 * Execute a transaction with simulation
 */
export async function executeWithSimulation<T>(
  execute: () => Promise<T>,
  options?: {
    skipSimulation?: boolean;
  }
): Promise<T> {
  try {
    return await execute();
  } catch (error) {
    const parsed = parseTransactionError(error);
    throw new TribunalError(parsed);
  }
}

/**
 * Custom error class with parsed error info
 */
export class TribunalError extends Error {
  code: number | null;
  errorName: string;
  raw?: string;

  constructor(error: TransactionError) {
    super(error.message);
    this.name = "TribunalError";
    this.code = error.code;
    this.errorName = error.name;
    this.raw = error.raw;
  }
}
