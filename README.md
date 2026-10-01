# ♟️ Pi Maia Chess (Chess-Token)

> **Decentralized Human-AI Chess Ecosystem on the Pi Network**  
> Calibrated Maia AI difficulty, 1v1 tokenized escrow wagers, bonding curve AMM, and a distraction-free responsive UI designed for desktop and mobile Pi Browser.

---

## 🌟 Overview

**Pi Maia Chess** bridges human-like chess AI with Web3 tokenomics on the Pi Network. It combines:
- **Calibrated Maia Chess Engine**: Move selection powered by Alpha-Beta Minimax search, Quiescence search, Piece-Square Tables (PSTs), an opening book, and ELO-calibrated tiers (1100, 1500, 1900).
- **Match-First UI/UX**: Clean separation between the **Game Lobby** (match setup) and **Focused Match Arena** (distraction-free chess board with move hints, live clocks, and captured piece trays).
- **Pi Network & Solo Host Friendly**: Designed for mobile Pi Browser WebView and desktop browsers with native **Tap-to-Move**, responsive viewports, and zero-gas free casual play.
- **Web3 Tokenomics & Escrow**: ERC-20 CHESS tokens with an automated bonding curve AMM, 1v1 staked escrow matches with a 5% protocol fee, and a 1-hour network outage protection grace period.

---

## 🚀 Key Features

