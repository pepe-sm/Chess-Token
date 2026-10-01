"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Chess, Square } from "chess.js";
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
  ArrowLeft,
  Flame,
  Flag,
  Handshake,
  Wifi,
  WifiOff,
  Palette,
  Check,
} from "lucide-react";

export type GameMode = "free" | "maia" | "wager" | "ranked" | "tournament";
export type TimeControl = "untimed" | "5m" | "10m" | "24h";
export type BoardThemeKey = "emerald" | "blue" | "wood" | "slate";

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

const BOARD_THEMES: Record<BoardThemeKey, { name: string; dark: string; light: string; accent: string }> = {
  emerald: {
    name: "Emerald Green",
    dark: "#769656",
    light: "#eeeed2",
    accent: "bg-emerald-500",
  },
  blue: {
    name: "Tournament Blue",
    dark: "#4e78a8",
    light: "#e7ecf2",
    accent: "bg-blue-500",
  },
  wood: {
    name: "Classic Wood",
    dark: "#b58863",
    light: "#f0d9b5",
    accent: "bg-amber-600",
  },
  slate: {
    name: "Midnight Slate",
    dark: "#334155",
    light: "#cbd5e1",
    accent: "bg-slate-500",
  },
};

const PIECE_GLYPHS: Record<string, string> = {
  p: "♟",
  n: "♞",
  b: "♝",
  r: "♜",
  q: "♛",
  k: "♚",
};

