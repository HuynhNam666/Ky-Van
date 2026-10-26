export type Side = "r" | "b";
export type Board = (string | null)[];
export type Move = {
  from: number;
  to: number;
  piece: string;
  captured: string | null;
};
export const names: Record<string, string> = {
  rK: "帥",
  rA: "仕",
  rE: "相",
  rH: "傌",
  rR: "俥",
  rC: "炮",
  rP: "兵",
  bK: "將",
  bA: "士",
  bE: "象",
  bH: "馬",
  bR: "車",
  bC: "砲",
  bP: "卒",
};
export const vn: Record<string, string> = {
  K: "Tướng",
  A: "Sĩ",
  E: "Tượng",
  H: "Mã",
  R: "Xe",
  C: "Pháo",
  P: "Tốt",
};
export function initial(): Board {
  const b: Board = Array(90).fill(null);
  "RHEAKAEHR".split("").forEach((p, x) => {
    b[x] = "b" + p;
    b[81 + x] = "r" + p;
  });
  [19, 25].forEach((i) => (b[i] = "bC"));
  [64, 70].forEach((i) => (b[i] = "rC"));
  [0, 2, 4, 6, 8].forEach((x) => {
    b[27 + x] = "bP";
    b[54 + x] = "rP";
  });
  return b;
}
export const other = (s: Side): Side => (s === "r" ? "b" : "r");
function pseudo(b: Board, f: number, t: number): boolean {
  if (f === t || f < 0 || t < 0 || f >= 90 || t >= 90) return false;
  const p = b[f];
  if (!p || b[t]?.[0] === p[0]) return false;
  const x = f % 9,
    y = Math.floor(f / 9),
    X = t % 9,
    Y = Math.floor(t / 9),
    dx = X - x,
    dy = Y - y,
    a = Math.abs(dx),
    d = Math.abs(dy),
    r = p[0] === "r";
  let n = 0;
  if (x === X || y === Y) {
    const step = x === X ? (dy > 0 ? 9 : -9) : dx > 0 ? 1 : -1;
    for (let i = f + step; i !== t; i += step) if (b[i]) n++;
  }
  const palace = X >= 3 && X <= 5 && (r ? Y >= 7 : Y <= 2);
  switch (p[1]) {
    case "K":
      return (
        (b[t] === other(p[0] as Side) + "K" && x === X && n === 0) ||
        (a + d === 1 && palace)
      );
    case "A":
      return a === 1 && d === 1 && palace;
    case "E":
      return (
        a === 2 &&
        d === 2 &&
        (r ? Y >= 5 : Y <= 4) &&
        !b[(y + dy / 2) * 9 + x + dx / 2]
      );
    case "H":
      return (
        (a === 2 && d === 1 && !b[y * 9 + x + dx / 2]) ||
        (a === 1 && d === 2 && !b[(y + dy / 2) * 9 + x])
      );
    case "R":
      return (x === X || y === Y) && n === 0;
    case "C":
      return (x === X || y === Y) && (b[t] ? n === 1 : n === 0);
    case "P":
      return (
        (dx === 0 && dy === (r ? -1 : 1)) ||
        ((r ? y <= 4 : y >= 5) && a === 1 && dy === 0)
      );
    default:
      return false;
  }
}
export function check(b: Board, s: Side) {
  const k = b.indexOf(s + "K");
  return k < 0 || b.some((p, i) => p?.[0] === other(s) && pseudo(b, i, k));
}
export function moved(b: Board, f: number, t: number) {
  const c = b.slice();
  c[t] = c[f];
  c[f] = null;
  return c;
}
export function legal(b: Board, f: number, t: number) {
  const p = b[f];
  return !!p && pseudo(b, f, t) && !check(moved(b, f, t), p[0] as Side);
}
export function allMoves(b: Board, s: Side) {
  const ms: Move[] = [];
  b.forEach((p, f) => {
    if (p?.[0] === s)
      for (let t = 0; t < 90; t++)
        if (legal(b, f, t))
          ms.push({ from: f, to: t, piece: p, captured: b[t] });
  });
  return ms;
}
const value: Record<string, number> = {
  K: 100000,
  R: 900,
  C: 450,
  H: 400,
  E: 200,
  A: 200,
  P: 100,
};
function evaluate(b: Board) {
  return b.reduce(
    (sum, p, i) =>
      sum +
      (p
        ? (p[0] === "b" ? 1 : -1) *
          (value[p[1]] +
            (p[1] === "P"
              ? (p[0] === "b" ? Math.floor(i / 9) : 9 - Math.floor(i / 9)) * 9
              : 0))
        : 0),
    0,
  );
}
export function chooseMove(b: Board, s: Side, depth = 2): Move | null {
  let nodes = 0;
  function search(
    c: Board,
    side: Side,
    d: number,
    alpha: number,
    beta: number,
  ): number {
    if (++nodes > 14000 || d === 0) return evaluate(c);
    const ms = allMoves(c, side).sort(
      (a, b) =>
        (b.captured ? value[b.captured[1]] : 0) -
        (a.captured ? value[a.captured[1]] : 0),
    );
    if (!ms.length) return side === "b" ? -999999 : 999999;
    let best = side === "b" ? -Infinity : Infinity;
    for (const m of ms) {
      const v = search(moved(c, m.from, m.to), other(side), d - 1, alpha, beta);
      best = side === "b" ? Math.max(best, v) : Math.min(best, v);
      if (side === "b") alpha = Math.max(alpha, best);
      else beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
  const ms = allMoves(b, s);
  let best = s === "b" ? -Infinity : Infinity;
  let result: Move | null = null;
  for (const m of ms) {
    const v =
      search(moved(b, m.from, m.to), other(s), depth - 1, -Infinity, Infinity) +
      Math.random() * 0.5;
    if (s === "b" ? v > best : v < best) {
      best = v;
      result = m;
    }
  }
  return result;
}
export function label(m: Move) {
  return `${vn[m.piece[1]]} ${String.fromCharCode(97 + (m.from % 9))}${10 - Math.floor(m.from / 9)} → ${String.fromCharCode(97 + (m.to % 9))}${10 - Math.floor(m.to / 9)}`;
}
export function validSave(
  v: unknown,
): v is { board: Board; turn: Side; history: Move[] } {
  if (!v || typeof v !== "object") return false;
  const a = v as { board: Board; turn: Side; history: Move[] };
  return (
    Array.isArray(a.board) &&
    a.board.length === 90 &&
    a.board.every((p) => p === null || Object.keys(names).includes(p)) &&
    ["r", "b"].includes(a.turn) &&
    Array.isArray(a.history) &&
    a.history.length < 5000 &&
    a.history.every(
      (m) =>
        Number.isInteger(m.from) &&
        m.from >= 0 &&
        m.from < 90 &&
        Number.isInteger(m.to) &&
        m.to >= 0 &&
        m.to < 90 &&
        Object.keys(names).includes(m.piece) &&
        (m.captured === null || Object.keys(names).includes(m.captured)),
    ) &&
    a.board.filter((p) => p === "rK").length === 1 &&
    a.board.filter((p) => p === "bK").length === 1
  );
}

// ======================================================
// BỔ SUNG: NHẬN BIẾT NƯỚC ĐI LÀM TƯỚNG MÌNH BỊ CHIẾU
// Giữ nguyên tất cả các hàm và luật chơi phía trên.
// ======================================================

// Trả về true khi:
// - Ô xuất phát có quân.
// - Nước đi đúng cách di chuyển và điều kiện vật cản của quân.
// - Sau nước đi, Tướng của bên di chuyển bị chiếu.
//
// Hàm chỉ kiểm tra trên bản sao, không thay đổi bàn cờ hiện tại.
// Giao diện dùng kết quả để hiện cảnh báo và phát âm thanh.
export function wouldExposeKing(b: Board, f: number, t: number): boolean {
  const p = b[f];
  return !!p && pseudo(b, f, t) && check(moved(b, f, t), p[0] as Side);
}
