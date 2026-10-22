"""Jieqi public-board rules. Hidden identities never participate in legality checks.
Rules: CXQ movement; captured covered identity is visible only to its capturer.
Public covered token: rUR = red covered piece at the original rook position.
"""
import secrets
from . import chess

COVERED = {side+'U'+kind for side in 'rb' for kind in 'AEHRCP'}

def initial():
    board = chess.initial()
    identities = {}
    for side in 'rb':
        cells = [i for i,p in enumerate(board) if p and p[0] == side and p[1] != 'K']
        pool = [board[i] for i in cells]
        secrets.SystemRandom().shuffle(pool)
        for i, actual in zip(cells, pool):
            identities[str(i)] = actual
            board[i] = side+'U'+board[i][1]
    return board, identities

def pseudo(board, f, t):
    if type(f) is not int or type(t) is not int or not (0 <= f < 90 and 0 <= t < 90): return False
    p = board[f]
    if not p or f == t or (board[t] and board[t][0] == p[0]): return False
    if p in COVERED:
        visible = board.copy(); visible[f] = p[0]+p[2]
        return chess.pseudo(visible, f, t)
    x,y,X,Y = f%9,f//9,t%9,t//9
    dx,dy = X-x,Y-y
    if p[1] == 'A': return abs(dx) == abs(dy) == 1
    if p[1] == 'E': return abs(dx) == abs(dy) == 2 and not board[(y+dy//2)*9+x+dx//2]
    return chess.pseudo(board, f, t)

def check(board, side):
    if side+'K' not in board: return True
    king = board.index(side+'K')
    return any(p and p[0] != side and pseudo(board,i,king) for i,p in enumerate(board))

def legal(board, f, t):
    return pseudo(board,f,t) and not check(chess.moved(board,f,t),board[f][0])

def has_moves(board, side):
    return any(legal(board,f,t) for f,p in enumerate(board) if p and p[0] == side for t in range(90))

def apply(board, identities, f, t):
    """Return new public board, remaining secrets, public move and private capture."""
    if not legal(board,f,t): raise ValueError('Nước đi cờ úp không hợp lệ.')
    p,captured = board[f],board[t]
    remaining = dict(identities)
    revealed = remaining.pop(str(f)) if p in COVERED else p
    captured_identity = remaining.pop(str(t), None) if captured in COVERED else None
    moved = board.copy(); moved[f]=None; moved[t]=revealed
    move = {'from':f,'to':t,'piece':p,'captured':captured}
    if p in COVERED: move['revealed']=revealed
    return moved,remaining,move,captured_identity
