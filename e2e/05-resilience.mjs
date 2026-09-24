// What happens when things go wrong or the screen is small: throttling, logout, phone width, server restart.
import { execSync } from 'node:child_process';
import { launch, newUser, step, summary, register, createRoom, joinByCode, playMove, waitPiece, shot, rand, BASE } from './lib.mjs';

const browser = await launch();
const tag = rand();

await step('Throttling is per account: 12 failed sign-ins from one client do not lock other people out', async () => {
  const A = await newUser(browser, 'A');
  await register(A.page, `th_${tag}`);
  const codes = [];
  for (let i = 0; i < 12; i++) {
    const r = await A.page.request.post(BASE + '/api/auth/login', { data: { username: `nobody_${tag}_${i}`, password: 'wrong-password-1' }, headers: { Origin: BASE } });
    codes.push(r.status());
  }
  const C = await newUser(browser, 'C');
  const ok = await C.page.request.post(BASE + '/api/auth/login', { data: { username: `th_${tag}`, password: 'test-password-01' }, headers: { Origin: BASE } });
  await A.ctx.close(); await C.ctx.close();
  if (ok.status() !== 200) throw new Error(`an innocent sign-in got ${ok.status()} after ${codes.join(',')}`);
  if (codes.includes(429)) throw new Error('sign-ins for different names were throttled together: ' + codes.join(','));
  return 'failed attempts answered ' + [...new Set(codes)].join('/') + ', innocent sign-in 200';
});

await step('Signing out inside an online room returns to practice mode and the socket stops reconnecting', async () => {
  const A = await newUser(browser, 'A');
  let tickets = 0; A.page.on('request', r => { if (r.url().includes('/api/ws-ticket')) tickets++; });
  await register(A.page, `lo_${tag}`);
  await createRoom(A.page, 'logout');
  await A.page.locator('[role=dialog]').waitFor({ state: 'detached' });   // let the create-room dialog finish closing
  await A.page.locator('.top-actions .login').click();
  await A.page.getByRole('button', { name: 'Đăng xuất' }).click();
  await A.page.locator('.board-toolbar', { hasText: 'LUYỆN CỜ CÙNG MÁY' }).waitFor({ timeout: 5000 });
  const before = tickets; await A.page.waitForTimeout(6000);
  if (tickets !== before) throw new Error('the socket kept reconnecting after sign-out');
  await A.page.reload(); await A.page.waitForTimeout(800);
  if (await A.page.locator('.room-code').count()) throw new Error('the room came back after sign-out + reload');
  await A.ctx.close();
});

await step('An idle room stays alive: the page sends a heartbeat every ~20 s', async () => {
  const A = await newUser(browser, 'A');
  let pings = 0;
  A.page.on('websocket', ws => ws.on('framesent', f => { if (typeof f.payload === 'string' && f.payload.includes('"ping"')) pings++; }));
  await register(A.page, `hb_${tag}`);
  await createRoom(A.page, 'heartbeat');
  await A.page.waitForTimeout(23000);
  await A.page.getByText('Đã kết nối phòng chơi').waitFor({ timeout: 3000 });
  await A.ctx.close();
  if (pings < 1) throw new Error('no heartbeat frame in 23 s');
  return pings + ' ping frame(s) in 23 s';
});

await step('Phone width (390 px): nothing overflows sideways on any screen', async () => {
  const M = await newUser(browser, 'M', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await register(M.page, `mo_${tag}`);
  const fits = async label => { const w = await M.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth })); if (w.sw > w.iw + 1) throw new Error(`${label}: scrollWidth ${w.sw} > ${w.iw}`); };
  await fits('play');
  await M.page.getByRole('button', { name: 'Phòng chơi' }).click(); await M.page.waitForTimeout(300); await fits('lobby'); await shot(M.page, '50-mobile-lobby');
  await M.page.getByRole('button', { name: 'Ván đã lưu' }).click(); await M.page.waitForTimeout(300); await fits('saved');
  await M.page.getByRole('button', { name: 'Kỳ đài', exact: true }).click();
  await createRoom(M.page, 'Phone'); await fits('room');
  await M.page.getByRole('button', { name: /Mời bằng hữu/ }).click(); await M.page.waitForTimeout(600); await fits('invite dialog'); await shot(M.page, '51-mobile-invite');
  await M.ctx.close();
});

// Needs a way to restart the API without losing the database (see e2e/README.md).
if (process.env.RESTART_BACKEND_CMD) {
  await step('The API restarts in the middle of a game: both clients reconnect by themselves and play on', async () => {
    const A = await newUser(browser, 'A'), B = await newUser(browser, 'B');
    await register(A.page, `ra_${tag}`); await register(B.page, `rb_${tag}`);
    const code = await createRoom(A.page, 'restart');
    await joinByCode(B.page, code);
    await A.page.getByText('Lượt Đỏ đi').first().waitFor();
    await playMove(A.page, 54, 45); await waitPiece(B.page, 45, '兵');
    execSync(process.env.RESTART_BACKEND_CMD, { stdio: 'ignore', timeout: 90000 });
    await A.page.getByText('Đã kết nối phòng chơi').waitFor({ timeout: 25000 });
    await B.page.getByText('Đã kết nối phòng chơi').waitFor({ timeout: 25000 });
    await playMove(B.page, 27, 36); await waitPiece(A.page, 36, '卒');
    await A.ctx.close(); await B.ctx.close();
  });
} else console.log('SKIP  API restart test (set RESTART_BACKEND_CMD to a command that restarts the API on the same database)');

const nfail = summary();
await browser.close();
process.exit(nfail ? 1 : 0);
