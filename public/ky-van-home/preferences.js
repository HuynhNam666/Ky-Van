// KYVIEN_YOUTUBE_V1
(() => {
  const key = "kyvan.settings.v1";
  let context = null,
    timer = null,
    step = 0;
  const prefs = () => {
    try {
      return JSON.parse(localStorage.getItem(key) || "{}");
    } catch {
      return {};
    }
  };
  const button = document.querySelector('button[title="Âm Luật Kỳ Các"]');
  function stop() {
    clearInterval(timer);
    timer = null;
    if (context) {
      void context.close().catch(() => {});
      context = null;
    }
    button?.setAttribute("aria-pressed", "false");
    if (button) button.style.boxShadow = "";
  }
  async function start() {
    if (window.__kyMusicInstalled) return;
    if (context) return;
    try {
      context = new AudioContext();
      await context.resume();
      const c = context;
      function note() {
        if (c.state !== "running") return;
        const o = c.createOscillator(),
          g = c.createGain();
        o.type = "sine";
        o.frequency.value = [
          261.63, 293.66, 329.63, 392, 440, 392, 329.63, 293.66,
        ][step++ % 8];
        g.gain.setValueAtTime(0.001, c.currentTime);
        g.gain.linearRampToValueAtTime(0.035, c.currentTime + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.8);
        o.connect(g);
        g.connect(c.destination);
        o.start();
        o.stop(c.currentTime + 2);
      }
      note();
      timer = setInterval(note, 900);
      button?.setAttribute("aria-pressed", "true");
      if (button) button.style.boxShadow = "0 0 18px #e9c879";
    } catch {
      stop();
    }
  }
  function apply() {
    const p = prefs();
    document.documentElement.classList.toggle(
      "kyvan-reduced-motion",
      p.motion === false,
    );
    if (p.music === false) stop();
  }
  const style = document.createElement("style");
  style.textContent =
    ".kyvan-reduced-motion *,.kyvan-reduced-motion *::before,.kyvan-reduced-motion *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}";
  document.head.append(style);
  window.addEventListener("kyvan-toggle-music", () => {
    if (window.__kyMusicInstalled) return;
    const enabled = !context;
    localStorage.setItem(key, JSON.stringify({ ...prefs(), music: enabled }));
    if (enabled) void start();
    else stop();
  });
  const unlock = (e) => {
    if (e.target.closest?.('button[title="Âm Luật Kỳ Các"]')) return;
    if (prefs().music && !context) void start();
  };
  document.addEventListener("pointerdown", unlock);
  document.addEventListener("keydown", unlock);
  window.addEventListener("storage", apply);
  window.addEventListener("pagehide", stop);
  apply();
})();
