#!/bin/bash
set -e

# TribunalCraft Program Deployment Script
# Usage: ./scripts/deploy-program.sh [devnet|mainnet] [--trezor|--ledger|--keypair <path>]
#
# Examples:
#   ./scripts/deploy-program.sh devnet                    # Use default keypair
#   ./scripts/deploy-program.sh mainnet --trezor          # Use Trezor hardware wallet
#   ./scripts/deploy-program.sh mainnet --ledger          # Use Ledger hardware wallet
#   ./scripts/deploy-program.sh devnet --keypair ~/my.json # Use custom keypair

NETWORK=${1:-devnet}
WALLET_TYPE="file"
WALLET_PATH="$HOME/.config/solana/id.json"

# Parse wallet arguments
shift || true
while [[ $# -gt 0 ]]; do
    case $1 in
        --trezor)
            WALLET_TYPE="trezor"
            WALLET_PATH="usb://trezor"
            shift
            ;;
        --ledger)
            WALLET_TYPE="ledger"
            WALLET_PATH="usb://ledger"
            shift
            ;;
        --keypair)
            WALLET_TYPE="file"
            WALLET_PATH="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Validate network
if [[ "$NETWORK" != "devnet" && "$NETWORK" != "mainnet" ]]; then
    echo "Error: Invalid network. Use 'devnet' or 'mainnet'"
    exit 1
fi

# Set RPC URL based on network
if [[ "$NETWORK" == "mainnet" ]]; then
    RPC_URL="${MAINNET_RPC_URL:-https://api.mainnet-beta.solana.com}"
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║  WARNING: Deploying to MAINNET. This will cost real SOL.     ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo ""
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled."
        exit 1
    fi
else
    RPC_URL="${DEVNET_RPC_URL:-https://api.devnet.solana.com}"
fi

echo ""
echo "=== TribunalCraft Program Deployment ==="
echo "Network:     $NETWORK"
echo "RPC URL:     $RPC_URL"
echo "Wallet:      $WALLET_PATH ($WALLET_TYPE)"
echo ""

# Configure Solana CLI
solana config set --url "$RPC_URL" --keypair "$WALLET_PATH" > /dev/null

# Get wallet address and balance
echo "Fetching wallet info..."
if [[ "$WALLET_TYPE" == "trezor" || "$WALLET_TYPE" == "ledger" ]]; then
    echo "Please confirm on your $WALLET_TYPE device..."
fi

WALLET_ADDRESS=$(solana address 2>/dev/null || echo "unknown")
echo "Wallet address: $WALLET_ADDRESS"

BALANCE=$(solana balance 2>/dev/null || echo "0 SOL")
echo "Wallet balance: $BALANCE"

# Check minimum balance for deployment
if [[ "$NETWORK" == "mainnet" ]]; then
    echo ""
    echo "Note: Program deployment requires approximately 3-5 SOL"
fi

# Build the program
echo ""
echo "Building program..."
anchor build

# Get program size
PROGRAM_SIZE=$(ls -la target/deploy/tribunalcraft.so | awk '{print $5}')
PROGRAM_SIZE_MB=$(echo "scale=2; $PROGRAM_SIZE / 1048576" | bc)
echo "Program size: $PROGRAM_SIZE bytes ($PROGRAM_SIZE_MB MB)"

# Deploy
echo ""
echo "Deploying to $NETWORK..."
if [[ "$WALLET_TYPE" == "trezor" || "$WALLET_TYPE" == "ledger" ]]; then
    echo "Please confirm the transaction on your $WALLET_TYPE device..."
fi

anchor deploy --provider.cluster "$NETWORK" --provider.wallet "$WALLET_PATH"

# Verify deployment
echo ""
echo "Verifying deployment..."
PROGRAM_ID="4b9qTHcLrkjURroj8X9TCr8xKPNqDT7pNrCqi9brLiZX"
solana program show "$PROGRAM_ID"

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                    Deployment Complete                        ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "Program ID: $PROGRAM_ID"
echo "Network:    $NETWORK"
echo "Deployer:   $WALLET_ADDRESS"
echo ""
echo "Next steps:"
echo "  1. Initialize protocol config:"
echo "     npx ts-node scripts/init-protocol.ts $NETWORK"
echo ""
echo "  2. Verify IDL (if updated):"
echo "     anchor idl upgrade $PROGRAM_ID -f target/idl/tribunalcraft.json --provider.cluster $NETWORK"
