// Kiểm chứng bộ thế cờ lib/puzzle-data.json: hợp lệ, Đỏ đi trước, đúng N nước chiếu bí, đáp án đầu duy nhất.
// Chạy: node --experimental-strip-types scripts/check-puzzles.mjs
import { readFileSync } from 'node:fs';
import { check, allMoves } from '../lib/chess.ts';
import { parseFen, toFen, winningMoves, mateDepth } from '../lib/puzzle.ts';

const data = JSON.parse(readFileSync(new URL('../lib/puzzle-data.json', import.meta.url), 'utf8'));
let bad = 0;
const fail = (p, msg) => { bad++; console.error(`Thế ${p.id}: ${msg}`); };
for (const p of data) {
  const b = parseFen(p.fen);
  if (toFen(b) !== p.fen) fail(p, 'FEN không khớp sau khi đọc lại');
  if (b.filter((x) => x === 'rK').length !== 1 || b.filter((x) => x === 'bK').length !== 1) fail(p, 'cần đúng một Tướng mỗi bên');
  if (check(b, 'r') || check(b, 'b')) fail(p, 'có bên đang bị chiếu hoặc hai Tướng đối mặt');
  if (!allMoves(b, 'b').length) fail(p, 'Đen đã hết nước');
  const depth = mateDepth(b, p.mate);
  if (depth !== p.mate) fail(p, `chiếu bí trong ${depth || '>' + p.mate} nước, kỳ vọng ${p.mate}`);
  const wins = winningMoves(b, p.mate);
  if (wins.length !== 1 || wins[0].from !== p.first[0] || wins[0].to !== p.first[1]) fail(p, 'đáp án đầu không duy nhất hoặc lệch dữ liệu');
}
const ids = new Set(data.map((p) => p.id));
if (ids.size !== data.length) { bad++; console.error('id bị trùng'); }
console.log(bad ? `${bad} lỗi` : `OK: ${data.length} thế cờ hợp lệ (${[1,2,3].map((n)=>data.filter((p)=>p.mate===n).length+' thế chiếu bí '+n+' nước').join(', ')})`);
process.exit(bad ? 1 : 0);
