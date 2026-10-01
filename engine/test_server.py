import unittest
import chess
from fastapi.testclient import TestClient
from server import app, evaluate_board, select_move_for_elo

class TestMaiaEngineServer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_health_check(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertTrue(data["chess_library_ready"])
        self.assertIn(1500, data["supported_elos"])

    def test_board_evaluation_initial(self):
        board = chess.Board()
        # Initial starting position is symmetric
        score = evaluate_board(board)
        self.assertEqual(score, 0)

    def test_move_generation_starting_position(self):
        board = chess.Board()
        for elo in [1100, 1500, 1900]:
            uci_move, san_move, eval_val = select_move_for_elo(board, elo)
            self.assertTrue(len(uci_move) >= 4)
            self.assertTrue(chess.Move.from_uci(uci_move) in board.legal_moves)

    def test_api_move_endpoint_valid_request(self):
        payload = {
            "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            "elo": 1500
        }
        response = self.client.post("/api/move", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("move", data)
        self.assertIn("san", data)
        self.assertEqual(data["elo"], 1500)
        self.assertEqual(data["status"], "ok")

    def test_api_move_endpoint_invalid_fen(self):
        payload = {
            "fen": "invalid_fen_string_here",
            "elo": 1500
        }
        response = self.client.post("/api/move", json=payload)
        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid FEN", response.json()["detail"])

    def test_api_move_endpoint_game_over_state(self):
        # Scholar's mate FEN (checkmate)
        checkmate_fen = "r1bqkb1r/pppp1Qpp/2n5/4p3/2B1n3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4"
        payload = {
            "fen": checkmate_fen,
            "elo": 1500
        }
        response = self.client.post("/api/move", json=payload)
        self.assertEqual(response.status_code, 400)
        self.assertIn("already over", response.json()["detail"])

if __name__ == "__main__":
    unittest.main()
