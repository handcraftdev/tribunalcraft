"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { Navigation } from "@/components/Navigation";
import { SubjectModal, SubjectData } from "@/components/subject";
import { useTribunalcraft } from "@/hooks/useTribunalcraft";
import { useContentFetch } from "@/hooks/useUpload";
import { ArrowLeftIcon } from "@/components/Icons";
import { pda, type SubjectContent } from "@tribunalcraft/sdk";

export default function SubjectPage() {
  const params = useParams();
  const router = useRouter();
  const { publicKey } = useWallet();
  const subjectId = params.subjectId as string;

  const {
    fetchSubjectById,
    fetchDefenderPoolByOwner,
    fetchJurorPoolByOwner,
    voteOnDispute,
    voteOnRestore,
    addBondDirect,
    addBondFromPool,
    joinChallengers,
    resolveDispute,
    claimJuror,
    claimChallenger,
    claimDefender,
    closeJurorRecord,
    closeChallengerRecord,
    closeDefenderRecord,
  } = useTribunalcraft();
  const { fetchSubject: fetchSubjectContent, getUrl } = useContentFetch();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState<SubjectData | null>(null);
  const [subjectContent, setSubjectContent] = useState<SubjectContent | null>(null);
  const [jurorPool, setJurorPool] = useState<any>(null);
  const [creatorPoolBacking, setCreatorPoolBacking] = useState<number | undefined>();
  const [userPoolBacking, setUserPoolBacking] = useState<number | undefined>();
  const [actionLoading, setActionLoading] = useState(false);

  // Load subject data
  const loadSubject = useCallback(async () => {
    if (!subjectId) return;

    setLoading(true);
    setError(null);

    try {
      const subjectIdPubkey = new PublicKey(subjectId);
      const subjectAccount = await fetchSubjectById(subjectIdPubkey);

      if (!subjectAccount) {
        setError("Subject not found");
        setLoading(false);
        return;
      }

      // Construct SubjectData with publicKey and account
      const [subjectPda] = pda.subject(subjectIdPubkey);
      const subjectData: SubjectData = {
        publicKey: subjectPda,
        account: subjectAccount as SubjectData["account"],
      };
      setSubject(subjectData);

      // Fetch subject content from IPFS
      try {
        const content = await fetchSubjectContent(subjectAccount.detailsCid);
        setSubjectContent(content);
      } catch (e) {
        console.warn("Failed to fetch subject content:", e);
      }

      // Fetch creator's defender pool for backing info
      try {
        const creatorPool = await fetchDefenderPoolByOwner(subjectAccount.creator);
        if (creatorPool) {
          const balance = creatorPool.balance?.toNumber() ?? 0;
          try {
            const maxBond = creatorPool.maxBond?.toNumber() ?? 0;
            setCreatorPoolBacking(maxBond > 0 ? Math.min(balance, maxBond) : balance);
          } catch {
            setCreatorPoolBacking(balance);
          }
        }
      } catch (e) {
        console.warn("Failed to fetch creator pool:", e);
      }

      // Fetch user's juror pool
      if (publicKey) {
        try {
          const userJurorPool = await fetchJurorPoolByOwner(publicKey);
          setJurorPool(userJurorPool);
        } catch (e) {
          console.warn("Failed to fetch juror pool:", e);
        }

        // Fetch user's defender pool for backing
        try {
          const userDefenderPool = await fetchDefenderPoolByOwner(publicKey);
          if (userDefenderPool) {
            const balance = userDefenderPool.balance?.toNumber() ?? 0;
            try {
              const maxBond = userDefenderPool.maxBond?.toNumber() ?? 0;
              setUserPoolBacking(maxBond > 0 ? Math.min(balance, maxBond) : balance);
            } catch {
              setUserPoolBacking(balance);
            }
          }
        } catch (e) {
          console.warn("Failed to fetch user defender pool:", e);
        }
      }
    } catch (e: any) {
      console.error("Failed to load subject:", e);
      setError(e.message || "Failed to load subject");
    } finally {
      setLoading(false);
    }
  }, [subjectId, publicKey, fetchSubjectById, fetchSubjectContent, fetchDefenderPoolByOwner, fetchJurorPoolByOwner]);

  useEffect(() => {
    loadSubject();
  }, [loadSubject]);

  // Handler functions
  const handleVote = useCallback(async (
    subjectIdStr: string,
    round: number,
    stake: string,
    choice: "forChallenger" | "forDefender" | "forRestoration" | "againstRestoration",
    rationale: string
  ) => {
    setActionLoading(true);
    try {
      const subjectPubkey = new PublicKey(subjectIdStr);
      const stakeBN = new (await import("@coral-xyz/anchor")).BN(parseFloat(stake) * 1e9);

      if (choice === "forRestoration" || choice === "againstRestoration") {
        const restoreChoice = choice === "forRestoration" ? { forRestoration: {} } : { againstRestoration: {} };
        await voteOnRestore(subjectPubkey, restoreChoice, stakeBN, rationale, round);
      } else {
        const disputeChoice = choice === "forChallenger" ? { forChallenger: {} } : { forDefender: {} };
        await voteOnDispute(subjectPubkey, disputeChoice, stakeBN, rationale, round);
      }
      await loadSubject();
    } finally {
      setActionLoading(false);
    }
  }, [voteOnDispute, voteOnRestore, loadSubject]);

  const handleAddBond = useCallback(async (subjectIdStr: string, amount: string, fromPool: boolean) => {
    setActionLoading(true);
    try {
      const subjectPubkey = new PublicKey(subjectIdStr);
      const amountBN = new (await import("@coral-xyz/anchor")).BN(parseFloat(amount) * 1e9);

      if (fromPool) {
        await addBondFromPool(subjectPubkey, amountBN);
      } else {
        await addBondDirect(subjectPubkey, amountBN);
      }
      await loadSubject();
    } finally {
      setActionLoading(false);
    }
  }, [addBondDirect, addBondFromPool, loadSubject]);

  const handleJoinChallengers = useCallback(async (subjectIdStr: string, amount: string, detailsCid: string) => {
    setActionLoading(true);
    try {
      const subjectPubkey = new PublicKey(subjectIdStr);
      const amountBN = new (await import("@coral-xyz/anchor")).BN(parseFloat(amount) * 1e9);

      await joinChallengers({ subjectId: subjectPubkey, stake: amountBN, detailsCid });
      await loadSubject();
    } finally {
      setActionLoading(false);
    }
  }, [joinChallengers, loadSubject]);

  const handleResolve = useCallback(async (subjectIdStr: string) => {
    setActionLoading(true);
    try {
      const subjectPubkey = new PublicKey(subjectIdStr);
      await resolveDispute(subjectPubkey);
      await loadSubject();
    } finally {
      setActionLoading(false);
    }
  }, [resolveDispute, loadSubject]);

  const handleClaimAll = useCallback(async (
    subjectIdStr: string,
    round: number,
    claims: { juror: boolean; challenger: boolean; defender: boolean }
  ) => {
    setActionLoading(true);
    try {
      const subjectPubkey = new PublicKey(subjectIdStr);

      if (claims.juror) {
        await claimJuror(subjectPubkey, round);
      }
      if (claims.challenger) {
        await claimChallenger(subjectPubkey, round);
      }
      if (claims.defender) {
        await claimDefender(subjectPubkey, round);
      }
      await loadSubject();
    } finally {
      setActionLoading(false);
    }
  }, [claimJuror, claimChallenger, claimDefender, loadSubject]);

  const handleCloseRecords = useCallback(async (
    subjectIdStr: string,
    round: number,
    records: { juror: boolean; challenger: boolean; defender: boolean }
  ) => {
    setActionLoading(true);
    try {
      const subjectPubkey = new PublicKey(subjectIdStr);

      if (records.juror) {
        await closeJurorRecord(subjectPubkey, round);
      }
      if (records.challenger) {
        await closeChallengerRecord(subjectPubkey, round);
      }
      if (records.defender) {
        await closeDefenderRecord(subjectPubkey, round);
      }
      await loadSubject();
    } finally {
      setActionLoading(false);
    }
  }, [closeJurorRecord, closeChallengerRecord, closeDefenderRecord, loadSubject]);

  const handleClose = useCallback(() => {
    router.push("/registry");
  }, [router]);

  return (
    <div className="min-h-screen bg-obsidian">
      <Navigation />

      <main className="container mx-auto px-4 pt-28 pb-6">
        {/* Back button */}
        <button
          onClick={handleClose}
          className="flex items-center gap-2 text-steel hover:text-parchment mb-4 transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span>Back to Registry</span>
        </button>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-steel">Loading subject...</div>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-crimson mb-4">{error}</div>
            <button
              onClick={handleClose}
              className="btn btn-primary"
            >
              Return to Registry
            </button>
          </div>
        )}

        {!loading && !error && subject && (
          <div className="bg-slate border border-slate-light rounded-lg overflow-hidden">
            <SubjectModal
              subject={subject}
              subjectContent={subjectContent}
              jurorPool={jurorPool}
              creatorPoolBacking={creatorPoolBacking}
              userPoolBacking={userPoolBacking}
              onClose={handleClose}
              onVote={handleVote}
              onAddBond={handleAddBond}
              onJoinChallengers={handleJoinChallengers}
              onResolve={handleResolve}
              onClaimAll={handleClaimAll}
              onCloseRecords={handleCloseRecords}
              onRefresh={loadSubject}
              actionLoading={actionLoading}
              showActions={true}
              getIpfsUrl={getUrl}
              inline={true}
            />
          </div>
        )}
      </main>
    </div>
  );
}
