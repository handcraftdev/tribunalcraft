/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/tribunalcraft.json`.
 */
export type Tribunalcraft = {
  "address": "4b9qTHcLrkjURroj8X9TCr8xKPNqDT7pNrCqi9brLiZX",
  "metadata": {
    "name": "tribunalcraft",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Decentralized arbitration protocol"
  },
  "instructions": [
    {
      "name": "addJurorStake",
      "docs": [
        "Add more stake to juror account"
      ],
      "discriminator": [
        42,
        194,
        234,
        159,
        186,
        115,
        32,
        169
      ],
      "accounts": [
        {
          "name": "juror",
          "writable": true,
          "signer": true,
          "relations": [
            "jurorAccount"
          ]
        },
        {
          "name": "jurorAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  106,
                  117,
                  114,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "juror"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addToDispute",
      "docs": [
        "Add to existing dispute (additional challengers)"
      ],
      "discriminator": [
        110,
        2,
        131,
        29,
        204,
        133,
        164,
        234
      ],
      "accounts": [
        {
          "name": "challenger",
          "writable": true,
          "signer": true
        },
        {
          "name": "subject",
          "writable": true,
          "relations": [
            "dispute"
          ]
        },
        {
          "name": "defenderPool",
          "docs": [
            "Optional: defender pool if subject is linked"
          ],
          "writable": true,
          "optional": true
        },
        {
          "name": "poolOwnerDefenderRecord",
          "docs": [
            "Optional: DefenderRecord for pool owner (required if pool has stake to transfer)"
          ],
          "writable": true,
          "optional": true
        },
        {
          "name": "challengerAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
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
                "kind": "account",
                "path": "challenger"
              }
            ]
          }
        },
        {
          "name": "dispute",
          "writable": true
        },
        {
          "name": "challengerRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
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
                "kind": "account",
                "path": "dispute"
              },
              {
                "kind": "account",
                "path": "challenger"
              }
            ]
          }
        },
        {
          "name": "protocolConfig",
          "docs": [
            "Protocol config for treasury address"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
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
          "name": "treasury",
          "docs": [
            "Treasury receives fees"
          ],
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "detailsCid",
          "type": "string"
        },
        {
          "name": "bond",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addToStake",
      "docs": [
        "Add stake to a standalone subject"
      ],
      "discriminator": [
        227,
        50,
        25,
        66,
        59,
        214,
        58,
        213
      ],
      "accounts": [
        {
          "name": "staker",
          "writable": true,
          "signer": true
        },
        {
          "name": "subject",
          "writable": true
        },
        {
          "name": "defenderRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
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
                "kind": "account",
                "path": "subject"
              },
              {
                "kind": "account",
                "path": "staker"
              }
            ]
          }
        },
        {
          "name": "dispute",
          "docs": [
            "Optional: Active dispute (required if subject has active dispute in proportional mode)"
          ],
          "writable": true,
          "optional": true
        },
        {
          "name": "protocolConfig",
          "docs": [
            "Protocol config for treasury address (required if proportional dispute)"
          ],
          "optional": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
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
          "name": "treasury",
          "docs": [
            "Treasury receives fees (required if proportional dispute)"
          ],
          "writable": true,
          "optional": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "stake",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addToVote",
      "docs": [
        "Add more stake to an existing vote"
      ],
      "discriminator": [
        202,
        66,
        94,
        152,
        90,
        103,
        240,
        68
      ],
      "accounts": [
        {
          "name": "juror",
          "writable": true,
          "signer": true,
          "relations": [
            "jurorAccount",
            "voteRecord"
          ]
        },
        {
          "name": "jurorAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  106,
                  117,
                  114,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "juror"
              }
            ]
          }
        },
        {
          "name": "subject",
          "relations": [
            "dispute"
          ]
        },
        {
          "name": "dispute",
          "writable": true,
          "relations": [
            "voteRecord"
          ]
        },
        {
          "name": "voteRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  111,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "dispute"
              },
              {
                "kind": "account",
                "path": "juror"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "additionalStake",
          "type": "u64"
        }
      ]
    },
    {
      "name": "claimChallengerReward",
      "docs": [
        "Claim challenger reward (if dispute upheld)"
      ],
      "discriminator": [
        173,
        143,
        119,
        13,
        142,
        25,
        102,
        36
      ],
      "accounts": [
        {
          "name": "challenger",
          "writable": true,
          "signer": true,
          "relations": [
            "challengerRecord"
          ]
        },
        {
          "name": "challengerAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
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
                "kind": "account",
                "path": "challenger"
              }
            ]
          }
        },
        {
          "name": "subject",
          "writable": true,
          "relations": [
            "dispute"
          ]
        },
        {
          "name": "dispute",
          "writable": true,
          "relations": [
            "challengerRecord"
          ]
        },
        {
          "name": "challengerRecord",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "claimDefenderReward",
      "docs": [
        "Claim defender reward (if dispute dismissed)"
      ],
      "discriminator": [
        189,
        13,
        90,
        154,
        251,
        183,
        166,
        135
      ],
      "accounts": [
        {
          "name": "defender",
          "writable": true,
          "signer": true,
          "relations": [
            "defenderRecord"
          ]
        },
        {
          "name": "subject",
          "writable": true,
          "relations": [
            "dispute",
            "defenderRecord"
          ]
        },
        {
          "name": "dispute",
          "writable": true
        },
        {
          "name": "defenderRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
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
                "kind": "account",
                "path": "subject"
              },
              {
                "kind": "account",
                "path": "defender"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "claimJurorReward",
      "docs": [
        "Claim juror reward for correct vote"
      ],
      "discriminator": [
        220,
        82,
        126,
        176,
        119,
        103,
        33,
        25
      ],
      "accounts": [
        {
          "name": "juror",
          "writable": true,
          "signer": true,
          "relations": [
            "jurorAccount",
            "voteRecord"
          ]
        },
        {
          "name": "jurorAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  106,
                  117,
                  114,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "juror"
              }
            ]
          }
        },
        {
          "name": "subject",
          "writable": true,
          "relations": [
            "dispute"
          ]
        },
        {
          "name": "dispute",
          "writable": true,
          "relations": [
            "voteRecord"
          ]
        },
        {
          "name": "voteRecord",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "createFreeSubject",
      "docs": [
        "Create a free subject (no stake required, just Subject account)"
      ],
      "discriminator": [
        131,
        154,
        217,
        251,
        107,
        165,
        155,
        197
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "subject",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
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
                "kind": "arg",
                "path": "subjectId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "subjectId",
          "type": "pubkey"
        },
        {
          "name": "detailsCid",
          "type": "string"
        },
        {
          "name": "votingPeriod",
          "type": "i64"
        }
      ]
    },
    {
      "name": "createLinkedSubject",
      "docs": [
        "Create a subject linked to a defender pool"
      ],
      "discriminator": [
        42,
        140,
        162,
        241,
        23,
        166,
        71,
        51
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "defenderPool"
          ]
        },
        {
          "name": "defenderPool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
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
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "subject",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
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
                "kind": "arg",
                "path": "subjectId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "subjectId",
          "type": "pubkey"
        },
        {
          "name": "detailsCid",
          "type": "string"
        },
        {
          "name": "maxStake",
          "type": "u64"
        },
        {
          "name": "matchMode",
          "type": "bool"
        },
        {
          "name": "freeCase",
          "type": "bool"
        },
        {
          "name": "votingPeriod",
          "type": "i64"
        }
      ]
    },
    {
      "name": "createPool",
      "docs": [
        "Create a defender pool with initial stake"
      ],
      "discriminator": [
        233,
        146,
        209,
        142,
        207,
        104,
        64,
        188
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "defenderPool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
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
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "initialStake",
          "type": "u64"
        }
      ]
    },
    {
      "name": "createSubject",
      "docs": [
        "Create a standalone subject with initial stake"
      ],
      "discriminator": [
        243,
        24,
        101,
        208,
        170,
        5,
        242,
        26
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "subject",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
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
                "kind": "arg",
                "path": "subjectId"
              }
            ]
          }
        },
        {
          "name": "defenderRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
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
                "kind": "account",
                "path": "subject"
              },
              {
                "kind": "account",
                "path": "creator"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "subjectId",
          "type": "pubkey"
        },
        {
          "name": "detailsCid",
          "type": "string"
        },
        {
          "name": "maxStake",
          "type": "u64"
        },
        {
          "name": "matchMode",
          "type": "bool"
        },
        {
          "name": "freeCase",
          "type": "bool"
        },
        {
          "name": "votingPeriod",
          "type": "i64"
        },
        {
          "name": "stake",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeConfig",
      "docs": [
        "Initialize protocol config (one-time setup by deployer)"
      ],
      "discriminator": [
        208,
        127,
        21,
        1,
        194,
        190,
        196,
        70
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
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
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "registerJuror",
      "docs": [
        "Register as a juror with initial stake"
      ],
      "discriminator": [
        116,
        81,
        98,
        42,
        220,
        219,
        2,
        141
      ],
      "accounts": [
        {
          "name": "juror",
          "writable": true,
          "signer": true
        },
        {
          "name": "jurorAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  106,
                  117,
                  114,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "juror"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "stakeAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "resolveDispute",
      "docs": [
        "Resolve a dispute after voting period ends"
      ],
      "discriminator": [
        231,
        6,
        202,
        6,
        96,
        103,
        12,
        230
      ],
      "accounts": [
        {
          "name": "resolver",
          "writable": true,
          "signer": true
        },
        {
          "name": "dispute",
          "writable": true
        },
        {
          "name": "subject",
          "writable": true,
          "relations": [
            "dispute"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "stakePool",
      "docs": [
        "Add stake to an existing pool"
      ],
      "discriminator": [
        186,
        105,
        178,
        191,
        181,
        236,
        39,
        162
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "defenderPool"
          ]
        },
        {
          "name": "defenderPool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
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
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "submitAppeal",
      "docs": [
        "Submit an appeal against an invalidated subject",
        "Appeals allow community to reverse previous invalidation decisions",
        "Appellant stakes (no bond required), voting period is 2x previous"
      ],
      "discriminator": [
        119,
        88,
        95,
        156,
        252,
        220,
        32,
        91
      ],
      "accounts": [
        {
          "name": "appellant",
          "writable": true,
          "signer": true
        },
        {
          "name": "subject",
          "writable": true
        },
        {
          "name": "dispute",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
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
                "kind": "account",
                "path": "subject"
              },
              {
                "kind": "account",
                "path": "subject.dispute_count",
                "account": "subject"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "disputeType",
          "type": {
            "defined": {
              "name": "disputeType"
            }
          }
        },
        {
          "name": "detailsCid",
          "type": "string"
        },
        {
          "name": "stakeAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "submitDispute",
      "docs": [
        "Submit a new dispute against a subject (first challenger)"
      ],
      "discriminator": [
        216,
        199,
        236,
        25,
        212,
        79,
        19,
        19
      ],
      "accounts": [
        {
          "name": "challenger",
          "writable": true,
          "signer": true
        },
        {
          "name": "subject",
          "writable": true
        },
        {
          "name": "defenderPool",
          "docs": [
            "Optional: defender pool if subject is linked"
          ],
          "writable": true,
          "optional": true
        },
        {
          "name": "poolOwnerDefenderRecord",
          "docs": [
            "Optional: DefenderRecord for pool owner (required if pool has stake to transfer)"
          ],
          "writable": true,
          "optional": true
        },
        {
          "name": "challengerAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
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
                "kind": "account",
                "path": "challenger"
              }
            ]
          }
        },
        {
          "name": "dispute",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
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
                "kind": "account",
                "path": "subject"
              },
              {
                "kind": "account",
                "path": "subject.dispute_count",
                "account": "subject"
              }
            ]
          }
        },
        {
          "name": "challengerRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
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
                "kind": "account",
                "path": "dispute"
              },
              {
                "kind": "account",
                "path": "challenger"
              }
            ]
          }
        },
        {
          "name": "protocolConfig",
          "docs": [
            "Protocol config for treasury address"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
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
          "name": "treasury",
          "docs": [
            "Treasury receives fees"
          ],
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "disputeType",
          "type": {
            "defined": {
              "name": "disputeType"
            }
          }
        },
        {
          "name": "detailsCid",
          "type": "string"
        },
        {
          "name": "bond",
          "type": "u64"
        }
      ]
    },
    {
      "name": "submitFreeDispute",
      "docs": [
        "Submit a free dispute (no bond required, just Dispute account)"
      ],
      "discriminator": [
        140,
        225,
        220,
        24,
        64,
        19,
        209,
        197
      ],
      "accounts": [
        {
          "name": "challenger",
          "writable": true,
          "signer": true
        },
        {
          "name": "subject",
          "writable": true
        },
        {
          "name": "dispute",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
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
                "kind": "account",
                "path": "subject"
              },
              {
                "kind": "account",
                "path": "subject.dispute_count",
                "account": "subject"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "disputeType",
          "type": {
            "defined": {
              "name": "disputeType"
            }
          }
        },
        {
          "name": "detailsCid",
          "type": "string"
        }
      ]
    },
    {
      "name": "unlockJurorStake",
      "docs": [
        "Unlock juror stake after 7-day buffer"
      ],
      "discriminator": [
        109,
        73,
        56,
        32,
        115,
        125,
        5,
        242
      ],
      "accounts": [
        {
          "name": "juror",
          "writable": true,
          "signer": true,
          "relations": [
            "jurorAccount",
            "voteRecord"
          ]
        },
        {
          "name": "jurorAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  106,
                  117,
                  114,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "juror"
              }
            ]
          }
        },
        {
          "name": "dispute",
          "relations": [
            "voteRecord"
          ]
        },
        {
          "name": "voteRecord",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "unregisterJuror",
      "docs": [
        "Unregister juror and withdraw all available stake"
      ],
      "discriminator": [
        199,
        200,
        113,
        139,
        182,
        118,
        206,
        124
      ],
      "accounts": [
        {
          "name": "juror",
          "writable": true,
          "signer": true,
          "relations": [
            "jurorAccount"
          ]
        },
        {
          "name": "jurorAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  106,
                  117,
                  114,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "juror"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "updateTreasury",
      "docs": [
        "Update treasury address (admin only)"
      ],
      "discriminator": [
        60,
        16,
        243,
        66,
        96,
        59,
        254,
        131
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
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
      "args": [
        {
          "name": "newTreasury",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "voteOnAppeal",
      "docs": [
        "Vote on an appeal with stake allocation",
        "ForRestoration = vote to restore subject to Active",
        "AgainstRestoration = vote to keep subject Invalidated"
      ],
      "discriminator": [
        50,
        167,
        54,
        13,
        106,
        100,
        219,
        200
      ],
      "accounts": [
        {
          "name": "juror",
          "writable": true,
          "signer": true,
          "relations": [
            "jurorAccount"
          ]
        },
        {
          "name": "jurorAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  106,
                  117,
                  114,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "juror"
              }
            ]
          }
        },
        {
          "name": "subject",
          "relations": [
            "dispute"
          ]
        },
        {
          "name": "dispute",
          "writable": true
        },
        {
          "name": "voteRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  111,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "dispute"
              },
              {
                "kind": "account",
                "path": "juror"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "choice",
          "type": {
            "defined": {
              "name": "appealVoteChoice"
            }
          }
        },
        {
          "name": "stakeAllocation",
          "type": "u64"
        },
        {
          "name": "rationaleCid",
          "type": "string"
        }
      ]
    },
    {
      "name": "voteOnDispute",
      "docs": [
        "Vote on a dispute with stake allocation"
      ],
      "discriminator": [
        7,
        213,
        96,
        171,
        252,
        59,
        55,
        23
      ],
      "accounts": [
        {
          "name": "juror",
          "writable": true,
          "signer": true,
          "relations": [
            "jurorAccount"
          ]
        },
        {
          "name": "jurorAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  106,
                  117,
                  114,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "juror"
              }
            ]
          }
        },
        {
          "name": "subject",
          "relations": [
            "dispute"
          ]
        },
        {
          "name": "dispute",
          "writable": true
        },
        {
          "name": "voteRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  111,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "dispute"
              },
              {
                "kind": "account",
                "path": "juror"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "choice",
          "type": {
            "defined": {
              "name": "voteChoice"
            }
          }
        },
        {
          "name": "stakeAllocation",
          "type": "u64"
        },
        {
          "name": "rationaleCid",
          "type": "string"
        }
      ]
    },
    {
      "name": "withdrawJurorStake",
      "docs": [
        "Withdraw available stake (with reputation-based slashing)"
      ],
      "discriminator": [
        178,
        43,
        144,
        250,
        188,
        199,
        135,
        133
      ],
      "accounts": [
        {
          "name": "juror",
          "writable": true,
          "signer": true,
          "relations": [
            "jurorAccount"
          ]
        },
        {
          "name": "jurorAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  106,
                  117,
                  114,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "juror"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawPool",
      "docs": [
        "Withdraw available stake from pool"
      ],
      "discriminator": [
        190,
        43,
        148,
        248,
        68,
        5,
        215,
        136
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "defenderPool"
          ]
        },
        {
          "name": "defenderPool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
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
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "challengerAccount",
      "discriminator": [
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
      "name": "challengerRecord",
      "discriminator": [
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
      "name": "defenderPool",
      "discriminator": [
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
      "name": "defenderRecord",
      "discriminator": [
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
      "name": "dispute",
      "discriminator": [
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
      "name": "jurorAccount",
      "discriminator": [
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
      "name": "protocolConfig",
      "discriminator": [
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
      "name": "subject",
      "discriminator": [
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
      "name": "voteRecord",
      "discriminator": [
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
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6001,
      "name": "invalidConfig",
      "msg": "Invalid configuration parameter"
    },
    {
      "code": 6002,
      "name": "stakeBelowMinimum",
      "msg": "Stake amount below minimum"
    },
    {
      "code": 6003,
      "name": "insufficientAvailableStake",
      "msg": "Insufficient available stake"
    },
    {
      "code": 6004,
      "name": "insufficientHeldStake",
      "msg": "Insufficient held stake"
    },
    {
      "code": 6005,
      "name": "stakeStillLocked",
      "msg": "Stake still locked"
    },
    {
      "code": 6006,
      "name": "stakeAlreadyUnlocked",
      "msg": "Stake already unlocked"
    },
    {
      "code": 6007,
      "name": "bondBelowMinimum",
      "msg": "Bond amount below minimum"
    },
    {
      "code": 6008,
      "name": "bondExceedsAvailable",
      "msg": "Bond exceeds staker's available pool"
    },
    {
      "code": 6009,
      "name": "subjectCannotBeStaked",
      "msg": "Subject cannot accept stakes"
    },
    {
      "code": 6010,
      "name": "subjectCannotBeDisputed",
      "msg": "Subject cannot be disputed"
    },
    {
      "code": 6011,
      "name": "subjectCannotBeAppealed",
      "msg": "Subject cannot be appealed"
    },
    {
      "code": 6012,
      "name": "appealStakeBelowMinimum",
      "msg": "Appeal stake below minimum (must match previous dispute total)"
    },
    {
      "code": 6013,
      "name": "cannotSelfDispute",
      "msg": "Cannot dispute own subject"
    },
    {
      "code": 6014,
      "name": "disputeAlreadyExists",
      "msg": "Dispute already exists for this subject"
    },
    {
      "code": 6015,
      "name": "disputeNotFound",
      "msg": "Dispute not found"
    },
    {
      "code": 6016,
      "name": "disputeAlreadyResolved",
      "msg": "Dispute already resolved"
    },
    {
      "code": 6017,
      "name": "votingNotEnded",
      "msg": "Voting period not ended"
    },
    {
      "code": 6018,
      "name": "votingEnded",
      "msg": "Voting period has ended"
    },
    {
      "code": 6019,
      "name": "cannotVoteOnOwnDispute",
      "msg": "Cannot vote on own dispute"
    },
    {
      "code": 6020,
      "name": "alreadyVoted",
      "msg": "Already voted on this dispute"
    },
    {
      "code": 6021,
      "name": "voteAllocationBelowMinimum",
      "msg": "Vote allocation below minimum"
    },
    {
      "code": 6022,
      "name": "invalidVoteChoice",
      "msg": "Invalid vote choice"
    },
    {
      "code": 6023,
      "name": "jurorNotActive",
      "msg": "Juror not active"
    },
    {
      "code": 6024,
      "name": "jurorAlreadyRegistered",
      "msg": "Juror already registered"
    },
    {
      "code": 6025,
      "name": "challengerNotFound",
      "msg": "Challenger not found"
    },
    {
      "code": 6026,
      "name": "rewardAlreadyClaimed",
      "msg": "Reward already claimed"
    },
    {
      "code": 6027,
      "name": "notEligibleForReward",
      "msg": "Not eligible for reward"
    },
    {
      "code": 6028,
      "name": "reputationAlreadyProcessed",
      "msg": "Reputation already processed"
    },
    {
      "code": 6029,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6030,
      "name": "divisionByZero",
      "msg": "Division by zero"
    },
    {
      "code": 6031,
      "name": "claimsNotComplete",
      "msg": "Not all claims have been processed"
    }
  ],
  "types": [
    {
      "name": "appealVoteChoice",
      "docs": [
        "Vote choice for appeals (separate enum for clearer semantics)"
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "forRestoration"
          },
          {
            "name": "againstRestoration"
          }
        ]
      }
    },
    {
      "name": "challengerAccount",
      "docs": [
        "Challenger account tracking reputation - global per wallet"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "challenger",
            "docs": [
              "Challenger's wallet address"
            ],
            "type": "pubkey"
          },
          {
            "name": "reputation",
            "docs": [
              "Reputation score (basis points)"
            ],
            "type": "u16"
          },
          {
            "name": "disputesSubmitted",
            "docs": [
              "Total disputes submitted"
            ],
            "type": "u64"
          },
          {
            "name": "disputesUpheld",
            "docs": [
              "Disputes that were upheld (challenger was correct)"
            ],
            "type": "u64"
          },
          {
            "name": "disputesDismissed",
            "docs": [
              "Disputes that were dismissed (challenger was wrong)"
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed for PDA"
            ],
            "type": "u8"
          },
          {
            "name": "createdAt",
            "docs": [
              "First dispute timestamp"
            ],
            "type": "i64"
          },
          {
            "name": "lastDisputeAt",
            "docs": [
              "Last dispute timestamp"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "challengerRecord",
      "docs": [
        "Individual challenger's contribution to a dispute",
        "Supports cumulative disputes where multiple challengers contribute"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "dispute",
            "docs": [
              "The dispute this record belongs to"
            ],
            "type": "pubkey"
          },
          {
            "name": "challenger",
            "docs": [
              "Challenger's wallet address"
            ],
            "type": "pubkey"
          },
          {
            "name": "challengerAccount",
            "docs": [
              "Challenger account PDA"
            ],
            "type": "pubkey"
          },
          {
            "name": "bond",
            "docs": [
              "Bond amount contributed by this challenger"
            ],
            "type": "u64"
          },
          {
            "name": "detailsCid",
            "docs": [
              "Evidence CID (IPFS hash)"
            ],
            "type": "string"
          },
          {
            "name": "rewardClaimed",
            "docs": [
              "Whether reward has been claimed"
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed for PDA"
            ],
            "type": "u8"
          },
          {
            "name": "challengedAt",
            "docs": [
              "Timestamp when this challenger joined"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "defenderPool",
      "docs": [
        "Defender's pool that can back multiple subjects - global per wallet"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "docs": [
              "Pool owner's wallet address"
            ],
            "type": "pubkey"
          },
          {
            "name": "totalStake",
            "docs": [
              "Total stake deposited"
            ],
            "type": "u64"
          },
          {
            "name": "available",
            "docs": [
              "Available stake (not held by disputes)"
            ],
            "type": "u64"
          },
          {
            "name": "held",
            "docs": [
              "Held stake (locked by pending disputes)"
            ],
            "type": "u64"
          },
          {
            "name": "subjectCount",
            "docs": [
              "Number of subjects linked to this pool"
            ],
            "type": "u32"
          },
          {
            "name": "pendingDisputes",
            "docs": [
              "Number of pending disputes against subjects in this pool"
            ],
            "type": "u32"
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed for PDA"
            ],
            "type": "u8"
          },
          {
            "name": "createdAt",
            "docs": [
              "Creation timestamp"
            ],
            "type": "i64"
          },
          {
            "name": "updatedAt",
            "docs": [
              "Last update timestamp"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "defenderRecord",
      "docs": [
        "Individual defender's contribution to backing a subject",
        "Supports cumulative staking where multiple defenders back a subject"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "subject",
            "docs": [
              "The subject this record belongs to"
            ],
            "type": "pubkey"
          },
          {
            "name": "defender",
            "docs": [
              "Defender's wallet address"
            ],
            "type": "pubkey"
          },
          {
            "name": "stake",
            "docs": [
              "Total amount staked to back the subject (on subject account)"
            ],
            "type": "u64"
          },
          {
            "name": "stakeInEscrow",
            "docs": [
              "Amount of stake currently at risk in escrow (during active dispute)",
              "This is the amount that will be used for claim calculations"
            ],
            "type": "u64"
          },
          {
            "name": "rewardClaimed",
            "docs": [
              "Whether reward has been claimed"
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed for PDA"
            ],
            "type": "u8"
          },
          {
            "name": "stakedAt",
            "docs": [
              "Timestamp when this defender joined"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "dispute",
      "docs": [
        "Dispute (supports cumulative challengers)"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "subject",
            "docs": [
              "Subject account being disputed"
            ],
            "type": "pubkey"
          },
          {
            "name": "disputeType",
            "docs": [
              "Dispute type"
            ],
            "type": {
              "defined": {
                "name": "disputeType"
              }
            }
          },
          {
            "name": "totalBond",
            "docs": [
              "Total bond from all challengers (cumulative)"
            ],
            "type": "u64"
          },
          {
            "name": "stakeHeld",
            "docs": [
              "Stake held from pool (match mode, linked subjects)"
            ],
            "type": "u64"
          },
          {
            "name": "directStakeHeld",
            "docs": [
              "Stake held from direct stakers on subject (match mode)"
            ],
            "type": "u64"
          },
          {
            "name": "challengerCount",
            "docs": [
              "Number of challengers who contributed"
            ],
            "type": "u16"
          },
          {
            "name": "status",
            "docs": [
              "Dispute status"
            ],
            "type": {
              "defined": {
                "name": "disputeStatus"
              }
            }
          },
          {
            "name": "outcome",
            "docs": [
              "Resolution outcome"
            ],
            "type": {
              "defined": {
                "name": "resolutionOutcome"
              }
            }
          },
          {
            "name": "votesFavorWeight",
            "docs": [
              "Cumulative voting power for \"ForChallenger\" votes"
            ],
            "type": "u64"
          },
          {
            "name": "votesAgainstWeight",
            "docs": [
              "Cumulative voting power for \"ForDefender\" votes"
            ],
            "type": "u64"
          },
          {
            "name": "voteCount",
            "docs": [
              "Number of jurors who voted"
            ],
            "type": "u16"
          },
          {
            "name": "votingStarted",
            "docs": [
              "Whether voting has started (match mode waits for matching)"
            ],
            "type": "bool"
          },
          {
            "name": "votingStartsAt",
            "docs": [
              "Voting start timestamp (0 if not started)"
            ],
            "type": "i64"
          },
          {
            "name": "votingEndsAt",
            "docs": [
              "Voting end timestamp (0 if not started)"
            ],
            "type": "i64"
          },
          {
            "name": "resolvedAt",
            "docs": [
              "Resolution timestamp"
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed for PDA"
            ],
            "type": "u8"
          },
          {
            "name": "createdAt",
            "docs": [
              "Creation timestamp"
            ],
            "type": "i64"
          },
          {
            "name": "poolRewardClaimed",
            "docs": [
              "Pool reward claimed (for linked mode)"
            ],
            "type": "bool"
          },
          {
            "name": "snapshotTotalStake",
            "docs": [
              "Snapshot of subject's total_stake at dispute creation"
            ],
            "type": "u64"
          },
          {
            "name": "snapshotDefenderCount",
            "docs": [
              "Snapshot of subject's defender_count at dispute creation"
            ],
            "type": "u16"
          },
          {
            "name": "challengersClaimed",
            "docs": [
              "Number of challengers who have claimed their reward/refund"
            ],
            "type": "u16"
          },
          {
            "name": "defendersClaimed",
            "docs": [
              "Number of direct defenders who have claimed their reward/refund"
            ],
            "type": "u16"
          },
          {
            "name": "isAppeal",
            "docs": [
              "True if this dispute is an appeal (reverses the meaning of outcomes)"
            ],
            "type": "bool"
          },
          {
            "name": "appealStake",
            "docs": [
              "Stake posted by appellant (for appeals only)"
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "disputeStatus",
      "docs": [
        "Dispute status"
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pending"
          },
          {
            "name": "resolved"
          }
        ]
      }
    },
    {
      "name": "disputeType",
      "docs": [
        "Dispute type (generic categories)"
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "other"
          },
          {
            "name": "breach"
          },
          {
            "name": "fraud"
          },
          {
            "name": "qualityDispute"
          },
          {
            "name": "nonDelivery"
          },
          {
            "name": "misrepresentation"
          },
          {
            "name": "policyViolation"
          },
          {
            "name": "damagesClaim"
          }
        ]
      }
    },
    {
      "name": "jurorAccount",
      "docs": [
        "Juror (arbiter) account - global per wallet",
        "",
        "Balance Model:",
        "- `total_stake`: Total SOL held in this PDA (actual lamports)",
        "- `available_stake`: SOL available to vote or withdraw",
        "- Held (locked): `total_stake - available_stake` (locked in active disputes)",
        "",
        "SOL only transfers on deposit/withdraw. Voting is accounting only."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "juror",
            "docs": [
              "Juror's wallet address"
            ],
            "type": "pubkey"
          },
          {
            "name": "totalStake",
            "docs": [
              "Total stake held in this PDA (actual lamports)"
            ],
            "type": "u64"
          },
          {
            "name": "availableStake",
            "docs": [
              "Available stake (not locked in active disputes)"
            ],
            "type": "u64"
          },
          {
            "name": "reputation",
            "docs": [
              "Reputation score (basis points, 0-10000+)"
            ],
            "type": "u16"
          },
          {
            "name": "votesCast",
            "docs": [
              "Total votes cast"
            ],
            "type": "u64"
          },
          {
            "name": "correctVotes",
            "docs": [
              "Correct votes (aligned with outcome)"
            ],
            "type": "u64"
          },
          {
            "name": "isActive",
            "docs": [
              "Whether juror is active"
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed for PDA"
            ],
            "type": "u8"
          },
          {
            "name": "joinedAt",
            "docs": [
              "Registration timestamp"
            ],
            "type": "i64"
          },
          {
            "name": "lastVoteAt",
            "docs": [
              "Last activity timestamp"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "protocolConfig",
      "docs": [
        "Protocol-wide configuration account",
        "Stores treasury address and admin authority for fee collection"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "docs": [
              "Admin who can update config (deployer initially)"
            ],
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "docs": [
              "Platform fee recipient address"
            ],
            "type": "pubkey"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump seed"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "resolutionOutcome",
      "docs": [
        "Resolution outcome"
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "none"
          },
          {
            "name": "challengerWins"
          },
          {
            "name": "defenderWins"
          },
          {
            "name": "noParticipation"
          }
        ]
      }
    },
    {
      "name": "subject",
      "docs": [
        "Subject that defenders back - global (identified by subject_id)"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "subjectId",
            "docs": [
              "Subject identifier (could be PDA from external program)"
            ],
            "type": "pubkey"
          },
          {
            "name": "defenderPool",
            "docs": [
              "Optional defender pool (default = standalone mode, set = linked to pool)"
            ],
            "type": "pubkey"
          },
          {
            "name": "detailsCid",
            "docs": [
              "Details/metadata CID (IPFS/Arweave) - context provided by first staker"
            ],
            "type": "string"
          },
          {
            "name": "status",
            "docs": [
              "Current status"
            ],
            "type": {
              "defined": {
                "name": "subjectStatus"
              }
            }
          },
          {
            "name": "availableStake",
            "docs": [
              "Available stake for disputes (direct stakes + pool contribution when disputed)",
              "Updated at resolution: available_stake -= stake_at_risk"
            ],
            "type": "u64"
          },
          {
            "name": "maxStake",
            "docs": [
              "Max stake at risk per dispute (for match mode)"
            ],
            "type": "u64"
          },
          {
            "name": "votingPeriod",
            "docs": [
              "Voting period in seconds for this subject's disputes"
            ],
            "type": "i64"
          },
          {
            "name": "defenderCount",
            "docs": [
              "Number of defenders (standalone mode only)"
            ],
            "type": "u16"
          },
          {
            "name": "disputeCount",
            "docs": [
              "Number of disputes (for sequential dispute PDAs)"
            ],
            "type": "u32"
          },
          {
            "name": "matchMode",
            "docs": [
              "Match mode: true = bond must match stake, false = proportionate"
            ],
            "type": "bool"
          },
          {
            "name": "freeCase",
            "docs": [
              "Free case mode: no stake/bond required, no rewards, no reputation impact"
            ],
            "type": "bool"
          },
          {
            "name": "dispute",
            "docs": [
              "Current active dispute (if any)"
            ],
            "type": "pubkey"
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed for PDA"
            ],
            "type": "u8"
          },
          {
            "name": "createdAt",
            "docs": [
              "Creation timestamp"
            ],
            "type": "i64"
          },
          {
            "name": "updatedAt",
            "docs": [
              "Last update timestamp"
            ],
            "type": "i64"
          },
          {
            "name": "lastDisputeTotal",
            "docs": [
              "Previous dispute's (stake + bond) - minimum stake required for appeal"
            ],
            "type": "u64"
          },
          {
            "name": "lastVotingPeriod",
            "docs": [
              "Previous dispute's voting period - appeals use 2x this value"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "subjectStatus",
      "docs": [
        "Subject status"
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "valid"
          },
          {
            "name": "disputed"
          },
          {
            "name": "invalid"
          }
        ]
      }
    },
    {
      "name": "voteChoice",
      "docs": [
        "Vote choice for regular disputes"
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "forChallenger"
          },
          {
            "name": "forDefender"
          }
        ]
      }
    },
    {
      "name": "voteRecord",
      "docs": [
        "Juror's vote on a dispute"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "dispute",
            "docs": [
              "The dispute being voted on"
            ],
            "type": "pubkey"
          },
          {
            "name": "juror",
            "docs": [
              "Juror who cast the vote"
            ],
            "type": "pubkey"
          },
          {
            "name": "jurorAccount",
            "docs": [
              "Juror account PDA"
            ],
            "type": "pubkey"
          },
          {
            "name": "choice",
            "docs": [
              "Vote choice for regular disputes"
            ],
            "type": {
              "defined": {
                "name": "voteChoice"
              }
            }
          },
          {
            "name": "appealChoice",
            "docs": [
              "Vote choice for appeals (only used when is_appeal_vote is true)"
            ],
            "type": {
              "defined": {
                "name": "appealVoteChoice"
              }
            }
          },
          {
            "name": "isAppealVote",
            "docs": [
              "Whether this is an appeal vote"
            ],
            "type": "bool"
          },
          {
            "name": "stakeAllocated",
            "docs": [
              "Stake allocated to this vote"
            ],
            "type": "u64"
          },
          {
            "name": "votingPower",
            "docs": [
              "Calculated voting power (scaled by WEIGHT_PRECISION)"
            ],
            "type": "u64"
          },
          {
            "name": "unlockAt",
            "docs": [
              "When the stake unlocks"
            ],
            "type": "i64"
          },
          {
            "name": "reputationProcessed",
            "docs": [
              "Whether reputation has been processed after resolution"
            ],
            "type": "bool"
          },
          {
            "name": "rewardClaimed",
            "docs": [
              "Whether reward has been claimed"
            ],
            "type": "bool"
          },
          {
            "name": "stakeUnlocked",
            "docs": [
              "Whether stake has been unlocked/returned"
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed for PDA"
            ],
            "type": "u8"
          },
          {
            "name": "votedAt",
            "docs": [
              "Vote timestamp"
            ],
            "type": "i64"
          },
          {
            "name": "rationaleCid",
            "docs": [
              "IPFS CID for vote rationale (optional)"
            ],
            "type": "string"
          }
        ]
      }
    }
  ]
};
