// Thế cờ do người dùng tự thêm vào Phá Thế Sát Cục: kiểm tra hợp lệ + lưu trên trình duyệt.
import { allMoves, check, type Board } from "./chess.ts";
import { mateDepth, parseFen, toFen } from "./puzzle.ts";

export type CustomPuzzle = { id: number; mate: 1 | 2 | 3; fen: string; name: string };

export const CUSTOM_KEY = "kyvan.puzzles.custom.v1";
export const MAX_CUSTOM = 50;
export const MAX_PIECES = 14; // giới hạn để bộ giải chạy nhanh trên trình duyệt
export const MAX_MATE = 3;

const RED_ADV = [66, 68, 76, 84, 86];
const BLACK_ADV = [3, 5, 13, 21, 23];
const RED_ELE = [47, 51, 63, 67, 71, 83, 87];
const BLACK_ELE = [2, 6, 18, 22, 26, 38, 42];
const RED_PALACE = [66, 67, 68, 75, 76, 77, 84, 85, 86];
const BLACK_PALACE = [3, 4, 5, 12, 13, 14, 21, 22, 23];
const LIMIT: Record<string, number> = { K: 1, A: 2, E: 2, H: 2, R: 2, C: 2, P: 5 };

/** Lỗi đầu tiên của thế cờ (tiếng Việt), hoặc null nếu hợp lệ và Đỏ đi trước. */
export function validateBoard(b: Board): string | null {
  const count: Record<string, number> = {};
  let total = 0;
  for (let i = 0; i < 90; i++) {
    const p = b[i];
    if (!p) continue;
    total++;
    count[p] = (count[p] ?? 0) + 1;
    const red = p[0] === "r";
    const col = i % 9;
    const row = Math.floor(i / 9);
    if (p[1] === "K" && !(red ? RED_PALACE : BLACK_PALACE).includes(i)) return "Tướng phải nằm trong cung.";
    if (p[1] === "A" && !(red ? RED_ADV : BLACK_ADV).includes(i)) return "Sĩ chỉ đứng ở các ô chéo trong cung.";
    if (p[1] === "E" && !(red ? RED_ELE : BLACK_ELE).includes(i)) return "Tượng chỉ đứng ở 7 ô của phía mình.";
    if (p[1] === "P") {
      const reach = red ? row <= 6 && (row <= 4 || col % 2 === 0) : row >= 3 && (row >= 5 || col % 2 === 0);
      if (!reach) return "Tốt đứng ở ô không thể tới được (chưa qua sông phải ở đúng cột xuất phát).";
    }
  }
  for (const [piece, n] of Object.entries(count))
    if (n > LIMIT[piece[1]]) return `Quá nhiều quân ${piece[0] === "r" ? "Đỏ" : "Đen"} loại này (tối đa ${LIMIT[piece[1]]}).`;
  if (count.rK !== 1 || count.bK !== 1) return "Mỗi bên cần đúng một Tướng.";
  if (total > MAX_PIECES) return `Tối đa ${MAX_PIECES} quân để kiểm tra nhanh.`;
  if (check(b, "r") || check(b, "b")) return "Có bên đang bị chiếu hoặc hai Tướng đang đối mặt.";
  if (!allMoves(b, "r").length) return "Đỏ không còn nước đi.";
  if (!allMoves(b, "b").length) return "Đen đã hết nước đi (thế này không còn gì để giải).";
  return null;
}

/** Kiểm tra và đo độ khó: trả về số nước chiếu bí ít nhất (1..3) hoặc lỗi. */
export function analyze(fen: string): { error: string } | { board: Board; mate: 1 | 2 | 3 } {
  let board: Board;
  try {
    board = parseFen(fen);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const bad = validateBoard(board);
  if (bad) return { error: bad };
  const mate = mateDepth(board, MAX_MATE);
  if (!mate) return { error: `Đỏ không ép được chiếu bí trong ${MAX_MATE} nước ở thế này.` };
  return { board, mate: mate as 1 | 2 | 3 };
}

export function loadCustom(): CustomPuzzle[] {
  try {
    const v = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]");
    if (!Array.isArray(v)) return [];
    const out: CustomPuzzle[] = [];
    for (const p of v) {
      try {
        if (p && typeof p.id === "number" && [1, 2, 3].includes(p.mate))
          out.push({ id: p.id, mate: p.mate, fen: toFen(parseFen(String(p.fen))), name: String(p.name ?? "").slice(0, 40) });
      } catch {
        // bỏ qua thế cờ bị hỏng
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function saveCustom(list: CustomPuzzle[]) {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list.slice(0, MAX_CUSTOM)));
  } catch {}
}
