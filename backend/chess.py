"""Xiangqi legality, including check, flying generals and stalemate."""
TYPES = 'KAEHRCP'

def initial():
    b = [None] * 90
    for x, p in enumerate('RHEAKAEHR'):
        b[x], b[81+x] = 'b'+p, 'r'+p
    for i in (19, 25): b[i] = 'bC'
    for i in (64, 70): b[i] = 'rC'
    for x in (0, 2, 4, 6, 8): b[27+x], b[54+x] = 'bP', 'rP'
    return b

def other(s): return 'b' if s == 'r' else 'r'

def pseudo(b, f, t):
    if not (0 <= f < 90 and 0 <= t < 90) or f == t or not b[f]: return False
    p = b[f]
    if b[t] and b[t][0] == p[0]: return False
    x, y, X, Y = f % 9, f // 9, t % 9, t // 9
    dx, dy, r = X-x, Y-y, p[0] == 'r'
    a, d = abs(dx), abs(dy)
    n = 0
    if x == X or y == Y:
        step = (9 if dy > 0 else -9) if x == X else (1 if dx > 0 else -1)
        n = sum(bool(b[i]) for i in range(f+step, t, step))
    palace = 3 <= X <= 5 and (Y >= 7 if r else Y <= 2)
    kind = p[1]
    if kind == 'K': return (b[t] == other(p[0])+'K' and x == X and n == 0) or (a+d == 1 and palace)
    if kind == 'A': return a == d == 1 and palace
    if kind == 'E': return a == d == 2 and (Y >= 5 if r else Y <= 4) and not b[(y+dy//2)*9+x+dx//2]
    if kind == 'H': return (a == 2 and d == 1 and not b[y*9+x+dx//2]) or (a == 1 and d == 2 and not b[(y+dy//2)*9+x])
    if kind == 'R': return (x == X or y == Y) and n == 0
    if kind == 'C': return (x == X or y == Y) and n == (1 if b[t] else 0)
    if kind == 'P': return (dx == 0 and dy == (-1 if r else 1)) or ((y <= 4 if r else y >= 5) and a == 1 and dy == 0)
    return False

def check(b, side):
    if side+'K' not in b: return True
    king = b.index(side+'K')
    return any(p and p[0] != side and pseudo(b, i, king) for i, p in enumerate(b))

def moved(b, f, t):
    c = b.copy(); c[t], c[f] = c[f], None
    return c

def legal(b, f, t):
    return pseudo(b, f, t) and not check(moved(b, f, t), b[f][0])

def has_moves(b, side):
    return any(legal(b, f, t) for f, p in enumerate(b) if p and p[0] == side for t in range(90))

def valid_position(b, turn):
    return isinstance(b, list) and len(b) == 90 and turn in ('r','b') and all(p is None or (isinstance(p,str) and len(p)==2 and p[0] in 'rb' and p[1] in TYPES) for p in b) and b.count('rK') == b.count('bK') == 1
