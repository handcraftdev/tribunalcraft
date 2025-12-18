"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  CHALLENGER_RECORD_SEED: () => CHALLENGER_RECORD_SEED,
  CHALLENGER_SEED: () => CHALLENGER_SEED,
  DEFENDER_POOL_SEED: () => DEFENDER_POOL_SEED,
  DEFENDER_RECORD_SEED: () => DEFENDER_RECORD_SEED,
  DISPUTE_SEED: () => DISPUTE_SEED,
  DisputeStatusEnum: () => DisputeStatusEnum,
  DisputeTypeEnum: () => DisputeTypeEnum,
  IDL: () => idl_default,
  INITIAL_REPUTATION: () => INITIAL_REPUTATION,
  JUROR_SEED: () => JUROR_SEED,
  JUROR_SHARE_BPS: () => JUROR_SHARE_BPS,
  MAX_VOTING_PERIOD: () => MAX_VOTING_PERIOD,
  MIN_CHALLENGER_BOND: () => MIN_CHALLENGER_BOND,
  MIN_DEFENDER_STAKE: () => MIN_DEFENDER_STAKE,
  MIN_JUROR_STAKE: () => MIN_JUROR_STAKE,
  MIN_VOTING_PERIOD: () => MIN_VOTING_PERIOD,
  PDA: () => PDA,
  PLATFORM_SHARE_BPS: () => PLATFORM_SHARE_BPS,
  PROGRAM_ID: () => PROGRAM_ID,
  PROTOCOL_CONFIG_SEED: () => PROTOCOL_CONFIG_SEED,
  REPUTATION_GAIN_RATE: () => REPUTATION_GAIN_RATE,
  REPUTATION_LOSS_RATE: () => REPUTATION_LOSS_RATE,
  ResolutionOutcomeEnum: () => ResolutionOutcomeEnum,
  RestoreVoteChoiceEnum: () => RestoreVoteChoiceEnum,
  STAKE_UNLOCK_BUFFER: () => STAKE_UNLOCK_BUFFER,
  SUBJECT_SEED: () => SUBJECT_SEED,
  SubjectStatusEnum: () => SubjectStatusEnum,
  TOTAL_FEE_BPS: () => TOTAL_FEE_BPS,
  TribunalCraftClient: () => TribunalCraftClient,
  VOTE_RECORD_SEED: () => VOTE_RECORD_SEED,
  VoteChoiceEnum: () => VoteChoiceEnum,
  WINNER_SHARE_BPS: () => WINNER_SHARE_BPS,
  canLinkedSubjectBeDisputed: () => canLinkedSubjectBeDisputed,
  getDisputeTypeName: () => getDisputeTypeName,
  getEffectiveStatus: () => getEffectiveStatus,
  getOutcomeName: () => getOutcomeName,
  isChallengerWins: () => isChallengerWins,
  isDefenderWins: () => isDefenderWins,
  isDisputePending: () => isDisputePending,
  isDisputeResolved: () => isDisputeResolved,
  isNoParticipation: () => isNoParticipation,
  isSubjectDisputed: () => isSubjectDisputed,
  isSubjectDormant: () => isSubjectDormant,
  isSubjectInvalid: () => isSubjectInvalid,
  isSubjectRestoring: () => isSubjectRestoring,
  isSubjectValid: () => isSubjectValid,
  pda: () => pda
});
module.exports = __toCommonJS(index_exports);

// src/client.ts
var import_web33 = require("@solana/web3.js");
var import_anchor = require("@coral-xyz/anchor");

// src/pda.ts
var import_web32 = require("@solana/web3.js");

// src/constants.ts
var import_web3 = require("@solana/web3.js");
var PROGRAM_ID = new import_web3.PublicKey(
  "4b9qTHcLrkjURroj8X9TCr8xKPNqDT7pNrCqi9brLiZX"
);
var PROTOCOL_CONFIG_SEED = Buffer.from("protocol_config");
var DEFENDER_POOL_SEED = Buffer.from("defender_pool");
var SUBJECT_SEED = Buffer.from("subject");
var JUROR_SEED = Buffer.from("juror");
var DISPUTE_SEED = Buffer.from("dispute");
var CHALLENGER_SEED = Buffer.from("challenger");
var CHALLENGER_RECORD_SEED = Buffer.from("challenger_record");
var DEFENDER_RECORD_SEED = Buffer.from("defender_record");
var VOTE_RECORD_SEED = Buffer.from("vote");
var TOTAL_FEE_BPS = 2e3;
var PLATFORM_SHARE_BPS = 500;
var JUROR_SHARE_BPS = 9500;
var WINNER_SHARE_BPS = 8e3;
var MIN_JUROR_STAKE = 1e8;
var MIN_CHALLENGER_BOND = 1e8;
var MIN_DEFENDER_STAKE = 1e8;
var STAKE_UNLOCK_BUFFER = 7 * 24 * 60 * 60;
var MIN_VOTING_PERIOD = 24 * 60 * 60;
var MAX_VOTING_PERIOD = 30 * 24 * 60 * 60;
var INITIAL_REPUTATION = 5e3;
var REPUTATION_GAIN_RATE = 500;
var REPUTATION_LOSS_RATE = 1e3;

// src/pda.ts
var PDA = class {
  constructor(programId = PROGRAM_ID) {
    this.programId = programId;
  }
  /**
   * Derive Protocol Config PDA
   */
  protocolConfig() {
    return import_web32.PublicKey.findProgramAddressSync(
      [PROTOCOL_CONFIG_SEED],
      this.programId
    );
  }
  /**
   * Derive Defender Pool PDA for an owner
   */
  defenderPool(owner) {
    return import_web32.PublicKey.findProgramAddressSync(
      [DEFENDER_POOL_SEED, owner.toBuffer()],
      this.programId
    );
  }
  /**
   * Derive Subject PDA for a subject ID
   */
  subject(subjectId) {
    return import_web32.PublicKey.findProgramAddressSync(
      [SUBJECT_SEED, subjectId.toBuffer()],
      this.programId
    );
  }
  /**
   * Derive Juror Account PDA for a juror
   */
  jurorAccount(juror) {
    return import_web32.PublicKey.findProgramAddressSync(
      [JUROR_SEED, juror.toBuffer()],
      this.programId
    );
  }
  /**
   * Derive Dispute PDA for a subject and dispute count
   */
  dispute(subject, disputeCount) {
    const countBuffer = Buffer.alloc(4);
    countBuffer.writeUInt32LE(disputeCount);
    return import_web32.PublicKey.findProgramAddressSync(
      [DISPUTE_SEED, subject.toBuffer(), countBuffer],
      this.programId
    );
  }
  // NOTE: escrow PDA removed - no escrow in simplified model
  /**
   * Derive Challenger Account PDA
   */
  challengerAccount(challenger) {
    return import_web32.PublicKey.findProgramAddressSync(
      [CHALLENGER_SEED, challenger.toBuffer()],
      this.programId
    );
  }
  /**
   * Derive Challenger Record PDA for a dispute
   */
  challengerRecord(dispute, challenger) {
    return import_web32.PublicKey.findProgramAddressSync(
      [CHALLENGER_RECORD_SEED, dispute.toBuffer(), challenger.toBuffer()],
      this.programId
    );
  }
  /**
   * Derive Defender Record PDA for a subject
   */
  defenderRecord(subject, defender) {
    return import_web32.PublicKey.findProgramAddressSync(
      [DEFENDER_RECORD_SEED, subject.toBuffer(), defender.toBuffer()],
      this.programId
    );
  }
  /**
   * Derive Vote Record PDA for a dispute
   */
  voteRecord(dispute, juror) {
    return import_web32.PublicKey.findProgramAddressSync(
      [VOTE_RECORD_SEED, dispute.toBuffer(), juror.toBuffer()],
      this.programId
    );
  }
};
var pda = new PDA();

