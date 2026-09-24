// Move-generation check for the browser rules (lib/chess.ts): "perft" counts every legal line of play from the opening
// position and must equal the published Xiangqi values (44, 1920, 79666, 3290240). The server rules (backend/chess.py)
// are checked against the same numbers in backend/test_backend.py, so both engines agree with the reference.
// Run: node --experimental-strip-types scripts/check-rules.mjs [depth=4]
import { initial, allMoves, moved, other } from '../lib/chess.ts';

const EXPECTED = [44, 1920, 79666, 3290240, 133312995];
const depth = Number(process.argv[2] || 4);
const perft = (board, side, d) => {
  const moves = allMoves(board, side);
  if (d === 1) return moves.length;
  return moves.reduce((n, m) => n + perft(moved(board, m.from, m.to), other(side), d - 1), 0);
};
let bad = 0;
for (let d = 1; d <= Math.min(depth, EXPECTED.length); d++) {
  const t0 = Date.now(), n = perft(initial(), 'r', d);
  const ok = n === EXPECTED[d - 1];
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} perft(${d}) = ${n}${ok ? '' : ` (expected ${EXPECTED[d - 1]})`}  ${Date.now() - t0} ms`);
}
process.exit(bad ? 1 : 0);