### 1. 🤖 Calibrated AI Engine (1100 / 1500 / 1900 ELO)
- **Minimax with Alpha-Beta Pruning**: Multi-ply lookahead search replacing naive 1-ply heuristics.
- **Quiescence Search**: Evaluates capture sequences to completely eliminate the horizon effect (the AI won't hang pieces into defended squares).
- **Move Ordering (MVV-LVA)**: Prioritizes tactical captures, promotions, and checks for fast, deep calculation.
- **Piece-Square Tables (PST)**: Comprehensive positional evaluations for Pawns, Knights, Bishops, Rooks, Queens, and Kings (opening, middlegame, and endgame).
- **Opening Book**: Standard master-level opening responses (`e4`, `d4`, `c4`, Sicilian, French, Caro-Kann, Italian, etc.).
- **Difficulty Tiers**:
  - **1100 (Casual)**: Natural openings, slight evaluation variance, beatable by beginners.
  - **1500 (Club)**: Strong tactical defense, capitalizes on opponent blunders.
  - **1900 (Master)**: Sharp tactical depth, king safety awareness, and active piece coordination.
- **Client-Side Fallback**: Built-in TypeScript alpha-beta engine in the frontend so the game plays smoothly even if the Python backend is starting up or offline.

---

### 2. 🎯 Redesigned UI/UX (Lobby vs. Focused Match Arena)
- **Lobby View (Setup)**:
  - Select your match: **Play vs. Maia AI**, **1v1 Staked Match**, or **Pass & Play (Local 2-Player)**.
  - Choose time controls, difficulty, and stakes.
- **Focused Match Arena (Active Play)**:
  - All setup forms and side tabs disappear during active play.
  - **Click-to-Move / Tap-to-Move**: Click a piece to view legal moves, click a square to move (ideal for Pi Browser touchscreens and trackpads).
  - **Visual Move Hints**: Green dots on legal destination squares and red target rings on capturable enemy pieces.
  - **Check Highlight**: Pulsing red indicator on the king square when in check.
  - **Board Themes**: Real-time switcher between *Emerald Green*, *Tournament Blue*, *Classic Wood*, and *Midnight Slate*.
  - **Live Captured Pieces & Material Counter**: Displays captured pieces for both sides with live material count (`+1`, `+3`, `+5`).
  - **Two-Column PGN Move List**: Professional move notation history (`Turn | White | Black`).
  - **In-Game Actions**: Resign/Forfeit with confirmation, Offer Draw, and Rematch.

---

### 3. ⏱️ Flexible Time Rules & Outage Protection
- **Configurable Time Rules**:
  - **Untimed**: Casual, unhurried chess.
  - **5 Min Blitz** & **10 Min Rapid**: Classic competitive chess clocks.
  - **24-Hour Daily / Correspondence**: For busy players making moves throughout the day.
- **🛡️ 1-Hour Network Outage Protection**:
  - In 1v1 staked matches, network disconnects or closing the Pi Browser activate a **1-hour grace period** countdown so real tokens are protected against battery dying or cell tower handoffs. If the match remains unsettled after 1 hour, the remaining player can claim the win.

---

### 4. 📈 Dedicated Bonding Curve AMM & Tokenomics
- Separated into its own top-level tab (**CHESS Bonding Curve**) so financial tokenomics do not crowd or distract from active chess games.
- **Automated Pricing**: Deterministic price curve based on supply minted.
- **60% Supply Cap**: Visual progress meter tracking tokens minted vs. maximum bonding cap.
- **Mint & Burn**: Buy CHESS with Pi/ETH, or burn CHESS back to the curve for refunds.

---

## 📁 Repository Structure

```
Chess/
├── contracts/                  # Solidity smart contracts & Hardhat tests
│   ├── contracts/              # ChessToken.sol, ChessEscrow.sol, BondingCurve.sol
│   ├── scripts/                # Deployment scripts
│   └── test/                   # Smart contract test suites
├── engine/                     # Python Maia chess engine service
│   ├── server.py               # FastAPI service (Minimax, Quiescence, Opening Book)
│   ├── test_server.py          # Tactical puzzle & API test suite
│   ├── maia_weights/           # Pre-trained Maia neural network weights (.pb.gz)
│   └── requirements-server.txt # Python dependencies (FastAPI, python-chess, uvicorn)
├── frontend/                   # Next.js 14 Web3 application
│   ├── src/
│   │   ├── app/                # Next.js App Router (page.tsx, layout.tsx, globals.css)
│   │   ├── components/         # ChessGame, BondingCurveCard, TournamentPool, etc.
│   │   ├── lib/                # chess-engine.ts, chess-sounds.ts, pi-sdk-mock.ts
│   │   └── types/              # Pi SDK & Chess types
│   └── package.json            # React, Chess.js, React-Chessboard, TailwindCSS
├── start-all.bat               # Windows batch one-click launcher
├── start-all.ps1               # PowerShell one-click launcher
└── README.md                   # Project documentation
```

---

## 🛠️ Quickstart & Local Setup

### Prerequisites
- **Node.js**: v18.0 or higher
- **Python**: 3.10 to 3.12 (with `pip`)
- **Git**

---

### 1. One-Click Launch (Windows)
Run either script from the project root:

```powershell
# Using PowerShell:
.\start-all.ps1

# Or using Batch:
.\start-all.bat
```

This starts:
1. **Frontend**: Next.js app on [http://localhost:3000](http://localhost:3000)
2. **Engine**: FastAPI engine on [http://localhost:8000](http://localhost:8000)

---

### 2. Manual Startup

#### Step A: Python Chess Engine
```bash
cd engine
pip install -r requirements-server.txt
python server.py
```
*API health check available at `http://localhost:8000/api/health`.*

#### Step B: Next.js Frontend
```bash
cd frontend
npm install
npm run dev
```
*Open [http://localhost:3000](http://localhost:3000) in your browser or Pi Browser sandbox.*

#### Step C: Smart Contracts (Optional / Development)
```bash
cd contracts
npm install
npx hardhat test
```

---

## 📱 Pi Network & Solo Hosting Notes

1. **Pi Browser Testing**:
   - The frontend automatically detects if it is running inside the official **Pi Browser WebView** (`window.Pi`).
   - On desktop browsers or outside the Pi Browser, it automatically falls back to an integrated sandbox mock (`pi-sdk-mock.ts`) with test balances and a faucet reset button.
2. **Solo Host Optimization**:
   - The engine and client fallbacks are fully self-contained without requiring heavy external GPU servers or bulky remote APIs.
   - Built-in client-side alpha-beta chess engine ensures games never freeze even on intermittent mobile connections.

---

## 📜 Acknowledgements & Research Citation

The neural network weights and baseline human chess modeling research are developed by the University of Toronto CSSLab:
- *Aligning Superhuman AI with Human Behavior: Chess as a Model System* (McIlroy-Young et al., KDD 2020)
- [Maia Chess Official Site](https://maiachess.com)

---

## ⚖️ License

This project is licensed under the [MIT License](LICENSE).
