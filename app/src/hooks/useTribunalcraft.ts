"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  TribunalCraftClient,
  pda,
  // Re-export types from SDK
  type ProtocolConfig,
  type DefenderPool,
  type Subject,
  type Dispute,
  type JurorAccount,
  type VoteRecord,
  type ChallengerAccount,
  type ChallengerRecord,
  type DefenderRecord,
  type DisputeType,
  type VoteChoice,
  type RestoreVoteChoice,
  type TransactionResult,
  type SimulationResult,
} from "@tribunalcraft/sdk";
import { BN } from "@coral-xyz/anchor";

/**
 * React hook wrapper for TribunalCraft SDK
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

  // PDA derivations (delegate to SDK)
  const getDefenderPoolPDA = useCallback((owner: PublicKey) => {
    return pda.defenderPool(owner);
  }, []);

  const getSubjectPDA = useCallback((subjectId: PublicKey) => {
    return pda.subject(subjectId);
  }, []);

  const getJurorPDA = useCallback((juror: PublicKey) => {
    return pda.jurorAccount(juror);
  }, []);

  const getDisputePDA = useCallback((subject: PublicKey, disputeCount: number) => {
    return pda.dispute(subject, disputeCount);
  }, []);

  const getChallengerPDA = useCallback((challenger: PublicKey) => {
    return pda.challengerAccount(challenger);
  }, []);

  const getChallengerRecordPDA = useCallback((dispute: PublicKey, challenger: PublicKey) => {
    return pda.challengerRecord(dispute, challenger);
  }, []);

  const getDefenderRecordPDA = useCallback((subject: PublicKey, defender: PublicKey) => {
    return pda.defenderRecord(subject, defender);
  }, []);

  const getVoteRecordPDA = useCallback((dispute: PublicKey, juror: PublicKey) => {
    return pda.voteRecord(dispute, juror);
  }, []);

  const getProtocolConfigPDA = useCallback(() => {
    return pda.protocolConfig();
  }, []);

  // Protocol Config
  const initializeConfig = useCallback(async () => {
    if (!client) throw new Error("Client not initialized");
    return client.initializeConfig();
  }, [client]);

  const fetchProtocolConfig = useCallback(async () => {
    if (!client) return null;
    return client.fetchProtocolConfig();
  }, [client]);

  // Pool Management
  const createPool = useCallback(async (initialStake: BN) => {
    if (!client) throw new Error("Client not initialized");
    return client.createPool(initialStake);
  }, [client]);

  const stakePool = useCallback(async (amount: BN) => {
    if (!client) throw new Error("Client not initialized");
    return client.stakePool(amount);
  }, [client]);

  const withdrawPool = useCallback(async (amount: BN) => {
    if (!client) throw new Error("Client not initialized");
    return client.withdrawPool(amount);
  }, [client]);

  // Subject Management
  const createSubject = useCallback(async (params: {
    subjectId: PublicKey;
    detailsCid: string;
    votingPeriod: BN;
    maxStake?: BN;
    matchMode?: boolean;
    stake?: BN;
    defenderPool?: PublicKey;
    freeCase?: boolean;
  }) => {
    if (!client) throw new Error("Client not initialized");
    return client.createSubject(params);
  }, [client]);

  const addToStake = useCallback(async (
    subject: PublicKey,
    stake: BN,
    proportionalDispute?: { dispute: PublicKey; treasury: PublicKey }
  ) => {
    if (!client) throw new Error("Client not initialized");
    return client.addToStake(subject, stake, proportionalDispute);
  }, [client]);

  // Juror Management
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

  // Dispute Management
  const submitDispute = useCallback(async (
    subject: PublicKey,
    subjectData: { disputeCount: number; defenderPool: PublicKey; poolOwner?: PublicKey },
    disputeType: DisputeType,
    detailsCid: string,
    bond: BN
  ) => {
    if (!client) throw new Error("Client not initialized");
    const isLinked = !subjectData.defenderPool.equals(PublicKey.default);
    return client.submitDispute({
      subject,
      disputeCount: subjectData.disputeCount,
      defenderPool: isLinked ? subjectData.defenderPool : undefined,
      poolOwner: isLinked ? subjectData.poolOwner : undefined,
      disputeType,
      detailsCid,
      bond,
    });
  }, [client]);

  const submitFreeDispute = useCallback(async (
    subject: PublicKey,
    subjectData: { disputeCount: number },
    disputeType: DisputeType,
    detailsCid: string
  ) => {
    if (!client) throw new Error("Client not initialized");
    return client.submitFreeDispute({
      subject,
      disputeCount: subjectData.disputeCount,
      disputeType,
      detailsCid,
    });
  }, [client]);

  const submitRestore = useCallback(async (
    subject: PublicKey,
    subjectData: { disputeCount: number },
    disputeType: DisputeType,
    detailsCid: string,
    stakeAmount: BN
  ) => {
    if (!client) throw new Error("Client not initialized");
    return client.submitRestore({
      subject,
      disputeCount: subjectData.disputeCount,
      disputeType,
      detailsCid,
      stakeAmount,
    });
  }, [client]);

  const addToDispute = useCallback(async (
    subject: PublicKey,
    dispute: PublicKey,
    defenderPool: PublicKey | null,
    poolOwner: PublicKey | null,
    detailsCid: string,
    bond: BN
  ) => {
    if (!client) throw new Error("Client not initialized");
    return client.addToDispute({
      subject,
      dispute,
      defenderPool: defenderPool ?? undefined,
      poolOwner: poolOwner ?? undefined,
      detailsCid,
      bond,
    });
  }, [client]);

  // Voting
  const voteOnDispute = useCallback(async (
    dispute: PublicKey,
    choice: VoteChoice,
    stakeAllocation: BN,
    rationaleCid: string = ""
  ) => {
    if (!client) throw new Error("Client not initialized");
    return client.voteOnDispute({
      dispute,
      choice,
      stakeAllocation,
      rationaleCid,
    });
  }, [client]);

  const voteOnRestore = useCallback(async (
    dispute: PublicKey,
    choice: RestoreVoteChoice,
    stakeAllocation: BN,
    rationaleCid: string = ""
  ) => {
    if (!client) throw new Error("Client not initialized");
    return client.voteOnRestore({
      dispute,
      choice,
      stakeAllocation,
      rationaleCid,
    });
  }, [client]);

  const addToVote = useCallback(async (dispute: PublicKey, additionalStake: BN) => {
    if (!client) throw new Error("Client not initialized");
    // Fetch dispute to get subject
    const disputeAccount = await client.fetchDispute(dispute);
    if (!disputeAccount) throw new Error("Dispute not found");
    return client.addToVote({
      dispute,
      subject: disputeAccount.subject,
      additionalStake,
    });
  }, [client]);

  // Resolution
  const resolveDispute = useCallback(async (dispute: PublicKey, subject: PublicKey) => {
    if (!client) throw new Error("Client not initialized");
    return client.resolveDispute({ dispute, subject });
  }, [client]);

  const unlockJurorStake = useCallback(async (dispute: PublicKey, voteRecord: PublicKey) => {
    if (!client) throw new Error("Client not initialized");
    return client.unlockJurorStake({ dispute, voteRecord });
  }, [client]);

  const batchUnlockStake = useCallback(async (unlocks: Array<{ dispute: PublicKey; voteRecord: PublicKey }>) => {
    if (!client) throw new Error("Client not initialized");
    return client.batchUnlockStake({ unlocks });
  }, [client]);

  // Reward Claims
  const claimJurorReward = useCallback(async (
    dispute: PublicKey,
    subject: PublicKey,
    voteRecord: PublicKey
  ) => {
    console.log("[Hook] claimJurorReward called");
    if (!client) throw new Error("Client not initialized");
    console.log("[Hook] calling client.claimJurorReward");
    return client.claimJurorReward({ dispute, subject, voteRecord });
  }, [client]);

  const claimChallengerReward = useCallback(async (
    dispute: PublicKey,
    subject: PublicKey,
    challengerRecord: PublicKey
  ) => {
    if (!client) throw new Error("Client not initialized");
    return client.claimChallengerReward({ dispute, subject, challengerRecord });
  }, [client]);

  const claimDefenderReward = useCallback(async (
    dispute: PublicKey,
    subject: PublicKey,
    defenderRecord: PublicKey
  ) => {
    if (!client) throw new Error("Client not initialized");
    return client.claimDefenderReward({ dispute, subject, defenderRecord });
  }, [client]);

  // Batch claim all rewards in a single transaction
  const batchClaimRewards = useCallback(async (params: {
    jurorClaims?: Array<{
      dispute: PublicKey;
      subject: PublicKey;
      voteRecord: PublicKey;
    }>;
    challengerClaims?: Array<{
      dispute: PublicKey;
      subject: PublicKey;
      challengerRecord: PublicKey;
    }>;
    defenderClaims?: Array<{
      dispute: PublicKey;
      subject: PublicKey;
      defenderRecord: PublicKey;
    }>;
  }) => {
    if (!client) throw new Error("Client not initialized");
    return client.batchClaimRewards(params);
  }, [client]);

  // Fetch single accounts
  const fetchDefenderPool = useCallback(async (defenderPool: PublicKey) => {
    if (!client) return null;
    return client.fetchDefenderPool(defenderPool);
  }, [client]);

  const fetchSubject = useCallback(async (subject: PublicKey) => {
    if (!client) return null;
    return client.fetchSubject(subject);
  }, [client]);

  const fetchDispute = useCallback(async (dispute: PublicKey) => {
    if (!client) return null;
    return client.fetchDispute(dispute);
  }, [client]);

  const fetchJurorAccount = useCallback(async (jurorAccount: PublicKey) => {
    if (!client) return null;
    return client.fetchJurorAccount(jurorAccount);
  }, [client]);

  const fetchChallengerAccount = useCallback(async (challengerAccount: PublicKey) => {
    if (!client) return null;
    return client.fetchChallengerAccount(challengerAccount);
  }, [client]);

  const fetchVoteRecord = useCallback(async (voteRecord: PublicKey) => {
    if (!client) return null;
    return client.fetchVoteRecord(voteRecord);
  }, [client]);

  const fetchChallengerRecord = useCallback(async (challengerRecord: PublicKey) => {
    if (!client) return null;
    return client.fetchChallengerRecord(challengerRecord);
  }, [client]);

  const fetchDefenderRecord = useCallback(async (defenderRecord: PublicKey) => {
    if (!client) return null;
    return client.fetchDefenderRecord(defenderRecord);
  }, [client]);

  // Fetch all accounts
  const fetchAllDefenderPools = useCallback(async () => {
    if (!client) return [];
    return client.fetchAllDefenderPools();
  }, [client]);

  const fetchAllSubjects = useCallback(async () => {
    if (!client) return [];
    return client.fetchAllSubjects();
  }, [client]);

  const fetchAllDisputes = useCallback(async () => {
    if (!client) return [];
    return client.fetchAllDisputes();
  }, [client]);

  const fetchAllJurors = useCallback(async () => {
    if (!client) return [];
    return client.fetchAllJurors();
  }, [client]);

  // Fetch filtered
  const fetchDisputesBySubject = useCallback(async (subject: PublicKey) => {
    if (!client) return [];
    return client.fetchDisputesBySubject(subject);
  }, [client]);

  const fetchVotesByDispute = useCallback(async (dispute: PublicKey) => {
    if (!client) return [];
    return client.fetchVotesByDispute(dispute);
  }, [client]);

  const fetchChallengersByDispute = useCallback(async (dispute: PublicKey) => {
    if (!client) return [];
    return client.fetchChallengersByDispute(dispute);
  }, [client]);

  // Simulation controls
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
    getSubjectPDA,
    getJurorPDA,
    getDisputePDA,
    getChallengerPDA,
    getChallengerRecordPDA,
    getDefenderRecordPDA,
    getVoteRecordPDA,
    getProtocolConfigPDA,
    // Protocol Config
    initializeConfig,
    fetchProtocolConfig,
    // Pool
    createPool,
    stakePool,
    withdrawPool,
    // Subject
    createSubject,
    addToStake,
    // Juror
    registerJuror,
    addJurorStake,
    withdrawJurorStake,
    unregisterJuror,
    // Dispute
    submitDispute,
    submitFreeDispute,
    submitRestore,
    addToDispute,
    // Voting
    voteOnDispute,
    voteOnRestore,
    addToVote,
    // Resolution
    resolveDispute,
    unlockJurorStake,
    batchUnlockStake,
    // Rewards
    claimJurorReward,
    claimChallengerReward,
    claimDefenderReward,
    batchClaimRewards,
    // Fetch single
    fetchDefenderPool,
    fetchSubject,
    fetchDispute,
    fetchJurorAccount,
    fetchChallengerAccount,
    fetchVoteRecord,
    fetchChallengerRecord,
    fetchDefenderRecord,
    // Fetch all
    fetchAllDefenderPools,
    fetchAllSubjects,
    fetchAllDisputes,
    fetchAllJurors,
    // Fetch filtered
    fetchDisputesBySubject,
    fetchVotesByDispute,
    fetchChallengersByDispute,
    // Simulation
    setSimulateFirst,
    getSimulateFirst,
  };
};

// Re-export types from SDK for convenience
export type {
  ProtocolConfig,
  DefenderPool,
  Subject,
  Dispute,
  JurorAccount,
  VoteRecord,
  ChallengerAccount,
  ChallengerRecord,
  DefenderRecord,
  DisputeType,
  VoteChoice,
  RestoreVoteChoice,
  TransactionResult,
  SimulationResult,
};

// Re-export enums and helpers from SDK
export {
  SubjectStatusEnum,
  DisputeStatusEnum,
  ResolutionOutcomeEnum,
  DisputeTypeEnum,
  VoteChoiceEnum,
  RestoreVoteChoiceEnum,
  isSubjectValid,
  isSubjectDisputed,
  isSubjectInvalid,
  isSubjectDormant,
  isSubjectRestoring,
  isDisputePending,
  isDisputeResolved,
  isChallengerWins,
  isDefenderWins,
  isNoParticipation,
  getDisputeTypeName,
  getOutcomeName,
  PROGRAM_ID,
  MIN_JUROR_STAKE,
  MIN_CHALLENGER_BOND,
  MIN_DEFENDER_STAKE,
  BASE_CHALLENGER_BOND,
  STAKE_UNLOCK_BUFFER,
  TOTAL_FEE_BPS,
  JUROR_SHARE_BPS,
  WINNER_SHARE_BPS,
  // Reputation helpers
  REP_PRECISION,
  REP_100_PERCENT,
  INITIAL_REPUTATION,
  calculateMinBond,
  formatReputation,
} from "@tribunalcraft/sdk";
