import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as path from 'path';

// Load IDL
const idlPath = path.join(__dirname, '../target/idl/tribunalcraft.json');
const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

interface NetworkConfig {
  rpcUrl: string;
  name: string;
}

const NETWORKS: Record<string, NetworkConfig> = {
  devnet: {
    rpcUrl: process.env.DEVNET_RPC_URL || 'https://api.devnet.solana.com',
    name: 'Devnet',
  },
  mainnet: {
    rpcUrl: process.env.MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com',
    name: 'Mainnet',
  },
  localnet: {
    rpcUrl: 'http://localhost:8899',
    name: 'Localnet',
  },
};

async function main() {
  // Parse arguments
  const args = process.argv.slice(2);
  const network = args[0] || 'devnet';
  const treasuryArg = args[1]; // Optional treasury address

  if (!NETWORKS[network]) {
    console.error(`Invalid network: ${network}`);
    console.error('Valid networks: devnet, mainnet, localnet');
    process.exit(1);
  }

  const config = NETWORKS[network];
  console.log(`\n=== TribunalCraft Protocol Initialization ===`);
  console.log(`Network: ${config.name}`);
  console.log(`RPC URL: ${config.rpcUrl}`);

  // Load wallet
  const keypairPath = process.env.DEPLOYER_KEYPAIR_PATH ||
    path.join(process.env.HOME || '~', '.config/solana/id.json');

  let wallet: Keypair;
  if (process.env.DEPLOYER_KEYPAIR) {
    // Base58 encoded keypair from environment (for CI/CD)
    const bs58 = await import('bs58');
    wallet = Keypair.fromSecretKey(bs58.default.decode(process.env.DEPLOYER_KEYPAIR));
  } else {
    // Load from file
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
    wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
  }

  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);

  // Determine treasury address
  const treasury = treasuryArg
    ? new PublicKey(treasuryArg)
    : wallet.publicKey; // Default to deployer wallet

  console.log(`Treasury: ${treasury.toBase58()}`);

  // Setup provider
  const connection = new Connection(config.rpcUrl, 'confirmed');
  const provider = new AnchorProvider(
    connection,
    {
      publicKey: wallet.publicKey,
      signTransaction: async (tx) => {
        tx.sign(wallet);
        return tx;
      },
      signAllTransactions: async (txs) => {
        txs.forEach(tx => tx.sign(wallet));
        return txs;
      },
    },
    { commitment: 'confirmed' }
  );

  const program = new Program(idl, provider);

  // Derive config PDA
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('protocol_config')],
    program.programId
  );

  console.log(`\nConfig PDA: ${configPda.toBase58()}`);

  // Check if already initialized
  try {
    const existingConfig = await program.account.protocolConfig.fetch(configPda);
    console.log('\nProtocol config already initialized:');
    console.log(`  Authority: ${existingConfig.authority.toBase58()}`);
    console.log(`  Treasury: ${existingConfig.treasury.toBase58()}`);

    // Check if treasury needs update
    if (!existingConfig.treasury.equals(treasury)) {
      console.log(`\nTreasury address differs. Current: ${existingConfig.treasury.toBase58()}`);
      console.log(`To update treasury, run: updateTreasury instruction`);
    }

    return;
  } catch (e) {
    // Not initialized, continue
  }

  // Initialize
  console.log('\nInitializing protocol config...');

  try {
    const tx = await program.methods
      .initializeConfig()
      .rpc();

    console.log(`\nTransaction: ${tx}`);
    console.log('\nProtocol initialized successfully!');
    console.log(`  Authority: ${wallet.publicKey.toBase58()}`);
    console.log(`  Treasury: ${wallet.publicKey.toBase58()} (deployer wallet)`);

    // Update treasury if different from deployer
    if (!treasury.equals(wallet.publicKey)) {
      console.log(`\nUpdating treasury to: ${treasury.toBase58()}`);
      const updateTx = await program.methods
        .updateTreasury(treasury)
        .rpc();
      console.log(`Treasury update tx: ${updateTx}`);
    }

  } catch (error) {
    console.error('\nError initializing protocol:', error);
    process.exit(1);
  }
}

main().catch(console.error);