// src/idl.json
var idl_default = {
  address: "4b9qTHcLrkjURroj8X9TCr8xKPNqDT7pNrCqi9brLiZX",
  metadata: {
    name: "tribunalcraft",
    version: "0.1.0",
    spec: "0.1.0",
    description: "Decentralized arbitration protocol"
  },
  instructions: [
    {
      name: "add_juror_stake",
      docs: [
        "Add more stake to juror account"
      ],
      discriminator: [
        42,
        194,
        234,
        159,
        186,
        115,
        32,
        169
      ],
      accounts: [
        {
          name: "juror",
          writable: true,
          signer: true,
          relations: [
            "juror_account"
          ]
        },
        {
          name: "juror_account",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  106,
                  117,
                  114,
                  111,
                  114
                ]
              },
              {
                kind: "account",
                path: "juror"
              }
            ]
          }
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: [
        {
          name: "amount",
          type: "u64"
        }
      ]
    },
    {
      name: "add_to_dispute",
      docs: [
        "Add to existing dispute (additional challengers)"
      ],
      discriminator: [
        110,
        2,
        131,
        29,
        204,
        133,
        164,
        234
      ],
      accounts: [
        {
          name: "challenger",
          writable: true,
          signer: true
        },
        {
          name: "subject",
          writable: true,
          relations: [
            "dispute"
          ]
        },
        {
          name: "defender_pool",
          docs: [
            "Optional: defender pool if subject is linked"
          ],
          writable: true,
          optional: true
        },
        {
          name: "pool_owner_defender_record",
          docs: [
            "Optional: DefenderRecord for pool owner (required if pool has stake to transfer)"
          ],
          writable: true,
          optional: true
        },
        {
          name: "challenger_account",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  99,
                  104,
                  97,
                  108,
                  108,
                  101,
                  110,
                  103,
                  101,
                  114
                ]
              },
              {
                kind: "account",
                path: "challenger"
              }
            ]
          }
        },
        {
          name: "dispute",
          writable: true
        },
        {
          name: "challenger_record",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  99,
                  104,
                  97,
                  108,
                  108,
                  101,
                  110,
                  103,
                  101,
                  114,
                  95,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100
                ]
              },
              {
                kind: "account",
                path: "dispute"
              },
              {
                kind: "account",
                path: "challenger"
              }
            ]
          }
        },
        {
          name: "protocol_config",
          docs: [
            "Protocol config for treasury address"
          ],
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          name: "treasury",
          docs: [
            "Treasury receives fees"
          ],
          writable: true
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: [
        {
          name: "details_cid",
          type: "string"
        },
        {
          name: "bond",
          type: "u64"
        }
      ]
    },
    {
      name: "add_to_stake",
      docs: [
        "Add stake to a standalone subject"
      ],
      discriminator: [
        227,
        50,
        25,
        66,
        59,
        214,
        58,
        213
      ],
      accounts: [
        {
          name: "staker",
          writable: true,
          signer: true
        },
        {
          name: "subject",
          writable: true
        },
        {
          name: "defender_record",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  100,
                  101,
                  102,
                  101,
                  110,
                  100,
                  101,
                  114,
                  95,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100
                ]
              },
              {
                kind: "account",
                path: "subject"
              },
              {
                kind: "account",
                path: "staker"
              }
            ]
          }
        },
        {
          name: "dispute",
          docs: [
            "Optional: Active dispute (required if subject has active dispute in proportional mode)"
          ],
          writable: true,
          optional: true
        },
        {
          name: "protocol_config",
          docs: [
            "Protocol config for treasury address (required if proportional dispute)"
          ],
          optional: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          name: "treasury",
          docs: [
            "Treasury receives fees (required if proportional dispute)"
          ],
          writable: true,
          optional: true
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: [
        {
          name: "stake",
          type: "u64"
        }
      ]
    },
    {
      name: "add_to_vote",
      docs: [
        "Add more stake to an existing vote"
      ],
      discriminator: [
        202,
        66,
        94,
        152,
        90,
        103,
        240,
        68
      ],
      accounts: [
        {
          name: "juror",
          writable: true,
          signer: true,
          relations: [
            "juror_account",
            "vote_record"
          ]
        },
        {
          name: "juror_account",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  106,
                  117,
                  114,
                  111,
                  114
                ]
              },
              {
                kind: "account",
                path: "juror"
              }
            ]
          }
        },
        {
          name: "subject",
          relations: [
            "dispute"
          ]
        },
        {
          name: "dispute",
          writable: true,
          relations: [
            "vote_record"
          ]
        },
        {
          name: "vote_record",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  118,
                  111,
                  116,
                  101
                ]
              },
              {
                kind: "account",
                path: "dispute"
              },
              {
                kind: "account",
                path: "juror"
              }
            ]
          }
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: [
        {
          name: "additional_stake",
          type: "u64"
        }
      ]
    },
    {
      name: "claim_challenger_reward",
      docs: [
        "Claim challenger reward (if dispute upheld)"
      ],
      discriminator: [
        173,
        143,
        119,
        13,
        142,
        25,
        102,
        36
      ],
      accounts: [
        {
          name: "challenger",
          writable: true,
          signer: true,
          relations: [
            "challenger_record"
          ]
        },
        {
          name: "challenger_account",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  99,
                  104,
                  97,
                  108,
                  108,
                  101,
                  110,
                  103,
                  101,
                  114
                ]
              },
              {
                kind: "account",
                path: "challenger"
              }
            ]
          }
        },
        {
          name: "subject",
          writable: true,
          relations: [
            "dispute"
          ]
        },
        {
          name: "dispute",
          writable: true,
          relations: [
            "challenger_record"
          ]
        },
        {
          name: "challenger_record",
          writable: true
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: []
    },
    {
      name: "claim_defender_reward",
      docs: [
        "Claim defender reward (if dispute dismissed)"
      ],
      discriminator: [
        189,
        13,
        90,
        154,
        251,
        183,
        166,
        135
      ],
      accounts: [
        {
          name: "defender",
          writable: true,
          signer: true,
          relations: [
            "defender_record"
          ]
        },
        {
          name: "subject",
          writable: true,
          relations: [
            "dispute",
            "defender_record"
          ]
        },
        {
          name: "dispute",
          writable: true
        },
        {
          name: "defender_record",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  100,
                  101,
                  102,
                  101,
                  110,
                  100,
                  101,
                  114,
                  95,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100
                ]
              },
              {
                kind: "account",
                path: "subject"
              },
              {
                kind: "account",
                path: "defender"
              }
            ]
          }
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: []
    },
    {
      name: "claim_juror_reward",
      docs: [
        "Claim juror reward for correct vote"
      ],
      discriminator: [
        220,
        82,
        126,
        176,
        119,
        103,
        33,
        25
      ],
      accounts: [
        {
          name: "juror",
          writable: true,
          signer: true,
          relations: [
            "juror_account",
            "vote_record"
          ]
        },
        {
          name: "juror_account",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  106,
                  117,
                  114,
                  111,
                  114
                ]
              },
              {
                kind: "account",
                path: "juror"
              }
            ]
          }
        },
        {
          name: "subject",
          writable: true,
          relations: [
            "dispute"
          ]
        },
        {
          name: "dispute",
          writable: true,
          relations: [
            "vote_record"
          ]
        },
        {
          name: "vote_record",
          writable: true
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: []
    },
    {
      name: "claim_restorer_refund",
      docs: [
        "Claim restorer refund for failed restoration request"
      ],
      discriminator: [
        100,
        102,
        249,
        204,
        60,
        72,
        242,
        87
      ],
      accounts: [
        {
          name: "restorer",
          writable: true,
          signer: true
        },
        {
          name: "dispute",
          writable: true
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: []
    },
    {
      name: "create_free_subject",
      docs: [
        "Create a free subject (no stake required, just Subject account)"
      ],
      discriminator: [
        131,
        154,
        217,
        251,
        107,
        165,
        155,
        197
      ],
      accounts: [
        {
          name: "creator",
          writable: true,
          signer: true
        },
        {
          name: "subject",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  115,
                  117,
                  98,
                  106,
                  101,
                  99,
                  116
                ]
              },
              {
                kind: "arg",
                path: "subject_id"
              }
            ]
          }
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: [
        {
          name: "subject_id",
          type: "pubkey"
        },
        {
          name: "details_cid",
          type: "string"
        },
        {
          name: "voting_period",
          type: "i64"
        }
      ]
    },
    {
      name: "create_linked_subject",
      docs: [
        "Create a subject linked to a defender pool"
      ],
      discriminator: [
        42,
        140,
        162,
        241,
        23,
        166,
        71,
        51
      ],
      accounts: [
        {
          name: "owner",
          writable: true,
          signer: true,
          relations: [
            "defender_pool"
          ]
        },
        {
          name: "defender_pool",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  100,
                  101,
                  102,
                  101,
                  110,
                  100,
                  101,
                  114,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                kind: "account",
                path: "owner"
              }
            ]
          }
        },
        {
          name: "subject",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  115,
                  117,
                  98,
                  106,
                  101,
                  99,
                  116
                ]
              },
              {
                kind: "arg",
                path: "subject_id"
              }
            ]
          }
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: [
        {
          name: "subject_id",
          type: "pubkey"
        },
        {
          name: "details_cid",
          type: "string"
        },
        {
          name: "max_stake",
          type: "u64"
        },
        {
          name: "match_mode",
          type: "bool"
        },
        {
          name: "free_case",
          type: "bool"
        },
        {
          name: "voting_period",
          type: "i64"
        }
      ]
    },
    {
      name: "create_pool",
      docs: [
        "Create a defender pool with initial stake"
      ],
      discriminator: [
        233,
        146,
        209,
        142,
        207,
        104,
        64,
        188
      ],
      accounts: [
        {
          name: "owner",
          writable: true,
          signer: true
        },
        {
          name: "defender_pool",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  100,
                  101,
                  102,
                  101,
                  110,
                  100,
                  101,
                  114,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                kind: "account",
                path: "owner"
              }
            ]
          }
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: [
        {
          name: "initial_stake",
          type: "u64"
        }
      ]
    },
    {
      name: "create_subject",
      docs: [
        "Create a standalone subject with initial stake"
      ],
      discriminator: [
        243,
        24,
        101,
        208,
        170,
        5,
        242,
        26
      ],
      accounts: [
        {
          name: "creator",
          writable: true,
          signer: true
        },
        {
          name: "subject",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  115,
                  117,
                  98,
                  106,
                  101,
                  99,
                  116
                ]
              },
              {
                kind: "arg",
                path: "subject_id"
              }
            ]
          }
        },
        {
          name: "defender_record",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  100,
                  101,
                  102,
                  101,
                  110,
                  100,
                  101,
                  114,
                  95,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100
                ]
              },
              {
                kind: "account",
                path: "subject"
              },
              {
                kind: "account",
                path: "creator"
              }
            ]
          }
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: [
        {
          name: "subject_id",
          type: "pubkey"
        },
        {
          name: "details_cid",
          type: "string"
        },
        {
          name: "max_stake",
          type: "u64"
        },
        {
          name: "match_mode",
          type: "bool"
        },
        {
          name: "free_case",
          type: "bool"
        },
        {
          name: "voting_period",
          type: "i64"
        },
        {
          name: "stake",
          type: "u64"
        }
      ]
    },
    {
      name: "initialize_config",
      docs: [
        "Initialize protocol config (one-time setup by deployer)"
      ],
      discriminator: [
        208,
        127,
        21,
        1,
        194,
        190,
        196,
        70
      ],
      accounts: [
        {
          name: "authority",
          writable: true,
          signer: true
        },
        {
          name: "config",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: []
    },
    {
      name: "register_juror",
      docs: [
        "Register as a juror with initial stake"
      ],
      discriminator: [
        116,
        81,
        98,
        42,
        220,
        219,
        2,
        141
      ],
      accounts: [
        {
          name: "juror",
          writable: true,
          signer: true
        },
        {
          name: "juror_account",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  106,
                  117,
                  114,
                  111,
                  114
                ]
              },
              {
                kind: "account",
                path: "juror"
              }
            ]
          }
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: [
        {
          name: "stake_amount",
          type: "u64"
        }
      ]
    },
    {
      name: "resolve_dispute",
      docs: [
        "Resolve a dispute after voting period ends"
      ],
      discriminator: [
        231,
        6,
        202,
        6,
        96,
        103,
        12,
        230
      ],
      accounts: [
        {
          name: "resolver",
          writable: true,
          signer: true
        },
        {
          name: "dispute",
          writable: true
        },
        {
          name: "subject",
          writable: true,
          relations: [
            "dispute"
          ]
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: []
    },
    {
      name: "stake_pool",
      docs: [
        "Add stake to an existing pool"
      ],
      discriminator: [
        186,
        105,
        178,
        191,
        181,
        236,
        39,
        162
      ],
      accounts: [
        {
          name: "owner",
          writable: true,
          signer: true,
          relations: [
            "defender_pool"
          ]
        },
        {
          name: "defender_pool",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  100,
                  101,
                  102,
                  101,
                  110,
                  100,
                  101,
                  114,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                kind: "account",
                path: "owner"
              }
            ]
          }
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: [
        {
          name: "amount",
          type: "u64"
        }
      ]
    },
    {
      name: "submit_dispute",
      docs: [
        "Submit a new dispute against a subject (first challenger)"
      ],
      discriminator: [
        216,
        199,
        236,
        25,
        212,
        79,
        19,
        19
      ],
      accounts: [
        {
          name: "challenger",
          writable: true,
          signer: true
        },
        {
          name: "subject",
          writable: true
        },
        {
          name: "defender_pool",
          docs: [
            "Optional: defender pool if subject is linked"
          ],
          writable: true,
          optional: true
        },
        {
          name: "pool_owner_defender_record",
          docs: [
            "Optional: DefenderRecord for pool owner (required if pool has stake to transfer)"
          ],
          writable: true,
          optional: true
        },
        {
          name: "challenger_account",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  99,
                  104,
                  97,
                  108,
                  108,
                  101,
                  110,
                  103,
                  101,
                  114
                ]
              },
              {
                kind: "account",
                path: "challenger"
              }
            ]
          }
        },
        {
          name: "dispute",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  100,
                  105,
                  115,
                  112,
                  117,
                  116,
                  101
                ]
              },
              {
                kind: "account",
                path: "subject"
              },
              {
                kind: "account",
                path: "subject.dispute_count",
                account: "Subject"
              }
            ]
          }
        },
        {
          name: "challenger_record",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  99,
                  104,
                  97,
                  108,
                  108,
                  101,
                  110,
                  103,
                  101,
                  114,
                  95,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100
                ]
              },
              {
                kind: "account",
                path: "dispute"
              },
              {
                kind: "account",
                path: "challenger"
              }
            ]
          }
        },
        {
          name: "protocol_config",
          docs: [
            "Protocol config for treasury address"
          ],
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          name: "treasury",
          docs: [
            "Treasury receives fees"
          ],
          writable: true
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: [
        {
          name: "dispute_type",
          type: {
            defined: {
              name: "DisputeType"
            }
          }
        },
        {
          name: "details_cid",
          type: "string"
        },
        {
          name: "bond",
          type: "u64"
        }
      ]
    },
    {
      name: "submit_free_dispute",
      docs: [
        "Submit a free dispute (no bond required, just Dispute account)"
      ],
      discriminator: [
        140,
        225,
        220,
        24,
        64,
        19,
        209,
        197
      ],
      accounts: [
        {
          name: "challenger",
          writable: true,
          signer: true
        },
        {
          name: "subject",
          writable: true
        },
        {
          name: "dispute",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  100,
                  105,
                  115,
                  112,
                  117,
                  116,
                  101
                ]
              },
              {
                kind: "account",
                path: "subject"
              },
              {
                kind: "account",
                path: "subject.dispute_count",
                account: "Subject"
              }
            ]
          }
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: [
        {
          name: "dispute_type",
          type: {
            defined: {
              name: "DisputeType"
            }
          }
        },
        {
          name: "details_cid",
          type: "string"
        }
      ]
    },
    {
      name: "submit_restore",
      docs: [
        "Submit a restoration request against an invalidated subject",
        "Restorations allow community to reverse previous invalidation decisions",
        "Restorer stakes (no bond required), voting period is 2x previous"
      ],
      discriminator: [
        32,
        59,
        202,
        78,
        224,
        183,
        80,
        191
      ],
      accounts: [
        {
          name: "restorer",
          writable: true,
          signer: true
        },
        {
          name: "subject",
          writable: true
        },
        {
          name: "dispute",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  100,
                  105,
                  115,
                  112,
                  117,
                  116,
                  101
                ]
              },
              {
                kind: "account",
                path: "subject"
              },
              {
                kind: "account",
                path: "subject.dispute_count",
                account: "Subject"
              }
            ]
          }
        },
        {
          name: "protocol_config",
          docs: [
            "Protocol config for treasury address"
          ],
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          name: "treasury",
          docs: [
            "Treasury receives platform fee"
          ],
          writable: true
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: [
        {
          name: "dispute_type",
          type: {
            defined: {
              name: "DisputeType"
            }
          }
        },
        {
          name: "details_cid",
          type: "string"
        },
        {
          name: "stake_amount",
          type: "u64"
        }
      ]
    },
    {
      name: "unlock_juror_stake",
      docs: [
        "Unlock juror stake after 7-day buffer"
      ],
      discriminator: [
        109,
        73,
        56,
        32,
        115,
        125,
        5,
        242
      ],
      accounts: [
        {
          name: "juror",
          writable: true,
          signer: true,
          relations: [
            "juror_account",
            "vote_record"
          ]
        },
        {
          name: "juror_account",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  106,
                  117,
                  114,
                  111,
                  114
                ]
              },
              {
                kind: "account",
                path: "juror"
              }
            ]
          }
        },
        {
          name: "dispute",
          relations: [
            "vote_record"
          ]
        },
        {
          name: "vote_record",
          writable: true
        }
      ],
      args: []
    },
    {
      name: "unregister_juror",
      docs: [
        "Unregister juror and withdraw all available stake"
      ],
      discriminator: [
        199,
        200,
        113,
        139,
        182,
        118,
        206,
        124
      ],
      accounts: [
        {
          name: "juror",
          writable: true,
          signer: true,
          relations: [
            "juror_account"
          ]
        },
        {
          name: "juror_account",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  106,
                  117,
                  114,
                  111,
                  114
                ]
              },
              {
                kind: "account",
                path: "juror"
              }
            ]
          }
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: []
    },
    {
      name: "update_treasury",
      docs: [
        "Update treasury address (admin only)"
      ],
      discriminator: [
        60,
        16,
        243,
        66,
        96,
        59,
        254,
        131
      ],
      accounts: [
        {
          name: "authority",
          writable: true,
          signer: true,
          relations: [
            "config"
          ]
        },
        {
          name: "config",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      args: [
        {
          name: "new_treasury",
          type: "pubkey"
        }
      ]
    },
    {
      name: "vote_on_dispute",
      docs: [
        "Vote on a dispute with stake allocation"
      ],
      discriminator: [
        7,
        213,
        96,
        171,
        252,
        59,
        55,
        23
      ],
      accounts: [
        {
          name: "juror",
          writable: true,
          signer: true,
          relations: [
            "juror_account"
          ]
        },
        {
          name: "juror_account",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  106,
                  117,
                  114,
                  111,
                  114
                ]
              },
              {
                kind: "account",
                path: "juror"
              }
            ]
          }
        },
        {
          name: "subject",
          relations: [
            "dispute"
          ]
        },
        {
          name: "dispute",
          writable: true
        },
        {
          name: "vote_record",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  118,
                  111,
                  116,
                  101
                ]
              },
              {
                kind: "account",
                path: "dispute"
              },
              {
                kind: "account",
                path: "juror"
              }
            ]
          }
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: [
        {
          name: "choice",
          type: {
            defined: {
              name: "VoteChoice"
            }
          }
        },
        {
          name: "stake_allocation",
          type: "u64"
        },
        {
          name: "rationale_cid",
          type: "string"
        }
      ]
    },
    {
      name: "vote_on_restore",
      docs: [
        "Vote on a restoration with stake allocation",
        "ForRestoration = vote to restore subject to Valid",
        "AgainstRestoration = vote to keep subject Invalidated"
      ],
      discriminator: [
        122,
        123,
        92,
        240,
        251,
        205,
        189,
        32
      ],
      accounts: [
        {
          name: "juror",
          writable: true,
          signer: true,
          relations: [
            "juror_account"
          ]
        },
        {
          name: "juror_account",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  106,
                  117,
                  114,
                  111,
                  114
                ]
              },
              {
                kind: "account",
                path: "juror"
              }
            ]
          }
        },
        {
          name: "subject",
          relations: [
            "dispute"
          ]
        },
        {
          name: "dispute",
          writable: true
        },
        {
          name: "vote_record",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  118,
                  111,
                  116,
                  101
                ]
              },
              {
                kind: "account",
                path: "dispute"
              },
              {
                kind: "account",
                path: "juror"
              }
            ]
          }
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: [
        {
          name: "choice",
          type: {
            defined: {
              name: "RestoreVoteChoice"
            }
          }
        },
        {
          name: "stake_allocation",
          type: "u64"
        },
        {
          name: "rationale_cid",
          type: "string"
        }
      ]
    },
    {
      name: "withdraw_juror_stake",
      docs: [
        "Withdraw available stake (with reputation-based slashing)"
      ],
      discriminator: [
        178,
        43,
        144,
        250,
        188,
        199,
        135,
        133
      ],
      accounts: [
        {
          name: "juror",
          writable: true,
          signer: true,
          relations: [
            "juror_account"
          ]
        },
        {
          name: "juror_account",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  106,
                  117,
                  114,
                  111,
                  114
                ]
              },
              {
                kind: "account",
                path: "juror"
              }
            ]
          }
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: [
        {
          name: "amount",
          type: "u64"
        }
      ]
    },
    {
      name: "withdraw_pool",
      docs: [
        "Withdraw available stake from pool"
      ],
      discriminator: [
        190,
        43,
        148,
        248,
        68,
        5,
        215,
        136
      ],
      accounts: [
        {
          name: "owner",
          writable: true,
          signer: true,
          relations: [
            "defender_pool"
          ]
        },
        {
          name: "defender_pool",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  100,
                  101,
                  102,
                  101,
                  110,
                  100,
                  101,
                  114,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                kind: "account",
                path: "owner"
              }
            ]
          }
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: [
        {
          name: "amount",
          type: "u64"
        }
      ]
    }
  ],
  accounts: [
    {
      name: "ChallengerAccount",
      discriminator: [
        63,
        207,
        170,
        69,
        229,
        2,
        163,
        201
      ]
    },
    {
      name: "ChallengerRecord",
      discriminator: [
        8,
        80,
        134,
        108,
        192,
        142,
        121,
        14
      ]
    },
    {
      name: "DefenderPool",
      discriminator: [
        227,
        100,
        92,
        157,
        203,
        252,
        63,
        118
      ]
    },
    {
      name: "DefenderRecord",
      discriminator: [
        14,
        3,
        219,
        215,
        38,
        254,
        254,
        92
      ]
    },
    {
      name: "Dispute",
      discriminator: [
        36,
        49,
        241,
        67,
        40,
        36,
        241,
        74
      ]
    },
    {
      name: "JurorAccount",
      discriminator: [
        138,
        222,
        50,
        194,
        222,
        131,
        255,
        186
      ]
    },
    {
      name: "ProtocolConfig",
      discriminator: [
        207,
        91,
        250,
        28,
        152,
        179,
        215,
        209
      ]
    },
    {
      name: "Subject",
      discriminator: [
        52,
        161,
        41,
        165,
        202,
        238,
        138,
        166
      ]
    },
    {
      name: "VoteRecord",
      discriminator: [
        112,
        9,
        123,
        165,
        234,
        9,
        157,
        167
      ]
    }
  ],
  errors: [
    {
      code: 6e3,
      name: "Unauthorized",
      msg: "Unauthorized"
    },
    {
      code: 6001,
      name: "InvalidConfig",
      msg: "Invalid configuration parameter"
    },
    {
      code: 6002,
      name: "StakeBelowMinimum",
      msg: "Stake amount below minimum"
    },
    {
      code: 6003,
      name: "InsufficientAvailableStake",
      msg: "Insufficient available stake"
    },
    {
      code: 6004,
      name: "InsufficientHeldStake",
      msg: "Insufficient held stake"
    },
    {
      code: 6005,
      name: "StakeStillLocked",
      msg: "Stake still locked"
    },
    {
      code: 6006,
      name: "StakeAlreadyUnlocked",
      msg: "Stake already unlocked"
    },
    {
      code: 6007,
      name: "BondBelowMinimum",
      msg: "Bond amount below minimum"
    },
    {
      code: 6008,
      name: "BondExceedsAvailable",
      msg: "Bond exceeds staker's available pool"
    },
    {
      code: 6009,
      name: "SubjectCannotBeStaked",
      msg: "Subject cannot accept stakes"
    },
    {
      code: 6010,
      name: "SubjectCannotBeDisputed",
      msg: "Subject cannot be disputed"
    },
    {
      code: 6011,
      name: "SubjectCannotBeRestored",
      msg: "Subject cannot be restored"
    },
    {
      code: 6012,
      name: "RestoreStakeBelowMinimum",
      msg: "Restore stake below minimum (must match previous dispute total)"
    },
    {
      code: 6013,
      name: "NotARestore",
      msg: "This dispute is not a restoration request"
    },
    {
      code: 6014,
      name: "CannotSelfDispute",
      msg: "Cannot dispute own subject"
    },
    {
      code: 6015,
      name: "DisputeAlreadyExists",
      msg: "Dispute already exists for this subject"
    },
    {
      code: 6016,
      name: "DisputeNotFound",
      msg: "Dispute not found"
    },
    {
      code: 6017,
      name: "DisputeAlreadyResolved",
      msg: "Dispute already resolved"
    },
    {
      code: 6018,
      name: "VotingNotEnded",
      msg: "Voting period not ended"
    },
    {
      code: 6019,
      name: "VotingEnded",
      msg: "Voting period has ended"
    },
    {
      code: 6020,
      name: "CannotVoteOnOwnDispute",
      msg: "Cannot vote on own dispute"
    },
    {
      code: 6021,
      name: "AlreadyVoted",
      msg: "Already voted on this dispute"
    },
    {
      code: 6022,
      name: "VoteAllocationBelowMinimum",
      msg: "Vote allocation below minimum"
    },
    {
      code: 6023,
      name: "InvalidVoteChoice",
      msg: "Invalid vote choice"
    },
    {
      code: 6024,
      name: "JurorNotActive",
      msg: "Juror not active"
    },
    {
      code: 6025,
      name: "JurorAlreadyRegistered",
      msg: "Juror already registered"
    },
    {
      code: 6026,
      name: "ChallengerNotFound",
      msg: "Challenger not found"
    },
    {
      code: 6027,
      name: "RewardAlreadyClaimed",
      msg: "Reward already claimed"
    },
    {
      code: 6028,
      name: "NotEligibleForReward",
      msg: "Not eligible for reward"
    },
    {
      code: 6029,
      name: "ReputationAlreadyProcessed",
      msg: "Reputation already processed"
    },
    {
      code: 6030,
      name: "ArithmeticOverflow",
      msg: "Arithmetic overflow"
    },
    {
      code: 6031,
      name: "DivisionByZero",
      msg: "Division by zero"
    },
    {
      code: 6032,
      name: "ClaimsNotComplete",
      msg: "Not all claims have been processed"
    }
  ],
  types: [
    {
      name: "ChallengerAccount",
      docs: [
        "Challenger account tracking reputation - global per wallet"
      ],
      type: {
        kind: "struct",
        fields: [
          {
            name: "challenger",
            docs: [
              "Challenger's wallet address"
            ],
            type: "pubkey"
          },
          {
            name: "reputation",
            docs: [
              "Reputation score (basis points)"
            ],
            type: "u16"
          },
          {
            name: "disputes_submitted",
            docs: [
              "Total disputes submitted"
            ],
            type: "u64"
          },
          {
            name: "disputes_upheld",
            docs: [
              "Disputes that were upheld (challenger was correct)"
            ],
            type: "u64"
          },
          {
            name: "disputes_dismissed",
            docs: [
              "Disputes that were dismissed (challenger was wrong)"
            ],
            type: "u64"
          },
          {
            name: "bump",
            docs: [
              "Bump seed for PDA"
            ],
            type: "u8"
          },
          {
            name: "created_at",
            docs: [
              "First dispute timestamp"
            ],
            type: "i64"
          },
          {
            name: "last_dispute_at",
            docs: [
              "Last dispute timestamp"
            ],
            type: "i64"
          }
        ]
      }
    },
    {
      name: "ChallengerRecord",
      docs: [
        "Individual challenger's contribution to a dispute",
        "Supports cumulative disputes where multiple challengers contribute"
      ],
      type: {
        kind: "struct",
        fields: [
          {
            name: "dispute",
            docs: [
              "The dispute this record belongs to"
            ],
            type: "pubkey"
          },
          {
            name: "challenger",
            docs: [
              "Challenger's wallet address"
            ],
            type: "pubkey"
          },
          {
            name: "challenger_account",
            docs: [
              "Challenger account PDA"
            ],
            type: "pubkey"
          },
          {
            name: "bond",
            docs: [
              "Bond amount contributed by this challenger"
            ],
            type: "u64"
          },
          {
            name: "details_cid",
            docs: [
              "Evidence CID (IPFS hash)"
            ],
            type: "string"
          },
          {
            name: "reward_claimed",
            docs: [
              "Whether reward has been claimed"
            ],
            type: "bool"
          },
          {
            name: "bump",
            docs: [
              "Bump seed for PDA"
            ],
            type: "u8"
          },
          {
            name: "challenged_at",
            docs: [
              "Timestamp when this challenger joined"
            ],
            type: "i64"
          }
        ]
      }
    },
    {
      name: "DefenderPool",
      docs: [
        "Defender's pool that can back multiple subjects - global per wallet"
      ],
      type: {
        kind: "struct",
        fields: [
          {
            name: "owner",
            docs: [
              "Pool owner's wallet address"
            ],
            type: "pubkey"
          },
          {
            name: "total_stake",
            docs: [
              "Total stake deposited"
            ],
            type: "u64"
          },
          {
            name: "available",
            docs: [
              "Available stake (not held by disputes)"
            ],
            type: "u64"
          },
          {
            name: "held",
            docs: [
              "Held stake (locked by pending disputes)"
            ],
            type: "u64"
          },
          {
            name: "subject_count",
            docs: [
              "Number of subjects linked to this pool"
            ],
            type: "u32"
          },
          {
            name: "pending_disputes",
            docs: [
              "Number of pending disputes against subjects in this pool"
            ],
            type: "u32"
          },
          {
            name: "bump",
            docs: [
              "Bump seed for PDA"
            ],
            type: "u8"
          },
          {
            name: "created_at",
            docs: [
              "Creation timestamp"
            ],
            type: "i64"
          },
          {
            name: "updated_at",
            docs: [
              "Last update timestamp"
            ],
            type: "i64"
          }
        ]
      }
    },
    {
      name: "DefenderRecord",
      docs: [
        "Individual defender's contribution to backing a subject",
        "Supports cumulative staking where multiple defenders back a subject"
      ],
      type: {
        kind: "struct",
        fields: [
          {
            name: "subject",
            docs: [
              "The subject this record belongs to"
            ],
            type: "pubkey"
          },
          {
            name: "defender",
            docs: [
              "Defender's wallet address"
            ],
            type: "pubkey"
          },
          {
            name: "stake",
            docs: [
              "Total amount staked to back the subject (on subject account)"
            ],
            type: "u64"
          },
          {
            name: "stake_in_escrow",
            docs: [
              "Amount of stake currently at risk in escrow (during active dispute)",
              "This is the amount that will be used for claim calculations"
            ],
            type: "u64"
          },
          {
            name: "reward_claimed",
            docs: [
              "Whether reward has been claimed"
            ],
            type: "bool"
          },
          {
            name: "bump",
            docs: [
              "Bump seed for PDA"
            ],
            type: "u8"
          },
          {
            name: "staked_at",
            docs: [
              "Timestamp when this defender joined"
            ],
            type: "i64"
          }
        ]
      }
    },
    {
      name: "Dispute",
      docs: [
        "Dispute (supports cumulative challengers)"
      ],
      type: {
        kind: "struct",
        fields: [
          {
            name: "subject",
            docs: [
              "Subject account being disputed"
            ],
            type: "pubkey"
          },
          {
            name: "dispute_type",
            docs: [
              "Dispute type"
            ],
            type: {
              defined: {
                name: "DisputeType"
              }
            }
          },
          {
            name: "total_bond",
            docs: [
              "Total bond from all challengers (cumulative)"
            ],
            type: "u64"
          },
          {
            name: "stake_held",
            docs: [
              "Stake held from pool (match mode, linked subjects)"
            ],
            type: "u64"
          },
          {
            name: "direct_stake_held",
            docs: [
              "Stake held from direct stakers on subject (match mode)"
            ],
            type: "u64"
          },
          {
            name: "challenger_count",
            docs: [
              "Number of challengers who contributed"
            ],
            type: "u16"
          },
          {
            name: "status",
            docs: [
              "Dispute status"
            ],
            type: {
              defined: {
                name: "DisputeStatus"
              }
            }
          },
          {
            name: "outcome",
            docs: [
              "Resolution outcome"
            ],
            type: {
              defined: {
                name: "ResolutionOutcome"
              }
            }
          },
          {
            name: "votes_favor_weight",
            docs: [
              'Cumulative voting power for "ForChallenger" votes'
            ],
            type: "u64"
          },
          {
            name: "votes_against_weight",
            docs: [
              'Cumulative voting power for "ForDefender" votes'
            ],
            type: "u64"
          },
          {
            name: "vote_count",
            docs: [
              "Number of jurors who voted"
            ],
            type: "u16"
          },
          {
            name: "voting_started",
            docs: [
              "Whether voting has started (match mode waits for matching)"
            ],
            type: "bool"
          },
          {
            name: "voting_starts_at",
            docs: [
              "Voting start timestamp (0 if not started)"
            ],
            type: "i64"
          },
          {
            name: "voting_ends_at",
            docs: [
              "Voting end timestamp (0 if not started)"
            ],
            type: "i64"
          },
          {
            name: "resolved_at",
            docs: [
              "Resolution timestamp"
            ],
            type: "i64"
          },
          {
            name: "bump",
            docs: [
              "Bump seed for PDA"
            ],
            type: "u8"
          },
          {
            name: "created_at",
            docs: [
              "Creation timestamp"
            ],
            type: "i64"
          },
          {
            name: "pool_reward_claimed",
            docs: [
              "Pool reward claimed (for linked mode)"
            ],
            type: "bool"
          },
          {
            name: "snapshot_total_stake",
            docs: [
              "Snapshot of subject's total_stake at dispute creation"
            ],
            type: "u64"
          },
          {
            name: "snapshot_defender_count",
            docs: [
              "Snapshot of subject's defender_count at dispute creation"
            ],
            type: "u16"
          },
          {
            name: "challengers_claimed",
            docs: [
              "Number of challengers who have claimed their reward/refund"
            ],
            type: "u16"
          },
          {
            name: "defenders_claimed",
            docs: [
              "Number of direct defenders who have claimed their reward/refund"
            ],
            type: "u16"
          },
          {
            name: "is_restore",
            docs: [
              "True if this dispute is a restoration request (reverses the meaning of outcomes)"
            ],
            type: "bool"
          },
          {
            name: "restore_stake",
            docs: [
              "Stake posted by restorer (for restorations only)"
            ],
            type: "u64"
          },
          {
            name: "restorer",
            docs: [
              "Restorer's pubkey (for restorations only, used for refunds)"
            ],
            type: "pubkey"
          },
          {
            name: "details_cid",
            docs: [
              "Details CID for restoration requests (stored here since no ChallengerRecord)"
            ],
            type: "string"
          }
        ]
      }
    },
    {
      name: "DisputeStatus",
      docs: [
        "Dispute status"
      ],
      type: {
        kind: "enum",
        variants: [
          {
            name: "Pending"
          },
          {
            name: "Resolved"
          }
        ]
      }
    },
    {
      name: "DisputeType",
      docs: [
        "Dispute type (generic categories)"
      ],
      type: {
        kind: "enum",
        variants: [
          {
            name: "Other"
          },
          {
            name: "Breach"
          },
          {
            name: "Fraud"
          },
          {
            name: "QualityDispute"
          },
          {
            name: "NonDelivery"
          },
          {
            name: "Misrepresentation"
          },
          {
            name: "PolicyViolation"
          },
          {
            name: "DamagesClaim"
          }
        ]
      }
    },
    {
      name: "JurorAccount",
      docs: [
        "Juror (arbiter) account - global per wallet",
        "",
        "Balance Model:",
        "- `total_stake`: Total SOL held in this PDA (actual lamports)",
        "- `available_stake`: SOL available to vote or withdraw",
        "- Held (locked): `total_stake - available_stake` (locked in active disputes)",
        "",
        "SOL only transfers on deposit/withdraw. Voting is accounting only."
      ],
      type: {
        kind: "struct",
        fields: [
          {
            name: "juror",
            docs: [
              "Juror's wallet address"
            ],
            type: "pubkey"
          },
          {
            name: "total_stake",
            docs: [
              "Total stake held in this PDA (actual lamports)"
            ],
            type: "u64"
          },
          {
            name: "available_stake",
            docs: [
              "Available stake (not locked in active disputes)"
            ],
            type: "u64"
          },
          {
            name: "reputation",
            docs: [
              "Reputation score (basis points, 0-10000+)"
            ],
            type: "u16"
          },
          {
            name: "votes_cast",
            docs: [
              "Total votes cast"
            ],
            type: "u64"
          },
          {
            name: "correct_votes",
            docs: [
              "Correct votes (aligned with outcome)"
            ],
            type: "u64"
          },
          {
            name: "is_active",
            docs: [
              "Whether juror is active"
            ],
            type: "bool"
          },
          {
            name: "bump",
            docs: [
              "Bump seed for PDA"
            ],
            type: "u8"
          },
          {
            name: "joined_at",
            docs: [
              "Registration timestamp"
            ],
            type: "i64"
          },
          {
            name: "last_vote_at",
            docs: [
              "Last activity timestamp"
            ],
            type: "i64"
          }
        ]
      }
    },
    {
      name: "ProtocolConfig",
      docs: [
        "Protocol-wide configuration account",
        "Stores treasury address and admin authority for fee collection"
      ],
      type: {
        kind: "struct",
        fields: [
          {
            name: "authority",
            docs: [
              "Admin who can update config (deployer initially)"
            ],
            type: "pubkey"
          },
          {
            name: "treasury",
            docs: [
              "Platform fee recipient address"
            ],
            type: "pubkey"
          },
          {
            name: "bump",
            docs: [
              "PDA bump seed"
            ],
            type: "u8"
          }
        ]
      }
    },
    {
      name: "ResolutionOutcome",
      docs: [
        "Resolution outcome"
      ],
      type: {
        kind: "enum",
        variants: [
          {
            name: "None"
          },
          {
            name: "ChallengerWins"
          },
          {
            name: "DefenderWins"
          },
          {
            name: "NoParticipation"
          }
        ]
      }
    },
    {
      name: "RestoreVoteChoice",
      docs: [
        "Vote choice for restorations (separate enum for clearer semantics)"
      ],
      type: {
        kind: "enum",
        variants: [
          {
            name: "ForRestoration"
          },
          {
            name: "AgainstRestoration"
          }
        ]
      }
    },
    {
      name: "Subject",
      docs: [
        "Subject that defenders back - global (identified by subject_id)"
      ],
      type: {
        kind: "struct",
        fields: [
          {
            name: "subject_id",
            docs: [
              "Subject identifier (could be PDA from external program)"
            ],
            type: "pubkey"
          },
          {
            name: "defender_pool",
            docs: [
              "Optional defender pool (default = standalone mode, set = linked to pool)"
            ],
            type: "pubkey"
          },
          {
            name: "details_cid",
            docs: [
              "Details/metadata CID (IPFS/Arweave) - context provided by first staker"
            ],
            type: "string"
          },
          {
            name: "status",
            docs: [
              "Current status"
            ],
            type: {
              defined: {
                name: "SubjectStatus"
              }
            }
          },
          {
            name: "available_stake",
            docs: [
              "Available stake for disputes (direct stakes + pool contribution when disputed)",
              "Updated at resolution: available_stake -= stake_at_risk"
            ],
            type: "u64"
          },
          {
            name: "max_stake",
            docs: [
              "Max stake at risk per dispute (for match mode)"
            ],
            type: "u64"
          },
          {
            name: "voting_period",
            docs: [
              "Voting period in seconds for this subject's disputes"
            ],
            type: "i64"
          },
          {
            name: "defender_count",
            docs: [
              "Number of defenders (standalone mode only)"
            ],
            type: "u16"
          },
          {
            name: "dispute_count",
            docs: [
              "Number of disputes (for sequential dispute PDAs)"
            ],
            type: "u32"
          },
          {
            name: "match_mode",
            docs: [
              "Match mode: true = bond must match stake, false = proportionate"
            ],
            type: "bool"
          },
          {
            name: "free_case",
            docs: [
              "Free case mode: no stake/bond required, no rewards, no reputation impact"
            ],
            type: "bool"
          },
          {
            name: "dispute",
            docs: [
              "Current active dispute (if any)"
            ],
            type: "pubkey"
          },
          {
            name: "bump",
            docs: [
              "Bump seed for PDA"
            ],
            type: "u8"
          },
          {
            name: "created_at",
            docs: [
              "Creation timestamp"
            ],
            type: "i64"
          },
          {
            name: "updated_at",
            docs: [
              "Last update timestamp"
            ],
            type: "i64"
          },
          {
            name: "last_dispute_total",
            docs: [
              "Previous dispute's (stake + bond) - minimum stake required for restoration"
            ],
            type: "u64"
          },
          {
            name: "last_voting_period",
            docs: [
              "Previous dispute's voting period - restorations use 2x this value"
            ],
            type: "i64"
          }
        ]
      }
    },
    {
      name: "SubjectStatus",
      docs: [
        "Subject status"
      ],
      type: {
        kind: "enum",
        variants: [
          {
            name: "Valid"
          },
          {
            name: "Disputed"
          },
          {
            name: "Invalid"
          },
          {
            name: "Dormant"
          },
          {
            name: "Restoring"
          }
        ]
      }
    },
    {
      name: "VoteChoice",
      docs: [
        "Vote choice for regular disputes"
      ],
      type: {
        kind: "enum",
        variants: [
          {
            name: "ForChallenger"
          },
          {
            name: "ForDefender"
          }
        ]
      }
    },
    {
      name: "VoteRecord",
      docs: [
        "Juror's vote on a dispute"
      ],
      type: {
        kind: "struct",
        fields: [
          {
            name: "dispute",
            docs: [
              "The dispute being voted on"
            ],
            type: "pubkey"
          },
          {
            name: "juror",
            docs: [
              "Juror who cast the vote"
            ],
            type: "pubkey"
          },
          {
            name: "juror_account",
            docs: [
              "Juror account PDA"
            ],
            type: "pubkey"
          },
          {
            name: "choice",
            docs: [
              "Vote choice for regular disputes"
            ],
            type: {
              defined: {
                name: "VoteChoice"
              }
            }
          },
          {
            name: "restore_choice",
            docs: [
              "Vote choice for restorations (only used when is_restore_vote is true)"
            ],
            type: {
              defined: {
                name: "RestoreVoteChoice"
              }
            }
          },
          {
            name: "is_restore_vote",
            docs: [
              "Whether this is a restoration vote"
            ],
            type: "bool"
          },
          {
            name: "stake_allocated",
            docs: [
              "Stake allocated to this vote"
            ],
            type: "u64"
          },
          {
            name: "voting_power",
            docs: [
              "Calculated voting power (scaled by WEIGHT_PRECISION)"
            ],
            type: "u64"
          },
          {
            name: "unlock_at",
            docs: [
              "When the stake unlocks"
            ],
            type: "i64"
          },
          {
            name: "reputation_processed",
            docs: [
              "Whether reputation has been processed after resolution"
            ],
            type: "bool"
          },
          {
            name: "reward_claimed",
            docs: [
              "Whether reward has been claimed"
            ],
            type: "bool"
          },
          {
            name: "stake_unlocked",
            docs: [
              "Whether stake has been unlocked/returned"
            ],
            type: "bool"
          },
          {
            name: "bump",
            docs: [
              "Bump seed for PDA"
            ],
            type: "u8"
          },
          {
            name: "voted_at",
            docs: [
              "Vote timestamp"
            ],
            type: "i64"
          },
          {
            name: "rationale_cid",
            docs: [
              "IPFS CID for vote rationale (optional)"
            ],
            type: "string"
          }
        ]
      }
    }
  ]
};

