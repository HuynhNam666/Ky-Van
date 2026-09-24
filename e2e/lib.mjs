import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE = (process.env.BASE || 'http://localhost:3000').replace(/\/$/, '');
export const SHOTS = process.env.SHOTS || path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots');
if (process.env.SHOTS !== 'off') fs.mkdirSync(SHOTS, { recursive: true });

export const rand = () => Math.random().toString(36).slice(2, 8);

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const home = os.homedir();
  const candidates = {
    win32: ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', path.join(home, 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'), 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'],
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
    linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
  }[process.platform] || [];
  return candidates.find(p => fs.existsSync(p));
}

/** Uses the Chrome/Edge installed on the machine (no browser download); set CHROME_PATH to override. */
export async function launch() {
  const executablePath = findChrome();
  if (!executablePath) throw new Error('Chrome not found: install Google Chrome or set CHROME_PATH');
  return chromium.launch({ executablePath, headless: process.env.HEADED ? false : true, args: ['--autoplay-policy=no-user-gesture-required'] });
}

// Deterministic camera/microphone: a canvas stream plus an oscillator, instead of Chrome's fake devices
// (which are sometimes missing in fresh browser contexts). window.__noCamera simulates a PC without a webcam.
function installSyntheticMedia() {
  const make = (video, audio) => {
    const tracks = [];
    if (video) {
      const c = document.createElement('canvas'); c.width = 320; c.height = 240;
      const g = c.getContext('2d'); let n = 0;
      const draw = () => { g.fillStyle = 'hsl(' + ((n += 7) % 360) + ',70%,45%)'; g.fillRect(0, 0, 320, 240); g.fillStyle = '#fff'; g.font = '32px sans-serif'; g.fillText(String(n), 20, 120); };
      draw(); setInterval(draw, 100);
      tracks.push(...c.captureStream(10).getVideoTracks());
    }
    if (audio) {
      const ac = new AudioContext(), o = ac.createOscillator(), d = ac.createMediaStreamDestination();
      o.connect(d); o.start(); tracks.push(...d.stream.getAudioTracks());
    }
    return new MediaStream(tracks);
  };
  navigator.mediaDevices.getUserMedia = async c => {
    if (c && c.video && window.__noCamera) throw new DOMException('no camera', 'NotFoundError');
    return make(!!(c && c.video), !!(c && c.audio));
  };
}

/** A separate browser context = a separate person (own cookies, storage and camera). */
export async function newUser(browser, name, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1360, height: 900 }, locale: 'vi-VN', isMobile: opts.isMobile, hasTouch: opts.hasTouch });
  await ctx.addInitScript(installSyntheticMedia);
  if (opts.camera === false) await ctx.addInitScript(() => { window.__noCamera = true; });
  const page = await ctx.newPage();
  const logs = [];
  page.on('pageerror', e => { logs.push('pageerror: ' + e.message); console.log(`  [${name}] pageerror:`, e.message); });
  page.on('console', m => { if (m.type() === 'error' && !/status of (401|409|429)/.test(m.text())) { logs.push('console.error: ' + m.text()); console.log(`  [${name}] console.error:`, m.text().slice(0, 300)); } });
  return { ctx, page, name, logs };
}

// ---- tiny test runner: every step prints PASS/FAIL and the run continues ----
export const results = [];
export async function step(name, fn) {
  const t0 = Date.now();
  try {
    const note = await fn();
    results.push({ name, ok: true, note });
    console.log(`PASS  ${name}${note ? '  — ' + note : ''}  (${Date.now() - t0}ms)`);
  } catch (e) {
    results.push({ name, ok: false, note: e.message.split('\n')[0] });
    console.log(`FAIL  ${name}\n      ${e.message.split('\n').slice(0, 3).join('\n      ')}`);
  }
}
export function summary() {
  const failed = results.filter(r => !r.ok);
  console.log(`\n==== ${results.length - failed.length}/${results.length} steps passed ====`);
  for (const f of failed) console.log(`  FAILED: ${f.name} — ${f.note}`);
  return failed.length;
}

// ---- app helpers (selectors follow the Vietnamese UI) ----
/** Board squares are numbered 0..89 from the top-left (Black's side); aria-label starts with "a10 …" .. "i1 …". */
export const fileRank = i => String.fromCharCode(97 + (i % 9)) + (10 - Math.floor(i / 9));
export const sq = (page, i) => page.locator(`button.square[aria-label^="${fileRank(i)} "]`);

export async function shot(page, name) {
  if (process.env.SHOTS === 'off') return;
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

export async function register(page, username, password = 'test-password-01') {
  await page.goto(BASE + '/');
  await page.locator('.top-actions .login').click();
  await page.getByRole('tab', { name: 'Đăng ký' }).click();
  await page.locator('input[name=username]').fill(username);
  await page.locator('input[name=password]').fill(password);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await page.locator('.top-actions .login', { hasText: username.toLowerCase() }).waitFor({ timeout: 8000 });
}

export async function login(page, username, password = 'test-password-01') {
  await page.goto(BASE + '/');
  await page.locator('.top-actions .login').click();
  await page.locator('input[name=username]').fill(username);
  await page.locator('input[name=password]').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).last().click();
  await page.locator('.top-actions .login', { hasText: username.toLowerCase() }).waitFor({ timeout: 8000 });
}

export async function createRoom(page, name) {
  await page.getByRole('button', { name: 'Tạo phòng mới' }).first().click();
  if (name) await page.locator('.dialog-form input').first().fill(name);
  await page.getByRole('button', { name: 'Tạo phòng', exact: true }).click();
  const code = await page.locator('.room-code strong').innerText({ timeout: 8000 });
  return code.trim();
}

export async function joinByCode(page, code) {
  await page.getByRole('button', { name: /Vào phòng bằng mã/ }).click();
  await page.locator('.code-input').fill(code);
  await page.getByRole('button', { name: /^Vào phòng/ }).last().click();
  await page.locator('.room-code strong', { hasText: code }).waitFor({ timeout: 8000 });
}

export async function playMove(page, from, to) {
  await sq(page, from).click();
  await sq(page, to).click();
}

export async function waitPiece(page, i, pieceText, timeout = 8000) {
  await sq(page, i).locator('.chess-piece', { hasText: pieceText }).waitFor({ timeout });
}

export async function leaveRoomViaPanel(page) {
  await page.getByRole('button', { name: /Rời phòng/ }).first().click();
  await page.getByRole('button', { name: 'Rời phòng', exact: true }).last().click();
}
