"use client";

import React, { useEffect, useState } from "react";
import {
  getStoredPiBalance,
  getStoredChessBalance,
  setStoredPiBalance,
  setStoredChessBalance,
  initializePiSDKMock,
} from "../../lib/pi-sdk-mock";
import { Coins, ShieldCheck, Sparkles, RefreshCw, UserCheck } from "lucide-react";

export const Header: React.FC = () => {
  const [piBalance, setPiBalance] = useState<number>(314.159);
  const [chessBalance, setChessBalance] = useState<number>(250.0);
  const [username, setUsername] = useState<string>("PiPioneer_ChessMaster");
  const [isMock, setIsMock] = useState<boolean>(true);

  useEffect(() => {
    // Check if running in browser
    if (typeof window !== "undefined") {
      const mock = initializePiSDKMock();
      setIsMock(Boolean(mock.isMock));
      setPiBalance(getStoredPiBalance());
      setChessBalance(getStoredChessBalance());

      const handlePiUpdate = (e: any) => setPiBalance(e.detail.balance);
      const handleChessUpdate = (e: any) => setChessBalance(e.detail.balance);
      const handleAuthUpdate = (e: any) => setUsername(e.detail.user.username);

      window.addEventListener("pi-balance-update", handlePiUpdate);
      window.addEventListener("chess-balance-update", handleChessUpdate);
      window.addEventListener("pi-auth-success", handleAuthUpdate);

      return () => {
        window.removeEventListener("pi-balance-update", handlePiUpdate);
        window.removeEventListener("chess-balance-update", handleChessUpdate);
        window.removeEventListener("pi-auth-success", handleAuthUpdate);
      };
    }
  }, []);

  const handleResetBalances = () => {
    setStoredPiBalance(314.159);
    setStoredChessBalance(250.0);
  };

  return (
    <header className="w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo & Brand */}
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <span className="text-2xl font-black text-slate-950">π</span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-lg text-slate-100 tracking-tight">
                Pi Maia Chess
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Web3
              </span>
            </div>
            <p className="text-xs text-slate-400">Human-AI Alignment & Tokenomics</p>
          </div>
        </div>

        {/* Runtime Badge & Balances */}
        <div className="flex items-center space-x-4">
          {/* Pi SDK Environment Pill */}
          <div
            className={`hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
              isMock
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : "bg-purple-500/10 text-purple-300 border-purple-500/30"
            }`}
            title={isMock ? "Mock Pi SDK injected for desktop development" : "Native Pi Browser runtime active"}
          >
            <span className={`w-2 h-2 rounded-full animate-pulse ${isMock ? "bg-emerald-400" : "bg-purple-400"}`} />
            <span>{isMock ? "Pi Sandbox Mock Active" : "Pi Native Browser"}</span>
          </div>

          {/* User Profile */}
          <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
            <UserCheck className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-medium text-slate-200">{username}</span>
          </div>

          {/* Pi Balance */}
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
            <Coins className="w-4 h-4 text-amber-400" />
            <div className="text-right">
              <div className="text-xs font-bold leading-none">{piBalance.toFixed(2)} π</div>
              <span className="text-[10px] text-amber-400/70">Testnet Pi</span>
            </div>
          </div>

          {/* CHESS Token Balance */}
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <div className="text-right">
              <div className="text-xs font-bold leading-none">{chessBalance.toFixed(1)} CHESS</div>
              <span className="text-[10px] text-indigo-400/70">ERC-20 Staking</span>
            </div>
          </div>

          {/* Faucet Reset Button */}
          <button
            onClick={handleResetBalances}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition"
            title="Reset Mock Balances"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
