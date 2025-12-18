import { PublicKey, Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import { BN, Wallet, Program } from '@coral-xyz/anchor';

/**
 * PDA derivation helpers for TribunalCraft accounts
 */
declare class PDA {
    private programId;
    constructor(programId?: PublicKey);
    /**
     * Derive Protocol Config PDA
     */
    protocolConfig(): [PublicKey, number];
    /**
     * Derive Defender Pool PDA for an owner
     */
    defenderPool(owner: PublicKey): [PublicKey, number];
    /**
     * Derive Subject PDA for a subject ID
     */
    subject(subjectId: PublicKey): [PublicKey, number];
    /**
     * Derive Juror Account PDA for a juror
     */
    jurorAccount(juror: PublicKey): [PublicKey, number];
    /**
     * Derive Dispute PDA for a subject and dispute count
     */
    dispute(subject: PublicKey, disputeCount: number): [PublicKey, number];
    /**
     * Derive Challenger Account PDA
     */
    challengerAccount(challenger: PublicKey): [PublicKey, number];
    /**
     * Derive Challenger Record PDA for a dispute
     */
    challengerRecord(dispute: PublicKey, challenger: PublicKey): [PublicKey, number];
    /**
     * Derive Defender Record PDA for a subject
     */
    defenderRecord(subject: PublicKey, defender: PublicKey): [PublicKey, number];
    /**
     * Derive Vote Record PDA for a dispute
     */
    voteRecord(dispute: PublicKey, juror: PublicKey): [PublicKey, number];
}
declare const pda: PDA;

/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/tribunalcraft.json`.
 */
type Tribunalcraft = {
    "address": "4b9qTHcLrkjURroj8X9TCr8xKPNqDT7pNrCqi9brLiZX";
    "metadata": {
        "name": "tribunalcraft";
        "version": "0.1.0";
        "spec": "0.1.0";
        "description": "Decentralized arbitration protocol";
    };
    "instructions": [
        {
            "name": "addJurorStake";
            "docs": [
                "Add more stake to juror account"
            ];
            "discriminator": [
                42,
                194,
                234,
                159,
                186,
                115,
                32,
                169
            ];
            "accounts": [
                {
                    "name": "juror";
                    "writable": true;
                    "signer": true;
                    "relations": [
                        "jurorAccount"
                    ];
                },
                {
                    "name": "jurorAccount";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    106,
                                    117,
                                    114,
                                    111,
                                    114
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "juror";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "amount";
                    "type": "u64";
                }
            ];
        },
        {
            "name": "addToDispute";
            "docs": [
                "Add to existing dispute (additional challengers)"
            ];
            "discriminator": [
                110,
                2,
                131,
                29,
                204,
                133,
                164,
                234
            ];
            "accounts": [
                {
                    "name": "challenger";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "subject";
                    "writable": true;
                    "relations": [
                        "dispute"
                    ];
                },
                {
                    "name": "defenderPool";
                    "docs": [
                        "Optional: defender pool if subject is linked"
                    ];
                    "writable": true;
                    "optional": true;
                },
                {
                    "name": "poolOwnerDefenderRecord";
                    "docs": [
                        "Optional: DefenderRecord for pool owner (required if pool has stake to transfer)"
                    ];
                    "writable": true;
                    "optional": true;
                },
                {
                    "name": "challengerAccount";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
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
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "challenger";
                            }
                        ];
                    };
                },
                {
                    "name": "dispute";
                    "writable": true;
                },
                {
                    "name": "challengerRecord";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
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
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "dispute";
                            },
                            {
                                "kind": "account";
                                "path": "challenger";
                            }
                        ];
                    };
                },
                {
                    "name": "protocolConfig";
                    "docs": [
                        "Protocol config for treasury address"
                    ];
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
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
                                ];
                            }
                        ];
                    };
                },
                {
                    "name": "treasury";
                    "docs": [
                        "Treasury receives fees"
                    ];
                    "writable": true;
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "detailsCid";
                    "type": "string";
                },
                {
                    "name": "bond";
                    "type": "u64";
                }
            ];
        },
        {
            "name": "addToStake";
            "docs": [
                "Add stake to a standalone subject"
            ];
            "discriminator": [
                227,
                50,
                25,
                66,
                59,
                214,
                58,
                213
            ];
            "accounts": [
                {
                    "name": "staker";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "subject";
                    "writable": true;
                },
                {
                    "name": "defenderRecord";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
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
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject";
                            },
                            {
                                "kind": "account";
                                "path": "staker";
                            }
                        ];
                    };
                },
                {
                    "name": "dispute";
                    "docs": [
                        "Optional: Active dispute (required if subject has active dispute in proportional mode)"
                    ];
                    "writable": true;
                    "optional": true;
                },
                {
                    "name": "protocolConfig";
                    "docs": [
                        "Protocol config for treasury address (required if proportional dispute)"
                    ];
                    "optional": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
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
                                ];
                            }
                        ];
                    };
                },
                {
                    "name": "treasury";
                    "docs": [
                        "Treasury receives fees (required if proportional dispute)"
                    ];
                    "writable": true;
                    "optional": true;
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "stake";
                    "type": "u64";
                }
            ];
        },
        {
            "name": "addToVote";
            "docs": [
                "Add more stake to an existing vote"
            ];
            "discriminator": [
                202,
                66,
                94,
                152,
                90,
                103,
                240,
                68
            ];
            "accounts": [
                {
                    "name": "juror";
                    "writable": true;
                    "signer": true;
                    "relations": [
                        "jurorAccount",
                        "voteRecord"
                    ];
                },
                {
                    "name": "jurorAccount";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    106,
                                    117,
                                    114,
                                    111,
                                    114
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "juror";
                            }
                        ];
                    };
                },
                {
                    "name": "subject";
                    "relations": [
                        "dispute"
                    ];
                },
                {
                    "name": "dispute";
                    "writable": true;
                    "relations": [
                        "voteRecord"
                    ];
                },
                {
                    "name": "voteRecord";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    118,
                                    111,
                                    116,
                                    101
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "dispute";
                            },
                            {
                                "kind": "account";
                                "path": "juror";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "additionalStake";
                    "type": "u64";
                }
            ];
        },
        {
            "name": "claimChallengerReward";
            "docs": [
                "Claim challenger reward (if dispute upheld)"
            ];
            "discriminator": [
                173,
                143,
                119,
                13,
                142,
                25,
                102,
                36
            ];
            "accounts": [
                {
                    "name": "challenger";
                    "writable": true;
                    "signer": true;
                    "relations": [
                        "challengerRecord"
                    ];
                },
                {
                    "name": "challengerAccount";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
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
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "challenger";
                            }
                        ];
                    };
                },
                {
                    "name": "subject";
                    "writable": true;
                    "relations": [
                        "dispute"
                    ];
                },
                {
                    "name": "dispute";
                    "writable": true;
                    "relations": [
                        "challengerRecord"
                    ];
                },
                {
                    "name": "challengerRecord";
                    "writable": true;
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [];
        },
        {
            "name": "claimDefenderReward";
            "docs": [
                "Claim defender reward (if dispute dismissed)"
            ];
            "discriminator": [
                189,
                13,
                90,
                154,
                251,
                183,
                166,
                135
            ];
            "accounts": [
                {
                    "name": "defender";
                    "writable": true;
                    "signer": true;
                    "relations": [
                        "defenderRecord"
                    ];
                },
                {
                    "name": "subject";
                    "writable": true;
                    "relations": [
                        "dispute",
                        "defenderRecord"
                    ];
                },
                {
                    "name": "dispute";
                    "writable": true;
                },
                {
                    "name": "defenderRecord";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
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
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject";
                            },
                            {
                                "kind": "account";
                                "path": "defender";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [];
        },
        {
            "name": "claimJurorReward";
            "docs": [
                "Claim juror reward for correct vote"
            ];
            "discriminator": [
                220,
                82,
                126,
                176,
                119,
                103,
                33,
                25
            ];
            "accounts": [
                {
                    "name": "juror";
                    "writable": true;
                    "signer": true;
                    "relations": [
                        "jurorAccount",
                        "voteRecord"
                    ];
                },
                {
                    "name": "jurorAccount";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    106,
                                    117,
                                    114,
                                    111,
                                    114
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "juror";
                            }
                        ];
                    };
                },
                {
                    "name": "subject";
                    "writable": true;
                    "relations": [
                        "dispute"
                    ];
                },
                {
                    "name": "dispute";
                    "writable": true;
                    "relations": [
                        "voteRecord"
                    ];
                },
                {
                    "name": "voteRecord";
                    "writable": true;
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [];
        },
        {
            "name": "claimRestorerRefund";
            "docs": [
                "Claim restorer refund for failed restoration request"
            ];
            "discriminator": [
                100,
                102,
                249,
                204,
                60,
                72,
                242,
                87
            ];
            "accounts": [
                {
                    "name": "restorer";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "dispute";
                    "writable": true;
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [];
        },
        {
            "name": "createFreeSubject";
            "docs": [
                "Create a free subject (no stake required, just Subject account)"
            ];
            "discriminator": [
                131,
                154,
                217,
                251,
                107,
                165,
                155,
                197
            ];
            "accounts": [
                {
                    "name": "creator";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "subject";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    115,
                                    117,
                                    98,
                                    106,
                                    101,
                                    99,
                                    116
                                ];
                            },
                            {
                                "kind": "arg";
                                "path": "subjectId";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "subjectId";
                    "type": "pubkey";
                },
                {
                    "name": "detailsCid";
                    "type": "string";
                },
                {
                    "name": "votingPeriod";
                    "type": "i64";
                }
            ];
        },
        {
            "name": "createLinkedSubject";
            "docs": [
                "Create a subject linked to a defender pool"
            ];
            "discriminator": [
                42,
                140,
                162,
                241,
                23,
                166,
                71,
                51
            ];
            "accounts": [
                {
                    "name": "owner";
                    "writable": true;
                    "signer": true;
                    "relations": [
                        "defenderPool"
                    ];
                },
                {
                    "name": "defenderPool";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
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
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "owner";
                            }
                        ];
                    };
                },
                {
                    "name": "subject";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    115,
                                    117,
                                    98,
                                    106,
                                    101,
                                    99,
                                    116
                                ];
                            },
                            {
                                "kind": "arg";
                                "path": "subjectId";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "subjectId";
                    "type": "pubkey";
                },
                {
                    "name": "detailsCid";
                    "type": "string";
                },
                {
                    "name": "maxStake";
                    "type": "u64";
                },
                {
                    "name": "matchMode";
                    "type": "bool";
                },
                {
                    "name": "freeCase";
                    "type": "bool";
                },
                {
                    "name": "votingPeriod";
                    "type": "i64";
                }
            ];
        },
        {
            "name": "createPool";
            "docs": [
                "Create a defender pool with initial stake"
            ];
            "discriminator": [
                233,
                146,
                209,
                142,
                207,
                104,
                64,
                188
            ];
            "accounts": [
                {
                    "name": "owner";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "defenderPool";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
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
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "owner";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "initialStake";
                    "type": "u64";
                }
            ];
        },
        {
            "name": "createSubject";
            "docs": [
                "Create a standalone subject with initial stake"
            ];
            "discriminator": [
                243,
                24,
                101,
                208,
                170,
                5,
                242,
                26
            ];
            "accounts": [
                {
                    "name": "creator";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "subject";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    115,
                                    117,
                                    98,
                                    106,
                                    101,
                                    99,
                                    116
                                ];
                            },
                            {
                                "kind": "arg";
                                "path": "subjectId";
                            }
                        ];
                    };
                },
                {
                    "name": "defenderRecord";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
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
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject";
                            },
                            {
                                "kind": "account";
                                "path": "creator";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "subjectId";
                    "type": "pubkey";
                },
                {
                    "name": "detailsCid";
                    "type": "string";
                },
                {
                    "name": "maxStake";
                    "type": "u64";
                },
                {
                    "name": "matchMode";
                    "type": "bool";
                },
                {
                    "name": "freeCase";
                    "type": "bool";
                },
                {
                    "name": "votingPeriod";
                    "type": "i64";
                },
                {
                    "name": "stake";
                    "type": "u64";
                }
            ];
        },
        {
            "name": "initializeConfig";
            "docs": [
                "Initialize protocol config (one-time setup by deployer)"
            ];
            "discriminator": [
                208,
                127,
                21,
                1,
                194,
                190,
                196,
                70
            ];
            "accounts": [
                {
                    "name": "authority";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "config";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
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
                                ];
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [];
        },
        {
            "name": "registerJuror";
            "docs": [
                "Register as a juror with initial stake"
            ];
            "discriminator": [
                116,
                81,
                98,
                42,
                220,
                219,
                2,
                141
            ];
            "accounts": [
                {
                    "name": "juror";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "jurorAccount";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    106,
                                    117,
                                    114,
                                    111,
                                    114
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "juror";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "stakeAmount";
                    "type": "u64";
                }
            ];
        },
        {
            "name": "resolveDispute";
            "docs": [
                "Resolve a dispute after voting period ends"
            ];
            "discriminator": [
                231,
                6,
                202,
                6,
                96,
                103,
                12,
                230
            ];
            "accounts": [
                {
                    "name": "resolver";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "dispute";
                    "writable": true;
                },
                {
                    "name": "subject";
                    "writable": true;
                    "relations": [
                        "dispute"
                    ];
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [];
        },
        {
            "name": "stakePool";
            "docs": [
                "Add stake to an existing pool"
            ];
            "discriminator": [
                186,
                105,
                178,
                191,
                181,
                236,
                39,
                162
            ];
            "accounts": [
                {
                    "name": "owner";
                    "writable": true;
                    "signer": true;
                    "relations": [
                        "defenderPool"
                    ];
                },
                {
                    "name": "defenderPool";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
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
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "owner";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "amount";
                    "type": "u64";
                }
            ];
        },
        {
            "name": "submitDispute";
            "docs": [
                "Submit a new dispute against a subject (first challenger)"
            ];
            "discriminator": [
                216,
                199,
                236,
                25,
                212,
                79,
                19,
                19
            ];
            "accounts": [
                {
                    "name": "challenger";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "subject";
                    "writable": true;
                },
                {
                    "name": "defenderPool";
                    "docs": [
                        "Optional: defender pool if subject is linked"
                    ];
                    "writable": true;
                    "optional": true;
                },
                {
                    "name": "poolOwnerDefenderRecord";
                    "docs": [
                        "Optional: DefenderRecord for pool owner (required if pool has stake to transfer)"
                    ];
                    "writable": true;
                    "optional": true;
                },
                {
                    "name": "challengerAccount";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
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
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "challenger";
                            }
                        ];
                    };
                },
                {
                    "name": "dispute";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    100,
                                    105,
                                    115,
                                    112,
                                    117,
                                    116,
                                    101
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject";
                            },
                            {
                                "kind": "account";
                                "path": "subject.dispute_count";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "challengerRecord";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
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
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "dispute";
                            },
                            {
                                "kind": "account";
                                "path": "challenger";
                            }
                        ];
                    };
                },
                {
                    "name": "protocolConfig";
                    "docs": [
                        "Protocol config for treasury address"
                    ];
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
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
                                ];
                            }
                        ];
                    };
                },
                {
                    "name": "treasury";
                    "docs": [
                        "Treasury receives fees"
                    ];
                    "writable": true;
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "disputeType";
                    "type": {
                        "defined": {
                            "name": "disputeType";
                        };
                    };
                },
                {
                    "name": "detailsCid";
                    "type": "string";
                },
                {
                    "name": "bond";
                    "type": "u64";
                }
            ];
        },
        {
            "name": "submitFreeDispute";
            "docs": [
                "Submit a free dispute (no bond required, just Dispute account)"
            ];
            "discriminator": [
                140,
                225,
                220,
                24,
                64,
                19,
                209,
                197
            ];
            "accounts": [
                {
                    "name": "challenger";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "subject";
                    "writable": true;
                },
                {
                    "name": "dispute";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    100,
                                    105,
                                    115,
                                    112,
                                    117,
                                    116,
                                    101
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject";
                            },
                            {
                                "kind": "account";
                                "path": "subject.dispute_count";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "disputeType";
                    "type": {
                        "defined": {
                            "name": "disputeType";
                        };
                    };
                },
                {
                    "name": "detailsCid";
                    "type": "string";
                }
            ];
        },
        {
            "name": "submitRestore";
            "docs": [
                "Submit a restoration request against an invalidated subject",
                "Restorations allow community to reverse previous invalidation decisions",
                "Restorer stakes (no bond required), voting period is 2x previous"
            ];
            "discriminator": [
                32,
                59,
                202,
                78,
                224,
                183,
                80,
                191
            ];
            "accounts": [
                {
                    "name": "restorer";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "subject";
                    "writable": true;
                },
                {
                    "name": "dispute";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    100,
                                    105,
                                    115,
                                    112,
                                    117,
                                    116,
                                    101
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject";
                            },
                            {
                                "kind": "account";
                                "path": "subject.dispute_count";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "protocolConfig";
                    "docs": [
                        "Protocol config for treasury address"
                    ];
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
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
                                ];
                            }
                        ];
                    };
                },
                {
                    "name": "treasury";
                    "docs": [
                        "Treasury receives platform fee"
                    ];
                    "writable": true;
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "disputeType";
                    "type": {
                        "defined": {
                            "name": "disputeType";
                        };
                    };
                },
                {
                    "name": "detailsCid";
                    "type": "string";
                },
                {
                    "name": "stakeAmount";
                    "type": "u64";
                }
            ];
        },
        {
            "name": "unlockJurorStake";
            "docs": [
                "Unlock juror stake after 7-day buffer"
            ];
            "discriminator": [
                109,
                73,
                56,
                32,
                115,
                125,
                5,
                242
            ];
            "accounts": [
                {
                    "name": "juror";
                    "writable": true;
                    "signer": true;
                    "relations": [
                        "jurorAccount",
                        "voteRecord"
                    ];
                },
                {
                    "name": "jurorAccount";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    106,
                                    117,
                                    114,
                                    111,
                                    114
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "juror";
                            }
                        ];
                    };
                },
                {
                    "name": "dispute";
                    "relations": [
                        "voteRecord"
                    ];
                },
                {
                    "name": "voteRecord";
                    "writable": true;
                }
            ];
            "args": [];
        },
        {
            "name": "unregisterJuror";
            "docs": [
                "Unregister juror and withdraw all available stake"
            ];
            "discriminator": [
                199,
                200,
                113,
                139,
                182,
                118,
                206,
                124
            ];
            "accounts": [
                {
                    "name": "juror";
                    "writable": true;
                    "signer": true;
                    "relations": [
                        "jurorAccount"
                    ];
                },
                {
                    "name": "jurorAccount";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    106,
                                    117,
                                    114,
                                    111,
                                    114
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "juror";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [];
        },
        {
            "name": "updateTreasury";
            "docs": [
                "Update treasury address (admin only)"
            ];
            "discriminator": [
                60,
                16,
                243,
                66,
                96,
                59,
                254,
                131
            ];
            "accounts": [
                {
                    "name": "authority";
                    "writable": true;
                    "signer": true;
                    "relations": [
                        "config"
                    ];
                },
                {
                    "name": "config";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
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
                                ];
                            }
                        ];
                    };
                }
            ];
            "args": [
                {
                    "name": "newTreasury";
                    "type": "pubkey";
                }
            ];
        },
        {
            "name": "voteOnDispute";
            "docs": [
                "Vote on a dispute with stake allocation"
            ];
            "discriminator": [
                7,
                213,
                96,
                171,
                252,
                59,
                55,
                23
            ];
            "accounts": [
                {
                    "name": "juror";
                    "writable": true;
                    "signer": true;
                    "relations": [
                        "jurorAccount"
                    ];
                },
                {
                    "name": "jurorAccount";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    106,
                                    117,
                                    114,
                                    111,
                                    114
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "juror";
                            }
                        ];
                    };
                },
                {
                    "name": "subject";
                    "relations": [
                        "dispute"
                    ];
                },
                {
                    "name": "dispute";
                    "writable": true;
                },
                {
                    "name": "voteRecord";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    118,
                                    111,
                                    116,
                                    101
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "dispute";
                            },
                            {
                                "kind": "account";
                                "path": "juror";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "choice";
                    "type": {
                        "defined": {
                            "name": "voteChoice";
                        };
                    };
                },
                {
                    "name": "stakeAllocation";
                    "type": "u64";
                },
                {
                    "name": "rationaleCid";
                    "type": "string";
                }
            ];
        },
        {
            "name": "voteOnRestore";
            "docs": [
                "Vote on a restoration with stake allocation",
                "ForRestoration = vote to restore subject to Valid",
                "AgainstRestoration = vote to keep subject Invalidated"
            ];
            "discriminator": [
                122,
                123,
                92,
                240,
                251,
                205,
                189,
                32
            ];
            "accounts": [
                {
                    "name": "juror";
                    "writable": true;
                    "signer": true;
                    "relations": [
                        "jurorAccount"
                    ];
                },
                {
                    "name": "jurorAccount";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    106,
                                    117,
                                    114,
                                    111,
                                    114
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "juror";
                            }
                        ];
                    };
                },
                {
                    "name": "subject";
                    "relations": [
                        "dispute"
                    ];
                },
                {
                    "name": "dispute";
                    "writable": true;
                },
                {
                    "name": "voteRecord";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    118,
                                    111,
                                    116,
                                    101
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "dispute";
                            },
                            {
                                "kind": "account";
                                "path": "juror";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "choice";
                    "type": {
                        "defined": {
                            "name": "restoreVoteChoice";
                        };
                    };
                },
                {
                    "name": "stakeAllocation";
                    "type": "u64";
                },
                {
                    "name": "rationaleCid";
                    "type": "string";
                }
            ];
        },
        {
            "name": "withdrawJurorStake";
            "docs": [
                "Withdraw available stake (with reputation-based slashing)"
            ];
            "discriminator": [
                178,
                43,
                144,
                250,
                188,
                199,
                135,
                133
            ];
            "accounts": [
                {
                    "name": "juror";
                    "writable": true;
                    "signer": true;
                    "relations": [
                        "jurorAccount"
                    ];
                },
                {
                    "name": "jurorAccount";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    106,
                                    117,
                                    114,
                                    111,
                                    114
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "juror";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "amount";
                    "type": "u64";
                }
            ];
        },
        {
            "name": "withdrawPool";
            "docs": [
                "Withdraw available stake from pool"
            ];
            "discriminator": [
                190,
                43,
                148,
                248,
                68,
                5,
                215,
                136
            ];
            "accounts": [
                {
                    "name": "owner";
                    "writable": true;
                    "signer": true;
                    "relations": [
                        "defenderPool"
                    ];
                },
                {
                    "name": "defenderPool";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
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
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "owner";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "amount";
                    "type": "u64";
                }
            ];
        }
    ];
    "accounts": [
        {
            "name": "challengerAccount";
            "discriminator": [
                63,
                207,
                170,
                69,
                229,
                2,
                163,
                201
            ];
        },
        {
            "name": "challengerRecord";
            "discriminator": [
                8,
                80,
                134,
                108,
                192,
                142,
                121,
                14
            ];
        },
        {
            "name": "defenderPool";
            "discriminator": [
                227,
                100,
                92,
                157,
                203,
                252,
                63,
                118
            ];
        },
        {
            "name": "defenderRecord";
            "discriminator": [
                14,
                3,
                219,
                215,
                38,
                254,
                254,
                92
            ];
        },
        {
            "name": "dispute";
            "discriminator": [
                36,
                49,
                241,
                67,
                40,
                36,
                241,
                74
            ];
        },
        {
            "name": "jurorAccount";
            "discriminator": [
                138,
                222,
                50,
                194,
                222,
                131,
                255,
                186
            ];
        },
        {
            "name": "protocolConfig";
            "discriminator": [
                207,
                91,
                250,
                28,
                152,
                179,
                215,
                209
            ];
        },
        {
            "name": "subject";
            "discriminator": [
                52,
                161,
                41,
                165,
                202,
                238,
                138,
                166
            ];
        },
        {
            "name": "voteRecord";
            "discriminator": [
                112,
                9,
                123,
                165,
                234,
                9,
                157,
                167
            ];
        }
    ];
    "errors": [
        {
            "code": 6000;
            "name": "unauthorized";
            "msg": "unauthorized";
        },
        {
            "code": 6001;
            "name": "invalidConfig";
            "msg": "Invalid configuration parameter";
        },
        {
            "code": 6002;
            "name": "stakeBelowMinimum";
            "msg": "Stake amount below minimum";
        },
        {
            "code": 6003;
            "name": "insufficientAvailableStake";
            "msg": "Insufficient available stake";
        },
        {
            "code": 6004;
            "name": "insufficientHeldStake";
            "msg": "Insufficient held stake";
        },
        {
            "code": 6005;
            "name": "stakeStillLocked";
            "msg": "Stake still locked";
        },
        {
            "code": 6006;
            "name": "stakeAlreadyUnlocked";
            "msg": "Stake already unlocked";
        },
        {
            "code": 6007;
            "name": "bondBelowMinimum";
            "msg": "Bond amount below minimum";
        },
        {
            "code": 6008;
            "name": "bondExceedsAvailable";
            "msg": "Bond exceeds staker's available pool";
        },
        {
            "code": 6009;
            "name": "subjectCannotBeStaked";
            "msg": "Subject cannot accept stakes";
        },
        {
            "code": 6010;
            "name": "subjectCannotBeDisputed";
            "msg": "Subject cannot be disputed";
        },
        {
            "code": 6011;
            "name": "subjectCannotBeRestored";
            "msg": "Subject cannot be restored";
        },
        {
            "code": 6012;
            "name": "restoreStakeBelowMinimum";
            "msg": "Restore stake below minimum (must match previous dispute total)";
        },
        {
            "code": 6013;
            "name": "notARestore";
            "msg": "This dispute is not a restoration request";
        },
        {
            "code": 6014;
            "name": "cannotSelfDispute";
            "msg": "Cannot dispute own subject";
        },
        {
            "code": 6015;
            "name": "disputeAlreadyExists";
            "msg": "Dispute already exists for this subject";
        },
        {
            "code": 6016;
            "name": "disputeNotFound";
            "msg": "Dispute not found";
        },
        {
            "code": 6017;
            "name": "disputeAlreadyResolved";
            "msg": "Dispute already resolved";
        },
        {
            "code": 6018;
            "name": "votingNotEnded";
            "msg": "Voting period not ended";
        },
        {
            "code": 6019;
            "name": "votingEnded";
            "msg": "Voting period has ended";
        },
        {
            "code": 6020;
            "name": "cannotVoteOnOwnDispute";
            "msg": "Cannot vote on own dispute";
        },
        {
            "code": 6021;
            "name": "alreadyVoted";
            "msg": "Already voted on this dispute";
        },
        {
            "code": 6022;
            "name": "voteAllocationBelowMinimum";
            "msg": "Vote allocation below minimum";
        },
        {
            "code": 6023;
            "name": "invalidVoteChoice";
            "msg": "Invalid vote choice";
        },
        {
            "code": 6024;
            "name": "jurorNotActive";
            "msg": "Juror not active";
        },
        {
            "code": 6025;
            "name": "jurorAlreadyRegistered";
            "msg": "Juror already registered";
        },
        {
            "code": 6026;
            "name": "challengerNotFound";
            "msg": "Challenger not found";
        },
        {
            "code": 6027;
            "name": "rewardAlreadyClaimed";
            "msg": "Reward already claimed";
        },
        {
            "code": 6028;
            "name": "notEligibleForReward";
            "msg": "Not eligible for reward";
        },
        {
            "code": 6029;
            "name": "reputationAlreadyProcessed";
            "msg": "Reputation already processed";
        },
        {
            "code": 6030;
            "name": "arithmeticOverflow";
            "msg": "Arithmetic overflow";
        },
        {
            "code": 6031;
            "name": "divisionByZero";
            "msg": "Division by zero";
        },
        {
            "code": 6032;
            "name": "claimsNotComplete";
            "msg": "Not all claims have been processed";
        }
    ];
    "types": [
        {
            "name": "challengerAccount";
            "docs": [
                "Challenger account tracking reputation - global per wallet"
            ];
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "challenger";
                        "docs": [
                            "Challenger's wallet address"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "reputation";
                        "docs": [
                            "Reputation score (basis points)"
                        ];
                        "type": "u16";
                    },
                    {
                        "name": "disputesSubmitted";
                        "docs": [
                            "Total disputes submitted"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "disputesUpheld";
                        "docs": [
                            "Disputes that were upheld (challenger was correct)"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "disputesDismissed";
                        "docs": [
                            "Disputes that were dismissed (challenger was wrong)"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "bump";
                        "docs": [
                            "Bump seed for PDA"
                        ];
                        "type": "u8";
                    },
                    {
                        "name": "createdAt";
                        "docs": [
                            "First dispute timestamp"
                        ];
                        "type": "i64";
                    },
                    {
                        "name": "lastDisputeAt";
                        "docs": [
                            "Last dispute timestamp"
                        ];
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "challengerRecord";
            "docs": [
                "Individual challenger's contribution to a dispute",
                "Supports cumulative disputes where multiple challengers contribute"
            ];
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "dispute";
                        "docs": [
                            "The dispute this record belongs to"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "challenger";
                        "docs": [
                            "Challenger's wallet address"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "challengerAccount";
                        "docs": [
                            "Challenger account PDA"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "bond";
                        "docs": [
                            "Bond amount contributed by this challenger"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "detailsCid";
                        "docs": [
                            "Evidence CID (IPFS hash)"
                        ];
                        "type": "string";
                    },
                    {
                        "name": "rewardClaimed";
                        "docs": [
                            "Whether reward has been claimed"
                        ];
                        "type": "bool";
                    },
                    {
                        "name": "bump";
                        "docs": [
                            "Bump seed for PDA"
                        ];
                        "type": "u8";
                    },
                    {
                        "name": "challengedAt";
                        "docs": [
                            "Timestamp when this challenger joined"
                        ];
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "defenderPool";
            "docs": [
                "Defender's pool that can back multiple subjects - global per wallet"
            ];
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "owner";
                        "docs": [
                            "Pool owner's wallet address"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "totalStake";
                        "docs": [
                            "Total stake deposited"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "available";
                        "docs": [
                            "Available stake (not held by disputes)"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "held";
                        "docs": [
                            "Held stake (locked by pending disputes)"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "subjectCount";
                        "docs": [
                            "Number of subjects linked to this pool"
                        ];
                        "type": "u32";
                    },
                    {
                        "name": "pendingDisputes";
                        "docs": [
                            "Number of pending disputes against subjects in this pool"
                        ];
                        "type": "u32";
                    },
                    {
                        "name": "bump";
                        "docs": [
                            "Bump seed for PDA"
                        ];
                        "type": "u8";
                    },
                    {
                        "name": "createdAt";
                        "docs": [
                            "Creation timestamp"
                        ];
                        "type": "i64";
                    },
                    {
                        "name": "updatedAt";
                        "docs": [
                            "Last update timestamp"
                        ];
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "defenderRecord";
            "docs": [
                "Individual defender's contribution to backing a subject",
                "Supports cumulative staking where multiple defenders back a subject"
            ];
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "subject";
                        "docs": [
                            "The subject this record belongs to"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "defender";
                        "docs": [
                            "Defender's wallet address"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "stake";
                        "docs": [
                            "Total amount staked to back the subject (on subject account)"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "stakeInEscrow";
                        "docs": [
                            "Amount of stake currently at risk in escrow (during active dispute)",
                            "This is the amount that will be used for claim calculations"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "rewardClaimed";
                        "docs": [
                            "Whether reward has been claimed"
                        ];
                        "type": "bool";
                    },
                    {
                        "name": "bump";
                        "docs": [
                            "Bump seed for PDA"
                        ];
                        "type": "u8";
                    },
                    {
                        "name": "stakedAt";
                        "docs": [
                            "Timestamp when this defender joined"
                        ];
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "dispute";
            "docs": [
                "Dispute (supports cumulative challengers)"
            ];
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "subject";
                        "docs": [
                            "Subject account being disputed"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "disputeType";
                        "docs": [
                            "Dispute type"
                        ];
                        "type": {
                            "defined": {
                                "name": "disputeType";
                            };
                        };
                    },
                    {
                        "name": "totalBond";
                        "docs": [
                            "Total bond from all challengers (cumulative)"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "stakeHeld";
                        "docs": [
                            "Stake held from pool (match mode, linked subjects)"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "directStakeHeld";
                        "docs": [
                            "Stake held from direct stakers on subject (match mode)"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "challengerCount";
                        "docs": [
                            "Number of challengers who contributed"
                        ];
                        "type": "u16";
                    },
                    {
                        "name": "status";
                        "docs": [
                            "Dispute status"
                        ];
                        "type": {
                            "defined": {
                                "name": "disputeStatus";
                            };
                        };
                    },
                    {
                        "name": "outcome";
                        "docs": [
                            "Resolution outcome"
                        ];
                        "type": {
                            "defined": {
                                "name": "resolutionOutcome";
                            };
                        };
                    },
                    {
                        "name": "votesFavorWeight";
                        "docs": [
                            "Cumulative voting power for \"ForChallenger\" votes"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "votesAgainstWeight";
                        "docs": [
                            "Cumulative voting power for \"ForDefender\" votes"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "voteCount";
                        "docs": [
                            "Number of jurors who voted"
                        ];
                        "type": "u16";
                    },
                    {
                        "name": "votingStarted";
                        "docs": [
                            "Whether voting has started (match mode waits for matching)"
                        ];
                        "type": "bool";
                    },
                    {
                        "name": "votingStartsAt";
                        "docs": [
                            "Voting start timestamp (0 if not started)"
                        ];
                        "type": "i64";
                    },
                    {
                        "name": "votingEndsAt";
                        "docs": [
                            "Voting end timestamp (0 if not started)"
                        ];
                        "type": "i64";
                    },
                    {
                        "name": "resolvedAt";
                        "docs": [
                            "Resolution timestamp"
                        ];
                        "type": "i64";
                    },
                    {
                        "name": "bump";
                        "docs": [
                            "Bump seed for PDA"
                        ];
                        "type": "u8";
                    },
                    {
                        "name": "createdAt";
                        "docs": [
                            "Creation timestamp"
                        ];
                        "type": "i64";
                    },
                    {
                        "name": "poolRewardClaimed";
                        "docs": [
                            "Pool reward claimed (for linked mode)"
                        ];
                        "type": "bool";
                    },
                    {
                        "name": "snapshotTotalStake";
                        "docs": [
                            "Snapshot of subject's total_stake at dispute creation"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "snapshotDefenderCount";
                        "docs": [
                            "Snapshot of subject's defender_count at dispute creation"
                        ];
                        "type": "u16";
                    },
                    {
                        "name": "challengersClaimed";
                        "docs": [
                            "Number of challengers who have claimed their reward/refund"
                        ];
                        "type": "u16";
                    },
                    {
                        "name": "defendersClaimed";
                        "docs": [
                            "Number of direct defenders who have claimed their reward/refund"
                        ];
                        "type": "u16";
                    },
                    {
                        "name": "isRestore";
                        "docs": [
                            "True if this dispute is a restoration request (reverses the meaning of outcomes)"
                        ];
                        "type": "bool";
                    },
                    {
                        "name": "restoreStake";
                        "docs": [
                            "Stake posted by restorer (for restorations only)"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "restorer";
                        "docs": [
                            "Restorer's pubkey (for restorations only, used for refunds)"
                        ];
                        "type": "pubkey";
                    }
                ];
            };
        },
        {
            "name": "disputeStatus";
            "docs": [
                "Dispute status"
            ];
            "type": {
                "kind": "enum";
                "variants": [
                    {
                        "name": "pending";
                    },
                    {
                        "name": "resolved";
                    }
                ];
            };
        },
        {
            "name": "disputeType";
            "docs": [
                "Dispute type (generic categories)"
            ];
            "type": {
                "kind": "enum";
                "variants": [
                    {
                        "name": "other";
                    },
                    {
                        "name": "breach";
                    },
                    {
                        "name": "fraud";
                    },
                    {
                        "name": "qualityDispute";
                    },
                    {
                        "name": "nonDelivery";
                    },
                    {
                        "name": "misrepresentation";
                    },
                    {
                        "name": "policyViolation";
                    },
                    {
                        "name": "damagesClaim";
                    }
                ];
            };
        },
        {
            "name": "jurorAccount";
            "docs": [
                "Juror (arbiter) account - global per wallet",
                "",
                "Balance Model:",
                "- `total_stake`: Total SOL held in this PDA (actual lamports)",
                "- `available_stake`: SOL available to vote or withdraw",
                "- Held (locked): `total_stake - available_stake` (locked in active disputes)",
                "",
                "SOL only transfers on deposit/withdraw. Voting is accounting only."
            ];
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "juror";
                        "docs": [
                            "Juror's wallet address"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "totalStake";
                        "docs": [
                            "Total stake held in this PDA (actual lamports)"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "availableStake";
                        "docs": [
                            "Available stake (not locked in active disputes)"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "reputation";
                        "docs": [
                            "Reputation score (basis points, 0-10000+)"
                        ];
                        "type": "u16";
                    },
                    {
                        "name": "votesCast";
                        "docs": [
                            "Total votes cast"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "correctVotes";
                        "docs": [
                            "Correct votes (aligned with outcome)"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "isActive";
                        "docs": [
                            "Whether juror is active"
                        ];
                        "type": "bool";
                    },
                    {
                        "name": "bump";
                        "docs": [
                            "Bump seed for PDA"
                        ];
                        "type": "u8";
                    },
                    {
                        "name": "joinedAt";
                        "docs": [
                            "Registration timestamp"
                        ];
                        "type": "i64";
                    },
                    {
                        "name": "lastVoteAt";
                        "docs": [
                            "Last activity timestamp"
                        ];
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "protocolConfig";
            "docs": [
                "Protocol-wide configuration account",
                "Stores treasury address and admin authority for fee collection"
            ];
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "authority";
                        "docs": [
                            "Admin who can update config (deployer initially)"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "treasury";
                        "docs": [
                            "Platform fee recipient address"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "bump";
                        "docs": [
                            "PDA bump seed"
                        ];
                        "type": "u8";
                    }
                ];
            };
        },
        {
            "name": "resolutionOutcome";
            "docs": [
                "Resolution outcome"
            ];
            "type": {
                "kind": "enum";
                "variants": [
                    {
                        "name": "none";
                    },
                    {
                        "name": "challengerWins";
                    },
                    {
                        "name": "defenderWins";
                    },
                    {
                        "name": "noParticipation";
                    }
                ];
            };
        },
        {
            "name": "restoreVoteChoice";
            "docs": [
                "Vote choice for restorations (separate enum for clearer semantics)"
            ];
            "type": {
                "kind": "enum";
                "variants": [
                    {
                        "name": "forRestoration";
                    },
                    {
                        "name": "againstRestoration";
                    }
                ];
            };
        },
        {
            "name": "subject";
            "docs": [
                "Subject that defenders back - global (identified by subject_id)"
            ];
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "subjectId";
                        "docs": [
                            "Subject identifier (could be PDA from external program)"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "defenderPool";
                        "docs": [
                            "Optional defender pool (default = standalone mode, set = linked to pool)"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "detailsCid";
                        "docs": [
                            "Details/metadata CID (IPFS/Arweave) - context provided by first staker"
                        ];
                        "type": "string";
                    },
                    {
                        "name": "status";
                        "docs": [
                            "Current status"
                        ];
                        "type": {
                            "defined": {
                                "name": "subjectStatus";
                            };
                        };
                    },
                    {
                        "name": "availableStake";
                        "docs": [
                            "Available stake for disputes (direct stakes + pool contribution when disputed)",
                            "Updated at resolution: available_stake -= stake_at_risk"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "maxStake";
                        "docs": [
                            "Max stake at risk per dispute (for match mode)"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "votingPeriod";
                        "docs": [
                            "Voting period in seconds for this subject's disputes"
                        ];
                        "type": "i64";
                    },
                    {
                        "name": "defenderCount";
                        "docs": [
                            "Number of defenders (standalone mode only)"
                        ];
                        "type": "u16";
                    },
                    {
                        "name": "disputeCount";
                        "docs": [
                            "Number of disputes (for sequential dispute PDAs)"
                        ];
                        "type": "u32";
                    },
                    {
                        "name": "matchMode";
                        "docs": [
                            "Match mode: true = bond must match stake, false = proportionate"
                        ];
                        "type": "bool";
                    },
                    {
                        "name": "freeCase";
                        "docs": [
                            "Free case mode: no stake/bond required, no rewards, no reputation impact"
                        ];
                        "type": "bool";
                    },
                    {
                        "name": "dispute";
                        "docs": [
                            "Current active dispute (if any)"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "bump";
                        "docs": [
                            "Bump seed for PDA"
                        ];
                        "type": "u8";
                    },
                    {
                        "name": "createdAt";
                        "docs": [
                            "Creation timestamp"
                        ];
                        "type": "i64";
                    },
                    {
                        "name": "updatedAt";
                        "docs": [
                            "Last update timestamp"
                        ];
                        "type": "i64";
                    },
                    {
                        "name": "lastDisputeTotal";
                        "docs": [
                            "Previous dispute's (stake + bond) - minimum stake required for restoration"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "lastVotingPeriod";
                        "docs": [
                            "Previous dispute's voting period - restorations use 2x this value"
                        ];
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "subjectStatus";
            "docs": [
                "Subject status"
            ];
            "type": {
                "kind": "enum";
                "variants": [
                    {
                        "name": "valid";
                    },
                    {
                        "name": "disputed";
                    },
                    {
                        "name": "invalid";
                    },
                    {
                        "name": "dormant";
                    },
                    {
                        "name": "restoring";
                    }
                ];
            };
        },
        {
            "name": "voteChoice";
            "docs": [
                "Vote choice for regular disputes"
            ];
            "type": {
                "kind": "enum";
                "variants": [
                    {
                        "name": "forChallenger";
                    },
                    {
                        "name": "forDefender";
                    }
                ];
            };
        },
        {
            "name": "voteRecord";
            "docs": [
                "Juror's vote on a dispute"
            ];
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "dispute";
                        "docs": [
                            "The dispute being voted on"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "juror";
                        "docs": [
                            "Juror who cast the vote"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "jurorAccount";
                        "docs": [
                            "Juror account PDA"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "choice";
                        "docs": [
                            "Vote choice for regular disputes"
                        ];
                        "type": {
                            "defined": {
                                "name": "voteChoice";
                            };
                        };
                    },
                    {
                        "name": "restoreChoice";
                        "docs": [
                            "Vote choice for restorations (only used when is_restore_vote is true)"
                        ];
                        "type": {
                            "defined": {
                                "name": "restoreVoteChoice";
                            };
                        };
                    },
                    {
                        "name": "isRestoreVote";
                        "docs": [
                            "Whether this is a restoration vote"
                        ];
                        "type": "bool";
                    },
                    {
                        "name": "stakeAllocated";
                        "docs": [
                            "Stake allocated to this vote"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "votingPower";
                        "docs": [
                            "Calculated voting power (scaled by WEIGHT_PRECISION)"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "unlockAt";
                        "docs": [
                            "When the stake unlocks"
                        ];
                        "type": "i64";
                    },
                    {
                        "name": "reputationProcessed";
                        "docs": [
                            "Whether reputation has been processed after resolution"
                        ];
                        "type": "bool";
                    },
                    {
                        "name": "rewardClaimed";
                        "docs": [
                            "Whether reward has been claimed"
                        ];
                        "type": "bool";
                    },
                    {
                        "name": "stakeUnlocked";
                        "docs": [
                            "Whether stake has been unlocked/returned"
                        ];
                        "type": "bool";
                    },
                    {
                        "name": "bump";
                        "docs": [
                            "Bump seed for PDA"
                        ];
                        "type": "u8";
                    },
                    {
                        "name": "votedAt";
                        "docs": [
                            "Vote timestamp"
                        ];
                        "type": "i64";
                    },
                    {
                        "name": "rationaleCid";
                        "docs": [
                            "IPFS CID for vote rationale (optional)"
                        ];
                        "type": "string";
                    }
                ];
            };
        }
    ];
};

interface ProtocolConfig {
    authority: PublicKey;
    treasury: PublicKey;
    bump: number;
}
interface DefenderPool {
    owner: PublicKey;
    totalStake: BN;
    available: BN;
    held: BN;
    subjectCount: number;
    pendingDisputes: number;
    bump: number;
    createdAt: BN;
    updatedAt: BN;
}
interface Subject {
    subjectId: PublicKey;
    defenderPool: PublicKey;
    detailsCid: string;
    status: SubjectStatus;
    availableStake: BN;
    maxStake: BN;
    votingPeriod: BN;
    defenderCount: number;
    disputeCount: number;
    matchMode: boolean;
    freeCase: boolean;
    dispute: PublicKey;
    bump: number;
    createdAt: BN;
    updatedAt: BN;
    lastDisputeTotal: BN;
    lastVotingPeriod: BN;
}
interface Dispute {
    subject: PublicKey;
    disputeType: DisputeType;
    totalBond: BN;
    stakeHeld: BN;
    directStakeHeld: BN;
    challengerCount: number;
    status: DisputeStatus;
    outcome: ResolutionOutcome;
    votesFavorWeight: BN;
    votesAgainstWeight: BN;
    voteCount: number;
    votingStarted: boolean;
    votingStartsAt: BN;
    votingEndsAt: BN;
    resolvedAt: BN;
    bump: number;
    createdAt: BN;
    poolRewardClaimed: boolean;
    snapshotTotalStake: BN;
    snapshotDefenderCount: number;
    challengersClaimed: number;
    defendersClaimed: number;
    isRestore: boolean;
    restoreStake: BN;
    restorer: PublicKey;
}
interface JurorAccount {
    juror: PublicKey;
    totalStake: BN;
    availableStake: BN;
    reputation: number;
    votesCast: BN;
    correctVotes: BN;
    isActive: boolean;
    bump: number;
    joinedAt: BN;
    lastVoteAt: BN;
}
interface VoteRecord {
    dispute: PublicKey;
    juror: PublicKey;
    jurorAccount: PublicKey;
    choice: VoteChoice;
    restoreChoice: RestoreVoteChoice;
    isRestoreVote: boolean;
    stakeAllocated: BN;
    votingPower: BN;
    unlockAt: BN;
    reputationProcessed: boolean;
    rewardClaimed: boolean;
    stakeUnlocked: boolean;
    bump: number;
    votedAt: BN;
    rationaleCid: string;
}
interface ChallengerAccount {
    challenger: PublicKey;
    reputation: number;
    disputesSubmitted: BN;
    disputesUpheld: BN;
    disputesDismissed: BN;
    bump: number;
    createdAt: BN;
    lastDisputeAt: BN;
}
interface ChallengerRecord {
    dispute: PublicKey;
    challenger: PublicKey;
    challengerAccount: PublicKey;
    bond: BN;
    detailsCid: string;
    rewardClaimed: boolean;
    bump: number;
    challengedAt: BN;
}
interface DefenderRecord {
    subject: PublicKey;
    defender: PublicKey;
    stake: BN;
    rewardClaimed: boolean;
    bump: number;
    stakedAt: BN;
}
type SubjectStatus = {
    valid: Record<string, never>;
} | {
    disputed: Record<string, never>;
} | {
    invalid: Record<string, never>;
} | {
    dormant: Record<string, never>;
} | {
    restoring: Record<string, never>;
};
type DisputeStatus = {
    pending: Record<string, never>;
} | {
    resolved: Record<string, never>;
};
type ResolutionOutcome = {
    none: Record<string, never>;
} | {
    challengerWins: Record<string, never>;
} | {
    defenderWins: Record<string, never>;
} | {
    noParticipation: Record<string, never>;
};
type DisputeType = {
    other: Record<string, never>;
} | {
    breach: Record<string, never>;
} | {
    fraud: Record<string, never>;
} | {
    qualityDispute: Record<string, never>;
} | {
    nonDelivery: Record<string, never>;
} | {
    misrepresentation: Record<string, never>;
} | {
    policyViolation: Record<string, never>;
} | {
    damagesClaim: Record<string, never>;
};
type VoteChoice = {
    forChallenger: Record<string, never>;
} | {
    forDefender: Record<string, never>;
};
type RestoreVoteChoice = {
    forRestoration: Record<string, never>;
} | {
    againstRestoration: Record<string, never>;
};
declare const SubjectStatusEnum: {
    Valid: SubjectStatus;
    Disputed: SubjectStatus;
    Invalid: SubjectStatus;
    Dormant: SubjectStatus;
    Restoring: SubjectStatus;
};
declare const DisputeStatusEnum: {
    Pending: DisputeStatus;
    Resolved: DisputeStatus;
};
declare const ResolutionOutcomeEnum: {
    None: ResolutionOutcome;
    ChallengerWins: ResolutionOutcome;
    DefenderWins: ResolutionOutcome;
    NoParticipation: ResolutionOutcome;
};
declare const DisputeTypeEnum: {
    Other: DisputeType;
    Breach: DisputeType;
    Fraud: DisputeType;
    QualityDispute: DisputeType;
    NonDelivery: DisputeType;
    Misrepresentation: DisputeType;
    PolicyViolation: DisputeType;
    DamagesClaim: DisputeType;
};
declare const VoteChoiceEnum: {
    ForChallenger: VoteChoice;
    ForDefender: VoteChoice;
};
declare const RestoreVoteChoiceEnum: {
    ForRestoration: RestoreVoteChoice;
    AgainstRestoration: RestoreVoteChoice;
};
declare function isSubjectValid(status: SubjectStatus): boolean;
declare function isSubjectDisputed(status: SubjectStatus): boolean;
declare function isSubjectInvalid(status: SubjectStatus): boolean;
declare function isSubjectDormant(status: SubjectStatus): boolean;
declare function isSubjectRestoring(status: SubjectStatus): boolean;
declare function isDisputePending(status: DisputeStatus): boolean;
declare function isDisputeResolved(status: DisputeStatus): boolean;
declare function isChallengerWins(outcome: ResolutionOutcome): boolean;
declare function isDefenderWins(outcome: ResolutionOutcome): boolean;
declare function isNoParticipation(outcome: ResolutionOutcome): boolean;
declare function getDisputeTypeName(disputeType: DisputeType): string;
declare function getOutcomeName(outcome: ResolutionOutcome): string;
/**
 * Check if a linked subject can be disputed based on pool availability.
 * For linked match-mode subjects, validates pool has enough balance.
 * Returns true if subject can be disputed, false if pool is drained.
 */
declare function canLinkedSubjectBeDisputed(subject: Subject, pool: DefenderPool | null, minBond: BN): boolean;
/**
 * Get effective status for a subject, considering pool balance for linked subjects.
 * Returns "dormant" for linked match-mode subjects if pool is drained below minimum.
 */
declare function getEffectiveStatus(subject: Subject, pool: DefenderPool | null, minBond: BN): SubjectStatus;

interface SimulationResult {
    success: boolean;
    error?: string;
    errorCode?: number;
    logs?: string[];
    unitsConsumed?: number;
}
interface TribunalCraftClientConfig {
    connection: Connection;
    wallet?: Wallet;
    programId?: PublicKey;
    /** If true, all transactions will be simulated before sending */
    simulateFirst?: boolean;
}
interface TransactionResult {
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
declare class TribunalCraftClient {
    readonly connection: Connection;
    readonly programId: PublicKey;
    readonly pda: PDA;
    simulateFirst: boolean;
    private wallet;
    private anchorProgram;
    constructor(config: TribunalCraftClientConfig);
    private initProgram;
    /**
     * Set or update the wallet
     */
    setWallet(wallet: Wallet): void;
    /**
     * Get the current wallet public key
     */
    get walletPublicKey(): PublicKey | null;
    /**
     * Get the Anchor program instance (for advanced usage)
     */
    get program(): Program<Tribunalcraft> | null;
    /**
     * Get wallet and program, throwing if not connected
     */
    private getWalletAndProgram;
    /**
     * Parse program error from simulation logs
     */
    private parseErrorFromLogs;
    /**
     * Simulate a transaction and return detailed results
     */
    simulateTransaction(tx: Transaction | VersionedTransaction): Promise<SimulationResult>;
    /**
     * Build and simulate a method call without sending
     * Returns simulation result with parsed errors
     */
    simulateMethod(methodName: string, args: unknown[], accounts?: Record<string, PublicKey | null>): Promise<SimulationResult>;
    /**
     * Helper to run RPC with optional simulation first
     * Wraps Anchor's rpc() call with simulation check
     */
    private rpcWithSimulation;
    /**
     * Initialize protocol config (one-time setup by deployer)
     */
    initializeConfig(): Promise<TransactionResult>;
    /**
     * Update treasury address (admin only)
     */
    updateTreasury(newTreasury: PublicKey): Promise<TransactionResult>;
    /**
     * Create a defender pool with initial stake
     */
    createPool(initialStake: BN): Promise<TransactionResult>;
    /**
     * Add stake to an existing pool
     */
    stakePool(amount: BN): Promise<TransactionResult>;
    /**
     * Withdraw available stake from pool
     */
    withdrawPool(amount: BN): Promise<TransactionResult>;
    /**
     * Create a standalone subject with initial stake
     */
    createSubject(params: {
        subjectId: PublicKey;
        detailsCid: string;
        maxStake: BN;
        matchMode: boolean;
        freeCase?: boolean;
        votingPeriod: BN;
        stake: BN;
    }): Promise<TransactionResult>;
    /**
     * Create a subject linked to a defender pool
     */
    createLinkedSubject(params: {
        defenderPool: PublicKey;
        subjectId: PublicKey;
        detailsCid: string;
        maxStake: BN;
        matchMode: boolean;
        freeCase?: boolean;
        votingPeriod: BN;
    }): Promise<TransactionResult>;
    /**
     * Create a free subject (no stake required)
     */
    createFreeSubject(params: {
        subjectId: PublicKey;
        detailsCid: string;
        votingPeriod: BN;
    }): Promise<TransactionResult>;
    /**
     * Add stake to a standalone subject
     * If subject has active dispute in proportional mode, pass dispute, protocolConfig, and treasury
     * Fees are deducted in proportional mode during active dispute
     */
    addToStake(subject: PublicKey, stake: BN, proportionalDispute?: {
        dispute: PublicKey;
        treasury: PublicKey;
    }): Promise<TransactionResult>;
    /**
     * Register as a juror with initial stake
     */
    registerJuror(stakeAmount: BN): Promise<TransactionResult>;
    /**
     * Add more stake to juror account
     */
    addJurorStake(amount: BN): Promise<TransactionResult>;
    /**
     * Withdraw available stake from juror account
     */
    withdrawJurorStake(amount: BN): Promise<TransactionResult>;
    /**
     * Unregister juror and withdraw all available stake
     */
    unregisterJuror(): Promise<TransactionResult>;
    /**
     * Submit a new dispute against a subject
     */
    submitDispute(params: {
        subject: PublicKey;
        disputeCount: number;
        defenderPool?: PublicKey;
        disputeType: DisputeType;
        detailsCid: string;
        bond: BN;
    }): Promise<TransactionResult>;
    /**
     * Submit a free dispute (no bond required)
     */
    submitFreeDispute(params: {
        subject: PublicKey;
        disputeCount: number;
        disputeType: DisputeType;
        detailsCid: string;
    }): Promise<TransactionResult>;
    /**
     * Add to existing dispute (additional challengers)
     */
    addToDispute(params: {
        subject: PublicKey;
        dispute: PublicKey;
        defenderPool?: PublicKey;
        detailsCid: string;
        bond: BN;
    }): Promise<TransactionResult>;
    /**
     * Submit a restoration request against an invalidated subject
     * Platform fee (1%) is collected upfront to treasury
     */
    submitRestore(params: {
        subject: PublicKey;
        disputeCount: number;
        disputeType: DisputeType;
        detailsCid: string;
        stakeAmount: BN;
    }): Promise<TransactionResult>;
    /**
     * Vote on a dispute
     */
    voteOnDispute(params: {
        dispute: PublicKey;
        choice: VoteChoice;
        stakeAllocation: BN;
        rationaleCid?: string;
    }): Promise<TransactionResult>;
    /**
     * Vote on a restoration request
     */
    voteOnRestore(params: {
        dispute: PublicKey;
        choice: RestoreVoteChoice;
        stakeAllocation: BN;
        rationaleCid?: string;
    }): Promise<TransactionResult>;
    /**
     * Add more stake to an existing vote
     */
    addToVote(params: {
        dispute: PublicKey;
        subject: PublicKey;
        additionalStake: BN;
    }): Promise<TransactionResult>;
    /**
     * Resolve a dispute after voting period ends (permissionless)
     */
    resolveDispute(params: {
        dispute: PublicKey;
        subject: PublicKey;
    }): Promise<TransactionResult>;
    /**
     * Unlock juror stake after 7-day buffer
     */
    unlockJurorStake(params: {
        dispute: PublicKey;
        voteRecord: PublicKey;
    }): Promise<TransactionResult>;
    /**
     * Claim juror reward (processes reputation + distributes reward)
     */
    claimJurorReward(params: {
        dispute: PublicKey;
        subject: PublicKey;
        voteRecord: PublicKey;
    }): Promise<TransactionResult>;
    /**
     * Claim challenger reward (if dispute upheld)
     */
    claimChallengerReward(params: {
        dispute: PublicKey;
        subject: PublicKey;
        challengerRecord: PublicKey;
    }): Promise<TransactionResult>;
    /**
     * Claim defender reward (if dispute dismissed)
     */
    claimDefenderReward(params: {
        dispute: PublicKey;
        subject: PublicKey;
        defenderRecord: PublicKey;
    }): Promise<TransactionResult>;
    /**
     * Claim restorer refund for failed restoration request
     */
    claimRestorerRefund(params: {
        dispute: PublicKey;
    }): Promise<TransactionResult>;
    /**
     * Fetch protocol config
     */
    fetchProtocolConfig(): Promise<ProtocolConfig | null>;
    /**
     * Fetch defender pool by address
     */
    fetchDefenderPool(address: PublicKey): Promise<DefenderPool | null>;
    /**
     * Fetch defender pool by owner
     */
    fetchDefenderPoolByOwner(owner: PublicKey): Promise<DefenderPool | null>;
    /**
     * Fetch subject by address
     */
    fetchSubject(address: PublicKey): Promise<Subject | null>;
    /**
     * Fetch subject by subject ID
     */
    fetchSubjectById(subjectId: PublicKey): Promise<Subject | null>;
    /**
     * Fetch dispute by address
     */
    fetchDispute(address: PublicKey): Promise<Dispute | null>;
    /**
     * Fetch juror account by address
     */
    fetchJurorAccount(address: PublicKey): Promise<JurorAccount | null>;
    /**
     * Fetch juror account by juror pubkey
     */
    fetchJurorByPubkey(juror: PublicKey): Promise<JurorAccount | null>;
    /**
     * Fetch vote record
     */
    fetchVoteRecord(address: PublicKey): Promise<VoteRecord | null>;
    /**
     * Fetch vote record for a dispute and juror
     */
    fetchVoteRecordByDisputeAndJuror(dispute: PublicKey, juror: PublicKey): Promise<VoteRecord | null>;
    /**
     * Fetch challenger account
     */
    fetchChallengerAccount(address: PublicKey): Promise<ChallengerAccount | null>;
    /**
     * Fetch challenger record
     */
    fetchChallengerRecord(address: PublicKey): Promise<ChallengerRecord | null>;
    /**
     * Fetch defender record
     */
    fetchDefenderRecord(address: PublicKey): Promise<DefenderRecord | null>;
    /**
     * Fetch all defender pools
     */
    fetchAllDefenderPools(): Promise<Array<{
        publicKey: PublicKey;
        account: DefenderPool;
    }>>;
    /**
     * Fetch all subjects
     */
    fetchAllSubjects(): Promise<Array<{
        publicKey: PublicKey;
        account: Subject;
    }>>;
    /**
     * Fetch all disputes
     */
    fetchAllDisputes(): Promise<Array<{
        publicKey: PublicKey;
        account: Dispute;
    }>>;
    /**
     * Fetch all juror accounts
     */
    fetchAllJurors(): Promise<Array<{
        publicKey: PublicKey;
        account: JurorAccount;
    }>>;
    /**
     * Fetch disputes by subject
     */
    fetchDisputesBySubject(subject: PublicKey): Promise<Array<{
        publicKey: PublicKey;
        account: Dispute;
    }>>;
    /**
     * Fetch votes by dispute
     */
    fetchVotesByDispute(dispute: PublicKey): Promise<Array<{
        publicKey: PublicKey;
        account: VoteRecord;
    }>>;
    /**
     * Fetch challengers by dispute
     */
    fetchChallengersByDispute(dispute: PublicKey): Promise<Array<{
        publicKey: PublicKey;
        account: ChallengerRecord;
    }>>;
}

declare const PROGRAM_ID: PublicKey;
declare const PROTOCOL_CONFIG_SEED: Buffer<ArrayBuffer>;
declare const DEFENDER_POOL_SEED: Buffer<ArrayBuffer>;
declare const SUBJECT_SEED: Buffer<ArrayBuffer>;
declare const JUROR_SEED: Buffer<ArrayBuffer>;
declare const DISPUTE_SEED: Buffer<ArrayBuffer>;
declare const CHALLENGER_SEED: Buffer<ArrayBuffer>;
declare const CHALLENGER_RECORD_SEED: Buffer<ArrayBuffer>;
declare const DEFENDER_RECORD_SEED: Buffer<ArrayBuffer>;
declare const VOTE_RECORD_SEED: Buffer<ArrayBuffer>;
declare const TOTAL_FEE_BPS = 2000;
declare const PLATFORM_SHARE_BPS = 500;
declare const JUROR_SHARE_BPS = 9500;
declare const WINNER_SHARE_BPS = 8000;
declare const MIN_JUROR_STAKE = 100000000;
declare const MIN_CHALLENGER_BOND = 100000000;
declare const MIN_DEFENDER_STAKE = 100000000;
declare const STAKE_UNLOCK_BUFFER: number;
declare const MIN_VOTING_PERIOD: number;
declare const MAX_VOTING_PERIOD: number;
declare const INITIAL_REPUTATION = 5000;
declare const REPUTATION_GAIN_RATE = 500;
declare const REPUTATION_LOSS_RATE = 1000;

var address = "4b9qTHcLrkjURroj8X9TCr8xKPNqDT7pNrCqi9brLiZX";
var metadata = {
	name: "tribunalcraft",
	version: "0.1.0",
	spec: "0.1.0",
	description: "Decentralized arbitration protocol"
};
var instructions = [
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
		args: [
		]
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
		args: [
		]
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
		args: [
		]
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
		args: [
		]
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
		args: [
		]
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
		args: [
		]
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
		args: [
		]
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
		args: [
		]
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
];
var accounts = [
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
];
var errors = [
	{
		code: 6000,
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
];
var types = [
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
						"Cumulative voting power for \"ForChallenger\" votes"
					],
					type: "u64"
				},
				{
					name: "votes_against_weight",
					docs: [
						"Cumulative voting power for \"ForDefender\" votes"
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
];
var idl = {
	address: address,
	metadata: metadata,
	instructions: instructions,
	accounts: accounts,
	errors: errors,
	types: types
};

export { CHALLENGER_RECORD_SEED, CHALLENGER_SEED, type ChallengerAccount, type ChallengerRecord, DEFENDER_POOL_SEED, DEFENDER_RECORD_SEED, DISPUTE_SEED, type DefenderPool, type DefenderRecord, type Dispute, type DisputeStatus, DisputeStatusEnum, type DisputeType, DisputeTypeEnum, idl as IDL, INITIAL_REPUTATION, JUROR_SEED, JUROR_SHARE_BPS, type JurorAccount, MAX_VOTING_PERIOD, MIN_CHALLENGER_BOND, MIN_DEFENDER_STAKE, MIN_JUROR_STAKE, MIN_VOTING_PERIOD, PDA, PLATFORM_SHARE_BPS, PROGRAM_ID, PROTOCOL_CONFIG_SEED, type ProtocolConfig, REPUTATION_GAIN_RATE, REPUTATION_LOSS_RATE, type ResolutionOutcome, ResolutionOutcomeEnum, type RestoreVoteChoice, RestoreVoteChoiceEnum, STAKE_UNLOCK_BUFFER, SUBJECT_SEED, type SimulationResult, type Subject, type SubjectStatus, SubjectStatusEnum, TOTAL_FEE_BPS, type TransactionResult, TribunalCraftClient, type TribunalCraftClientConfig, type Tribunalcraft, VOTE_RECORD_SEED, type VoteChoice, VoteChoiceEnum, type VoteRecord, WINNER_SHARE_BPS, canLinkedSubjectBeDisputed, getDisputeTypeName, getEffectiveStatus, getOutcomeName, isChallengerWins, isDefenderWins, isDisputePending, isDisputeResolved, isNoParticipation, isSubjectDisputed, isSubjectDormant, isSubjectInvalid, isSubjectRestoring, isSubjectValid, pda };
