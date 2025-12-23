-- Add safe_bond column to disputes table for historical reward calculation
-- This allows displaying defender's safe bond return even after escrow is closed

ALTER TABLE disputes ADD COLUMN IF NOT EXISTS safe_bond BIGINT DEFAULT 0;

-- Add winner_pool and juror_pool for complete reward breakdown
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS winner_pool BIGINT DEFAULT 0;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS juror_pool BIGINT DEFAULT 0;

COMMENT ON COLUMN disputes.safe_bond IS 'Safe portion of defender bond that is always returned regardless of outcome';
COMMENT ON COLUMN disputes.winner_pool IS 'Total reward pool for winning side after fees';
COMMENT ON COLUMN disputes.juror_pool IS 'Total reward pool for jurors';
