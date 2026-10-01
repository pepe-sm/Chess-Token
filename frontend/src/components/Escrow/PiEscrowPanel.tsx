"use client";

import React, { useState, useEffect } from "react";
import {
  getStoredChessBalance,
  setStoredChessBalance,
  getStoredPiBalance,
  setStoredPiBalance,
} from "../../lib/pi-sdk-mock";
import { Swords, ShieldAlert, Timer, ArrowRight, CheckCircle, Coins, DollarSign } from "lucide-react";

interface PiEscrowPanelProps {
  currentStake: number;
  onStakeChange: (stake: number) => void;
  onStartStakedMatch: () => void;
  isMatchActive: boolean;
}

export const PiEscrowPanel: React.FC<PiEscrowPanelProps> = ({
  currentStake,
  onStakeChange,
  onStartStakedMatch,
  isMatchActive,
}) => {
  const [stakeAmount, setStakeAmount] = useState<number>(currentStake || 10);
  const [isDepositing, setIsDepositing] = useState<boolean>(false);
  const [escrowStatus, setEscrowStatus] = useState<"idle" | "deposited" | "matched" | "settled">("idle");
  const [countdown, setCountdown] = useState<number>(900); // 15 minutes timeout

  const totalPot = stakeAmount * 2;
  const platformRake = totalPot * 0.05; // 5% rake
  const winnerPayout = totalPot - platformRake; // 95% payout

  useEffect(() => {
    let timer: any;
    if (escrowStatus === "deposited") {
      timer = setInterval(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [escrowStatus]);

  const handleDepositStake = async () => {
    const chessBal = getStoredChessBalance();
    if (chessBal < stakeAmount) {
      alert(`Insufficient CHESS tokens (${chessBal} available, ${stakeAmount} required).`);
      return;
    }

    setIsDepositing(true);

    // Call Pi Network SDK Payment flow if user prefers Pi staking
    if (typeof window !== "undefined" && window.Pi) {
      try {
        await window.Pi.createPayment(
          {
            amount: stakeAmount * 0.1, // 0.1 Pi per 1 CHESS ratio
            memo: `Escrow Wager Stake for 1v1 Chess Match (${stakeAmount} CHESS)`,
            metadata: { matchType: "1v1_escrow", stake: stakeAmount },
          },
          {
            onReadyForServerApproval: (payId) => console.log("Escrow approval:", payId),
            onReadyForServerCompletion: (payId, txid) => {
              console.log("Escrow completed on Pi chain:", txid);
              // Deduct CHESS token
              setStoredChessBalance(chessBal - stakeAmount);
              onStakeChange(stakeAmount);
              setEscrowStatus("deposited");
              setIsDepositing(false);

              // Auto-simulate opponent match after 2 seconds
              setTimeout(() => {
                setEscrowStatus("matched");
                onStartStakedMatch();
              }, 2000);
            },
            onCancel: () => setIsDepositing(false),
            onError: (err) => {
              console.error(err);
              setIsDepositing(false);
            },
          }
        );
        return;
      } catch (e) {
        console.warn("Pi payment fallback:", e);
      }
    }

    // Direct simulated escrow deposit fallback
    setTimeout(() => {
      setStoredChessBalance(chessBal - stakeAmount);
      onStakeChange(stakeAmount);
      setEscrowStatus("deposited");
      setIsDepositing(false);

      setTimeout(() => {
        setEscrowStatus("matched");
        onStartStakedMatch();
      }, 1500);
    }, 800);
  };

  const handleCancelTimeout = () => {
    const chessBal = getStoredChessBalance();
    setStoredChessBalance(chessBal + stakeAmount);
    setEscrowStatus("idle");
    setCountdown(900);
    alert("Match cancelled: 100% refund of your stake has been returned to your wallet.");
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
            <Swords className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-200">1v1 Escrow Staking</h3>
            <p className="text-[11px] text-slate-400">Head-to-Head Token Wager</p>
          </div>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          5% Platform Rake
        </span>
      </div>

      {/* Stake Selector */}
      {escrowStatus === "idle" && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Select Wager Amount (Per Player):
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 25, 50].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setStakeAmount(amt)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition border ${
                    stakeAmount === amt
                      ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {amt} CHESS
                </button>
              ))}
            </div>
          </div>

          {/* Financial Breakdown Table */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Your Stake:</span>
              <span className="font-mono text-slate-200 font-bold">{stakeAmount} CHESS</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Opponent Match:</span>
              <span className="font-mono text-slate-200 font-bold">{stakeAmount} CHESS</span>
            </div>
            <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800">
              <span>Total Match Pot:</span>
              <span className="font-mono text-amber-400 font-bold">{totalPot} CHESS</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Protocol Rake (5%):</span>
              <span className="font-mono text-rose-400 font-semibold">-{platformRake.toFixed(1)} CHESS</span>
            </div>
            <div className="flex justify-between text-emerald-400 font-bold pt-1 border-t border-slate-800">
              <span>Winner Takes (95%):</span>
              <span className="font-mono text-emerald-300 font-extrabold">{winnerPayout.toFixed(1)} CHESS</span>
            </div>
          </div>

          <button
            onClick={handleDepositStake}
            disabled={isDepositing}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-bold text-sm hover:from-indigo-400 hover:to-indigo-500 transition shadow-lg shadow-indigo-500/25 flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {isDepositing ? (
              <span>Confirming with Pi Network SDK...</span>
            ) : (
              <>
                <Coins className="w-4 h-4 text-amber-300" />
                <span>Stake & Create Escrow Match</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}

      {/* Escrow Active / Match Found Status */}
      {escrowStatus !== "idle" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-2">
              <CheckCircle className="w-6 h-6 text-emerald-400" />
            </div>
            <h4 className="text-sm font-bold text-slate-100">
              {escrowStatus === "deposited" ? "Searching for Opponent..." : "Match Escrow Locked & Active!"}
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Pot: <span className="text-amber-400 font-bold">{totalPot} CHESS</span> (Winner receives{" "}
              <span className="text-emerald-400 font-bold">{winnerPayout.toFixed(1)} CHESS</span>)
            </p>
          </div>

          {/* Timeout Safeguard Notice */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start space-x-3">
            <Timer className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <div className="font-semibold text-amber-300">
                Timeout Safeguard: {formatTime(countdown)}
              </div>
              <p className="text-amber-400/80 mt-0.5">
                If the match is abandoned, you can cancel to receive a 100% refund.
              </p>
            </div>
          </div>

          <button
            onClick={handleCancelTimeout}
            className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-rose-400 border border-rose-800/40 text-xs font-semibold transition"
          >
            Cancel Wager & Refund Stake
          </button>
        </div>
      )}
    </div>
  );
};
