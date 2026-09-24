// Requirements 4 and 7: save / load boards (account, browser, JSON file, automatic resume) and playing against the machine.
import fs from 'node:fs';
import { launch, newUser, step, summary, register, createRoom, joinByCode, playMove, waitPiece, sq, shot, rand, BASE } from './lib.mjs';

const browser = await launch();
const tag = rand();

// ---- 4. saving and loading ----
{
  const A = await newUser(browser, 'A'), B = await newUser(browser, 'B');
  await step('setup: register A and B', async () => { await register(A.page, `sa_${tag}`); await register(B.page, `sb_${tag}`); });
  await step('4a. Save to the account; the game is listed under "Ván đã lưu" and survives a reload', async () => {
    await playMove(A.page, 54, 45);
    await A.page.getByText('Lượt Đỏ đi').first().waitFor({ timeout: 15000 });
    await A.page.getByRole('button', { name: /Lưu ván/ }).click();
    await A.page.locator('.dialog-form input').first().fill('Ván thử nghiệm 1');
    await A.page.getByRole('button', { name: 'Lưu bàn cờ' }).click();
    await A.page.getByText('Đã lưu vào tài khoản').waitFor({ timeout: 5000 });
    await A.page.reload();
    await A.page.locator('.top-actions .login', { hasText: `sa_${tag}` }).waitFor({ timeout: 8000 });
    await A.page.getByRole('button', { name: 'Ván đã lưu' }).click();
    await A.page.locator('.room-card', { hasText: 'Ván thử nghiệm 1' }).waitFor({ timeout: 5000 });
    await shot(A.page, '40-saved-list');
  });
  await step('4b. Load it: the board comes back and you choose how to continue (two players here)', async () => {
    await A.page.locator('.room-card', { hasText: 'Ván thử nghiệm 1' }).getByRole('button', { name: /Tiếp tục/ }).click();
    await A.page.waitForTimeout(700);
    await shot(A.page, '41-resume-choice');
    await A.page.getByRole('button', { name: /Hai người cùng thiết bị/ }).click();
    await waitPiece(A.page, 45, '兵');
    return (await A.page.locator('.board-toolbar').innerText()).replace(/\s+/g, ' ');
  });
  await step('4c. Saved games are private to their account', async () => {
    await B.page.getByRole('button', { name: 'Ván đã lưu' }).click();
    await B.page.getByText('0 ván đã lưu').waitFor({ timeout: 5000 });
  });
  await step('4d. Export to JSON, import into another account and continue against the machine', async () => {
    await A.page.getByRole('button', { name: /Lưu ván/ }).click();
    const [dl] = await Promise.all([A.page.waitForEvent('download'), A.page.getByRole('button', { name: /Xuất JSON/ }).click()]);
    const j = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    if (j.board.length !== 90 || j.board[45] !== 'rP') throw new Error('bad export');
    await A.page.keyboard.press('Escape');
    await B.page.getByRole('button', { name: 'Ván đã lưu' }).click();
    await B.page.locator('input[type=file]').setInputFiles(await dl.path());
    await B.page.getByRole('button', { name: /Chơi tiếp với máy/ }).click();
    await waitPiece(B.page, 45, '兵');
  });
  await step('4e. A signed-out visitor saves to the browser (localStorage) and it persists', async () => {
    const G = await newUser(browser, 'G');
    await G.page.goto(BASE + '/');
    await playMove(G.page, 54, 45);
    await G.page.getByRole('button', { name: /Lưu ván/ }).click();
    await G.page.getByRole('button', { name: 'Lưu bàn cờ' }).click();
    await G.page.getByText('Đã lưu trên trình duyệt này').waitFor({ timeout: 5000 });
    await G.page.reload();
    await G.page.getByRole('button', { name: 'Ván đã lưu' }).click();
    await G.page.getByText('1 ván đã lưu').waitFor({ timeout: 5000 });
    await G.ctx.close();
  });
  await step('4f. Delete a saved game (cancel first, then confirm): account and browser copies', async () => {
    for (const name of ['Ván giữ lại']) {
      await A.page.getByRole('button', { name: 'Kỳ đài', exact: true }).click();
      await A.page.getByRole('button', { name: /Lưu ván/ }).click();
      await A.page.locator('.dialog-form input').first().fill(name);
      await A.page.getByRole('button', { name: 'Lưu bàn cờ' }).click();
      await A.page.getByText('Đã lưu vào tài khoản').waitFor();
    }
    await A.page.getByRole('button', { name: 'Ván đã lưu' }).click();
    await A.page.getByText('2 ván đã lưu').waitFor();
    await A.page.locator('.room-card', { hasText: 'Ván thử nghiệm 1' }).getByRole('button', { name: /Xóa/ }).click();
    await A.page.getByRole('button', { name: 'Giữ lại' }).click();
    await A.page.getByText('2 ván đã lưu').waitFor();
    await A.page.locator('.room-card', { hasText: 'Ván thử nghiệm 1' }).getByRole('button', { name: /Xóa/ }).click();
    await A.page.getByRole('button', { name: 'Xóa ván này' }).click();
    await A.page.getByText('1 ván đã lưu').waitFor();
    await A.page.reload();
    await A.page.getByRole('button', { name: 'Ván đã lưu' }).click();
    await A.page.getByText('1 ván đã lưu').waitFor();   // still 1 after a reload: it was deleted on the server
    const Gu = await newUser(browser, 'Gu');
    await Gu.page.goto(BASE + '/');
    await playMove(Gu.page, 54, 45);
    await Gu.page.getByRole('button', { name: /Lưu ván/ }).click();
    await Gu.page.getByRole('button', { name: 'Lưu bàn cờ' }).click();
    await Gu.page.getByText('Đã lưu trên trình duyệt này').waitFor();
    await Gu.page.getByRole('button', { name: 'Ván đã lưu' }).click();
    await Gu.page.getByRole('button', { name: /Xóa/ }).click();
    await Gu.page.getByRole('button', { name: 'Xóa ván này' }).click();
    await Gu.page.getByText('0 ván đã lưu').waitFor();
    await Gu.ctx.close();
  });
  await A.ctx.close(); await B.ctx.close();
}

