"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Navigation } from "@/components/Navigation";
import { useScalecraft } from "@/hooks/useScalecraft";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import type { SubjectData, DisputeData, JurorPoolData } from "@/components/subject/types";
import { getSubjects, getDisputes, getJurorPools, getJurorVoteStats, type JurorVoteStats } from "@/lib/supabase/queries";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { Subject as SupabaseSubject, Dispute as SupabaseDispute, JurorPool as SupabaseJurorPool } from "@/lib/supabase/types";

// Types
type TimePeriod = "1d" | "7d" | "30d" | "all";
type TabView = "overview" | "economics" | "participants" | "trends" | "leaderboard";

// Use JurorPoolData from types
type JurorData = JurorPoolData;

// Icons
const ChartIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 3v18h18" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </svg>
);

const TrendUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M23 6l-9.5 9.5-5-5L1 18" />
    <path d="M17 6h6v6" />
  </svg>
);

const TrendDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M23 18l-9.5-9.5-5 5L1 6" />
    <path d="M17 18h6v-6" />
  </svg>
);

const UsersIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const CoinsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="6" />
    <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
    <path d="M7 6h1v4" />
  </svg>
);

const ActivityIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const TrophyIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

// Converters for Supabase data to app types
const convertSupabaseSubject = (s: SupabaseSubject): SubjectData | null => {
  try {
    const statusMap: Record<string, any> = {
      dormant: { dormant: {} }, valid: { valid: {} }, disputed: { disputed: {} },
      invalid: { invalid: {} }, restoring: { restoring: {} },
    };
    // Extract PDA from id (format: "pda:round" or just "pda" for old records)
    const pdaPart = s.id.includes(':') ? s.id.split(':')[0] : s.id;
    return {
      publicKey: new PublicKey(pdaPart),
      account: {
        subjectId: new PublicKey(s.subject_id), creator: new PublicKey(s.creator),
        detailsCid: s.details_cid || "", round: s.round,
        availableBond: new BN(s.available_bond), defenderCount: s.defender_count,
        status: statusMap[s.status] || { dormant: {} }, matchMode: s.match_mode,
        votingPeriod: s.voting_period ? new BN(s.voting_period) : new BN(0),
        dispute: s.dispute ? new PublicKey(s.dispute) : PublicKey.default,
        bump: 255, createdAt: s.created_at ? new BN(s.created_at) : new BN(0),
        updatedAt: s.updated_at ? new BN(s.updated_at) : new BN(0),
        lastDisputeTotal: s.last_dispute_total ? new BN(s.last_dispute_total) : new BN(0),
        lastVotingPeriod: s.voting_period ? new BN(s.voting_period) : new BN(0),
      },
    };
  } catch { return null; }
};

const convertSupabaseDispute = (d: SupabaseDispute): DisputeData | null => {
  try {
    const statusMap: Record<string, any> = { none: { none: {} }, pending: { pending: {} }, resolved: { resolved: {} } };
    const outcomeMap: Record<string, any> = { none: { none: {} }, challengerWins: { challengerWins: {} }, defenderWins: { defenderWins: {} }, noParticipation: { noParticipation: {} } };
    const disputeTypeMap: Record<string, any> = { accuracy: { accuracy: {} }, bias: { bias: {} }, outdated: { outdated: {} }, incomplete: { incomplete: {} }, spam: { spam: {} }, other: { other: {} } };
    // Extract PDA from id (format: "pda:round" or just "pda" for old records)
    const pdaPart = d.id.includes(':') ? d.id.split(':')[0] : d.id;
    return {
      publicKey: new PublicKey(pdaPart),
      account: {
        subjectId: new PublicKey(d.subject_id), round: d.round,
        status: statusMap[d.status] || { none: {} },
        disputeType: d.dispute_type ? disputeTypeMap[d.dispute_type] || { other: {} } : { other: {} },
        totalStake: new BN(d.total_stake), challengerCount: d.challenger_count,
        bondAtRisk: new BN(d.bond_at_risk), defenderCount: d.defender_count,
        votesForChallenger: new BN(d.votes_for_challenger), votesForDefender: new BN(d.votes_for_defender),
        voteCount: d.vote_count, votingStartsAt: d.voting_starts_at ? new BN(d.voting_starts_at) : new BN(0),
        votingEndsAt: d.voting_ends_at ? new BN(d.voting_ends_at) : new BN(0),
        outcome: outcomeMap[d.outcome || "none"] || { none: {} },
        resolvedAt: d.resolved_at ? new BN(d.resolved_at) : null,
        isRestore: d.is_restore, restoreStake: new BN(d.restore_stake),
        restorer: d.restorer ? new PublicKey(d.restorer) : PublicKey.default,
        detailsCid: d.details_cid || "", bump: 255,
        createdAt: d.created_at ? new BN(d.created_at) : new BN(0),
      },
    };
  } catch { return null; }
};

const convertSupabaseJuror = (j: SupabaseJurorPool): JurorData | null => {
  try {
    return {
      publicKey: new PublicKey(j.id),
      account: {
        owner: new PublicKey(j.owner),
        balance: new BN(j.balance),
        reputation: new BN(j.reputation),
        createdAt: j.created_at ? new BN(j.created_at) : new BN(0),
        bump: 255,
      },
    };
  } catch { return null; }
};

