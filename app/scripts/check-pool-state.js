const fs = require("fs");
const path = require("path");

// Load .env.local manually
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length > 0) {
      const value = valueParts.join("=").trim();
      process.env[key.trim()] = value;
    }
  });
}

const { Connection, PublicKey } = require("@solana/web3.js");

const PROGRAM_ID = new PublicKey("BPZLtbfibhYZc5pQgf75FqeqAEn4h7pqnYBLzHSJhHN4");

async function checkPoolState() {
  const creatorPubkey = process.argv[2];
  const subjectIdStr = process.argv[3];

  if (!creatorPubkey) {
    console.log("Usage: node check-pool-state.js <creator_pubkey> [subject_id]");
    console.log("Example: node check-pool-state.js 5xyz... BWc5...");
    return;
  }

  const rpcUrl = process.env.SOLANA_RPC_URL + "?api-key=" + process.env.SOLANA_RPC_API_KEY;
  const connection = new Connection(rpcUrl);
  const creator = new PublicKey(creatorPubkey);

  console.log("Creator:", creator.toBase58());
  console.log("RPC:", process.env.SOLANA_RPC_URL);

  // Derive DefenderPool PDA
  const [defenderPoolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("defender_pool"), creator.toBuffer()],
    PROGRAM_ID
  );

  console.log("\n=== Defender Pool ===");
  console.log("PDA:", defenderPoolPda.toBase58());

  const poolAcc = await connection.getAccountInfo(defenderPoolPda);
  if (!poolAcc) {
    console.log("Pool: DOES NOT EXIST");
    return;
  }

  console.log("Lamports:", poolAcc.lamports, `(${poolAcc.lamports / 1e9} SOL)`);
  console.log("Data length:", poolAcc.data.length, "bytes");

  // Calculate rent exempt minimum
  const rent = await connection.getMinimumBalanceForRentExemption(poolAcc.data.length);
  console.log("Rent-exempt minimum:", rent, `(${rent / 1e9} SOL)`);
  console.log("Available for transfer:", poolAcc.lamports - rent, `(${(poolAcc.lamports - rent) / 1e9} SOL)`);

  // Decode DefenderPool
  // Layout (after 8-byte discriminator):
  // owner: 32, balance: 8, max_bond: 8, created_at: 8, updated_at: 8, bump: 1
  const data = poolAcc.data;
  const offset = 8; // skip discriminator
  const owner = new PublicKey(data.slice(offset, offset + 32));
  const balance = data.readBigUInt64LE(offset + 32);
  const maxBond = data.readBigUInt64LE(offset + 40);
  const createdAt = data.readBigInt64LE(offset + 48);
  const updatedAt = data.readBigInt64LE(offset + 56);
  const bump = data[offset + 64];

  console.log("\n=== Pool Data ===");
  console.log("Owner:", owner.toBase58());
  console.log("Tracked balance:", balance.toString(), `(${Number(balance) / 1e9} SOL)`);
  console.log("Max bond:", maxBond.toString(), `(${Number(maxBond) / 1e9} SOL)`);
  console.log("Bump:", bump);
  console.log("Created at:", new Date(Number(createdAt) * 1000).toISOString());
  console.log("Updated at:", new Date(Number(updatedAt) * 1000).toISOString());

  // Check balance sync
  const actualAvailable = BigInt(poolAcc.lamports - rent);
  if (balance > actualAvailable) {
    console.log("\n⚠️  WARNING: Tracked balance > actual available lamports!");
    console.log("Tracked:", balance.toString());
    console.log("Actual available:", actualAvailable.toString());
    console.log("This could cause the 'balances before and after' error!");
  } else if (balance < actualAvailable) {
    console.log("\n⚠️  NOTE: Tracked balance < actual available lamports");
    console.log("Extra lamports:", (actualAvailable - balance).toString());
  } else {
    console.log("\n✓ Balance tracking is in sync");
  }

  // What would be transferred on dispute?
  const potentialContribution = actualAvailable < balance ? actualAvailable : balance;
  const wouldTransfer = potentialContribution < maxBond ? potentialContribution : maxBond;
  console.log("\n=== On dispute creation ===");
  console.log("Would transfer:", wouldTransfer.toString(), `(${Number(wouldTransfer) / 1e9} SOL)`);

  // If subject ID provided, check subject state
  if (subjectIdStr) {
    const subjectId = new PublicKey(subjectIdStr);
    const [subjectPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("subject"), subjectId.toBuffer()],
      PROGRAM_ID
    );
    const [disputePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("dispute"), subjectId.toBuffer()],
      PROGRAM_ID
    );
    const [escrowPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), subjectId.toBuffer()],
      PROGRAM_ID
    );

    console.log("\n=== Subject ===");
    console.log("Subject ID:", subjectId.toBase58());
    console.log("Subject PDA:", subjectPda.toBase58());

    const subjectAcc = await connection.getAccountInfo(subjectPda);
    if (subjectAcc) {
      console.log("Subject exists:", subjectAcc.data.length, "bytes");
      console.log("Subject lamports:", subjectAcc.lamports, `(${subjectAcc.lamports / 1e9} SOL)`);

      // Decode subject to get available_bond, round, defender_count
      // Layout is complex, let's just get key fields
      // After discriminator (8), subject_id (32), creator (32), then:
      // details_cid (4 + string), round (4), available_bond (8), defender_count (4), ...
      const sData = subjectAcc.data;
      // Skip to round which is at offset 8 + 32 + 32 + 4 + cid_length
      // This is tricky, let's just show we found it
    } else {
      console.log("Subject: DOES NOT EXIST");
    }

    console.log("\n=== Dispute ===");
    console.log("Dispute PDA:", disputePda.toBase58());
    const disputeAcc = await connection.getAccountInfo(disputePda);
    if (disputeAcc) {
      console.log("Dispute exists:", disputeAcc.data.length, "bytes");
      // Check dispute status - after disc(8) + subject_id(32) + round(4), status is 1 byte
      const status = disputeAcc.data[44];
      const statusNames = ["None", "Pending", "Resolved"];
      console.log("Dispute status byte:", status, `(${statusNames[status] || "Unknown"})`);
    } else {
      console.log("Dispute: DOES NOT EXIST");
    }

    console.log("\n=== Escrow ===");
    console.log("Escrow PDA:", escrowPda.toBase58());
    const escrowAcc = await connection.getAccountInfo(escrowPda);
    if (escrowAcc) {
      console.log("Escrow exists:", escrowAcc.data.length, "bytes");
      console.log("Escrow lamports:", escrowAcc.lamports, `(${escrowAcc.lamports / 1e9} SOL)`);
      // rounds vec starts at offset 8 + 32 + 8 = 48, with 4 byte length prefix
      const roundsLen = escrowAcc.data.readUInt32LE(48);
      console.log("Number of rounds:", roundsLen);

      // Calculate expected size
      const baseLen = 8 + 32 + 8 + 4 + 1; // discriminator + subject_id + balance + vec_len + bump
      const roundResultLen = 105; // from RoundResult::LEN
      const expectedSize = baseLen + (roundsLen * roundResultLen);
      console.log("Expected size:", expectedSize, "bytes");
      console.log("Actual size:", escrowAcc.data.length, "bytes");
      if (expectedSize !== escrowAcc.data.length) {
        console.log("⚠️  Size mismatch!");
      }
    } else {
      console.log("Escrow: DOES NOT EXIST");
    }
  }
}

checkPoolState().catch(console.error);
