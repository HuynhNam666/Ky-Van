// Runs every suite in order (each in its own process) and reports one line per suite.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const suites = process.argv.slice(2).length ? process.argv.slice(2) : ['01-basics.mjs', '02-invite-resume.mjs', '03-saves-ai.mjs', '04-call-matrix.mjs', '05-resilience.mjs'];
let failed = 0;
for (const s of suites) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(here, s)], { encoding: 'utf8', env: process.env });
  const out = (r.stdout || '') + (r.stderr || '');
  const passLine = (out.match(/==== \d+\/\d+ steps passed ====/) || ['(no summary)'])[0];
  const bad = out.split('\n').filter(l => /^FAIL |^  FAILED/.test(l));
  console.log(`${r.status === 0 ? 'OK  ' : 'FAIL'} ${s.padEnd(24)} ${passLine} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  if (r.status !== 0) { failed++; console.log(bad.map(l => '       ' + l).join('\n') || out.split('\n').slice(-15).join('\n')); }
}
console.log(failed ? `\n${failed} suite(s) failed` : '\nAll suites passed');
process.exit(failed ? 1 : 0);
