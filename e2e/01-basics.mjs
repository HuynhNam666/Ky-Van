// Requirements 1, 2, 5, 6: sign up / sign in, create a room, join by link, two players online, chat and video call.
import { launch, newUser, step, summary, register, login, createRoom, playMove, waitPiece, sq, shot, rand, BASE } from './lib.mjs';

const browser = await launch();
const tag = rand();
const nameA = `ra_${tag}`, nameB = `rb_${tag}`;
const A = await newUser(browser, 'A'), B = await newUser(browser, 'B');
let code = '';

await step('1a. Auth dialog has login and register tabs', async () => {
  await A.page.goto(BASE + '/');
  await A.page.locator('.top-actions .login').click();
  await shot(A.page, '01-auth-login');
  await A.page.getByRole('tab', { name: 'Đăng ký' }).click();
  await shot(A.page, '01-auth-register');
  await A.page.keyboard.press('Escape');
});
await step('1b. Register account A and become signed in', async () => { await register(A.page, nameA); });
await step('1c. The session survives a reload (HttpOnly cookie)', async () => {
  await A.page.reload();
  await A.page.locator('.top-actions .login', { hasText: nameA }).waitFor({ timeout: 8000 });
});
await step('1d. Log out, then log in again', async () => {
  await A.page.locator('.top-actions .login').click();
  await A.page.getByRole('button', { name: 'Đăng xuất' }).click();
  await A.page.locator('.top-actions .login', { hasText: 'Đăng nhập' }).waitFor({ timeout: 5000 });
  await login(A.page, nameA);
});
await step('1e. A wrong password shows an error', async () => {
  const p = B.page; await p.goto(BASE + '/');
  await p.locator('.top-actions .login').click();
  await p.locator('input[name=username]').fill(nameA);
  await p.locator('input[name=password]').fill('wrong-password-99');
  await p.getByRole('button', { name: 'Đăng nhập', exact: true }).last().click();
  const err = await p.locator('.form-error').innerText({ timeout: 5000 });
  await p.keyboard.press('Escape');
  return err;
});
await step('1f. A duplicate username is rejected', async () => {
  const p = B.page; await p.goto(BASE + '/');
  await p.locator('.top-actions .login').click();
  await p.getByRole('tab', { name: 'Đăng ký' }).click();
  await p.locator('input[name=username]').fill(nameA);
  await p.locator('input[name=password]').fill('test-password-01');
  await p.getByRole('button', { name: 'Tạo tài khoản' }).click();
  const err = await p.locator('.form-error').innerText({ timeout: 5000 });
  await p.keyboard.press('Escape');
  return err;
});
await step('1g. Register account B', async () => { await register(B.page, nameB); });

await step('2. A creates a room: a 6-character code and a waiting state', async () => {
  code = await createRoom(A.page, 'Phòng thử nghiệm');
  if (!/^[A-Z2-9]{6}$/.test(code)) throw new Error('bad code ' + code);
  await A.page.getByText('Đang chờ người chơi thứ hai').first().waitFor({ timeout: 5000 });
  await shot(A.page, '02-room-waiting');
  return code;
});
await step('3a. The waiting room is listed in the lobby for B', async () => {
  await B.page.getByRole('button', { name: 'Phòng chơi' }).click();
  await B.page.locator('.room-card', { hasText: code }).waitFor({ timeout: 5000 });
  await shot(B.page, '03-lobby');
});
await step('3b. B joins through the invitation link ?room=CODE', async () => {
  await B.page.goto(`${BASE}/?room=${code}`);
  await B.page.locator('.code-input').waitFor({ timeout: 5000 });
  if ((await B.page.locator('.code-input').inputValue()) !== code) throw new Error('code not prefilled');
  await B.page.getByRole('button', { name: /^Vào phòng/ }).last().click();
  await B.page.locator('.room-code strong', { hasText: code }).waitFor({ timeout: 8000 });
});
await step('3c. Both sides are connected and it is Red to move', async () => {
  await A.page.getByText('Lượt Đỏ đi').first().waitFor({ timeout: 8000 });
  await B.page.getByText('Lượt Đỏ đi').first().waitFor({ timeout: 8000 });
  await A.page.getByText('Đã kết nối phòng chơi').waitFor({ timeout: 5000 });
  await shot(A.page, '04-room-playing-A'); await shot(B.page, '04-room-playing-B');
});

