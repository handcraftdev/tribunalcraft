"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  TribunalCraftClient,
  pda,
  // Event parsing functions
  fetchClaimHistory,
  getClaimSummaryFromHistory,
  // Re-export types from SDK
  type ProtocolConfig,
  type DefenderPool,
  type ChallengerPool,
  type JurorPool,
  type Subject,
  type Dispute,
  type Escrow,
  type RoundResult,
  type JurorRecord,
  type ChallengerRecord,
  type DefenderRecord,
  type DisputeType,
  type VoteChoice,
  type RestoreVoteChoice,
  type TransactionResult,
  type SimulationResult,
  type UserActivity,
  // Reward types
  type JurorRewardBreakdown,
  type ChallengerRewardBreakdown,
  type DefenderRewardBreakdown,
  type UserRewardSummary,
  // Event types
  type RewardClaimedEvent,
  type ClaimRole,
} from "@tribunalcraft/sdk";
import { BN } from "@coral-xyz/anchor";

// Supabase sync functions (fire-and-forget after successful TX)
import {
  syncAfterCreateSubject,
  syncAfterAddBond,
  syncAfterCreateDispute,
  syncAfterJoinChallengers,
  syncAfterVote,
  syncAfterResolve,
  syncAfterResolveVerified,
  syncAfterClaimJuror,
  syncAfterClaimChallenger,
  syncAfterClaimDefender,
  syncAfterUnlockJurorStake,
  syncAfterRegisterJuror,
  syncAfterJurorStakeChange,
  syncAfterCreateDefenderPool,
  syncAfterDefenderPoolChange,
  syncAfterChallengerStakeChange,
  syncAfterSubmitRestore,
  syncTransaction, // Sync events from transaction
  // Pre-close sync functions (MUST await before closing)
  syncBeforeCloseJurorRecord,
  syncBeforeCloseChallengerRecord,
  syncBeforeCloseDefenderRecord,
  syncBeforeBatchClose,
  // Mark as closed functions
  markRecordClosed,
  markRecordsClosed,
} from "@/lib/supabase/sync";

/**
 * React hook wrapper for TribunalCraft SDK (V2)
 * Integrates with Solana wallet adapter for seamless wallet management
 */
