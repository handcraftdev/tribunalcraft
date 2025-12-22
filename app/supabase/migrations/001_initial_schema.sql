-- TribunalCraft Indexer Schema
-- Run this in Supabase SQL Editor to create the tables

-- Subjects
CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,                    -- PDA pubkey
  subject_id TEXT NOT NULL UNIQUE,        -- on-chain subject_id
  creator TEXT NOT NULL,
  details_cid TEXT,
  round INTEGER DEFAULT 0,
  available_bond BIGINT DEFAULT 0,
  defender_count INTEGER DEFAULT 0,
  status TEXT NOT NULL,                   -- dormant, valid, disputed, invalid, restoring
  match_mode BOOLEAN DEFAULT false,
  voting_period BIGINT,
  dispute TEXT,                           -- dispute PDA pubkey
  created_at BIGINT,
  updated_at BIGINT,
  last_dispute_total BIGINT,
  -- Content (from IPFS, cached)
  title TEXT,
  description TEXT,
  category TEXT,
  -- Sync metadata
  slot BIGINT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disputes
CREATE TABLE IF NOT EXISTS disputes (
  id TEXT PRIMARY KEY,                    -- PDA pubkey
  subject_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  status TEXT NOT NULL,                   -- none, pending, resolved
  dispute_type TEXT,                      -- accuracy, bias, outdated, etc.
  total_stake BIGINT DEFAULT 0,
  challenger_count INTEGER DEFAULT 0,
  bond_at_risk BIGINT DEFAULT 0,
  defender_count INTEGER DEFAULT 0,
  votes_for_challenger BIGINT DEFAULT 0,
  votes_for_defender BIGINT DEFAULT 0,
  vote_count INTEGER DEFAULT 0,
  voting_starts_at BIGINT,
  voting_ends_at BIGINT,
  outcome TEXT,                           -- none, challengerWins, defenderWins, noParticipation
  resolved_at BIGINT,
  is_restore BOOLEAN DEFAULT false,
  restore_stake BIGINT DEFAULT 0,
  restorer TEXT,
  details_cid TEXT,
  created_at BIGINT,
  -- Content (from IPFS, cached)
  title TEXT,
  reason TEXT,
  -- Sync metadata
  slot BIGINT,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject_id, round)
);

-- Juror Records (votes)
CREATE TABLE IF NOT EXISTS juror_records (
  id TEXT PRIMARY KEY,                    -- PDA pubkey
  subject_id TEXT NOT NULL,
  juror TEXT NOT NULL,
  round INTEGER NOT NULL,
  choice TEXT,                            -- forChallenger, forDefender
  restore_choice TEXT,
  is_restore_vote BOOLEAN DEFAULT false,
  voting_power BIGINT DEFAULT 0,
  stake_allocation BIGINT DEFAULT 0,
  reward_claimed BOOLEAN DEFAULT false,
  stake_unlocked BOOLEAN DEFAULT false,
  voted_at BIGINT,
  rationale_cid TEXT,
  slot BIGINT,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject_id, juror, round)
);

-- Challenger Records
CREATE TABLE IF NOT EXISTS challenger_records (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  challenger TEXT NOT NULL,
  round INTEGER NOT NULL,
  stake BIGINT DEFAULT 0,
  details_cid TEXT,
  reward_claimed BOOLEAN DEFAULT false,
  challenged_at BIGINT,
  slot BIGINT,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject_id, challenger, round)
);

-- Defender Records
CREATE TABLE IF NOT EXISTS defender_records (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  defender TEXT NOT NULL,
  round INTEGER NOT NULL,
  bond BIGINT DEFAULT 0,
  source TEXT,                            -- direct, pool
  reward_claimed BOOLEAN DEFAULT false,
  bonded_at BIGINT,
  slot BIGINT,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject_id, defender, round)
);

-- Pool accounts
CREATE TABLE IF NOT EXISTS juror_pools (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL UNIQUE,
  balance BIGINT DEFAULT 0,
  reputation BIGINT DEFAULT 50000000,
  created_at BIGINT,
  slot BIGINT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS challenger_pools (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL UNIQUE,
  balance BIGINT DEFAULT 0,
  reputation BIGINT DEFAULT 50000000,
  created_at BIGINT,
  slot BIGINT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS defender_pools (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL UNIQUE,
  balance BIGINT DEFAULT 0,
  max_bond BIGINT,
  created_at BIGINT,
  updated_at BIGINT,
  slot BIGINT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Escrows (for reward tracking)
CREATE TABLE IF NOT EXISTS escrows (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL UNIQUE,
  total_collected BIGINT DEFAULT 0,
  round_results JSONB DEFAULT '[]',
  slot BIGINT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_subjects_status ON subjects(status);
CREATE INDEX IF NOT EXISTS idx_subjects_creator ON subjects(creator);
CREATE INDEX IF NOT EXISTS idx_disputes_subject_id ON disputes(subject_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_outcome ON disputes(outcome);
CREATE INDEX IF NOT EXISTS idx_juror_records_subject ON juror_records(subject_id);
CREATE INDEX IF NOT EXISTS idx_juror_records_juror ON juror_records(juror);
CREATE INDEX IF NOT EXISTS idx_juror_records_round ON juror_records(subject_id, round);
CREATE INDEX IF NOT EXISTS idx_challenger_records_subject ON challenger_records(subject_id);
CREATE INDEX IF NOT EXISTS idx_challenger_records_challenger ON challenger_records(challenger);
CREATE INDEX IF NOT EXISTS idx_defender_records_subject ON defender_records(subject_id);
CREATE INDEX IF NOT EXISTS idx_defender_records_defender ON defender_records(defender);
CREATE INDEX IF NOT EXISTS idx_juror_pools_owner ON juror_pools(owner);
CREATE INDEX IF NOT EXISTS idx_challenger_pools_owner ON challenger_pools(owner);
CREATE INDEX IF NOT EXISTS idx_defender_pools_owner ON defender_pools(owner);

-- Enable Row Level Security (RLS)
-- For now, allow all reads (public data) and restrict writes to service role
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE juror_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenger_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE defender_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE juror_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenger_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE defender_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrows ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read" ON subjects FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON disputes FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON juror_records FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON challenger_records FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON defender_records FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON juror_pools FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON challenger_pools FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON defender_pools FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON escrows FOR SELECT USING (true);

-- Allow service role to insert/update (for sync and webhooks)
CREATE POLICY "Allow service role write" ON subjects FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role write" ON disputes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role write" ON juror_records FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role write" ON challenger_records FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role write" ON defender_records FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role write" ON juror_pools FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role write" ON challenger_pools FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role write" ON defender_pools FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role write" ON escrows FOR ALL USING (auth.role() = 'service_role');
