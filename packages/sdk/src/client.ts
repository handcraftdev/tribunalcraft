import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  Keypair,
  SendOptions,
  VersionedTransaction,
  SimulatedTransactionResponse,
} from "@solana/web3.js";
import { Program, AnchorProvider, BN, Wallet, translateError } from "@coral-xyz/anchor";
import { PDA } from "./pda";
import { PROGRAM_ID } from "./constants";
import type { Tribunalcraft } from "./idl-types";
import type {
  ProtocolConfig,
  DefenderPool,
  Subject,
  Dispute,
  // NOTE: DisputeEscrow removed - no escrow in simplified model
  JurorAccount,
  VoteRecord,
  ChallengerAccount,
  ChallengerRecord,
  DefenderRecord,
  DisputeType,
  VoteChoice,
  RestoreVoteChoice,
} from "./types";
import idl from "./idl.json";

// Error codes from the program
const ERROR_CODES: Record<number, string> = {
  6000: "Unauthorized",
  6001: "InvalidConfig",
  6002: "StakeBelowMinimum",
  6003: "BondBelowMinimum",
  6004: "InsufficientStake",
  6005: "InsufficientAvailableStake",
  6006: "StakeLocked",
  6007: "SubjectCannotBeDisputed",
  6008: "SubjectCannotBeStaked",
  6009: "DisputeAlreadyExists",
  6010: "DisputeNotFound",
  6011: "DisputeAlreadyResolved",
  6012: "VotingNotStarted",
  6013: "VotingEnded",
  6014: "VotingNotEnded",
  6015: "AlreadyVoted",
  6016: "InvalidVoteChoice",
  6017: "RewardAlreadyClaimed",
  6018: "NotOnWinningSide",
  6019: "InvalidSubjectStatus",
  6020: "AppealNotAllowed",
  6021: "AppealAlreadyExists",
  6022: "NotRestorer",
  6023: "RestorationFailed",
};

export interface SimulationResult {
  success: boolean;
  error?: string;
  errorCode?: number;
  logs?: string[];
  unitsConsumed?: number;
}

export interface TribunalCraftClientConfig {
  connection: Connection;
  wallet?: Wallet;
  programId?: PublicKey;
  /** If true, all transactions will be simulated before sending */
  simulateFirst?: boolean;
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
  public simulateFirst: boolean;
  private wallet: Wallet | null;
  private anchorProgram: Program<Tribunalcraft>;