export default function AnalyticsPage() {
  const { client, fetchAllSubjects, fetchAllDisputes, fetchAllJurorPools } = useScalecraft();

  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [disputes, setDisputes] = useState<DisputeData[]>([]);
  const [jurors, setJurors] = useState<JurorData[]>([]);
  const [jurorVoteStats, setJurorVoteStats] = useState<JurorVoteStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<TimePeriod>("7d");
  const [activeTab, setActiveTab] = useState<TabView>("overview");
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let subjectsData: SubjectData[] = [];
      let disputesData: DisputeData[] = [];
      let jurorsData: JurorData[] = [];

      // Try Supabase first
      let voteStats: JurorVoteStats[] = [];
      if (isSupabaseConfigured()) {
        const [supaSubjects, supaDisputes, supaJurors, supaVoteStats] = await Promise.all([
          getSubjects(),
          getDisputes(),
          getJurorPools(),
          getJurorVoteStats(),
        ]);
        subjectsData = supaSubjects.map(convertSupabaseSubject).filter((s): s is SubjectData => s !== null);
        disputesData = supaDisputes.map(convertSupabaseDispute).filter((d): d is DisputeData => d !== null);
        jurorsData = supaJurors.map(convertSupabaseJuror).filter((j): j is JurorData => j !== null);
        voteStats = supaVoteStats;
      }

      // Fallback to RPC if Supabase not configured or returned empty
      if (subjectsData.length === 0 && client) {
        const rpcSubjects = await fetchAllSubjects();
        subjectsData = rpcSubjects || [];
      }
      if (disputesData.length === 0 && client) {
        const rpcDisputes = await fetchAllDisputes();
        disputesData = rpcDisputes || [];
      }
      if (jurorsData.length === 0 && client) {
        const rpcJurors = await fetchAllJurorPools();
        jurorsData = rpcJurors || [];
      }

      setSubjects(subjectsData);
      setDisputes(disputesData);
      setJurors(jurorsData);
      setJurorVoteStats(voteStats);
      setCurrentTime(Date.now());
    } catch (error) {
      console.error("Error loading analytics data:", error);
    }
    setLoading(false);
  }, [client, fetchAllSubjects, fetchAllDisputes, fetchAllJurorPools]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter by time period - memoized to avoid impure function calls during render
  const filterByPeriod = useCallback(<T extends { account: { createdAt?: { toNumber: () => number }; resolvedAt?: { toNumber: () => number } } }>(
    items: T[],
    useResolved = false,
    now: number
  ): T[] => {
    if (period === "all") return items;
    const cutoffs: Record<TimePeriod, number> = {
      "1d": now - 24 * 60 * 60 * 1000,
      "7d": now - 7 * 24 * 60 * 60 * 1000,
      "30d": now - 30 * 24 * 60 * 60 * 1000,
      all: 0,
    };
    const cutoff = cutoffs[period];
    return items.filter((item) => {
      const timestamp = useResolved
        ? (item.account.resolvedAt?.toNumber() ?? 0) * 1000
        : (item.account.createdAt?.toNumber() ?? 0) * 1000;
      return timestamp && timestamp >= cutoff;
    });
  }, [period]);

  // Get previous period for comparison - memoized
  const filterByPreviousPeriod = useCallback(<T extends { account: { createdAt?: { toNumber: () => number } } }>(items: T[], now: number): T[] => {
    if (period === "all") return [];
    const durations: Record<TimePeriod, number> = {
      "1d": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
      all: 0,
    };
    const duration = durations[period];
    const startCutoff = now - 2 * duration;
    const endCutoff = now - duration;

    return items.filter((item) => {
      const timestamp = (item.account.createdAt?.toNumber() ?? 0) * 1000;
      return timestamp && timestamp >= startCutoff && timestamp < endCutoff;
    });
  }, [period]);

  // Computed statistics
  const stats = useMemo(() => {
    const periodDisputes = filterByPeriod(disputes, false, currentTime);
    const prevPeriodDisputes = filterByPreviousPeriod(disputes, currentTime);
    const resolvedDisputes = periodDisputes.filter((d) => "resolved" in d.account.status);
    const activeDisputes = periodDisputes.filter((d) => "pending" in d.account.status);

    // Outcome counts
    const challengerWins = resolvedDisputes.filter((d) => "challengerWins" in d.account.outcome);
    const defenderWins = resolvedDisputes.filter((d) => "defenderWins" in d.account.outcome);
    const noQuorum = resolvedDisputes.filter((d) => "noParticipation" in d.account.outcome);

    // Money calculations (V2: totalStake = challenger, bondAtRisk = defender)
    const calculatePool = (d: DisputeData) =>
      (d.account.totalStake?.toNumber?.() ?? 0) +
      (d.account.bondAtRisk?.toNumber?.() ?? 0);

    const activePools = activeDisputes.reduce((sum, d) => sum + calculatePool(d), 0);
    const resolvedPools = resolvedDisputes.reduce((sum, d) => sum + calculatePool(d), 0);

    // Inflows (V2: totalStake = challenger stakes, bondAtRisk = defender bonds)
    const challengerStakes = periodDisputes.reduce((sum, d) => sum + (d.account.totalStake?.toNumber?.() ?? 0), 0);
    const defenderBonds = periodDisputes.reduce((sum, d) => sum + (d.account.bondAtRisk?.toNumber?.() ?? 0), 0);
    const totalInflow = challengerStakes + defenderBonds;

    // Previous period inflows
    const prevInflow = prevPeriodDisputes.reduce(
      (sum, d) =>
        sum + (d.account.totalStake?.toNumber?.() ?? 0) + (d.account.bondAtRisk?.toNumber?.() ?? 0),
      0
    );

    // Outflows (from resolved)
    const winnerPayout = resolvedPools * 0.8;
    const jurorRewards = resolvedPools * 0.19;
    const treasuryFee = resolvedPools * 0.01;
    const totalOutflow = winnerPayout + jurorRewards + treasuryFee;

    // Winner breakdown
    const challengerWinPools = challengerWins.reduce((sum, d) => sum + calculatePool(d), 0);
    const defenderWinPools = defenderWins.reduce((sum, d) => sum + calculatePool(d), 0);

    // Subject status counts
    const validCount = subjects.filter((s) => "valid" in s.account.status).length;
    const disputedCount = subjects.filter((s) => "disputed" in s.account.status).length;
    const invalidCount = subjects.filter((s) => "invalid" in s.account.status).length;
    const dormantCount = subjects.filter((s) => "dormant" in s.account.status).length;
    const restoringCount = subjects.filter((s) => "restoring" in s.account.status).length;

    // Juror stats (V2: balance instead of totalStake/availableStake)
    const activeJurors = jurors.filter((j) => (j.account.balance?.toNumber?.() ?? 0) > 0).length;
    const totalJurorStake = jurors.reduce((sum, j) => sum + (j.account.balance?.toNumber?.() ?? 0), 0);
    const totalAvailableJurorStake = totalJurorStake; // V2: all balance is available

    // Dispute type breakdown
    const disputeTypes = periodDisputes.reduce((acc, d) => {
      const type = Object.keys(d.account.disputeType)[0];
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Voting participation
    const totalVotes = periodDisputes.reduce((sum, d) => sum + d.account.voteCount, 0);
    const avgVotesPerDispute = periodDisputes.length > 0 ? totalVotes / periodDisputes.length : 0;

    // Resolution metrics
    const avgResolutionTime =
      resolvedDisputes.length > 0
        ? resolvedDisputes.reduce((sum, d) => {
            const start = d.account.votingStartsAt?.toNumber() || d.account.createdAt.toNumber();
            const end = d.account.resolvedAt?.toNumber() || start;
            return sum + (end - start);
          }, 0) / resolvedDisputes.length
        : 0;

    // TVL (Total Value Locked)
    const tvl = totalJurorStake + activePools;

    // Utilization rate (active pools / available juror stake)
    const utilizationRate = totalAvailableJurorStake > 0 ? (activePools / totalAvailableJurorStake) * 100 : 0;

    // No quorum rate
    const noQuorumRate = resolvedDisputes.length > 0 ? (noQuorum.length / resolvedDisputes.length) * 100 : 0;

    // Controversial disputes (close votes)
    // V2: Use votesForChallenger/votesForDefender
    const controversialDisputes = resolvedDisputes.filter((d) => {
      const forChallenger = d.account.votesForChallenger?.toNumber?.() ?? 0;
      const forDefender = d.account.votesForDefender?.toNumber?.() ?? 0;
      const total = forChallenger + forDefender;
      if (total === 0) return false;
      const ratio = Math.abs(forChallenger - forDefender) / total;
      return ratio < 0.2; // Within 20% margin
    });

    // Stake concentration (Gini-like metric) - V2: balance instead of totalStake
    const jurorStakes = jurors.map((j) => j.account.balance?.toNumber?.() ?? 0).sort((a, b) => a - b);
    const top10Percent = Math.ceil(jurors.length * 0.1);
    const top10Stake = jurorStakes.slice(-top10Percent).reduce((sum, s) => sum + s, 0);
    const stakeConcentration = totalJurorStake > 0 ? (top10Stake / totalJurorStake) * 100 : 0;

    // Restore disputes
    const restoreDisputes = periodDisputes.filter((d) => d.account.isRestore);

    // Growth metrics
    const inflowChange = prevInflow > 0 ? ((totalInflow - prevInflow) / prevInflow) * 100 : 0;
    const disputeChange = prevPeriodDisputes.length > 0
      ? ((periodDisputes.length - prevPeriodDisputes.length) / prevPeriodDisputes.length) * 100
      : 0;

    return {
      // Counts
      totalDisputes: periodDisputes.length,
      resolvedCount: resolvedDisputes.length,
      activeCount: activeDisputes.length,
      challengerWinCount: challengerWins.length,
      defenderWinCount: defenderWins.length,
      noQuorumCount: noQuorum.length,
      restoreCount: restoreDisputes.length,

      // Money (V2: challengerStakes + defenderBonds)
      activePools,
      resolvedPools,
      challengerStakes,
      defenderBonds,
      totalInflow,
      winnerPayout,
      jurorRewards,
      treasuryFee,
      totalOutflow,
      challengerWinPools,
      defenderWinPools,

      // Subjects
      totalSubjects: subjects.length,
      validCount,
      disputedCount,
      invalidCount,
      dormantCount,
      restoringCount,

      // Jurors
      totalJurors: jurors.length,
      activeJurors,
      totalJurorStake,
      totalAvailableJurorStake,

      // Advanced metrics
      disputeTypes,
      totalVotes,
      avgVotesPerDispute,
      avgResolutionTime,
      tvl,
      utilizationRate,
      noQuorumRate,
      controversialCount: controversialDisputes.length,
      stakeConcentration,

      // Comparison
      inflowChange,
      disputeChange,
    };
  }, [disputes, subjects, jurors, period, currentTime, filterByPeriod, filterByPreviousPeriod]);

  // Leaderboard data
  const leaderboards = useMemo(() => {
    // Create a map of vote stats by juror address for quick lookup
    const voteStatsMap = new Map(jurorVoteStats.map(s => [s.juror, s]));

    // Helper to get vote stats for a juror
    const getVoteStats = (address: string) => voteStatsMap.get(address) || { votesCast: 0, correctVotes: 0, accuracy: 0 };

    // Top jurors by reputation
    const topJurorsByRep = [...jurors]
      .sort((a, b) => (b.account.reputation?.toNumber?.() ?? 0) - (a.account.reputation?.toNumber?.() ?? 0))
      .slice(0, 10)
      .map((j, index) => {
        const stats = getVoteStats(j.publicKey.toString());
        return {
          rank: index + 1,
          address: j.publicKey.toString(),
          reputation: j.account.reputation?.toNumber?.() ?? 0,
          votesCast: stats.votesCast,
          correctVotes: stats.correctVotes,
          stake: j.account.balance?.toNumber?.() ?? 0,
        };
      });

    // Top jurors by stake
    const topJurorsByStake = [...jurors]
      .sort((a, b) => (b.account.balance?.toNumber?.() ?? 0) - (a.account.balance?.toNumber?.() ?? 0))
      .slice(0, 10)
      .map((j, index) => {
        const stats = getVoteStats(j.publicKey.toString());
        return {
          rank: index + 1,
          address: j.publicKey.toString(),
          stake: j.account.balance?.toNumber?.() ?? 0,
          reputation: j.account.reputation?.toNumber?.() ?? 0,
          votesCast: stats.votesCast,
        };
      });

    // Most active jurors - sorted by vote count, with accuracy from real data
    const mostActiveJurors = [...jurors]
      .map(j => {
        const stats = getVoteStats(j.publicKey.toString());
        return {
          jurorData: j,
          votesCast: stats.votesCast,
          correctVotes: stats.correctVotes,
          accuracy: stats.accuracy,
          reputation: j.account.reputation?.toNumber?.() ?? 0,
        };
      })
      .sort((a, b) => b.votesCast - a.votesCast || b.accuracy - a.accuracy)
      .slice(0, 10)
      .map((item, index) => ({
        rank: index + 1,
        address: item.jurorData.publicKey.toString(),
        votesCast: item.votesCast,
        correctVotes: item.correctVotes,
        accuracy: item.accuracy,
        reputation: item.reputation,
      }));

    // Top subjects by defender count
    const topSubjects = [...subjects]
      .sort((a, b) => b.account.defenderCount - a.account.defenderCount)
      .slice(0, 10)
      .map((s, index) => ({
        rank: index + 1,
        address: s.publicKey.toString(),
        defenderCount: s.account.defenderCount,
        disputeCount: s.account.round, // V2: round = number of dispute cycles
        availableStake: s.account.availableBond.toNumber(),
        status: Object.keys(s.account.status)[0],
      }));

    return {
      topJurorsByRep,
      topJurorsByStake,
      mostActiveJurors,
      topSubjects,
    };
  }, [jurors, subjects, jurorVoteStats]);

  // Time series data for trends (simplified buckets)
  const trendData = useMemo(() => {
    const periodDisputes = filterByPeriod(disputes, false, currentTime);

    // Create time buckets
    const bucketCount = 7; // Always show 7 data points
    const durations: Record<TimePeriod, number> = {
      "1d": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
      all: 0,
    };

    if (period === "all") {
      // For "all", create buckets based on total time range
      const timestamps = disputes
        .map((d) => d.account.createdAt?.toNumber() * 1000)
        .filter((t): t is number => !!t);
      if (timestamps.length === 0) return [];

      const minTime = Math.min(...timestamps);
      const maxTime = Math.max(...timestamps);
      const bucketSize = (maxTime - minTime) / bucketCount;

      return Array.from({ length: bucketCount }, (_, i) => {
        const bucketStart = minTime + i * bucketSize;
        const bucketEnd = bucketStart + bucketSize;

        const bucketDisputes = disputes.filter((d) => {
          const t = d.account.createdAt?.toNumber() * 1000;
          return t >= bucketStart && t < bucketEnd;
        });

        return {
          label: new Date(bucketStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          disputes: bucketDisputes.length,
          volume: bucketDisputes.reduce(
            (sum, d) =>
              sum +
              (d.account.totalStake?.toNumber?.() ?? 0) +
              (d.account.bondAtRisk?.toNumber?.() ?? 0),
            0
          ),
        };
      });
    }

    const duration = durations[period];
    const bucketSize = duration / bucketCount;

    return Array.from({ length: bucketCount }, (_, i) => {
      const bucketStart = currentTime - duration + i * bucketSize;
      const bucketEnd = bucketStart + bucketSize;

      const bucketDisputes = periodDisputes.filter((d) => {
        const t = (d.account.createdAt?.toNumber?.() ?? 0) * 1000;
        return t >= bucketStart && t < bucketEnd;
      });

      const label = period === "1d"
        ? new Date(bucketStart).toLocaleTimeString('en-US', { hour: 'numeric' })
        : new Date(bucketStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      return {
        label,
        disputes: bucketDisputes.length,
        volume: bucketDisputes.reduce(
          (sum, d) =>
            sum +
            (d.account.totalStake?.toNumber?.() ?? 0) +
            (d.account.bondAtRisk?.toNumber?.() ?? 0),
          0
        ),
      };
    });
  }, [disputes, period, currentTime, filterByPeriod]);

  // Format helpers
  const formatSOL = (lamports: number) => (lamports / LAMPORTS_PER_SOL).toFixed(4);
  const formatPercent = (num: number, total: number) =>
    total > 0 ? ((num / total) * 100).toFixed(1) : "0";
  const formatChange = (change: number) => {
    if (change === 0) return "0.0";
    return change > 0 ? `+${change.toFixed(1)}` : change.toFixed(1);
  };
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h`;
    return `${Math.floor(seconds / 60)}m`;
  };
  const formatReputation = (rep: number) => {
    // Reputation is on 0-100M scale where 50M = 50%
    return ((rep / 1_000_000) * 100).toFixed(1);
  };
  const truncateAddress = (addr: string) => `${addr.slice(0, 4)}...${addr.slice(-4)}`;

  const periodLabels: Record<TimePeriod, string> = {
    "1d": "24 Hours",
    "7d": "7 Days",
    "30d": "30 Days",
    all: "All Time",
  };

  const tabs: { id: TabView; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <ChartIcon /> },
    { id: "economics", label: "Economics", icon: <CoinsIcon /> },
    { id: "participants", label: "Participants", icon: <UsersIcon /> },
    { id: "trends", label: "Trends", icon: <ActivityIcon /> },
    { id: "leaderboard", label: "Leaderboard", icon: <TrophyIcon /> },
  ];

  return (
    <div className="min-h-screen bg-obsidian relative overflow-hidden">
      {/* Atmospheric Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-[600px] h-[400px] bg-gradient-radial from-gold/[0.02] to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-[500px] h-[300px] bg-gradient-radial from-emerald/[0.02] to-transparent blur-3xl" />
      </div>

      <Navigation />

      <main className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 pt-28 pb-12">
        {/* Header */}
        <div className="mb-10 animate-slide-up">
          <h1 className="font-display text-3xl md:text-4xl font-semibold text-ivory leading-tight tracking-tight mb-4">
            Protocol <span className="text-gold">Analytics</span>
          </h1>
          <p className="text-steel text-sm max-w-lg leading-relaxed">
            Comprehensive protocol metrics, economic health, and participant insights
          </p>
        </div>

        {/* Period Toggle */}
        <div className="flex items-center gap-2 mb-8 animate-slide-up">
          {(["1d", "7d", "30d", "all"] as TimePeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 text-sm font-medium uppercase tracking-wider transition-all ${
                period === p
                  ? "bg-gold text-obsidian"
                  : "bg-slate/50 text-steel hover:text-parchment hover:bg-slate"
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 animate-slide-up">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-slate border border-gold text-ivory"
                  : "bg-slate/50 border border-slate-light text-steel hover:text-parchment hover:border-steel"
              }`}
            >
              <div className={activeTab === tab.id ? "text-gold" : "text-steel"}>{tab.icon}</div>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="scale-card p-12 text-center animate-slide-up">
            <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin mx-auto mb-4" />
            <p className="text-steel">Loading analytics...</p>
          </div>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === "overview" && (
              <div className="space-y-8">
                {/* Key Metrics with Comparison */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up">
                  <div className="scale-card p-5">
                    <p className="text-xs text-steel uppercase tracking-wider mb-2">Disputes Filed</p>
                    <p className="font-display text-2xl text-ivory">{stats.totalDisputes}</p>
                    {period !== "all" && (
                      <div className={`flex items-center gap-1 mt-2 text-xs ${stats.disputeChange >= 0 ? "text-emerald" : "text-crimson"}`}>
                        {stats.disputeChange >= 0 ? <TrendUpIcon /> : <TrendDownIcon />}
                        <span>{formatChange(stats.disputeChange)}% vs prev</span>
                      </div>
                    )}
                  </div>
                  <div className="scale-card p-5">
                    <p className="text-xs text-steel uppercase tracking-wider mb-2">Total Volume</p>
                    <p className="font-display text-2xl text-gold">{formatSOL(stats.totalInflow)}</p>
                    <p className="text-xs text-steel mt-1">SOL</p>
                    {period !== "all" && (
                      <div className={`flex items-center gap-1 mt-1 text-xs ${stats.inflowChange >= 0 ? "text-emerald" : "text-crimson"}`}>
                        {stats.inflowChange >= 0 ? <TrendUpIcon /> : <TrendDownIcon />}
                        <span>{formatChange(stats.inflowChange)}%</span>
                      </div>
                    )}
                  </div>
                  <div className="scale-card p-5">
                    <p className="text-xs text-steel uppercase tracking-wider mb-2">TVL</p>
                    <p className="font-display text-2xl text-emerald">{formatSOL(stats.tvl)}</p>
                    <p className="text-xs text-steel mt-1">Total Value Locked</p>
                  </div>
                  <div className="scale-card p-5">
                    <p className="text-xs text-steel uppercase tracking-wider mb-2">Resolution Rate</p>
                    <p className="font-display text-2xl text-ivory">{formatPercent(stats.resolvedCount, stats.totalDisputes)}%</p>
                    <p className="text-xs text-steel mt-1">{stats.resolvedCount} / {stats.totalDisputes}</p>
                  </div>
                </div>

                {/* Protocol Health Indicators */}
                <div className="scale-card p-5 animate-slide-up stagger-1">
                  <h2 className="font-display text-base text-ivory mb-6">Protocol Health</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Utilization Rate */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-steel">Utilization Rate</span>
                        <span className="text-lg font-semibold text-gold">{stats.utilizationRate.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-slate-light">
                        <div
                          className="h-full bg-gradient-to-r from-gold-dark to-gold transition-all"
                          style={{ width: `${Math.min(stats.utilizationRate, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-steel mt-2">Active pools vs available juror stake</p>
                    </div>

                    {/* No Quorum Rate */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-steel">No Quorum Rate</span>
                        <span className={`text-lg font-semibold ${stats.noQuorumRate > 20 ? "text-crimson" : "text-emerald"}`}>
                          {stats.noQuorumRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 bg-slate-light">
                        <div
                          className={`h-full transition-all ${
                            stats.noQuorumRate > 20
                              ? "bg-gradient-to-r from-crimson to-crimson-light"
                              : "bg-gradient-to-r from-emerald to-emerald-light"
                          }`}
                          style={{ width: `${Math.min(stats.noQuorumRate, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-steel mt-2">Disputes resolved without participation</p>
                    </div>

                    {/* Stake Concentration */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-steel">Stake Concentration</span>
                        <span className={`text-lg font-semibold ${stats.stakeConcentration > 70 ? "text-gold" : "text-sky"}`}>
                          {stats.stakeConcentration.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 bg-slate-light">
                        <div
                          className="h-full bg-gradient-to-r from-sky to-sky-light transition-all"
                          style={{ width: `${Math.min(stats.stakeConcentration, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-steel mt-2">Top 10% jurors hold this % of stake</p>
                    </div>
                  </div>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up stagger-2">
                  <div className="bg-slate border border-slate-light p-4">
                    <p className="text-xs text-steel uppercase tracking-wider mb-1">Avg Votes/Dispute</p>
                    <p className="text-2xl font-bold text-ivory">{stats.avgVotesPerDispute.toFixed(1)}</p>
                  </div>
                  <div className="bg-slate border border-slate-light p-4">
                    <p className="text-xs text-steel uppercase tracking-wider mb-1">Avg Resolution</p>
                    <p className="text-2xl font-bold text-ivory">{formatDuration(stats.avgResolutionTime)}</p>
                  </div>
                  <div className="bg-slate border border-slate-light p-4">
                    <p className="text-xs text-steel uppercase tracking-wider mb-1">Controversial</p>
                    <p className="text-2xl font-bold text-gold">{stats.controversialCount}</p>
                    <p className="text-xs text-steel">Close votes (&lt;20% margin)</p>
                  </div>
                  <div className="bg-slate border border-slate-light p-4">
                    <p className="text-xs text-steel uppercase tracking-wider mb-1">Active Jurors</p>
                    <p className="text-2xl font-bold text-emerald">{stats.activeJurors}</p>
                    <p className="text-xs text-steel">of {stats.totalJurors} total</p>
                  </div>
                </div>

                {/* Outcome Distribution */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="scale-card p-6 animate-slide-up stagger-3">
                    <h3 className="text-sm font-semibold text-ivory uppercase tracking-wider mb-4">Outcome Distribution</h3>
                    {stats.resolvedCount > 0 ? (
                      <>
                        <div className="h-4 rounded overflow-hidden flex mb-4">
                          <div
                            className="h-full bg-crimson transition-all"
                            style={{ width: `${(stats.challengerWinCount / stats.resolvedCount) * 100}%` }}
                          />
                          <div
                            className="h-full bg-sky transition-all"
                            style={{ width: `${(stats.defenderWinCount / stats.resolvedCount) * 100}%` }}
                          />
                          <div
                            className="h-full bg-steel transition-all"
                            style={{ width: `${(stats.noQuorumCount / stats.resolvedCount) * 100}%` }}
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <span className="w-3 h-3 bg-crimson rounded-sm" />
                              <span className="text-steel">Challenger Wins</span>
                            </span>
                            <span className="text-crimson font-semibold">
                              {stats.challengerWinCount} ({formatPercent(stats.challengerWinCount, stats.resolvedCount)}%)
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <span className="w-3 h-3 bg-sky rounded-sm" />
                              <span className="text-steel">Defender Wins</span>
                            </span>
                            <span className="text-sky font-semibold">
                              {stats.defenderWinCount} ({formatPercent(stats.defenderWinCount, stats.resolvedCount)}%)
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <span className="w-3 h-3 bg-steel rounded-sm" />
                              <span className="text-steel">No Quorum</span>
                            </span>
                            <span className="text-steel font-semibold">
                              {stats.noQuorumCount} ({formatPercent(stats.noQuorumCount, stats.resolvedCount)}%)
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-steel text-sm">No resolved disputes in this period</p>
                    )}
                  </div>

                  {/* Dispute Types */}
                  <div className="scale-card p-6 animate-slide-up stagger-4">
                    <h3 className="text-sm font-semibold text-ivory uppercase tracking-wider mb-4">Dispute Types</h3>
                    {Object.keys(stats.disputeTypes).length > 0 ? (
                      <div className="space-y-3">
                        {Object.entries(stats.disputeTypes)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 6)
                          .map(([type, count]) => {
                            const percentage = (count / stats.totalDisputes) * 100;
                            return (
                              <div key={type}>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-sm text-steel capitalize">{type.replace(/([A-Z])/g, ' $1').trim()}</span>
                                  <span className="text-sm font-semibold text-parchment">{count}</span>
                                </div>
                                <div className="h-1.5 bg-slate-light rounded overflow-hidden">
                                  <div
                                    className="h-full bg-gold transition-all"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <p className="text-steel text-sm">No disputes in this period</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ECONOMICS TAB */}
            {activeTab === "economics" && (
              <div className="space-y-8">
                {/* Money Flow */}
                <div className="scale-card p-6 animate-slide-up">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full border border-gold/50 flex items-center justify-center text-gold">
                      <CoinsIcon />
                    </div>
                    <h2 className="font-display text-xl font-semibold text-ivory">Money Flow Analysis</h2>
                    <span className="text-xs text-steel ml-auto">{periodLabels[period]}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Inflows */}
                    <div className="bg-obsidian p-4 border border-slate-light">
                      <h3 className="text-sm font-semibold text-emerald uppercase tracking-wider mb-4">Inflows</h3>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-steel">Challenger Stakes</p>
                          <p className="text-lg font-semibold text-crimson">{formatSOL(stats.challengerStakes)} SOL</p>
                        </div>
                        <div>
                          <p className="text-xs text-steel">Defender Bonds</p>
                          <p className="text-lg font-semibold text-sky">{formatSOL(stats.defenderBonds)} SOL</p>
                        </div>
                        <div className="pt-3 border-t border-slate-light">
                          <p className="text-xs text-steel">Total Inflow</p>
                          <p className="text-xl font-bold text-gold">{formatSOL(stats.totalInflow)} SOL</p>
                        </div>
                      </div>
                    </div>

                    {/* Pool Status */}
                    <div className="bg-obsidian p-4 border border-gold/30 flex flex-col items-center justify-center">
                      <h3 className="text-sm font-semibold text-gold uppercase tracking-wider mb-4">Dispute Pools</h3>
                      <div className="text-center mb-4">
                        <p className="text-3xl font-bold text-gold">{formatSOL(stats.activePools + stats.resolvedPools)}</p>
                        <p className="text-sm text-steel">Total SOL</p>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <div className="text-center">
                          <p className="text-gold font-semibold">{stats.activeCount}</p>
                          <p className="text-steel">Active</p>
                        </div>
                        <div className="text-center">
                          <p className="text-emerald font-semibold">{stats.resolvedCount}</p>
                          <p className="text-steel">Resolved</p>
                        </div>
                      </div>
                    </div>

                    {/* Outflows */}
                    <div className="bg-obsidian p-4 border border-slate-light">
                      <h3 className="text-sm font-semibold text-crimson uppercase tracking-wider mb-4">Outflows</h3>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-steel">Winner Payouts (80%)</p>
                          <p className="text-lg font-semibold text-emerald">{formatSOL(stats.winnerPayout)} SOL</p>
                          <div className="flex gap-4 text-xs mt-1">
                            <span className="text-crimson">C: {formatSOL(stats.challengerWinPools * 0.8)}</span>
                            <span className="text-sky">D: {formatSOL(stats.defenderWinPools * 0.8)}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-steel">Juror Rewards (19%)</p>
                          <p className="text-lg font-semibold text-gold">{formatSOL(stats.jurorRewards)} SOL</p>
                        </div>
                        <div>
                          <p className="text-xs text-steel">Treasury (1%)</p>
                          <p className="text-lg font-semibold text-steel">{formatSOL(stats.treasuryFee)} SOL</p>
                        </div>
                        <div className="pt-3 border-t border-slate-light">
                          <p className="text-xs text-steel">Total Outflow</p>
                          <p className="text-xl font-bold text-parchment">{formatSOL(stats.totalOutflow)} SOL</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Economic Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up stagger-1">
                  <div className="scale-card p-6">
                    <h3 className="text-sm font-semibold text-ivory uppercase tracking-wider mb-4">Fee Efficiency</h3>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-steel">Total Fees Collected</p>
                        <p className="text-2xl font-bold text-gold">{formatSOL(stats.jurorRewards + stats.treasuryFee)} SOL</p>
                      </div>
                      <div className="h-4 bg-slate-light rounded overflow-hidden flex">
                        <div
                          className="h-full bg-gold"
                          style={{ width: "95%" }}
                          title="Jurors: 95%"
                        />
                        <div
                          className="h-full bg-steel"
                          style={{ width: "5%" }}
                          title="Treasury: 5%"
                        />
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-steel">Jurors: 95%</span>
                        <span className="text-steel">Treasury: 5%</span>
                      </div>
                    </div>
                  </div>

                  <div className="scale-card p-6">
                    <h3 className="text-sm font-semibold text-ivory uppercase tracking-wider mb-4">TVL Breakdown</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-steel text-sm">Juror Stakes</span>
                        <span className="text-gold font-semibold">{formatSOL(stats.totalJurorStake)} SOL</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-steel text-sm">Active Pools</span>
                        <span className="text-gold font-semibold">{formatSOL(stats.activePools)} SOL</span>
                      </div>
                      <div className="pt-3 border-t border-slate-light">
                        <div className="flex justify-between items-center">
                          <span className="text-ivory font-semibold">Total TVL</span>
                          <span className="text-emerald text-xl font-bold">{formatSOL(stats.tvl)} SOL</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="scale-card p-6">
                    <h3 className="text-sm font-semibold text-ivory uppercase tracking-wider mb-4">Average Pool Size</h3>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-steel">Per Dispute</p>
                        <p className="text-2xl font-bold text-ivory">
                          {stats.totalDisputes > 0
                            ? formatSOL((stats.activePools + stats.resolvedPools) / stats.totalDisputes)
                            : "0.0000"} SOL
                        </p>
                      </div>
                      <div className="pt-3 border-t border-slate-light">
                        <p className="text-xs text-steel">Total in Pools</p>
                        <p className="text-lg font-semibold text-gold">
                          {formatSOL(stats.activePools + stats.resolvedPools)} SOL
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PARTICIPANTS TAB */}
            {activeTab === "participants" && (
              <div className="space-y-8">
                {/* Participant Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up">
                  <div className="scale-card p-6">
                    <h3 className="text-sm font-semibold text-ivory uppercase tracking-wider mb-4">Jurors</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-steel">Total Registered</span>
                        <span className="text-xl font-bold text-ivory">{stats.totalJurors}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-steel">Active</span>
                        <span className="text-xl font-bold text-emerald">{stats.activeJurors}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-steel">Total Staked</span>
                        <span className="text-lg font-semibold text-gold">{formatSOL(stats.totalJurorStake)} SOL</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-steel">Available</span>
                        <span className="text-sm font-semibold text-sky">{formatSOL(stats.totalAvailableJurorStake)} SOL</span>
                      </div>
                    </div>
                  </div>

                  <div className="scale-card p-6">
                    <h3 className="text-sm font-semibold text-ivory uppercase tracking-wider mb-4">Defenders</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-steel">Win Rate</span>
                        <span className="text-xl font-bold text-sky">
                          {formatPercent(stats.defenderWinCount, stats.resolvedCount)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-steel">Bonds Held</span>
                        <span className="text-lg font-semibold text-sky">
                          {formatSOL(stats.defenderBonds)} SOL
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-steel">Payouts Received</span>
                        <span className="text-lg font-semibold text-emerald">
                          {formatSOL(stats.defenderWinPools * 0.8)} SOL
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="scale-card p-6">
                    <h3 className="text-sm font-semibold text-ivory uppercase tracking-wider mb-4">Challengers</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-steel">Win Rate</span>
                        <span className="text-xl font-bold text-crimson">
                          {formatPercent(stats.challengerWinCount, stats.resolvedCount)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-steel">Stakes Posted</span>
                        <span className="text-lg font-semibold text-crimson">{formatSOL(stats.challengerStakes)} SOL</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-steel">Payouts Received</span>
                        <span className="text-lg font-semibold text-emerald">
                          {formatSOL(stats.challengerWinPools * 0.8)} SOL
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subject Status */}
                <div className="scale-card p-6 animate-slide-up stagger-1">
                  <h3 className="text-sm font-semibold text-ivory uppercase tracking-wider mb-4">Subject Registry Status</h3>
                  {stats.totalSubjects > 0 ? (
                    <>
                      <div className="h-4 rounded overflow-hidden flex mb-4">
                        <div
                          className="h-full bg-emerald transition-all"
                          style={{ width: `${(stats.validCount / stats.totalSubjects) * 100}%` }}
                        />
                        <div
                          className="h-full bg-gold transition-all"
                          style={{ width: `${(stats.disputedCount / stats.totalSubjects) * 100}%` }}
                        />
                        <div
                          className="h-full bg-crimson transition-all"
                          style={{ width: `${(stats.invalidCount / stats.totalSubjects) * 100}%` }}
                        />
                        <div
                          className="h-full bg-purple-500 transition-all"
                          style={{ width: `${((stats.dormantCount + stats.restoringCount) / stats.totalSubjects) * 100}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-2">
                            <span className="w-3 h-3 bg-emerald rounded-sm" />
                            <span className="text-steel">Valid</span>
                          </span>
                          <span className="text-emerald font-semibold text-lg">{stats.validCount}</span>
                          <span className="text-xs text-steel">{formatPercent(stats.validCount, stats.totalSubjects)}%</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-2">
                            <span className="w-3 h-3 bg-gold rounded-sm" />
                            <span className="text-steel">Disputed</span>
                          </span>
                          <span className="text-gold font-semibold text-lg">{stats.disputedCount}</span>
                          <span className="text-xs text-steel">{formatPercent(stats.disputedCount, stats.totalSubjects)}%</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-2">
                            <span className="w-3 h-3 bg-crimson rounded-sm" />
                            <span className="text-steel">Invalid</span>
                          </span>
                          <span className="text-crimson font-semibold text-lg">{stats.invalidCount}</span>
                          <span className="text-xs text-steel">{formatPercent(stats.invalidCount, stats.totalSubjects)}%</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-2">
                            <span className="w-3 h-3 bg-purple-500 rounded-sm" />
                            <span className="text-steel">Dormant</span>
                          </span>
                          <span className="text-purple-400 font-semibold text-lg">{stats.dormantCount}</span>
                          <span className="text-xs text-steel">{formatPercent(stats.dormantCount, stats.totalSubjects)}%</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-2">
                            <span className="w-3 h-3 bg-purple-500 rounded-sm" />
                            <span className="text-steel">Restoring</span>
                          </span>
                          <span className="text-purple-400 font-semibold text-lg">{stats.restoringCount}</span>
                          <span className="text-xs text-steel">{formatPercent(stats.restoringCount, stats.totalSubjects)}%</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-steel text-sm">No subjects registered</p>
                  )}
                </div>

                {/* Participation Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up stagger-2">
                  <div className="scale-card p-6">
                    <h3 className="text-sm font-semibold text-ivory uppercase tracking-wider mb-4">Voting Participation</h3>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-steel text-sm">Total Votes Cast</span>
                          <span className="text-2xl font-bold text-ivory">{stats.totalVotes}</span>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-steel text-sm">Avg Votes per Dispute</span>
                          <span className="text-xl font-semibold text-gold">{stats.avgVotesPerDispute.toFixed(1)}</span>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-steel text-sm">Voter Turnout</span>
                          <span className="text-xl font-semibold text-emerald">
                            {stats.activeJurors > 0 && stats.totalDisputes > 0
                              ? ((stats.totalVotes / (stats.activeJurors * stats.totalDisputes)) * 100).toFixed(1)
                              : "0.0"}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="scale-card p-6">
                    <h3 className="text-sm font-semibold text-ivory uppercase tracking-wider mb-4">Restore Disputes</h3>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-steel text-sm">Restore Attempts</span>
                          <span className="text-2xl font-bold text-purple-400">{stats.restoreCount}</span>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-steel text-sm">% of Total Disputes</span>
                          <span className="text-xl font-semibold text-purple-400">
                            {formatPercent(stats.restoreCount, stats.totalDisputes)}%
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-steel">
                        Restore disputes allow invalid subjects to regain valid status through community vote
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TRENDS TAB */}
            {activeTab === "trends" && (
              <div className="space-y-8">
                {/* Time Series Charts */}
                <div className="scale-card p-6 animate-slide-up">
                  <h2 className="font-display text-xl font-semibold text-ivory mb-6">Activity Trends</h2>

                  {/* Dispute Volume Chart */}
                  <div className="mb-8">
                    <h3 className="text-sm font-semibold text-steel uppercase tracking-wider mb-4">Dispute Volume</h3>
                    <div className="h-64 flex items-end gap-2">
                      {trendData.map((bucket, i) => {
                        const maxDisputes = Math.max(...trendData.map((b) => b.disputes), 1);
                        const height = (bucket.disputes / maxDisputes) * 100;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-2">
                            <div className="w-full flex items-end h-48">
                              <div
                                className="w-full bg-gradient-to-t from-gold-dark to-gold transition-all hover:opacity-80 relative group"
                                style={{ height: `${height}%` }}
                              >
                                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate border border-gold px-2 py-1 text-xs text-ivory whitespace-nowrap">
                                  {bucket.disputes} disputes
                                </div>
                              </div>
                            </div>
                            <span className="text-xs text-steel text-center">{bucket.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Volume (SOL) Chart */}
                  <div>
                    <h3 className="text-sm font-semibold text-steel uppercase tracking-wider mb-4">Volume (SOL)</h3>
                    <div className="h-64 flex items-end gap-2">
                      {trendData.map((bucket, i) => {
                        const maxVolume = Math.max(...trendData.map((b) => b.volume), 1);
                        const height = (bucket.volume / maxVolume) * 100;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-2">
                            <div className="w-full flex items-end h-48">
                              <div
                                className="w-full bg-gradient-to-t from-emerald to-emerald-light transition-all hover:opacity-80 relative group"
                                style={{ height: `${height}%` }}
                              >
                                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate border border-emerald px-2 py-1 text-xs text-ivory whitespace-nowrap">
                                  {formatSOL(bucket.volume)} SOL
                                </div>
                              </div>
                            </div>
                            <span className="text-xs text-steel text-center">{bucket.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Growth Indicators */}
                {period !== "all" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up stagger-1">
                    <div className="scale-card p-6">
                      <h3 className="text-sm font-semibold text-steel uppercase tracking-wider mb-2">Dispute Growth</h3>
                      <div className="flex items-center gap-3">
                        <div className={stats.disputeChange >= 0 ? "text-emerald" : "text-crimson"}>
                          {stats.disputeChange >= 0 ? <TrendUpIcon /> : <TrendDownIcon />}
                        </div>
                        <span className={`text-3xl font-bold ${stats.disputeChange >= 0 ? "text-emerald" : "text-crimson"}`}>
                          {formatChange(stats.disputeChange)}%
                        </span>
                      </div>
                      <p className="text-xs text-steel mt-2">vs previous {periodLabels[period].toLowerCase()}</p>
                    </div>

                    <div className="scale-card p-6">
                      <h3 className="text-sm font-semibold text-steel uppercase tracking-wider mb-2">Volume Growth</h3>
                      <div className="flex items-center gap-3">
                        <div className={stats.inflowChange >= 0 ? "text-emerald" : "text-crimson"}>
                          {stats.inflowChange >= 0 ? <TrendUpIcon /> : <TrendDownIcon />}
                        </div>
                        <span className={`text-3xl font-bold ${stats.inflowChange >= 0 ? "text-emerald" : "text-crimson"}`}>
                          {formatChange(stats.inflowChange)}%
                        </span>
                      </div>
                      <p className="text-xs text-steel mt-2">vs previous {periodLabels[period].toLowerCase()}</p>
                    </div>

                    <div className="scale-card p-6">
                      <h3 className="text-sm font-semibold text-steel uppercase tracking-wider mb-2">Resolution Efficiency</h3>
                      <div className="flex items-center gap-3">
                        <span className="text-3xl font-bold text-gold">
                          {formatPercent(stats.resolvedCount, stats.totalDisputes)}%
                        </span>
                      </div>
                      <p className="text-xs text-steel mt-2">{stats.resolvedCount} of {stats.totalDisputes} resolved</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* LEADERBOARD TAB */}
            {activeTab === "leaderboard" && (
              <div className="space-y-8">
                {/* Top Jurors by Reputation */}
                <div className="scale-card p-6 animate-slide-up">
                  <h2 className="font-display text-xl font-semibold text-ivory mb-6 flex items-center gap-3">
                    <TrophyIcon />
                    Top Jurors by Reputation
                  </h2>
                  {leaderboards.topJurorsByRep.length > 0 ? (
                    <div className="space-y-2">
                      {leaderboards.topJurorsByRep.map((juror) => (
                        <div
                          key={juror.address}
                          className="flex items-center gap-4 p-3 bg-slate-light border border-slate hover:border-gold transition-all"
                        >
                          <div className={`w-8 h-8 flex items-center justify-center font-bold ${
                            juror.rank === 1 ? "text-gold text-xl" :
                            juror.rank === 2 ? "text-steel-light text-lg" :
                            juror.rank === 3 ? "text-crimson-light text-lg" :
                            "text-steel"
                          }`}>
                            {juror.rank}
                          </div>
                          <div className="flex-1">
                            <p className="font-mono text-sm text-parchment">{truncateAddress(juror.address)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-gold font-semibold">{formatReputation(juror.reputation)}%</p>
                            <p className="text-xs text-steel">reputation</p>
                          </div>
                          <div className="text-right">
                            <p className="text-ivory font-semibold">{juror.votesCast}</p>
                            <p className="text-xs text-steel">votes</p>
                          </div>
                          <div className="text-right">
                            <p className="text-emerald font-semibold">
                              {juror.votesCast > 0 ? ((juror.correctVotes / juror.votesCast) * 100).toFixed(0) : "0"}%
                            </p>
                            <p className="text-xs text-steel">accuracy</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-steel">No juror data available</p>
                  )}
                </div>

                {/* Top Jurors by Stake */}
                <div className="scale-card p-6 animate-slide-up stagger-1">
                  <h2 className="font-display text-xl font-semibold text-ivory mb-6">Top Jurors by Stake</h2>
                  {leaderboards.topJurorsByStake.length > 0 ? (
                    <div className="space-y-2">
                      {leaderboards.topJurorsByStake.map((juror) => (
                        <div
                          key={juror.address}
                          className="flex items-center gap-4 p-3 bg-slate-light border border-slate hover:border-gold transition-all"
                        >
                          <div className={`w-8 h-8 flex items-center justify-center font-bold ${
                            juror.rank === 1 ? "text-gold text-xl" :
                            juror.rank === 2 ? "text-steel-light text-lg" :
                            juror.rank === 3 ? "text-crimson-light text-lg" :
                            "text-steel"
                          }`}>
                            {juror.rank}
                          </div>
                          <div className="flex-1">
                            <p className="font-mono text-sm text-parchment">{truncateAddress(juror.address)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-gold font-semibold">{formatSOL(juror.stake)} SOL</p>
                            <p className="text-xs text-steel">staked</p>
                          </div>
                          <div className="text-right">
                            <p className="text-ivory font-semibold">{formatReputation(juror.reputation)}%</p>
                            <p className="text-xs text-steel">reputation</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-steel">No juror data available</p>
                  )}
                </div>

                {/* Most Active Jurors */}
                <div className="scale-card p-6 animate-slide-up stagger-2">
                  <h2 className="font-display text-xl font-semibold text-ivory mb-6">Most Active Jurors</h2>
                  {leaderboards.mostActiveJurors.length > 0 ? (
                    <div className="space-y-2">
                      {leaderboards.mostActiveJurors.map((juror) => (
                        <div
                          key={juror.address}
                          className="flex items-center gap-4 p-3 bg-slate-light border border-slate hover:border-gold transition-all"
                        >
                          <div className={`w-8 h-8 flex items-center justify-center font-bold ${
                            juror.rank === 1 ? "text-gold text-xl" :
                            juror.rank === 2 ? "text-steel-light text-lg" :
                            juror.rank === 3 ? "text-crimson-light text-lg" :
                            "text-steel"
                          }`}>
                            {juror.rank}
                          </div>
                          <div className="flex-1">
                            <p className="font-mono text-sm text-parchment">{truncateAddress(juror.address)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-emerald font-semibold">{juror.votesCast}</p>
                            <p className="text-xs text-steel">total votes</p>
                          </div>
                          <div className="text-right">
                            <p className="text-ivory font-semibold">{juror.correctVotes}</p>
                            <p className="text-xs text-steel">correct</p>
                          </div>
                          <div className="text-right">
                            <p className="text-gold font-semibold">{juror.accuracy.toFixed(0)}%</p>
                            <p className="text-xs text-steel">accuracy</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-steel">No juror data available</p>
                  )}
                </div>

                {/* Top Subjects */}
                <div className="scale-card p-6 animate-slide-up stagger-3">
                  <h2 className="font-display text-xl font-semibold text-ivory mb-6">Top Subjects by Defender Count</h2>
                  {leaderboards.topSubjects.length > 0 ? (
                    <div className="space-y-2">
                      {leaderboards.topSubjects.map((subject) => (
                        <div
                          key={subject.address}
                          className="flex items-center gap-4 p-3 bg-slate-light border border-slate hover:border-gold transition-all"
                        >
                          <div className={`w-8 h-8 flex items-center justify-center font-bold ${
                            subject.rank === 1 ? "text-gold text-xl" :
                            subject.rank === 2 ? "text-steel-light text-lg" :
                            subject.rank === 3 ? "text-crimson-light text-lg" :
                            "text-steel"
                          }`}>
                            {subject.rank}
                          </div>
                          <div className="flex-1">
                            <p className="font-mono text-sm text-parchment">{truncateAddress(subject.address)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sky font-semibold">{subject.defenderCount}</p>
                            <p className="text-xs text-steel">defenders</p>
                          </div>
                          <div className="text-right">
                            <p className="text-ivory font-semibold">{subject.disputeCount}</p>
                            <p className="text-xs text-steel">disputes</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-xs px-2 py-1 uppercase tracking-wider font-semibold ${
                              subject.status === "valid" ? "bg-emerald-20 text-emerald" :
                              subject.status === "disputed" ? "bg-gold-20 text-gold" :
                              subject.status === "invalid" ? "bg-crimson-20 text-crimson" :
                              "bg-steel-20 text-steel"
                            }`}>
                              {subject.status}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-steel">No subject data available</p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
