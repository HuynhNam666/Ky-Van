// Phá Thế Sát Cục: bộ giải "Đỏ đi trước, chiếu bí trong N nước" dùng luật cờ ở lib/chess.ts.
// Dùng chung cho trang web và script kiểm chứng thế cờ (scripts/gen-puzzles.mjs, scripts/check-puzzles.mjs).
import { allMoves, check, moved, type Board, type Move } from "./chess.ts";

const FEN_PIECE: Record<string, string> = {
  r: "R", h: "H", e: "E", a: "A", k: "K", c: "C", p: "P",
};

/** FEN cờ tướng (hàng trên cùng là phía Đen, chữ hoa = Đỏ, chữ thường = Đen). Chỉ đọc phần bàn cờ. */
export function parseFen(fen: string): Board {
  const b: Board = Array(90).fill(null);
  const rows = fen.split(" ")[0].split("/");
  if (rows.length !== 10) throw new Error("FEN phải có 10 hàng: " + fen);
  rows.forEach((row, y) => {
    let x = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) x += Number(ch);
      else {
        const kind = FEN_PIECE[ch.toLowerCase()];
        if (!kind || x > 8) throw new Error("FEN không hợp lệ: " + fen);
        b[y * 9 + x++] = (ch === ch.toLowerCase() ? "b" : "r") + kind;
      }
    }
    if (x !== 9) throw new Error("Hàng " + y + " không đủ 9 cột: " + fen);
  });
  return b;
}

export function toFen(b: Board): string {
  const rows: string[] = [];
  for (let y = 0; y < 10; y++) {
    let row = "";
    let gap = 0;
    for (let x = 0; x < 9; x++) {
      const p = b[y * 9 + x];
      if (!p) gap++;
      else {
        if (gap) row += gap;
        gap = 0;
        const k = p[1].toLowerCase();
        row += p[0] === "r" ? k.toUpperCase() : k;
      }
    }
    rows.push(row + (gap || ""));
  }
  return rows.join("/") + " w";
}

const cache = new Map<string, boolean>();

/** Đỏ đi trước có ép Đen hết nước đi (chiếu bí/hết nước) trong tối đa n nước của Đỏ không. */
export function canMate(b: Board, n: number): boolean {
  if (n <= 0) return false;
  const key = toFen(b) + n;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let ok = false;
  for (const m of allMoves(b, "r")) {
    if (leadsToMate(moved(b, m.from, m.to), n)) {
      ok = true;
      break;
    }
  }
  if (cache.size > 200000) cache.clear();
  cache.set(key, ok);
  return ok;
}

/** Sau nước đi của Đỏ (bàn c, Đen đến lượt): Đen hết nước, hoặc mọi nước Đen đều bị Đỏ chiếu bí trong n-1 nước. */
function leadsToMate(c: Board, n: number): boolean {
  const replies = allMoves(c, "b");
  if (replies.length === 0) return true;
  if (n <= 1) return false;
  return replies.every((r) => canMate(moved(c, r.from, r.to), n - 1));
}

/** Các nước đầu của Đỏ giữ được thế chiếu bí trong n nước. */
export function winningMoves(b: Board, n: number): Move[] {
  return allMoves(b, "r").filter((m) => leadsToMate(moved(b, m.from, m.to), n));
}

/** Số nước Đỏ ít nhất để chiếu bí (tối đa max), hoặc 0 nếu không có. */
export function mateDepth(b: Board, max: number): number {
  for (let n = 1; n <= max; n++) if (canMate(b, n)) return n;
  return 0;
}

/** Nước chống cự lâu nhất của Đen (thua chậm nhất) sau nước đi của Đỏ; null nếu Đen đã hết nước. */
export function bestDefence(c: Board, n: number): Move | null {
  const replies = allMoves(c, "b");
  if (!replies.length) return null;
  let best = replies[0];
  let bestLen = -1;
  for (const r of replies) {
    const after = moved(c, r.from, r.to);
    let len = 1;
    while (len < n && !canMate(after, len)) len++;
    // len = số nước Đỏ cần để chiếu bí tiếp (càng lớn Đen càng chống cự tốt)
    if (len > bestLen) {
      bestLen = len;
      best = r;
    }
  }
  return best;
}

export const inCheck = (b: Board) => check(b, "b");
