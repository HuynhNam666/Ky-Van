// Requirement 3 (invite in the game / through social apps / with a room code) and the "load the board again" side of
// requirement 4 for online games: refresh, reconnect, presence, second tab.
import { launch, newUser, step, summary, register, createRoom, joinByCode, playMove, waitPiece, leaveRoomViaPanel, shot, rand, BASE } from './lib.mjs';

const browser = await launch();
const tag = rand();
const nameA = `na_${tag}`, nameB = `nb_${tag}`;
const A = await newUser(browser, 'A'), B = await newUser(browser, 'B');
let code = '';
const tickets = { A: 0 };
A.page.on('request', r => { if (r.url().includes('/api/ws-ticket')) tickets.A++; });

await step('setup: register A and B', async () => { await register(A.page, nameA); await register(B.page, nameB); });

// ---- 3. inviting ----
await step('3a. A creates a room and invites B by user name', async () => {
  code = await createRoom(A.page, 'Mời trong game');
  await A.page.getByRole('button', { name: /Mời bằng hữu/ }).click();
  await A.page.locator('input[placeholder^="Tên đăng nhập"]').fill(nameB);
  await A.page.getByRole('button', { name: /Gửi lời mời/ }).click();
  await A.page.getByText('Đã gửi lời mời trong game').waitFor({ timeout: 5000 });
  await A.page.keyboard.press('Escape');
});
await step('3b. B is told about the invitation wherever they are: toast with "Tham gia" and a badge on the menu', async () => {
  await B.page.goto(BASE + '/');
  await B.page.locator('.top-actions .login', { hasText: nameB }).waitFor({ timeout: 8000 });
  await B.page.locator('[data-sonner-toast]', { hasText: 'mời bạn vào phòng' }).waitFor({ timeout: 12000 });
  await B.page.waitForTimeout(600);
  await shot(B.page, '30-invite-toast');
  const badge = await B.page.locator('.nav-badge').innerText();
  if (badge.trim() !== '1') throw new Error('badge=' + badge);
});
await step('3c. B accepts straight from the toast and lands in the room', async () => {
  await B.page.locator('[data-sonner-toast]').getByRole('button', { name: 'Tham gia' }).click();
  await B.page.locator('.room-code strong', { hasText: code }).waitFor({ timeout: 8000 });
  await A.page.getByText('Lượt Đỏ đi').first().waitFor({ timeout: 8000 });
});
await step('3d. Social share menu: Facebook, Telegram, X and e-mail links carry the room link; the invitation text can be copied', async () => {
  await A.page.getByRole('button', { name: /Mời bằng hữu/ }).click();
  await A.page.waitForTimeout(700);
  await shot(A.page, '31-share-menu');
  const hrefs = await A.page.locator('.share-chip[href]').evaluateAll(els => els.map(e => e.getAttribute('href')));
  const want = encodeURIComponent(`${BASE}/?room=${code}`);
  if (hrefs.length !== 4) throw new Error('expected 4 share links, got ' + hrefs.length);
  for (const h of hrefs) if (!h.includes(want)) throw new Error('link lacks the room link: ' + h);
  await A.ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await A.page.getByRole('button', { name: /Sao chép lời mời/ }).click();
  const clip = await A.page.evaluate(() => navigator.clipboard.readText());
  if (!clip.includes(code) || !clip.includes('?room=')) throw new Error('clipboard: ' + clip);
  await A.page.keyboard.press('Escape');
});

// ---- invitation link for somebody without an account ----
await step('3e. A visitor opens the invitation link, signs up and lands in the room without further clicks', async () => {
  const C = await newUser(browser, 'C');
  await leaveRoomViaPanel(A.page);
  const code2 = await createRoom(A.page, 'Cho người mới');
  await C.page.goto(`${BASE}/?room=${code2}`);
  await C.page.locator('.code-input').waitFor({ timeout: 5000 });
  await C.page.getByRole('button', { name: /^Vào phòng/ }).last().click();
  await C.page.getByText(`vào phòng ${code2}`).waitFor({ timeout: 5000 });
  await C.page.getByRole('tab', { name: 'Đăng ký' }).click();
  await C.page.locator('input[name=username]').fill(`nc_${tag}`);
  await C.page.locator('input[name=password]').fill('test-password-01');
  await C.page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await C.page.locator('.room-code strong', { hasText: code2 }).waitFor({ timeout: 8000 });
  await A.page.getByText('Lượt Đỏ đi').first().waitFor({ timeout: 8000 });
  if (C.page.url().includes('room=')) throw new Error('the ?room= parameter should be cleaned from the address bar');
  await C.ctx.close();
});

