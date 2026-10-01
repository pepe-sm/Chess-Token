"use client";

import React, { useState } from "react";
import { ChessGame, GameMode } from "../components/ChessBoard/ChessGame";
import { PiEscrowPanel } from "../components/Escrow/PiEscrowPanel";
import { BondingCurveCard } from "../components/Escrow/BondingCurveCard";
import { TournamentPool } from "../components/Tournament/TournamentPool";
import { RankedUnlockModal } from "../components/Escrow/RankedUnlockModal";
import {
  Sparkles,
  Bot,
  Swords,
  Award,
  Trophy,
  Coins,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

export default function Home() {
  const [gameMode, setGameMode] = useState<GameMode>("free");
  const [stakedAmount, setStakedAmount] = useState<number>(10);
  const [hasRankedAccess, setHasRankedAccess] = useState<boolean>(false);
  const [isRankedModalOpen, setIsRankedModalOpen] = useState<boolean>(false);
  const [activeSideTab, setActiveSideTab] = useState<"escrow" | "curve" | "tourney">("escrow");

  const handleMatchComplete = (result: "win" | "loss" | "draw", pot: number) => {
    console.log(`Match finished with result: ${result}, pot: ${pot}`);
  };

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Pi Network Tokenized Chess Ecosystem</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-100 tracking-tight leading-tight">
            Human-AI Chess Meets Web3 Tokenomics
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
            Play 100% free casual games, challenge calibrated Maia neural network bots, stake in 1v1
            escrow wagers with a 5% protocol rake, or trade CHESS tokens along the automated bonding curve.
          </p>

          <div className="mt-6 flex flex-wrap gap-4 text-xs font-semibold text-slate-300">
            <div className="flex items-center space-x-1.5 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Free Play 100% Zero-Gas</span>
            </div>
            <div className="flex items-center space-x-1.5 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60">
              <Bot className="w-4 h-4 text-amber-400" />
              <span>Maia 1100 / 1500 / 1900 ELO</span>
            </div>
            <div className="flex items-center space-x-1.5 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60">
              <Coins className="w-4 h-4 text-indigo-400" />
              <span>Pi Network SDK Integrated</span>
            </div>
          </div>
        </div>

        {/* Ambient background glow */}
        <div className="absolute right-0 top-0 -mt-10 -mr-10 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-40 bottom-0 -mb-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Main Grid: Chessboard + Web3 Tokenomics Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        {/* Left & Center: Chessboard */}
        <div className="xl:col-span-2">
          <ChessGame
            mode={gameMode}
            onModeChange={(mode) => {
              setGameMode(mode);
              if (mode === "wager") setActiveSideTab("escrow");
              if (mode === "tournament") setActiveSideTab("tourney");
            }}
            stakedAmount={stakedAmount}
            hasRankedAccess={hasRankedAccess}
            onOpenRankedModal={() => setIsRankedModalOpen(true)}
            onMatchComplete={handleMatchComplete}
          />
        </div>

        {/* Right Column: Web3 Tokenomics & Escrow Control Center */}
        <div className="space-y-6">
          {/* Side Tabs Switcher */}
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveSideTab("escrow")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                activeSideTab === "escrow"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              <span>1v1 Escrow</span>
            </button>
            <button
              onClick={() => setActiveSideTab("curve")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                activeSideTab === "curve"
                  ? "bg-amber-500 text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Bonding Curve</span>
            </button>
            <button
              onClick={() => setActiveSideTab("tourney")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                activeSideTab === "tourney"
                  ? "bg-rose-500 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Tournament</span>
            </button>
          </div>

          {/* Active Side Tab Content */}
          {activeSideTab === "escrow" && (
            <PiEscrowPanel
              currentStake={stakedAmount}
              onStakeChange={(stake) => {
                setStakedAmount(stake);
                setGameMode("wager");
              }}
              onStartStakedMatch={() => setGameMode("wager")}
              isMatchActive={gameMode === "wager"}
            />
          )}

          {activeSideTab === "curve" && <BondingCurveCard />}

          {activeSideTab === "tourney" && (
            <TournamentPool
              onJoinMatch={() => {
                setGameMode("tournament");
              }}
            />
          )}

          {/* Ranked Gate Banner Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/40 to-slate-900 border border-purple-800/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
                  <Award className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Global Ranked Access</h4>
                  <p className="text-[11px] text-slate-400">
                    {hasRankedAccess ? "Permanent Access Unlocked" : "1 CHESS One-Time Gate"}
                  </p>
                </div>
              </div>

              {hasRankedAccess ? (
                <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Unlocked
                </span>
              ) : (
                <button
                  onClick={() => setIsRankedModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-md shadow-purple-600/30"
                >
                  Unlock Gate
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

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
