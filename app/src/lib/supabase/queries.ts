import { supabase, isSupabaseConfigured } from "./client";
import type {
  Subject,
  Dispute,
  JurorRecord,
  ChallengerRecord,
  DefenderRecord,
  JurorPool,
  ChallengerPool,
  DefenderPool,
  Escrow,
} from "./types";

// Re-export types for consumers
export type { Dispute, JurorRecord, ChallengerRecord, DefenderRecord };

// =============================================================================
// Subject Queries
// =============================================================================

export async function getSubjects(filters?: {
  status?: string;
  creator?: string;
  limit?: number;
  offset?: number;
}): Promise<Subject[]> {
  if (!isSupabaseConfigured() || !supabase) return [];

  let query = supabase.from("subjects").select("*");

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.creator) {
    query = query.eq("creator", filters.creator);
  }

  query = query.order("created_at", { ascending: false });

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching subjects:", error);
    return [];
  }
  return data || [];
}

export async function getSubjectById(subjectId: string): Promise<Subject | null> {
  if (!isSupabaseConfigured() || !supabase) return null;

  const { data, error } = await supabase
    .from("subjects")
    .select("*")
    .eq("subject_id", subjectId)
    .single();

  if (error) {
    if (error.code !== "PGRST116") { // Not found is ok
      console.error("Error fetching subject:", error);
    }
    return null;
  }
  return data;
}

export async function getSubjectByPda(pda: string): Promise<Subject | null> {
  if (!isSupabaseConfigured() || !supabase) return null;

  const { data, error } = await supabase
    .from("subjects")
    .select("*")
    .eq("id", pda)
    .single();

  if (error) {
    if (error.code !== "PGRST116") {
      console.error("Error fetching subject:", error);
    }
    return null;
  }
  return data;
}

// =============================================================================
// Dispute Queries
// =============================================================================

export async function getDisputes(filters?: {
  status?: string;
  outcome?: string;
  limit?: number;
}): Promise<Dispute[]> {
  if (!isSupabaseConfigured() || !supabase) return [];

  let query = supabase.from("disputes").select("*");

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.outcome) {
    query = query.eq("outcome", filters.outcome);
  }

  query = query.order("created_at", { ascending: false });

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching disputes:", error);
    return [];
  }
  return data || [];
}

export async function getDisputeBySubject(
  subjectId: string,
  round?: number
): Promise<Dispute | null> {
  if (!isSupabaseConfigured() || !supabase) return null;

  let query = supabase
    .from("disputes")
    .select("*")
    .eq("subject_id", subjectId);

  if (round !== undefined) {
    query = query.eq("round", round);
  } else {
    query = query.order("round", { ascending: false }).limit(1);
  }

  const { data, error } = await query.single();

  if (error) {
    if (error.code !== "PGRST116") {
      console.error("Error fetching dispute:", error);
    }
    return null;
  }
  return data;
}

// =============================================================================
// Record Queries
// =============================================================================

export async function getJurorRecords(filters?: {
  subjectId?: string;
  juror?: string;
  round?: number;
}): Promise<JurorRecord[]> {
  if (!isSupabaseConfigured() || !supabase) return [];

  let query = supabase.from("juror_records").select("*");

  if (filters?.subjectId) {
    query = query.eq("subject_id", filters.subjectId);
  }
  if (filters?.juror) {
    query = query.eq("juror", filters.juror);
  }
  if (filters?.round !== undefined) {
    query = query.eq("round", filters.round);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching juror records:", error);
    return [];
  }
  return data || [];
}

export async function getChallengerRecords(filters?: {
  subjectId?: string;
  challenger?: string;
  round?: number;
}): Promise<ChallengerRecord[]> {
  if (!isSupabaseConfigured() || !supabase) return [];

  let query = supabase.from("challenger_records").select("*");

  if (filters?.subjectId) {
    query = query.eq("subject_id", filters.subjectId);
  }
  if (filters?.challenger) {
    query = query.eq("challenger", filters.challenger);
  }
  if (filters?.round !== undefined) {
    query = query.eq("round", filters.round);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching challenger records:", error);
    return [];
  }
  return data || [];
}

