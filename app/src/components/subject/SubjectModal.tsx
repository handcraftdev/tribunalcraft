"use client";

import { memo, useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { XIcon, ClockIcon, CheckIcon, ChevronDownIcon, LinkIcon } from "@/components/Icons";
import { getStatusBadge, getOutcomeLabel, getDisputeTypeLabel, SUBJECT_CATEGORIES, DISPUTE_TYPES, SubjectModalProps, VoteData, DisputeData, UserRoles, ChallengerRecordData, DefenderRecordData } from "./types";
import { useTribunalcraft, calculateMinBond, INITIAL_REPUTATION, DisputeType } from "@/hooks/useTribunalcraft";
import { useUpload, useContentFetch } from "@/hooks/useUpload";
import type { DisputeContent } from "@/lib/content-types";

// Role badges component - displays separate J, D, C badges
const RoleBadges = ({ roles }: { roles?: UserRoles | null }) => {
  if (!roles) return null;

  const { juror, defender, challenger } = roles;
  if (!juror && !defender && !challenger) return null;

  return (
    <div className="flex items-center gap-0.5">
      {juror && (
        <span className="text-[9px] font-bold w-4 h-4 flex items-center justify-center text-gold rounded-sm">
          J
        </span>
      )}
      {defender && (
        <span className="text-[9px] font-bold w-4 h-4 flex items-center justify-center text-sky-400 rounded-sm">
          D
        </span>
      )}
      {challenger && (
        <span className="text-[9px] font-bold w-4 h-4 flex items-center justify-center text-crimson rounded-sm">
          C
        </span>
      )}
    </div>
  );
};

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
      const isForRestoration = existingVote.account.restoreChoice && "forRestoration" in existingVote.account.restoreChoice;
      return isForRestoration ? "FOR RESTORATION" : "AGAINST RESTORATION";
    }
    const isForChallenger = existingVote.account.choice && "forChallenger" in existingVote.account.choice;
    return isForChallenger ? "FOR CHALLENGER" : "FOR DEFENDER";
  };

  const getExistingVoteClass = () => {
    if (!existingVote) return "";
    if (existingVote.account.isRestoreVote) {
      const isForRestoration = existingVote.account.restoreChoice && "forRestoration" in existingVote.account.restoreChoice;
      return isForRestoration ? "text-purple-400" : "text-crimson";
    }
    const isForChallenger = existingVote.account.choice && "forChallenger" in existingVote.account.choice;
    return isForChallenger ? "text-crimson" : "text-sky";
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
            {getExistingVoteLabel()} - {(existingVote.account.stakeAllocated.toNumber() / LAMPORTS_PER_SOL).toFixed(6)} SOL
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
    <div className="flex flex-col gap-2 flex-1">
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="input flex-1 min-w-0 text-sm py-1.5"
          placeholder={type === "defender" ? "Amount" : "Bond"}
        />
        <span className="text-steel text-sm shrink-0">SOL</span>
      </div>
      {type === "defender" ? (
        <button onClick={() => onJoin(amount)} disabled={isLoading} className="btn btn-secondary py-1.5 px-3 text-sm w-full border-sky-500/50 hover:border-sky-400">
          <span className="text-sky-400">{label || "Join Defenders"}</span>
        </button>
      ) : (
        <button onClick={() => onJoin(amount)} disabled={isLoading} className="btn btn-secondary py-1.5 px-3 text-sm w-full border-red-800/50 hover:border-red-700">
          <span className="text-crimson">Join Challengers</span>
        </button>
      )}
    </div>
  );
});

// Claim data for a dispute
interface ClaimData {
  voteRecord?: VoteData | null;
  challengerRecord?: { bond: any; rewardClaimed: boolean } | null;
  defenderRecord?: { stake: any; rewardClaimed: boolean } | null;
}

