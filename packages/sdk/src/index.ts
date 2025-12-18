// Main Client
export { TribunalCraftClient } from "./client";
export type { TribunalCraftClientConfig, TransactionResult } from "./client";

// PDA Helpers
export { PDA, pda } from "./pda";

// Types
export type {
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
  SubjectStatus,
  DisputeStatus,
  ResolutionOutcome,
  DisputeType,
  VoteChoice,
  RestoreVoteChoice,
} from "./types";

// Enum Helpers
export {
  SubjectStatusEnum,
  DisputeStatusEnum,
  ResolutionOutcomeEnum,
  DisputeTypeEnum,
  VoteChoiceEnum,
  RestoreVoteChoiceEnum,
  // Type Guards
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
  // Name Getters
  getDisputeTypeName,
  getOutcomeName,
  // Effective Status Helpers
  canLinkedSubjectBeDisputed,
  getEffectiveStatus,
} from "./types";

// Constants
export {
  PROGRAM_ID,
  // PDA Seeds
  PROTOCOL_CONFIG_SEED,
  DEFENDER_POOL_SEED,
  SUBJECT_SEED,
  JUROR_SEED,
  DISPUTE_SEED,
  // NOTE: ESCROW_SEED removed - no escrow in simplified model
  CHALLENGER_SEED,
  CHALLENGER_RECORD_SEED,
  DEFENDER_RECORD_SEED,
  VOTE_RECORD_SEED,
  // Fee Constants
  TOTAL_FEE_BPS,
  PLATFORM_SHARE_BPS,
  JUROR_SHARE_BPS,
  WINNER_SHARE_BPS,
  // Stake Constants
  MIN_JUROR_STAKE,
  MIN_CHALLENGER_BOND,
  MIN_DEFENDER_STAKE,
  // Time Constants
  STAKE_UNLOCK_BUFFER,
  MIN_VOTING_PERIOD,
  MAX_VOTING_PERIOD,
  // Reputation Constants
  INITIAL_REPUTATION,
  REPUTATION_GAIN_RATE,
  REPUTATION_LOSS_RATE,
} from "./constants";

// IDL (for advanced usage)
export { default as IDL } from "./idl.json";
export type { Tribunalcraft } from "./idl-types";
