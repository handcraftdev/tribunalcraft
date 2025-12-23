-- Program Events Table
-- Stores all emitted events from the TribunalCraft program
-- This is the source of truth for historical data

CREATE TABLE IF NOT EXISTS program_events (
  -- Primary key: signature:eventIndex
  id TEXT PRIMARY KEY,

  -- Transaction info
  signature TEXT NOT NULL,
  slot BIGINT NOT NULL,
  block_time BIGINT,

  -- Event info
  event_type TEXT NOT NULL,

  -- Common indexed fields for filtering
  subject_id TEXT,
  round INTEGER,
  actor TEXT,  -- The main actor (creator, juror, challenger, defender, etc.)
  amount BIGINT,

  -- Full event data as JSONB for flexible querying
  data JSONB DEFAULT '{}',

  -- Metadata
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_program_events_signature ON program_events(signature);
CREATE INDEX IF NOT EXISTS idx_program_events_slot ON program_events(slot DESC);
CREATE INDEX IF NOT EXISTS idx_program_events_event_type ON program_events(event_type);
CREATE INDEX IF NOT EXISTS idx_program_events_subject_id ON program_events(subject_id);
CREATE INDEX IF NOT EXISTS idx_program_events_subject_round ON program_events(subject_id, round);
CREATE INDEX IF NOT EXISTS idx_program_events_actor ON program_events(actor);
CREATE INDEX IF NOT EXISTS idx_program_events_block_time ON program_events(block_time DESC);

-- Composite index for timeline queries
CREATE INDEX IF NOT EXISTS idx_program_events_subject_timeline
  ON program_events(subject_id, block_time DESC)
  WHERE subject_id IS NOT NULL;

-- Index for actor activity queries
CREATE INDEX IF NOT EXISTS idx_program_events_actor_timeline
  ON program_events(actor, block_time DESC)
  WHERE actor IS NOT NULL;

-- RLS Policies
ALTER TABLE program_events ENABLE ROW LEVEL SECURITY;

-- Anyone can read events (public data)
CREATE POLICY "Events are publicly readable"
  ON program_events FOR SELECT
  USING (true);

-- Only service role can insert/update (webhook uses service role)
CREATE POLICY "Service role can insert events"
  ON program_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update events"
  ON program_events FOR UPDATE
  USING (true);

-- =============================================================================
-- Useful Views for Common Queries
-- =============================================================================

-- Dispute history view (reconstructed from events)
CREATE OR REPLACE VIEW dispute_history AS
SELECT
  e.subject_id,
  e.round,
  e.data->>'outcome' as outcome,
  (e.data->>'totalStake')::bigint as total_stake,
  (e.data->>'bondAtRisk')::bigint as bond_at_risk,
  (e.data->>'winnerPool')::bigint as winner_pool,
  (e.data->>'jurorPool')::bigint as juror_pool,
  (e.data->>'resolvedAt')::bigint as resolved_at,
  e.block_time,
  e.signature
FROM program_events e
WHERE e.event_type = 'DisputeResolvedEvent'
ORDER BY e.subject_id, e.round;

-- Vote history view
CREATE OR REPLACE VIEW vote_history AS
SELECT
  e.subject_id,
  e.round,
  e.actor as juror,
  e.data->>'choice' as choice,
  (e.data->>'votingPower')::bigint as voting_power,
  e.data->>'rationaleCid' as rationale_cid,
  e.block_time,
  e.signature
FROM program_events e
WHERE e.event_type IN ('VoteEvent', 'RestoreVoteEvent')
ORDER BY e.subject_id, e.round, e.block_time;

-- Claim history view
CREATE OR REPLACE VIEW claim_history AS
SELECT
  e.subject_id,
  e.round,
  e.actor as claimer,
  e.data->>'role' as role,
  e.amount,
  e.block_time,
  e.signature
FROM program_events e
WHERE e.event_type = 'RewardClaimedEvent'
ORDER BY e.subject_id, e.round, e.block_time;

-- User activity view
CREATE OR REPLACE VIEW user_activity AS
SELECT
  e.actor as user_pubkey,
  e.event_type,
  e.subject_id,
  e.round,
  e.amount,
  e.data,
  e.block_time,
  e.signature
FROM program_events e
WHERE e.actor IS NOT NULL
ORDER BY e.actor, e.block_time DESC;

COMMENT ON TABLE program_events IS 'Stores all emitted events from TribunalCraft program. Source of truth for historical data.';
COMMENT ON VIEW dispute_history IS 'All resolved disputes with outcome data, reconstructed from DisputeResolvedEvent';
COMMENT ON VIEW vote_history IS 'All votes cast, reconstructed from VoteEvent and RestoreVoteEvent';
COMMENT ON VIEW claim_history IS 'All reward claims, reconstructed from RewardClaimedEvent';
COMMENT ON VIEW user_activity IS 'All user activity across the protocol';