// ---- automatic resume of a game against the machine ----
await step('4g. F5 while playing the machine restores the game; a finished game is not restored', async () => {
  const G = await newUser(browser, 'G2');
  await G.page.goto(BASE + '/');
  await playMove(G.page, 54, 45);
  await G.page.getByText('Lượt Đỏ đi').first().waitFor({ timeout: 15000 });
  await playMove(G.page, 56, 47);
  await G.page.getByText('Lượt Đỏ đi').first().waitFor({ timeout: 15000 });
  const before = await G.page.locator('.moves-list .move-row').count();
  await G.page.reload();
  await G.page.locator('.moves-list .move-row').first().waitFor({ timeout: 8000 });
  const after = await G.page.locator('.moves-list .move-row').count();
  await waitPiece(G.page, 45, '兵'); await waitPiece(G.page, 47, '兵');
  if (before !== after) throw new Error(`rows before=${before} after=${after}`);
  await playMove(G.page, 58, 49);
  await G.page.getByText('Lượt Đỏ đi').first().waitFor({ timeout: 15000 });
  if ((await G.page.locator('.moves-list .move-row').count()) <= after) throw new Error('game did not continue after the restore');
  await G.page.getByRole('button', { name: /Đầu hàng/ }).click();
  await G.page.getByRole('button', { name: /^Đầu hàng$/ }).last().click();
  await G.page.locator('.result-banner').waitFor();
  await G.page.reload();
  await G.page.waitForTimeout(800);
  if (await G.page.locator('.moves-list .move-row').count()) throw new Error('a finished game was restored');
  await G.ctx.close();
});

// ---- 7. playing against the machine ----
const RED_MOVES = [[54, 45], [56, 47], [58, 49], [60, 51], [62, 53], [45, 36], [47, 38], [49, 40], [51, 42], [53, 44]];
for (const level of ['1', '2', '3']) {
  await step(`7. Machine, level ${level}: answers every move within a second or so and never freezes the page`, async () => {
    const G = await newUser(browser, 'AI' + level);
    await G.page.addInitScript(() => {
      window.__long = [];
      new PerformanceObserver(l => l.getEntries().forEach(e => window.__long.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: true });
    });
    await G.page.goto(BASE + '/');
    await G.page.locator('.level-select').click();
    await G.page.getByRole('option', { name: ['', 'Nhập môn', 'Trung cấp', 'Cao thủ'][Number(level)] }).click();
    const times = []; let played = 0;
    for (const [f, t] of RED_MOVES) {
      if (played >= 4) break;
      const before = await G.page.locator('.moves-list .move-row').count();
      await sq(G.page, f).click(); await sq(G.page, t).click();
      const t0 = Date.now();
      const done = await G.page.waitForFunction(() => { const s = document.querySelector('.board-bottom span'); return s && !/suy nghĩ/.test(s.textContent); }, null, { timeout: 30000 }).then(() => true).catch(() => false);
      await G.page.waitForTimeout(150);
      if ((await G.page.locator('.moves-list .move-row').count()) > before) { played++; times.push(Date.now() - t0); }
      if (!done) throw new Error('the machine did not answer in 30 s');
    }
    const long = await G.page.evaluate(() => window.__long);
    await G.ctx.close();
    if (Math.max(...times) > 3000) throw new Error('slow reply ' + times.join(','));
    if (Math.max(0, ...long) > 500) throw new Error('main thread blocked for ' + Math.max(...long) + ' ms');
    return `moves=${played} reply(ms)=${times.join(',')} longest main-thread block=${Math.max(0, ...long)}ms`;
  });
}

// ---- finishing an online game ----
await step('7b. Resigning ends an online game on both sides, and the banner offers "Rời phòng"', async () => {
  const A = await newUser(browser, 'A'), B = await newUser(browser, 'B');
  await register(A.page, `fa_${tag}`); await register(B.page, `fb_${tag}`);
  const code = await createRoom(A.page, 'Đầu hàng');
  await joinByCode(B.page, code);
  await A.page.getByText('Lượt Đỏ đi').first().waitFor({ timeout: 8000 });
  await B.page.getByRole('button', { name: /Đầu hàng/ }).click();
  await B.page.getByRole('button', { name: /^Đầu hàng$/ }).last().click();
  await A.page.getByText(/Đỏ thắng/).first().waitFor({ timeout: 6000 });
  await B.page.getByText(/Đỏ thắng/).first().waitFor({ timeout: 6000 });
  await shot(A.page, '42-resigned');
  await A.page.locator('.result-banner').getByRole('button', { name: /Rời phòng/ }).click();
  await A.page.locator('.board-toolbar', { hasText: 'LUYỆN CỜ CÙNG MÁY' }).waitFor({ timeout: 5000 });
  await A.ctx.close(); await B.ctx.close();
});

const nfail = summary();
await browser.close();
process.exit(nfail ? 1 : 0);