export async function getDefenderRecords(filters?: {
  subjectId?: string;
  defender?: string;
  round?: number;
}): Promise<DefenderRecord[]> {
  if (!isSupabaseConfigured() || !supabase) return [];

  let query = supabase.from("defender_records").select("*");

  if (filters?.subjectId) {
    query = query.eq("subject_id", filters.subjectId);
  }
  if (filters?.defender) {
    query = query.eq("defender", filters.defender);
  }
  if (filters?.round !== undefined) {
    query = query.eq("round", filters.round);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching defender records:", error);
    return [];
  }
  return data || [];
}

// =============================================================================
// Pool Queries
// =============================================================================

export async function getJurorPools(): Promise<JurorPool[]> {
  if (!isSupabaseConfigured() || !supabase) return [];

  const { data, error } = await supabase
    .from("juror_pools")
    .select("*")
    .order("balance", { ascending: false });

  if (error) {
    console.error("Error fetching juror pools:", error);
    return [];
  }
  return data || [];
}

export async function getJurorPoolByOwner(owner: string): Promise<JurorPool | null> {
  if (!isSupabaseConfigured() || !supabase) return null;

  const { data, error } = await supabase
    .from("juror_pools")
    .select("*")
    .eq("owner", owner)
    .single();

  if (error) {
    if (error.code !== "PGRST116") {
      console.error("Error fetching juror pool:", error);
    }
    return null;
  }
  return data;
}

export async function getChallengerPools(): Promise<ChallengerPool[]> {
  if (!isSupabaseConfigured() || !supabase) return [];

  const { data, error } = await supabase
    .from("challenger_pools")
    .select("*")
    .order("balance", { ascending: false });

  if (error) {
    console.error("Error fetching challenger pools:", error);
    return [];
  }
  return data || [];
}

export async function getChallengerPoolByOwner(owner: string): Promise<ChallengerPool | null> {
  if (!isSupabaseConfigured() || !supabase) return null;

  const { data, error } = await supabase
    .from("challenger_pools")
    .select("*")
    .eq("owner", owner)
    .single();

  if (error) {
    if (error.code !== "PGRST116") {
      console.error("Error fetching challenger pool:", error);
    }
    return null;
  }
  return data;
}

export async function getDefenderPools(): Promise<DefenderPool[]> {
  if (!isSupabaseConfigured() || !supabase) return [];

  const { data, error } = await supabase
    .from("defender_pools")
    .select("*")
    .order("balance", { ascending: false });

  if (error) {
    console.error("Error fetching defender pools:", error);
    return [];
  }
  return data || [];
}

export async function getDefenderPoolByOwner(owner: string): Promise<DefenderPool | null> {
  if (!isSupabaseConfigured() || !supabase) return null;

  const { data, error } = await supabase
    .from("defender_pools")
    .select("*")
    .eq("owner", owner)
    .single();

  if (error) {
    if (error.code !== "PGRST116") {
      console.error("Error fetching defender pool:", error);
    }
    return null;
  }
  return data;
}

// =============================================================================
// Escrow Queries
// =============================================================================

export async function getEscrowBySubject(subjectId: string): Promise<Escrow | null> {
  if (!isSupabaseConfigured() || !supabase) return null;

  const { data, error } = await supabase
    .from("escrows")
    .select("*")
    .eq("subject_id", subjectId)
    .single();

  if (error) {
    if (error.code !== "PGRST116") {
      console.error("Error fetching escrow:", error);
    }
    return null;
  }
  return data;
}

// =============================================================================
// Aggregation Queries
// =============================================================================

