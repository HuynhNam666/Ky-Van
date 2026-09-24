// Sanity check of the three computer levels: a higher level must beat a lower one (and a random mover) on both colours,
// and thinking time must stay short enough not to freeze the page.
// Run: node --experimental-strip-types scripts/check-ai.mjs
import { initial, allMoves, moved, other, chooseMove } from '../lib/chess.ts';

function play(redLevel, blackLevel, maxPlies = 160) {
  let board = initial(), side = 'r', slowest = 0;
  for (let ply = 0; ply < maxPlies; ply++) {
    const moves = allMoves(board, side);
    if (!moves.length) return { winner: side === 'r' ? 'b' : 'r', slowest };
    const level = side === 'r' ? redLevel : blackLevel;
    const t0 = performance.now();
    const m = level === 0 ? moves[Math.floor(Math.random() * moves.length)] : chooseMove(board, side, level);
    slowest = Math.max(slowest, performance.now() - t0);
    board = moved(board, m.from, m.to); side = other(side);
  }
  // no mate within the limit: judge by material so the check stays decisive
  const value = { K: 0, R: 9, C: 4.5, H: 4, E: 2, A: 2, P: 1 };
  const score = board.reduce((s, p) => s + (p ? (p[0] === 'r' ? 1 : -1) * value[p[1]] : 0), 0);
  return { winner: score > 3 ? 'r' : score < -3 ? 'b' : '-', slowest };
}
function match(label, strong, weak, games) {
  let wins = 0, slowest = 0;
  for (let i = 0; i < games; i++) {
    const strongIsRed = i % 2 === 0;
    const r = strongIsRed ? play(strong, weak) : play(weak, strong);
    slowest = Math.max(slowest, r.slowest);
    if (r.winner === (strongIsRed ? 'r' : 'b')) wins++;
  }
  const ok = wins >= games - 1 && slowest < 1500;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}: strong side won ${wins}/${games}, slowest move ${slowest.toFixed(0)} ms`);
  return ok;
}
const results = [match('level 3 vs random mover', 3, 0, 4), match('level 3 vs level 1', 3, 1, 4), match('level 2 vs level 1', 2, 1, 4)];
process.exit(results.every(Boolean) ? 0 : 1);
