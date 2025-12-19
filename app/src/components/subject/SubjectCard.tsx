"use client";

import { memo, useState, useEffect } from "react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { ClockIcon } from "@/components/Icons";
import { getStatusBadge, getDisputeTypeLabel, getOutcomeLabel, SUBJECT_CATEGORIES, SubjectCardProps } from "./types";

// Countdown component
const Countdown = ({ endTime }: { endTime: number }) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Date.now();
      const diff = endTime - now;
      if (diff <= 0) {
        setTimeLeft("Ended");
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      if (days > 0) setTimeLeft(`${days}d ${hours}h`);
      else if (hours > 0) setTimeLeft(`${hours}h ${minutes}m`);
      else setTimeLeft(`${minutes}m`);
    };
    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 60000);
    return () => clearInterval(interval);
  }, [endTime]);

  const isUrgent = endTime - Date.now() < 1000 * 60 * 60;
  return <span className={isUrgent ? "text-crimson" : "text-gold"}>{timeLeft}</span>;
};

export const SubjectCard = memo(function SubjectCard({
  subject,
  dispute,
  isResolved = false,
  subjectContent,
  disputeContent,
  voteCounts,
  onClick,
}: SubjectCardProps) {
  const subjectKey = subject.publicKey.toBase58();
  const isInvalid = subject.account.status.invalid;
  const isDormant = subject.account.status.dormant;
  const isRestoring = subject.account.status.restoring;
  const isRestore = dispute?.account.isRestore;

  // Check if dispute is resolved (either passed prop or from dispute status)
  const disputeResolved = isResolved || (dispute && "resolved" in dispute.account.status);
  const votingEnded = dispute && Date.now() > dispute.account.votingEndsAt.toNumber() * 1000;

  // Show subject's current status
  const status = getStatusBadge(subject.account.status);

  // Show dispute info only for active (non-resolved) disputes
  const showDisputeInfo = dispute != null && !disputeResolved;

  // Calculate vote percentages
  const totalVotes = dispute
    ? dispute.account.votesFavorWeight.toNumber() + dispute.account.votesAgainstWeight.toNumber()
    : 0;
  const hasNoVotes = totalVotes === 0;
  const favorPercent = totalVotes > 0
    ? (dispute!.account.votesFavorWeight.toNumber() / totalVotes) * 100
    : 50;

  // Juror fees display (19% of total pool - 95% of 20% fee)
  const PROTOCOL_FEE_BPS = 2000;
  const JUROR_SHARE_BPS = 9500;
  let jurorFees = "";
  if (showDisputeInfo && !subject.account.freeCase && !disputeResolved) {
    let totalPool: number;
    if (dispute!.account.isRestore) {
      totalPool = dispute!.account.restoreStake.toNumber();
    } else {
      const bondPool = dispute!.account.totalBond.toNumber();
      const matchedStake = subject.account.matchMode
        ? dispute!.account.stakeHeld.toNumber() + dispute!.account.directStakeHeld.toNumber()
        : dispute!.account.snapshotTotalStake.toNumber();
      totalPool = bondPool + matchedStake;
    }
    const totalFees = totalPool * PROTOCOL_FEE_BPS / 10000;
    const jurorPot = totalFees * JUROR_SHARE_BPS / 10000;
    jurorFees = `${(jurorPot / LAMPORTS_PER_SOL).toFixed(6)}`;
  } else if (showDisputeInfo && subject.account.freeCase && !disputeResolved) {
    jurorFees = "FREE";
  }

  // Awaiting resolution state
  const awaitingResolution = showDisputeInfo && votingEnded && !disputeResolved;

  return (
    <div
      onClick={onClick}
      className={`p-3 bg-obsidian border cursor-pointer transition-all ${
        isInvalid
          ? "border-red-800/30 hover:border-red-800/50"
          : isRestoring
          ? "border-purple-500/30 hover:border-purple-400/50"
          : isDormant
          ? "border-purple-500/30 hover:border-purple-400/50"
          : awaitingResolution
          ? "border-gold/50 hover:border-gold"
          : showDisputeInfo
          ? "border-gold/30 hover:border-gold/50"
          : "border-slate-light hover:border-gold/50"
      }`}
    >
      {/* Header - title with badges */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className="text-sm text-parchment font-medium truncate flex-1">
          {subjectContent?.title || subjectKey.slice(0, 12) + "..."}
        </p>
        <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
          {subjectContent?.category && (
            <span className="text-[10px] text-sky">
              {SUBJECT_CATEGORIES.find(c => c.key === subjectContent.category)?.label || subjectContent.category}
            </span>
          )}
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
            subject.account.matchMode ? "bg-gold/20 text-gold" : "bg-steel/20 text-steel"
          }`}>
            {subject.account.matchMode ? "Match" : "Prop"}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${status.class}`}>
            {status.label}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-steel/20 text-steel">
            {Math.floor(subject.account.votingPeriod.toNumber() / 3600)}h
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-steel truncate mb-2">
        {subjectContent?.description?.slice(0, 50) || "Loading..."}
      </p>

      {/* Dispute Info */}
      {showDisputeInfo && (
        <div className="pt-2 border-t border-slate-light/50">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className={`font-medium ${isRestore ? 'text-purple-400' : 'text-crimson'}`}>
              {isRestore
                ? (disputeContent?.title || "Restoration Request")
                : (disputeContent?.title || getDisputeTypeLabel(dispute!.account.disputeType))
              }
            </span>
            {jurorFees && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold/20 text-gold">
                {jurorFees}
              </span>
            )}
          </div>

          {/* Dispute reason */}
          <p className="text-xs text-steel truncate mb-2">
            {disputeContent?.reason?.slice(0, 50) || "..."}
          </p>

          {/* No votes indicator for ended disputes */}
          {hasNoVotes && votingEnded && (
            <div className="text-center py-2 mb-2 bg-slate/30 rounded">
              <span className="text-[10px] text-steel">No votes cast</span>
            </div>
          )}

          {/* Power bar - only show if there were votes */}
          {!hasNoVotes && (
            <>
              <div className="h-1.5 rounded overflow-hidden flex mb-1 bg-obsidian">
                {isRestore ? (
                  <>
                    <div
                      className="h-full transition-all"
                      style={{ width: `${favorPercent}%`, backgroundColor: '#a855f7' }}
                    />
                    <div
                      className="h-full transition-all"
                      style={{ width: `${100 - favorPercent}%`, backgroundColor: '#dc2626' }}
                    />
                  </>
                ) : (
                  <>
                    <div
                      className="h-full transition-all"
                      style={{ width: `${100 - favorPercent}%`, backgroundColor: '#0ea5e9' }}
                    />
                    <div
                      className="h-full transition-all"
                      style={{ width: `${favorPercent}%`, backgroundColor: '#dc2626' }}
                    />
                  </>
                )}
              </div>

              {/* Vote stats with amounts and counts - combined line */}
              <div className="flex items-center justify-between text-[10px]">
                {isRestore ? (
                  <>
                    <span>
                      <span className="text-purple-400">
                        {(dispute!.account.restoreStake.toNumber() / LAMPORTS_PER_SOL).toFixed(4)}
                      </span>
                      <span className="text-steel"> · </span>
                      <span className="text-purple-400">
                        {voteCounts ? voteCounts.favor : 0}
                      </span>
                      <span className="text-steel"> · </span>
                      <span className="text-purple-400">{favorPercent.toFixed(0)}%</span>
                    </span>
                    <span className="text-steel flex items-center gap-1">
                      <ClockIcon />
                      <Countdown endTime={dispute!.account.votingEndsAt.toNumber() * 1000} />
                    </span>
                    <span>
                      <span className="text-crimson">{(100 - favorPercent).toFixed(0)}%</span>
                      <span className="text-steel"> · </span>
                      <span className="text-crimson">
                        {voteCounts ? voteCounts.against : 0}
                      </span>
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      <span className="text-sky">
                        {((dispute!.account.stakeHeld.toNumber() + dispute!.account.directStakeHeld.toNumber()) / LAMPORTS_PER_SOL).toFixed(4)}
                      </span>
                      <span className="text-steel"> · </span>
                      <span className="text-sky">
                        {voteCounts ? voteCounts.against : 0}
                      </span>
                      <span className="text-steel"> · </span>
                      <span className="text-sky">{(100 - favorPercent).toFixed(0)}%</span>
                    </span>
                    <span className="text-steel flex items-center gap-1">
                      <ClockIcon />
                      <Countdown endTime={dispute!.account.votingEndsAt.toNumber() * 1000} />
                    </span>
                    <span>
                      <span className="text-crimson">{favorPercent.toFixed(0)}%</span>
                      <span className="text-steel"> · </span>
                      <span className="text-crimson">
                        {voteCounts ? voteCounts.favor : 0}
                      </span>
                      <span className="text-steel"> · </span>
                      <span className="text-crimson">
                        {(dispute!.account.totalBond.toNumber() / LAMPORTS_PER_SOL).toFixed(4)}
                      </span>
                    </span>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Footer - only for non-disputed subjects */}
      {!showDisputeInfo && (
        <div className="flex items-center justify-between text-[10px] pt-2 border-t border-slate-light/50">
          <span className="text-sky">
            {(subject.account.availableStake.toNumber() / LAMPORTS_PER_SOL).toFixed(6)} SOL
          </span>
          <span className="text-sky">
            {subject.account.defenderCount} defender{subject.account.defenderCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
});