export interface ProtocolStats {
  totalSubjects: number;
  validSubjects: number;
  disputedSubjects: number;
  invalidSubjects: number;
  totalDisputes: number;
  pendingDisputes: number;
  resolvedDisputes: number;
  totalVotes: number;
  totalJurors: number;
  totalChallengers: number;
  totalDefenders: number;
  totalJurorStake: number;
  totalChallengerStake: number;
  totalDefenderBalance: number;
}

export async function getProtocolStats(): Promise<ProtocolStats> {
  if (!isSupabaseConfigured() || !supabase) {
    return {
      totalSubjects: 0,
      validSubjects: 0,
      disputedSubjects: 0,
      invalidSubjects: 0,
      totalDisputes: 0,
      pendingDisputes: 0,
      resolvedDisputes: 0,
      totalVotes: 0,
      totalJurors: 0,
      totalChallengers: 0,
      totalDefenders: 0,
      totalJurorStake: 0,
      totalChallengerStake: 0,
      totalDefenderBalance: 0,
    };
  }

  const [
    subjectCounts,
    disputeCounts,
    voteCounts,
    jurorStats,
    challengerStats,
    defenderStats,
  ] = await Promise.all([
    // Subject counts by status
    supabase.from("subjects").select("status") as unknown as { data: { status: string }[] | null },
    // Dispute counts by status
    supabase.from("disputes").select("status") as unknown as { data: { status: string }[] | null },
    // Total votes
    supabase.from("juror_records").select("id", { count: "exact", head: true }) as unknown as { count: number | null },
    // Juror stats
    supabase.from("juror_pools").select("balance") as unknown as { data: { balance: number }[] | null },
    // Challenger stats
    supabase.from("challenger_pools").select("balance") as unknown as { data: { balance: number }[] | null },
    // Defender stats
    supabase.from("defender_pools").select("balance") as unknown as { data: { balance: number }[] | null },
  ]);

  const subjects = subjectCounts.data || [];
  const disputes = disputeCounts.data || [];
  const jurors = jurorStats.data || [];
  const challengers = challengerStats.data || [];
  const defenders = defenderStats.data || [];

  return {
    totalSubjects: subjects.length,
    validSubjects: subjects.filter((s) => s.status === "valid").length,
    disputedSubjects: subjects.filter((s) => s.status === "disputed").length,
    invalidSubjects: subjects.filter((s) => s.status === "invalid").length,
    totalDisputes: disputes.length,
    pendingDisputes: disputes.filter((d) => d.status === "pending").length,
    resolvedDisputes: disputes.filter((d) => d.status === "resolved").length,
    totalVotes: voteCounts.count || 0,
    totalJurors: jurors.length,
    totalChallengers: challengers.length,
    totalDefenders: defenders.length,
    totalJurorStake: jurors.reduce((sum, j) => sum + (j.balance || 0), 0),
    totalChallengerStake: challengers.reduce((sum, c) => sum + (c.balance || 0), 0),
    totalDefenderBalance: defenders.reduce((sum, d) => sum + (d.balance || 0), 0),
  };
}

export interface UserStats {
  jurorPool: JurorPool | null;
  challengerPool: ChallengerPool | null;
  defenderPool: DefenderPool | null;
  votesCast: number;
  challengesCreated: number;
  subjectsDefended: number;
  subjectsCreated: number;
}

// =============================================================================
// Dashboard-specific Queries
// =============================================================================

export interface DashboardStats {
  // Subject stats
  totalSubjects: number;
  validSubjects: number;
  disputedSubjects: number;
  invalidSubjects: number;
  restoringSubjects: number;
  totalDefenderBond: number;

  // Dispute stats
  totalDisputes: number;
  activeDisputes: number;
  resolvedDisputes: number;
  challengerWins: number;
  defenderWins: number;
  noParticipation: number;
  activePools: number; // totalStake + bondAtRisk for pending disputes
  totalVotes: number;

