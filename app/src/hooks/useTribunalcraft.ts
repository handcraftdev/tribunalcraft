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
  type DisputeEscrow,
  type JurorAccount,
  type VoteRecord,
  type ChallengerAccount,
  type ChallengerRecord,
  type DefenderRecord,
  type DisputeType,
  type VoteChoice,
  type AppealVoteChoice,
  type TransactionResult,
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
  useEffect(() => {
    const newClient = new TribunalCraftClient({ connection });
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

  const getEscrowPDA = useCallback((dispute: PublicKey) => {
    return pda.escrow(dispute);
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
  const createSubject = useCallback(async (
    subjectId: PublicKey,
    detailsCid: string,
    maxStake: BN,
    matchMode: boolean,
    votingPeriod: BN,
    stake: BN
  ) => {
    if (!client) throw new Error("Client not initialized");
    return client.createSubject({
      subjectId,
      detailsCid,
      maxStake,
      matchMode,
      freeCase: false,
      votingPeriod,
      stake,
    });
  }, [client]);

  const createLinkedSubject = useCallback(async (
    defenderPool: PublicKey,
    subjectId: PublicKey,
    detailsCid: string,
    maxStake: BN,
    matchMode: boolean,
    votingPeriod: BN
  ) => {
    if (!client) throw new Error("Client not initialized");
    return client.createLinkedSubject({
      defenderPool,
      subjectId,
      detailsCid,
      maxStake,
      matchMode,
      freeCase: false,
      votingPeriod,
    });
  }, [client]);

  const createFreeSubject = useCallback(async (
    subjectId: PublicKey,
    detailsCid: string,
    votingPeriod: BN
  ) => {
    if (!client) throw new Error("Client not initialized");
    return client.createFreeSubject({ subjectId, detailsCid, votingPeriod });
  }, [client]);

  const addToStake = useCallback(async (subject: PublicKey, stake: BN) => {
    if (!client) throw new Error("Client not initialized");
    return client.addToStake(subject, stake);
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
    subjectData: { disputeCount: number; defenderPool: PublicKey },
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

  const submitAppeal = useCallback(async (
    subject: PublicKey,
    subjectData: { disputeCount: number },
    disputeType: DisputeType,
    detailsCid: string,
    stakeAmount: BN
  ) => {
    if (!client) throw new Error("Client not initialized");
    return client.submitAppeal({
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
    detailsCid: string,
    bond: BN
  ) => {
    if (!client) throw new Error("Client not initialized");
    return client.addToDispute({
      subject,
      dispute,
      defenderPool: defenderPool ?? undefined,
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

  const voteOnAppeal = useCallback(async (
    dispute: PublicKey,
    choice: AppealVoteChoice,
    stakeAllocation: BN,
    rationaleCid: string = ""
  ) => {
    if (!client) throw new Error("Client not initialized");
    return client.voteOnAppeal({
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

  // Reward Claims
  const claimJurorReward = useCallback(async (
    dispute: PublicKey,
    subject: PublicKey,
    voteRecord: PublicKey
  ) => {
    if (!client) throw new Error("Client not initialized");
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

  const closeEscrow = useCallback(async (dispute: PublicKey) => {
    if (!client) throw new Error("Client not initialized");
    return client.closeEscrow(dispute);
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

  const fetchEscrow = useCallback(async (escrow: PublicKey) => {
    if (!client) return null;
    return client.fetchEscrow(escrow);
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

  return {
    client,
    program: client?.program ?? null,
    provider: client?.program?.provider ?? null,
    // PDAs
    getDefenderPoolPDA,
    getSubjectPDA,
    getJurorPDA,
    getDisputePDA,
    getEscrowPDA,
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
    createLinkedSubject,
    createFreeSubject,
    addToStake,
    // Juror
    registerJuror,
    addJurorStake,
    withdrawJurorStake,
    unregisterJuror,
    // Dispute
    submitDispute,
    submitFreeDispute,
    submitAppeal,
    addToDispute,
    // Voting
    voteOnDispute,
    voteOnAppeal,
    addToVote,
    // Resolution
    resolveDispute,
    unlockJurorStake,
    // Rewards
    claimJurorReward,
    claimChallengerReward,
    claimDefenderReward,
    closeEscrow,
    // Fetch single
    fetchDefenderPool,
    fetchSubject,
    fetchDispute,
    fetchJurorAccount,
    fetchChallengerAccount,
    fetchVoteRecord,
    fetchChallengerRecord,
    fetchDefenderRecord,
    fetchEscrow,
    // Fetch all
    fetchAllDefenderPools,
    fetchAllSubjects,
    fetchAllDisputes,
    fetchAllJurors,
    // Fetch filtered
    fetchDisputesBySubject,
    fetchVotesByDispute,
    fetchChallengersByDispute,
  };
};

// Re-export types from SDK for convenience
export type {
  ProtocolConfig,
  DefenderPool,
  Subject,
  Dispute,
  DisputeEscrow,
  JurorAccount,
  VoteRecord,
  ChallengerAccount,
  ChallengerRecord,
  DefenderRecord,
  DisputeType,
  VoteChoice,
  AppealVoteChoice,
  TransactionResult,
};

// Re-export enums and helpers from SDK
export {
  SubjectStatusEnum,
  DisputeStatusEnum,
  ResolutionOutcomeEnum,
  DisputeTypeEnum,
  VoteChoiceEnum,
  AppealVoteChoiceEnum,
  isSubjectActive,
  isSubjectDisputed,
  isSubjectInvalidated,
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
  STAKE_UNLOCK_BUFFER,
  TOTAL_FEE_BPS,
  JUROR_SHARE_BPS,
  WINNER_SHARE_BPS,
} from "@tribunalcraft/sdk";
