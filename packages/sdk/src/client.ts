import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  Keypair,
  SendOptions,
} from "@solana/web3.js";
import { Program, AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { PDA } from "./pda";
import { PROGRAM_ID } from "./constants";
import type { Tribunalcraft } from "./idl-types";
import type {
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
} from "./types";
import idl from "./idl.json";

export interface TribunalCraftClientConfig {
  connection: Connection;
  wallet?: Wallet;
  programId?: PublicKey;
}

export interface TransactionResult {
  signature: string;
  accounts?: Record<string, PublicKey>;
}

/**
 * TribunalCraft SDK Client
 *
 * Framework-agnostic client for interacting with the TribunalCraft Solana program.
 * Can be used in Node.js, browser, React, Vue, or any JavaScript/TypeScript environment.
 *
 * @example
 * ```ts
 * import { TribunalCraftClient } from "@tribunalcraft/sdk";
 * import { Connection, Keypair } from "@solana/web3.js";
 *
 * const connection = new Connection("https://api.devnet.solana.com");
 * const wallet = new Wallet(keypair);
 * const client = new TribunalCraftClient({ connection, wallet });
 *
 * // Register as a juror
 * const result = await client.registerJuror(new BN(100_000_000));
 * console.log("Signature:", result.signature);
 * ```
 */
export class TribunalCraftClient {
  public readonly connection: Connection;
  public readonly programId: PublicKey;
  public readonly pda: PDA;
  private wallet: Wallet | null;
  private anchorProgram: Program<Tribunalcraft>;

  constructor(config: TribunalCraftClientConfig) {
    this.connection = config.connection;
    this.programId = config.programId ?? PROGRAM_ID;
    this.pda = new PDA(this.programId);
    this.wallet = config.wallet ?? null;

    // Initialize program with read-only provider (no wallet needed for fetching)
    const readOnlyProvider = new AnchorProvider(
      this.connection,
      {} as Wallet, // Dummy wallet for read-only operations
      { commitment: "confirmed" }
    );
    this.anchorProgram = new Program<Tribunalcraft>(
      idl as unknown as Tribunalcraft,
      readOnlyProvider
    );

    // If wallet provided, reinitialize with real wallet
    if (this.wallet) {
      this.initProgram();
    }
  }

  private initProgram(): void {
    if (!this.wallet) return;

    const provider = new AnchorProvider(this.connection, this.wallet, {
      commitment: "confirmed",
    });
    this.anchorProgram = new Program<Tribunalcraft>(
      idl as unknown as Tribunalcraft,
      provider
    );
  }

  /**
   * Set or update the wallet
   */
  setWallet(wallet: Wallet): void {
    this.wallet = wallet;
    this.initProgram();
  }

  /**
   * Get the current wallet public key
   */
  get walletPublicKey(): PublicKey | null {
    return this.wallet?.publicKey ?? null;
  }

  /**
   * Get the Anchor program instance (for advanced usage)
   */
  get program(): Program<Tribunalcraft> | null {
    return this.anchorProgram;
  }

  /**
   * Get wallet and program, throwing if not connected
   */
  private getWalletAndProgram(): { wallet: Wallet; program: Program<Tribunalcraft> } {
    if (!this.wallet || !this.anchorProgram) {
      throw new Error("Wallet not connected. Call setWallet() first.");
    }
    return { wallet: this.wallet, program: this.anchorProgram };
  }

  // ===========================================================================
  // Protocol Config
  // ===========================================================================

  /**
   * Initialize protocol config (one-time setup by deployer)
   */
  async initializeConfig(): Promise<TransactionResult> {
    const { program } = this.getWalletAndProgram();
    const [protocolConfig] = this.pda.protocolConfig();

    const signature = await program.methods
      .initializeConfig()
      .rpc();

    return { signature, accounts: { protocolConfig } };
  }

  /**
   * Update treasury address (admin only)
   */
  async updateTreasury(newTreasury: PublicKey): Promise<TransactionResult> {
    const { program } = this.getWalletAndProgram();

    const signature = await program.methods
      .updateTreasury(newTreasury)
      .rpc();

    return { signature };
  }

  // ===========================================================================
  // Defender Pool
  // ===========================================================================

  /**
   * Create a defender pool with initial stake
   */
  async createPool(initialStake: BN): Promise<TransactionResult> {
    const { wallet, program } = this.getWalletAndProgram();
    const [defenderPool] = this.pda.defenderPool(wallet.publicKey);

    const signature = await program.methods
      .createPool(initialStake)
      .rpc();

    return { signature, accounts: { defenderPool } };
  }

  /**
   * Add stake to an existing pool
   */
  async stakePool(amount: BN): Promise<TransactionResult> {
    const { program } = this.getWalletAndProgram();

    const signature = await program.methods
      .stakePool(amount)
      .rpc();

    return { signature };
  }

  /**
   * Withdraw available stake from pool
   */
  async withdrawPool(amount: BN): Promise<TransactionResult> {
    const { program } = this.getWalletAndProgram();

    const signature = await program.methods
      .withdrawPool(amount)
      .rpc();

    return { signature };
  }

  // ===========================================================================
  // Subject Management
  // ===========================================================================

  /**
   * Create a standalone subject with initial stake
   */
  async createSubject(params: {
    subjectId: PublicKey;
    detailsCid: string;
    maxStake: BN;
    matchMode: boolean;
    freeCase?: boolean;
    votingPeriod: BN;
    stake: BN;
  }): Promise<TransactionResult> {
    const { wallet, program } = this.getWalletAndProgram();
    const [subject] = this.pda.subject(params.subjectId);
    const [defenderRecord] = this.pda.defenderRecord(
      subject,
      wallet.publicKey
    );

    const signature = await program.methods
      .createSubject(
        params.subjectId,
        params.detailsCid,
        params.maxStake,
        params.matchMode,
        params.freeCase ?? false,
        params.votingPeriod,
        params.stake
      )
      .rpc();

    return { signature, accounts: { subject, defenderRecord } };
  }

  /**
   * Create a subject linked to a defender pool
   */
  async createLinkedSubject(params: {
    defenderPool: PublicKey;
    subjectId: PublicKey;
    detailsCid: string;
    maxStake: BN;
    matchMode: boolean;
    freeCase?: boolean;
    votingPeriod: BN;
  }): Promise<TransactionResult> {
    const { wallet, program } = this.getWalletAndProgram();
    const [subject] = this.pda.subject(params.subjectId);

    const signature = await program.methods
      .createLinkedSubject(
        params.subjectId,
        params.detailsCid,
        params.maxStake,
        params.matchMode,
        params.freeCase ?? false,
        params.votingPeriod
      )
      .accountsPartial({
        defenderPool: params.defenderPool,
      })
      .rpc();

    return { signature, accounts: { subject } };
  }

  /**
   * Create a free subject (no stake required)
   */
  async createFreeSubject(params: {
    subjectId: PublicKey;
    detailsCid: string;
    votingPeriod: BN;
  }): Promise<TransactionResult> {
    const { wallet, program } = this.getWalletAndProgram();
    const [subject] = this.pda.subject(params.subjectId);

    const signature = await program.methods
      .createFreeSubject(params.subjectId, params.detailsCid, params.votingPeriod)
      .rpc();

    return { signature, accounts: { subject } };
  }

  /**
   * Add stake to a standalone subject
   */
  async addToStake(subject: PublicKey, stake: BN): Promise<TransactionResult> {
    const { wallet, program } = this.getWalletAndProgram();

    const signature = await program.methods
      .addToStake(stake)
      .accountsPartial({ subject })
      .rpc();

    return { signature };
  }

  // ===========================================================================
  // Juror Management
  // ===========================================================================

  /**
   * Register as a juror with initial stake
   */
  async registerJuror(stakeAmount: BN): Promise<TransactionResult> {
    const { wallet, program } = this.getWalletAndProgram();
    const [jurorAccount] = this.pda.jurorAccount(wallet.publicKey);

    const signature = await program.methods
      .registerJuror(stakeAmount)
      .rpc();

    return { signature, accounts: { jurorAccount } };
  }

  /**
   * Add more stake to juror account
   */
  async addJurorStake(amount: BN): Promise<TransactionResult> {
    const { wallet, program } = this.getWalletAndProgram();

    const signature = await program.methods
      .addJurorStake(amount)
      .rpc();

    return { signature };
  }

  /**
   * Withdraw available stake from juror account
   */
  async withdrawJurorStake(amount: BN): Promise<TransactionResult> {
    const { wallet, program } = this.getWalletAndProgram();

    const signature = await program.methods
      .withdrawJurorStake(amount)
      .rpc();

    return { signature };
  }

  /**
   * Unregister juror and withdraw all available stake
   */
  async unregisterJuror(): Promise<TransactionResult> {
    const { wallet, program } = this.getWalletAndProgram();

    const signature = await program.methods.unregisterJuror().rpc();

    return { signature };
  }

  // ===========================================================================
  // Dispute Management
  // ===========================================================================

  /**
   * Submit a new dispute against a subject
   */
  async submitDispute(params: {
    subject: PublicKey;
    disputeCount: number;
    defenderPool?: PublicKey;
    disputeType: DisputeType;
    detailsCid: string;
    bond: BN;
  }): Promise<TransactionResult> {
    const { wallet, program } = this.getWalletAndProgram();
    const [dispute] = this.pda.dispute(params.subject, params.disputeCount);
    const [challengerRecord] = this.pda.challengerRecord(
      dispute,
      wallet.publicKey
    );

    const signature = await program.methods
      .submitDispute(params.disputeType, params.detailsCid, params.bond)
      .accountsPartial({
        subject: params.subject,
        defenderPool: params.defenderPool ?? null,
      })
      .rpc();

    return { signature, accounts: { dispute, challengerRecord } };
  }

  /**
   * Submit a free dispute (no bond required)
   */
  async submitFreeDispute(params: {
    subject: PublicKey;
    disputeCount: number;
    disputeType: DisputeType;
    detailsCid: string;
  }): Promise<TransactionResult> {
    const { wallet, program } = this.getWalletAndProgram();
    const [dispute] = this.pda.dispute(params.subject, params.disputeCount);
    const [challengerRecord] = this.pda.challengerRecord(
      dispute,
      wallet.publicKey
    );

    const signature = await program.methods
      .submitFreeDispute(params.disputeType, params.detailsCid)
      .accountsPartial({ subject: params.subject })
      .rpc();

    return { signature, accounts: { dispute, challengerRecord } };
  }

  /**
   * Add to existing dispute (additional challengers)
   */
  async addToDispute(params: {
    subject: PublicKey;
    dispute: PublicKey;
    defenderPool?: PublicKey;
    detailsCid: string;
    bond: BN;
  }): Promise<TransactionResult> {
    const { wallet, program } = this.getWalletAndProgram();
    const [challengerRecord] = this.pda.challengerRecord(
      params.dispute,
      wallet.publicKey
    );

    const signature = await program.methods
      .addToDispute(params.detailsCid, params.bond)
      .accountsPartial({
        subject: params.subject,
        dispute: params.dispute,
        defenderPool: params.defenderPool ?? null,
      })
      .rpc();

    return { signature, accounts: { challengerRecord } };
  }

  /**
   * Submit an appeal against an invalidated subject
   */
  async submitAppeal(params: {
    subject: PublicKey;
    disputeCount: number;
    disputeType: DisputeType;
    detailsCid: string;
    stakeAmount: BN;
  }): Promise<TransactionResult> {
    const { wallet, program } = this.getWalletAndProgram();
    const [dispute] = this.pda.dispute(params.subject, params.disputeCount);

    const signature = await program.methods
      .submitAppeal(params.disputeType, params.detailsCid, params.stakeAmount)
      .accountsPartial({ subject: params.subject })
      .rpc();

    return { signature, accounts: { dispute } };
  }

  // ===========================================================================
  // Voting
  // ===========================================================================

  /**
   * Vote on a dispute
   */
  async voteOnDispute(params: {
    dispute: PublicKey;
    choice: VoteChoice;
    stakeAllocation: BN;
    rationaleCid?: string;
  }): Promise<TransactionResult> {
    const { wallet, program } = this.getWalletAndProgram();
    const [voteRecord] = this.pda.voteRecord(params.dispute, wallet.publicKey);

    const signature = await program.methods
      .voteOnDispute(
        params.choice,
        params.stakeAllocation,
        params.rationaleCid ?? ""
      )
      .accountsPartial({ dispute: params.dispute })
      .rpc();

    return { signature, accounts: { voteRecord } };
  }

  /**
   * Vote on an appeal
   */
  async voteOnAppeal(params: {
    dispute: PublicKey;
    choice: AppealVoteChoice;
    stakeAllocation: BN;
    rationaleCid?: string;
  }): Promise<TransactionResult> {
    const { wallet, program } = this.getWalletAndProgram();
    const [voteRecord] = this.pda.voteRecord(params.dispute, wallet.publicKey);

    const signature = await program.methods
      .voteOnAppeal(
        params.choice,
        params.stakeAllocation,
        params.rationaleCid ?? ""
      )
      .accountsPartial({ dispute: params.dispute })
      .rpc();

    return { signature, accounts: { voteRecord } };
  }

  /**
   * Add more stake to an existing vote
   */
  async addToVote(params: {
    dispute: PublicKey;
    subject: PublicKey;
    additionalStake: BN;
  }): Promise<TransactionResult> {
    const { wallet, program } = this.getWalletAndProgram();

    const signature = await program.methods
      .addToVote(params.additionalStake)
      .accountsPartial({
        dispute: params.dispute,
        subject: params.subject,
      })
      .rpc();

    return { signature };
  }

  // ===========================================================================
  // Resolution
  // ===========================================================================

  /**
   * Resolve a dispute after voting period ends (permissionless)
   */
  async resolveDispute(params: {
    dispute: PublicKey;
    subject: PublicKey;
  }): Promise<TransactionResult> {
    const { wallet, program } = this.getWalletAndProgram();
    const [protocolConfig] = this.pda.protocolConfig();
    const [escrow] = this.pda.escrow(params.dispute);

    // Fetch treasury address
    const configAccount = await this.fetchProtocolConfig();
    if (!configAccount) {
      throw new Error("Protocol config not initialized");
    }

    const signature = await program.methods
      .resolveDispute()
      .accountsPartial({
        dispute: params.dispute,
        subject: params.subject,
        escrow,
        protocolConfig,
        treasury: configAccount.treasury,
      })
      .rpc();

    return { signature };
  }

  /**
   * Unlock juror stake after 7-day buffer
   */
  async unlockJurorStake(params: {
    dispute: PublicKey;
    voteRecord: PublicKey;
  }): Promise<TransactionResult> {
    const { wallet, program } = this.getWalletAndProgram();

    const signature = await program.methods
      .unlockJurorStake()
      .accountsPartial({
        dispute: params.dispute,
        voteRecord: params.voteRecord,
      })
      .rpc();

    return { signature };
  }

  /**
   * Claim juror reward (processes reputation + distributes reward)
   */
  async claimJurorReward(params: {
    dispute: PublicKey;
    subject: PublicKey;
    voteRecord: PublicKey;
  }): Promise<TransactionResult> {
    const { wallet, program } = this.getWalletAndProgram();
    const [escrow] = this.pda.escrow(params.dispute);

    const signature = await program.methods
      .claimJurorReward()
      .accountsPartial({
        dispute: params.dispute,
        subject: params.subject,
        escrow,
        voteRecord: params.voteRecord,
      })
      .rpc();

    return { signature };
  }

  /**
   * Claim challenger reward (if dispute upheld)
   */
  async claimChallengerReward(params: {
    dispute: PublicKey;
    subject: PublicKey;
    challengerRecord: PublicKey;
  }): Promise<TransactionResult> {
    const { wallet, program } = this.getWalletAndProgram();
    const [escrow] = this.pda.escrow(params.dispute);

    const signature = await program.methods
      .claimChallengerReward()
      .accountsPartial({
        dispute: params.dispute,
        subject: params.subject,
        escrow,
        challengerRecord: params.challengerRecord,
      })
      .rpc();

    return { signature };
  }

  /**
   * Claim defender reward (if dispute dismissed)
   */
  async claimDefenderReward(params: {
    dispute: PublicKey;
    subject: PublicKey;
    defenderRecord: PublicKey;
  }): Promise<TransactionResult> {
    const { wallet, program } = this.getWalletAndProgram();
    const [escrow] = this.pda.escrow(params.dispute);

    const signature = await program.methods
      .claimDefenderReward()
      .accountsPartial({
        dispute: params.dispute,
        subject: params.subject,
        escrow,
        defenderRecord: params.defenderRecord,
      })
      .rpc();

    return { signature };
  }

  /**
   * Close escrow after all claims are complete
   */
  async closeEscrow(dispute: PublicKey): Promise<TransactionResult> {
    const { wallet, program } = this.getWalletAndProgram();
    const [escrow] = this.pda.escrow(dispute);
    const [protocolConfig] = this.pda.protocolConfig();

    const configAccount = await this.fetchProtocolConfig();
    if (!configAccount) {
      throw new Error("Protocol config not initialized");
    }

    const signature = await program.methods
      .closeEscrow()
      .accountsPartial({
        dispute,
        escrow,
        protocolConfig,
        treasury: configAccount.treasury,
      })
      .rpc();

    return { signature };
  }

  // ===========================================================================
  // Account Fetchers
  // ===========================================================================

  /**
   * Fetch protocol config
   */
  async fetchProtocolConfig(): Promise<ProtocolConfig | null> {
    const [address] = this.pda.protocolConfig();
    try {
      return (await this.anchorProgram.account.protocolConfig.fetch(
        address
      )) as ProtocolConfig;
    } catch {
      return null;
    }
  }

  /**
   * Fetch defender pool by address
   */
  async fetchDefenderPool(address: PublicKey): Promise<DefenderPool | null> {
    try {
      return (await this.anchorProgram.account.defenderPool.fetch(
        address
      )) as DefenderPool;
    } catch {
      return null;
    }
  }

  /**
   * Fetch defender pool by owner
   */
  async fetchDefenderPoolByOwner(owner: PublicKey): Promise<DefenderPool | null> {
    const [address] = this.pda.defenderPool(owner);
    return this.fetchDefenderPool(address);
  }

  /**
   * Fetch subject by address
   */
  async fetchSubject(address: PublicKey): Promise<Subject | null> {
    try {
      return (await this.anchorProgram.account.subject.fetch(
        address
      )) as Subject | null;
    } catch {
      return null;
    }
  }

  /**
   * Fetch subject by subject ID
   */
  async fetchSubjectById(subjectId: PublicKey): Promise<Subject | null> {
    const [address] = this.pda.subject(subjectId);
    return this.fetchSubject(address);
  }

  /**
   * Fetch dispute by address
   */
  async fetchDispute(address: PublicKey): Promise<Dispute | null> {
    try {
      return (await this.anchorProgram.account.dispute.fetch(
        address
      )) as Dispute | null;
    } catch {
      return null;
    }
  }

  /**
   * Fetch dispute escrow
   */
  async fetchEscrow(dispute: PublicKey): Promise<DisputeEscrow | null> {
    const [address] = this.pda.escrow(dispute);
    try {
      return (await this.anchorProgram.account.disputeEscrow.fetch(
        address
      )) as DisputeEscrow | null;
    } catch {
      return null;
    }
  }

  /**
   * Fetch juror account by address
   */
  async fetchJurorAccount(address: PublicKey): Promise<JurorAccount | null> {
    try {
      return (await this.anchorProgram.account.jurorAccount.fetch(
        address
      )) as JurorAccount | null;
    } catch {
      return null;
    }
  }

  /**
   * Fetch juror account by juror pubkey
   */
  async fetchJurorByPubkey(juror: PublicKey): Promise<JurorAccount | null> {
    const [address] = this.pda.jurorAccount(juror);
    return this.fetchJurorAccount(address);
  }

  /**
   * Fetch vote record
   */
  async fetchVoteRecord(address: PublicKey): Promise<VoteRecord | null> {
    try {
      return (await this.anchorProgram.account.voteRecord.fetch(
        address
      )) as VoteRecord | null;
    } catch {
      return null;
    }
  }

  /**
   * Fetch vote record for a dispute and juror
   */
  async fetchVoteRecordByDisputeAndJuror(
    dispute: PublicKey,
    juror: PublicKey
  ): Promise<VoteRecord | null> {
    const [address] = this.pda.voteRecord(dispute, juror);
    return this.fetchVoteRecord(address);
  }

  /**
   * Fetch challenger account
   */
  async fetchChallengerAccount(
    address: PublicKey
  ): Promise<ChallengerAccount | null> {
    try {
      return (await this.anchorProgram.account.challengerAccount.fetch(
        address
      )) as ChallengerAccount | null;
    } catch {
      return null;
    }
  }

  /**
   * Fetch challenger record
   */
  async fetchChallengerRecord(
    address: PublicKey
  ): Promise<ChallengerRecord | null> {
    try {
      return (await this.anchorProgram.account.challengerRecord.fetch(
        address
      )) as ChallengerRecord | null;
    } catch {
      return null;
    }
  }

  /**
   * Fetch defender record
   */
  async fetchDefenderRecord(address: PublicKey): Promise<DefenderRecord | null> {
    try {
      return (await this.anchorProgram.account.defenderRecord.fetch(
        address
      )) as DefenderRecord | null;
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // Bulk Fetchers
  // ===========================================================================

  /**
   * Fetch all defender pools
   */
  async fetchAllDefenderPools(): Promise<
    Array<{ publicKey: PublicKey; account: DefenderPool }>
  > {
        const accounts = await this.anchorProgram.account.defenderPool.all();
    return accounts as Array<{ publicKey: PublicKey; account: DefenderPool }>;
  }

  /**
   * Fetch all subjects
   */
  async fetchAllSubjects(): Promise<
    Array<{ publicKey: PublicKey; account: Subject }>
  > {
        const accounts = await this.anchorProgram.account.subject.all();
    return accounts as Array<{ publicKey: PublicKey; account: Subject }>;
  }

  /**
   * Fetch all disputes
   */
  async fetchAllDisputes(): Promise<
    Array<{ publicKey: PublicKey; account: Dispute }>
  > {
        const accounts = await this.anchorProgram.account.dispute.all();
    return accounts as Array<{ publicKey: PublicKey; account: Dispute }>;
  }

  /**
   * Fetch all juror accounts
   */
  async fetchAllJurors(): Promise<
    Array<{ publicKey: PublicKey; account: JurorAccount }>
  > {
        const accounts = await this.anchorProgram.account.jurorAccount.all();
    return accounts as Array<{ publicKey: PublicKey; account: JurorAccount }>;
  }

  /**
   * Fetch disputes by subject
   */
  async fetchDisputesBySubject(
    subject: PublicKey
  ): Promise<Array<{ publicKey: PublicKey; account: Dispute }>> {
        const accounts = await this.anchorProgram.account.dispute.all([
      { memcmp: { offset: 8, bytes: subject.toBase58() } },
    ]);
    return accounts as Array<{ publicKey: PublicKey; account: Dispute }>;
  }

  /**
   * Fetch votes by dispute
   */
  async fetchVotesByDispute(
    dispute: PublicKey
  ): Promise<Array<{ publicKey: PublicKey; account: VoteRecord }>> {
        const accounts = await this.anchorProgram.account.voteRecord.all([
      { memcmp: { offset: 8, bytes: dispute.toBase58() } },
    ]);
    return accounts as Array<{ publicKey: PublicKey; account: VoteRecord }>;
  }

  /**
   * Fetch challengers by dispute
   */
  async fetchChallengersByDispute(
    dispute: PublicKey
  ): Promise<Array<{ publicKey: PublicKey; account: ChallengerRecord }>> {
        const accounts = await this.anchorProgram.account.challengerRecord.all([
      { memcmp: { offset: 8, bytes: dispute.toBase58() } },
    ]);
    return accounts as Array<{
      publicKey: PublicKey;
      account: ChallengerRecord;
    }>;
  }
}
