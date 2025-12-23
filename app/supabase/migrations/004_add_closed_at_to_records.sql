-- Migration: Add closed_at column to record tables
-- Purpose: Track when records are closed to preserve historical data

-- Add closed_at to juror_records
ALTER TABLE juror_records ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- Add closed_at to challenger_records
ALTER TABLE challenger_records ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- Add closed_at to defender_records
ALTER TABLE defender_records ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- Add indexes for closed records queries (e.g., finding all closed records)
CREATE INDEX IF NOT EXISTS idx_juror_records_closed ON juror_records(closed_at) WHERE closed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_challenger_records_closed ON challenger_records(closed_at) WHERE closed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_defender_records_closed ON defender_records(closed_at) WHERE closed_at IS NOT NULL;

-- Comment on columns
COMMENT ON COLUMN juror_records.closed_at IS 'Timestamp when this record was closed (account deleted on-chain)';
COMMENT ON COLUMN challenger_records.closed_at IS 'Timestamp when this record was closed (account deleted on-chain)';
COMMENT ON COLUMN defender_records.closed_at IS 'Timestamp when this record was closed (account deleted on-chain)';