export const useTribunalcraft = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [client, setClient] = useState<TribunalCraftClient | null>(null);

  // Initialize client when connection changes
  // Enable simulation to catch errors before submitting transactions
  useEffect(() => {
    const newClient = new TribunalCraftClient({
      connection,
      simulateFirst: true, // Always simulate to provide better error messages
    });
    setClient(newClient);
  }, [connection]);

  // Update wallet in client when wallet changes
  useEffect(() => {
    if (client && wallet.publicKey && wallet.signTransaction && wallet.signAllTransactions) {
      // Cast to any to bypass Anchor's payer requirement (not needed for web wallets)
      const anchorWallet = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
      } as any;
      client.setWallet(anchorWallet);
    }
  }, [client, wallet.publicKey, wallet.signTransaction, wallet.signAllTransactions]);

  // ===========================================================================
  // PDA Derivations
  // ===========================================================================

  const getDefenderPoolPDA = useCallback((owner: PublicKey) => {
    return pda.defenderPool(owner);
  }, []);

  const getChallengerPoolPDA = useCallback((owner: PublicKey) => {
    return pda.challengerPool(owner);
  }, []);

  const getJurorPoolPDA = useCallback((owner: PublicKey) => {
    return pda.jurorPool(owner);
  }, []);

  const getSubjectPDA = useCallback((subjectId: PublicKey) => {
    return pda.subject(subjectId);
  }, []);

  const getDisputePDA = useCallback((subjectId: PublicKey) => {
    return pda.dispute(subjectId);
  }, []);

  const getEscrowPDA = useCallback((subjectId: PublicKey) => {
    return pda.escrow(subjectId);
  }, []);

  const getDefenderRecordPDA = useCallback((subjectId: PublicKey, defender: PublicKey, round: number) => {
    return pda.defenderRecord(subjectId, defender, round);
  }, []);

  const getChallengerRecordPDA = useCallback((subjectId: PublicKey, challenger: PublicKey, round: number) => {
    return pda.challengerRecord(subjectId, challenger, round);
  }, []);

  const getJurorRecordPDA = useCallback((subjectId: PublicKey, juror: PublicKey, round: number) => {
    return pda.jurorRecord(subjectId, juror, round);
  }, []);

  const getProtocolConfigPDA = useCallback(() => {
    return pda.protocolConfig();
  }, []);

  // ===========================================================================
  // Protocol Config
  // ===========================================================================

  const initializeConfig = useCallback(async () => {
    if (!client) throw new Error("Client not initialized");
    return client.initializeConfig();
  }, [client]);

  const fetchProtocolConfig = useCallback(async () => {
    if (!client) return null;
    return client.fetchProtocolConfig();
  }, [client]);

  // ===========================================================================
  // Defender Pool Management
  // ===========================================================================

  const createDefenderPool = useCallback(async (initialAmount: BN, maxBond: BN = new BN(0)) => {
    if (!client) throw new Error("Client not initialized");
    const result = await client.createDefenderPool(initialAmount, maxBond);
    // Sync fires on success (throws on failure)
    if (wallet.publicKey) {
      syncAfterCreateDefenderPool(connection, wallet.publicKey);
    }
    return result;
  }, [client, connection, wallet.publicKey]);

  const depositDefenderPool = useCallback(async (amount: BN) => {
    if (!client) throw new Error("Client not initialized");
    const result = await client.depositDefenderPool(amount);
    if (wallet.publicKey) {
      syncAfterDefenderPoolChange(connection, wallet.publicKey);
    }
    return result;
  }, [client, connection, wallet.publicKey]);

  const withdrawDefenderPool = useCallback(async (amount: BN) => {
    if (!client) throw new Error("Client not initialized");
    const result = await client.withdrawDefenderPool(amount);
    if (wallet.publicKey) {
      syncAfterDefenderPoolChange(connection, wallet.publicKey);
    }
    return result;
  }, [client, connection, wallet.publicKey]);

  const updateMaxBond = useCallback(async (newMaxBond: BN) => {
    if (!client) throw new Error("Client not initialized");
    const result = await client.updateMaxBond(newMaxBond);
    if (wallet.publicKey) {
      syncAfterDefenderPoolChange(connection, wallet.publicKey);
    }
    return result;
  }, [client, connection, wallet.publicKey]);

  // ===========================================================================
  // Subject Management
  // ===========================================================================

  const createSubject = useCallback(async (params: {
    subjectId: PublicKey;
    detailsCid: string;
    matchMode?: boolean;
    votingPeriod: BN;
    initialBond?: BN;
  }) => {
    if (!client) throw new Error("Client not initialized");
    const result = await client.createSubject(params);
    // Fire-and-forget sync to Supabase (SDK throws on failure)
    if (wallet.publicKey) {
      syncAfterCreateSubject(connection, params.subjectId, wallet.publicKey);
    }
    // Sync events from transaction
    if (result.signature) {
      syncTransaction(result.signature);
    }
    return result;
  }, [client, connection, wallet.publicKey]);

  const addBondDirect = useCallback(async (subjectId: PublicKey, amount: BN, round: number = 0) => {
    if (!client) throw new Error("Client not initialized");
    const result = await client.addBondDirect(subjectId, amount);
    if (wallet.publicKey) {
      syncAfterAddBond(connection, subjectId, wallet.publicKey, round);
    }
    return result;
  }, [client, connection, wallet.publicKey]);

  const addBondFromPool = useCallback(async (subjectId: PublicKey, amount: BN, round: number = 0) => {
    if (!client) throw new Error("Client not initialized");
    const result = await client.addBondFromPool(subjectId, amount);
    if (wallet.publicKey) {
      syncAfterAddBond(connection, subjectId, wallet.publicKey, round);
    }
    return result;
  }, [client, connection, wallet.publicKey]);

  // ===========================================================================
  // Juror Management
  // ===========================================================================

  const registerJuror = useCallback(async (stakeAmount: BN) => {
    if (!client) throw new Error("Client not initialized");
    const result = await client.registerJuror(stakeAmount);
    if (wallet.publicKey) {
      syncAfterRegisterJuror(connection, wallet.publicKey);
    }
    return result;
  }, [client, connection, wallet.publicKey]);

  const addJurorStake = useCallback(async (amount: BN) => {
    if (!client) throw new Error("Client not initialized");
    const result = await client.addJurorStake(amount);
    if (wallet.publicKey) {
      syncAfterJurorStakeChange(connection, wallet.publicKey);
    }
    return result;
  }, [client, connection, wallet.publicKey]);

  const withdrawJurorStake = useCallback(async (amount: BN) => {
    if (!client) throw new Error("Client not initialized");
    const result = await client.withdrawJurorStake(amount);
    if (wallet.publicKey) {
      syncAfterJurorStakeChange(connection, wallet.publicKey);
    }
    return result;
  }, [client, connection, wallet.publicKey]);

  const unregisterJuror = useCallback(async () => {
    if (!client) throw new Error("Client not initialized");
    const result = await client.unregisterJuror();
    if (wallet.publicKey) {
      syncAfterJurorStakeChange(connection, wallet.publicKey);
    }
    return result;
  }, [client, connection, wallet.publicKey]);

  // ===========================================================================
  // Dispute Management
  // ===========================================================================

  const createDispute = useCallback(async (params: {
    subjectId: PublicKey;
    disputeType: DisputeType;
    detailsCid: string;
    stake: BN;
    round?: number;
  }) => {
    if (!client) throw new Error("Client not initialized");
    const result = await client.createDispute(params);
    if (wallet.publicKey) {
      syncAfterCreateDispute(connection, params.subjectId, wallet.publicKey, params.round ?? 0);
    }
    // Sync events from transaction
    if (result.signature) {
      syncTransaction(result.signature);
    }
    return result;
  }, [client, connection, wallet.publicKey]);

  const joinChallengers = useCallback(async (params: {
    subjectId: PublicKey;
    detailsCid: string;
    stake: BN;
    round?: number;
  }) => {
    if (!client) throw new Error("Client not initialized");
    const result = await client.joinChallengers(params);
    if (wallet.publicKey) {
      syncAfterJoinChallengers(connection, params.subjectId, wallet.publicKey, params.round ?? 0);
    }
    // Sync events from transaction
    if (result.signature) {
      syncTransaction(result.signature);
    }
    return result;
  }, [client, connection, wallet.publicKey]);

  const addChallengerStake = useCallback(async (amount: BN) => {
    if (!client) throw new Error("Client not initialized");
    const result = await client.addChallengerStake(amount);
    if (wallet.publicKey) {
      syncAfterChallengerStakeChange(connection, wallet.publicKey);
    }
    return result;
  }, [client, connection, wallet.publicKey]);

  const withdrawChallengerStake = useCallback(async (amount: BN) => {
    if (!client) throw new Error("Client not initialized");
    const result = await client.withdrawChallengerStake(amount);
    if (wallet.publicKey) {
      syncAfterChallengerStakeChange(connection, wallet.publicKey);
    }
    return result;
  }, [client, connection, wallet.publicKey]);

  const submitRestore = useCallback(async (params: {
    subjectId: PublicKey;
    disputeType: DisputeType;
    detailsCid: string;
    stakeAmount: BN;
  }) => {
    if (!client) throw new Error("Client not initialized");
    const result = await client.submitRestore(params);
    if (wallet.publicKey) {
      syncAfterSubmitRestore(connection, params.subjectId, wallet.publicKey);
    }
    return result;
  }, [client, connection, wallet.publicKey]);

  // ===========================================================================
  // Voting
  // ===========================================================================

  const voteOnDispute = useCallback(async (
    subjectId: PublicKey,
    choice: VoteChoice,
    stakeAllocation: BN,
    rationaleCid: string = "",
    round: number = 0
  ) => {
    if (!client) throw new Error("Client not initialized");
    const result = await client.voteOnDispute({
      subjectId,
      choice,
      stakeAllocation,
      rationaleCid,
    });
    if (wallet.publicKey) {
      syncAfterVote(connection, subjectId, wallet.publicKey, round);
    }
    // Sync events from transaction
    if (result.signature) {
      syncTransaction(result.signature);
    }
    return result;
  }, [client, connection, wallet.publicKey]);

  const voteOnRestore = useCallback(async (
    subjectId: PublicKey,
    choice: RestoreVoteChoice,
    stakeAllocation: BN,
    rationaleCid: string = "",
    round: number = 0
  ) => {
    if (!client) throw new Error("Client not initialized");
    const result = await client.voteOnRestore({
      subjectId,
      choice,
      stakeAllocation,
      rationaleCid,
    });
    if (wallet.publicKey) {
      syncAfterVote(connection, subjectId, wallet.publicKey, round);
    }
    // Sync events from transaction
    if (result.signature) {
      syncTransaction(result.signature);
    }
    return result;
  }, [client, connection, wallet.publicKey]);

  const addToVote = useCallback(async (
    subjectId: PublicKey,
    round: number,
    additionalStake: BN
  ) => {
    if (!client) throw new Error("Client not initialized");
    const result = await client.addToVote({
      subjectId,
      round,
      additionalStake,
    });
    if (wallet.publicKey) {
      syncAfterVote(connection, subjectId, wallet.publicKey, round);
    }
    // Sync events from transaction
    if (result.signature) {
      syncTransaction(result.signature);
    }
    return result;
  }, [client, connection, wallet.publicKey]);

  // ===========================================================================
  // Resolution
  // ===========================================================================

  const resolveDispute = useCallback(async (subjectId: PublicKey) => {
    if (!client) throw new Error("Client not initialized");
    const result = await client.resolveDispute({ subjectId });
    syncAfterResolve(connection, subjectId);
    // Sync events from transaction
    if (result.signature) {
      syncTransaction(result.signature);
    }
    return result;
  }, [client, connection]);

  // ===========================================================================
  // Reward Claims
  // ===========================================================================

  const claimJuror = useCallback(async (subjectId: PublicKey, round: number) => {
    if (!client) throw new Error("Client not initialized");
    const result = await client.claimJuror({ subjectId, round });
    if (wallet.publicKey) {
      syncAfterClaimJuror(connection, subjectId, wallet.publicKey, round);
    }
    // Sync events from transaction (RewardClaimedEvent)
    if (result.signature) {
      syncTransaction(result.signature);
    }
    return result;
  }, [client, connection, wallet.publicKey]);

  const claimChallenger = useCallback(async (subjectId: PublicKey, round: number) => {
    if (!client) throw new Error("Client not initialized");
    const result = await client.claimChallenger({ subjectId, round });
    if (wallet.publicKey) {
      syncAfterClaimChallenger(connection, subjectId, wallet.publicKey, round);
    }
    // Sync events from transaction (RewardClaimedEvent)
    if (result.signature) {
      syncTransaction(result.signature);
    }
    return result;
  }, [client, connection, wallet.publicKey]);

  const claimDefender = useCallback(async (subjectId: PublicKey, round: number) => {
    if (!client) throw new Error("Client not initialized");
    const result = await client.claimDefender({ subjectId, round });
    if (wallet.publicKey) {
      syncAfterClaimDefender(connection, subjectId, wallet.publicKey, round);
    }
    // Sync events from transaction (RewardClaimedEvent)
    if (result.signature) {
      syncTransaction(result.signature);
    }
    return result;
  }, [client, connection, wallet.publicKey]);

  const unlockJurorStake = useCallback(async (subjectId: PublicKey, round: number) => {
    if (!client) throw new Error("Client not initialized");
    const result = await client.unlockJurorStake({ subjectId, round });
    if (wallet.publicKey) {
      syncAfterUnlockJurorStake(connection, subjectId, wallet.publicKey, round);
    }
    // Sync events from transaction (StakeUnlockedEvent)
    if (result.signature) {
      syncTransaction(result.signature);
    }
    return result;
  }, [client, connection, wallet.publicKey]);

  const batchClaimRewards = useCallback(async (params: {
    jurorClaims?: Array<{ subjectId: PublicKey; round: number }>;
    challengerClaims?: Array<{ subjectId: PublicKey; round: number }>;
    defenderClaims?: Array<{ subjectId: PublicKey; round: number }>;
  }) => {
    if (!client) throw new Error("Client not initialized");
    return client.batchClaimRewards(params);
  }, [client]);

  // ===========================================================================
  // Cleanup (close records to reclaim rent)
  // ===========================================================================

  const closeJurorRecord = useCallback(async (subjectId: PublicKey, round: number) => {
    if (!client) throw new Error("Client not initialized");
    if (!wallet.publicKey) throw new Error("Wallet not connected");

    // Get record PDA for marking as closed
    const [recordPda] = pda.jurorRecord(subjectId, wallet.publicKey, round);

    // CRITICAL: Sync before closing to preserve historical data
    try {
      await syncBeforeCloseJurorRecord(subjectId, wallet.publicKey, round);
    } catch (err) {
      console.error("Pre-close sync failed, proceeding with close:", err);
    }

    // Close the record on-chain
    const result = await client.closeJurorRecord({ subjectId, round });

    // Mark as closed in Supabase (if transaction succeeded, there's a signature)
    if (result.signature) {
      markRecordClosed("jurorRecord", recordPda.toBase58()).catch(console.error);
    }

    return result;
  }, [client, wallet.publicKey]);

  const closeChallengerRecord = useCallback(async (subjectId: PublicKey, round: number) => {
    if (!client) throw new Error("Client not initialized");
    if (!wallet.publicKey) throw new Error("Wallet not connected");

    // Get record PDA for marking as closed
    const [recordPda] = pda.challengerRecord(subjectId, wallet.publicKey, round);

    // CRITICAL: Sync before closing to preserve historical data
    try {
      await syncBeforeCloseChallengerRecord(subjectId, wallet.publicKey, round);
    } catch (err) {
      console.error("Pre-close sync failed, proceeding with close:", err);
    }

    // Close the record on-chain
    const result = await client.closeChallengerRecord({ subjectId, round });

    // Mark as closed in Supabase (if transaction succeeded, there's a signature)
    if (result.signature) {
      markRecordClosed("challengerRecord", recordPda.toBase58()).catch(console.error);
    }

    return result;
  }, [client, wallet.publicKey]);

  const closeDefenderRecord = useCallback(async (subjectId: PublicKey, round: number) => {
    if (!client) throw new Error("Client not initialized");
    if (!wallet.publicKey) throw new Error("Wallet not connected");

    // Get record PDA for marking as closed
    const [recordPda] = pda.defenderRecord(subjectId, wallet.publicKey, round);

    // CRITICAL: Sync before closing to preserve historical data
    try {
      await syncBeforeCloseDefenderRecord(subjectId, wallet.publicKey, round);
    } catch (err) {
      console.error("Pre-close sync failed, proceeding with close:", err);
    }

    // Close the record on-chain
    const result = await client.closeDefenderRecord({ subjectId, round });

    // Mark as closed in Supabase (if transaction succeeded, there's a signature)
    if (result.signature) {
      markRecordClosed("defenderRecord", recordPda.toBase58()).catch(console.error);
    }

    return result;
  }, [client, wallet.publicKey]);

  const batchCloseRecords = useCallback(async (records: Array<{
    type: "juror" | "challenger" | "defender";
    subjectId: PublicKey;
    round: number;
  }>) => {
    if (!client) throw new Error("Client not initialized");
    if (!wallet.publicKey) throw new Error("Wallet not connected");

    // Prepare sync requests and record PDAs
    const syncRequests = records.map(r => {
      const typeMap = {
        juror: "jurorRecord" as const,
        challenger: "challengerRecord" as const,
        defender: "defenderRecord" as const,
      };
      return {
        type: typeMap[r.type],
        subjectId: r.subjectId,
        owner: wallet.publicKey!,
        round: r.round,
      };
    });

    // Get record PDAs for marking as closed
    const recordPdas = records.map(r => {
      const pdaFn = {
        juror: pda.jurorRecord,
        challenger: pda.challengerRecord,
        defender: pda.defenderRecord,
      }[r.type];
      const [recordPda] = pdaFn(r.subjectId, wallet.publicKey!, r.round);
      const typeMap = {
        juror: "jurorRecord" as const,
        challenger: "challengerRecord" as const,
        defender: "defenderRecord" as const,
      };
      return { recordType: typeMap[r.type], recordId: recordPda.toBase58() };
    });

    // CRITICAL: Sync before closing to preserve historical data
    try {
      await syncBeforeBatchClose(syncRequests);
    } catch (err) {
      console.error("Pre-close sync failed, proceeding with close:", err);
    }

    // Close records on-chain
    const result = await client.batchCloseRecords(records);

    // Mark all as closed in Supabase (if transaction succeeded, there's a signature)
    if (result.signature) {
      markRecordsClosed(recordPdas).catch(console.error);
    }

    return result;
  }, [client, wallet.publicKey]);

  // ===========================================================================
  // Collect All (batch operations)
  // ===========================================================================

  const scanCollectableRecords = useCallback(async () => {
    if (!client) throw new Error("Client not initialized");
    return client.scanCollectableRecords();
  }, [client]);

  const collectAll = useCallback(async () => {
    if (!client) throw new Error("Client not initialized");
    return client.collectAll();
  }, [client]);

  // ===========================================================================
  // Fetch Single Accounts
  // ===========================================================================

  const fetchDefenderPool = useCallback(async (defenderPool: PublicKey) => {
    if (!client) return null;
    return client.fetchDefenderPool(defenderPool);
  }, [client]);

  const fetchDefenderPoolByOwner = useCallback(async (owner: PublicKey) => {
    if (!client) return null;
    return client.fetchDefenderPoolByOwner(owner);
  }, [client]);

  const fetchChallengerPool = useCallback(async (challengerPool: PublicKey) => {
    if (!client) return null;
    return client.fetchChallengerPool(challengerPool);
  }, [client]);

  const fetchChallengerPoolByOwner = useCallback(async (owner: PublicKey) => {
    if (!client) return null;
    return client.fetchChallengerPoolByOwner(owner);
  }, [client]);

  const fetchJurorPool = useCallback(async (jurorPool: PublicKey) => {
    if (!client) return null;
    return client.fetchJurorPool(jurorPool);
  }, [client]);

  const fetchJurorPoolByOwner = useCallback(async (owner: PublicKey) => {
    if (!client) return null;
    return client.fetchJurorPoolByOwner(owner);
  }, [client]);

  const fetchSubject = useCallback(async (subject: PublicKey) => {
    if (!client) return null;
    return client.fetchSubject(subject);
  }, [client]);

  const fetchSubjectById = useCallback(async (subjectId: PublicKey) => {
    if (!client) return null;
    return client.fetchSubjectById(subjectId);
  }, [client]);

  const fetchDispute = useCallback(async (dispute: PublicKey) => {
    if (!client) return null;
    return client.fetchDispute(dispute);
  }, [client]);

  const fetchDisputeBySubjectId = useCallback(async (subjectId: PublicKey) => {
    if (!client) return null;
    const [disputePda] = pda.dispute(subjectId);
    return client.fetchDispute(disputePda);
  }, [client]);

  const fetchEscrow = useCallback(async (escrow: PublicKey) => {
    if (!client) return null;
    return client.fetchEscrow(escrow);
  }, [client]);

  const fetchEscrowBySubjectId = useCallback(async (subjectId: PublicKey) => {
    if (!client) return null;
    return client.fetchEscrowBySubjectId(subjectId);
  }, [client]);

  const fetchJurorRecord = useCallback(async (jurorRecord: PublicKey) => {
    if (!client) return null;
    return client.fetchJurorRecord(jurorRecord);
  }, [client]);

  const fetchJurorRecordBySubjectAndJuror = useCallback(async (
    subjectId: PublicKey,
    juror: PublicKey,
    round: number
  ) => {
    if (!client) return null;
    return client.fetchJurorRecordBySubjectAndJuror(subjectId, juror, round);
  }, [client]);

  const fetchChallengerRecord = useCallback(async (challengerRecord: PublicKey) => {
    if (!client) return null;
    return client.fetchChallengerRecord(challengerRecord);
  }, [client]);

  const fetchChallengerRecordBySubject = useCallback(async (
    subjectId: PublicKey,
    challenger: PublicKey,
    round: number
  ) => {
    if (!client) return null;
    return client.fetchChallengerRecordBySubject(subjectId, challenger, round);
  }, [client]);

  const fetchDefenderRecord = useCallback(async (defenderRecord: PublicKey) => {
    if (!client) return null;
    return client.fetchDefenderRecord(defenderRecord);
  }, [client]);

  const fetchDefenderRecordBySubject = useCallback(async (
    subjectId: PublicKey,
    defender: PublicKey,
    round: number
  ) => {
    if (!client) return null;
    return client.fetchDefenderRecordBySubject(subjectId, defender, round);
  }, [client]);

  // ===========================================================================
  // Fetch All Accounts
  // ===========================================================================

  const fetchAllDefenderPools = useCallback(async () => {
    if (!client) return [];
    return client.fetchAllDefenderPools();
  }, [client]);

  const fetchAllChallengerPools = useCallback(async () => {
    if (!client) return [];
    return client.fetchAllChallengerPools();
  }, [client]);

  const fetchAllJurorPools = useCallback(async () => {
    if (!client) return [];
    return client.fetchAllJurorPools();
  }, [client]);

  const fetchAllSubjects = useCallback(async () => {
    if (!client) return [];
    return client.fetchAllSubjects();
  }, [client]);

  const fetchAllDisputes = useCallback(async () => {
    if (!client) return [];
    return client.fetchAllDisputes();
  }, [client]);

  const fetchAllEscrows = useCallback(async () => {
    if (!client) return [];
    return client.fetchAllEscrows();
  }, [client]);

  const fetchAllJurorRecords = useCallback(async () => {
    if (!client) return [];
    return client.fetchAllJurorRecords();
  }, [client]);

  const fetchAllChallengerRecords = useCallback(async () => {
    if (!client) return [];
    return client.fetchAllChallengerRecords();
  }, [client]);

  const fetchAllDefenderRecords = useCallback(async () => {
    if (!client) return [];
    return client.fetchAllDefenderRecords();
  }, [client]);

  // ===========================================================================
  // Fetch Filtered
  // ===========================================================================

  const fetchJurorRecordsBySubject = useCallback(async (subjectId: PublicKey) => {
    if (!client) return [];
    return client.fetchJurorRecordsBySubject(subjectId);
  }, [client]);

  const fetchChallengerRecordsBySubject = useCallback(async (subjectId: PublicKey) => {
    if (!client) return [];
    return client.fetchChallengerRecordsBySubject(subjectId);
  }, [client]);

  const fetchDefenderRecordsBySubject = useCallback(async (subjectId: PublicKey) => {
    if (!client) return [];
    return client.fetchDefenderRecordsBySubject(subjectId);
  }, [client]);

  // ===========================================================================
  // Fetch Records by User
  // ===========================================================================

  const fetchJurorRecordsByJuror = useCallback(async (juror: PublicKey) => {
    if (!client) return [];
    return client.fetchJurorRecordsByJuror(juror);
  }, [client]);

  const fetchChallengerRecordsByChallenger = useCallback(async (challenger: PublicKey) => {
    if (!client) return [];
    return client.fetchChallengerRecordsByChallenger(challenger);
  }, [client]);

  const fetchDefenderRecordsByDefender = useCallback(async (defender: PublicKey) => {
    if (!client) return [];
    return client.fetchDefenderRecordsByDefender(defender);
  }, [client]);

  // ===========================================================================
  // Transaction History
  // ===========================================================================

  const fetchUserActivity = useCallback(async (user: PublicKey, options?: { limit?: number; before?: string }) => {
    if (!client) return [];
    return client.fetchUserActivity(user, options);
  }, [client]);

  // ===========================================================================
  // Batch Fetching - Parallel fetch for modal data
  // ===========================================================================

  /**
   * Fetch modal data in parallel using Promise.all
   * Fetches: dispute, escrow, and user's records (juror, challenger, defender)
   */
  const fetchModalData = useCallback(async (
    subjectId: PublicKey,
    disputeRound: number,
    userPubkey?: PublicKey | null
  ): Promise<{
    dispute: Dispute | null;
    escrow: Escrow | null;
    jurorRecord: JurorRecord | null;
    challengerRecord: ChallengerRecord | null;
    defenderRecord: DefenderRecord | null;
  }> => {
    if (!client) return {
      dispute: null,
      escrow: null,
      jurorRecord: null,
      challengerRecord: null,
      defenderRecord: null,
    };

    // Fetch all accounts in parallel
    const [dispute, escrow, jurorRecord, challengerRecord, defenderRecord] = await Promise.all([
      client.fetchDisputeBySubjectId(subjectId).catch(() => null),
      client.fetchEscrowBySubjectId(subjectId).catch(() => null),
      userPubkey
        ? client.fetchJurorRecordBySubjectAndJuror(subjectId, userPubkey, disputeRound).catch(() => null)
        : Promise.resolve(null),
      userPubkey
        ? client.fetchChallengerRecordBySubject(subjectId, userPubkey, disputeRound).catch(() => null)
        : Promise.resolve(null),
      userPubkey
        ? client.fetchDefenderRecordBySubject(subjectId, userPubkey, disputeRound).catch(() => null)
        : Promise.resolve(null),
    ]);

    return { dispute, escrow, jurorRecord, challengerRecord, defenderRecord };
  }, [client]);

  // ===========================================================================
  // Event Parsing (for closed records)
  // ===========================================================================

  /**
   * Fetch claim history for a user from transaction events
   * Use when record accounts are closed but you need claim details
   */
  const fetchUserClaimHistory = useCallback(async (
    user: PublicKey,
    options?: { limit?: number }
  ): Promise<RewardClaimedEvent[]> => {
    return fetchClaimHistory(connection, user, options);
  }, [connection]);

  /**
   * Get claim summary for a specific subject/round from transaction history
   * Returns claimed amounts even when record accounts are closed
   * Pass escrowAddress for efficient querying (queries escrow txs instead of all user txs)
   */
  const getClaimSummary = useCallback(async (
    claimer: PublicKey,
    subjectId: PublicKey,
    round: number,
    escrowAddress?: PublicKey
  ) => {
    return getClaimSummaryFromHistory(connection, claimer, subjectId, round, escrowAddress);
  }, [connection]);

  // ===========================================================================
  // Simulation Controls
  // ===========================================================================

  const setSimulateFirst = useCallback((enabled: boolean) => {
    if (client) {
      client.simulateFirst = enabled;
    }
  }, [client]);

  const getSimulateFirst = useCallback(() => {
    return client?.simulateFirst ?? false;
  }, [client]);

  return {
    client,
    program: client?.program ?? null,
    provider: client?.program?.provider ?? null,
    // PDAs
    getDefenderPoolPDA,
    getChallengerPoolPDA,
    getJurorPoolPDA,
    getSubjectPDA,
    getDisputePDA,
    getEscrowPDA,
    getDefenderRecordPDA,
    getChallengerRecordPDA,
    getJurorRecordPDA,
    getProtocolConfigPDA,
    // Protocol Config
    initializeConfig,
    fetchProtocolConfig,
    // Defender Pool
    createDefenderPool,
    depositDefenderPool,
    withdrawDefenderPool,
    updateMaxBond,
    // Subject
    createSubject,
    addBondDirect,
    addBondFromPool,
    // Juror
    registerJuror,
    addJurorStake,
    withdrawJurorStake,
    unregisterJuror,
    // Dispute
    createDispute,
    joinChallengers,
    addChallengerStake,
    withdrawChallengerStake,
    submitRestore,
    // Voting
    voteOnDispute,
    voteOnRestore,
    addToVote,
    // Resolution
    resolveDispute,
    // Rewards
    claimJuror,
    claimChallenger,
    claimDefender,
    unlockJurorStake,
    batchClaimRewards,
    // Close records (reclaim rent)
    closeJurorRecord,
    closeChallengerRecord,
    closeDefenderRecord,
    batchCloseRecords,
    // Collect all
    scanCollectableRecords,
    collectAll,
    // Fetch single
    fetchDefenderPool,
    fetchDefenderPoolByOwner,
    fetchChallengerPool,
    fetchChallengerPoolByOwner,
    fetchJurorPool,
    fetchJurorPoolByOwner,
    fetchSubject,
    fetchSubjectById,
    fetchDispute,
    fetchDisputeBySubjectId,
    fetchEscrow,
    fetchEscrowBySubjectId,
    fetchJurorRecord,
    fetchJurorRecordBySubjectAndJuror,
    fetchChallengerRecord,
    fetchChallengerRecordBySubject,
    fetchDefenderRecord,
    fetchDefenderRecordBySubject,
    // Fetch all
    fetchAllDefenderPools,
    fetchAllChallengerPools,
    fetchAllJurorPools,
    fetchAllSubjects,
    fetchAllDisputes,
    fetchAllEscrows,
    fetchAllJurorRecords,
    fetchAllChallengerRecords,
    fetchAllDefenderRecords,
    // Fetch filtered
    fetchJurorRecordsBySubject,
    fetchChallengerRecordsBySubject,
    fetchDefenderRecordsBySubject,
    // Fetch records by user
    fetchJurorRecordsByJuror,
    fetchChallengerRecordsByChallenger,
    fetchDefenderRecordsByDefender,
    // Transaction history
    fetchUserActivity,
    // Batch fetching
    fetchModalData,
    // Event parsing (for closed records)
    fetchUserClaimHistory,
    getClaimSummary,
    // Simulation
    setSimulateFirst,
    getSimulateFirst,
  };
};