  constructor(config: TribunalCraftClientConfig) {
    this.connection = config.connection;
    this.programId = config.programId ?? PROGRAM_ID;
    this.pda = new PDA(this.programId);
    this.wallet = config.wallet ?? null;
    this.simulateFirst = config.simulateFirst ?? false;

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
  // Transaction Simulation
  // ===========================================================================

  /**
   * Parse program error from simulation logs
   */
  private parseErrorFromLogs(logs: string[]): { code?: number; message: string } {
    for (const log of logs) {
      // Look for custom program error
      const customErrorMatch = log.match(/Program log: AnchorError.*Error Code: (\w+)\. Error Number: (\d+)\. Error Message: (.+)\./);
      if (customErrorMatch) {
        const errorCode = parseInt(customErrorMatch[2], 10);
        const errorMessage = customErrorMatch[3];
        return { code: errorCode, message: `${customErrorMatch[1]}: ${errorMessage}` };
      }

      // Look for error number pattern
      const errorNumberMatch = log.match(/Error Number: (\d+)/);
      if (errorNumberMatch) {
        const code = parseInt(errorNumberMatch[1], 10);
        const message = ERROR_CODES[code] || `Unknown error (${code})`;
        return { code, message };
      }

      // Look for instruction error
      const instructionErrorMatch = log.match(/Program.*failed: custom program error: 0x([0-9a-fA-F]+)/);
      if (instructionErrorMatch) {
        const code = parseInt(instructionErrorMatch[1], 16);
        const message = ERROR_CODES[code] || `Custom error 0x${instructionErrorMatch[1]}`;
        return { code, message };
      }

      // Look for generic error message
      if (log.includes("Error:") || log.includes("failed:")) {
        return { message: log };
      }
    }
    return { message: "Transaction simulation failed" };
  }

  /**
   * Simulate a transaction and return detailed results
   */
  async simulateTransaction(
    tx: Transaction | VersionedTransaction
  ): Promise<SimulationResult> {
    try {
      let response: SimulatedTransactionResponse;

      if (tx instanceof Transaction) {
        // Legacy transaction
        const { blockhash } = await this.connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = this.wallet?.publicKey;

        const result = await this.connection.simulateTransaction(tx);
        response = result.value;
      } else {
        // Versioned transaction
        const result = await this.connection.simulateTransaction(tx);
        response = result.value;
      }

      if (response.err) {
        const { code, message } = this.parseErrorFromLogs(response.logs || []);
        return {
          success: false,
          error: message,
          errorCode: code,
          logs: response.logs || [],
          unitsConsumed: response.unitsConsumed,
        };
      }

      return {
        success: true,
        logs: response.logs || [],
        unitsConsumed: response.unitsConsumed,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        logs: [],
      };
    }
  }

  /**
   * Build and simulate a method call without sending
   * Returns simulation result with parsed errors
   */
  async simulateMethod(
    methodName: string,
    args: unknown[],
    accounts?: Record<string, PublicKey | null>
  ): Promise<SimulationResult> {
    const { program } = this.getWalletAndProgram();

    try {
      // Build the instruction
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const method = (program.methods as unknown as Record<string, (...args: any[]) => any>)[methodName](...args);
      if (accounts) {
        method.accountsPartial(accounts);
      }

      // Get the transaction
      const tx = await method.transaction();

      return this.simulateTransaction(tx);
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        logs: [],
      };
    }
  }

