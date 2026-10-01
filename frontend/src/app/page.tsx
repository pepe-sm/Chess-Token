"use client";

import React, { useState } from "react";
import { ChessGame, GameMode } from "../components/ChessBoard/ChessGame";
import { BondingCurveCard } from "../components/Escrow/BondingCurveCard";
import { TournamentPool } from "../components/Tournament/TournamentPool";
import { RankedUnlockModal } from "../components/Escrow/RankedUnlockModal";
import {
  Sparkles,
  Swords,
  Award,
  Trophy,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

export default function Home() {
  const [activeMainTab, setActiveMainTab] = useState<"play" | "curve" | "tournaments">("play");
  const [gameMode, setGameMode] = useState<GameMode>("maia");
  const [stakedAmount, setStakedAmount] = useState<number>(10);
  const [hasRankedAccess, setHasRankedAccess] = useState<boolean>(false);
  const [isRankedModalOpen, setIsRankedModalOpen] = useState<boolean>(false);

  const handleMatchComplete = (result: "win" | "loss" | "draw", pot: number) => {
    console.log(`Match finished with result: ${result}, pot: ${pot}`);
  };

  return (
    <div className="space-y-6">
      {/* Top Main Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center space-x-2 bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveMainTab("play")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
              activeMainTab === "play"
                ? "bg-amber-500 text-slate-950 shadow-amber-500/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Swords className="w-4 h-4" />
            <span>Play Chess</span>
          </button>

          <button
            onClick={() => setActiveMainTab("curve")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
              activeMainTab === "curve"
                ? "bg-indigo-600 text-white shadow-indigo-600/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>CHESS Bonding Curve</span>
          </button>

          <button
            onClick={() => setActiveMainTab("tournaments")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
              activeMainTab === "tournaments"
                ? "bg-rose-500 text-white shadow-rose-500/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Tournaments & Ranked</span>
          </button>
        </div>

        {/* Global Ranked Gate Status badge */}
        <div className="flex items-center space-x-3">
          {hasRankedAccess ? (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Ranked Pass Active</span>
            </span>
          ) : (
            <button
              onClick={() => setIsRankedModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 border border-purple-700/60 text-xs font-bold transition"
            >
              <Award className="w-3.5 h-3.5 text-purple-400" />
              <span>Unlock Ranked (1 CHESS)</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: PLAY CHESS (Lobby & Focused Match Arena) */}
      {activeMainTab === "play" && (
        <ChessGame
          mode={gameMode}
          onModeChange={setGameMode}
          stakedAmount={stakedAmount}
          hasRankedAccess={hasRankedAccess}
          onOpenRankedModal={() => setIsRankedModalOpen(true)}
          onMatchComplete={handleMatchComplete}
        />
      )}

      {/* TAB 2: CHESS BONDING CURVE & TOKENOMICS */}
      {activeMainTab === "curve" && (
        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
          <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-indigo-950/60 border border-indigo-800/40 rounded-3xl p-6 sm:p-8 shadow-xl">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Decentralized Liquidity Curve</span>
            </span>
            <h2 className="text-2xl font-black text-slate-100 tracking-tight">
              Automated Bonding Curve AMM
            </h2>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              Mint CHESS tokens directly from the smart contract curve or burn them back for an instant refund.
              Prices adjust deterministically with every token traded.
            </p>
          </div>

          <BondingCurveCard />
        </div>
      )}

      {/* TAB 3: TOURNAMENTS & RANKED LADDER */}
      {activeMainTab === "tournaments" && (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
          <div className="bg-gradient-to-r from-rose-950/60 via-slate-900 to-rose-950/60 border border-rose-800/40 rounded-3xl p-6 sm:p-8 shadow-xl">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold mb-3">
              <Trophy className="w-3.5 h-3.5 text-rose-400" />
              <span>Competitive Arenas</span>
            </span>
            <h2 className="text-2xl font-black text-slate-100 tracking-tight">
              Tournament Pools & Global Ranked
            </h2>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              Compete in single-elimination knockout pools or climb the global ELO ladder.
              Stake tokens, battle other pioneers, and claim your share of the treasury rewards.
            </p>
          </div>

          <TournamentPool
            onJoinMatch={() => {
              setGameMode("tournament");
              setActiveMainTab("play");
            }}
          />
        </div>
      )}

      {/* Global Ranked Unlock Modal */}
      <RankedUnlockModal
        isOpen={isRankedModalOpen}
        onClose={() => setIsRankedModalOpen(false)}
        hasAccess={hasRankedAccess}
        onUnlockSuccess={() => setHasRankedAccess(true)}
      />
    </div>
  );
}
