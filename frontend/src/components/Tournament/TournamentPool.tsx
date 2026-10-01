"use client";

import React, { useState } from "react";
import { Trophy, Users, Shield, ArrowRight, CheckCircle2 } from "lucide-react";
import { getStoredChessBalance, setStoredChessBalance } from "../../lib/pi-sdk-mock";

interface TournamentPoolProps {
  onJoinMatch: () => void;
}

export const TournamentPool: React.FC<TournamentPoolProps> = ({ onJoinMatch }) => {
  const [registered, setRegistered] = useState<boolean>(false);
  const entryFee = 25; // 25 CHESS
  const maxPlayers = 8;
  const currentEntrants = registered ? 6 : 5;
  const totalPrizePool = entryFee * currentEntrants;
  const platformRake = totalPrizePool * 0.05; // 5%
  const netPool = totalPrizePool - platformRake;

  const handleRegister = () => {
    const bal = getStoredChessBalance();
    if (bal < entryFee) {
      alert(`Insufficient CHESS tokens. Entry fee is ${entryFee} CHESS.`);
      return;
    }
    setStoredChessBalance(bal - entryFee);
    setRegistered(true);
    alert(`Success: Registered for Knockout Arena! Staked ${entryFee} CHESS in the tournament escrow.`);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
            <Trophy className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-200">Knockout Arena</h3>
            <p className="text-[11px] text-slate-400">Multi-Player Tournament Pool</p>
          </div>
        </div>
        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
          Top-2 Split (70/30)
        </span>
      </div>

      <div className="space-y-4">
        {/* Tournament Card */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Entry Stake:</span>
            <span className="font-mono text-amber-400 font-bold">{entryFee} CHESS</span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Entrants:</span>
            <span className="font-mono text-slate-200 font-semibold">
              {currentEntrants} / {maxPlayers} Players
            </span>
          </div>

          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-rose-500 to-amber-400 h-full"
              style={{ width: `${(currentEntrants / maxPlayers) * 100}%` }}
            />
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
            <span className="text-slate-400">Net Prize Pool:</span>
            <span className="font-mono font-extrabold text-emerald-400 text-sm">
              {netPool.toFixed(1)} CHESS
            </span>
          </div>
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>1st Place (70%): {(netPool * 0.7).toFixed(1)} CHESS</span>
            <span>2nd Place (30%): {(netPool * 0.3).toFixed(1)} CHESS</span>
          </div>
        </div>

        {registered ? (
          <div className="space-y-2">
            <div className="flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Registered in Bracket #3</span>
            </div>
            <button
              onClick={onJoinMatch}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-slate-950 font-bold text-xs hover:opacity-90 transition shadow-lg flex items-center justify-center space-x-2"
            >
              <span>Enter Bracket Match</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleRegister}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-slate-950 font-bold text-xs hover:opacity-90 transition shadow-lg shadow-rose-500/20 flex items-center justify-center space-x-2"
          >
            <Users className="w-4 h-4" />
            <span>Register & Stake {entryFee} CHESS</span>
          </button>
        )}
      </div>
    </div>
  );
};