  // Juror stats
  totalJurors: number;
  activeJurors: number; // jurors with balance > 0
  totalJurorStake: number;
  avgReputation: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  if (!isSupabaseConfigured() || !supabase) {
    return {
      totalSubjects: 0,
      validSubjects: 0,
      disputedSubjects: 0,
      invalidSubjects: 0,
      restoringSubjects: 0,
      totalDefenderBond: 0,
      totalDisputes: 0,
      activeDisputes: 0,
      resolvedDisputes: 0,
      challengerWins: 0,
      defenderWins: 0,
      noParticipation: 0,
      activePools: 0,
      totalVotes: 0,
      totalJurors: 0,
      activeJurors: 0,
      totalJurorStake: 0,
      avgReputation: 50,
    };
  }

  const [subjectsData, disputesData, jurorsData] = await Promise.all([
    supabase.from("subjects").select("status, available_bond") as unknown as {
      data: { status: string; available_bond: number }[] | null;
    },
    supabase.from("disputes").select("status, outcome, total_stake, bond_at_risk, vote_count") as unknown as {
      data: { status: string; outcome: string | null; total_stake: number; bond_at_risk: number; vote_count: number }[] | null;
    },
    supabase.from("juror_pools").select("balance, reputation") as unknown as {
      data: { balance: number; reputation: number }[] | null;
    },
  ]);

  const subjects = subjectsData.data || [];
  const disputes = disputesData.data || [];
  const jurors = jurorsData.data || [];

  // Subject stats
  const validSubjects = subjects.filter(s => s.status === "valid").length;
  const disputedSubjects = subjects.filter(s => s.status === "disputed").length;
  const invalidSubjects = subjects.filter(s => s.status === "invalid").length;
  const restoringSubjects = subjects.filter(s => s.status === "restoring").length;
  const totalDefenderBond = subjects.reduce((sum, s) => sum + (s.available_bond || 0), 0);

  // Dispute stats
  const activeDisputes = disputes.filter(d => d.status === "pending");
  const resolvedDisputes = disputes.filter(d => d.status === "resolved");
  const challengerWins = resolvedDisputes.filter(d => d.outcome === "challengerWins").length;
  const defenderWins = resolvedDisputes.filter(d => d.outcome === "defenderWins").length;
  const noParticipation = resolvedDisputes.filter(d => d.outcome === "noParticipation").length;
  const activePools = activeDisputes.reduce((sum, d) => sum + (d.total_stake || 0) + (d.bond_at_risk || 0), 0);
  const totalVotes = disputes.reduce((sum, d) => sum + (d.vote_count || 0), 0);

  // Juror stats
  const activeJurors = jurors.filter(j => (j.balance || 0) > 0);
  const totalJurorStake = jurors.reduce((sum, j) => sum + (j.balance || 0), 0);
  const avgReputation = jurors.length > 0
    ? jurors.reduce((sum, j) => sum + (j.reputation || 50_000_000), 0) / jurors.length / 1_000_000
    : 50;

  return {
    totalSubjects: subjects.length,
    validSubjects,
    disputedSubjects,
    invalidSubjects,
    restoringSubjects,
    totalDefenderBond,
    totalDisputes: disputes.length,
    activeDisputes: activeDisputes.length,
    resolvedDisputes: resolvedDisputes.length,
    challengerWins,
    defenderWins,
    noParticipation,
    activePools,
    totalVotes,
    totalJurors: jurors.length,
    activeJurors: activeJurors.length,
    totalJurorStake,
    avgReputation,
  };
}

// =============================================================================
// Juror Leaderboard Query
// =============================================================================

export interface JurorVoteStats {
  juror: string;
  votesCast: number;
  correctVotes: number;
  accuracy: number;
}