// src/client.ts
var ERROR_CODES = {
  6e3: "Unauthorized",
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
  6023: "RestorationFailed"
};
var TribunalCraftClient = class {
  constructor(config) {
    this.connection = config.connection;
    this.programId = config.programId ?? PROGRAM_ID;
    this.pda = new PDA(this.programId);
    this.wallet = config.wallet ?? null;
    this.simulateFirst = config.simulateFirst ?? false;
    const readOnlyProvider = new import_anchor.AnchorProvider(
      this.connection,
      {},
      // Dummy wallet for read-only operations
      { commitment: "confirmed" }
    );
    this.anchorProgram = new import_anchor.Program(
      idl_default,
      readOnlyProvider
    );
    if (this.wallet) {
      this.initProgram();
    }
  }
  initProgram() {
    if (!this.wallet) return;
    const provider = new import_anchor.AnchorProvider(this.connection, this.wallet, {
      commitment: "confirmed"
    });
    this.anchorProgram = new import_anchor.Program(
      idl_default,
      provider
    );
  }
  /**
   * Set or update the wallet
   */
  setWallet(wallet) {
    this.wallet = wallet;
    this.initProgram();
  }
  /**
   * Get the current wallet public key
   */
  get walletPublicKey() {
    return this.wallet?.publicKey ?? null;
  }
  /**
   * Get the Anchor program instance (for advanced usage)
   */
  get program() {
    return this.anchorProgram;
  }
  /**
   * Get wallet and program, throwing if not connected
   */
  getWalletAndProgram() {
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
  parseErrorFromLogs(logs) {
    for (const log of logs) {
      const customErrorMatch = log.match(/Program log: AnchorError.*Error Code: (\w+)\. Error Number: (\d+)\. Error Message: (.+)\./);
      if (customErrorMatch) {
        const errorCode = parseInt(customErrorMatch[2], 10);
        const errorMessage = customErrorMatch[3];
        return { code: errorCode, message: `${customErrorMatch[1]}: ${errorMessage}` };
      }
      const errorNumberMatch = log.match(/Error Number: (\d+)/);
      if (errorNumberMatch) {
        const code = parseInt(errorNumberMatch[1], 10);
        const message = ERROR_CODES[code] || `Unknown error (${code})`;
        return { code, message };
      }
      const instructionErrorMatch = log.match(/Program.*failed: custom program error: 0x([0-9a-fA-F]+)/);
      if (instructionErrorMatch) {
        const code = parseInt(instructionErrorMatch[1], 16);
        const message = ERROR_CODES[code] || `Custom error 0x${instructionErrorMatch[1]}`;
        return { code, message };
      }
      if (log.includes("Error:") || log.includes("failed:")) {
        return { message: log };
      }
    }
    return { message: "Transaction simulation failed" };
  }
  /**
   * Simulate a transaction and return detailed results
   */
  async simulateTransaction(tx) {
    try {
      let response;
      if (tx instanceof import_web33.Transaction) {
        const { blockhash } = await this.connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = this.wallet?.publicKey;
        const result = await this.connection.simulateTransaction(tx);
        response = result.value;
      } else {
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
          unitsConsumed: response.unitsConsumed
        };
      }
      return {
        success: true,
        logs: response.logs || [],
        unitsConsumed: response.unitsConsumed
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        logs: []
      };
    }
  }
  /**
   * Build and simulate a method call without sending
   * Returns simulation result with parsed errors
   */
  async simulateMethod(methodName, args, accounts) {
    const { program } = this.getWalletAndProgram();
    try {
      const method = program.methods[methodName](...args);
      if (accounts) {
        method.accountsPartial(accounts);
      }
      const tx = await method.transaction();
      return this.simulateTransaction(tx);
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        logs: []
      };
    }
  }
  /**
   * Helper to run RPC with optional simulation first
   * Wraps Anchor's rpc() call with simulation check using Anchor's simulate()
   */
  async rpcWithSimulation(methodBuilder, actionName) {
    if (this.simulateFirst) {
      console.log(`[Simulation] ${actionName}...`);
      try {
        const simResult = await methodBuilder.simulate();
        console.log(`[Simulation] ${actionName} passed`);
        if (simResult.raw && simResult.raw.length > 0) {
          console.log("[Simulation] Logs:", simResult.raw.slice(-5).join("\n"));
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const { code, message } = this.parseErrorFromLogs([errorMessage]);
        let logs = [];
        if (err && typeof err === "object" && "logs" in err) {
          logs = err.logs || [];
        }
        if (logs.length === 0 && err && typeof err === "object" && "simulationResponse" in err) {
          const simResponse = err.simulationResponse;
          logs = simResponse?.logs || [];
        }
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
  async initializeConfig() {
    const { program } = this.getWalletAndProgram();
    const [protocolConfig] = this.pda.protocolConfig();
    const signature = await program.methods.initializeConfig().rpc();
    return { signature, accounts: { protocolConfig } };
  }
  /**
   * Update treasury address (admin only)
   */
  async updateTreasury(newTreasury) {
    const { program } = this.getWalletAndProgram();
    const signature = await program.methods.updateTreasury(newTreasury).rpc();
    return { signature };
  }
  // ===========================================================================
  // Defender Pool
  // ===========================================================================
  /**
   * Create a defender pool with initial stake
   */
  async createPool(initialStake) {
    const { wallet, program } = this.getWalletAndProgram();
    const [defenderPool] = this.pda.defenderPool(wallet.publicKey);
    const signature = await program.methods.createPool(initialStake).rpc();
    return { signature, accounts: { defenderPool } };
  }
  /**
   * Add stake to an existing pool
   */
  async stakePool(amount) {
    const { program } = this.getWalletAndProgram();
    const signature = await program.methods.stakePool(amount).rpc();
    return { signature };
  }
  /**
   * Withdraw available stake from pool
   */
  async withdrawPool(amount) {
    const { program } = this.getWalletAndProgram();
    const signature = await program.methods.withdrawPool(amount).rpc();
    return { signature };
  }
  // ===========================================================================
  // Subject Management
  // ===========================================================================
  /**
   * Create a subject - unified method that handles all subject types
   *
   * Subject type is determined by params:
   * - freeCase: true → creates free subject (no stakes)
   * - defenderPool provided → creates linked subject (pool-backed)
   * - otherwise → creates standalone subject (requires stake)
   */
  async createSubject(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const [subject] = this.pda.subject(params.subjectId);
    if (params.freeCase) {
      const signature2 = await program.methods.createFreeSubject(params.subjectId, params.detailsCid, params.votingPeriod).rpc();
      return { signature: signature2, accounts: { subject } };
    }
    if (params.defenderPool) {
      const signature2 = await program.methods.createLinkedSubject(
        params.subjectId,
        params.detailsCid,
        params.maxStake ?? new import_anchor.BN(0),
        params.matchMode ?? true,
        false,
        // freeCase
        params.votingPeriod
      ).accountsPartial({
        defenderPool: params.defenderPool
      }).rpc();
      return { signature: signature2, accounts: { subject } };
    }
    if (!params.stake || params.stake.isZero()) {
      throw new Error("Standalone subjects require initial stake");
    }
    const [defenderRecord] = this.pda.defenderRecord(subject, wallet.publicKey);
    const signature = await program.methods.createSubject(
      params.subjectId,
      params.detailsCid,
      params.maxStake ?? new import_anchor.BN(0),
      params.matchMode ?? true,
      false,
      // freeCase
      params.votingPeriod,
      params.stake
    ).rpc();
    return { signature, accounts: { subject, defenderRecord } };
  }
  /**
   * Add stake to a standalone subject
   * If subject has active dispute in proportional mode, pass dispute, protocolConfig, and treasury
   * Fees are deducted in proportional mode during active dispute
   */
  async addToStake(subject, stake, proportionalDispute) {
    const { wallet, program } = this.getWalletAndProgram();
    const [protocolConfig] = this.pda.protocolConfig();
    const signature = await program.methods.addToStake(stake).accountsPartial({
      subject,
      dispute: proportionalDispute?.dispute ?? null,
      protocolConfig: proportionalDispute ? protocolConfig : null,
      treasury: proportionalDispute?.treasury ?? null
    }).rpc();
    return { signature };
  }
  // ===========================================================================
  // Juror Management
  // ===========================================================================
  /**
   * Register as a juror with initial stake
   */
  async registerJuror(stakeAmount) {
    const { wallet, program } = this.getWalletAndProgram();
    const [jurorAccount] = this.pda.jurorAccount(wallet.publicKey);
    const signature = await program.methods.registerJuror(stakeAmount).rpc();
    return { signature, accounts: { jurorAccount } };
  }
  /**
   * Add more stake to juror account
   */
  async addJurorStake(amount) {
    const { wallet, program } = this.getWalletAndProgram();
    const signature = await program.methods.addJurorStake(amount).rpc();
    return { signature };
  }
  /**
   * Withdraw available stake from juror account
   */
  async withdrawJurorStake(amount) {
    const { wallet, program } = this.getWalletAndProgram();
    const signature = await program.methods.withdrawJurorStake(amount).rpc();
    return { signature };
  }
  /**
   * Unregister juror and withdraw all available stake
   */
  async unregisterJuror() {
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
  async submitDispute(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const [dispute] = this.pda.dispute(params.subject, params.disputeCount);
    const [challengerRecord] = this.pda.challengerRecord(
      dispute,
      wallet.publicKey
    );
    const poolOwnerDefenderRecord = params.poolOwner ? this.pda.defenderRecord(params.subject, params.poolOwner)[0] : null;
    const [protocolConfig] = this.pda.protocolConfig();
    const protocolConfigAccount = await program.account.protocolConfig.fetch(protocolConfig);
    const treasury = protocolConfigAccount.treasury;
    const methodBuilder = program.methods.submitDispute(params.disputeType, params.detailsCid, params.bond).accountsPartial({
      subject: params.subject,
      defenderPool: params.defenderPool ?? null,
      poolOwnerDefenderRecord,
      protocolConfig,
      treasury
    });
    const signature = await this.rpcWithSimulation(methodBuilder, "submitDispute");
    return { signature, accounts: { dispute, challengerRecord } };
  }
  /**
   * Submit a free dispute (no bond required)
   */
  async submitFreeDispute(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const [dispute] = this.pda.dispute(params.subject, params.disputeCount);
    const [challengerRecord] = this.pda.challengerRecord(
      dispute,
      wallet.publicKey
    );
    const signature = await program.methods.submitFreeDispute(params.disputeType, params.detailsCid).accountsPartial({ subject: params.subject }).rpc();
    return { signature, accounts: { dispute, challengerRecord } };
  }
  /**
   * Add to existing dispute (additional challengers)
   */
  async addToDispute(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const [challengerRecord] = this.pda.challengerRecord(
      params.dispute,
      wallet.publicKey
    );
    const poolOwnerDefenderRecord = params.poolOwner ? this.pda.defenderRecord(params.subject, params.poolOwner)[0] : null;
    const [protocolConfig] = this.pda.protocolConfig();
    const protocolConfigAccount = await program.account.protocolConfig.fetch(protocolConfig);
    const treasury = protocolConfigAccount.treasury;
    const signature = await program.methods.addToDispute(params.detailsCid, params.bond).accountsPartial({
      subject: params.subject,
      dispute: params.dispute,
      defenderPool: params.defenderPool ?? null,
      poolOwnerDefenderRecord,
      protocolConfig,
      treasury
    }).rpc();
    return { signature, accounts: { challengerRecord } };
  }
  /**
   * Submit a restoration request against an invalidated subject
   * Platform fee (1%) is collected upfront to treasury
   */
  async submitRestore(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const [dispute] = this.pda.dispute(params.subject, params.disputeCount);
    const [protocolConfig] = this.pda.protocolConfig();
    const config = await this.fetchProtocolConfig();
    if (!config) {
      throw new Error("Protocol config not initialized");
    }
    const methodBuilder = program.methods.submitRestore(params.disputeType, params.detailsCid, params.stakeAmount).accountsPartial({
      subject: params.subject,
      protocolConfig,
      treasury: config.treasury
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
  async voteOnDispute(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const [voteRecord] = this.pda.voteRecord(params.dispute, wallet.publicKey);
    const methodBuilder = program.methods.voteOnDispute(
      params.choice,
      params.stakeAllocation,
      params.rationaleCid ?? ""
    ).accountsPartial({ dispute: params.dispute });
    const signature = await this.rpcWithSimulation(methodBuilder, "voteOnDispute");
    return { signature, accounts: { voteRecord } };
  }
  /**
   * Vote on a restoration request
   */
  async voteOnRestore(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const [voteRecord] = this.pda.voteRecord(params.dispute, wallet.publicKey);
    const methodBuilder = program.methods.voteOnRestore(
      params.choice,
      params.stakeAllocation,
      params.rationaleCid ?? ""
    ).accountsPartial({ dispute: params.dispute });
    const signature = await this.rpcWithSimulation(methodBuilder, "voteOnRestore");
    return { signature, accounts: { voteRecord } };
  }
  /**
   * Add more stake to an existing vote
   */
  async addToVote(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const signature = await program.methods.addToVote(params.additionalStake).accountsPartial({
      dispute: params.dispute,
      subject: params.subject
    }).rpc();
    return { signature };
  }
  // ===========================================================================
  // Resolution
  // ===========================================================================
  /**
   * Resolve a dispute after voting period ends (permissionless)
   */
  async resolveDispute(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const methodBuilder = program.methods.resolveDispute().accountsPartial({
      dispute: params.dispute,
      subject: params.subject
    });
    const signature = await this.rpcWithSimulation(methodBuilder, "resolveDispute");
    return { signature };
  }
  /**
   * Unlock juror stake after 7-day buffer
   */
  async unlockJurorStake(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const signature = await program.methods.unlockJurorStake().accountsPartial({
      dispute: params.dispute,
      voteRecord: params.voteRecord
    }).rpc();
    return { signature };
  }
  /**
   * Claim juror reward (processes reputation + distributes reward)
   */
  async claimJurorReward(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const signature = await program.methods.claimJurorReward().accountsPartial({
      dispute: params.dispute,
      subject: params.subject,
      voteRecord: params.voteRecord
    }).rpc();
    return { signature };
  }
  /**
   * Claim challenger reward (if dispute upheld)
   */
  async claimChallengerReward(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const signature = await program.methods.claimChallengerReward().accountsPartial({
      dispute: params.dispute,
      subject: params.subject,
      challengerRecord: params.challengerRecord
    }).rpc();
    return { signature };
  }
  /**
   * Claim defender reward (if dispute dismissed)
   */
  async claimDefenderReward(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const signature = await program.methods.claimDefenderReward().accountsPartial({
      dispute: params.dispute,
      subject: params.subject,
      defenderRecord: params.defenderRecord
    }).rpc();
    return { signature };
  }
  /**
   * Claim restorer refund for failed restoration request
   */
  async claimRestorerRefund(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const signature = await program.methods.claimRestorerRefund().accountsPartial({
      dispute: params.dispute
    }).rpc();
    return { signature };
  }
  // NOTE: closeEscrow removed - no escrow in simplified model
  // ===========================================================================
  // Account Fetchers
  // ===========================================================================
  /**
   * Fetch protocol config
   */
  async fetchProtocolConfig() {
    const [address] = this.pda.protocolConfig();
    try {
      return await this.anchorProgram.account.protocolConfig.fetch(
        address
      );
    } catch {
      return null;
    }
  }
  /**
   * Fetch defender pool by address
   */
  async fetchDefenderPool(address) {
    try {
      return await this.anchorProgram.account.defenderPool.fetch(
        address
      );
    } catch {
      return null;
    }
  }
  /**
   * Fetch defender pool by owner
   */
  async fetchDefenderPoolByOwner(owner) {
    const [address] = this.pda.defenderPool(owner);
    return this.fetchDefenderPool(address);
  }
  /**
   * Fetch subject by address
   */
  async fetchSubject(address) {
    try {
      return await this.anchorProgram.account.subject.fetch(
        address
      );
    } catch {
      return null;
    }
  }
  /**
   * Fetch subject by subject ID
   */
  async fetchSubjectById(subjectId) {
    const [address] = this.pda.subject(subjectId);
    return this.fetchSubject(address);
  }
  /**
   * Fetch dispute by address
   */
  async fetchDispute(address) {
    try {
      return await this.anchorProgram.account.dispute.fetch(
        address
      );
    } catch {
      return null;
    }
  }
  // NOTE: fetchEscrow removed - no escrow in simplified model
  /**
   * Fetch juror account by address
   */
  async fetchJurorAccount(address) {
    try {
      return await this.anchorProgram.account.jurorAccount.fetch(
        address
      );
    } catch {
      return null;
    }
  }
  /**
   * Fetch juror account by juror pubkey
   */
  async fetchJurorByPubkey(juror) {
    const [address] = this.pda.jurorAccount(juror);
    return this.fetchJurorAccount(address);
  }
  /**
   * Fetch vote record
   */
  async fetchVoteRecord(address) {
    try {
      return await this.anchorProgram.account.voteRecord.fetch(
        address
      );
    } catch {
      return null;
    }
  }
  /**
   * Fetch vote record for a dispute and juror
   */
  async fetchVoteRecordByDisputeAndJuror(dispute, juror) {
    const [address] = this.pda.voteRecord(dispute, juror);
    return this.fetchVoteRecord(address);
  }
  /**
   * Fetch challenger account
   */
  async fetchChallengerAccount(address) {
    try {
      return await this.anchorProgram.account.challengerAccount.fetch(
        address
      );
    } catch {
      return null;
    }
  }
  /**
   * Fetch challenger record
   */
  async fetchChallengerRecord(address) {
    try {
      return await this.anchorProgram.account.challengerRecord.fetch(
        address
      );
    } catch {
      return null;
    }
  }
  /**
   * Fetch defender record
   */
  async fetchDefenderRecord(address) {
    try {
      return await this.anchorProgram.account.defenderRecord.fetch(
        address
      );
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
  async fetchAllDefenderPools() {
    const accounts = await this.anchorProgram.account.defenderPool.all();
    return accounts;
  }
  /**
   * Fetch all subjects
   */
  async fetchAllSubjects() {
    const accounts = await this.anchorProgram.account.subject.all();
    return accounts;
  }
  /**
   * Fetch all disputes (with error handling for old account formats)
   */
  async fetchAllDisputes() {
    try {
      const accounts = await this.anchorProgram.account.dispute.all();
      return accounts;
    } catch (err) {
      console.warn("Failed to fetch disputes:", err);
      return [];
    }
  }
  /**
   * Fetch all juror accounts
   */
  async fetchAllJurors() {
    const accounts = await this.anchorProgram.account.jurorAccount.all();
    return accounts;
  }
  /**
   * Fetch disputes by subject
   */
  async fetchDisputesBySubject(subject) {
    const accounts = await this.anchorProgram.account.dispute.all([
      { memcmp: { offset: 8, bytes: subject.toBase58() } }
    ]);
    return accounts;
  }
  /**
   * Fetch votes by dispute
   */
  async fetchVotesByDispute(dispute) {
    const accounts = await this.anchorProgram.account.voteRecord.all([
      { memcmp: { offset: 8, bytes: dispute.toBase58() } }
    ]);
    return accounts;
  }
  /**
   * Fetch challengers by dispute
   */
  async fetchChallengersByDispute(dispute) {
    const accounts = await this.anchorProgram.account.challengerRecord.all([
      { memcmp: { offset: 8, bytes: dispute.toBase58() } }
    ]);
    return accounts;
  }
};

// src/types.ts
var import_web34 = require("@solana/web3.js");
var import_anchor2 = require("@coral-xyz/anchor");
var SubjectStatusEnum = {
  Valid: { valid: {} },
  Disputed: { disputed: {} },
  Invalid: { invalid: {} },
  Dormant: { dormant: {} },
  Restoring: { restoring: {} }
};
var DisputeStatusEnum = {
  Pending: { pending: {} },
  Resolved: { resolved: {} }
};
var ResolutionOutcomeEnum = {
  None: { none: {} },
  ChallengerWins: { challengerWins: {} },
  DefenderWins: { defenderWins: {} },
  NoParticipation: { noParticipation: {} }
};
var DisputeTypeEnum = {
  Other: { other: {} },
  Breach: { breach: {} },
  Fraud: { fraud: {} },
  QualityDispute: { qualityDispute: {} },
  NonDelivery: { nonDelivery: {} },
  Misrepresentation: { misrepresentation: {} },
  PolicyViolation: { policyViolation: {} },
  DamagesClaim: { damagesClaim: {} }
};
var VoteChoiceEnum = {
  ForChallenger: { forChallenger: {} },
  ForDefender: { forDefender: {} }
};
var RestoreVoteChoiceEnum = {
  ForRestoration: { forRestoration: {} },
  AgainstRestoration: { againstRestoration: {} }
};
function isSubjectValid(status) {
  return "valid" in status;
}
function isSubjectDisputed(status) {
  return "disputed" in status;
}
function isSubjectInvalid(status) {
  return "invalid" in status;
}
function isSubjectDormant(status) {
  return "dormant" in status;
}
function isSubjectRestoring(status) {
  return "restoring" in status;
}
function isDisputePending(status) {
  return "pending" in status;
}
function isDisputeResolved(status) {
  return "resolved" in status;
}
function isChallengerWins(outcome) {
  return "challengerWins" in outcome;
}
function isDefenderWins(outcome) {
  return "defenderWins" in outcome;
}
function isNoParticipation(outcome) {
  return "noParticipation" in outcome;
}
function getDisputeTypeName(disputeType) {
  if ("other" in disputeType) return "Other";
  if ("breach" in disputeType) return "Breach";
  if ("fraud" in disputeType) return "Fraud";
  if ("qualityDispute" in disputeType) return "Quality Dispute";
  if ("nonDelivery" in disputeType) return "Non-Delivery";
  if ("misrepresentation" in disputeType) return "Misrepresentation";
  if ("policyViolation" in disputeType) return "Policy Violation";
  if ("damagesClaim" in disputeType) return "Damages Claim";
  return "Unknown";
}
function getOutcomeName(outcome) {
  if ("none" in outcome) return "None";
  if ("challengerWins" in outcome) return "Challenger Wins";
  if ("defenderWins" in outcome) return "Defender Wins";
  if ("noParticipation" in outcome) return "No Participation";
  return "Unknown";
}
function canLinkedSubjectBeDisputed(subject, pool, minBond) {
  if (subject.defenderPool.equals(new import_web34.PublicKey(0))) {
    return true;
  }
  if (!pool) {
    return false;
  }
  if (subject.matchMode) {
    const totalAvailable = pool.available.add(subject.availableStake);
    const requiredHold = import_anchor2.BN.min(minBond, subject.maxStake);
    return totalAvailable.gte(requiredHold);
  }
  return true;
}
function getEffectiveStatus(subject, pool, minBond) {
  if (!isSubjectValid(subject.status)) {
    return subject.status;
  }
  if (!canLinkedSubjectBeDisputed(subject, pool, minBond)) {
    return SubjectStatusEnum.Dormant;
  }
  return subject.status;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CHALLENGER_RECORD_SEED,
  CHALLENGER_SEED,
  DEFENDER_POOL_SEED,
  DEFENDER_RECORD_SEED,
  DISPUTE_SEED,
  DisputeStatusEnum,
  DisputeTypeEnum,
  IDL,
  INITIAL_REPUTATION,
  JUROR_SEED,
  JUROR_SHARE_BPS,
  MAX_VOTING_PERIOD,
  MIN_CHALLENGER_BOND,
  MIN_DEFENDER_STAKE,
  MIN_JUROR_STAKE,
  MIN_VOTING_PERIOD,
  PDA,
  PLATFORM_SHARE_BPS,
  PROGRAM_ID,
  PROTOCOL_CONFIG_SEED,
  REPUTATION_GAIN_RATE,
  REPUTATION_LOSS_RATE,
  ResolutionOutcomeEnum,
  RestoreVoteChoiceEnum,
  STAKE_UNLOCK_BUFFER,
  SUBJECT_SEED,
  SubjectStatusEnum,
  TOTAL_FEE_BPS,
  TribunalCraftClient,
  VOTE_RECORD_SEED,
  VoteChoiceEnum,
  WINNER_SHARE_BPS,
  canLinkedSubjectBeDisputed,
  getDisputeTypeName,
  getEffectiveStatus,
  getOutcomeName,
  isChallengerWins,
  isDefenderWins,
  isDisputePending,
  isDisputeResolved,
  isNoParticipation,
  isSubjectDisputed,
  isSubjectDormant,
  isSubjectInvalid,
  isSubjectRestoring,
  isSubjectValid,
  pda
});
