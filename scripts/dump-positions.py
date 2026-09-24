"""Plays random games with the server rules (backend/chess.py) and prints one JSON line per position:
{"board": [...], "turn": "r", "moves": [[from, to], ...]}. Used by check-parity.mjs to compare with lib/chess.ts.
Usage: python scripts/dump-positions.py GAMES PLIES SEED"""
import json, random, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from backend.chess import initial, legal, moved, other

def moves(b, side):
    return [[f, t] for f, p in enumerate(b) if p and p[0] == side for t in range(90) if legal(b, f, t)]

games, plies, seed = (int(x) for x in sys.argv[1:4])
rnd = random.Random(seed)
for _ in range(games):
    board, side = initial(), 'r'
    for _ in range(plies):
        ms = moves(board, side)
        print(json.dumps({'board': board, 'turn': side, 'moves': ms}))
        if not ms:
            break
        f, t = rnd.choice(ms)
        board, side = moved(board, f, t), other(side)
