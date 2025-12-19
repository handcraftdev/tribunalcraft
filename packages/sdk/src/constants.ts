import { PublicKey } from "@solana/web3.js";

// Program ID
export const PROGRAM_ID = new PublicKey(
  "H78rc6j9eVazT5gXekn1ydCtFdjLLyRFJdBCYT6Dh9AN"
);

// PDA Seeds
export const PROTOCOL_CONFIG_SEED = Buffer.from("protocol_config");
export const DEFENDER_POOL_SEED = Buffer.from("defender_pool");
export const SUBJECT_SEED = Buffer.from("subject");
export const JUROR_SEED = Buffer.from("juror");
export const DISPUTE_SEED = Buffer.from("dispute");
// NOTE: ESCROW_SEED removed - no escrow in simplified model
export const CHALLENGER_SEED = Buffer.from("challenger");
export const CHALLENGER_RECORD_SEED = Buffer.from("challenger_record");
export const DEFENDER_RECORD_SEED = Buffer.from("defender_record");
export const VOTE_RECORD_SEED = Buffer.from("vote");

// Fee Constants (basis points)
export const TOTAL_FEE_BPS = 2000; // 20% fee from total pool
export const PLATFORM_SHARE_BPS = 500; // 5% of fees -> platform (1% of total)
export const JUROR_SHARE_BPS = 9500; // 95% of fees -> jurors (19% of total)
export const WINNER_SHARE_BPS = 8000; // 80% of loser's contribution -> winner

// Stake Constants
export const MIN_JUROR_STAKE = 100_000_000; // 0.1 SOL in lamports
export const MIN_CHALLENGER_BOND = 100_000_000; // 0.1 SOL in lamports
export const MIN_DEFENDER_STAKE = 100_000_000; // 0.1 SOL in lamports

// Time Constants
export const STAKE_UNLOCK_BUFFER = 7 * 24 * 60 * 60; // 7 days in seconds
export const MIN_VOTING_PERIOD = 24 * 60 * 60; // 1 day in seconds
export const MAX_VOTING_PERIOD = 30 * 24 * 60 * 60; // 30 days in seconds

// Reputation Constants
export const INITIAL_REPUTATION = 5000; // 50% (basis points)
export const REPUTATION_GAIN_RATE = 500; // 5% gain rate
export const REPUTATION_LOSS_RATE = 1000; // 10% loss rate