// Re-export types from SDK for convenience
export type {
  ProtocolConfig,
  DefenderPool,
  ChallengerPool,
  JurorPool,
  Subject,
  Dispute,
  Escrow,
  RoundResult,
  JurorRecord,
  ChallengerRecord,
  DefenderRecord,
  DisputeType,
  VoteChoice,
  RestoreVoteChoice,
  TransactionResult,
  SimulationResult,
  UserActivity,
  // Reward types
  JurorRewardBreakdown,
  ChallengerRewardBreakdown,
  DefenderRewardBreakdown,
  UserRewardSummary,
  // Event types
  RewardClaimedEvent,
  ClaimRole,
};

// Re-export enums and helpers from SDK
export {
  SubjectStatusEnum,
  DisputeStatusEnum,
  ResolutionOutcomeEnum,
  DisputeTypeEnum,
  VoteChoiceEnum,
  RestoreVoteChoiceEnum,
  BondSourceEnum,
  isSubjectValid,
  isSubjectDisputed,
  isSubjectInvalid,
  isSubjectRestoring,
  isDisputeNone,
  isDisputePending,
  isDisputeResolved,
  isChallengerWins,
  isDefenderWins,
  isNoParticipation,
  getDisputeTypeName,
  getOutcomeName,
  getBondSourceName,
  PROGRAM_ID,
  MIN_JUROR_STAKE,
  MIN_CHALLENGER_BOND,
  MIN_DEFENDER_STAKE,
  BASE_CHALLENGER_BOND,
  STAKE_UNLOCK_BUFFER,
  TOTAL_FEE_BPS,
  JUROR_SHARE_BPS,
  WINNER_SHARE_BPS,
  CLAIM_GRACE_PERIOD,
  TREASURY_SWEEP_PERIOD,
  BOT_REWARD_BPS,
  // Reputation helpers
  REP_PRECISION,
  REP_100_PERCENT,
  INITIAL_REPUTATION,
  calculateMinBond,
  formatReputation,
  // Reward calculations
  calculateJurorReward,
  calculateChallengerReward,
  calculateDefenderReward,
  calculateUserRewards,
  isJurorRewardClaimable,
  isChallengerRewardClaimable,
  isDefenderRewardClaimable,
  lamportsToSol,
  // Event parsing (re-export for external use)
  fetchClaimHistory,
  fetchClaimHistoryForSubject,
  getClaimSummaryFromHistory,
  parseEventsFromTransaction,
} from "@tribunalcraft/sdk";
