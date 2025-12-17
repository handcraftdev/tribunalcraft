const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { AnchorProvider, Program } = require('@coral-xyz/anchor');
const fs = require('fs');
const idl = require('../target/idl/tribunalcraft.json');

async function main() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const keypairData = JSON.parse(fs.readFileSync('/Users/onlyabrak/.config/solana/id.json'));
  const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));

  const provider = new AnchorProvider(
    connection,
    {
      publicKey: wallet.publicKey,
      signTransaction: async (tx) => { tx.sign(wallet); return tx; },
      signAllTransactions: async (txs) => { txs.forEach(tx => tx.sign(wallet)); return txs; }
    },
    {}
  );
  const program = new Program(idl, provider);

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('protocol_config')],
    program.programId
  );

  // Check if already initialized
  try {
    const config = await program.account.protocolConfig.fetch(configPda);
    console.log('Config already initialized:');
    console.log('  Treasury:', config.treasury.toBase58());
    console.log('  Authority:', config.authority.toBase58());
  } catch (e) {
    console.log('Initializing config...');
    const tx = await program.methods.initializeConfig().rpc();
    console.log('Config initialized:', tx);
    console.log('Treasury set to:', wallet.publicKey.toBase58());
  }
}

main().catch(console.error);
