"use client";

import React, { useState } from "react";
import {
  getStoredChessBalance,
  setStoredChessBalance,
} from "../../lib/pi-sdk-mock";
import { Award, ShieldCheck, X, Sparkles, CheckCircle2 } from "lucide-react";

interface RankedUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasAccess: boolean;
  onUnlockSuccess: () => void;
}

export const RankedUnlockModal: React.FC<RankedUnlockModalProps> = ({
  isOpen,
  onClose,
  hasAccess,
  onUnlockSuccess,
}) => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  if (!isOpen) return null;

  const handlePayFee = () => {
    const bal = getStoredChessBalance();
    if (bal < 1) {
      alert("Insufficient CHESS token balance. You need 1 CHESS token to unlock ranked play.");
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      setStoredChessBalance(bal - 1);
      setIsProcessing(false);
      onUnlockSuccess();
      alert("Success! Global Ranked Matchmaking is now permanently unlocked on your account.");
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-200 bg-slate-800/60"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center mx-auto mb-4">
          <Award className="w-8 h-8 text-purple-400" />
        </div>

        <h3 className="text-xl font-bold text-center text-slate-100 mb-2">
          Global Ranked Matchmaking Access
        </h3>
        <p className="text-xs text-center text-slate-400 mb-6 leading-relaxed">
          Unlock the global competitive ladder, verified ELO rankings, and seasonal tournament leaderboards.
        </p>

        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 mb-6 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Access Type:</span>
            <span className="font-semibold text-slate-200">Lifetime Permanent Gate</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">One-Time Fee:</span>
            <span className="font-mono font-extrabold text-purple-400 text-sm">1.0 CHESS Token</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
            <span className="text-slate-400">Protocol Fee Allocation:</span>
            <span className="text-slate-300">100% to Community Treasury Pool</span>
          </div>
        </div>

        {hasAccess ? (
          <div className="flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-sm font-bold">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>Already Unlocked on This Account</span>
          </div>
        ) : (
          <button
            onClick={handlePayFee}
            disabled={isProcessing}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold text-sm hover:from-purple-400 hover:to-indigo-500 transition shadow-lg shadow-purple-500/25 flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-purple-200" />
            <span>{isProcessing ? "Processing Escrow Payment..." : "Unlock with 1 CHESS"}</span>
          </button>
        )}
      </div>
    </div>
  );
};
