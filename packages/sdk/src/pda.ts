import { PublicKey } from "@solana/web3.js";
import {
  PROGRAM_ID,
  PROTOCOL_CONFIG_SEED,
  DEFENDER_POOL_SEED,
  SUBJECT_SEED,
  JUROR_SEED,
  DISPUTE_SEED,
  CHALLENGER_SEED,
  CHALLENGER_RECORD_SEED,
  DEFENDER_RECORD_SEED,
  VOTE_RECORD_SEED,
} from "./constants";

/**
 * PDA derivation helpers for TribunalCraft accounts
 */
export class PDA {
  constructor(private programId: PublicKey = PROGRAM_ID) {}

  /**
   * Derive Protocol Config PDA
   */
  protocolConfig(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [PROTOCOL_CONFIG_SEED],
      this.programId
    );
  }

  /**
   * Derive Defender Pool PDA for an owner
   */
  defenderPool(owner: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [DEFENDER_POOL_SEED, owner.toBuffer()],
      this.programId
    );
  }

  /**
   * Derive Subject PDA for a subject ID
   */
  subject(subjectId: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [SUBJECT_SEED, subjectId.toBuffer()],
      this.programId
    );
  }

  /**
   * Derive Juror Account PDA for a juror
   */
  jurorAccount(juror: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [JUROR_SEED, juror.toBuffer()],
      this.programId
    );
  }

  /**
   * Derive Dispute PDA for a subject and dispute count
   */
  dispute(subject: PublicKey, disputeCount: number): [PublicKey, number] {
    const countBuffer = Buffer.alloc(4);
    countBuffer.writeUInt32LE(disputeCount);
    return PublicKey.findProgramAddressSync(
      [DISPUTE_SEED, subject.toBuffer(), countBuffer],
      this.programId
    );
  }

  // NOTE: escrow PDA removed - no escrow in simplified model

  /**
   * Derive Challenger Account PDA
   */
  challengerAccount(challenger: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [CHALLENGER_SEED, challenger.toBuffer()],
      this.programId
    );
  }

  /**
   * Derive Challenger Record PDA for a dispute
   */
  challengerRecord(
    dispute: PublicKey,
    challenger: PublicKey
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [CHALLENGER_RECORD_SEED, dispute.toBuffer(), challenger.toBuffer()],
      this.programId
    );
  }

  /**
   * Derive Defender Record PDA for a subject
   */
  defenderRecord(subject: PublicKey, defender: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [DEFENDER_RECORD_SEED, subject.toBuffer(), defender.toBuffer()],
      this.programId
    );
  }

  /**
   * Derive Vote Record PDA for a dispute
   */
  voteRecord(dispute: PublicKey, juror: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [VOTE_RECORD_SEED, dispute.toBuffer(), juror.toBuffer()],
      this.programId
    );
  }
}

// Export a default instance
export const pda = new PDA();
