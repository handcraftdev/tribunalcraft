import { Connection, PublicKey } from '@solana/web3.js';
import { TribunalCraftClient } from '../packages/sdk';

const RPC = "https://devnet.helius-rpc.com/?api-key=88ac54a3-8850-4686-a521-70d116779182";

async function main() {
  const connection = new Connection(RPC, 'confirmed');
  const client = new TribunalCraftClient({ connection });

  // List all subjects and try to fetch them
  console.log('Fetching all subjects...');
  const subjects = await client.fetchAllSubjects();
  console.log(`Found ${subjects.length} subjects\n`);

  for (const s of subjects) {
    console.log(`Subject: ${s.publicKey.toBase58()}`);
    console.log(`  Status: ${Object.keys(s.account.status)[0]}`);
    console.log(`  last_dispute_total: ${s.account.lastDisputeTotal?.toString() ?? 'undefined'}`);
    console.log(`  last_voting_period: ${s.account.lastVotingPeriod?.toString() ?? 'undefined'}`);
    console.log('');
  }
}

main().catch(console.error);
