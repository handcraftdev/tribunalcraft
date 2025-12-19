"use client";

import { memo, useState, useEffect, useRef, useLayoutEffect } from "react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import Link from "next/link";
import { XIcon, ClockIcon, CheckIcon, ChevronDownIcon, LinkIcon } from "@/components/Icons";
import { getStatusBadge, getOutcomeLabel, getDisputeTypeLabel, SubjectModalProps, VoteData, DisputeData } from "./types";

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

// Vote Form
const VoteForm = memo(function VoteForm({
  existingVote,
  onVote,
  isLoading,
  isRestore = false,
}: {
  existingVote: any;
  onVote: (stake: string, choice: "forChallenger" | "forDefender" | "forRestoration" | "againstRestoration", rationale: string) => void;
  isLoading: boolean;
  isRestore?: boolean;
}) {
  const [voteStake, setVoteStake] = useState("0.01");
  const [voteChoice, setVoteChoice] = useState<"forChallenger" | "forDefender" | "forRestoration" | "againstRestoration">(
    isRestore ? "forRestoration" : "forDefender"
  );
  const [voteRationale, setVoteRationale] = useState("");

  const handleSubmit = () => {
    onVote(voteStake, voteChoice, voteRationale);
    if (!existingVote) setVoteRationale("");
  };

  // Get existing vote display based on whether it's a restore vote
  const getExistingVoteLabel = () => {
    if (!existingVote) return "";
    if (existingVote.account.isRestoreVote) {
      return existingVote.account.restoreChoice?.forRestoration ? "FOR RESTORATION" : "AGAINST RESTORATION";
    }
    return existingVote.account.choice?.forChallenger ? "FOR CHALLENGER" : "FOR DEFENDER";
  };

  const getExistingVoteClass = () => {
    if (!existingVote) return "";
    if (existingVote.account.isRestoreVote) {
      return existingVote.account.restoreChoice?.forRestoration ? "text-purple-400" : "text-crimson";
    }
    return existingVote.account.choice?.forChallenger ? "text-crimson" : "text-sky-400";
  };

  // Vote choices based on restore or regular dispute
  const choices = isRestore
    ? (["forRestoration", "againstRestoration"] as const)
    : (["forDefender", "forChallenger"] as const);

  const getChoiceLabel = (choice: string) => {
    switch (choice) {
      case "forDefender": return "For Defender";
      case "forChallenger": return "For Challenger";
      case "forRestoration": return "For Restoration";
      case "againstRestoration": return "Against Restoration";
      default: return choice;
    }
  };

  const getChoiceClass = (choice: string, isSelected: boolean) => {
    if (!isSelected) return "bg-slate-light hover:bg-slate text-parchment";
    switch (choice) {
      case "forDefender": return "bg-sky-500 text-obsidian";
      case "forChallenger": return "bg-crimson text-ivory";
      case "forRestoration": return "bg-purple-500 text-ivory";
      case "againstRestoration": return "bg-crimson text-ivory";
      default: return "bg-gold text-obsidian";
    }
  };

  return (
    <>
      {existingVote && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-steel">Your Vote:</span>
          <span className={`font-medium ${getExistingVoteClass()}`}>
            {getExistingVoteLabel()} - {(existingVote.account.stakeAllocated.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL
          </span>
        </div>
      )}
      {existingVote ? (
        <p className="text-xs text-steel">Add more stake to your vote:</p>
      ) : (
        <>
          <div className="flex gap-2">
            {choices.map((choice) => (
              <button
                key={choice}
                onClick={() => setVoteChoice(choice)}
                className={`flex-1 py-2 text-xs font-medium uppercase tracking-wider transition-all ${getChoiceClass(choice, voteChoice === choice)}`}
              >
                {getChoiceLabel(choice)}
              </button>
            ))}
          </div>
          <textarea
            value={voteRationale}
            onChange={(e) => setVoteRationale(e.target.value)}
            placeholder="Rationale for your vote (optional)"
            className="input w-full text-sm py-2 h-16 resize-none"
          />
        </>
      )}
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={voteStake}
          onChange={(e) => setVoteStake(e.target.value)}
          className="input flex-1 text-sm py-2"
          placeholder="Stake amount"
        />
        <span className="text-steel text-sm">SOL</span>
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="btn btn-primary py-2 px-4"
        >
          {isLoading ? "..." : existingVote ? "Add" : "Vote"}
        </button>
      </div>
    </>
  );
});

// Join Form
const JoinForm = memo(function JoinForm({
  type,
  onJoin,
  isLoading,
  label,
}: {
  type: "defender" | "challenger";
  onJoin: (amount: string) => void;
  isLoading: boolean;
  label?: string;
}) {
  const [amount, setAmount] = useState(type === "defender" ? "0.1" : "0.05");

  return (
    <div className="flex gap-2 flex-1">
      {type === "defender" ? (
        <>
          <button onClick={() => onJoin(amount)} disabled={isLoading} className="btn btn-secondary py-1.5 px-3 text-sm border-sky-500/50 hover:border-sky-400 shrink-0">
            <span className="text-sky-400">{label || "Join Defenders"}</span>
          </button>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input flex-1 min-w-0 text-sm py-1.5"
            placeholder="Amount"
          />
          <span className="text-steel text-sm shrink-0">SOL</span>
        </>
      ) : (
        <>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input flex-1 min-w-0 text-sm py-1.5"
            placeholder="Bond"
          />
          <span className="text-steel text-sm shrink-0">SOL</span>
          <button onClick={() => onJoin(amount)} disabled={isLoading} className="btn btn-secondary py-1.5 px-3 text-sm border-crimson/50 hover:border-crimson shrink-0">
            <span className="text-crimson">Join Challengers</span>
          </button>
        </>
      )}
    </div>
  );
});

// Collapsible History Item
const HistoryItem = memo(function HistoryItem({
  pastDispute,
  disputeContent,
  votes,
  defaultExpanded = false,
}: {
  pastDispute: DisputeData;
  disputeContent: any;
  votes: VoteData[];
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const dOutcome = getOutcomeLabel(pastDispute.account.outcome);
  const totalVotes = pastDispute.account.votesFavorWeight.toNumber() + pastDispute.account.votesAgainstWeight.toNumber();
  const favorPercent = totalVotes > 0
    ? (pastDispute.account.votesFavorWeight.toNumber() / totalVotes) * 100
    : 50;
  const isRestore = pastDispute.account.isRestore;

  // Calculate juror pot (19% of total pool)
  const PROTOCOL_FEE_BPS = 2000;
  const JUROR_SHARE_BPS = 9500;
  let totalPool: number;
  if (isRestore) {
    totalPool = pastDispute.account.restoreStake.toNumber();
  } else {
    totalPool = pastDispute.account.totalBond.toNumber() +
      pastDispute.account.stakeHeld.toNumber() +
      pastDispute.account.directStakeHeld.toNumber();
  }
  const totalFees = totalPool * PROTOCOL_FEE_BPS / 10000;
  const jurorPot = totalFees * JUROR_SHARE_BPS / 10000;
  const jurorFees = jurorPot > 0 ? `${(jurorPot / LAMPORTS_PER_SOL).toFixed(3)} SOL` : "FREE";

  return (
    <div className={`border ${isRestore ? 'border-purple-500/30' : 'border-slate-light'}`}>
      {/* Clickable header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 bg-slate-light/30 flex items-center justify-between hover:bg-slate-light/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${dOutcome.class}`}>{dOutcome.label}</span>
          <span className="text-[10px] text-steel">
            {new Date(pastDispute.account.resolvedAt.toNumber() * 1000).toLocaleDateString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] ${isRestore ? 'text-purple-400' : 'text-steel'}`}>
            {isRestore ? 'Restore Request' : getDisputeTypeLabel(pastDispute.account.disputeType)}
          </span>
          <ChevronDownIcon expanded={expanded} />
        </div>
      </button>

      {/* Expandable content */}
      {expanded && (
        <>
          {/* VS / Power bar - different for restorations */}
          <div className="p-3 bg-slate-light/10 space-y-2">
            {isRestore ? (
              <>
                {/* Restoration voting bar */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-400">For Restoration</span>
                  <span className="text-crimson">Against Restoration</span>
                </div>
                <div className="h-2 rounded overflow-hidden flex bg-obsidian">
                  <div className="h-full" style={{ width: `${favorPercent}%`, backgroundColor: '#a855f7' }} />
                  <div className="h-full" style={{ width: `${100 - favorPercent}%`, backgroundColor: '#dc2626' }} />
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span>
                    <span className="text-purple-400">
                      {(pastDispute.account.restoreStake.toNumber() / LAMPORTS_PER_SOL).toFixed(2)}
                    </span>
                    <span className="text-steel"> · </span>
                    <span className="text-purple-400">{votes.filter(v => "forRestoration" in v.account.restoreChoice).length}</span>
                    <span className="text-steel"> · </span>
                    <span className="text-purple-400">{favorPercent.toFixed(0)}%</span>
                  </span>
                  <span className="text-steel">{pastDispute.account.voteCount} votes</span>
                  <span>
                    <span className="text-crimson">{(100 - favorPercent).toFixed(0)}%</span>
                    <span className="text-steel"> · </span>
                    <span className="text-crimson">{votes.filter(v => "againstRestoration" in v.account.restoreChoice).length}</span>
                    <span className="text-steel"> · </span>
                    <span className="text-purple-400">
                      {pastDispute.account.restorer.toBase58().slice(0, 4)}...
                    </span>
                  </span>
                </div>
              </>
            ) : (
              <>
                {/* Regular dispute bar */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-sky-400">
                    {pastDispute.account.snapshotDefenderCount} Defender{pastDispute.account.snapshotDefenderCount !== 1 ? 's' : ''}
                  </span>
                  <span className="text-crimson">
                    {pastDispute.account.challengerCount} Challenger{pastDispute.account.challengerCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="h-2 rounded overflow-hidden flex bg-obsidian">
                  <div className="h-full" style={{ width: `${100 - favorPercent}%`, backgroundColor: '#0ea5e9' }} />
                  <div className="h-full" style={{ width: `${favorPercent}%`, backgroundColor: '#dc2626' }} />
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span>
                    <span className="text-sky-400">
                      {((pastDispute.account.stakeHeld.toNumber() + pastDispute.account.directStakeHeld.toNumber()) / LAMPORTS_PER_SOL).toFixed(2)}
                    </span>
                    <span className="text-steel"> · </span>
                    <span className="text-sky-400">{votes.filter(v => "forDefender" in v.account.choice).length}</span>
                    <span className="text-steel"> · </span>
                    <span className="text-sky-400">{(100 - favorPercent).toFixed(0)}%</span>
                  </span>
                  <span className="text-steel">{pastDispute.account.voteCount} votes</span>
                  <span>
                    <span className="text-crimson">{favorPercent.toFixed(0)}%</span>
                    <span className="text-steel"> · </span>
                    <span className="text-crimson">{votes.filter(v => "forChallenger" in v.account.choice).length}</span>
                    <span className="text-steel"> · </span>
                    <span className="text-crimson">
                      {(pastDispute.account.totalBond.toNumber() / LAMPORTS_PER_SOL).toFixed(2)}
                    </span>
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Dispute/Restoration details */}
          <div className="p-3 bg-obsidian space-y-2">
            <div className="flex items-center justify-between">
              <p className={`text-sm font-medium ${isRestore ? 'text-purple-400' : 'text-crimson'}`}>
                {disputeContent?.title || (isRestore ? "Restoration Request" : "Dispute")}
              </p>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${isRestore ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-light/30 text-steel'}`}>
                  {isRestore ? 'Restore' : getDisputeTypeLabel(pastDispute.account.disputeType)}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold/20 text-gold">{jurorFees}</span>
              </div>
            </div>
            {disputeContent?.reason && (
              <div>
                <p className="text-[10px] text-steel uppercase tracking-wider mb-0.5">Reason</p>
                <p className="text-xs text-parchment">{disputeContent.reason}</p>
              </div>
            )}
            {disputeContent?.requestedOutcome && (
              <div>
                <p className="text-[10px] text-steel uppercase tracking-wider mb-0.5">Requested Outcome</p>
                <p className="text-xs text-parchment">{disputeContent.requestedOutcome}</p>
              </div>
            )}
            {/* Resolution info */}
            <div className="pt-2 border-t border-slate-light/30 grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <span className="text-steel">Resolved: </span>
                <span className="text-parchment">{new Date(pastDispute.account.resolvedAt.toNumber() * 1000).toLocaleString()}</span>
              </div>
              <div className="text-right">
                <span className="text-steel">Duration: </span>
                <span className="text-parchment">
                  {Math.round((pastDispute.account.votingEndsAt.toNumber() - pastDispute.account.votingStartsAt.toNumber()) / 3600)}h
                </span>
              </div>
            </div>
          </div>

          {/* Juror remarks for this history item */}
          {votes.length > 0 && (
            <div className="p-3 bg-obsidian/50 border-t border-slate-light/30">
              <p className="text-[10px] text-steel uppercase tracking-wider mb-2">Juror Remarks ({votes.length})</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {votes.map((vote, i) => {
                  const hasRationale = vote.account.rationaleCid && vote.account.rationaleCid.length > 0;
                  const jurorAddress = vote.account.juror.toBase58();
                  const stakeAmount = vote.account.stakeAllocated.toNumber() / LAMPORTS_PER_SOL;

                  // Determine vote display based on whether it's a restore vote
                  const isRestoreVote = vote.account.isRestoreVote;
                  const voteLabel = isRestoreVote
                    ? (vote.account.restoreChoice?.forRestoration ? "FOR RESTORATION" : "AGAINST RESTORATION")
                    : (vote.account.choice?.forChallenger ? "FOR CHALLENGER" : "FOR DEFENDER");
                  const voteColorClass = isRestoreVote
                    ? (vote.account.restoreChoice?.forRestoration ? "text-purple-400" : "text-crimson")
                    : (vote.account.choice?.forChallenger ? "text-crimson" : "text-sky-400");
                  const borderColorClass = isRestoreVote
                    ? (vote.account.restoreChoice?.forRestoration ? "border-purple-500/20" : "border-crimson/20")
                    : (vote.account.choice?.forChallenger ? "border-crimson/20" : "border-sky-500/20");

                  return (
                    <div key={i} className={`p-2 bg-obsidian border ${borderColorClass}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-medium ${voteColorClass}`}>
                            {voteLabel}
                          </span>
                          <span className="text-[10px] text-steel">
                            {jurorAddress.slice(0, 4)}...{jurorAddress.slice(-4)}
                          </span>
                        </div>
                        <span className="text-[10px] text-gold">{stakeAmount.toFixed(4)} SOL</span>
                      </div>
                      {hasRationale ? (
                        <p className="text-[10px] text-parchment">{vote.account.rationaleCid}</p>
                      ) : (
                        <p className="text-[10px] text-steel/50 italic">No rationale</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
});

export const SubjectModal = memo(function SubjectModal({
  subject,
  dispute,
  subjectContent,
  disputeContent,
  existingVote,
  jurorAccount,
  disputeVotes,
  pastDisputes,
  pastDisputeContents,
  challengerRecord,
  defenderRecord,
  onClose,
  onVote,
  onAddStake,
  onJoinChallengers,
  onResolve,
  onClaimJuror,
  onClaimChallenger,
  onClaimDefender,
  onFileDispute,
  onRestore,
  actionLoading,
  showActions = true,
  getIpfsUrl,
  disputeCid,
}: SubjectModalProps) {
  const modalScrollRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef(0);

  // Save scroll position before re-render
  useLayoutEffect(() => {
    if (modalScrollRef.current) {
      scrollPositionRef.current = modalScrollRef.current.scrollTop;
    }
  });

  // Restore scroll position after re-render
  useEffect(() => {
    if (modalScrollRef.current && scrollPositionRef.current > 0) {
      modalScrollRef.current.scrollTop = scrollPositionRef.current;
    }
  });

  const subjectKey = subject.publicKey.toBase58();
  const isInvalid = subject.account.status.invalid;
  const isRestoring = subject.account.status.restoring;
  const isRestore = dispute?.account.isRestore;

  // Show subject's current status
  const isResolvedDispute = dispute?.account.status.resolved;
  const subjectStatus = getStatusBadge(subject.account.status);

  const outcome = dispute ? getOutcomeLabel(dispute.account.outcome) : null;
  const votingEnded = dispute ? Date.now() > dispute.account.votingEndsAt.toNumber() * 1000 : false;
  const isPending = dispute?.account.status.pending;
  const canVote = isPending && !votingEnded && jurorAccount;
  const canResolve = isPending && votingEnded;
  const totalVotes = dispute
    ? dispute.account.votesFavorWeight.toNumber() + dispute.account.votesAgainstWeight.toNumber()
    : 0;
  const favorPercent = totalVotes > 0
    ? (dispute!.account.votesFavorWeight.toNumber() / totalVotes) * 100
    : 50;

  // Juror fees
  const PROTOCOL_FEE_BPS = 2000;
  const JUROR_SHARE_BPS = 9500;
  let disputeJurorFees = "FREE";
  if (!subject.account.freeCase && dispute) {
    let totalPool: number;
    if (dispute.account.isRestore) {
      // For restorations, juror pot is based on restore stake
      totalPool = dispute.account.restoreStake.toNumber();
    } else {
      // For regular disputes, juror pot is based on bond + matched stake
      const bondPool = dispute.account.totalBond.toNumber();
      const matchedStake = subject.account.matchMode
        ? dispute.account.stakeHeld.toNumber() + dispute.account.directStakeHeld.toNumber()
        : dispute.account.snapshotTotalStake.toNumber();
      totalPool = bondPool + matchedStake;
    }
    const totalFees = totalPool * PROTOCOL_FEE_BPS / 10000;
    const jurorPot = totalFees * JUROR_SHARE_BPS / 10000;
    disputeJurorFees = `${(jurorPot / LAMPORTS_PER_SOL).toFixed(3)} SOL`;
  }

  // Claim checks
  const hasJurorClaim = existingVote && !existingVote.account.rewardClaimed;
  const hasChallengerClaim = challengerRecord && !challengerRecord.rewardClaimed;
  const hasDefenderClaim = defenderRecord && !defenderRecord.rewardClaimed;
  const hasAnyClaim = hasJurorClaim || hasChallengerClaim || hasDefenderClaim;

  // Combine all resolved disputes for history
  // Include current dispute if it's resolved, plus all past disputes
  const allHistoryDisputes = dispute?.account.status.resolved
    ? [dispute, ...pastDisputes]
    : pastDisputes;

  // Sort disputes by resolved date (latest first)
  const sortedHistoryDisputes = [...allHistoryDisputes].sort((a, b) =>
    b.account.resolvedAt.toNumber() - a.account.resolvedAt.toNumber()
  );

  return (
    <div className="fixed inset-0 bg-obsidian/90 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        ref={modalScrollRef}
        className="bg-slate border border-slate-light max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-light flex items-center justify-between">
          <h3 className="text-lg font-semibold text-ivory">
            Subject #{subjectKey}
          </h3>
          <button onClick={onClose} className="text-steel hover:text-parchment">
            <XIcon />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* SUBJECT SECTION */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-sky-500 rounded"></div>
              <h4 className="text-xs font-semibold text-sky-400 uppercase tracking-wider">Subject (Defender Side)</h4>
            </div>
            <div className="p-4 bg-obsidian border border-sky-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-sky-400 font-medium">{subjectContent?.title || "Untitled Subject"}</p>
                <div className="flex items-center gap-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    subject.account.matchMode ? "bg-gold/20 text-gold" : "bg-steel/20 text-steel"
                  }`}>
                    {subject.account.matchMode ? "Match" : "Prop"}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${subjectStatus.class}`}>
                    {subjectStatus.label}
                  </span>
                  {subject.account.freeCase && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald/20 text-emerald">Free</span>
                  )}
                </div>
              </div>
              {subjectContent?.description && (
                <p className="text-steel text-sm">{subjectContent.description}</p>
              )}
              <div className="grid grid-cols-2 text-sm pt-2 border-t border-slate-light/50">
                <div>
                  <p className="text-steel text-xs">Stake</p>
                  <p className="text-sky-400">
                    {!subject.account.freeCase ? (
                      <>
                        {`${(subject.account.availableStake.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL`}
                        {subject.account.matchMode && !subject.account.defenderPool.equals(PublicKey.default) && (
                          <span className="text-steel text-xs"> (max {(subject.account.maxStake.toNumber() / LAMPORTS_PER_SOL).toFixed(2)})</span>
                        )}
                      </>
                    ) : "-"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-steel text-xs">Defenders</p>
                  <p className="text-sky-400">{subject.account.defenderCount}</p>
                </div>
              </div>
              {/* Subject Actions - based on subject status, not dispute status */}
              {showActions && (
                <div className="flex gap-2 pt-2 border-t border-slate-light/50">
                  {!subject.account.freeCase && (subject.account.status.valid || subject.account.status.disputed || subject.account.status.dormant) && onAddStake && (
                    <JoinForm
                      type="defender"
                      onJoin={onAddStake}
                      isLoading={actionLoading}
                      label={subject.account.status.dormant ? "Revive Subject" : undefined}
                    />
                  )}
                  {subject.account.status.valid && onFileDispute && (
                    <button onClick={onFileDispute} className="btn btn-secondary py-1.5 px-3 text-sm">
                      File Dispute
                    </button>
                  )}
                  {isInvalid && onRestore && (
                    <button onClick={onRestore} className="btn btn-secondary py-1.5 px-3 text-sm border-purple-500/50 hover:border-purple-400">
                      <span className="text-purple-400">Restore Subject</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* VS / POWER BAR SECTION - hide for invalidated, different for restoring */}
          {dispute && !isInvalid && (
            <div className="space-y-3">
              <div className={`p-4 bg-slate-light/20 border ${isRestore ? 'border-purple-500/30' : 'border-slate-light'} space-y-3`}>
                {isRestore ? (
                  <>
                    {/* Restoration voting bar */}
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider">
                      <span className="text-purple-400">For Restoration</span>
                      <span className="text-steel">VOTING</span>
                      <span className="text-crimson">Against Restoration</span>
                    </div>
                    <div className="h-3 rounded overflow-hidden flex bg-obsidian">
                      <div className="h-full transition-all" style={{ width: `${favorPercent}%`, backgroundColor: '#a855f7' }} />
                      <div className="h-full transition-all" style={{ width: `${100 - favorPercent}%`, backgroundColor: '#dc2626' }} />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span>
                        <span className="text-purple-400">
                          {(dispute.account.restoreStake.toNumber() / LAMPORTS_PER_SOL).toFixed(2)}
                        </span>
                        <span className="text-steel"> · </span>
                        <span className="text-purple-400">{disputeVotes.filter(v => "forRestoration" in v.account.restoreChoice).length}</span>
                        <span className="text-steel"> · </span>
                        <span className="text-purple-400">{favorPercent.toFixed(0)}%</span>
                      </span>
                      <span className="text-steel flex items-center gap-1">
                        <ClockIcon />
                        <Countdown endTime={dispute.account.votingEndsAt.toNumber() * 1000} />
                      </span>
                      <span>
                        <span className="text-crimson">{(100 - favorPercent).toFixed(0)}%</span>
                        <span className="text-steel"> · </span>
                        <span className="text-crimson">{disputeVotes.filter(v => "againstRestoration" in v.account.restoreChoice).length}</span>
                        <span className="text-steel"> · </span>
                        <span className="text-purple-400">
                          {dispute.account.restorer.toBase58().slice(0, 4)}...
                        </span>
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Regular dispute vs bar */}
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider">
                      <span className="text-sky-400">{subject.account.defenderCount} Defender{subject.account.defenderCount !== 1 ? 's' : ''}</span>
                      <span className="text-steel">VS</span>
                      <span className="text-crimson">{dispute.account.challengerCount} Challenger{dispute.account.challengerCount !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="h-3 rounded overflow-hidden flex bg-obsidian">
                      <div className="h-full transition-all" style={{ width: `${100 - favorPercent}%`, backgroundColor: '#0ea5e9' }} />
                      <div className="h-full transition-all" style={{ width: `${favorPercent}%`, backgroundColor: '#dc2626' }} />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span>
                        <span className="text-sky-400">
                          {((dispute.account.stakeHeld.toNumber() + dispute.account.directStakeHeld.toNumber()) / LAMPORTS_PER_SOL).toFixed(2)}
                        </span>
                        <span className="text-steel"> · </span>
                        <span className="text-sky-400">{disputeVotes.filter(v => "forDefender" in v.account.choice).length}</span>
                        <span className="text-steel"> · </span>
                        <span className="text-sky-400">{(100 - favorPercent).toFixed(0)}%</span>
                      </span>
                      <span className="text-steel flex items-center gap-1">
                        <ClockIcon />
                        <Countdown endTime={dispute.account.votingEndsAt.toNumber() * 1000} />
                      </span>
                      <span>
                        <span className="text-crimson">{favorPercent.toFixed(0)}%</span>
                        <span className="text-steel"> · </span>
                        <span className="text-crimson">{disputeVotes.filter(v => "forChallenger" in v.account.choice).length}</span>
                        <span className="text-steel"> · </span>
                        <span className="text-crimson">
                          {(dispute.account.totalBond.toNumber() / LAMPORTS_PER_SOL).toFixed(2)}
                        </span>
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* DISPUTE/RESTORATION SECTION - hide for invalidated */}
          {dispute && !isInvalid && (
            <div className="space-y-3">
              {isRestore ? (
                <>
                  {/* RESTORATION SECTION */}
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-purple-500 rounded"></div>
                    <h4 className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Restoration Request</h4>
                  </div>
                  <div className="p-4 bg-obsidian border border-purple-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-purple-400 font-medium">{disputeContent?.title || "Restoration Request"}</p>
                      <div className="flex items-center gap-2">
                        {outcome && <span className={`text-xs font-medium ${outcome.class}`}>{outcome.label}</span>}
                        {existingVote && <span className="text-emerald flex items-center gap-0.5 text-xs"><CheckIcon /> Voted</span>}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold/20 text-gold">{disputeJurorFees}</span>
                      </div>
                    </div>
                    {disputeContent?.reason && <p className="text-sm text-steel">{disputeContent.reason}</p>}
                    <div className="grid grid-cols-2 text-sm pt-2 border-t border-slate-light/50">
                      <div>
                        <p className="text-steel text-xs">Restore Stake</p>
                        <p className="text-purple-400">{(dispute.account.restoreStake.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL</p>
                      </div>
                      <div className="text-right">
                        <p className="text-steel text-xs">Restorer</p>
                        <p className="text-purple-400 text-xs">
                          {dispute.account.restorer.toBase58().slice(0, 4)}...{dispute.account.restorer.toBase58().slice(-4)}
                        </p>
                      </div>
                    </div>
                    {/* Restoration Actions - only resolve button */}
                    {showActions && isPending && canResolve && onResolve && (
                      <div className="flex gap-2 pt-2 border-t border-slate-light/50">
                        <button onClick={onResolve} disabled={actionLoading} className="btn btn-primary py-1.5 px-3 text-sm flex-1">
                          {actionLoading ? "..." : "Resolve"}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* DISPUTE SECTION (Challenger Side) */}
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-crimson rounded"></div>
                    <h4 className="text-xs font-semibold text-crimson uppercase tracking-wider">Dispute (Challenger Side)</h4>
                  </div>
                  <div className="p-4 bg-obsidian border border-crimson/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-crimson font-medium">{disputeContent?.title || getDisputeTypeLabel(dispute.account.disputeType)}</p>
                      <div className="flex items-center gap-2">
                        {outcome && <span className={`text-xs font-medium ${outcome.class}`}>{outcome.label}</span>}
                        {existingVote && <span className="text-emerald flex items-center gap-0.5 text-xs"><CheckIcon /> Voted</span>}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold/20 text-gold">{disputeJurorFees}</span>
                      </div>
                    </div>
                    {disputeContent?.reason && <p className="text-sm text-steel">{disputeContent.reason}</p>}
                    <div className="grid grid-cols-2 text-sm pt-2 border-t border-slate-light/50">
                      <div>
                        <p className="text-steel text-xs">Total Bond</p>
                        <p className="text-crimson">{(dispute.account.totalBond.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL</p>
                      </div>
                      <div className="text-right">
                        <p className="text-steel text-xs">Challengers</p>
                        <p className="text-crimson">{dispute.account.challengerCount}</p>
                      </div>
                    </div>
                    {/* Dispute Actions */}
                    {showActions && isPending && (canResolve || !subject.account.freeCase) && (
                      <div className="flex gap-2 pt-2 border-t border-slate-light/50">
                        {canResolve && onResolve && (
                          <button onClick={onResolve} disabled={actionLoading} className="btn btn-primary py-1.5 px-3 text-sm flex-1">
                            {actionLoading ? "..." : "Resolve"}
                          </button>
                        )}
                        {!subject.account.freeCase && !canResolve && onJoinChallengers && (
                          <JoinForm
                            type="challenger"
                            onJoin={onJoinChallengers}
                            isLoading={actionLoading}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* JUROR SECTION - hide for invalidated */}
          {showActions && dispute && !isInvalid && isPending && !votingEnded && onVote && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-steel uppercase tracking-wider">Juror</h4>
              <div className="p-4 bg-obsidian border border-slate-light space-y-3">
                {!jurorAccount ? (
                  <p className="text-steel text-sm text-center">
                    <Link href="/profile" className="text-gold hover:text-gold-light">Register as juror</Link> to vote on this dispute
                  </p>
                ) : (
                  <VoteForm
                    existingVote={existingVote}
                    onVote={onVote}
                    isLoading={actionLoading}
                    isRestore={dispute?.account.isRestore}
                  />
                )}
              </div>
            </div>
          )}

          {/* CLAIM SECTION - show for resolved disputes regardless of subject status */}
          {showActions && dispute && isResolvedDispute && hasAnyClaim && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-gold uppercase tracking-wider">Claim Rewards</h4>
              <div className="p-4 bg-obsidian border border-gold/30 space-y-3">
                <p className="text-xs text-steel mb-2">
                  Outcome: <span className={outcome?.class}>{outcome?.label}</span>
                </p>

                {hasJurorClaim && onClaimJuror && (
                  <div className="flex items-center justify-between py-2 border-t border-slate-light/30">
                    <div>
                      <p className="text-sm text-parchment">Juror Reward</p>
                      <p className="text-xs text-steel">
                        Voted {existingVote!.account.isRestoreVote
                          ? (existingVote!.account.restoreChoice?.forRestoration ? "for Restoration" : "against Restoration")
                          : (existingVote!.account.choice?.forChallenger ? "for Challenger" : "for Defender")
                        } - {(existingVote!.account.stakeAllocated.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL
                      </p>
                    </div>
                    <button onClick={onClaimJuror} disabled={actionLoading} className="btn btn-primary py-1.5 px-3 text-sm">
                      {actionLoading ? "..." : "Claim"}
                    </button>
                  </div>
                )}

                {hasChallengerClaim && onClaimChallenger && (
                  <div className="flex items-center justify-between py-2 border-t border-slate-light/30">
                    <div>
                      <p className="text-sm text-crimson">Challenger Reward</p>
                      <p className="text-xs text-steel">
                        Bond: {(challengerRecord!.bond.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL
                      </p>
                    </div>
                    <button onClick={onClaimChallenger} disabled={actionLoading} className="btn btn-secondary py-1.5 px-3 text-sm border-crimson/50 hover:border-crimson">
                      <span className="text-crimson">{actionLoading ? "..." : "Claim"}</span>
                    </button>
                  </div>
                )}

                {hasDefenderClaim && onClaimDefender && (
                  <div className="flex items-center justify-between py-2 border-t border-slate-light/30">
                    <div>
                      <p className="text-sm text-sky-400">Defender Reward</p>
                      <p className="text-xs text-steel">
                        Stake: {(defenderRecord!.stake.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL
                      </p>
                    </div>
                    <button onClick={onClaimDefender} disabled={actionLoading} className="btn btn-secondary py-1.5 px-3 text-sm border-sky-500/50 hover:border-sky-400">
                      <span className="text-sky-400">{actionLoading ? "..." : "Claim"}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* JUROR REMARKS SECTION (current dispute) - hide for invalidated */}
          {dispute && !isInvalid && disputeVotes.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-steel uppercase tracking-wider">Juror Remarks ({disputeVotes.length})</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {disputeVotes.map((vote, i) => {
                  const hasRationale = vote.account.rationaleCid && vote.account.rationaleCid.length > 0;
                  const jurorAddress = vote.account.juror.toBase58();
                  const stakeAmount = vote.account.stakeAllocated.toNumber() / LAMPORTS_PER_SOL;
                  const votingPower = vote.account.votingPower.toNumber() / LAMPORTS_PER_SOL;

                  // Determine vote display based on whether it's a restore vote
                  const isRestoreVote = vote.account.isRestoreVote;
                  const voteLabel = isRestoreVote
                    ? (vote.account.restoreChoice?.forRestoration ? "FOR RESTORATION" : "AGAINST RESTORATION")
                    : (vote.account.choice?.forChallenger ? "FOR CHALLENGER" : "FOR DEFENDER");
                  const voteColorClass = isRestoreVote
                    ? (vote.account.restoreChoice?.forRestoration ? "text-purple-400" : "text-crimson")
                    : (vote.account.choice?.forChallenger ? "text-crimson" : "text-sky-400");
                  const borderColorClass = isRestoreVote
                    ? (vote.account.restoreChoice?.forRestoration ? "border-purple-500/30" : "border-crimson/30")
                    : (vote.account.choice?.forChallenger ? "border-crimson/30" : "border-sky-500/30");

                  return (
                    <div key={i} className={`p-3 bg-obsidian border ${borderColorClass}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${voteColorClass}`}>
                            {voteLabel}
                          </span>
                          <span className="text-[10px] text-steel">
                            {jurorAddress.slice(0, 4)}...{jurorAddress.slice(-4)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-gold">{stakeAmount.toFixed(4)} SOL</span>
                          {votingPower !== stakeAmount && (
                            <span className="text-[10px] text-steel ml-1">({votingPower.toFixed(4)} power)</span>
                          )}
                        </div>
                      </div>
                      {hasRationale ? (
                        <p className="text-xs text-parchment mt-1">{vote.account.rationaleCid}</p>
                      ) : (
                        <p className="text-xs text-steel/50 italic mt-1">No rationale provided</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* IPFS Link */}
          {disputeCid && getIpfsUrl && (
            <a href={getIpfsUrl(disputeCid)} target="_blank" rel="noopener noreferrer" className="text-xs text-gold hover:text-gold-light flex items-center gap-1">
              View dispute on IPFS <LinkIcon />
            </a>
          )}

          {/* HISTORY SECTION - collapsible with juror remarks */}
          {sortedHistoryDisputes.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-steel uppercase tracking-wider">
                Dispute History ({sortedHistoryDisputes.length})
              </h4>
              <div className="space-y-2">
                {sortedHistoryDisputes.map((historyDispute, i) => {
                  const dKey = historyDispute.publicKey.toBase58();
                  // Use current disputeContent if this is the current dispute, otherwise from pastDisputeContents
                  const dContent = dispute && dKey === dispute.publicKey.toBase58()
                    ? disputeContent
                    : pastDisputeContents[dKey];
                  // Include votes for current dispute if it's in history
                  const dVotes = dispute && dKey === dispute.publicKey.toBase58()
                    ? disputeVotes
                    : [];
                  return (
                    <HistoryItem
                      key={i}
                      pastDispute={historyDispute}
                      disputeContent={dContent}
                      votes={dVotes}
                      defaultExpanded={i === 0}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
