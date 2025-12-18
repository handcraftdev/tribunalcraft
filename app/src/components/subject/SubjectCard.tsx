"use client";

import { memo, useState, useEffect } from "react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { ClockIcon, CheckIcon } from "@/components/Icons";
import { getStatusBadge, getDisputeTypeLabel, SubjectCardProps } from "./types";

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
  existingVote,
  subjectContent,
  disputeContent,
  onClick,
}: SubjectCardProps) {
  const subjectKey = subject.publicKey.toBase58();
  const isInvalid = subject.account.status.invalid;
  const isDormant = subject.account.status.dormant;
  const isRestoring = subject.account.status.restoring;
  const isRestore = dispute?.account.isRestore;

  // Show subject's current status
  const status = getStatusBadge(subject.account.status);

  // Show dispute info only for subjects with active disputes/restorations (not invalid/dormant)
  const showDisputeInfo = dispute && !isInvalid && !isDormant;

  // Dispute voting info
  const totalVotes = dispute
    ? dispute.account.votesFavorWeight.toNumber() + dispute.account.votesAgainstWeight.toNumber()
    : 0;
  const favorPercent = totalVotes > 0
    ? (dispute!.account.votesFavorWeight.toNumber() / totalVotes) * 100
    : 50;

  // Juror fees display (19% of total pool - 95% of 20% fee)
  const PROTOCOL_FEE_BPS = 2000;
  const JUROR_SHARE_BPS = 9500;
  let jurorFees = "FREE";
  if (!subject.account.freeCase) {
    if (showDisputeInfo) {
      let totalPool: number;
      if (dispute!.account.isRestore) {
        // For restorations, juror pot is based on restore stake
        totalPool = dispute!.account.restoreStake.toNumber();
      } else {
        // For regular disputes, juror pot is based on bond + matched stake
        const bondPool = dispute!.account.totalBond.toNumber();
        const matchedStake = subject.account.matchMode
          ? dispute!.account.stakeHeld.toNumber() + dispute!.account.directStakeHeld.toNumber()
          : dispute!.account.snapshotTotalStake.toNumber();
        totalPool = bondPool + matchedStake;
      }
      const totalFees = totalPool * PROTOCOL_FEE_BPS / 10000;
      const jurorPot = totalFees * JUROR_SHARE_BPS / 10000;
      jurorFees = `${(jurorPot / LAMPORTS_PER_SOL).toFixed(3)} SOL`;
    } else {
      jurorFees = "19%";
    }
  }

  return (
    <div
      onClick={onClick}
      className={`p-3 bg-obsidian border cursor-pointer transition-all ${
        existingVote
          ? "border-emerald/30 hover:border-emerald/50"
          : isInvalid
          ? "border-crimson/30 hover:border-crimson/50"
          : isRestoring
          ? "border-purple-500/30 hover:border-purple-400/50"
          : isDormant
          ? "border-purple-500/30 hover:border-purple-400/50"
          : "border-slate-light hover:border-gold/50"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <p className="text-sm text-parchment font-medium truncate flex-1">
          {subjectContent?.title || subjectKey.slice(0, 12) + "..."}
        </p>
        <div className="flex items-center gap-1 ml-2">
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
            subject.account.matchMode ? "bg-gold/20 text-gold" : "bg-steel/20 text-steel"
          }`}>
            {subject.account.matchMode ? "Match" : "Proportional"}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${status.class}`}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-steel truncate mb-2">
        {subjectContent?.description?.slice(0, 50) || "Loading..."}
      </p>

      {/* Dispute Info - only for non-invalidated subjects */}
      {showDisputeInfo && (
        <div className="mb-2 pt-2 border-t border-slate-light/50">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className={`font-medium ${isRestore ? 'text-purple-400' : 'text-crimson'}`}>
              {isRestore
                ? (disputeContent?.title || "Restoration Request")
                : (disputeContent?.title || getDisputeTypeLabel(dispute.account.disputeType))
              }
            </span>
            {existingVote && (
              <span className="text-emerald flex items-center gap-0.5">
                <CheckIcon size={10} /> Voted
              </span>
            )}
          </div>
          <p className="text-xs text-steel truncate mb-2">
            {disputeContent?.reason?.slice(0, 50) || "..."}
          </p>
          {/* Power bar - different colors for restorations */}
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
          <div className="flex items-center justify-between text-[10px]">
            {isRestore ? (
              <>
                <span className="text-purple-400">{favorPercent.toFixed(0)}%</span>
                <span className="text-steel flex items-center gap-1">
                  <ClockIcon />
                  <Countdown endTime={dispute.account.votingEndsAt.toNumber() * 1000} />
                </span>
                <span className="text-crimson">{(100 - favorPercent).toFixed(0)}%</span>
              </>
            ) : (
              <>
                <span className="text-sky-400">{(100 - favorPercent).toFixed(0)}%</span>
                <span className="text-steel flex items-center gap-1">
                  <ClockIcon />
                  <Countdown endTime={dispute.account.votingEndsAt.toNumber() * 1000} />
                </span>
                <span className="text-crimson">{favorPercent.toFixed(0)}%</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="grid grid-cols-3 text-[10px] pt-2 border-t border-slate-light/50">
        <span>
          {!subject.account.freeCase && (
            showDisputeInfo ? (
              isRestore ? (
                // Restoration: show restore stake
                <span className="text-purple-400">
                  {(dispute!.account.restoreStake.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL
                </span>
              ) : (
                // Regular dispute: show defender stake / challenger bond
                <>
                  <span className="text-sky-400">
                    {((dispute!.account.stakeHeld.toNumber() + dispute!.account.directStakeHeld.toNumber()) / LAMPORTS_PER_SOL).toFixed(2)}
                  </span>
                  <span className="text-steel"> / </span>
                  <span className="text-crimson">
                    {(dispute!.account.totalBond.toNumber() / LAMPORTS_PER_SOL).toFixed(2)}
                  </span>
                </>
              )
            ) : (
              <>
                <span className="text-sky-400">
                  {(subject.account.availableStake.toNumber() / LAMPORTS_PER_SOL).toFixed(2)}
                </span>
                {subject.account.matchMode && !subject.account.defenderPool.equals(PublicKey.default) && (
                  <span className="text-steel">
                    {" "}(max {(subject.account.maxStake.toNumber() / LAMPORTS_PER_SOL).toFixed(2)})
                  </span>
                )}
              </>
            )
          )}
        </span>
        <span className="text-center">
          {showDisputeInfo && isRestore ? (
            // Restoration: show restorer address
            <span className="text-purple-400">
              {dispute!.account.restorer.toBase58().slice(0, 4)}...
            </span>
          ) : (
            <>
              <span className="text-sky-400">{subject.account.defenderCount}</span>
              {showDisputeInfo ? (
                <>
                  <span className="text-steel"> vs </span>
                  <span className="text-crimson">{dispute!.account.challengerCount}</span>
                </>
              ) : (
                <span className="text-steel"> ({subject.account.disputeCount})</span>
              )}
            </>
          )}
        </span>
        <span className="text-gold text-right">{jurorFees}</span>
      </div>
    </div>
  );
});
