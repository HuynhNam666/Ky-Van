// The browser rules (lib/chess.ts) and the server rules (backend/chess.py) must list exactly the same legal moves in every
// position of random games: otherwise the client would offer moves the server refuses, or the other way round.
// Run: node --experimental-strip-types scripts/check-parity.mjs [games=40] [plies=120]   (needs Python on PATH, or set PYTHON)
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { allMoves } from '../lib/chess.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const [games = '40', plies = '120'] = process.argv.slice(2);
const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const run = spawnSync(python, [path.join(here, 'dump-positions.py'), games, plies, '20260924'], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024 });
if (run.status !== 0) { console.error(run.stderr || run.error); process.exit(2); }
const byFromTo = (a, b) => a[0] - b[0] || a[1] - b[1];
let positions = 0, mismatches = 0;
for (const line of run.stdout.split('\n')) {
  if (!line) continue;
  const { board, turn, moves } = JSON.parse(line);
  const browser = allMoves(board, turn).map(m => [m.from, m.to]).sort(byFromTo);
  positions++;
  if (JSON.stringify(browser) !== JSON.stringify(moves.sort(byFromTo)) && ++mismatches <= 3) console.log('MISMATCH, side', turn, JSON.stringify(board));
}
console.log(`${mismatches ? 'FAIL' : 'OK  '} ${positions} positions compared, ${mismatches} mismatches`);
process.exit(mismatches ? 1 : 0);
