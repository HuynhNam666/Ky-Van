// Sinh thế cờ tàn "Đỏ đi trước, chiếu bí trong N nước" có đáp án duy nhất, kiểm chứng bằng luật ở lib/chess.ts.
// Kết quả xác định (hạt giống cố định). Chạy: node --experimental-strip-types scripts/gen-puzzles.mjs > lib/puzzle-data.json
import { allMoves, check, moved } from '../lib/chess.ts';
import { toFen, winningMoves, mateDepth } from '../lib/puzzle.ts';

let seed = 20261026;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const redPalace = [3, 4, 5, 12, 13, 14, 21, 22, 23].map((i) => i + 63);
const blackPalace = [3, 4, 5, 12, 13, 14, 21, 22, 23];
const blackAdvisor = [3, 5, 13, 21, 23];
const blackElephant = [2, 6, 18, 22, 26, 38, 42].filter((i) => i !== 22).concat([22]);
const redAdvisor = blackAdvisor.map((i) => i + 63);
const redElephant = [47, 51, 63, 67, 71, 83, 87];

function build(profile) {
  const b = Array(90).fill(null);
  const used = new Set();
  const put = (sq, p) => { if (sq == null || used.has(sq)) return false; used.add(sq); b[sq] = p; return true; };
  if (!put(pick(blackPalace), 'bK') || !put(pick(redPalace), 'rK')) return null;
  for (const [piece, pool, count] of profile.black) for (let i = 0; i < count; i++) if (!put(pick(pool), piece)) return null;
  for (const [piece, pool, count] of profile.red) for (let i = 0; i < count; i++) if (!put(pick(pool), piece)) return null;
  return b;
}
const all = [...Array(90).keys()];
// Tốt chỉ ở những ô có thể tới được: chưa qua sông thì phải đứng đúng cột xuất phát.
const redPawnSq = all.filter((i) => i < 63 && (i < 45 || (i % 9) % 2 === 0));
const blackPawnSq = all.filter((i) => i >= 27 && (i >= 45 || (i % 9) % 2 === 0));
const profiles = {
  1: () => ({ black: [['bA', blackAdvisor, Math.floor(rnd() * 3)], ['bE', blackElephant, Math.floor(rnd() * 3)]],
    red: [['rR', all, 1 + Math.floor(rnd() * 2)], ['rC', all, Math.floor(rnd() * 2)], ['rH', all, Math.floor(rnd() * 2)]] }),
  2: () => ({ black: [['bA', blackAdvisor, 1 + Math.floor(rnd() * 2)], ['bE', blackElephant, Math.floor(rnd() * 3)], ['bP', blackPawnSq, Math.floor(rnd() * 2)]],
    red: [['rR', all, 1 + Math.floor(rnd() * 2)], ['rC', all, Math.floor(rnd() * 2)], ['rH', all, 1], ['rP', redPawnSq, Math.floor(rnd() * 2)]] }),
  3: () => ({ black: [['bA', blackAdvisor, 2], ['bE', blackElephant, 1 + Math.floor(rnd() * 2)], ['bP', blackPawnSq, Math.floor(rnd() * 2)]],
    red: [['rR', all, 1], ['rC', all, 1], ['rH', all, 1], ['rP', redPawnSq, Math.floor(rnd() * 2)]] }),
};

function tryTier(tier) {
  const b = build(profiles[tier]());
  if (!b) return null;
  if (check(b, 'r') || check(b, 'b')) return null;
  if (!allMoves(b, 'b').length || !allMoves(b, 'r').length) return null;
  if (mateDepth(b, tier) !== tier) return null;           // không có đường chiếu bí ngắn hơn N
  const wins = winningMoves(b, tier);
  if (wins.length !== 1) return null;                      // đáp án đầu tiên duy nhất
  if (tier > 1 && !check(moved(b, wins[0].from, wins[0].to), 'b')) return null; // nước đầu là nước chiếu
  return { fen: toFen(b), first: [wins[0].from, wins[0].to] };
}

const targets = { 1: 10, 2: 10, 3: 8 };
const out = [];
const seen = new Set();
const started = Date.now();
for (const tier of [1, 2, 3]) {
  let found = 0, tries = 0;
  while (found < targets[tier] && Date.now() - started < 8 * 60 * 1000) {
    tries++;
    const p = tryTier(tier);
    if (p && !seen.has(p.fen)) { seen.add(p.fen); found++; out.push({ mate: tier, ...p }); console.error(`tier ${tier}: ${found}/${targets[tier]} (thử ${tries})`); }
  }
}
out.forEach((p, i) => { p.id = i + 1; });
console.log(JSON.stringify(out, null, 1));