  /**
   * Helper to run RPC with optional simulation first
   * Wraps Anchor's rpc() call with simulation check using Anchor's simulate()
   */
  private async rpcWithSimulation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    methodBuilder: {
      simulate: () => Promise<any>;
      rpc: () => Promise<string>;
    },
    actionName: string
  ): Promise<string> {
    if (this.simulateFirst) {
      console.log(`[Simulation] ${actionName}...`);
      try {
        const simResult = await methodBuilder.simulate();
        console.log(`[Simulation] ${actionName} passed`);
        if (simResult.raw && simResult.raw.length > 0) {
          // Log last few lines for debugging
          console.log("[Simulation] Logs:", simResult.raw.slice(-5).join("\n"));
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const { code, message } = this.parseErrorFromLogs([errorMessage]);

        // Try to extract logs from the error
        let logs: string[] = [];
        if (err && typeof err === "object" && "logs" in err) {
          logs = (err as { logs: string[] }).logs || [];
        }
        if (logs.length === 0 && err && typeof err === "object" && "simulationResponse" in err) {
          const simResponse = (err as { simulationResponse: { logs?: string[] } }).simulationResponse;
          logs = simResponse?.logs || [];
        }

        // Parse error from logs if available
        const parsedError = logs.length > 0 ? this.parseErrorFromLogs(logs) : { message: errorMessage };

        const errorMsg = `Simulation failed for ${actionName}: ${parsedError.message}`;
        console.error(errorMsg);
        if (logs.length > 0) {
          console.error("Logs:", logs.slice(-10).join("\n"));
        }
        throw new Error(errorMsg);
      }
    }

    return methodBuilder.rpc();
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
   * Create a subject - unified method that handles all subject types
   *
   * All staked subjects are linked to the creator's defender pool.
   * Pool is auto-created by the program if it doesn't exist.
   *
   * Subject type is determined by params:
   * - freeCase: true → creates free subject (no stakes, no pool)
   * - otherwise → creates linked subject (pool auto-created if needed)
   */
  async createSubject(params: {
    subjectId: PublicKey;
    detailsCid: string;
    votingPeriod: BN;
    // Optional - for staked subjects
    maxStake?: BN;
    matchMode?: boolean;
    stake?: BN; // Initial stake to add after creation
    // Optional - for free subjects
    freeCase?: boolean;
  }): Promise<TransactionResult> {
    const { wallet, program } = this.getWalletAndProgram();
    const [subject] = this.pda.subject(params.subjectId);

    // Free subject - no stakes required, no pool
    if (params.freeCase) {
      const signature = await program.methods
        .createFreeSubject(params.subjectId, params.detailsCid, params.votingPeriod)
        .rpc();
      return { signature, accounts: { subject } };
    }

    // Staked subject - always linked to creator's pool (auto-created if needed)
    const [defenderPool] = this.pda.defenderPool(wallet.publicKey);

    const signature = await program.methods
      .createLinkedSubject(
        params.subjectId,
        params.detailsCid,
        params.maxStake ?? new BN(0),
        params.matchMode ?? true,
        false, // freeCase
        params.votingPeriod
      )
      .accountsPartial({
        defenderPool,
      })
      .rpc();

    // Add initial stake if provided
    if (params.stake && !params.stake.isZero()) {
      await this.addToStake(subject, params.stake);
    }

    return { signature, accounts: { subject, defenderPool } };
  }

  /**
   * Add stake to a standalone subject
   * If subject has active dispute in proportional mode, pass dispute, protocolConfig, and treasury
   * Fees are deducted in proportional mode during active dispute
   */
  async addToStake(
    subject: PublicKey,
    stake: BN,
    proportionalDispute?: {
      dispute: PublicKey;
      treasury: PublicKey;
    }
  ): Promise<TransactionResult> {
    const { wallet, program } = this.getWalletAndProgram();
    const [protocolConfig] = this.pda.protocolConfig();

    const signature = await program.methods
      .addToStake(stake)
      .accountsPartial({
        subject,
        dispute: proportionalDispute?.dispute ?? null,
        protocolConfig: proportionalDispute ? protocolConfig : null,
        treasury: proportionalDispute?.treasury ?? null,
      })
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
    poolOwner?: PublicKey;
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

    // Derive pool owner's defender record if pool owner is provided
    const poolOwnerDefenderRecord = params.poolOwner
      ? this.pda.defenderRecord(params.subject, params.poolOwner)[0]
      : null;

    // Get protocol config and treasury
    const [protocolConfig] = this.pda.protocolConfig();
    const protocolConfigAccount = await program.account.protocolConfig.fetch(protocolConfig);
    const treasury = protocolConfigAccount.treasury;

    const methodBuilder = program.methods
      .submitDispute(params.disputeType, params.detailsCid, params.bond)
      .accountsPartial({
        subject: params.subject,
        defenderPool: params.defenderPool ?? null,
        poolOwnerDefenderRecord,
        protocolConfig,
        treasury,
      });

    const signature = await this.rpcWithSimulation(methodBuilder, "submitDispute");

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
    poolOwner?: PublicKey;
    detailsCid: string;
    bond: BN;
  }): Promise<TransactionResult> {
    const { wallet, program } = this.getWalletAndProgram();
    const [challengerRecord] = this.pda.challengerRecord(
      params.dispute,
      wallet.publicKey
    );

    // Derive pool owner's defender record if pool owner is provided
    const poolOwnerDefenderRecord = params.poolOwner
      ? this.pda.defenderRecord(params.subject, params.poolOwner)[0]
      : null;

    // Get protocol config and treasury
    const [protocolConfig] = this.pda.protocolConfig();
    const protocolConfigAccount = await program.account.protocolConfig.fetch(protocolConfig);
    const treasury = protocolConfigAccount.treasury;

    const signature = await program.methods
      .addToDispute(params.detailsCid, params.bond)
      .accountsPartial({
        subject: params.subject,
        dispute: params.dispute,
        defenderPool: params.defenderPool ?? null,
        poolOwnerDefenderRecord,
        protocolConfig,
        treasury,
      })
      .rpc();

    return { signature, accounts: { challengerRecord } };
  }

  /**
   * Submit a restoration request against an invalidated subject
   * Platform fee (1%) is collected upfront to treasury
   */
  async submitRestore(params: {
    subject: PublicKey;
    disputeCount: number;
    disputeType: DisputeType;
    detailsCid: string;
    stakeAmount: BN;
  }): Promise<TransactionResult> {
    const { wallet, program } = this.getWalletAndProgram();
    const [dispute] = this.pda.dispute(params.subject, params.disputeCount);
    const [protocolConfig] = this.pda.protocolConfig();

    // Fetch protocol config to get treasury address
    const config = await this.fetchProtocolConfig();
    if (!config) {
      throw new Error("Protocol config not initialized");
    }

    const methodBuilder = program.methods
      .submitRestore(params.disputeType, params.detailsCid, params.stakeAmount)
      .accountsPartial({
        subject: params.subject,
        protocolConfig,
        treasury: config.treasury,
      });

    const signature = await this.rpcWithSimulation(methodBuilder, "submitRestore");

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

    const methodBuilder = program.methods
      .voteOnDispute(
        params.choice,
        params.stakeAllocation,
        params.rationaleCid ?? ""
      )
      .accountsPartial({ dispute: params.dispute });

    const signature = await this.rpcWithSimulation(methodBuilder, "voteOnDispute");

    return { signature, accounts: { voteRecord } };
  }

  /**
   * Vote on a restoration request
   */
  async voteOnRestore(params: {
    dispute: PublicKey;
    choice: RestoreVoteChoice;
    stakeAllocation: BN;
    rationaleCid?: string;
  }): Promise<TransactionResult> {
    const { wallet, program } = this.getWalletAndProgram();
    const [voteRecord] = this.pda.voteRecord(params.dispute, wallet.publicKey);

    const methodBuilder = program.methods
      .voteOnRestore(
        params.choice,
        params.stakeAllocation,
        params.rationaleCid ?? ""
      )
      .accountsPartial({ dispute: params.dispute });

    const signature = await this.rpcWithSimulation(methodBuilder, "voteOnRestore");

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

    const methodBuilder = program.methods
      .resolveDispute()
      .accountsPartial({
        dispute: params.dispute,
        subject: params.subject,
      });

    const signature = await this.rpcWithSimulation(methodBuilder, "resolveDispute");

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

    const signature = await program.methods
      .claimJurorReward()
      .accountsPartial({
        dispute: params.dispute,
        subject: params.subject,
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

    const signature = await program.methods
      .claimChallengerReward()
      .accountsPartial({
        dispute: params.dispute,
        subject: params.subject,
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

    const signature = await program.methods
      .claimDefenderReward()
      .accountsPartial({
        dispute: params.dispute,
        subject: params.subject,
        defenderRecord: params.defenderRecord,
      })
      .rpc();

    return { signature };
  }

  /**
   * Claim restorer refund for failed restoration request
   */
  async claimRestorerRefund(params: {
    dispute: PublicKey;
  }): Promise<TransactionResult> {
    const { wallet, program } = this.getWalletAndProgram();

    const signature = await program.methods
      .claimRestorerRefund()
      .accountsPartial({
        dispute: params.dispute,
      })
      .rpc();

    return { signature };
  }

  // NOTE: closeEscrow removed - no escrow in simplified model

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

  // NOTE: fetchEscrow removed - no escrow in simplified model

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
   * Fetch all disputes (with error handling for old account formats)
   */
  async fetchAllDisputes(): Promise<
    Array<{ publicKey: PublicKey; account: Dispute }>
  > {
    try {
      const accounts = await this.anchorProgram.account.dispute.all();
      return accounts as Array<{ publicKey: PublicKey; account: Dispute }>;
    } catch (err) {
      // If batch fetch fails (likely due to old account format),
      // return empty array - new disputes will be created with correct format
      console.warn("Failed to fetch disputes:", err);
      return [];
    }
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
