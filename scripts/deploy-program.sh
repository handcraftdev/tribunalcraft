#!/bin/bash
set -e

# TribunalCraft Program Deployment Script
# Usage: ./scripts/deploy-program.sh [devnet|mainnet]

NETWORK=${1:-devnet}

# Validate network
if [[ "$NETWORK" != "devnet" && "$NETWORK" != "mainnet" ]]; then
    echo "Error: Invalid network. Use 'devnet' or 'mainnet'"
    exit 1
fi

# Set RPC URL based on network
if [[ "$NETWORK" == "mainnet" ]]; then
    RPC_URL="${MAINNET_RPC_URL:-https://api.mainnet-beta.solana.com}"
    echo "WARNING: Deploying to MAINNET. This will cost real SOL."
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled."
        exit 1
    fi
else
    RPC_URL="${DEVNET_RPC_URL:-https://api.devnet.solana.com}"
fi

echo "=== TribunalCraft Program Deployment ==="
echo "Network: $NETWORK"
echo "RPC URL: $RPC_URL"
echo ""

# Check wallet balance
echo "Checking wallet balance..."
BALANCE=$(solana balance --url "$RPC_URL" 2>/dev/null || echo "0")
echo "Wallet balance: $BALANCE"

# Build the program
echo ""
echo "Building program..."
anchor build

# Get program size
PROGRAM_SIZE=$(ls -la target/deploy/tribunalcraft.so | awk '{print $5}')
echo "Program size: $PROGRAM_SIZE bytes"

# Deploy
echo ""
echo "Deploying to $NETWORK..."
anchor deploy --provider.cluster "$NETWORK" --provider.wallet ~/.config/solana/id.json

# Verify deployment
echo ""
echo "Verifying deployment..."
PROGRAM_ID="4b9qTHcLrkjURroj8X9TCr8xKPNqDT7pNrCqi9brLiZX"
solana program show "$PROGRAM_ID" --url "$RPC_URL"

echo ""
echo "=== Deployment Complete ==="
echo "Program ID: $PROGRAM_ID"
echo "Network: $NETWORK"
echo ""
echo "Next steps:"
echo "  1. Run init-protocol.ts to initialize protocol config"
echo "  2. Verify the IDL matches: anchor idl upgrade $PROGRAM_ID -f target/idl/tribunalcraft.json --provider.cluster $NETWORK"
