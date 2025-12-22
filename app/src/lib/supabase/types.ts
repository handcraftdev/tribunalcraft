// Database types for Supabase
// These match the PostgreSQL schema

export type Database = {
  public: {
    Tables: {
      subjects: {
        Row: {
          id: string;
          subject_id: string;
          creator: string;
          details_cid: string | null;
          round: number;
          available_bond: number;
          defender_count: number;
          status: string;
          match_mode: boolean;
          voting_period: number | null;
          dispute: string | null;
          created_at: number | null;
          updated_at: number | null;
          last_dispute_total: number | null;
          title: string | null;
          description: string | null;
          category: string | null;
          slot: number | null;
          synced_at: string;
        };
        Insert: {
          id: string;
          subject_id: string;
          creator: string;
          details_cid?: string | null;
          round?: number;
          available_bond?: number;
          defender_count?: number;
          status: string;
          match_mode?: boolean;
          voting_period?: number | null;
          dispute?: string | null;
          created_at?: number | null;
          updated_at?: number | null;
          last_dispute_total?: number | null;
          title?: string | null;
          description?: string | null;
          category?: string | null;
          slot?: number | null;
          synced_at?: string;
        };
        Update: {
          id?: string;
          subject_id?: string;
          creator?: string;
          details_cid?: string | null;
          round?: number;
          available_bond?: number;
          defender_count?: number;
          status?: string;
          match_mode?: boolean;
          voting_period?: number | null;
          dispute?: string | null;
          created_at?: number | null;
          updated_at?: number | null;
          last_dispute_total?: number | null;
          title?: string | null;
          description?: string | null;
          category?: string | null;
          slot?: number | null;
          synced_at?: string;
        };
      };
      disputes: {
        Row: {
          id: string;
          subject_id: string;
          round: number;
          status: string;
          dispute_type: string | null;
          total_stake: number;
          challenger_count: number;
          bond_at_risk: number;
          defender_count: number;
          votes_for_challenger: number;
          votes_for_defender: number;
          vote_count: number;
          voting_starts_at: number | null;
          voting_ends_at: number | null;
          outcome: string | null;
          resolved_at: number | null;
          is_restore: boolean;
          restore_stake: number;
          restorer: string | null;
          details_cid: string | null;
          created_at: number | null;
          title: string | null;
          reason: string | null;
          slot: number | null;
          synced_at: string;
        };
        Insert: {
          id: string;
          subject_id: string;
          round: number;
          status: string;
          dispute_type?: string | null;
          total_stake?: number;
          challenger_count?: number;
          bond_at_risk?: number;
          defender_count?: number;
          votes_for_challenger?: number;
          votes_for_defender?: number;
          vote_count?: number;
          voting_starts_at?: number | null;
          voting_ends_at?: number | null;
          outcome?: string | null;
          resolved_at?: number | null;
          is_restore?: boolean;
          restore_stake?: number;
          restorer?: string | null;
          details_cid?: string | null;
          created_at?: number | null;
          title?: string | null;
          reason?: string | null;
          slot?: number | null;
          synced_at?: string;
        };
        Update: {
          id?: string;
          subject_id?: string;
          round?: number;
          status?: string;
          dispute_type?: string | null;
          total_stake?: number;
          challenger_count?: number;
          bond_at_risk?: number;
          defender_count?: number;
          votes_for_challenger?: number;
          votes_for_defender?: number;
          vote_count?: number;
          voting_starts_at?: number | null;
          voting_ends_at?: number | null;
          outcome?: string | null;
          resolved_at?: number | null;
          is_restore?: boolean;
          restore_stake?: number;
          restorer?: string | null;
          details_cid?: string | null;
          created_at?: number | null;
          title?: string | null;
          reason?: string | null;
          slot?: number | null;
          synced_at?: string;
        };
      };
      juror_records: {
        Row: {
          id: string;
          subject_id: string;
          juror: string;
          round: number;
          choice: string | null;
          restore_choice: string | null;
          is_restore_vote: boolean;
          voting_power: number;
          stake_allocation: number;
          reward_claimed: boolean;
          stake_unlocked: boolean;
          voted_at: number | null;
          rationale_cid: string | null;
          slot: number | null;
          synced_at: string;
        };
        Insert: {
          id: string;
          subject_id: string;
          juror: string;
          round: number;
          choice?: string | null;
          restore_choice?: string | null;
          is_restore_vote?: boolean;
          voting_power?: number;
          stake_allocation?: number;
          reward_claimed?: boolean;
          stake_unlocked?: boolean;
          voted_at?: number | null;
          rationale_cid?: string | null;
          slot?: number | null;
          synced_at?: string;
        };
        Update: {
          id?: string;
          subject_id?: string;
          juror?: string;
          round?: number;
          choice?: string | null;
          restore_choice?: string | null;
          is_restore_vote?: boolean;
          voting_power?: number;
          stake_allocation?: number;
          reward_claimed?: boolean;
          stake_unlocked?: boolean;
          voted_at?: number | null;
          rationale_cid?: string | null;
          slot?: number | null;
          synced_at?: string;
        };
      };
      challenger_records: {
        Row: {
          id: string;
          subject_id: string;
          challenger: string;
          round: number;
          stake: number;
          details_cid: string | null;
          reward_claimed: boolean;
          challenged_at: number | null;
          slot: number | null;
          synced_at: string;
        };
        Insert: {
          id: string;
          subject_id: string;
          challenger: string;
          round: number;
          stake?: number;
          details_cid?: string | null;
          reward_claimed?: boolean;
          challenged_at?: number | null;
          slot?: number | null;
          synced_at?: string;
        };
        Update: {
          id?: string;
          subject_id?: string;
          challenger?: string;
          round?: number;
          stake?: number;
          details_cid?: string | null;
          reward_claimed?: boolean;
          challenged_at?: number | null;
          slot?: number | null;
          synced_at?: string;
        };
      };
      defender_records: {
        Row: {
          id: string;
          subject_id: string;
          defender: string;
          round: number;
          bond: number;
          source: string | null;
          reward_claimed: boolean;
          bonded_at: number | null;
          slot: number | null;
          synced_at: string;
        };
        Insert: {
          id: string;
          subject_id: string;
          defender: string;
          round: number;
          bond?: number;
          source?: string | null;
          reward_claimed?: boolean;
          bonded_at?: number | null;
          slot?: number | null;
          synced_at?: string;
        };
        Update: {
          id?: string;
          subject_id?: string;
          defender?: string;
          round?: number;
          bond?: number;
          source?: string | null;
          reward_claimed?: boolean;
          bonded_at?: number | null;
          slot?: number | null;
          synced_at?: string;
        };
      };
      juror_pools: {
        Row: {
          id: string;
          owner: string;
          balance: number;
          reputation: number;
          created_at: number | null;
          slot: number | null;
          synced_at: string;
        };
        Insert: {
          id: string;
          owner: string;
          balance?: number;
          reputation?: number;
          created_at?: number | null;
          slot?: number | null;
          synced_at?: string;
        };
        Update: {
          id?: string;
          owner?: string;
          balance?: number;
          reputation?: number;
          created_at?: number | null;
          slot?: number | null;
          synced_at?: string;
        };
      };
      challenger_pools: {
        Row: {
          id: string;
          owner: string;
          balance: number;
          reputation: number;
          created_at: number | null;
          slot: number | null;
          synced_at: string;
        };
        Insert: {
          id: string;
          owner: string;
          balance?: number;
          reputation?: number;
          created_at?: number | null;
          slot?: number | null;
          synced_at?: string;
        };
        Update: {
          id?: string;
          owner?: string;
          balance?: number;
          reputation?: number;
          created_at?: number | null;
          slot?: number | null;
          synced_at?: string;
        };
      };
      defender_pools: {
        Row: {
          id: string;
          owner: string;
          balance: number;
          max_bond: number | null;
          created_at: number | null;
          updated_at: number | null;
          slot: number | null;
          synced_at: string;
        };
        Insert: {
          id: string;
          owner: string;
          balance?: number;
          max_bond?: number | null;
          created_at?: number | null;
          updated_at?: number | null;
          slot?: number | null;
          synced_at?: string;
        };
        Update: {
          id?: string;
          owner?: string;
          balance?: number;
          max_bond?: number | null;
          created_at?: number | null;
          updated_at?: number | null;
          slot?: number | null;
          synced_at?: string;
        };
      };
      escrows: {
        Row: {
          id: string;
          subject_id: string;
          total_collected: number;
          round_results: unknown;
          slot: number | null;
          synced_at: string;
        };
        Insert: {
          id: string;
          subject_id: string;
          total_collected?: number;
          round_results?: unknown;
          slot?: number | null;
          synced_at?: string;
        };
        Update: {
          id?: string;
          subject_id?: string;
          total_collected?: number;
          round_results?: unknown;
          slot?: number | null;
          synced_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};

// Helper types for easier access
export type Subject = Database["public"]["Tables"]["subjects"]["Row"];
export type SubjectInsert = Database["public"]["Tables"]["subjects"]["Insert"];
export type Dispute = Database["public"]["Tables"]["disputes"]["Row"];
export type DisputeInsert = Database["public"]["Tables"]["disputes"]["Insert"];
export type JurorRecord = Database["public"]["Tables"]["juror_records"]["Row"];
export type JurorRecordInsert = Database["public"]["Tables"]["juror_records"]["Insert"];
export type ChallengerRecord = Database["public"]["Tables"]["challenger_records"]["Row"];
export type ChallengerRecordInsert = Database["public"]["Tables"]["challenger_records"]["Insert"];
export type DefenderRecord = Database["public"]["Tables"]["defender_records"]["Row"];
export type DefenderRecordInsert = Database["public"]["Tables"]["defender_records"]["Insert"];
export type JurorPool = Database["public"]["Tables"]["juror_pools"]["Row"];
export type JurorPoolInsert = Database["public"]["Tables"]["juror_pools"]["Insert"];
export type ChallengerPool = Database["public"]["Tables"]["challenger_pools"]["Row"];
export type ChallengerPoolInsert = Database["public"]["Tables"]["challenger_pools"]["Insert"];
export type DefenderPool = Database["public"]["Tables"]["defender_pools"]["Row"];
export type DefenderPoolInsert = Database["public"]["Tables"]["defender_pools"]["Insert"];
export type Escrow = Database["public"]["Tables"]["escrows"]["Row"];
export type EscrowInsert = Database["public"]["Tables"]["escrows"]["Insert"];
