// Requirement 6 in depth: the video call must work whatever the two devices have.
// Cameras are synthetic (see lib.mjs), so this does not depend on the test machine's hardware.
import { launch, newUser, step, summary, register, createRoom, joinByCode, rand } from './lib.mjs';

const browser = await launch();

// What the remote <video> of a player ends up holding: which tracks arrived, and whether picture frames are decoded.
const probe = (page, wantVideo) => page.evaluate(async wantVideo => {
  const t0 = performance.now();
  let last = { tracks: '', w: -1 };
  while (performance.now() - t0 < 12000) {
    const v = document.querySelector('video.remote-video');
    const tracks = v && v.srcObject ? v.srcObject.getTracks().map(t => t.kind).sort().join('+') : '';
    last = { tracks, w: v ? v.videoWidth : -1, label: (document.querySelector('.call-top') || {}).innerText };
    if (tracks && (wantVideo ? last.w > 0 : performance.now() - t0 > 3000)) return last;
    await new Promise(r => setTimeout(r, 250));
  }
  return last;
}, wantVideo);

async function scenario(name, callerCamera, calleeCamera) {
  await step(`call: ${name}`, async () => {
    const A = await newUser(browser, 'A', { camera: callerCamera }), B = await newUser(browser, 'B', { camera: calleeCamera });
    await register(A.page, `ca_${rand()}`); await register(B.page, `cb_${rand()}`);
    const code = await createRoom(A.page, 'matrix');
    await joinByCode(B.page, code);
    await A.page.getByText('Đã kết nối phòng chơi').waitFor();
    await A.page.getByRole('tab', { name: /Trò chuyện/ }).click();
    await A.page.locator('button[aria-label="Gọi video"]').click();
    await B.page.getByRole('button', { name: 'Nhận cuộc gọi' }).click({ timeout: 8000 });
    // A receives video only if B has a camera, and vice versa; audio always flows
    const [ra, rb] = await Promise.all([probe(A.page, calleeCamera), probe(B.page, callerCamera)]);
    const expectA = calleeCamera ? 'audio+video' : 'audio', expectB = callerCamera ? 'audio+video' : 'audio';
    const labels = [ra.label, rb.label].map(l => (l || '').replace(/\s+/g, ' '));
    await A.ctx.close(); await B.ctx.close();
    if (ra.tracks !== expectA || (calleeCamera && !(ra.w > 0))) throw new Error(`caller received ${JSON.stringify(ra)}, expected ${expectA}`);
    if (rb.tracks !== expectB || (callerCamera && !(rb.w > 0))) throw new Error(`callee received ${JSON.stringify(rb)}, expected ${expectB}`);
    if (!callerCamera && !/Gọi thoại/.test(labels[0])) throw new Error('caller without camera should be labelled "Gọi thoại"');
    if (!calleeCamera && !/Gọi thoại/.test(labels[1])) throw new Error('callee without camera should be labelled "Gọi thoại"');
    return `caller got ${ra.tracks}${ra.w > 0 ? ' ' + ra.w + 'px' : ''}, callee got ${rb.tracks}${rb.w > 0 ? ' ' + rb.w + 'px' : ''}`;
  });
}
await scenario('both players have a camera', true, true);
await scenario('callee has no camera (voice only, still sees the caller)', true, false);
await scenario('caller has no camera (voice only, still sees the callee)', false, true);
await scenario('nobody has a camera (voice call)', false, false);

await step('call: it ends by itself when the other player leaves the room', async () => {
  const A = await newUser(browser, 'A'), B = await newUser(browser, 'B');
  await register(A.page, `ca_${rand()}`); await register(B.page, `cb_${rand()}`);
  const code = await createRoom(A.page, 'peer leaves');
  await joinByCode(B.page, code);
  await A.page.getByText('Đã kết nối phòng chơi').waitFor();
  await A.page.getByRole('tab', { name: /Trò chuyện/ }).click();
  await A.page.locator('button[aria-label="Gọi video"]').click();
  await B.page.getByRole('button', { name: 'Nhận cuộc gọi' }).click({ timeout: 8000 });
  await A.page.locator('video.remote-video').waitFor();
  await B.page.close();                                   // the tab is gone, no hang-up was sent
  await A.page.locator('.call-window').waitFor({ state: 'detached', timeout: 20000 });
  await A.ctx.close(); await B.ctx.close();
});

const nfail = summary();
await browser.close();
process.exit(nfail ? 1 : 0);