await step('4a. Red moves a pawn (54->45); Black sees it', async () => { await playMove(A.page, 54, 45); await waitPiece(B.page, 45, '兵'); });
await step('4b. Black moves a pawn (27->36); Red sees it', async () => { await playMove(B.page, 27, 36); await waitPiece(A.page, 36, '卒'); });
await step('4c. Selecting a piece out of turn is ignored', async () => {
  await sq(B.page, 29).click();
  if (await B.page.locator('button.square.selected').count()) throw new Error('piece got selected out of turn');
});
await step('4d. An illegal move (pawn sideways before the river) is refused', async () => {
  await sq(A.page, 56).click(); await sq(A.page, 55).click();
  if (!(await sq(A.page, 56).locator('.chess-piece').count())) throw new Error('piece moved illegally');
  await A.page.keyboard.press('Escape');
});
await step('5. Chat works both ways', async () => {
  await A.page.getByRole('tab', { name: /Trò chuyện/ }).click();
  await B.page.getByRole('tab', { name: /Trò chuyện/ }).click();
  await A.page.locator('input[aria-label="Tin nhắn"]').fill('Chào bạn, khai cuộc nhé');
  await A.page.locator('.chat-form button').click();
  await B.page.locator('.chat-message', { hasText: 'Chào bạn, khai cuộc nhé' }).waitFor({ timeout: 5000 });
  await B.page.locator('input[aria-label="Tin nhắn"]').fill('Sẵn sàng!');
  await B.page.locator('.chat-form button').click();
  await A.page.locator('.chat-message', { hasText: 'Sẵn sàng!' }).waitFor({ timeout: 5000 });
  await shot(A.page, '05-chat-A');
});
await step('6. Video call: A calls, B accepts, both receive video frames', async () => {
  await A.page.locator('button[aria-label="Gọi video"]').click();
  await B.page.getByRole('button', { name: 'Nhận cuộc gọi' }).click({ timeout: 8000 });
  const probe = p => p.evaluate(async () => {
    const t0 = performance.now();
    while (performance.now() - t0 < 12000) {
      const v = document.querySelector('video.remote-video');
      if (v && v.videoWidth > 0 && !v.paused) return { w: v.videoWidth, h: v.videoHeight };
      await new Promise(r => setTimeout(r, 200));
    }
    return { w: 0 };
  });
  const [ra, rb] = await Promise.all([probe(A.page), probe(B.page)]);
  await shot(A.page, '06-video-A'); await shot(B.page, '06-video-B');
  if (!ra.w || !rb.w) throw new Error(`no remote frames A=${JSON.stringify(ra)} B=${JSON.stringify(rb)}`);
  return `A sees ${ra.w}x${ra.h}, B sees ${rb.w}x${rb.h}`;
});
await step('6b. Hanging up ends the call on both sides', async () => {
  await A.page.locator('.call-controls .hang-up').click();
  await B.page.locator('.call-window').waitFor({ state: 'detached', timeout: 6000 });
});
await step('6c. Muting the microphone flips the control state', async () => {
  await A.page.locator('button[aria-label="Gọi video"]').click();
  await B.page.getByRole('button', { name: 'Nhận cuộc gọi' }).click({ timeout: 8000 });
  await A.page.locator('.call-controls button').first().click();
  await A.page.locator('.call-controls button[aria-pressed=true]').waitFor({ timeout: 3000 });
  await A.page.locator('.call-controls .hang-up').click();
  await B.page.locator('.call-window').waitFor({ state: 'detached', timeout: 6000 });
});

const nfail = summary();
await browser.close();
process.exit(nfail ? 1 : 0);
