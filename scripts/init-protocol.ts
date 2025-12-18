import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

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

function printUsage() {
  console.log(`
Usage: npx ts-node scripts/init-protocol.ts <network> [treasury] [--trezor|--ledger]

Arguments:
  network     devnet, mainnet, or localnet
  treasury    Optional treasury address (defaults to deployer wallet)

Options:
  --trezor    Use Trezor hardware wallet
  --ledger    Use Ledger hardware wallet

Examples:
  npx ts-node scripts/init-protocol.ts devnet
  npx ts-node scripts/init-protocol.ts mainnet --trezor
  npx ts-node scripts/init-protocol.ts mainnet <treasury-address> --trezor
`);
}

async function main() {
  // Parse arguments
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const network = args[0] || 'devnet';
  const useTrezor = args.includes('--trezor');
  const useLedger = args.includes('--ledger');
  const useHardwareWallet = useTrezor || useLedger;

  // Find treasury arg (not a flag)
  const treasuryArg = args.find(arg =>
    arg !== network &&
    !arg.startsWith('--') &&
    arg.length > 30 // Likely a pubkey
  );

  if (!NETWORKS[network]) {
    console.error(`Invalid network: ${network}`);
    console.error('Valid networks: devnet, mainnet, localnet');
    process.exit(1);
  }

  const config = NETWORKS[network];
  console.log(`\n=== TribunalCraft Protocol Initialization ===`);
  console.log(`Network: ${config.name}`);
  console.log(`RPC URL: ${config.rpcUrl}`);

  let wallet: Keypair | null = null;
  let walletPublicKey: PublicKey;

  if (useHardwareWallet) {
    // Use hardware wallet via Solana CLI
    const walletType = useTrezor ? 'trezor' : 'ledger';
    const walletPath = `usb://${walletType}`;

    console.log(`Wallet: ${walletPath} (hardware)`);
    console.log(`\nPlease confirm on your ${walletType} device...`);

    // Get public key from hardware wallet using execFileSync (safer than execSync)
    try {
      const pubkeyOutput = execFileSync('solana-keygen', ['pubkey', walletPath], { encoding: 'utf-8' });
      walletPublicKey = new PublicKey(pubkeyOutput.trim());
      console.log(`Address: ${walletPublicKey.toBase58()}`);
    } catch (error) {
      console.error(`\nError: Could not connect to ${walletType}. Make sure it's connected and unlocked.`);
      process.exit(1);
    }

    // Configure Solana CLI for hardware wallet
    execFileSync('solana', ['config', 'set', '--url', config.rpcUrl, '--keypair', walletPath], { stdio: 'inherit' });

    // For hardware wallet, use Anchor CLI directly
    const treasury = treasuryArg ? new PublicKey(treasuryArg) : walletPublicKey;
    console.log(`Treasury: ${treasury.toBase58()}`);

    console.log('\nFor hardware wallet initialization, run:');
    console.log(`  anchor run init-config --provider.cluster ${network} --provider.wallet ${walletPath}`);
    console.log('\nOr use the Solana CLI directly to call the program.');

    return;

  } else {
    // Load file-based wallet
    const keypairPath = process.env.DEPLOYER_KEYPAIR_PATH ||
      path.join(process.env.HOME || '~', '.config/solana/id.json');

    if (process.env.DEPLOYER_KEYPAIR) {
      // Base58 encoded keypair from environment (for CI/CD)
      const bs58 = await import('bs58');
      wallet = Keypair.fromSecretKey(bs58.default.decode(process.env.DEPLOYER_KEYPAIR));
    } else {
      // Load from file
      const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
      wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
    }

    walletPublicKey = wallet.publicKey;
    console.log(`Wallet: ${walletPublicKey.toBase58()}`);
  }

  // Determine treasury address
  const treasury = treasuryArg
    ? new PublicKey(treasuryArg)
    : walletPublicKey;

  console.log(`Treasury: ${treasury.toBase58()}`);

  // Setup provider (file-based wallet only)
  const connection = new Connection(config.rpcUrl, 'confirmed');
  const provider = new AnchorProvider(
    connection,
    {
      publicKey: wallet!.publicKey,
      signTransaction: async (tx) => {
        tx.sign(wallet!);
        return tx;
      },
      signAllTransactions: async (txs) => {
        txs.forEach(tx => tx.sign(wallet!));
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
    console.log(`  Authority: ${walletPublicKey.toBase58()}`);
    console.log(`  Treasury: ${walletPublicKey.toBase58()} (deployer wallet)`);

    // Update treasury if different from deployer
    if (!treasury.equals(walletPublicKey)) {
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
