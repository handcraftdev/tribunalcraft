"use client";

import { useCallback, useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import type { Tribunalcraft } from "@/idl/tribunalcraft";
import type { DisputeType, VoteChoice, AppealVoteChoice } from "@/idl/types";
import {
  simulateTransaction,
  parseTransactionError,
  TribunalError,
} from "@/lib/transaction";
import idl from "@/idl/tribunalcraft.json";

const PROGRAM_ID = new PublicKey(idl.address);

// Seeds for PDA derivation - match generated IDL
const DEFENDER_POOL_SEED = Buffer.from("defender_pool");
const SUBJECT_SEED = Buffer.from("subject");
const JUROR_SEED = Buffer.from("juror");
const DISPUTE_SEED = Buffer.from("dispute");
const CHALLENGER_SEED = Buffer.from("challenger");
const CHALLENGER_RECORD_SEED = Buffer.from("challenger_record");
const DEFENDER_RECORD_SEED = Buffer.from("defender_record");
const VOTE_RECORD_SEED = Buffer.from("vote");
const PROTOCOL_CONFIG_SEED = Buffer.from("protocol_config");

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
        const tx = await methodBuilder.transaction();
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;
        tx.feePayer = wallet.publicKey;

        const simulation = await simulateTransaction(connection, tx);

        if (!simulation.success) {
          console.error(`[${description}] Simulation failed:`, simulation.error);
          throw new TribunalError(simulation.error!);
        }

        const signature = await methodBuilder.rpc();
        return signature;
      } catch (error) {
        if (error instanceof TribunalError) {
          throw error;
        }
        const parsed = parseTransactionError(error);
        throw new TribunalError(parsed);
      }
    },
    [program, wallet.publicKey, provider, connection]
  );

  // PDA derivations
  const getDefenderPoolPDA = useCallback((owner: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [DEFENDER_POOL_SEED, owner.toBuffer()],
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

  const getDefenderRecordPDA = useCallback(
    (subject: PublicKey, defender: PublicKey) => {
      return PublicKey.findProgramAddressSync(
        [DEFENDER_RECORD_SEED, subject.toBuffer(), defender.toBuffer()],
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

  const getProtocolConfigPDA = useCallback(() => {
    return PublicKey.findProgramAddressSync(
      [PROTOCOL_CONFIG_SEED],
      PROGRAM_ID
    );
  }, []);

  // Protocol Config
  const initializeConfig = useCallback(async () => {
    if (!program || !wallet.publicKey)
      throw new Error("Wallet not connected");

    const [protocolConfig] = getProtocolConfigPDA();

    const tx = await executeWithSimulation(
      program.methods.initializeConfig(),
      "initializeConfig"
    );

    return { tx, protocolConfig };
  }, [program, wallet.publicKey, getProtocolConfigPDA, executeWithSimulation]);

  const fetchProtocolConfig = useCallback(async () => {
    if (!program) return null;
    const [protocolConfig] = getProtocolConfigPDA();
    try {
      return await program.account.protocolConfig.fetch(protocolConfig);
    } catch {
      return null;
    }
  }, [program, getProtocolConfigPDA]);

  // Pool Management
  const createPool = useCallback(
    async (initialStake: BN) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");

      const [defenderPool] = getDefenderPoolPDA(wallet.publicKey);

      const tx = await executeWithSimulation(
        program.methods.createPool(initialStake),
        "createPool"
      );

      return { tx, defenderPool };
    },
    [program, wallet.publicKey, getDefenderPoolPDA, executeWithSimulation]
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
      stake: BN
    ) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");

      const [subject] = getSubjectPDA(subjectId);
      const [defenderRecord] = getDefenderRecordPDA(subject, wallet.publicKey);

      const tx = await executeWithSimulation(
        program.methods.createSubject(
          subjectId,
          detailsCid,
          maxStake,
          matchMode,
          false, // freeCase = false for regular subjects
          votingPeriod,
          stake
        ),
        "createSubject"
      );

      return { tx, subject, defenderRecord };
    },
    [
      program,
      wallet.publicKey,
      getSubjectPDA,
      getDefenderRecordPDA,
      executeWithSimulation,
    ]
  );

  const createLinkedSubject = useCallback(
    async (
      defenderPool: PublicKey,
      subjectId: PublicKey,
      detailsCid: string,
      maxStake: BN,
      matchMode: boolean,
      votingPeriod: BN
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
            votingPeriod
          )
          .accountsPartial({
            defenderPool,
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
      subjectData: { disputeCount: number; defenderPool: PublicKey },
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

      const isLinked = !subjectData.defenderPool.equals(PublicKey.default);

      const tx = await executeWithSimulation(
        program.methods
          .submitDispute(disputeType, detailsCid, bond)
          .accountsPartial({
            subject,
            defenderPool: isLinked ? subjectData.defenderPool : null,
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

  const submitAppeal = useCallback(
    async (
      subject: PublicKey,
      subjectData: { disputeCount: number },
      disputeType: DisputeType,
      detailsCid: string,
      stakeAmount: BN
    ) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");

      const [dispute] = getDisputePDA(subject, subjectData.disputeCount);

      const tx = await executeWithSimulation(
        program.methods
          .submitAppeal(disputeType, detailsCid, stakeAmount)
          .accountsPartial({
            subject,
          }),
        "submitAppeal"
      );

      return { tx, dispute };
    },
    [
      program,
      wallet.publicKey,
      getDisputePDA,
      executeWithSimulation,
    ]
  );

  const addToDispute = useCallback(
    async (
      subject: PublicKey,
      dispute: PublicKey,
      defenderPool: PublicKey | null,
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
          defenderPool: defenderPool || null,
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

  const voteOnAppeal = useCallback(
    async (
      dispute: PublicKey,
      choice: AppealVoteChoice,
      stakeAllocation: BN,
      rationaleCid: string = ""
    ) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");

      const [voteRecord] = getVoteRecordPDA(dispute, wallet.publicKey);

      const tx = await executeWithSimulation(
        program.methods
          .voteOnAppeal(choice, stakeAllocation, rationaleCid)
          .accountsPartial({
            dispute,
          }),
        "voteOnAppeal"
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
      defenderPool: PublicKey | null
    ) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");

      const [protocolConfig] = getProtocolConfigPDA();

      // Fetch protocol config to get treasury address
      const configAccount = await program.account.protocolConfig.fetch(protocolConfig);

      const tx = await executeWithSimulation(
        program.methods.resolveDispute().accountsPartial({
          dispute,
          subject,
          defenderPool: defenderPool || null,
          protocolConfig,
          treasury: configAccount.treasury,
        }),
        "resolveDispute"
      );

      return { tx };
    },
    [program, wallet.publicKey, getProtocolConfigPDA, executeWithSimulation]
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

  const claimDefenderReward = useCallback(
    async (dispute: PublicKey, subject: PublicKey, defenderRecord: PublicKey) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");

      const tx = await executeWithSimulation(
        program.methods.claimDefenderReward().accountsPartial({
          dispute,
          subject,
          defenderRecord,
        }),
        "claimDefenderReward"
      );

      return { tx };
    },
    [program, wallet.publicKey, executeWithSimulation]
  );

  const claimPoolReward = useCallback(
    async (dispute: PublicKey, subject: PublicKey, defenderPool: PublicKey) => {
      if (!program || !wallet.publicKey)
        throw new Error("Wallet not connected");

      const tx = await executeWithSimulation(
        program.methods.claimPoolReward().accountsPartial({
          dispute,
          subject,
          defenderPool,
        }),
        "claimPoolReward"
      );

      return { tx };
    },
    [program, wallet.publicKey, executeWithSimulation]
  );

  // Fetch accounts
  const fetchDefenderPool = useCallback(
    async (defenderPool: PublicKey) => {
      if (!program) return null;
      return program.account.defenderPool.fetch(defenderPool);
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

  const fetchDefenderRecord = useCallback(
    async (defenderRecord: PublicKey) => {
      if (!program) return null;
      return program.account.defenderRecord.fetch(defenderRecord);
    },
    [program]
  );

  // List all accounts
  const fetchAllDefenderPools = useCallback(async () => {
    if (!program) return [];
    return program.account.defenderPool.all();
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
    processVoteResult,
    // Rewards
    claimJurorReward,
    claimChallengerReward,
    claimDefenderReward,
    claimPoolReward,
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
  };
};

// Re-export error types and utilities for components to use
export { TribunalError, parseTransactionError } from "@/lib/transaction";
export type { TransactionError } from "@/lib/transaction";
