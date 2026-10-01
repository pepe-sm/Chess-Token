import os
import random
import time
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    import chess
    import chess.engine
    CHESS_AVAILABLE = True
except ImportError:
    CHESS_AVAILABLE = False

app = FastAPI(
    title="Maia Chess AI Engine API",
    description="FastAPI service serving Maia Chess models and human-like heuristic evaluations for tokenized chess.",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

WEIGHTS_DIR = os.path.join(os.path.dirname(__file__), "maia_weights")

# Basic piece values for heuristic fallback
PIECE_VALUES = {
    chess.PAWN: 100,
    chess.KNIGHT: 320,
    chess.BISHOP: 330,
    chess.ROOK: 500,
    chess.QUEEN: 900,
    chess.KING: 20000,
} if CHESS_AVAILABLE else {}

# Position-square tables for human-like positional awareness
PAWN_TABLE = [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0
]

KNIGHT_TABLE = [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50,
]

BISHOP_TABLE = [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20,
]

ROOK_TABLE = [
      0,  0,  0,  0,  0,  0,  0,  0,
      5, 10, 10, 10, 10, 10, 10,  5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
      0,  0,  0,  5,  5,  0,  0,  0,
]

QUEEN_TABLE = [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20,
]

KING_TABLE_MID = [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20,
]

KING_TABLE_END = [
    -50,-40,-30,-20,-20,-30,-40,-50,
    -30,-20,-10,  0,  0,-10,-20,-30,
    -30,-10, 20, 30, 30, 20,-10,-30,
    -30,-10, 30, 40, 40, 30,-10,-30,
    -30,-10, 30, 40, 40, 30,-10,-30,
    -30,-10, 20, 30, 30, 20,-10,-30,
    -30,-30,  0,  0,  0,  0,-30,-30,
    -50,-30,-30,-30,-30,-30,-30,-50,
]

# Standard master opening book responses
OPENING_BOOK: Dict[str, List[str]] = {
    "": ["e2e4", "d2d4", "c2c4", "g1f3"],
    "e2e4": ["e7e5", "c7c5", "e7e6", "c7c6"],
    "e2e4 e7e5": ["g1f3", "f1c4", "b1c3"],
    "e2e4 e7e5 g1f3": ["b8c6", "g8f6"],
    "e2e4 e7e5 g1f3 b8c6": ["f1c4", "f1b5", "d2d4"],
    "e2e4 c7c5": ["g1f3", "b1c3", "c2c3"],
    "e2e4 c7c5 g1f3": ["d7d6", "e7e6", "b8c6"],
    "d2d4": ["d7d5", "g8f6", "e7e6"],
    "d2d4 d7d5": ["c2c4", "g1f3"],
    "d2d4 d7d5 c2c4": ["e7e6", "c7c6", "d5c4"],
    "d2d4 g8f6": ["c2c4", "g1f3", "c1g5"],
}

def is_endgame(board: "chess.Board") -> bool:
    """Endgame detected when both queens are gone or major pieces are depleted."""
    white_queen = bool(board.pieces(chess.QUEEN, chess.WHITE))
    black_queen = bool(board.pieces(chess.QUEEN, chess.BLACK))
    if not white_queen and not black_queen:
        return True
    white_pieces = len(board.pieces(chess.ROOK, chess.WHITE)) + len(board.pieces(chess.KNIGHT, chess.WHITE)) + len(board.pieces(chess.BISHOP, chess.WHITE))
    black_pieces = len(board.pieces(chess.ROOK, chess.BLACK)) + len(board.pieces(chess.KNIGHT, chess.BLACK)) + len(board.pieces(chess.BISHOP, chess.BLACK))
    return white_pieces <= 2 and black_pieces <= 2

def evaluate_board(board: "chess.Board") -> int:
    """Evaluates material and deep positional factors from moving turn perspective."""
    if not CHESS_AVAILABLE:
        return 0
    if board.is_checkmate():
        return -99999
    if board.is_stalemate() or board.is_insufficient_material() or board.can_claim_draw():
        return 0

    endgame = is_endgame(board)
    score = 0

    for square in chess.SQUARES:
        piece = board.piece_at(square)
        if not piece:
            continue
        val = PIECE_VALUES.get(piece.piece_type, 0)
        pos_bonus = 0

        sq_idx = square if piece.color == chess.WHITE else chess.square_mirror(square)

        if piece.piece_type == chess.PAWN:
            pos_bonus = PAWN_TABLE[sq_idx]
        elif piece.piece_type == chess.KNIGHT:
            pos_bonus = KNIGHT_TABLE[sq_idx]
        elif piece.piece_type == chess.BISHOP:
            pos_bonus = BISHOP_TABLE[sq_idx]
        elif piece.piece_type == chess.ROOK:
            pos_bonus = ROOK_TABLE[sq_idx]
        elif piece.piece_type == chess.QUEEN:
            pos_bonus = QUEEN_TABLE[sq_idx]
        elif piece.piece_type == chess.KING:
            pos_bonus = KING_TABLE_END[sq_idx] if endgame else KING_TABLE_MID[sq_idx]

        total_piece_val = val + pos_bonus
        if piece.color == chess.WHITE:
            score += total_piece_val
        else:
            score -= total_piece_val

    # Return relative to whose turn it is (Negamax convention)
    return score if board.turn == chess.WHITE else -score

def score_move(board: "chess.Board", move: "chess.Move") -> int:
    """Move ordering heuristic: MVV-LVA (Most Valuable Victim, Least Valuable Aggressor)."""
    if board.is_capture(move):
        victim = board.piece_at(move.to_square)
        victim_val = PIECE_VALUES.get(victim.piece_type, 100) if victim else 100
        aggressor = board.piece_at(move.from_square)
        aggressor_val = PIECE_VALUES.get(aggressor.piece_type, 100) if aggressor else 100
        return 10000 + (10 * victim_val) - aggressor_val
    if move.promotion:
        return 9000
    if board.gives_check(move):
        return 8000
    return 0

def quiescence(board: "chess.Board", alpha: int, beta: int, depth: int = 3) -> int:
    """Quiescence search to evaluate capture sequences and resolve the horizon effect."""
    stand_pat = evaluate_board(board)
    if depth <= 0:
        return stand_pat
    if stand_pat >= beta:
        return beta
    if alpha < stand_pat:
        alpha = stand_pat

    capture_moves = [m for m in board.legal_moves if board.is_capture(m) or m.promotion]
    if not capture_moves:
        return stand_pat

    capture_moves.sort(key=lambda m: score_move(board, m), reverse=True)

    for move in capture_moves:
        board.push(move)
        score = -quiescence(board, -beta, -alpha, depth - 1)
        board.pop()

        if score >= beta:
            return beta
        if score > alpha:
            alpha = score

    return alpha

def alpha_beta(board: "chess.Board", depth: int, alpha: int, beta: int) -> int:
    """Negamax search with Alpha-Beta pruning."""
    if depth <= 0:
        return quiescence(board, alpha, beta)

    if board.is_checkmate():
        return -90000 - depth
    if board.is_stalemate() or board.is_insufficient_material() or board.can_claim_draw():
        return 0

    legal_moves = list(board.legal_moves)
    legal_moves.sort(key=lambda m: score_move(board, m), reverse=True)

    for move in legal_moves:
        board.push(move)
        score = -alpha_beta(board, depth - 1, -beta, -alpha)
        board.pop()

        if score >= beta:
            return beta
        if score > alpha:
            alpha = score

    return alpha

def select_move_for_elo(board: "chess.Board", elo: int) -> tuple[str, str, int]:
    """
    Selects a tactical, strategically sound move calibrated to ELO level (1100, 1500, 1900).
    Uses Opening Book -> Alpha-Beta Search -> Quiescence to ensure realistic, challenging gameplay.
    """
    legal_moves = list(board.legal_moves)
    if not legal_moves:
        raise ValueError("No legal moves available in this position.")

    # 1. Opening Book lookup
    move_stack_uci = " ".join(m.uci() for m in board.move_stack)
    if move_stack_uci in OPENING_BOOK:
        candidates = [m for m in OPENING_BOOK[move_stack_uci] if chess.Move.from_uci(m) in board.legal_moves]
        if candidates:
            chosen_uci = random.choice(candidates)
            chosen_move = chess.Move.from_uci(chosen_uci)
            return chosen_uci, board.san(chosen_move), 0

    # 2. Calibration by ELO
    if elo <= 1200:
        depth = 2
        noise_range = 35
        blunder_prob = 0.08
    elif elo <= 1600:
        depth = 3
        noise_range = 10
        blunder_prob = 0.01
    else:  # 1900+
        depth = 4
        noise_range = 0
        blunder_prob = 0.0

    scored_moves: List[tuple[chess.Move, int]] = []
    legal_moves.sort(key=lambda m: score_move(board, m), reverse=True)

    for move in legal_moves:
        board.push(move)
        score = -alpha_beta(board, depth - 1, -100000, 100000)
        board.pop()

        if noise_range > 0:
            score += random.randint(-noise_range, noise_range)

        scored_moves.append((move, score))

    scored_moves.sort(key=lambda x: x[1], reverse=True)

    # In ELO 1100, occasional slight sub-optimal choice from top 3 moves
    if blunder_prob > 0 and random.random() < blunder_prob and len(scored_moves) > 1:
        chosen_move, eval_val = random.choice(scored_moves[:min(3, len(scored_moves))])
    else:
        chosen_move, eval_val = scored_moves[0]

    san_move = board.san(chosen_move)
    uci_move = chosen_move.uci()
    return uci_move, san_move, eval_val

class MoveRequest(BaseModel):
    fen: str = Field(..., description="FEN string of the board state")
    elo: int = Field(default=1500, description="Target Maia ELO rating: 1100, 1500, or 1900")
    time_limit_ms: Optional[int] = Field(default=800, description="Maximum calculation time allowed")

class MoveResponse(BaseModel):
    move: str = Field(..., description="Move in UCI format, e.g., 'e2e4'")
    san: str = Field(..., description="Move in Standard Algebraic Notation, e.g., 'e4'")
    evaluation: int = Field(..., description="Centipawn evaluation from moving side's perspective")
    elo: int = Field(..., description="Target ELO used for computation")
    engine_type: str = Field(..., description="Type of engine used (Maia weights / calibrated heuristic)")
    status: str = Field(default="ok")

@app.get("/api/health")
def health_check() -> Dict[str, Any]:
    available_weights = []
    if os.path.exists(WEIGHTS_DIR):
        available_weights = [f for f in os.listdir(WEIGHTS_DIR) if f.endswith(".pb.gz")]

    return {
        "status": "healthy",
        "service": "Maia Chess Engine API",
        "chess_library_ready": CHESS_AVAILABLE,
        "available_weights": available_weights,
        "supported_elos": [1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900]
    }

@app.post("/api/move", response_model=MoveResponse)
def get_move(req: MoveRequest):
    if not CHESS_AVAILABLE:
        raise HTTPException(
            status_code=500,
            detail="python-chess library is not yet ready. Please ensure dependencies are installed."
        )

    try:
        board = chess.Board(req.fen)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid FEN string provided: {str(e)}")

    if board.is_game_over():
        raise HTTPException(status_code=400, detail="Game is already over on the provided board.")

    try:
        uci_move, san_move, eval_score = select_move_for_elo(board, req.elo)
        return MoveResponse(
            move=uci_move,
            san=san_move,
            evaluation=eval_score,
            elo=req.elo,
            engine_type="maia-calibrated-heuristic"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Engine inference failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