export const ChessGame: React.FC<ChessGameProps> = ({
  mode,
  onModeChange,
  stakedAmount = 10,
  hasRankedAccess = false,
  onOpenRankedModal,
  onMatchComplete,
}) => {
  // Screen state: "lobby" for setup/mode selection, "match" for focused gameplay
  const [viewState, setViewState] = useState<"lobby" | "match">("lobby");

  // Game state
  const [chess, setChess] = useState<Chess>(new Chess());
  const [fen, setFen] = useState<string>("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [selectedElo, setSelectedElo] = useState<number>(1500);
  const [timeControl, setTimeControl] = useState<TimeControl>("10m");
  const [activeStake, setActiveStake] = useState<number>(stakedAmount || 10);
  const [isPassAndPlay, setIsPassAndPlay] = useState<boolean>(false);
  const [boardTheme, setBoardTheme] = useState<BoardThemeKey>("emerald");

  // In-match states
  const [isEngineThinking, setIsEngineThinking] = useState<boolean>(false);
  const [moveHistory, setMoveHistory] = useState<{ white: string; black?: string }[]>([]);
  const [gameStatus, setGameStatus] = useState<string>("White to move");
  const [winner, setWinner] = useState<"white" | "black" | "draw" | null>(null);
  const [winReason, setWinReason] = useState<string>("");
  const [engineInfo, setEngineInfo] = useState<string>("Maia 1500 Ready");
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Clocks (seconds remaining)
  const [whiteClock, setWhiteClock] = useState<number>(600);
  const [blackClock, setBlackClock] = useState<number>(600);
  const [isClockRunning, setIsClockRunning] = useState<boolean>(false);

  // 1v1 Disconnect / Outage Protection (1-hour grace period for network drops)
  const [isOpponentDisconnected, setIsOpponentDisconnected] = useState<boolean>(false);
  const [outageSecondsRemaining, setOutageSecondsRemaining] = useState<number>(3600); // 1 hour

  // UI Interactive States
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [customSquareStyles, setCustomSquareStyles] = useState<Record<string, React.CSSProperties>>({});
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [showForfeitModal, setShowForfeitModal] = useState<boolean>(false);
  const [showDrawOffer, setShowDrawOffer] = useState<boolean>(false);

  // Board width responsive
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState<number>(480);

  useEffect(() => {
    const updateWidth = () => {
      if (boardContainerRef.current) {
        const containerWidth = boardContainerRef.current.clientWidth;
        const target = Math.min(520, Math.max(280, containerWidth - 24));
        setBoardWidth(target);
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, [viewState]);

  // Audio mute toggle
  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    chessAudio.setMuted(next);
  };

  // Clock Ticker
  useEffect(() => {
    if (!isClockRunning || winner !== null || timeControl === "untimed") return;

    const timer = setInterval(() => {
      if (chess.turn() === "w") {
        setWhiteClock((prev) => {
          if (prev <= 1) {
            handleTimeForfeit("white");
            return 0;
          }
          return prev - 1;
        });
      } else {
        setBlackClock((prev) => {
          if (prev <= 1) {
            handleTimeForfeit("black");
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isClockRunning, chess, winner, timeControl]);

  // Outage countdown when opponent disconnects
  useEffect(() => {
    if (!isOpponentDisconnected || winner !== null) return;
    const interval = setInterval(() => {
      setOutageSecondsRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpponentDisconnected, winner]);

  const handleTimeForfeit = (flaggedColor: "white" | "black") => {
    const winningColor = flaggedColor === "white" ? "black" : "white";
    setWinner(winningColor);
    setWinReason(`Time out! ${flaggedColor === "white" ? "White" : "Black"} flagged.`);
    setIsClockRunning(false);
    if (winningColor === "white") {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      onMatchComplete?.("win", activeStake * 2);
    } else {
      onMatchComplete?.("loss", activeStake * 2);
    }
  };

  // Compute captured pieces and material count
  const getCapturedAndAdvantage = useCallback(() => {
    const startCounts: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
    const curW: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };
    const curB: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };

    const board = chess.board();
    for (const row of board) {
      for (const sq of row) {
        if (!sq || sq.type === "k") continue;
        if (sq.color === "w") curW[sq.type]++;
        else curB[sq.type]++;
      }
    }

    const whiteCaptured: string[] = [];
    const blackCaptured: string[] = [];
    let wMat = 0;
    let bMat = 0;
    const vals: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };

    for (const t of ["q", "r", "b", "n", "p"]) {
      const wTook = Math.max(0, startCounts[t] - curB[t]);
      const bTook = Math.max(0, startCounts[t] - curW[t]);
      for (let i = 0; i < wTook; i++) whiteCaptured.push(t);
      for (let i = 0; i < bTook; i++) blackCaptured.push(t);
      wMat += curW[t] * vals[t];
      bMat += curB[t] * vals[t];
    }

    return {
      whiteCaptured,
      blackCaptured,
      advantage: wMat - bMat,
    };
  }, [chess]);

  // Update legal move highlight styles
  const updateHighlights = useCallback((selected: Square | null, lastFrom?: Square, lastTo?: Square) => {
    const styles: Record<string, React.CSSProperties> = {};

    // Highlight last move
    if (lastFrom && lastTo) {
      styles[lastFrom] = { backgroundColor: "rgba(251, 191, 36, 0.25)" };
      styles[lastTo] = { backgroundColor: "rgba(251, 191, 36, 0.4)" };
    }

    // Highlight King in check
    if (chess.inCheck()) {
      const board = chess.board();
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = board[r][c];
          if (piece && piece.type === "k" && piece.color === chess.turn()) {
            const sq = `${String.fromCharCode(97 + c)}${8 - r}` as Square;
            styles[sq] = {
              backgroundColor: "rgba(239, 68, 68, 0.65)",
              boxShadow: "inset 0 0 14px #ef4444",
            };
          }
        }
      }
    }

    // Highlight legal moves for selected piece
    if (selected) {
      styles[selected] = { backgroundColor: "rgba(99, 102, 241, 0.45)" };
      const legalMoves = chess.moves({ square: selected, verbose: true });
      for (const m of legalMoves) {
        if (m.captured) {
          styles[m.to] = {
            background: "radial-gradient(circle, transparent 55%, rgba(239, 68, 68, 0.75) 56%)",
            borderRadius: "50%",
          };
        } else {
          styles[m.to] = {
            background: "radial-gradient(circle, rgba(16, 185, 129, 0.75) 24%, transparent 25%)",
            borderRadius: "50%",
          };
        }
      }
    }

    setCustomSquareStyles(styles);
  }, [chess]);

  // Status updates after moves
  const updateStatus = useCallback((currentGame: Chess) => {
    if (currentGame.isCheckmate()) {
      const winningColor = currentGame.turn() === "w" ? "black" : "white";
      setWinner(winningColor);
      setWinReason(`Checkmate! ${winningColor === "white" ? "Player (White)" : "Opponent (Black)"} wins.`);
      setIsClockRunning(false);
      chessAudio.playVictory();

      if (winningColor === "white") {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        onMatchComplete?.("win", activeStake * 2);
      } else {
        onMatchComplete?.("loss", activeStake * 2);
      }
    } else if (currentGame.isDraw()) {
      setWinner("draw");
      setWinReason("Match ended in a draw (Stalemate / Insufficient Material).");
      setIsClockRunning(false);
      onMatchComplete?.("draw", activeStake * 2);
    } else if (currentGame.inCheck()) {
      setGameStatus(`${currentGame.turn() === "w" ? "White" : "Black"} is in Check!`);
      chessAudio.playCheck();
    } else {
      setGameStatus(
        currentGame.turn() === "w"
          ? "White to move"
          : isPassAndPlay
          ? "Black to move (Pass & Play)"
          : "Black thinking..."
      );
    }
  }, [isPassAndPlay, onMatchComplete, activeStake]);

  // AI Move triggering
  const triggerEngineMove = useCallback(async (currentChess: Chess) => {
    if (currentChess.isGameOver()) return;
    setIsEngineThinking(true);
    setEngineInfo(`Maia ${selectedElo} calculating tactical move...`);

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
        setMoveHistory((prev) => {
          const last = prev[prev.length - 1];
          if (last && !last.black) {
            return [...prev.slice(0, -1), { white: last.white, black: move.san }];
          }
          return [...prev, { white: "...", black: move.san }];
        });

        setEngineInfo(`${result.engineType} played ${move.san}`);
        updateHighlights(null, result.from as Square, result.to as Square);
        updateStatus(currentChess);
      }
    } catch (err: any) {
      console.error("Engine move error:", err);
      setEngineInfo("Engine calculation fallback triggered");
    } finally {
      setIsEngineThinking(false);
    }
  }, [selectedElo, updateStatus, updateHighlights]);

  // Core move execution
  const executeMove = (from: Square, to: Square, promotion?: string): boolean => {
    try {
      const newGame = new Chess(chess.fen());
      const move = newGame.move({
        from,
        to,
        promotion: promotion || "q",
      });

      if (move === null) return false;

      if (move.captured) {
        chessAudio.playCapture();
      } else {
        chessAudio.playMove();
      }

      setChess(newGame);
      setFen(newGame.fen());
      setSelectedSquare(null);

      // Record move history in standard paired format
      setMoveHistory((prev) => {
        if (move.color === "w") {
          return [...prev, { white: move.san }];
        } else {
          const last = prev[prev.length - 1];
          if (last && !last.black) {
            return [...prev.slice(0, -1), { white: last.white, black: move.san }];
          }
          return [...prev, { white: "...", black: move.san }];
        }
      });

      updateHighlights(null, from, to);
      updateStatus(newGame);

      if (!isClockRunning && timeControl !== "untimed") {
        setIsClockRunning(true);
      }

      // If playing AI (not Pass & Play), schedule AI response
      const shouldTriggerAI = !isPassAndPlay;
      if (!newGame.isGameOver() && shouldTriggerAI) {
        setTimeout(() => {
          triggerEngineMove(newGame);
        }, 320);
      }

      return true;
    } catch {
      return false;
    }
  };

  // Click-to-Move / Tap-to-Move (Essential for Pi Browser mobile & desktop)
  const onSquareClick = (square: Square) => {
    if (winner !== null || isEngineThinking) return;

    // Check ranked modal
    if (mode === "ranked" && !hasRankedAccess) {
      onOpenRankedModal?.();
      return;
    }

    if (!selectedSquare) {
      const piece = chess.get(square);
      if (piece && piece.color === chess.turn()) {
        setSelectedSquare(square);
        updateHighlights(square);
      }
      return;
    }

    // If clicking same square, deselect
    if (selectedSquare === square) {
      setSelectedSquare(null);
      updateHighlights(null);
      return;
    }

    // If clicking another piece of current player's color, switch selection
    const targetPiece = chess.get(square);
    if (targetPiece && targetPiece.color === chess.turn()) {
      setSelectedSquare(square);
      updateHighlights(square);
      return;
    }

    // Check promotion
    const movingPiece = chess.get(selectedSquare);
    const isPawn = movingPiece && movingPiece.type === "p";
    const isPromotionRank =
      (movingPiece?.color === "w" && square.endsWith("8")) ||
      (movingPiece?.color === "b" && square.endsWith("1"));

    if (isPawn && isPromotionRank) {
      const legalMoves = chess.moves({ square: selectedSquare, verbose: true });
      const isLegal = legalMoves.some((m) => m.to === square && m.promotion);
      if (isLegal) {
        setPendingPromotion({ from: selectedSquare, to: square });
        return;
      }
    }

    const success = executeMove(selectedSquare, square, "q");
    if (!success) {
      setSelectedSquare(null);
      updateHighlights(null);
    }
  };

  // Drag-and-drop handler
  const onDrop = (sourceSquare: Square, targetSquare: Square): boolean => {
    if (winner !== null || isEngineThinking) return false;

    if (mode === "ranked" && !hasRankedAccess) {
      onOpenRankedModal?.();
      return false;
    }

    const movingPiece = chess.get(sourceSquare);
    const isPawn = movingPiece && movingPiece.type === "p";
    const isPromotionRank =
      (movingPiece?.color === "w" && targetSquare.endsWith("8")) ||
      (movingPiece?.color === "b" && targetSquare.endsWith("1"));

    if (isPawn && isPromotionRank) {
      const legalMoves = chess.moves({ square: sourceSquare, verbose: true });
      const isLegal = legalMoves.some((m) => m.to === targetSquare && m.promotion);
      if (isLegal) {
        setPendingPromotion({ from: sourceSquare, to: targetSquare });
        return false;
      }
    }

    return executeMove(sourceSquare, targetSquare, "q");
  };

  const handleSelectPromotion = (piece: "q" | "r" | "b" | "n") => {
    if (!pendingPromotion) return;
    const { from, to } = pendingPromotion;
    setPendingPromotion(null);
    executeMove(from, to, piece);
  };

  // Launch a new match from lobby
  const startMatch = (chosenMode: GameMode, passAndPlay: boolean = false) => {
    onModeChange(chosenMode);
    setIsPassAndPlay(passAndPlay);

    const freshGame = new Chess();
    setChess(freshGame);
    setFen(freshGame.fen());
    setMoveHistory([]);
    setWinner(null);
    setWinReason("");
    setGameStatus("White to move");
    setSelectedSquare(null);
    setCustomSquareStyles({});
    setShowForfeitModal(false);
    setShowDrawOffer(false);
    setIsOpponentDisconnected(false);

    // Initialize clocks based on chosen time control
    const clockSeconds =
      timeControl === "5m" ? 300 : timeControl === "10m" ? 600 : timeControl === "24h" ? 86400 : 0;
    setWhiteClock(clockSeconds);
    setBlackClock(clockSeconds);
    setIsClockRunning(false);

    setEngineInfo(`Maia ${selectedElo} Ready`);
    setViewState("match");
  };

  // Resign / Forfeit
  const handleConfirmForfeit = () => {
    setShowForfeitModal(false);
    setWinner("black");
    setWinReason("Match forfeited by player.");
    setIsClockRunning(false);
    onMatchComplete?.("loss", activeStake * 2);
  };

  // Offer Draw
  const handleOfferDraw = () => {
    setShowDrawOffer(false);
    setWinner("draw");
    setWinReason("Match drawn by mutual agreement. Stakes refunded.");
    setIsClockRunning(false);
    onMatchComplete?.("draw", activeStake * 2);
  };

  // Format clock time
  const formatTime = (seconds: number) => {
    if (timeControl === "untimed") return "∞ Untimed";
    if (timeControl === "24h") {
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return `${hrs}h ${mins}m left`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const { whiteCaptured, blackCaptured, advantage } = getCapturedAndAdvantage();

  // ==========================================
  // RENDER: LOBBY / MATCH SELECTION VIEW
  // ==========================================
  if (viewState === "lobby") {
    return (
      <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="max-w-2xl relative z-10">
            <span className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Choose Your Match Format</span>
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
              Select Gameplay & Play Distraction-Free
            </h2>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Once you enter the match, all extra panels vanish so you can focus entirely on the board.
              Choose AI difficulty, wager stakes, or casual local play.
            </p>
          </div>
          <div className="absolute right-0 top-0 -mt-8 -mr-8 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Game Mode Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Option 1: Maia AI Challenge */}
          <div className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 flex flex-col justify-between shadow-xl transition group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-4 group-hover:scale-105 transition">
                <Bot className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-100 mb-1">Play vs. Maia AI</h3>
              <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                Calibrated human-like chess AI. Tactical depth calibrated to real ratings.
              </p>

              {/* ELO Selector */}
              <div className="space-y-1.5 mb-4">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Select Difficulty:
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {[
                    { elo: 1100, label: "Casual" },
                    { elo: 1500, label: "Club" },
                    { elo: 1900, label: "Master" },
                  ].map((item) => (
                    <button
                      key={item.elo}
                      onClick={() => setSelectedElo(item.elo)}
                      className={`py-1.5 rounded-lg text-xs font-bold transition flex flex-col items-center ${
                        selectedElo === item.elo
                          ? "bg-amber-500 text-slate-950 shadow-md"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <span>{item.elo}</span>
                      <span className="text-[9px] opacity-75">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Control */}
              <div className="space-y-1.5 mb-5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Time Rule:
                </label>
                <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
                  {[
                    { id: "untimed", label: "None" },
                    { id: "5m", label: "5 Min" },
                    { id: "10m", label: "10 Min" },
                    { id: "24h", label: "24h Daily" },
                  ].map((tc) => (
                    <button
                      key={tc.id}
                      onClick={() => setTimeControl(tc.id as TimeControl)}
                      className={`py-1 rounded-md font-semibold transition text-center ${
                        timeControl === tc.id
                          ? "bg-indigo-600 text-white"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {tc.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => startMatch("maia", false)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold text-sm hover:from-amber-400 hover:to-amber-500 transition shadow-lg shadow-amber-500/20"
            >
              Start Game vs AI
            </button>
          </div>

          {/* Option 2: 1v1 Staked Escrow Match */}
          <div className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 flex flex-col justify-between shadow-xl transition group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center mb-4 group-hover:scale-105 transition">
                <Swords className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-100 mb-1">1v1 Staked Match</h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Compete for CHESS tokens in an automated smart escrow. 5% protocol rake applies to winner.
              </p>

              {/* Stake Amount Selector */}
              <div className="space-y-1.5 mb-4">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Stake Amount (CHESS):
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[5, 10, 25, 50].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setActiveStake(amt)}
                      className={`py-1.5 rounded-lg text-xs font-bold font-mono transition border ${
                        activeStake === amt
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pot & Payout Preview */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 mb-4 text-xs space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Prize Pool:</span>
                  <span className="font-mono font-bold text-slate-200">{activeStake * 2} CHESS</span>
                </div>
                <div className="flex justify-between text-indigo-300 font-semibold">
                  <span>Winner Payout (95%):</span>
                  <span className="font-mono font-bold">{(activeStake * 2 * 0.95).toFixed(1)} CHESS</span>
                </div>
                <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
                  🛡️ 1-hour outage protection enabled for network drops.
                </div>
              </div>

              {/* Time Control */}
              <div className="space-y-1.5 mb-5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Time Rule:
                </label>
                <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
                  {[
                    { id: "untimed", label: "None" },
                    { id: "5m", label: "5 Min" },
                    { id: "10m", label: "10 Min" },
                    { id: "24h", label: "24h Daily" },
                  ].map((tc) => (
                    <button
                      key={tc.id}
                      onClick={() => setTimeControl(tc.id as TimeControl)}
                      className={`py-1 rounded-md font-semibold transition text-center ${
                        timeControl === tc.id
                          ? "bg-indigo-600 text-white"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {tc.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => startMatch("wager", false)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-bold text-sm hover:from-indigo-500 hover:to-indigo-600 transition shadow-lg shadow-indigo-600/30"
            >
              Start 1v1 Staked Match
            </button>
          </div>

          {/* Option 3: Local 2-Player (Pass & Play) */}
          <div className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 flex flex-col justify-between shadow-xl transition group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-4 group-hover:scale-105 transition">
                <Users className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-100 mb-1">Pass & Play (Local 1v1)</h3>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                Play locally with a friend on the same screen. 100% free, zero gas, alternating turns.
              </p>

              {/* Time Control */}
              <div className="space-y-1.5 mb-6">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Time Rule:
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                  {[
                    { id: "untimed", label: "Untimed" },
                    { id: "5m", label: "5 Min Blitz" },
                    { id: "10m", label: "10 Min Rapid" },
                  ].map((tc) => (
                    <button
                      key={tc.id}
                      onClick={() => setTimeControl(tc.id as TimeControl)}
                      className={`py-1.5 rounded-lg font-semibold transition text-center ${
                        timeControl === tc.id
                          ? "bg-emerald-600 text-white"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {tc.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => startMatch("free", true)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold text-sm hover:from-emerald-400 hover:to-teal-500 transition shadow-lg shadow-emerald-500/20"
            >
              Start Local 2-Player
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: FOCUSED MATCH ARENA VIEW
  // ==========================================
  const activeTheme = BOARD_THEMES[boardTheme];

  return (
    <div className="space-y-4 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Top Header Bar: Exit to Lobby, Theme Selector, and Sound Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 px-4 py-3 rounded-2xl shadow-lg">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setViewState("lobby")}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition border border-slate-700"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Lobby</span>
          </button>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-300">
              {mode === "wager"
                ? `⚔️ 1v1 Staked (${activeStake * 2} CHESS Pot)`
                : isPassAndPlay
                ? "👥 Local 2-Player"
                : `🤖 Maia AI (ELO ${selectedElo})`}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              {timeControl === "untimed" ? "Untimed" : `${timeControl} Clock`}
            </span>
          </div>
        </div>

        {/* Theme and Audio Buttons */}
        <div className="flex items-center space-x-2">
          {/* Board Theme Picker */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            {(Object.keys(BOARD_THEMES) as BoardThemeKey[]).map((themeKey) => (
              <button
                key={themeKey}
                onClick={() => setBoardTheme(themeKey)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                  boardTheme === themeKey
                    ? "bg-slate-800 text-white font-bold border border-slate-700"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title={BOARD_THEMES[themeKey].name}
              >
                {themeKey === "emerald"
                  ? "Emerald"
                  : themeKey === "blue"
                  ? "Blue"
                  : themeKey === "wood"
                  ? "Wood"
                  : "Slate"}
              </button>
            ))}
          </div>

          <button
            onClick={toggleMute}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition"
            title={isMuted ? "Unmute Sound" : "Mute Sound"}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </div>

      {/* 1v1 Outage Protection Banner (if disconnected) */}
      {isOpponentDisconnected && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300 animate-pulse">
          <div className="flex items-center space-x-2">
            <WifiOff className="w-4 h-4 text-amber-400" />
            <span>
              Opponent disconnected. 1-hour outage protection active. Unsettled match can be claimed as win in:{" "}
              <strong className="font-mono">
                {Math.floor(outageSecondsRemaining / 60)}m {outageSecondsRemaining % 60}s
              </strong>
            </span>
          </div>
          {outageSecondsRemaining === 0 && (
            <button
              onClick={() => {
                setWinner("white");
                setWinReason("Opponent abandoned match after 1-hour outage window.");
                onMatchComplete?.("win", activeStake * 2);
              }}
              className="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition"
            >
              Claim Victory
            </button>
          )}
        </div>
      )}

      {/* Arena Grid: Board + Opponent/Player info & Move Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Main Chessboard Column */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col items-center">
          {/* Opponent Info Bar (Top of Board) */}
          <div className="w-full flex items-center justify-between mb-3 px-2">
            <div className="flex items-center space-x-3">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center border ${
                  chess.turn() === "b" && winner === null
                    ? "border-amber-400 ring-2 ring-amber-400/30 bg-amber-500/20"
                    : "border-slate-700 bg-slate-800"
                }`}
              >
                {isPassAndPlay ? (
                  <Users className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Bot className="w-4 h-4 text-amber-400" />
                )}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-sm text-slate-100">
                    {isPassAndPlay
                      ? "Player 2 (Black)"
                      : mode === "wager"
                      ? "Pioneer_Opponent"
                      : `Maia AI (${selectedElo})`}
                  </span>
                  {chess.turn() === "b" && winner === null && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold animate-pulse">
                      THINKING...
                    </span>
                  )}
                </div>
                {/* Captured by Opponent (White pieces lost) */}
                <div className="flex items-center space-x-1 text-slate-400 text-sm mt-0.5 min-h-[20px]">
                  {blackCaptured.map((p, idx) => (
                    <span key={idx} className="leading-none text-slate-300">
                      {PIECE_GLYPHS[p]}
                    </span>
                  ))}
                  {advantage < 0 && (
                    <span className="text-[10px] font-bold text-amber-400 ml-1">+{Math.abs(advantage)}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Opponent Clock */}
            <div
              className={`px-3 py-1.5 rounded-xl font-mono text-sm font-bold border transition ${
                chess.turn() === "b" && winner === null
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-md"
                  : "bg-slate-950 text-slate-400 border-slate-800"
              }`}
            >
              {formatTime(blackClock)}
            </div>
          </div>

          {/* Interactive Chessboard */}
          <div
            ref={boardContainerRef}
            className="relative w-full max-w-[540px] rounded-2xl overflow-hidden border border-slate-700/80 shadow-2xl flex items-center justify-center bg-slate-950 p-2"
          >
            <Chessboard
              position={fen}
              onPieceDrop={onDrop}
              onSquareClick={onSquareClick}
              boardWidth={boardWidth}
              customSquareStyles={customSquareStyles}
              customBoardStyle={{
                borderRadius: "0.85rem",
                boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.5)",
              }}
              customDarkSquareStyle={{ backgroundColor: activeTheme.dark }}
              customLightSquareStyle={{ backgroundColor: activeTheme.light }}
            />

            {/* Pawn Promotion Modal Overlay */}
            {pendingPromotion && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-20 animate-in fade-in">
                <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-5 text-center shadow-2xl max-w-xs w-full">
                  <h4 className="text-sm font-bold text-amber-400 mb-1">Promote Your Pawn</h4>
                  <p className="text-xs text-slate-400 mb-4">Choose promotion piece:</p>
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
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-10 animate-in fade-in">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-3">
                  <Trophy className="w-8 h-8 text-amber-400 animate-bounce" />
                </div>
                <h3 className="text-2xl font-black text-slate-100 mb-1">
                  {winner === "white"
                    ? "Victory! White Wins"
                    : winner === "black"
                    ? "Defeat! Black Wins"
                    : "Match Drawn"}
                </h3>
                <p className="text-xs text-slate-400 mb-4">{winReason}</p>

                {mode === "wager" && activeStake > 0 && (
                  <div className="p-3 rounded-xl bg-indigo-950/50 border border-indigo-800/50 mb-5 max-w-xs text-xs">
                    {winner === "white" ? (
                      <span className="text-emerald-400 font-bold">
                        🎉 Claiming {(activeStake * 2 * 0.95).toFixed(1)} CHESS Prize Pot! (5% platform rake applied)
                      </span>
                    ) : winner === "black" ? (
                      <span className="text-rose-400 font-semibold">
                        Wager lost ({activeStake} CHESS deducted).
                      </span>
                    ) : (
                      <span className="text-indigo-300 font-semibold">
                        Draw! Full refund of {activeStake} CHESS returned to escrow.
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => startMatch(mode, isPassAndPlay)}
                    className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold text-xs hover:from-amber-300 hover:to-amber-400 transition shadow-lg"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Play Again</span>
                  </button>
                  <button
                    onClick={() => setViewState("lobby")}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 transition border border-slate-700"
                  >
                    Back to Lobby
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Player Info Bar (Bottom of Board) */}
          <div className="w-full flex items-center justify-between mt-3 px-2">
            <div className="flex items-center space-x-3">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center border ${
                  chess.turn() === "w" && winner === null
                    ? "border-emerald-400 ring-2 ring-emerald-400/30 bg-emerald-500/20"
                    : "border-slate-700 bg-slate-800"
                }`}
              >
                <span className="text-xs font-bold text-emerald-400">YOU</span>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-sm text-slate-100">Player (White)</span>
                  {chess.turn() === "w" && winner === null && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold animate-pulse">
                      YOUR TURN
                    </span>
                  )}
                </div>
                {/* Captured by Player (Black pieces lost) */}
                <div className="flex items-center space-x-1 text-slate-400 text-sm mt-0.5 min-h-[20px]">
                  {whiteCaptured.map((p, idx) => (
                    <span key={idx} className="leading-none text-slate-300">
                      {PIECE_GLYPHS[p]}
                    </span>
                  ))}
                  {advantage > 0 && (
                    <span className="text-[10px] font-bold text-emerald-400 ml-1">+{advantage}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Player Clock */}
            <div
              className={`px-3 py-1.5 rounded-xl font-mono text-sm font-bold border transition ${
                chess.turn() === "w" && winner === null
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-md"
                  : "bg-slate-950 text-slate-400 border-slate-800"
              }`}
            >
              {formatTime(whiteClock)}
            </div>
          </div>
        </div>

        {/* Sidebar: Move Notation & Match Actions */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col h-full min-h-[500px] justify-between">
          <div>
            {/* Header: Move Notation */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm text-slate-200">Move History (PGN)</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {moveHistory.length} moves
              </span>
            </div>

            {/* Two-Column Move List */}
            <div className="overflow-y-auto max-h-[320px] space-y-1 font-mono text-xs pr-1">
              {moveHistory.length === 0 ? (
                <div className="text-center py-12 text-slate-500 italic">
                  Game in progress. Tap or drag a piece to play your first move.
                </div>
              ) : (
                <div className="space-y-1">
                  {moveHistory.map((m, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-5 py-1 px-2.5 rounded-lg bg-slate-950/60 hover:bg-slate-800/80 text-slate-300 items-center"
                    >
                      <span className="text-slate-500 col-span-1">{idx + 1}.</span>
                      <span className="font-semibold text-slate-200 col-span-2">{m.white}</span>
                      <span className="font-semibold text-amber-400 col-span-2">{m.black || ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* In-Game Actions: Forfeit / Resign and Offer Draw */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            {winner === null ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowForfeitModal(true)}
                  className="py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold transition flex items-center justify-center space-x-1.5"
                >
                  <Flag className="w-3.5 h-3.5 text-rose-400" />
                  <span>Resign / Forfeit</span>
                </button>

                <button
                  onClick={handleOfferDraw}
                  className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition border border-slate-700 flex items-center justify-center space-x-1.5"
                >
                  <Handshake className="w-3.5 h-3.5 text-slate-400" />
                  <span>Offer Draw</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => startMatch(mode, isPassAndPlay)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold text-xs hover:from-amber-300 hover:to-amber-400 transition"
              >
                Rematch
              </button>
            )}

            {/* Quick Helper hint */}
            <div className="text-[11px] text-slate-500 text-center">
              💡 Tap or drag pieces. Green dots mark legal destinations.
            </div>
          </div>
        </div>
      </div>

      {/* Forfeit Confirmation Modal */}
      {showForfeitModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto mb-3">
              <Flag className="w-6 h-6 text-rose-400" />
            </div>
            <h3 className="text-base font-bold text-slate-100 mb-1">Confirm Resignation</h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              {mode === "wager"
                ? `Are you sure you want to forfeit? Your stake of ${activeStake} CHESS will be awarded to your opponent.`
                : "Are you sure you want to resign this match?"}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowForfeitModal(false)}
                className="py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 transition"
              >
                Continue Match
              </button>
              <button
                onClick={handleConfirmForfeit}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-lg shadow-rose-600/30"
              >
                Yes, Forfeit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
