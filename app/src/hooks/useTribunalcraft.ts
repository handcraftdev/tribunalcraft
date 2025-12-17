"use client";

import { useCallback, useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import type { Tribunalcraft } from "@/idl/tribunalcraft";
import type { DisputeType, VoteChoice } from "@/idl/types";
import {
  simulateTransaction,
  parseTransactionError,
  TribunalError,
} from "@/lib/transaction";
import idl from "@/idl/tribunalcraft.json";

const PROGRAM_ID = new PublicKey(idl.address);

// Seeds for PDA derivation - Global (no config dependency)
const STAKER_POOL_SEED = Buffer.from("staker_pool");
const SUBJECT_SEED = Buffer.from("subject");
const JUROR_SEED = Buffer.from("juror");
const DISPUTE_SEED = Buffer.from("dispute");
const CHALLENGER_SEED = Buffer.from("challenger");
const CHALLENGER_RECORD_SEED = Buffer.from("challenger_record");
const STAKER_RECORD_SEED = Buffer.from("staker_record");
const VOTE_RECORD_SEED = Buffer.from("vote");

export const useTribunalcraft = () => {
  const { connection } = useConnection();
  const wallet = useWallet();

  const provider = useMemo(() => {
    if (!wallet.publicKey || !wallet.signTransaction) return null;
    return new AnchorProvider(connection, wallet as any, {
      commitment: "confirmed",
    });
  }, [connection, wallet]);

  const program = useMemo(() => {
    if (!provider) return null;
    return new Program<Tribunalcraft>(idl as Tribunalcraft, provider);
  }, [provider]);

  /**
   * Execute a transaction with simulation first
   * Builds the transaction, simulates it, then sends if simulation passes
   */
  const executeWithSimulation = useCallback(
    async <T>(
      methodBuilder: any,
      description: string
    ): Promise<string> => {
      if (!program || !wallet.publicKey || !provider) {
        throw new Error("Wallet not connected");
      }

      try {
        // Build the transaction
        const tx = await methodBuilder.transaction();

        // Get recent blockhash
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;
        tx.feePayer = wallet.publicKey;

        // Simulate first
        const simulation = await simulateTransaction(connection, tx);

        if (!simulation.success) {
          console.error(`[${description}] Simulation failed:`, simulation.error);
          throw new TribunalError(simulation.error!);
        }

        // Simulation passed, now send
        const signature = await methodBuilder.rpc();
        return signature;
      } catch (error) {
        // If already a TribunalError, rethrow
        if (error instanceof TribunalError) {
          throw error;
        }
        // Parse and wrap other errors
        const parsed = parseTransactionError(error);
        throw new TribunalError(parsed);
      }
    },
    [program, wallet.publicKey, provider, connection]
  );

  // PDA derivations - Global (no config in seeds)
  const getStakerPoolPDA = useCallback((owner: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [STAKER_POOL_SEED, owner.toBuffer()],
      PROGRAM_ID
    );
  }, []);

  const getSubjectPDA = useCallback((subjectId: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [SUBJECT_SEED, subjectId.toBuffer()],
      PROGRAM_ID
    );
  }, []);

  const getJurorPDA = useCallback((juror: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [JUROR_SEED, juror.toBuffer()],
      PROGRAM_ID
    );
  }, []);

  const getDisputePDA = useCallback(
    (subject: PublicKey, disputeCount: number) => {
      const countBuffer = Buffer.alloc(4);
      countBuffer.writeUInt32LE(disputeCount);
      return PublicKey.findProgramAddressSync(
        [DISPUTE_SEED, subject.toBuffer(), countBuffer],
        PROGRAM_ID
      );
    },
    []
  );

  const getChallengerPDA = useCallback((challenger: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [CHALLENGER_SEED, challenger.toBuffer()],
      PROGRAM_ID
    );
  }, []);

  const getChallengerRecordPDA = useCallback(
    (dispute: PublicKey, challenger: PublicKey) => {
      return PublicKey.findProgramAddressSync(
        [CHALLENGER_RECORD_SEED, dispute.toBuffer(), challenger.toBuffer()],
        PROGRAM_ID
      );
    },
    []
  );

  const getStakerRecordPDA = useCallback(
    (subject: PublicKey, staker: PublicKey) => {
      return PublicKey.findProgramAddressSync(
        [STAKER_RECORD_SEED, subject.toBuffer(), staker.toBuffer()],
        PROGRAM_ID
      );
    },
    []
  );

  const getVoteRecordPDA = useCallback(
    (dispute: PublicKey, juror: PublicKey) => {
      return PublicKey.findProgramAddressSync(
        [VOTE_RECORD_SEED, dispute.toBuffer(), juror.toBuffer()],
        PROGRAM_ID
      );
    },
    []
  );

  // Pool Management - Global PDAs
  const createPool = useCallback(
    async (initialStake: BN) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");

      const [stakerPool] = getStakerPoolPDA(wallet.publicKey);

      const tx = await executeWithSimulation(
        program.methods.createPool(initialStake),
        "createPool"
      );

      return { tx, stakerPool };
    },
    [program, wallet.publicKey, getStakerPoolPDA, executeWithSimulation]
  );

  const stakePool = useCallback(
    async (amount: BN) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");

      const tx = await executeWithSimulation(
        program.methods.stakePool(amount),
        "stakePool"
      );

      return { tx };
    },
    [program, wallet.publicKey, executeWithSimulation]
  );

  const withdrawPool = useCallback(
    async (amount: BN) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");

      const tx = await executeWithSimulation(
        program.methods.withdrawPool(amount),
        "withdrawPool"
      );

      return { tx };
    },
    [program, wallet.publicKey, executeWithSimulation]
  );

  // Subject Management
  const createSubject = useCallback(
    async (
      subjectId: PublicKey,
      detailsCid: string,
      maxStake: BN,
      matchMode: boolean,
      votingPeriod: BN,
      winnerRewardBps: number,
      stake: BN
    ) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");

      const [subject] = getSubjectPDA(subjectId);
      const [stakerRecord] = getStakerRecordPDA(subject, wallet.publicKey);

      const tx = await executeWithSimulation(
        program.methods.createSubject(
          subjectId,
          detailsCid,
          maxStake,
          matchMode,
          false, // freeCase = false for regular subjects
          votingPeriod,
          winnerRewardBps,
          stake
        ),
        "createSubject"
      );

      return { tx, subject, stakerRecord };
    },
    [
      program,
      wallet.publicKey,
      getSubjectPDA,
      getStakerRecordPDA,
      executeWithSimulation,
    ]
  );

  const createLinkedSubject = useCallback(
    async (
      stakerPool: PublicKey,
      subjectId: PublicKey,
      detailsCid: string,
      maxStake: BN,
      matchMode: boolean,
      votingPeriod: BN,
      winnerRewardBps: number
    ) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");

      const [subject] = getSubjectPDA(subjectId);

      const tx = await executeWithSimulation(
        program.methods
          .createLinkedSubject(
            subjectId,
            detailsCid,
            maxStake,
            matchMode,
            false, // freeCase = false for linked subjects
            votingPeriod,
            winnerRewardBps
          )
          .accountsPartial({
            stakerPool,
          }),
        "createLinkedSubject"
      );

      return { tx, subject };
    },
    [program, wallet.publicKey, getSubjectPDA, executeWithSimulation]
  );

  const createFreeSubject = useCallback(
    async (
      subjectId: PublicKey,
      detailsCid: string,
      votingPeriod: BN
    ) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");

      const [subject] = getSubjectPDA(subjectId);

      const tx = await executeWithSimulation(
        program.methods.createFreeSubject(subjectId, detailsCid, votingPeriod),
        "createFreeSubject"
      );

      return { tx, subject };
    },
    [program, wallet.publicKey, getSubjectPDA, executeWithSimulation]
  );

  const addToStake = useCallback(
    async (subject: PublicKey, stake: BN) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");

      const tx = await executeWithSimulation(
        program.methods.addToStake(stake).accountsPartial({
          subject,
        }),
        "addToStake"
      );

      return { tx };
    },
    [program, wallet.publicKey, executeWithSimulation]
  );

  // Juror Management
  const registerJuror = useCallback(
    async (stakeAmount: BN) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");

      const [jurorAccount] = getJurorPDA(wallet.publicKey);

      const tx = await executeWithSimulation(
        program.methods.registerJuror(stakeAmount),
        "registerJuror"
      );

      return { tx, jurorAccount };
    },
    [program, wallet.publicKey, getJurorPDA, executeWithSimulation]
  );

  const addJurorStake = useCallback(
    async (amount: BN) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");

      const tx = await executeWithSimulation(
        program.methods.addJurorStake(amount),
        "addJurorStake"
      );

      return { tx };
    },
    [program, wallet.publicKey, executeWithSimulation]
  );

  const withdrawJurorStake = useCallback(
    async (amount: BN) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");

      const tx = await executeWithSimulation(
        program.methods.withdrawJurorStake(amount),
        "withdrawJurorStake"
      );

      return { tx };
    },
    [program, wallet.publicKey, executeWithSimulation]
  );

  const unregisterJuror = useCallback(async () => {
    if (!program || !wallet.publicKey) throw new Error("Wallet not connected");

    const tx = await executeWithSimulation(
      program.methods.unregisterJuror(),
      "unregisterJuror"
    );

    return { tx };
  }, [program, wallet.publicKey, executeWithSimulation]);

  // Dispute Management
  const submitDispute = useCallback(
    async (
      subject: PublicKey,
      subjectData: { disputeCount: number; stakerPool: PublicKey },
      disputeType: DisputeType,
      detailsCid: string,
      bond: BN
    ) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");

      const [dispute] = getDisputePDA(subject, subjectData.disputeCount);
      const [challengerRecord] = getChallengerRecordPDA(
        dispute,
        wallet.publicKey
      );

      const isLinked = !subjectData.stakerPool.equals(PublicKey.default);

      const tx = await executeWithSimulation(
        program.methods
          .submitDispute(disputeType, detailsCid, bond)
          .accountsPartial({
            subject,
            stakerPool: isLinked ? subjectData.stakerPool : null,
          }),
        "submitDispute"
      );

      return { tx, dispute, challengerRecord };
    },
    [
      program,
      wallet.publicKey,
      getDisputePDA,
      getChallengerRecordPDA,
      executeWithSimulation,
    ]
  );

  const submitFreeDispute = useCallback(
    async (
      subject: PublicKey,
      subjectData: { disputeCount: number },
      disputeType: DisputeType,
      detailsCid: string
    ) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");

      const [dispute] = getDisputePDA(subject, subjectData.disputeCount);
      const [challengerRecord] = getChallengerRecordPDA(
        dispute,
        wallet.publicKey
      );

      const tx = await executeWithSimulation(
        program.methods
          .submitFreeDispute(disputeType, detailsCid)
          .accountsPartial({
            subject,
          }),
        "submitFreeDispute"
      );

      return { tx, dispute, challengerRecord };
    },
    [
      program,
      wallet.publicKey,
      getDisputePDA,
      getChallengerRecordPDA,
      executeWithSimulation,
    ]
  );

  const addToDispute = useCallback(
    async (
      subject: PublicKey,
      dispute: PublicKey,
      stakerPool: PublicKey | null,
      detailsCid: string,
      bond: BN
    ) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");

      const [challengerRecord] = getChallengerRecordPDA(
        dispute,
        wallet.publicKey
      );

      const tx = await executeWithSimulation(
        program.methods.addToDispute(detailsCid, bond).accountsPartial({
          subject,
          dispute,
          stakerPool: stakerPool || null,
        }),
        "addToDispute"
      );

      return { tx, challengerRecord };
    },
    [program, wallet.publicKey, getChallengerRecordPDA, executeWithSimulation]
  );

  // Voting
  const voteOnDispute = useCallback(
    async (
      dispute: PublicKey,
      choice: VoteChoice,
      stakeAllocation: BN,
      rationaleCid: string = ""
    ) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");

      const [voteRecord] = getVoteRecordPDA(dispute, wallet.publicKey);

      const tx = await executeWithSimulation(
        program.methods
          .voteOnDispute(choice, stakeAllocation, rationaleCid)
          .accountsPartial({
            dispute,
          }),
        "voteOnDispute"
      );

      return { tx, voteRecord };
    },
    [program, wallet.publicKey, getVoteRecordPDA, executeWithSimulation]
  );

  const addToVote = useCallback(
    async (dispute: PublicKey, additionalStake: BN) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");

      // Fetch dispute to get subject
      const disputeAccount = await program.account.dispute.fetch(dispute);

      const tx = await executeWithSimulation(
        program.methods.addToVote(additionalStake).accountsPartial({
          dispute,
          subject: disputeAccount.subject,
        }),
        "addToVote"
      );

      return { tx };
    },
    [program, wallet.publicKey, executeWithSimulation]
  );

  // Resolution
  const resolveDispute = useCallback(
    async (
      dispute: PublicKey,
      subject: PublicKey,
      stakerPool: PublicKey | null
    ) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");

      const tx = await executeWithSimulation(
        program.methods.resolveDispute().accountsPartial({
          dispute,
          subject,
          stakerPool: stakerPool || null,
        }),
        "resolveDispute"
      );

      return { tx };
    },
    [program, wallet.publicKey, executeWithSimulation]
  );

  const processVoteResult = useCallback(
    async (
      dispute: PublicKey,
      voteRecord: PublicKey,
      jurorAccount: PublicKey
    ) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");

      const tx = await executeWithSimulation(
        program.methods.processVoteResult().accountsPartial({
          dispute,
          voteRecord,
          jurorAccount,
        }),
        "processVoteResult"
      );

      return { tx };
    },
    [program, wallet.publicKey, executeWithSimulation]
  );

  // Reward Claims
  const claimJurorReward = useCallback(
    async (dispute: PublicKey, subject: PublicKey, voteRecord: PublicKey) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");

      const tx = await executeWithSimulation(
        program.methods.claimJurorReward().accountsPartial({
          dispute,
          subject,
          voteRecord,
        }),
        "claimJurorReward"
      );

      return { tx };
    },
    [program, wallet.publicKey, executeWithSimulation]
  );

  const claimChallengerReward = useCallback(
    async (
      dispute: PublicKey,
      subject: PublicKey,
      challengerRecord: PublicKey
    ) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");

      const tx = await executeWithSimulation(
        program.methods.claimChallengerReward().accountsPartial({
          dispute,
          subject,
          challengerRecord,
        }),
        "claimChallengerReward"
      );

      return { tx };
    },
    [program, wallet.publicKey, executeWithSimulation]
  );

  const claimStakerReward = useCallback(
    async (dispute: PublicKey, subject: PublicKey, stakerRecord: PublicKey) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");

      const tx = await executeWithSimulation(
        program.methods.claimStakerReward().accountsPartial({
          dispute,
          subject,
          stakerRecord,
        }),
        "claimStakerReward"
      );

      return { tx };
    },
    [program, wallet.publicKey, executeWithSimulation]
  );

  const claimPoolReward = useCallback(
    async (dispute: PublicKey, subject: PublicKey, stakerPool: PublicKey) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");

      const tx = await executeWithSimulation(
        program.methods.claimPoolReward().accountsPartial({
          dispute,
          subject,
          stakerPool,
        }),
        "claimPoolReward"
      );

      return { tx };
    },
    [program, wallet.publicKey, executeWithSimulation]
  );

  // Fetch accounts
  const fetchStakerPool = useCallback(
    async (stakerPool: PublicKey) => {
      if (!program) return null;
      return program.account.stakerPool.fetch(stakerPool);
    },
    [program]
  );

  const fetchSubject = useCallback(
    async (subject: PublicKey) => {
      if (!program) return null;
      return program.account.subject.fetch(subject);
    },
    [program]
  );

  const fetchDispute = useCallback(
    async (dispute: PublicKey) => {
      if (!program) return null;
      return program.account.dispute.fetch(dispute);
    },
    [program]
  );

  const fetchJurorAccount = useCallback(
    async (jurorAccount: PublicKey) => {
      if (!program) return null;
      return program.account.jurorAccount.fetch(jurorAccount);
    },
    [program]
  );

  const fetchChallengerAccount = useCallback(
    async (challengerAccount: PublicKey) => {
      if (!program) return null;
      return program.account.challengerAccount.fetch(challengerAccount);
    },
    [program]
  );

  const fetchVoteRecord = useCallback(
    async (voteRecord: PublicKey) => {
      if (!program) return null;
      return program.account.voteRecord.fetch(voteRecord);
    },
    [program]
  );

  const fetchChallengerRecord = useCallback(
    async (challengerRecord: PublicKey) => {
      if (!program) return null;
      return program.account.challengerRecord.fetch(challengerRecord);
    },
    [program]
  );

  const fetchStakerRecord = useCallback(
    async (stakerRecord: PublicKey) => {
      if (!program) return null;
      return program.account.stakerRecord.fetch(stakerRecord);
    },
    [program]
  );

  // List all accounts (global - no config filter)
  const fetchAllStakerPools = useCallback(async () => {
    if (!program) return [];
    return program.account.stakerPool.all();
  }, [program]);

  const fetchAllSubjects = useCallback(async () => {
    if (!program) return [];
    return program.account.subject.all();
  }, [program]);

  const fetchAllDisputes = useCallback(async () => {
    if (!program) return [];
    return program.account.dispute.all();
  }, [program]);

  const fetchAllJurors = useCallback(async () => {
    if (!program) return [];
    return program.account.jurorAccount.all();
  }, [program]);

  // Fetch by filter
  const fetchDisputesBySubject = useCallback(
    async (subject: PublicKey) => {
      if (!program) return [];
      return program.account.dispute.all([
        { memcmp: { offset: 8, bytes: subject.toBase58() } },
      ]);
    },
    [program]
  );

  const fetchVotesByDispute = useCallback(
    async (dispute: PublicKey) => {
      if (!program) return [];
      return program.account.voteRecord.all([
        { memcmp: { offset: 8, bytes: dispute.toBase58() } },
      ]);
    },
    [program]
  );

  const fetchChallengersByDispute = useCallback(
    async (dispute: PublicKey) => {
      if (!program) return [];
      return program.account.challengerRecord.all([
        { memcmp: { offset: 8, bytes: dispute.toBase58() } },
      ]);
    },
    [program]
  );

  return {
    program,
    provider,
    // PDAs (Global)
    getStakerPoolPDA,
    getSubjectPDA,
    getJurorPDA,
    getDisputePDA,
    getChallengerPDA,
    getChallengerRecordPDA,
    getStakerRecordPDA,
    getVoteRecordPDA,
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
    addToDispute,
    // Voting
    voteOnDispute,
    addToVote,
    // Resolution
    resolveDispute,
    processVoteResult,
    // Rewards
    claimJurorReward,
    claimChallengerReward,
    claimStakerReward,
    claimPoolReward,
    // Fetch single
    fetchStakerPool,
    fetchSubject,
    fetchDispute,
    fetchJurorAccount,
    fetchChallengerAccount,
    fetchVoteRecord,
    fetchChallengerRecord,
    fetchStakerRecord,
    // Fetch all
    fetchAllStakerPools,
    fetchAllSubjects,
    fetchAllDisputes,
    fetchAllJurors,
    // Fetch filtered
    fetchDisputesBySubject,
    fetchVotesByDispute,
    fetchChallengersByDispute,
  };
};

// Re-export error types and utilities for components to use
export { TribunalError, parseTransactionError } from "@/lib/transaction";
export type { TransactionError } from "@/lib/transaction";
