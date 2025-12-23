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

const { createClient } = require("@supabase/supabase-js");
const { Connection, PublicKey } = require("@solana/web3.js");

async function checkRecords() {
  const subjectPda = process.argv[2] || "AmJ8ZNdp2jFa9o8B1VeQss1YaQty13WFiemMgmusD21p";
  const disputePda = process.argv[3] || "2gRP38rBXCekf9NWrDuBtfBCC6kh2i1i8aeZQAmMfVTr";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const rpcUrl = process.env.SOLANA_RPC_URL + "?api-key=" + process.env.SOLANA_RPC_API_KEY;
  const connection = new Connection(rpcUrl);

  console.log("Subject PDA:", subjectPda);
  console.log("Dispute PDA:", disputePda);
  console.log("RPC:", process.env.SOLANA_RPC_URL);

  // Check subject account
  const subjectAcc = await connection.getAccountInfo(new PublicKey(subjectPda));
  console.log("\nSubject on-chain:", subjectAcc ? `EXISTS (${subjectAcc.data.length} bytes)` : "CLOSED");

  // Check dispute account
  const disputeAcc = await connection.getAccountInfo(new PublicKey(disputePda));
  console.log("Dispute on-chain:", disputeAcc ? `EXISTS (${disputeAcc.data.length} bytes)` : "CLOSED");

  // Check escrow PDA (derived from subject_id which we need to find)
  // We'll need to decode subject to get subject_id

  // Get records from Supabase by dispute PDA
  const { data: dispute } = await supabase.from("disputes").select("*").eq("id", disputePda).single();

  if (dispute) {
    console.log("\n=== Dispute from DB ===");
    console.log("Subject ID:", dispute.subject_id);
    console.log("Round:", dispute.round);
    console.log("Status:", dispute.status);
    console.log("Outcome:", dispute.outcome);
    console.log("Safe Bond:", dispute.safe_bond);
    console.log("Winner Pool:", dispute.winner_pool);
    console.log("Juror Pool:", dispute.juror_pool);

    const subjectId = dispute.subject_id;

    // Get participant records
    const { data: jurors } = await supabase.from("juror_records").select("*").eq("subject_id", subjectId).eq("round", dispute.round);
    const { data: challengers } = await supabase.from("challenger_records").select("*").eq("subject_id", subjectId).eq("round", dispute.round);
    const { data: defenders } = await supabase.from("defender_records").select("*").eq("subject_id", subjectId).eq("round", dispute.round);

    console.log("\n=== Juror Records (Round " + dispute.round + ") ===");
    for (const r of (jurors || [])) {
      const acc = await connection.getAccountInfo(new PublicKey(r.id));
      console.log(r.juror.slice(0, 8) + "...", "| DB Claimed:", r.reward_claimed, "| DB Unlocked:", r.stake_unlocked);
      console.log("  On-chain:", acc ? `EXISTS (${acc.data.length} bytes)` : "CLOSED");

      if (acc) {
        // Decode juror record from on-chain data
        // JurorRecord layout (after 8-byte discriminator):
        // subject_id: 32, juror: 32, round: 4, choice: 1, restore_choice: 1,
        // is_restore_vote: 1, voting_power: 8, stake_allocation: 8,
        // reward_claimed: 1, stake_unlocked: 1, bump: 1, voted_at: 8, rationale_cid: 4+64
        const data = acc.data;
        const offset = 8; // skip discriminator
        const subjectId = new PublicKey(data.slice(offset, offset + 32));
        const juror = new PublicKey(data.slice(offset + 32, offset + 64));
        const round = data.readUInt32LE(offset + 64);
        const choice = data[offset + 68];
        const restoreChoice = data[offset + 69];
        const isRestoreVote = data[offset + 70] === 1;
        const votingPower = data.readBigUInt64LE(offset + 71);
        const stakeAllocation = data.readBigUInt64LE(offset + 79);
        const rewardClaimed = data[offset + 87] === 1;
        const stakeUnlocked = data[offset + 88] === 1;
        const bump = data[offset + 89];
        const votedAt = data.readBigInt64LE(offset + 90);

        console.log("  === ON-CHAIN DATA ===");
        console.log("  Subject:", subjectId.toBase58());
        console.log("  Juror:", juror.toBase58());
        console.log("  Round:", round);
        console.log("  Choice:", choice === 0 ? "ForChallenger" : "ForDefender");
        console.log("  Voting Power:", votingPower.toString(), "lamports");
        console.log("  Stake Allocation:", stakeAllocation.toString(), "lamports (" + (Number(stakeAllocation) / 1e9).toFixed(4) + " SOL)");
        console.log("  Reward Claimed:", rewardClaimed);
        console.log("  Stake Unlocked:", stakeUnlocked);
        console.log("  Voted At:", new Date(Number(votedAt) * 1000).toISOString());
      }
    }

    console.log("\n=== Challenger Records (Round " + dispute.round + ") ===");
    for (const r of (challengers || [])) {
      const acc = await connection.getAccountInfo(new PublicKey(r.id));
      console.log(r.challenger.slice(0, 8) + "...", "| Claimed:", r.reward_claimed, "| On-chain:", acc ? "EXISTS" : "CLOSED");
    }

    console.log("\n=== Defender Records (Round " + dispute.round + ") ===");
    for (const r of (defenders || [])) {
      const acc = await connection.getAccountInfo(new PublicKey(r.id));
      console.log(r.defender.slice(0, 8) + "...", "| Claimed:", r.reward_claimed, "| On-chain:", acc ? "EXISTS" : "CLOSED");
    }

    // Check escrow
    const escrowSeed = Buffer.from("escrow");
    const subjectIdBuffer = new PublicKey(subjectId).toBuffer();
    const [escrowPda] = PublicKey.findProgramAddressSync(
      [escrowSeed, subjectIdBuffer],
      new PublicKey("BPZLtbfibhYZc5pQgf75FqeqAEn4h7pqnYBLzHSJhHN4")
    );
    const escrowAcc = await connection.getAccountInfo(escrowPda);
    console.log("\n=== Escrow ===");
    console.log("PDA:", escrowPda.toBase58());
    console.log("On-chain:", escrowAcc ? `EXISTS (${escrowAcc.lamports / 1e9} SOL)` : "CLOSED");

  } else {
    console.log("\nNo dispute found in DB for PDA:", disputePda);

    // Try checking subject by PDA
    const { data: subject } = await supabase.from("subjects").select("*").eq("id", subjectPda).single();
    if (subject) {
      console.log("\n=== Subject from DB ===");
      console.log("Subject ID:", subject.subject_id);
      console.log("Status:", subject.status);
      console.log("Round:", subject.round);
    } else {
      console.log("No subject found in DB for PDA:", subjectPda);
    }
  }
}

checkRecords().catch(console.error);