export async function getJurorVoteStats(): Promise<JurorVoteStats[]> {
  if (!isSupabaseConfigured() || !supabase) return [];

  // Get all juror records with their votes
  const { data: jurorRecords, error: jurorError } = await supabase
    .from("juror_records")
    .select("juror, subject_id, round, choice, is_restore_vote, restore_choice");

  if (jurorError || !jurorRecords) {
    console.error("Error fetching juror records:", jurorError);
    return [];
  }

  // Get all resolved disputes to check outcomes
  const { data: disputes, error: disputeError } = await supabase
    .from("disputes")
    .select("subject_id, round, outcome, is_restore")
    .eq("status", "resolved");

  if (disputeError || !disputes) {
    console.error("Error fetching disputes:", disputeError);
    return [];
  }

  // Create a map of dispute outcomes: "subjectId-round" -> outcome
  type DisputeRow = { subject_id: string; round: number; outcome: string | null; is_restore: boolean };
  type JurorRecordRow = { juror: string; subject_id: string; round: number; choice: string | null; is_restore_vote: boolean; restore_choice: string | null };
  const outcomeMap = new Map<string, { outcome: string; isRestore: boolean }>();
  for (const d of disputes as DisputeRow[]) {
    const key = `${d.subject_id}-${d.round}`;
    outcomeMap.set(key, { outcome: d.outcome || "", isRestore: d.is_restore || false });
  }

  // Aggregate votes per juror
  const jurorStats = new Map<string, { votesCast: number; correctVotes: number }>();

  for (const record of jurorRecords as JurorRecordRow[]) {
    const key = `${record.subject_id}-${record.round}`;
    const disputeInfo = outcomeMap.get(key);

    // Only count if dispute is resolved
    if (!disputeInfo) continue;

    const stats = jurorStats.get(record.juror) || { votesCast: 0, correctVotes: 0 };
    stats.votesCast++;

    // Determine if vote was correct
    const choice = record.is_restore_vote ? record.restore_choice : record.choice;
    const isCorrect =
      (choice === "forChallenger" && disputeInfo.outcome === "challengerWins") ||
      (choice === "forDefender" && disputeInfo.outcome === "defenderWins");

    if (isCorrect) {
      stats.correctVotes++;
    }

    jurorStats.set(record.juror, stats);
  }

  // Convert to array with accuracy
  const result: JurorVoteStats[] = [];
  for (const [juror, stats] of jurorStats) {
    result.push({
      juror,
      votesCast: stats.votesCast,
      correctVotes: stats.correctVotes,
      accuracy: stats.votesCast > 0 ? (stats.correctVotes / stats.votesCast) * 100 : 0,
    });
  }

  // Sort by accuracy (with minimum votes threshold), then by vote count
  return result.sort((a, b) => {
    // Prioritize jurors with more votes when accuracy is similar
    if (Math.abs(a.accuracy - b.accuracy) < 1) {
      return b.votesCast - a.votesCast;
    }
    return b.accuracy - a.accuracy;
  });
}

export async function getUserStats(wallet: string): Promise<UserStats> {
  if (!isSupabaseConfigured() || !supabase) {
    return {
      jurorPool: null,
      challengerPool: null,
      defenderPool: null,
      votesCast: 0,
      challengesCreated: 0,
      subjectsDefended: 0,
      subjectsCreated: 0,
    };
  }

  const [
    jurorPool,
    challengerPool,
    defenderPool,
    votes,
    challenges,
    defenses,
    createdSubjects,
  ] = await Promise.all([
    getJurorPoolByOwner(wallet),
    getChallengerPoolByOwner(wallet),
    getDefenderPoolByOwner(wallet),
    supabase.from("juror_records").select("id", { count: "exact", head: true }).eq("juror", wallet),
    supabase.from("challenger_records").select("id", { count: "exact", head: true }).eq("challenger", wallet),
    supabase.from("defender_records").select("id", { count: "exact", head: true }).eq("defender", wallet),
    supabase.from("subjects").select("id", { count: "exact", head: true }).eq("creator", wallet),
  ]);

  return {
    jurorPool,
    challengerPool,
    defenderPool,
    votesCast: votes.count || 0,
    challengesCreated: challenges.count || 0,
    subjectsDefended: defenses.count || 0,
    subjectsCreated: createdSubjects.count || 0,
  };
}