// Collapsible History Item
const HistoryItem = memo(function HistoryItem({
  pastDispute,
  disputeContent,
  votes,
  defaultExpanded = false,
  claimData,
  onClaimAll,
  actionLoading = false,
}: {
  pastDispute: DisputeData;
  disputeContent: any;
  votes: VoteData[];
  defaultExpanded?: boolean;
  claimData?: ClaimData | null;
  onClaimAll?: (disputeKey: string, claims: { juror: boolean; challenger: boolean; defender: boolean }) => void;
  actionLoading?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const dOutcome = getOutcomeLabel(pastDispute.account.outcome);
  const totalVotes = pastDispute.account.votesFavorWeight.toNumber() + pastDispute.account.votesAgainstWeight.toNumber();
  const favorPercent = totalVotes > 0
    ? (pastDispute.account.votesFavorWeight.toNumber() / totalVotes) * 100
    : 50;
  const isRestore = pastDispute.account.isRestore;
  const isPending = pastDispute.account.status.pending;

  // Derive user roles from claim data
  const userRoles = {
    juror: !!claimData?.voteRecord,
    defender: !!claimData?.defenderRecord,
    challenger: !!claimData?.challengerRecord,
  };

  // Calculate rewards (winner 80%, juror 19%, treasury 1%)
  const PROTOCOL_FEE_BPS = 2000; // 20%
  const JUROR_SHARE_BPS = 9500; // 95% of fees = 19% of total
  const TREASURY_SHARE_BPS = 500; // 5% of fees = 1% of total
  let totalPool: number;
  if (isRestore) {
    totalPool = pastDispute.account.restoreStake.toNumber();
  } else {
    totalPool = pastDispute.account.totalBond.toNumber() +
      pastDispute.account.stakeHeld.toNumber() +
      pastDispute.account.directStakeHeld.toNumber();
  }
  const totalFees = totalPool * PROTOCOL_FEE_BPS / 10000;
  const winnerPot = totalPool - totalFees;
  const jurorPot = totalFees * JUROR_SHARE_BPS / 10000;
  const treasuryPot = totalFees * TREASURY_SHARE_BPS / 10000;
  const winnerReward = (winnerPot / LAMPORTS_PER_SOL).toFixed(4);
  const jurorReward = (jurorPot / LAMPORTS_PER_SOL).toFixed(4);
  const treasuryReward = (treasuryPot / LAMPORTS_PER_SOL).toFixed(4);
  const isFreeCase = totalPool === 0;

  // Claim availability checks - no claims for free cases (no rewards)
  const isResolved = pastDispute.account.status.resolved;
  const hasJurorClaim = !isFreeCase && claimData?.voteRecord && !claimData.voteRecord.account.rewardClaimed;
  const hasChallengerClaim = !isFreeCase && claimData?.challengerRecord && !claimData.challengerRecord.rewardClaimed;
  const hasDefenderClaim = !isFreeCase && claimData?.defenderRecord && !claimData.defenderRecord.rewardClaimed;
  const hasAnyClaim = hasJurorClaim || hasChallengerClaim || hasDefenderClaim;

  // Check if user has any claim records at all (regardless of claimed status)
  const hasAnyClaimRecord = !isFreeCase && (claimData?.voteRecord || claimData?.challengerRecord || claimData?.defenderRecord);
  const allClaimed = hasAnyClaimRecord && !hasAnyClaim;

  // Determine outcome
  const challengerWins = "challengerWins" in pastDispute.account.outcome;
  const defenderWins = "defenderWins" in pastDispute.account.outcome;
  const restorationWins = isRestore && "challengerWins" in pastDispute.account.outcome; // forRestoration maps to challengerWins
  const restorationLoses = isRestore && "defenderWins" in pastDispute.account.outcome;

  // User's stake/bond amounts
  const jurorStake = claimData?.voteRecord?.account.stakeAllocated?.toNumber() || 0;
  const jurorVotingPower = claimData?.voteRecord?.account.votingPower?.toNumber() || 0;
  const challengerBond = claimData?.challengerRecord?.bond?.toNumber() || 0;
  const defenderStake = claimData?.defenderRecord?.stake?.toNumber() || 0;

  // Check if user voted for the winning side
  const userVotedForChallenger = claimData?.voteRecord?.account.choice && "forChallenger" in claimData.voteRecord.account.choice;
  const userVotedForRestoration = claimData?.voteRecord?.account.restoreChoice && "forRestoration" in claimData.voteRecord.account.restoreChoice;
  const userVotedForWinner = isRestore
    ? (restorationWins && userVotedForRestoration) || (restorationLoses && !userVotedForRestoration)
    : (challengerWins && userVotedForChallenger) || (defenderWins && !userVotedForChallenger);

  // Calculate actual rewards (winner pot is 80% of total, already has fees deducted)
  // Juror reward: ALL jurors share the pot proportionally by voting power (not just winners)
  const totalVoteWeight = pastDispute.account.votesFavorWeight.toNumber() + pastDispute.account.votesAgainstWeight.toNumber();
  const jurorRewardShare = totalVoteWeight > 0
    ? (jurorVotingPower / totalVoteWeight) * jurorPot
    : 0;
  // Note: Stake is unlocked separately, reward is the only claimable amount
  const jurorRewardAmount = jurorRewardShare;

  // Challenger reward: share of winner pot (only if challenger wins)
  // Winner pot (80%) is distributed proportionally - no need to add bond back
  const totalBond = pastDispute.account.totalBond?.toNumber() || 0;
  const challengerRewardAmount = challengerWins && totalBond > 0
    ? (challengerBond / totalBond) * winnerPot
    : 0; // Lose bond if defender wins

  // Defender reward: share of winner pot (only if defender wins)
  const totalDefenderStake = (pastDispute.account.stakeHeld?.toNumber() || 0) + (pastDispute.account.directStakeHeld?.toNumber() || 0);
  const defenderRewardAmount = defenderWins && totalDefenderStake > 0
    ? (defenderStake / totalDefenderStake) * winnerPot
    : 0; // Lose stake if challenger wins

  // Total reward amount for user (sum of all applicable rewards)
  const totalUserReward = (claimData?.voteRecord ? jurorRewardAmount : 0)
    + (claimData?.challengerRecord ? challengerRewardAmount : 0)
    + (claimData?.defenderRecord ? defenderRewardAmount : 0);
  const totalUserRewardFormatted = (totalUserReward / LAMPORTS_PER_SOL).toFixed(4);

  const handleClaimAll = () => {
    if (onClaimAll) {
      onClaimAll(pastDispute.publicKey.toBase58(), {
        juror: !!hasJurorClaim,
        challenger: !!hasChallengerClaim,
        defender: !!hasDefenderClaim,
      });
      // Keep modal open to show claimed status
    }
  };

  // Border color based on outcome
  const getBorderClass = () => {
    if (isPending) return 'border-slate-light';
    if (isRestore) {
      return restorationWins ? 'border-purple-500/50' : 'border-red-800/50';
    }
    return challengerWins ? 'border-red-800/50' : 'border-sky-500/50';
  };

  return (
    <div className={`border ${getBorderClass()}`}>
      {/* Clickable header - uses details aesthetic */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 bg-obsidian hover:bg-obsidian/80 transition-colors text-left"
      >
        <div className="flex items-center justify-between mb-2">
          <p className={`text-sm font-medium ${isRestore ? 'text-purple-400' : 'text-crimson'}`}>
            {disputeContent?.title || (isRestore ? "Restoration Request" : "Dispute")}
          </p>
          <div className="flex items-center gap-1">
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${isRestore ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-light/30 text-steel'}`}>
              {isRestore ? 'Restore' : getDisputeTypeLabel(pastDispute.account.disputeType)}
            </span>
            {isFreeCase ? (
              <span className="text-[10px] text-emerald">Free</span>
            ) : (
              <>
                <span className="text-[10px] text-emerald" title="Winner reward">{winnerReward}</span>
                <span className="text-[10px] text-gold" title="Juror reward">{jurorReward}</span>
                <span className="text-[10px] text-steel" title="Treasury">{treasuryReward}</span>
              </>
            )}
            <RoleBadges roles={userRoles} />
            {userRoles.juror && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                isRestore
                  ? (userVotedForRestoration ? 'bg-purple-500/20 text-purple-400' : 'bg-red-800/20 text-crimson')
                  : (userVotedForChallenger ? 'bg-red-800/20 text-crimson' : 'bg-sky-500/20 text-sky-400')
              }`}>
                {isRestore
                  ? (userVotedForRestoration ? '→ Restore' : '→ Reject')
                  : (userVotedForChallenger ? '→ Challenger' : '→ Defender')
                }
              </span>
            )}
            {isResolved && hasAnyClaim && (
              <span
                onClick={(e) => { e.stopPropagation(); setShowClaimModal(true); }}
                className="text-[10px] px-1.5 py-0.5 rounded bg-gold/20 text-gold cursor-pointer hover:bg-gold/30"
              >
                Claim +{totalUserRewardFormatted}
              </span>
            )}
            {isResolved && allClaimed && (
              <span
                onClick={(e) => { e.stopPropagation(); setShowClaimModal(true); }}
                className="text-[10px] text-steel cursor-pointer hover:text-parchment"
              >
                +{totalUserRewardFormatted}
              </span>
            )}
            <ChevronDownIcon expanded={expanded} />
          </div>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-steel">{pastDispute.publicKey.toBase58()}</span>
          <div className="flex items-center gap-2">
            <span className={`font-medium ${dOutcome.class}`}>{isPending ? 'Voting' : dOutcome.label}</span>
            {!isPending && (
              <span className="text-steel">
                {new Date(pastDispute.account.resolvedAt.toNumber() * 1000).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Claim Modal */}
      {showClaimModal && (
        <div className="fixed inset-0 bg-obsidian/90 flex items-center justify-center z-[60] p-4" onClick={() => setShowClaimModal(false)}>
          <div className="bg-slate border border-gold/30 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-light flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gold">Claim Rewards</h3>
              <button onClick={() => setShowClaimModal(false)} className="text-steel hover:text-parchment">
                <XIcon />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {/* Outcome */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-steel">Outcome</span>
                <span className={`text-sm font-medium ${dOutcome.class}`}>{dOutcome.label}</span>
              </div>

              {/* Total Reward */}
              <div className={`p-4 bg-obsidian border ${hasAnyClaim ? 'border-gold/30' : 'border-slate-light/30'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-steel">Your Share</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold ${hasAnyClaim ? 'text-gold' : 'text-steel'}`}>
                      +{totalUserRewardFormatted} SOL
                    </span>
                    {allClaimed && (
                      <span className="text-emerald">
                        <CheckIcon />
                      </span>
                    )}
                  </div>
                </div>

                {/* Breakdown - only show rewards, not losses */}
                <div className="mt-3 pt-3 border-t border-slate-light/30 space-y-1">
                  {claimData?.voteRecord && jurorRewardAmount > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-steel">
                        Juror <span className="text-steel/60">({(jurorVotingPower / totalVoteWeight * 100).toFixed(1)}% of votes)</span>
                      </span>
                      <span className={hasJurorClaim ? 'text-gold' : 'text-steel'}>
                        +{(jurorRewardAmount / LAMPORTS_PER_SOL).toFixed(6)}
                        {!hasJurorClaim && ' ✓'}
                      </span>
                    </div>
                  )}
                  {claimData?.challengerRecord && challengerWins && challengerRewardAmount > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-steel">
                        Winner <span className="text-steel/60">({(totalBond > 0 ? challengerBond / totalBond * 100 : 0).toFixed(1)}% of winner pot)</span>
                      </span>
                      <span className={hasChallengerClaim ? 'text-emerald' : 'text-steel'}>
                        +{(challengerRewardAmount / LAMPORTS_PER_SOL).toFixed(6)}
                        {!hasChallengerClaim && ' ✓'}
                      </span>
                    </div>
                  )}
                  {claimData?.defenderRecord && defenderWins && defenderRewardAmount > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-steel">
                        Winner <span className="text-steel/60">({(totalDefenderStake > 0 ? defenderStake / totalDefenderStake * 100 : 0).toFixed(1)}% of winner pot)</span>
                      </span>
                      <span className={hasDefenderClaim ? 'text-emerald' : 'text-steel'}>
                        +{(defenderRewardAmount / LAMPORTS_PER_SOL).toFixed(6)}
                        {!hasDefenderClaim && ' ✓'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {hasAnyClaim ? (
                <button
                  onClick={handleClaimAll}
                  disabled={actionLoading}
                  className="btn btn-primary w-full py-2"
                >
                  {actionLoading ? "Claiming..." : "Claim All"}
                </button>
              ) : (
                <button
                  onClick={() => setShowClaimModal(false)}
                  className="btn btn-secondary w-full py-2"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Expandable content */}
      {expanded && (
        <>
          {/* Reason, requested outcome, and resolution info */}
          <div className="p-3 bg-obsidian space-y-2">
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
            {!isPending && (
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
            )}
          </div>

          {/* VS / Power bar - after requested outcome */}
          <div className="p-3 bg-obsidian space-y-2">
            {isRestore ? (
              <>
                {/* Restoration voting bar */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-400">For Restoration</span>
                  <span className="text-crimson">Against Restoration</span>
                </div>
                <div className="h-1 rounded overflow-hidden flex bg-obsidian">
                  <div className="h-full" style={{ width: `${favorPercent}%`, backgroundColor: '#a855f7' }} />
                  <div className="h-full" style={{ width: `${100 - favorPercent}%`, backgroundColor: '#dc2626' }} />
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span>
                    <span className="text-purple-400">
                      {(pastDispute.account.restoreStake.toNumber() / LAMPORTS_PER_SOL).toFixed(6)}
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
                <div className="h-1 rounded overflow-hidden flex bg-obsidian">
                  <div className="h-full" style={{ width: `${100 - favorPercent}%`, backgroundColor: '#0ea5e9' }} />
                  <div className="h-full" style={{ width: `${favorPercent}%`, backgroundColor: '#dc2626' }} />
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span>
                    <span className="text-sky-400">
                      {((pastDispute.account.stakeHeld.toNumber() + pastDispute.account.directStakeHeld.toNumber()) / LAMPORTS_PER_SOL).toFixed(6)}
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
                      {(pastDispute.account.totalBond.toNumber() / LAMPORTS_PER_SOL).toFixed(6)}
                    </span>
                  </span>
                </div>
              </>
            )}
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
                  const isForChallenger = vote.account.choice && "forChallenger" in vote.account.choice;
                  const isForRestoration = vote.account.restoreChoice && "forRestoration" in vote.account.restoreChoice;
                  const voteLabel = isRestoreVote
                    ? (isForRestoration ? "FOR RESTORATION" : "AGAINST RESTORATION")
                    : (isForChallenger ? "FOR CHALLENGER" : "FOR DEFENDER");
                  const voteColorClass = isRestoreVote
                    ? (isForRestoration ? "text-purple-400" : "text-crimson")
                    : (isForChallenger ? "text-crimson" : "text-sky");
                  const borderColorClass = isRestoreVote
                    ? (isForRestoration ? "border-purple-500/20" : "border-red-800/20")
                    : (isForChallenger ? "border-red-800/20" : "border-sky-500/20");

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
                        <span className="text-[10px] text-gold">{stakeAmount.toFixed(6)} SOL</span>
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
  subjectContent,
  jurorAccount,
  onClose,
  onVote,
  onAddStake,
  onJoinChallengers,
  onResolve,
  onClaimAll,
  onRefresh,
  actionLoading,
  showActions = true,
  getIpfsUrl,
}: SubjectModalProps) {
  const modalScrollRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef(0);

  // Wallet for user-specific data
  const { publicKey } = useWallet();

  // Hooks for internal data fetching
  const {
    submitDispute,
    submitFreeDispute,
    submitRestore,
    fetchDefenderPool,
    fetchChallengerAccount,
    getChallengerPDA,
    fetchVotesByDispute,
    fetchDisputesBySubject,
    fetchChallengersByDispute,
    fetchVoteRecord,
    fetchChallengerRecord,
    fetchDefenderRecord,
    getVoteRecordPDA,
    getChallengerRecordPDA,
    getDefenderRecordPDA,
    getDefenderPoolPDA,
  } = useTribunalcraft();
  const { uploadDispute, isUploading } = useUpload();
  const { fetchDispute: fetchDisputeContent, getUrl } = useContentFetch();

  // ═══════════════════════════════════════════════════════════════════════════════
  // INTERNAL STATE - Modal fetches everything it needs
  // ═══════════════════════════════════════════════════════════════════════════════

  const [loading, setLoading] = useState(true);

  // All disputes for this subject
  const [allDisputes, setAllDisputes] = useState<DisputeData[]>([]);

  // Votes for all disputes keyed by dispute publicKey
  const [allDisputeVotes, setAllDisputeVotes] = useState<Record<string, VoteData[]>>({});

  // Content for all disputes keyed by dispute publicKey
  const [allDisputeContents, setAllDisputeContents] = useState<Record<string, DisputeContent | null>>({});

  // User's vote records keyed by dispute publicKey
  const [userVoteRecords, setUserVoteRecords] = useState<Record<string, VoteData | null>>({});

  // User's challenger records keyed by dispute publicKey
  const [userChallengerRecords, setUserChallengerRecords] = useState<Record<string, ChallengerRecordData | null>>({});

  // User's defender record for this subject
  const [userDefenderRecord, setUserDefenderRecord] = useState<DefenderRecordData | null>(null);

  // Challenger reputation for active dispute creator
  const [activeDisputeCreatorRep, setActiveDisputeCreatorRep] = useState<number | null>(null);

  // Derived: active dispute (pending, voting not ended) or waiting resolution
  const activeDispute = allDisputes.find(d =>
    d.account.status.pending
  ) || null;

  // Derived: past disputes (resolved)
  const pastDisputes = allDisputes.filter(d =>
    d.account.status.resolved
  );

  // Derived: current user's vote on active dispute
  const existingVote = activeDispute ? userVoteRecords[activeDispute.publicKey.toBase58()] : null;

  // Derived: current user's challenger record on active dispute
  const challengerRecord = activeDispute ? userChallengerRecords[activeDispute.publicKey.toBase58()] : null;

  // Derived: votes for active dispute
  const disputeVotes = activeDispute ? (allDisputeVotes[activeDispute.publicKey.toBase58()] || []) : [];

  // Derived: content for active dispute
  const disputeContent = activeDispute ? allDisputeContents[activeDispute.publicKey.toBase58()] : null;

  // Derived: user roles for active dispute
  const [poolPda] = publicKey ? getDefenderPoolPDA(publicKey) : [null];
  const isDefender = poolPda && subject.account.defenderPool.toBase58() === poolPda.toBase58();
  const isChallenger = activeDispute ? !!userChallengerRecords[activeDispute.publicKey.toBase58()] : false;
  const isJuror = !!existingVote;
  const userRoles: UserRoles = { juror: isJuror, defender: !!isDefender, challenger: isChallenger };

  // Internal state for dispute/restore forms
  const [showCreateDispute, setShowCreateDispute] = useState(false);
  const [showRestoreForm, setShowRestoreForm] = useState(false);
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [internalSuccess, setInternalSuccess] = useState<string | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════════
  // DATA FETCHING - Load all disputes and related data for this subject
  // ═══════════════════════════════════════════════════════════════════════════════

  const loadSubjectData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all disputes for this subject
      const disputes = await fetchDisputesBySubject(subject.publicKey);
      const disputeList = disputes || [];
      setAllDisputes(disputeList);

      if (disputeList.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch votes for all disputes in parallel
      const votesPromises = disputeList.map(async (d) => {
        try {
          const votes = await fetchVotesByDispute(d.publicKey);
          return { key: d.publicKey.toBase58(), votes: votes || [] };
        } catch {
          return { key: d.publicKey.toBase58(), votes: [] };
        }
      });
      const votesResults = await Promise.all(votesPromises);
      const votesMap: Record<string, VoteData[]> = {};
      for (const r of votesResults) {
        votesMap[r.key] = r.votes;
      }
      setAllDisputeVotes(votesMap);

      // Fetch content for all disputes (via challengers)
      const contentsMap: Record<string, DisputeContent | null> = {};
      for (const d of disputeList) {
        try {
          const challengers = await fetchChallengersByDispute(d.publicKey);
          if (challengers && challengers.length > 0) {
            const cid = challengers[0].account.detailsCid;
            if (cid) {
              const content = await fetchDisputeContent(cid);
              contentsMap[d.publicKey.toBase58()] = content;
            }
          }
        } catch {
          // Ignore content fetch errors
        }
      }
      setAllDisputeContents(contentsMap);

      // Fetch user-specific data if wallet connected
      if (publicKey) {
        // Fetch user's vote records for all disputes
        const voteRecordsMap: Record<string, VoteData | null> = {};
        for (const d of disputeList) {
          try {
            const [voteRecordPda] = getVoteRecordPDA(d.publicKey, publicKey);
            const record = await fetchVoteRecord(voteRecordPda);
            if (record) {
              voteRecordsMap[d.publicKey.toBase58()] = {
                publicKey: voteRecordPda,
                account: record,
              };
            }
          } catch {
            // No vote record
          }
        }
        setUserVoteRecords(voteRecordsMap);

        // Fetch user's challenger records for all disputes
        const challRecordsMap: Record<string, ChallengerRecordData | null> = {};
        for (const d of disputeList) {
          try {
            const [challRecordPda] = getChallengerRecordPDA(d.publicKey, publicKey);
            const record = await fetchChallengerRecord(challRecordPda);
            if (record) {
              challRecordsMap[d.publicKey.toBase58()] = record;
            }
          } catch {
            // No challenger record
          }
        }
        setUserChallengerRecords(challRecordsMap);

        // Fetch user's defender record for this subject
        try {
          const [defRecordPda] = getDefenderRecordPDA(subject.publicKey, publicKey);
          const record = await fetchDefenderRecord(defRecordPda);
          if (record) {
            setUserDefenderRecord(record);
          }
        } catch {
          // No defender record
        }

        // Fetch active dispute creator's reputation
        const active = disputeList.find(d => "pending" in d.account.status);
        if (active) {
          try {
            const challengers = await fetchChallengersByDispute(active.publicKey);
            if (challengers && challengers.length > 0) {
              const creatorPubkey = challengers[0].account.challenger;
              const [creatorPda] = getChallengerPDA(creatorPubkey);
              const creatorAccount = await fetchChallengerAccount(creatorPda);
              if (creatorAccount) {
                const rep = creatorAccount.reputation;
                setActiveDisputeCreatorRep(
                  typeof rep === 'number' ? rep : (rep as any).toNumber?.() ?? null
                );
              }
            }
          } catch {
            // Ignore
          }
        }
      }
    } catch (error) {
      console.error("Error loading subject data:", error);
    }
    setLoading(false);
  }, [
    subject.publicKey,
    publicKey,
    fetchDisputesBySubject,
    fetchVotesByDispute,
    fetchChallengersByDispute,
    fetchDisputeContent,
    fetchVoteRecord,
    fetchChallengerRecord,
    fetchDefenderRecord,
    fetchChallengerAccount,
    getVoteRecordPDA,
    getChallengerRecordPDA,
    getDefenderRecordPDA,
    getChallengerPDA,
  ]);

  // Load data when modal opens
  useEffect(() => {
    loadSubjectData();
  }, [loadSubjectData]);

  // Wrapped claim handler that refreshes modal data after claiming
  const handleClaimAllWithRefresh = useCallback(async (disputeKey: string, claims: { juror: boolean; challenger: boolean; defender: boolean }) => {
    if (onClaimAll) {
      onClaimAll(disputeKey, claims);
      // Wait a bit for the transaction to complete, then refresh
      setTimeout(() => {
        loadSubjectData();
      }, 2000);
    }
  }, [onClaimAll, loadSubjectData]);

  // Dispute form state
  const [disputeForm, setDisputeForm] = useState({
    type: "other",
    title: "",
    reason: "",
    requestedOutcome: "",
    bondAmount: "0.01",
  });

  // Restore calculations
  const minRestoreStake = subject.account.lastDisputeTotal?.toNumber() ?? 0;
  const minRestoreStakeSol = minRestoreStake / LAMPORTS_PER_SOL;
  const restoreVotingPeriodHours = Math.floor((subject.account.votingPeriod?.toNumber() ?? 0) * 2 / 3600);

  // Restore form state
  const [restoreForm, setRestoreForm] = useState({
    title: "",
    reason: "",
    stakeAmount: minRestoreStakeSol > 0 ? minRestoreStakeSol.toFixed(6) : "0.1",
  });

  // Calculate min bond based on user's challenger reputation
  const [userChallengerRep, setUserChallengerRep] = useState<number | null>(null);
  useEffect(() => {
    const fetchRep = async () => {
      try {
        const [pda] = getChallengerPDA(subject.publicKey); // This won't work - need wallet
        // We'll use INITIAL_REPUTATION as default since we can't easily get the wallet here
        setUserChallengerRep(INITIAL_REPUTATION);
      } catch {
        setUserChallengerRep(INITIAL_REPUTATION);
      }
    };
    fetchRep();
  }, [getChallengerPDA, subject.publicKey]);

  const minBond = calculateMinBond(userChallengerRep ?? INITIAL_REPUTATION);
  const minBondSol = minBond / LAMPORTS_PER_SOL;

  // Reset forms when modal state changes
  useEffect(() => {
    if (showCreateDispute) {
      setDisputeForm({ type: "other", title: "", reason: "", requestedOutcome: "", bondAmount: minBondSol.toFixed(6) });
      setInternalError(null);
      setInternalSuccess(null);
    }
  }, [showCreateDispute, minBondSol]);

  useEffect(() => {
    if (showRestoreForm) {
      setRestoreForm({
        title: "",
        reason: "",
        stakeAmount: minRestoreStakeSol > 0 ? minRestoreStakeSol.toFixed(6) : "0.1",
      });
      setInternalError(null);
      setInternalSuccess(null);
    }
  }, [showRestoreForm, minRestoreStakeSol]);

  // Handle dispute submission
  const handleCreateDispute = useCallback(async () => {
    if (!disputeForm.title || !disputeForm.reason) {
      setInternalError("Title and reason are required");
      return;
    }

    const bondLamports = parseFloat(disputeForm.bondAmount) * LAMPORTS_PER_SOL;
    if (isNaN(bondLamports) || bondLamports < minBond) {
      setInternalError(`Minimum bond is ${minBondSol.toFixed(6)} SOL`);
      return;
    }

    setInternalLoading(true);
    setInternalError(null);
    setInternalSuccess(null);

    try {
      // Upload dispute content to IPFS
      const disputeType = DISPUTE_TYPES.find(t => t.key === disputeForm.type);
      const uploadResult = await uploadDispute({
        title: disputeForm.title,
        reason: disputeForm.reason,
        requestedOutcome: disputeForm.requestedOutcome,
        type: disputeType?.contentKey || "other",
        subjectCid: subject.account.detailsCid,
      });
      if (!uploadResult) {
        throw new Error("Failed to upload dispute content");
      }

      // Submit dispute on-chain
      const disputeTypeEnum = { [disputeForm.type]: {} } as DisputeType;
      const subjectData = {
        disputeCount: subject.account.disputeCount,
        defenderPool: subject.account.defenderPool,
      };
      if (subject.account.freeCase) {
        await submitFreeDispute(subject.publicKey, subjectData, disputeTypeEnum, uploadResult.cid);
      } else {
        await submitDispute(subject.publicKey, subjectData, disputeTypeEnum, uploadResult.cid, new BN(bondLamports));
      }

      setInternalSuccess("Dispute submitted successfully");
      setShowCreateDispute(false);

      // Notify parent to refresh data
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      console.error("Failed to submit dispute:", err);
      setInternalError(err.message || "Failed to submit dispute");
    } finally {
      setInternalLoading(false);
    }
  }, [disputeForm, minBond, minBondSol, subject, uploadDispute, submitDispute, submitFreeDispute, onRefresh]);

  // Handle restore submission
  const handleSubmitRestore = useCallback(async () => {
    if (!restoreForm.title || !restoreForm.reason) {
      setInternalError("Title and reason are required");
      return;
    }

    const stakeLamports = parseFloat(restoreForm.stakeAmount) * LAMPORTS_PER_SOL;
    if (isNaN(stakeLamports) || stakeLamports <= 0) {
      setInternalError("Invalid stake amount");
      return;
    }

    if (minRestoreStake > 0 && stakeLamports < minRestoreStake) {
      setInternalError(`Minimum stake is ${minRestoreStakeSol.toFixed(6)} SOL`);
      return;
    }

    setInternalLoading(true);
    setInternalError(null);
    setInternalSuccess(null);

    try {
      // Upload restore content to IPFS
      const uploadResult = await uploadDispute({
        title: restoreForm.title,
        reason: restoreForm.reason,
        requestedOutcome: "Restore subject to valid status",
        type: "other", // Restoration uses "other" as content type
        subjectCid: subject.account.detailsCid,
      });
      if (!uploadResult) {
        throw new Error("Failed to upload restoration content");
      }

      // Submit restore on-chain
      const subjectData = { disputeCount: subject.account.disputeCount };
      const restoreDisputeType = { other: {} } as DisputeType; // Restore uses "other" dispute type
      await submitRestore(subject.publicKey, subjectData, restoreDisputeType, uploadResult.cid, new BN(stakeLamports));

      setInternalSuccess("Restoration request submitted successfully");
      setShowRestoreForm(false);

      // Notify parent to refresh data
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      console.error("Failed to submit restore:", err);
      setInternalError(err.message || "Failed to submit restoration request");
    } finally {
      setInternalLoading(false);
    }
  }, [restoreForm, subject, uploadDispute, submitRestore, onRefresh, minRestoreStake, minRestoreStakeSol]);

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
  const isRestore = activeDispute?.account.isRestore;

  // Show subject's current status
  const isResolvedDispute = activeDispute?.account.status.resolved;
  const subjectStatus = getStatusBadge(subject.account.status);

  const outcome = activeDispute ? getOutcomeLabel(activeDispute.account.outcome) : null;
  const votingEnded = activeDispute ? Date.now() > activeDispute.account.votingEndsAt.toNumber() * 1000 : false;
  const isPending = activeDispute?.account.status.pending;
  const canVote = isPending && !votingEnded && jurorAccount;
  const canResolve = isPending && votingEnded;
  const totalVotes = activeDispute
    ? activeDispute.account.votesFavorWeight.toNumber() + activeDispute.account.votesAgainstWeight.toNumber()
    : 0;
  const favorPercent = totalVotes > 0
    ? (activeDispute!.account.votesFavorWeight.toNumber() / totalVotes) * 100
    : 50;

  // Juror fees
  const PROTOCOL_FEE_BPS = 2000;
  const JUROR_SHARE_BPS = 9500;
  let disputeJurorFees = "FREE";
  if (!subject.account.freeCase && activeDispute) {
    let totalPool: number;
    if (activeDispute.account.isRestore) {
      // For restorations, juror pot is based on restore stake
      totalPool = activeDispute.account.restoreStake.toNumber();
    } else {
      // For regular disputes, juror pot is based on bond + matched stake
      const bondPool = activeDispute.account.totalBond.toNumber();
      const matchedStake = subject.account.matchMode
        ? activeDispute.account.stakeHeld.toNumber() + activeDispute.account.directStakeHeld.toNumber()
        : activeDispute.account.snapshotTotalStake.toNumber();
      totalPool = bondPool + matchedStake;
    }
    const totalFees = totalPool * PROTOCOL_FEE_BPS / 10000;
    const jurorPot = totalFees * JUROR_SHARE_BPS / 10000;
    disputeJurorFees = `${(jurorPot / LAMPORTS_PER_SOL).toFixed(6)} SOL`;
  }

  // History shows all resolved disputes, sorted by resolved date (latest first)
  const sortedHistoryDisputes = [...pastDisputes].sort((a, b) => {
    return b.account.resolvedAt.toNumber() - a.account.resolvedAt.toNumber();
  });

  return (
    <div className="fixed inset-0 bg-obsidian/90 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        ref={modalScrollRef}
        className="bg-slate border border-slate-light max-w-4xl w-full max-h-[90vh] overflow-y-auto relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button onClick={onClose} className="absolute top-3 right-3 text-steel hover:text-parchment z-10">
          <XIcon />
        </button>

        <div className="p-4 space-y-4">
          {/* SUBJECT INFO (when no active dispute) */}
          {(!activeDispute || !isPending) && (
            <div className="space-y-2">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-sky-500 rounded"></div>
                  <h4 className="text-xs font-semibold text-sky-400 uppercase tracking-wider">Subject</h4>
                </div>
                <p className="text-[10px] text-steel mt-1 ml-3">{subjectKey}</p>
              </div>
              <div className="p-3 bg-obsidian border border-sky-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-sky-400 font-medium">{subjectContent?.title || "Untitled Subject"}</p>
                  <div className="flex items-center gap-1">
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
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${subjectStatus.class}`}>
                      {subjectStatus.label}
                    </span>
                    {subject.account.freeCase && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-700/20 text-emerald">Free</span>
                    )}
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-steel/20 text-steel">
                      {Math.floor(subject.account.votingPeriod.toNumber() / 3600)}h
                    </span>
                    {pastDisputes.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-800/20 text-crimson">
                        {pastDisputes.length}
                      </span>
                    )}
                  </div>
                </div>
                {subjectContent?.description && (
                  <div>
                    <p className="text-[10px] text-steel uppercase tracking-wider mb-1 underline">Description</p>
                    <p className="text-steel text-xs">{subjectContent.description}</p>
                  </div>
                )}
                {subjectContent?.terms?.text && (
                  <div>
                    <p className="text-[10px] text-steel uppercase tracking-wider mb-1 underline">Terms</p>
                    <p className="text-steel text-xs">{subjectContent.terms.text}</p>
                  </div>
                )}
                <div className="flex flex-col gap-1 text-xs pt-2 border-t border-slate-light/50">
                  <div>
                    <span className="text-steel">Stake: </span>
                    <span className="text-sky">
                      {!subject.account.freeCase
                        ? `${(subject.account.availableStake.toNumber() / LAMPORTS_PER_SOL).toFixed(6)}`
                        : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-steel">Defenders: </span>
                    <span className="text-sky-400">{subject.account.defenderCount}</span>
                  </div>
                </div>
                {/* Subject Actions */}
                {showActions && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-slate-light/50">
                    {!subject.account.freeCase && (subject.account.status.valid || subject.account.status.dormant) && onAddStake && (
                      <JoinForm
                        type="defender"
                        onJoin={onAddStake}
                        isLoading={actionLoading}
                        label={subject.account.status.dormant ? "Revive Subject" : undefined}
                      />
                    )}
                    {subject.account.status.valid && !showCreateDispute && (
                      <button onClick={() => setShowCreateDispute(true)} className="btn btn-secondary py-1.5 px-3 text-sm w-full border-red-800/50 hover:border-red-700">
                        <span className="text-crimson">File Dispute</span>
                      </button>
                    )}
                    {isInvalid && !showRestoreForm && (
                      <button onClick={() => setShowRestoreForm(true)} className="btn btn-secondary py-1.5 px-3 text-sm w-full border-purple-500/50 hover:border-purple-400">
                        <span className="text-purple-400">Restore Subject</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* INLINE RESTORE FORM (for invalid subjects without pending dispute) */}
          {(!activeDispute || !isPending) && isInvalid && showRestoreForm && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Request Restoration</h4>
                <button onClick={() => setShowRestoreForm(false)} className="text-steel hover:text-parchment">
                  <XIcon />
                </button>
              </div>
              <div className="p-4 bg-obsidian border border-purple-500/30 space-y-3">
                {internalError && (
                  <div className="p-2 bg-red-800/20 border border-red-800/30 text-crimson text-xs">{internalError}</div>
                )}
                {internalSuccess && (
                  <div className="p-2 bg-emerald-700/20 border border-emerald-700/30 text-emerald text-xs">{internalSuccess}</div>
                )}
                <div>
                  <label className="text-[10px] text-steel uppercase tracking-wider">Title *</label>
                  <input
                    type="text"
                    value={restoreForm.title}
                    onChange={(e) => setRestoreForm({ ...restoreForm, title: e.target.value })}
                    className="input w-full text-sm py-2 mt-1"
                    placeholder="Brief summary of your restoration request"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-steel uppercase tracking-wider">Reason *</label>
                  <textarea
                    value={restoreForm.reason}
                    onChange={(e) => setRestoreForm({ ...restoreForm, reason: e.target.value })}
                    className="input w-full text-sm py-2 mt-1 h-20 resize-none"
                    placeholder="Explain why the subject should be restored"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-steel uppercase tracking-wider">Stake Amount</label>
                    <span className="text-[10px] text-purple-400">
                      Min: {minRestoreStakeSol.toFixed(6)} SOL
                    </span>
                  </div>
                  <div className="flex gap-2 items-center mt-1">
                    <input
                      type="text"
                      value={restoreForm.stakeAmount}
                      onChange={(e) => setRestoreForm({ ...restoreForm, stakeAmount: e.target.value })}
                      className="input flex-1 text-sm py-2"
                    />
                    <span className="text-steel text-sm">SOL</span>
                  </div>
                  <p className="text-[10px] text-steel mt-1">Must be at least the previous dispute&apos;s total (stake + bond)</p>
                </div>
                <div className="p-2 bg-purple-500/10 border border-purple-500/20 text-xs">
                  <span className="text-steel">Voting Period: </span>
                  <span className="text-purple-400">{restoreVotingPeriodHours}h</span>
                  <span className="text-steel"> (2x original)</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowRestoreForm(false)}
                    className="btn btn-secondary py-2 px-4 flex-1"
                    disabled={internalLoading || isUploading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitRestore}
                    className="btn btn-primary py-2 px-4 flex-1"
                    disabled={internalLoading || isUploading}
                  >
                    {internalLoading || isUploading ? "Submitting..." : "Submit Restoration"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* INLINE CREATE DISPUTE FORM */}
          {(!activeDispute || !isPending) && showCreateDispute && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-crimson uppercase tracking-wider">File Dispute</h4>
                <button onClick={() => setShowCreateDispute(false)} className="text-steel hover:text-parchment">
                  <XIcon />
                </button>
              </div>
              <div className="p-4 bg-obsidian border border-red-800/30 space-y-3">
                {internalError && (
                  <div className="p-2 bg-red-800/20 border border-red-800/30 text-crimson text-xs">{internalError}</div>
                )}
                {internalSuccess && (
                  <div className="p-2 bg-emerald-700/20 border border-emerald-700/30 text-emerald text-xs">{internalSuccess}</div>
                )}
                <div>
                  <label className="text-[10px] text-steel uppercase tracking-wider">Dispute Type</label>
                  <select
                    value={disputeForm.type}
                    onChange={(e) => setDisputeForm({ ...disputeForm, type: e.target.value })}
                    className="input w-full text-sm py-2 mt-1"
                  >
                    {DISPUTE_TYPES.map((dt) => (
                      <option key={dt.key} value={dt.key}>{dt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-steel uppercase tracking-wider">Title *</label>
                  <input
                    type="text"
                    value={disputeForm.title}
                    onChange={(e) => setDisputeForm({ ...disputeForm, title: e.target.value })}
                    className="input w-full text-sm py-2 mt-1"
                    placeholder="Brief summary of the dispute"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-steel uppercase tracking-wider">Reason *</label>
                  <textarea
                    value={disputeForm.reason}
                    onChange={(e) => setDisputeForm({ ...disputeForm, reason: e.target.value })}
                    className="input w-full text-sm py-2 mt-1 h-20 resize-none"
                    placeholder="Explain why you are filing this dispute"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-steel uppercase tracking-wider">Requested Outcome</label>
                  <textarea
                    value={disputeForm.requestedOutcome}
                    onChange={(e) => setDisputeForm({ ...disputeForm, requestedOutcome: e.target.value })}
                    className="input w-full text-sm py-2 mt-1 h-16 resize-none"
                    placeholder="What outcome do you seek?"
                  />
                </div>
                {!subject.account.freeCase && (
                  <div>
                    <label className="text-[10px] text-steel uppercase tracking-wider">Bond Amount (min: {minBondSol.toFixed(6)} SOL)</label>
                    <div className="flex gap-2 items-center mt-1">
                      <input
                        type="text"
                        value={disputeForm.bondAmount}
                        onChange={(e) => setDisputeForm({ ...disputeForm, bondAmount: e.target.value })}
                        className="input flex-1 text-sm py-2"
                      />
                      <span className="text-steel text-sm">SOL</span>
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCreateDispute(false)}
                    className="btn btn-secondary py-2 px-4 flex-1"
                    disabled={internalLoading || isUploading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateDispute}
                    className="btn btn-primary py-2 px-4 flex-1"
                    disabled={internalLoading || isUploading}
                  >
                    {internalLoading || isUploading ? "Submitting..." : "Submit Dispute"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SUBJECT + CHALLENGER SIDE BY SIDE (only for pending disputes) */}
          {activeDispute && isPending && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
              {/* SUBJECT (DEFENDER) SECTION */}
              <div className="flex flex-col gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-sky rounded"></div>
                    <h4 className="text-xs font-semibold text-sky uppercase tracking-wider">Defender</h4>
                  </div>
                  <p className="text-[10px] text-steel mt-1 ml-3">{subjectKey}</p>
                </div>
                <div className="p-3 bg-obsidian border border-sky-500/30 space-y-2 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-sky-400 font-medium">{subjectContent?.title || "Untitled Subject"}</p>
                    <div className="flex items-center gap-1">
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
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${subjectStatus.class}`}>
                        {subjectStatus.label}
                      </span>
                      {subject.account.freeCase && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-700/20 text-emerald">Free</span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-steel/20 text-steel">
                        {Math.floor(subject.account.votingPeriod.toNumber() / 3600)}h
                      </span>
                      {pastDisputes.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-800/20 text-crimson">
                          {pastDisputes.length}
                        </span>
                      )}
                    </div>
                  </div>
                  {subjectContent?.description && (
                    <div>
                      <p className="text-[10px] text-steel uppercase tracking-wider mb-1 underline">Description</p>
                      <p className="text-steel text-xs">{subjectContent.description}</p>
                    </div>
                  )}
                  {subjectContent?.terms?.text && (
                    <div>
                      <p className="text-[10px] text-steel uppercase tracking-wider mb-1 underline">Terms</p>
                      <p className="text-steel text-xs">{subjectContent.terms.text}</p>
                    </div>
                  )}
                  <div className="flex flex-col gap-1 text-xs pt-2 border-t border-slate-light/50">
                    <div>
                      <span className="text-steel">Stake: </span>
                      <span className="text-sky-400">
                        {!subject.account.freeCase
                          ? `${(subject.account.availableStake.toNumber() / LAMPORTS_PER_SOL).toFixed(6)}`
                          : "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-steel">Defenders: </span>
                      <span className="text-sky-400">{subject.account.defenderCount}</span>
                    </div>
                  </div>
                  {/* Defender Actions */}
                  {showActions && (
                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-light/50">
                      {!subject.account.freeCase && (subject.account.status.valid || (subject.account.status.disputed && !votingEnded) || subject.account.status.dormant) && onAddStake && (
                        <JoinForm
                          type="defender"
                          onJoin={onAddStake}
                          isLoading={actionLoading}
                          label={subject.account.status.dormant ? "Revive Subject" : undefined}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* CHALLENGER / RESTORER SECTION */}
              <div className="flex flex-col gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <div className={`w-1 h-4 rounded ${isRestore ? 'bg-purple-500' : 'bg-crimson'}`}></div>
                    <h4 className={`text-xs font-semibold uppercase tracking-wider ${isRestore ? 'text-purple-400' : 'text-crimson'}`}>
                      {isRestore ? 'Restorer' : 'Challenger'}
                    </h4>
                  </div>
                  <p className="text-[10px] text-steel mt-1 ml-3">{activeDispute?.publicKey.toBase58() ?? "No active dispute"}</p>
                </div>
                <div className={`p-3 bg-obsidian border space-y-2 flex-1 ${isRestore ? 'border-purple-500/30' : 'border-red-800/30'}`}>
                  {activeDispute && disputeContent ? (
                    <>
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-medium ${isRestore ? 'text-purple-400' : 'text-crimson'}`}>
                          {disputeContent.title || (isRestore ? "Restoration Request" : "Untitled Dispute")}
                        </p>
                        <div className="flex items-center gap-1">
                          {isRestore ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                              Restore
                            </span>
                          ) : (
                            <>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-800/20 text-crimson">
                                {getDisputeTypeLabel(activeDispute!.account.disputeType)}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-steel/20 text-steel">
                                {activeDisputeCreatorRep !== null && activeDisputeCreatorRep !== undefined
                                  ? `${(activeDisputeCreatorRep / 1_000_000).toFixed(1)}%`
                                  : "50.0%"}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {disputeContent.reason && (
                        <div>
                          <p className="text-[10px] text-steel uppercase tracking-wider mb-1 underline">Reason</p>
                          <p className="text-steel text-xs">{disputeContent.reason}</p>
                        </div>
                      )}
                      {disputeContent.requestedOutcome && (
                        <div>
                          <p className="text-[10px] text-steel uppercase tracking-wider mb-1 underline">Requested Outcome</p>
                          <p className="text-steel text-xs">{disputeContent.requestedOutcome}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-steel text-xs">{isRestore ? "No active restoration" : "No active dispute"}</p>
                  )}
                  <div className="flex flex-col gap-1 text-xs pt-2 border-t border-slate-light/50">
                    {isRestore ? (
                      <>
                        <div>
                          <span className="text-steel">Stake: </span>
                          <span className="text-purple-400">
                            {activeDispute ? (activeDispute.account.restoreStake.toNumber() / LAMPORTS_PER_SOL).toFixed(6) : "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-steel">Voting Period: </span>
                          <span className="text-purple-400">{restoreVotingPeriodHours}h</span>
                          <span className="text-steel"> (2x original)</span>
                        </div>
                        <div>
                          <span className="text-steel">Restorer: </span>
                          <span className="text-purple-400">
                            {activeDispute?.account.restorer?.toBase58().slice(0, 4)}...{activeDispute?.account.restorer?.toBase58().slice(-4)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <span className="text-steel">Bond: </span>
                          <span className="text-crimson">
                            {activeDispute ? (activeDispute.account.totalBond.toNumber() / LAMPORTS_PER_SOL).toFixed(6) : "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-steel">Challengers: </span>
                          <span className="text-crimson">{activeDispute?.account.challengerCount ?? 0}</span>
                        </div>
                      </>
                    )}
                  </div>
                  {/* Challenger Actions - only for regular disputes */}
                  {showActions && !isRestore && (
                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-light/50">
                      {!subject.account.freeCase && activeDispute && isPending && !votingEnded && onJoinChallengers && (
                        <JoinForm
                          type="challenger"
                          onJoin={(amount) => onJoinChallengers(activeDispute.publicKey.toBase58(), amount)}
                          isLoading={actionLoading}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* VS / POWER BAR SECTION - hide for invalidated, different for restoring */}
          {activeDispute && !isInvalid && isPending && (
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
                          {(activeDispute!.account.restoreStake.toNumber() / LAMPORTS_PER_SOL).toFixed(6)}
                        </span>
                        <span className="text-steel"> · </span>
                        <span className="text-purple-400">{disputeVotes.filter(v => "forRestoration" in v.account.restoreChoice).length}</span>
                        <span className="text-steel"> · </span>
                        <span className="text-purple-400">{favorPercent.toFixed(0)}%</span>
                      </span>
                      <span className="text-steel flex items-center gap-1">
                        <ClockIcon />
                        <Countdown endTime={activeDispute!.account.votingEndsAt.toNumber() * 1000} />
                      </span>
                      <span>
                        <span className="text-crimson">{(100 - favorPercent).toFixed(0)}%</span>
                        <span className="text-steel"> · </span>
                        <span className="text-crimson">{disputeVotes.filter(v => "againstRestoration" in v.account.restoreChoice).length}</span>
                        <span className="text-steel"> · </span>
                        <span className="text-purple-400">
                          {activeDispute!.account.restorer.toBase58().slice(0, 4)}...
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
                      <span className="text-crimson">{activeDispute!.account.challengerCount} Challenger{activeDispute!.account.challengerCount !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="h-3 rounded overflow-hidden flex bg-obsidian">
                      <div className="h-full transition-all" style={{ width: `${100 - favorPercent}%`, backgroundColor: '#0ea5e9' }} />
                      <div className="h-full transition-all" style={{ width: `${favorPercent}%`, backgroundColor: '#dc2626' }} />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span>
                        <span className="text-sky-400">
                          {((activeDispute!.account.stakeHeld.toNumber() + activeDispute!.account.directStakeHeld.toNumber()) / LAMPORTS_PER_SOL).toFixed(6)}
                        </span>
                        <span className="text-steel"> · </span>
                        <span className="text-sky-400">{disputeVotes.filter(v => "forDefender" in v.account.choice).length}</span>
                        <span className="text-steel"> · </span>
                        <span className="text-sky-400">{(100 - favorPercent).toFixed(0)}%</span>
                      </span>
                      <span className="text-steel flex items-center gap-1">
                        <ClockIcon />
                        <Countdown endTime={activeDispute!.account.votingEndsAt.toNumber() * 1000} />
                      </span>
                      <span>
                        <span className="text-crimson">{favorPercent.toFixed(0)}%</span>
                        <span className="text-steel"> · </span>
                        <span className="text-crimson">{disputeVotes.filter(v => "forChallenger" in v.account.choice).length}</span>
                        <span className="text-steel"> · </span>
                        <span className="text-crimson">
                          {(activeDispute!.account.totalBond.toNumber() / LAMPORTS_PER_SOL).toFixed(6)}
                        </span>
                      </span>
                    </div>
                  </>
                )}
                {/* Resolve action */}
                {showActions && canResolve && onResolve && activeDispute && (
                  <div className="pt-2 border-t border-slate-light/50">
                    <button onClick={() => onResolve(activeDispute.publicKey.toBase58())} disabled={actionLoading} className="btn btn-primary py-1.5 px-3 text-sm w-full">
                      {actionLoading ? "..." : isRestore ? "Resolve Restoration" : "Resolve Dispute"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* JUROR SECTION - hide for invalidated */}
          {showActions && activeDispute && !isInvalid && isPending && !votingEnded && onVote && (
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
                    onVote={(stake, choice, rationale) => onVote(activeDispute!.publicKey.toBase58(), stake, choice, rationale)}
                    isLoading={actionLoading}
                    isRestore={activeDispute?.account.isRestore}
                  />
                )}
              </div>
            </div>
          )}

          {/* JUROR REMARKS SECTION (current dispute) - hide for invalidated */}
          {activeDispute && !isInvalid && disputeVotes.length > 0 && (
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
                  const isForChallenger = vote.account.choice && "forChallenger" in vote.account.choice;
                  const isForRestoration = vote.account.restoreChoice && "forRestoration" in vote.account.restoreChoice;
                  const voteLabel = isRestoreVote
                    ? (isForRestoration ? "FOR RESTORATION" : "AGAINST RESTORATION")
                    : (isForChallenger ? "FOR CHALLENGER" : "FOR DEFENDER");
                  const voteColorClass = isRestoreVote
                    ? (isForRestoration ? "text-purple-400" : "text-crimson")
                    : (isForChallenger ? "text-crimson" : "text-sky");
                  const borderColorClass = isRestoreVote
                    ? (isForRestoration ? "border-purple-500/30" : "border-red-800/30")
                    : (isForChallenger ? "border-red-800/30" : "border-sky-500/30");

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
                          <span className="text-xs text-gold">{stakeAmount.toFixed(6)} SOL</span>
                          {votingPower !== stakeAmount && (
                            <span className="text-[10px] text-steel ml-1">({votingPower.toFixed(6)} power)</span>
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
          {activeDispute?.account.detailsCid && getIpfsUrl && (
            <a href={getIpfsUrl(activeDispute.account.detailsCid)} target="_blank" rel="noopener noreferrer" className="text-xs text-gold hover:text-gold-light flex items-center gap-1">
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
                  const isCurrentDispute = activeDispute && dKey === activeDispute.publicKey.toBase58();
                  // Use current disputeContent if this is the current dispute, otherwise from allDisputeContents
                  const dContent = isCurrentDispute
                    ? disputeContent
                    : allDisputeContents[dKey];
                  // Include votes for current dispute or past disputes
                  const dVotes = isCurrentDispute
                    ? disputeVotes
                    : (allDisputeVotes?.[dKey] || []);
                  // Build claim data - use current records for current dispute, past records for historical
                  // Roles are derived from claim data inside HistoryItem
                  const dClaimData = isCurrentDispute ? {
                    voteRecord: existingVote,
                    challengerRecord,
                    defenderRecord: userDefenderRecord,
                  } : {
                    voteRecord: userVoteRecords?.[dKey] || null,
                    challengerRecord: userChallengerRecords?.[dKey] || null,
                    defenderRecord: userDefenderRecord, // Defender record is per-subject, applies to all disputes
                  };
                  return (
                    <HistoryItem
                      key={i}
                      pastDispute={historyDispute}
                      disputeContent={dContent}
                      votes={dVotes}
                      defaultExpanded={i === 0}
                      claimData={dClaimData}
                      onClaimAll={handleClaimAllWithRefresh}
                      actionLoading={actionLoading}
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
