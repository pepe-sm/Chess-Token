"use client";

import React, { useState } from "react";
import {
  BONDING_CURVE_CAP,
  calculateBondingCurvePrice,
  calculatePurchaseCostEth,
  calculateSaleReturnEth,
} from "../../lib/contract-abi";
import {
  getStoredChessBalance,
  setStoredChessBalance,
  getStoredPiBalance,
  setStoredPiBalance,
} from "../../lib/pi-sdk-mock";
import { TrendingUp, Activity, Layers, ArrowUpRight, ArrowDownLeft } from "lucide-react";

export const BondingCurveCard: React.FC = () => {
  const [currentSupplyMinted, setCurrentSupplyMinted] = useState<number>(1_450_000); // 1.45M out of 6M
  const [tokensToTrade, setTokensToTrade] = useState<number>(100);
  const [tradeAction, setTradeAction] = useState<"buy" | "sell">("buy");

  const progressPercent = Math.min(100, (currentSupplyMinted / BONDING_CURVE_CAP) * 100);
  const spotPrice = calculateBondingCurvePrice(currentSupplyMinted);
  const totalCost =
    tradeAction === "buy"
      ? calculatePurchaseCostEth(currentSupplyMinted, tokensToTrade)
      : calculateSaleReturnEth(currentSupplyMinted, tokensToTrade);

  const handleExecuteTrade = () => {
    if (tokensToTrade <= 0) return;

    if (tradeAction === "buy") {
      if (currentSupplyMinted + tokensToTrade > BONDING_CURVE_CAP) {
        alert("Transaction Reverted: Exceeds 6,000,000 CHESS Bonding Curve Cap!");
        return;
      }
      const chessBal = getStoredChessBalance();
      setStoredChessBalance(chessBal + tokensToTrade);
      setCurrentSupplyMinted((prev) => prev + tokensToTrade);
      alert(`Success: Purchased ${tokensToTrade} CHESS via Bonding Curve for ~${totalCost.toFixed(5)} ETH.`);
    } else {
      const chessBal = getStoredChessBalance();
      if (chessBal < tokensToTrade) {
        alert(`Insufficient CHESS tokens to sell.`);
        return;
      }
      setStoredChessBalance(chessBal - tokensToTrade);
      setCurrentSupplyMinted((prev) => Math.max(0, prev - tokensToTrade));
      alert(`Success: Sold ${tokensToTrade} CHESS back to Curve for ~${totalCost.toFixed(5)} ETH refund.`);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-200">CHESS Bonding Curve AMM</h3>
            <p className="text-[11px] text-slate-400">Automated Liquidity & Pricing</p>
          </div>
        </div>
        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
          60% Supply Cap
        </span>
      </div>

      {/* Bonding Curve Supply Progress Bar */}
      <div className="mb-4 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400">Curve Supply Sold:</span>
          <span className="font-mono text-slate-200 font-bold">
            {currentSupplyMinted.toLocaleString()} / {BONDING_CURVE_CAP.toLocaleString()} CHESS
          </span>
        </div>

        {/* Progress meter */}
        <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-amber-500 to-amber-300 h-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-[11px] text-slate-400">
          <span>{progressPercent.toFixed(1)}% Minted</span>
          <span>Spot: {spotPrice.toFixed(6)} ETH / CHESS</span>
        </div>
      </div>

      {/* Trade Calculator Widget */}
      <div className="space-y-3">
        {/* Buy / Sell Tabs */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setTradeAction("buy")}
            className={`py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1 ${
              tradeAction === "buy"
                ? "bg-emerald-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Buy CHESS</span>
          </button>
          <button
            onClick={() => setTradeAction("sell")}
            className={`py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1 ${
              tradeAction === "sell"
                ? "bg-rose-500 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Sell CHESS</span>
          </button>
        </div>

        {/* Input tokens */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Tokens to {tradeAction}:</label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              min={1}
              max={10000}
              value={tokensToTrade}
              onChange={(e) => setTokensToTrade(Math.max(1, parseInt(e.target.value) || 0))}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-amber-500"
            />
            <span className="text-xs font-bold text-slate-300">CHESS</span>
          </div>
        </div>

        {/* Cost estimate */}
        <div className="flex justify-between items-center text-xs px-1 text-slate-400">
          <span>{tradeAction === "buy" ? "Estimated Cost:" : "Estimated Refund:"}</span>
          <span className="font-mono font-bold text-amber-400">
            {totalCost.toFixed(5)} ETH
          </span>
        </div>

        <button
          onClick={handleExecuteTrade}
          className={`w-full py-2.5 rounded-xl font-bold text-xs transition shadow-lg ${
            tradeAction === "buy"
              ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:from-emerald-400 hover:to-teal-400"
              : "bg-gradient-to-r from-rose-500 to-red-600 text-white hover:from-rose-400 hover:to-red-500"
          }`}
        >
          Execute {tradeAction.toUpperCase()} on Curve
        </button>
      </div>
    </div>
  );
};
