"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Navigation } from "@/components/Navigation";
import { useTribunalcraft } from "@/hooks/useTribunalcraft";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import Link from "next/link";

interface ActivityItem {
  type: string;
  signature: string;
  timestamp: number;
  slot: number;
  dispute?: string;
  subject?: string;
  accounts?: string[];
  amount?: number;
  rentReclaimed?: number;
  success?: boolean;
}

const ActivityTypeIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "vote":
    case "vote_on_dispute":
    case "vote_on_restore":
      return (
        <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "claim":
    case "claim_reward":
      return (
        <svg className="w-5 h-5 text-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "challenge":
    case "join_challengers":
    case "submit_dispute":
      return (
        <svg className="w-5 h-5 text-crimson" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case "defend":
    case "add_bond":
      return (
        <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      );
    case "resolve":
    case "resolve_dispute":
      return (
        <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
        </svg>
      );
    case "create_subject":
      return (
        <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      );
    case "close_record":
      return (
        <svg className="w-5 h-5 text-steel" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      );
    default:
      return (
        <svg className="w-5 h-5 text-steel" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
};

const getActivityLabel = (type: string): string => {
  const labels: Record<string, string> = {
    vote: "Voted on Dispute",
    vote_on_dispute: "Voted on Dispute",
    vote_on_restore: "Voted on Restoration",
    claim: "Claimed Reward",
    claim_reward: "Claimed Reward",
    challenge: "Joined Challengers",
    join_challengers: "Joined Challengers",
    submit_dispute: "Created Dispute",
    defend: "Added Bond",
    add_bond: "Added Bond",
    resolve: "Resolved Dispute",
    resolve_dispute: "Resolved Dispute",
    create_subject: "Created Subject",
    close_record: "Closed Record",
    unlock_stake: "Unlocked Stake",
    register_juror: "Registered as Juror",
    register_defender: "Registered Defender Pool",
    deposit: "Deposited to Pool",
    withdraw: "Withdrew from Pool",
  };
  return labels[type] || type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
};

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // Less than 1 hour
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins}m ago`;
  }
  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }
  // Less than 7 days
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  }

  return date.toLocaleDateString();
};

export default function ActivityPage() {
  const { publicKey } = useWallet();
  const { fetchUserActivity } = useTribunalcraft();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastSignature, setLastSignature] = useState<string | undefined>();

  const loadActivities = useCallback(async (before?: string) => {
    if (!publicKey) return;
    setLoading(true);
    try {
      const items = await fetchUserActivity(publicKey, { limit: 20, before });
      if (items.length < 20) {
        setHasMore(false);
      }
      if (items.length > 0) {
        setLastSignature(items[items.length - 1].signature);
      }
      setActivities(prev => before ? [...prev, ...items] : items);
    } catch (err) {
      console.error("Failed to fetch activities:", err);
    }
    setLoading(false);
  }, [publicKey, fetchUserActivity]);

  useEffect(() => {
    if (publicKey) {
      loadActivities();
    } else {
      setActivities([]);
      setHasMore(true);
      setLastSignature(undefined);
    }
  }, [publicKey, loadActivities]);

  const loadMore = () => {
    if (!loading && hasMore && lastSignature) {
      loadActivities(lastSignature);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian relative overflow-hidden">
      {/* Atmospheric Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[350px] bg-gradient-radial from-gold/[0.02] to-transparent blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-gradient-radial from-sky-400/[0.015] to-transparent blur-3xl" />
      </div>

      <Navigation />

      <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-12">
        {/* Header */}
        <div className="mb-8 animate-slide-up">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ivory leading-tight tracking-tight mb-2">
                Activity <span className="text-gold">History</span>
              </h1>
              <p className="text-steel text-sm">
                Your transaction history on TribunalCraft
              </p>
            </div>
            <Link href="/profile" className="text-sm text-steel hover:text-ivory transition-colors">
              Back to Profile
            </Link>
          </div>
        </div>

        {!publicKey ? (
          <div className="text-center py-16">
            <p className="text-steel">Connect your wallet to view activity</p>
          </div>
        ) : loading && activities.length === 0 ? (
          <div className="text-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-gold border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-steel">Loading activity...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-steel">No activity found</p>
            <p className="text-xs text-steel mt-2">
              Start participating in disputes to see your history here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {activities.map((activity, index) => (
              <div
                key={`${activity.signature}-${index}`}
                className="bg-slate border border-slate-light/30 p-4 rounded transition-colors hover:border-slate-light/50"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <ActivityTypeIcon type={activity.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-parchment">
                        {getActivityLabel(activity.type)}
                      </p>
                      <span className="text-xs text-steel whitespace-nowrap">
                        {formatTimestamp(activity.timestamp)}
                      </span>
                    </div>

                    {(activity.amount !== undefined && activity.amount > 0) && (
                      <p className="text-xs text-steel mt-1">
                        Amount:{" "}
                        <span className="text-gold">
                          {(activity.amount / LAMPORTS_PER_SOL).toFixed(6)} SOL
                        </span>
                      </p>
                    )}

                    {(activity.rentReclaimed !== undefined && activity.rentReclaimed > 0) && (
                      <p className="text-xs text-steel mt-1">
                        Rent reclaimed:{" "}
                        <span className="text-emerald">
                          {(activity.rentReclaimed / LAMPORTS_PER_SOL).toFixed(6)} SOL
                        </span>
                      </p>
                    )}

                    {activity.subject && (
                      <p className="text-[10px] text-steel mt-1 truncate">
                        Subject: {activity.subject}
                      </p>
                    )}

                    <a
                      href={`https://solscan.io/tx/${activity.signature}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-sky-400 hover:text-sky-300 mt-2 inline-block"
                    >
                      View on Solscan
                    </a>
                  </div>
                </div>
              </div>
            ))}

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loading}
                className="w-full py-3 text-sm text-steel hover:text-ivory border border-slate-light/30 hover:border-slate-light/50 transition-colors disabled:opacity-50"
              >
                {loading ? "Loading..." : "Load More"}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