// ---- refresh / resume ----
await step('4a. F5 in an online game brings the same room back', async () => {
  await A.page.reload();
  await A.page.locator('.room-code').waitFor({ timeout: 8000 });
  await A.page.locator('.board-toolbar', { hasText: 'PHÒNG' }).waitFor();
});
await step('4b. Both players refresh mid-game: board, side and chat history survive', async () => {
  await leaveRoomViaPanel(A.page);
  const code3 = await createRoom(A.page, 'Refresh test');
  await leaveRoomViaPanel(B.page).catch(() => {});
  await joinByCode(B.page, code3);
  await A.page.getByText('Lượt Đỏ đi').first().waitFor({ timeout: 8000 });
  await playMove(A.page, 54, 45); await waitPiece(B.page, 45, '兵');
  await playMove(B.page, 27, 36); await waitPiece(A.page, 36, '卒');
  await A.page.getByRole('tab', { name: /Trò chuyện/ }).click();
  await A.page.locator('input[aria-label="Tin nhắn"]').fill('trước khi F5'); await A.page.locator('.chat-form button').click();
  await B.page.getByRole('tab', { name: /Trò chuyện/ }).click();
  await B.page.locator('.chat-message', { hasText: 'trước khi F5' }).waitFor();
  await Promise.all([A.page.reload(), B.page.reload()]);
  for (const P of [A.page, B.page]) {
    await P.locator('.room-code strong', { hasText: code3 }).waitFor({ timeout: 10000 });
    await waitPiece(P, 45, '兵'); await waitPiece(P, 36, '卒');
    await P.getByRole('tab', { name: /Trò chuyện/ }).click();
    await P.locator('.chat-message', { hasText: 'trước khi F5' }).waitFor({ timeout: 8000 });
  }
  const tag2 = await B.page.locator('.player-line.you .you-tag').innerText();
  if (tag2.trim() !== 'Đen') throw new Error('Black should still play Black after a refresh, got ' + tag2);
  await shot(B.page, '32-after-f5-B');
  code = code3;
});
await step('4c. The game continues after the refresh', async () => { await playMove(A.page, 56, 47); await waitPiece(B.page, 47, '兵'); });
await step('4d. The lobby lists rooms I am still in under "Phòng của bạn"', async () => {
  await A.page.getByRole('button', { name: 'Phòng chơi' }).click();
  await A.page.locator('.room-card', { hasText: code }).waitFor({ timeout: 6000 });
  await A.page.getByText('Phòng của bạn').waitFor();
  await shot(A.page, '33-lobby-mine');
});

// ---- presence ----
await step('5a. Presence: the opponent shows online, then offline once their tab closes', async () => {
  await A.page.getByRole('button', { name: 'Kỳ đài', exact: true }).click();
  await A.page.locator('.presence.on').waitFor({ timeout: 6000 });
  await B.page.close();
  await A.page.locator('.presence:not(.on)').waitFor({ timeout: 8000 });
});
await step('5b. The opponent returns through the lobby ("Vào lại") and shows online again', async () => {
  const B2 = await B.ctx.newPage();
  await B2.goto(BASE + '/');
  await B2.locator('.top-actions .login', { hasText: nameB }).waitFor({ timeout: 8000 });
  await B2.getByRole('button', { name: 'Phòng chơi' }).click();
  await B2.locator('.room-card', { hasText: code }).getByRole('button', { name: 'Vào lại' }).click();
  await B2.locator('.room-code strong', { hasText: code }).waitFor({ timeout: 8000 });
  await A.page.locator('.presence.on').waitFor({ timeout: 8000 });
});

// ---- same account, two tabs ----
await step('6. Same account in two tabs: the newer tab wins, the older one stops reconnecting and offers "Dùng ở đây"', async () => {
  const t1 = await A.ctx.newPage();
  await t1.goto(BASE + '/');
  await t1.locator('.top-actions .login', { hasText: nameA }).waitFor({ timeout: 8000 });
  await t1.getByRole('button', { name: 'Phòng chơi' }).click();
  await t1.locator('.room-card', { hasText: code }).getByRole('button', { name: 'Vào lại' }).click();
  await t1.locator('.room-code strong', { hasText: code }).waitFor({ timeout: 8000 });
  await A.page.locator('.notice.replaced').waitFor({ timeout: 8000 });
  const before = tickets.A;
  await A.page.waitForTimeout(9000);
  if (tickets.A - before > 0) throw new Error('the replaced tab kept reconnecting');
  await A.page.getByRole('button', { name: 'Dùng ở đây' }).click();
  await A.page.locator('.notice.replaced').waitFor({ state: 'detached', timeout: 8000 });
  await t1.locator('.notice.replaced').waitFor({ timeout: 8000 });
  await t1.close();
});

const nfail = summary();
await browser.close();
process.exit(nfail ? 1 : 0);
