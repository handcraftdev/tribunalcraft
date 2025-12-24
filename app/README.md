# TribunalCraft App

A decentralized dispute resolution frontend built with Next.js for the TribunalCraft protocol on Solana.

## Features

- **Subject Management**: Create, bond, and manage subjects for dispute resolution
- **Dispute Resolution**: Challenge subjects, vote as a juror, defend subjects
- **Pool System**: Register and manage juror, challenger, and defender pools
- **Restoration Flow**: Restore invalid subjects through community voting
- **Real-time Sync**: Supabase-backed indexer with Helius webhook integration

## Prerequisites

- Node.js 18+
- npm or yarn
- Solana wallet (Phantom, Solflare, etc.)
- Supabase account (free tier)
- Helius RPC account (free tier)
- Filebase account for IPFS storage (optional)

## Environment Setup

Copy `.env.example` to `.env.local` and configure:

```bash
cp .env.example .env.local
```

### Required Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Solana RPC URL (client-side) |
| `NEXT_PUBLIC_SOLANA_WSS_URL` | Solana WebSocket URL for confirmations |
| `SOLANA_RPC_URL` | Server-side RPC URL (for webhooks) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side) |
| `HELIUS_WEBHOOK_SECRET` | Secret for verifying Helius webhooks |

### Optional Variables

| Variable | Description |
|----------|-------------|
| `FILEBASE_KEY` | Filebase access key for IPFS |
| `FILEBASE_SECRET` | Filebase secret key |
| `FILEBASE_BUCKET` | Filebase bucket name |

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000)

## Database Setup

Run the migration in Supabase SQL Editor:

```bash
cat supabase/migrations/001_initial_schema.sql
```

This creates all required tables with Row Level Security (RLS) enabled.

## Helius Webhook Setup

1. Go to [Helius Dashboard](https://dashboard.helius.dev)
2. Create a new webhook with:
   - **Type**: Enhanced Transaction
   - **Program ID**: Your TribunalCraft program ID
   - **URL**: `https://your-domain.com/api/webhook/helius`
3. Copy the webhook secret to `HELIUS_WEBHOOK_SECRET`

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── rpc/          # RPC proxy with rate limiting
│   │   ├── upload/       # IPFS upload endpoints
│   │   └── webhook/      # Helius webhook handler
│   ├── analytics/        # Analytics dashboard
│   ├── overview/         # Protocol overview
│   ├── profile/          # User profile & pools
│   └── registry/         # Subject registry
├── components/            # React components
│   ├── subject/          # Subject-related components
│   └── ui/               # Shared UI components
├── hooks/                 # Custom React hooks
│   └── useTribunalcraft.ts  # Main protocol hook
├── lib/                   # Utilities
│   ├── supabase/         # Supabase client & sync
│   └── rate-limit.ts     # Rate limiting utility
└── providers/            # Context providers
```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/rpc` | POST | Proxied Solana RPC (rate limited: 100/min) |
| `/api/webhook/helius` | POST | Helius webhook handler (HMAC verified) |
| `/api/upload` | POST | Subject content upload to IPFS |
| `/api/upload/evidence` | POST | Evidence upload to IPFS |

## Security Features

- **Rate Limiting**: In-memory LRU cache with sliding window (100 req/min per IP)
- **Webhook Authentication**: HMAC-SHA256 signature verification
- **RLS Policies**: Supabase Row Level Security for data protection
- **Server-side Secrets**: API keys kept on server, proxied to client

## Build & Deploy

```bash
# Build for production
npm run build

# Run production server
npm start

# Type check
npm run typecheck

# Lint
npm run lint
```

## Code Review Status

See [CODE_REVIEW_FINDINGS.md](./CODE_REVIEW_FINDINGS.md) for detailed security and quality review.

**Production Ready**: All critical blockers resolved as of 2025-12-22.

## Related Packages

- [`@tribunalcraft/sdk`](../packages/sdk) - TypeScript SDK for protocol interactions
- [`tribunalcraft`](../programs/tribunalcraft) - On-chain Anchor program

## License

MIT
# Trigger deploy
