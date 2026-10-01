"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Chess, Square, PieceSymbol } from "chess.js";
import { Chessboard } from "react-chessboard";
import confetti from "canvas-confetti";
import { requestMaiaMove, EngineMoveResult } from "../../lib/chess-engine";
import { chessAudio } from "../../lib/chess-sounds";
import {
  Trophy,
  RotateCcw,
  Bot,
  Zap,
  Swords,
  Sparkles,
  Award,
  AlertCircle,
  Clock,
  Shield,
  CheckCircle2,
  Volume2,
  VolumeX,
  Users,
} from "lucide-react";

export type GameMode = "free" | "maia" | "wager" | "ranked" | "tournament";

interface ChessGameProps {
  mode: GameMode;
  onModeChange: (mode: GameMode) => void;
  stakedAmount?: number;
  hasRankedAccess?: boolean;
  onOpenRankedModal?: () => void;
  onMatchComplete?: (result: "win" | "loss" | "draw", pot: number) => void;
}

interface PendingPromotion {
  from: Square;
  to: Square;
}

export const ChessGame: React.FC<ChessGameProps> = ({
  mode,
  onModeChange,
  stakedAmount = 0,
  hasRankedAccess = false,
  onOpenRankedModal,
  onMatchComplete,
}) => {
  const [chess, setChess] = useState<Chess>(new Chess());
  const [fen, setFen] = useState<string>("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [selectedElo, setSelectedElo] = useState<number>(1500);
  const [isEngineThinking, setIsEngineThinking] = useState<boolean>(false);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [gameStatus, setGameStatus] = useState<string>("White to move");
  const [winner, setWinner] = useState<"white" | "black" | "draw" | null>(null);
  const [engineInfo, setEngineInfo] = useState<string>("Maia 1500 Ready");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isPassAndPlay, setIsPassAndPlay] = useState<boolean>(false);

  // Dynamic responsive board width
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState<number>(480);

  // Pawn promotion modal state
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);

  // Move visual highlights
  const [customSquareStyles, setCustomSquareStyles] = useState<Record<string, React.CSSProperties>>({});

  // Responsive board sizing observer
  useEffect(() => {
    const updateWidth = () => {
      if (boardContainerRef.current) {
        const containerWidth = boardContainerRef.current.clientWidth;
        const target = Math.min(520, Math.max(280, containerWidth - 16));
        setBoardWidth(target);
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    chessAudio.setMuted(next);
  };

  const updateStatus = useCallback((currentGame: Chess) => {
    if (currentGame.isCheckmate()) {
      const winningColor = currentGame.turn() === "w" ? "black" : "white";
      setWinner(winningColor);
      setGameStatus(`Checkmate! ${winningColor === "white" ? "Player (White)" : "Opponent (Black)"} wins!`);
      chessAudio.playVictory();

      if (winningColor === "white") {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        onMatchComplete?.("win", stakedAmount * 2);
      } else {
        onMatchComplete?.("loss", stakedAmount * 2);
      }
    } else if (currentGame.isDraw()) {
      setWinner("draw");
      setGameStatus("Match ended in a draw (Stalemate / Insufficient Material).");
      onMatchComplete?.("draw", stakedAmount * 2);
    } else if (currentGame.inCheck()) {
      setGameStatus(`${currentGame.turn() === "w" ? "White" : "Black"} is in Check!`);
      chessAudio.playCheck();
    } else {
      setGameStatus(
        currentGame.turn() === "w"
          ? "White to move"
          : mode === "free" && isPassAndPlay
          ? "Black to move (Pass & Play)"
          : "Black thinking..."
      );
    }
  }, [mode, isPassAndPlay, onMatchComplete, stakedAmount]);

  const triggerEngineMove = useCallback(async (currentChess: Chess) => {
    if (currentChess.isGameOver()) return;
    setIsEngineThinking(true);
    setEngineInfo(`Maia ${selectedElo} calculating human-like move...`);

    try {
      const result: EngineMoveResult = await requestMaiaMove(currentChess.fen(), selectedElo);
      const move = currentChess.move({
        from: result.from,
        to: result.to,
        promotion: result.promotion || "q",
      });

      if (move) {
        if (move.captured) {
          chessAudio.playCapture();
        } else {
          chessAudio.playMove();
        }

        setFen(currentChess.fen());
        setMoveHistory((prev) => [...prev, `${move.color === "w" ? "1." : "..."} ${move.san}`]);
        setEngineInfo(`${result.engineType} played ${move.san} (eval: ${result.evaluation > 0 ? "+" : ""}${result.evaluation})`);

        // Highlight opponent move
        setCustomSquareStyles({
          [result.from]: { backgroundColor: "rgba(234, 179, 8, 0.3)" },
          [result.to]: { backgroundColor: "rgba(234, 179, 8, 0.5)" },
        });

        updateStatus(currentChess);
      }
    } catch (err: any) {
      console.error("Engine move error:", err);
      setEngineInfo("Engine calculation failed");
    } finally {
      setIsEngineThinking(false);
    }
  }, [selectedElo, updateStatus]);

  // Execute a verified legal move
  const executeMove = (from: Square, to: Square, promotion?: string): boolean => {
    try {
      const newGame = new Chess(chess.fen());
      const move = newGame.move({
        from,
        to,
        promotion: promotion || "q",
      });

      if (move === null) return false;

      // Play appropriate audio tone
      if (move.captured) {
        chessAudio.playCapture();
      } else {
        chessAudio.playMove();
      }

      // Update state
      setChess(newGame);
      setFen(newGame.fen());
      setMoveHistory((prev) => [...prev, `${move.color === "w" ? "1." : "..."} ${move.san}`]);

      // Set move highlight
      setCustomSquareStyles({
        [from]: { backgroundColor: "rgba(16, 185, 129, 0.3)" },
        [to]: { backgroundColor: "rgba(16, 185, 129, 0.5)" },
      });

      updateStatus(newGame);

      // Trigger opponent engine move if not in Pass & Play and game is not over
      const shouldTriggerAI = !(mode === "free" && isPassAndPlay);
      if (!newGame.isGameOver() && shouldTriggerAI) {
        setTimeout(() => {
          triggerEngineMove(newGame);
        }, 300);
      }

      return true;
    } catch {
      return false;
    }
  };

  // Handle piece drop on chessboard
  const onDrop = (sourceSquare: Square, targetSquare: Square, piece: string): boolean => {
    if (winner !== null || isEngineThinking) return false;

    // Check ranked gate if in ranked mode
    if (mode === "ranked" && !hasRankedAccess) {
      onOpenRankedModal?.();
      return false;
    }

    // Detect pawn promotion
    const movingPiece = chess.get(sourceSquare);
    const isPawn = movingPiece && movingPiece.type === "p";
    const isPromotionRank =
      (movingPiece?.color === "w" && targetSquare.endsWith("8")) ||
      (movingPiece?.color === "b" && targetSquare.endsWith("1"));

    if (isPawn && isPromotionRank) {
      const legalMoves = chess.moves({ verbose: true });
      const isLegal = legalMoves.some(
        (m) => m.from === sourceSquare && m.to === targetSquare && m.promotion
      );
      if (isLegal) {
        setPendingPromotion({ from: sourceSquare, to: targetSquare });
        return false;
      }
    }

    return executeMove(sourceSquare, targetSquare, "q");
  };

  // Complete pending promotion choice
  const handleSelectPromotion = (piece: "q" | "r" | "b" | "n") => {
    if (!pendingPromotion) return;
    const { from, to } = pendingPromotion;
    setPendingPromotion(null);
    executeMove(from, to, piece);
  };

  const resetGame = () => {
    const freshGame = new Chess();
    setChess(freshGame);
    setFen(freshGame.fen());
    setMoveHistory([]);
    setGameStatus("White to move");
    setWinner(null);
    setPendingPromotion(null);
    setCustomSquareStyles({});
    setEngineInfo(`Maia ${selectedElo} Ready`);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* Chessboard Card */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl w-full">
        {/* Mode Selector Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-6 border-b border-slate-800 pb-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onModeChange("free")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                mode === "free"
                  ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Free Casual Play</span>
            </button>

            <button
              onClick={() => onModeChange("maia")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                mode === "maia"
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Maia AI Challenge</span>
            </button>

            <button
              onClick={() => onModeChange("wager")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                mode === "wager"
                  ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              <span>1v1 Staked Match</span>
            </button>

            <button
              onClick={() => {
                if (!hasRankedAccess) {
                  onOpenRankedModal?.();
                } else {
                  onModeChange("ranked");
                }
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                mode === "ranked"
                  ? "bg-purple-500 text-white shadow-md shadow-purple-500/20"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Global Ranked</span>
              {!hasRankedAccess && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-900/60 text-purple-300 ml-1 border border-purple-700">
                  1 CHESS Gate
                </span>
              )}
            </button>

            <button
              onClick={() => onModeChange("tournament")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                mode === "tournament"
                  ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Tournament Arena</span>
            </button>
          </div>

          {/* Audio Mute & Free Sub-Mode Toggles */}
          <div className="flex items-center space-x-2">
            {mode === "free" && (
              <button
                onClick={() => setIsPassAndPlay((prev) => !prev)}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                  isPassAndPlay
                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                    : "bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-slate-200"
                }`}
                title="Toggle between Solo vs Maia Bot or 2-Player Pass and Play"
              >
                <Users className="w-3.5 h-3.5" />
                <span>{isPassAndPlay ? "Pass & Play Active" : "Solo vs AI"}</span>
              </button>
            )}

            <button
              onClick={toggleMute}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/60 transition"
              title={isMuted ? "Unmute Sound" : "Mute Sound"}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
          </div>
        </div>

        {/* Board Header: Opponent Profile */}
        <div className="flex items-center justify-between mb-3 px-2">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
              {mode === "free" && isPassAndPlay ? (
                <Users className="w-4 h-4 text-indigo-400" />
              ) : (
                <Bot className="w-4 h-4 text-amber-400" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-sm text-slate-200">
                  {mode === "free" && isPassAndPlay
                    ? "Opponent (Black - Local Player)"
                    : mode === "maia" || mode === "free"
                    ? "Maia Bot"
                    : "Pioneer_Opponent"}
                </span>
                {!(mode === "free" && isPassAndPlay) && (
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">
                    ELO {selectedElo}
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400">
                {mode === "free" && isPassAndPlay ? "Local 2-Player Match" : engineInfo}
              </span>
            </div>
          </div>

          {/* Engine ELO Selector */}
          {!(mode === "free" && isPassAndPlay) && (
            <div className="flex items-center space-x-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700/60">
              {[1100, 1500, 1900].map((elo) => (
                <button
                  key={elo}
                  onClick={() => setSelectedElo(elo)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition ${
                    selectedElo === elo
                      ? "bg-amber-500 text-slate-950 font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {elo}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Interactive Chessboard Container */}
        <div
          ref={boardContainerRef}
          className="relative max-w-[540px] mx-auto rounded-xl overflow-hidden border border-slate-700/80 shadow-2xl flex items-center justify-center bg-slate-950 p-2"
        >
          <Chessboard
            position={fen}
            onPieceDrop={onDrop}
            boardWidth={boardWidth}
            customSquareStyles={customSquareStyles}
            customBoardStyle={{
              borderRadius: "0.75rem",
              boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.5)",
            }}
            customDarkSquareStyle={{ backgroundColor: "#334155" }}
            customLightSquareStyle={{ backgroundColor: "#cbd5e1" }}
          />

          {/* Interactive Pawn Promotion Modal Overlay */}
          {pendingPromotion && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-20 animate-in fade-in">
              <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-5 text-center shadow-2xl max-w-xs w-full">
                <h4 className="text-sm font-bold text-amber-400 mb-1">Promote Your Pawn</h4>
                <p className="text-xs text-slate-400 mb-4">Select piece to promote to:</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { type: "q" as const, name: "Queen", icon: "♕" },
                    { type: "r" as const, name: "Rook", icon: "♖" },
                    { type: "b" as const, name: "Bishop", icon: "♗" },
                    { type: "n" as const, name: "Knight", icon: "♘" },
                  ].map((p) => (
                    <button
                      key={p.type}
                      onClick={() => handleSelectPromotion(p.type)}
                      className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-800 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-500/50 transition group"
                    >
                      <span className="text-3xl mb-1 text-slate-100 group-hover:text-amber-400 transition">
                        {p.icon}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 group-hover:text-amber-300">
                        {p.name}
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setPendingPromotion(null)}
                  className="mt-3 text-xs text-slate-500 hover:text-slate-300"
                >
                  Cancel Move
                </button>
              </div>
            </div>
          )}

          {/* Game Over Banner Overlay */}
          {winner !== null && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-10 animate-in fade-in">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-4">
                <Trophy className="w-8 h-8 text-amber-400 animate-bounce" />
              </div>
              <h3 className="text-2xl font-black text-slate-100 mb-2">{gameStatus}</h3>
              {mode === "wager" && stakedAmount > 0 && (
                <p className="text-sm text-amber-400 mb-4 font-semibold">
                  {winner === "white"
                    ? `Claiming ${(stakedAmount * 2 * 0.95).toFixed(1)} CHESS Winner Pot (5% rake applied)`
                    : winner === "black"
                    ? `Wager lost (${stakedAmount} CHESS)`
                    : `Draw! Full refund of ${stakedAmount} CHESS issued.`}
                </p>
              )}
              <button
                onClick={resetGame}
                className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold text-sm hover:from-amber-300 hover:to-amber-400 transition shadow-lg shadow-amber-500/20"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Play Again</span>
              </button>
            </div>
          )}
        </div>

        {/* Board Footer: Player Profile & Action Controls */}
        <div className="flex items-center justify-between mt-4 px-2">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <span className="text-xs font-bold text-emerald-400">YOU</span>
            </div>
            <div>
              <span className="font-semibold text-sm text-slate-200">Player (White)</span>
              <div className="text-xs text-slate-400">{gameStatus}</div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={resetGame}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Board</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar: Move History & Match Details */}
      <div className="w-full lg:w-80 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col h-full min-h-[500px]">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-sm text-slate-200">Move History</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {moveHistory.length} moves
          </span>
        </div>

        {/* Move History List */}
        <div className="flex-1 overflow-y-auto max-h-[300px] space-y-1 font-mono text-xs pr-1">
          {moveHistory.length === 0 ? (
            <div className="text-center py-8 text-slate-500 italic">
              Make your first move to begin the match.
            </div>
          ) : (
            moveHistory.map((move, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between py-1 px-2 rounded bg-slate-800/40 hover:bg-slate-800 text-slate-300"
              >
                <span className="text-slate-500 w-8">#{idx + 1}</span>
                <span className="font-semibold text-amber-400">{move}</span>
              </div>
            ))
          )}
        </div>

        {/* Game Mode Information Card */}
        <div className="mt-4 pt-4 border-t border-slate-800">
          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Current Mode
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
                {mode === "free"
                  ? isPassAndPlay
                    ? "Pass & Play"
                    : "Free Casual"
                  : mode === "maia"
                  ? "Maia AI"
                  : mode === "wager"
                  ? "1v1 Wager"
                  : mode === "ranked"
                  ? "Global Ranked"
                  : "Tournament"}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mt-1">
              {mode === "free" &&
                (isPassAndPlay
                  ? "2-Player Pass and Play mode. Play alternating turns with a friend."
                  : "100% Free Casual play vs Maia AI. Zero-gas and no stakes required.")}
              {mode === "maia" && `Challenging Maia Chess model calibrated to ELO ${selectedElo}.`}
              {mode === "wager" && `Staked match with ${stakedAmount} CHESS. 5% platform rake on win.`}
              {mode === "ranked" && "Global competitive matchmaking unlocked via 1 CHESS gate."}
              {mode === "tournament" && "Knockout pool tournament with multi-player prize split."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
