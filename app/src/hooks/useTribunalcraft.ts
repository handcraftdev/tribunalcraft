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

/**
 * React hook wrapper for TribunalCraft SDK (V2)
 * Integrates with Solana wallet adapter for seamless wallet management
 */
export const useTribunalcraft = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [client, setClient] = useState<TribunalCraftClient | null>(null);

  // Initialize client when connection changes
  // Enable simulation in development to help debug transaction failures
  useEffect(() => {
    const isDev = process.env.NODE_ENV === "development";
    const newClient = new TribunalCraftClient({
      connection,
      simulateFirst: isDev,
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
    return client.createDefenderPool(initialAmount, maxBond);
  }, [client]);

  const depositDefenderPool = useCallback(async (amount: BN) => {
    if (!client) throw new Error("Client not initialized");
    return client.depositDefenderPool(amount);
  }, [client]);

  const withdrawDefenderPool = useCallback(async (amount: BN) => {
    if (!client) throw new Error("Client not initialized");
    return client.withdrawDefenderPool(amount);
  }, [client]);

  // ===========================================================================
  // Subject Management
  // ===========================================================================

  const createSubject = useCallback(async (params: {
    subjectId: PublicKey;
    detailsCid: string;
    matchMode?: boolean;
    votingPeriod: BN;
  }) => {
    if (!client) throw new Error("Client not initialized");
    return client.createSubject(params);
  }, [client]);

  const addBondDirect = useCallback(async (subjectId: PublicKey, amount: BN) => {
    if (!client) throw new Error("Client not initialized");
    return client.addBondDirect(subjectId, amount);
  }, [client]);

  const addBondFromPool = useCallback(async (subjectId: PublicKey, amount: BN) => {
    if (!client) throw new Error("Client not initialized");
    return client.addBondFromPool(subjectId, amount);
  }, [client]);

  // ===========================================================================
  // Juror Management
  // ===========================================================================

  const registerJuror = useCallback(async (stakeAmount: BN) => {
    if (!client) throw new Error("Client not initialized");
    return client.registerJuror(stakeAmount);
  }, [client]);

  const addJurorStake = useCallback(async (amount: BN) => {
    if (!client) throw new Error("Client not initialized");
    return client.addJurorStake(amount);
  }, [client]);

  const withdrawJurorStake = useCallback(async (amount: BN) => {
    if (!client) throw new Error("Client not initialized");
    return client.withdrawJurorStake(amount);
  }, [client]);

  const unregisterJuror = useCallback(async () => {
    if (!client) throw new Error("Client not initialized");
    return client.unregisterJuror();
  }, [client]);

  // ===========================================================================
  // Dispute Management
  // ===========================================================================

  const createDispute = useCallback(async (params: {
    subjectId: PublicKey;
    disputeType: DisputeType;
    detailsCid: string;
    stake: BN;
  }) => {
    if (!client) throw new Error("Client not initialized");
    return client.createDispute(params);
  }, [client]);

  const joinChallengers = useCallback(async (params: {
    subjectId: PublicKey;
    detailsCid: string;
    stake: BN;
  }) => {
    if (!client) throw new Error("Client not initialized");
    return client.joinChallengers(params);
  }, [client]);

  const addChallengerStake = useCallback(async (amount: BN) => {
    if (!client) throw new Error("Client not initialized");
    return client.addChallengerStake(amount);
  }, [client]);

  const withdrawChallengerStake = useCallback(async (amount: BN) => {
    if (!client) throw new Error("Client not initialized");
    return client.withdrawChallengerStake(amount);
  }, [client]);

  const submitRestore = useCallback(async (params: {
    subjectId: PublicKey;
    disputeType: DisputeType;
    detailsCid: string;
    stakeAmount: BN;
  }) => {
    if (!client) throw new Error("Client not initialized");
    return client.submitRestore(params);
  }, [client]);

  // ===========================================================================
  // Voting
  // ===========================================================================

  const voteOnDispute = useCallback(async (
    subjectId: PublicKey,
    choice: VoteChoice,
    stakeAllocation: BN,
    rationaleCid: string = ""
  ) => {
    if (!client) throw new Error("Client not initialized");
    return client.voteOnDispute({
      subjectId,
      choice,
      stakeAllocation,
      rationaleCid,
    });
  }, [client]);

  const voteOnRestore = useCallback(async (
    subjectId: PublicKey,
    choice: RestoreVoteChoice,
    stakeAllocation: BN,
    rationaleCid: string = ""
  ) => {
    if (!client) throw new Error("Client not initialized");
    return client.voteOnRestore({
      subjectId,
      choice,
      stakeAllocation,
      rationaleCid,
    });
  }, [client]);

  // ===========================================================================
  // Resolution
  // ===========================================================================

  const resolveDispute = useCallback(async (subjectId: PublicKey) => {
    if (!client) throw new Error("Client not initialized");
    return client.resolveDispute({ subjectId });
  }, [client]);

  // ===========================================================================
  // Reward Claims
  // ===========================================================================

  const claimJuror = useCallback(async (subjectId: PublicKey, round: number) => {
    if (!client) throw new Error("Client not initialized");
    return client.claimJuror({ subjectId, round });
  }, [client]);

  const claimChallenger = useCallback(async (subjectId: PublicKey, round: number) => {
    if (!client) throw new Error("Client not initialized");
    return client.claimChallenger({ subjectId, round });
  }, [client]);

  const claimDefender = useCallback(async (subjectId: PublicKey, round: number) => {
    if (!client) throw new Error("Client not initialized");
    return client.claimDefender({ subjectId, round });
  }, [client]);

  const unlockJurorStake = useCallback(async (subjectId: PublicKey, round: number) => {
    if (!client) throw new Error("Client not initialized");
    return client.unlockJurorStake({ subjectId, round });
  }, [client]);

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
    return client.closeJurorRecord({ subjectId, round });
  }, [client]);

  const closeChallengerRecord = useCallback(async (subjectId: PublicKey, round: number) => {
    if (!client) throw new Error("Client not initialized");
    return client.closeChallengerRecord({ subjectId, round });
  }, [client]);

  const closeDefenderRecord = useCallback(async (subjectId: PublicKey, round: number) => {
    if (!client) throw new Error("Client not initialized");
    return client.closeDefenderRecord({ subjectId, round });
  }, [client]);

  const batchCloseRecords = useCallback(async (records: Array<{
    type: "juror" | "challenger" | "defender";
    subjectId: PublicKey;
    round: number;
  }>) => {
    if (!client) throw new Error("Client not initialized");
    return client.batchCloseRecords(records);
  }, [client]);

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
