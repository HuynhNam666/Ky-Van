/* KYVIEN_MP3_V1 — shared audio, collapsed controls do not pause playback. */
(() => {
  if (window.__kyMusicInstalled) return;
  window.__kyMusicInstalled = true;
  if (window.parent !== window) {
    window.addEventListener("kyvan-toggle-music", () =>
      window.parent.postMessage(
        { type: "kyvan-youtube-command", command: "toggle" },
        location.origin,
      ),
    );
    return;
  }
  const tracks = [
    ["vo-uu-tinh-do.mp3", "Vô Ưu Tịnh Độ"],
    ["tan-mong-nhan-gian.mp3", "Tàn Mộng Nhân Gian"],
    ["tao-samurai.mp3", "TAO · Đạo Samurai"],
  ];
  const KEY = "kyvan.mp3.v1",
    PREF = "kyvan.settings.v1";
  const read = (k) => {
    try {
      const v = JSON.parse(localStorage.getItem(k) || "{}");
      return v && typeof v === "object" ? v : {};
    } catch {
      return {};
    }
  };
  const write = (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  };
  const saved = read(KEY);
  let index = Math.max(
      0,
      tracks.findIndex((t) => t[0] === saved.id),
    ),
    volume = Number.isFinite(saved.volume)
      ? Math.max(0, Math.min(100, saved.volume))
      : 30;
  let wanted = false,
    generation = 0,
    pendingTime = Number.isFinite(saved.time) ? Math.max(0, saved.time) : 0,
    loaded = false;
  const audio = new Audio();
  audio.preload = "none";
  audio.volume = volume / 100;
  const panel = document.createElement("section");
  panel.id = "kv-mp3";
  panel.setAttribute("aria-label", "Nhạc nền Kỳ Viện");
  panel.innerHTML =
    '<button id="kv-mp3-open" type="button" aria-label="Mở bảng chọn nhạc" aria-expanded="false" title="Chọn nhạc nền">🎵</button><div id="kv-mp3-body" hidden><header><b>Âm Luật Kỳ Viện</b><button id="kv-mp3-close" type="button" aria-label="Thu gọn, nhạc vẫn phát">×</button></header><label>Bài nhạc<select id="kv-mp3-list"></select></label><div class="kv-mp3-actions"><button id="kv-mp3-prev" type="button">❮ Trước</button><button id="kv-mp3-play" type="button">Phát nhạc</button><button id="kv-mp3-next" type="button">Sau ❯</button></div><label>Âm lượng <output id="kv-mp3-level"></output><input id="kv-mp3-volume" type="range" min="0" max="100" step="1"></label><p id="kv-mp3-status" role="status">Chọn bài và bấm Phát nhạc.</p><small>Đóng bảng vẫn nghe nhạc. Bấm Tắt nhạc để dừng.</small></div>';
  const style = document.createElement("style");
  style.textContent =
    "#kv-mp3{position:fixed;right:14px;bottom:14px;z-index:9999;width:48px;font:13px/1.5 Arial,sans-serif;color:#f8e5b2}#kv-mp3 button,#kv-mp3 select{font:inherit;background:#24372b;color:#ffe4a0;border:1px solid #b18b48;border-radius:8px;padding:8px;cursor:pointer}#kv-mp3 #kv-mp3-open{width:48px;height:48px;border-radius:50%;font-size:22px;box-shadow:0 3px 16px #0006}#kv-mp3-open[data-playing=true]{border-color:#f5d778;box-shadow:0 0 14px #c89a4955}#kv-mp3-body{position:absolute;right:0;bottom:58px;width:min(330px,calc(100vw - 28px));box-sizing:border-box;background:linear-gradient(135deg,#30251a,#172b23);border:2px solid #a98243;border-radius:12px;padding:12px;box-shadow:0 6px 26px #0007;max-height:calc(100dvh - 100px);overflow:auto}#kv-mp3-body[hidden]{display:none}#kv-mp3 header,.kv-mp3-actions{display:flex;align-items:center;justify-content:space-between;gap:5px}#kv-mp3 label{display:block;margin:10px 0}#kv-mp3 select,#kv-mp3 input{display:block;width:100%;box-sizing:border-box;margin-top:5px}#kv-mp3 small{color:#d2c09c}#kv-mp3 button:focus-visible,#kv-mp3 select:focus-visible,#kv-mp3 input:focus-visible{outline:2px solid #ffe5a4;outline-offset:3px}";
  document.head.append(style);
  document.body.append(panel);
  const el = (id) => panel.querySelector("#kv-mp3-" + id),
    status = el("status");
  tracks.forEach(([id, title], i) => {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = title;
    el("list").append(o);
  });
  function render() {
    el("list").value = String(index);
    el("play").textContent = wanted ? "Tắt nhạc" : "Phát nhạc";
    el("play").setAttribute("aria-pressed", String(wanted));
    el("open").setAttribute("data-playing", String(!audio.paused));
    el("open").title =
      (wanted ? "Đang phát: " : "Chọn nhạc: ") + tracks[index][1];
    el("level").textContent = volume + "%";
    el("volume").value = String(volume);
  }
  function preference(value) {
    write(PREF, { ...read(PREF), music: value });
    window.dispatchEvent(new Event("kyvan-settings"));
  }
  function persist() {
    write(KEY, {
      id: tracks[index][0],
      volume,
      time: loaded && audio.readyState >= 1 ? audio.currentTime : pendingTime,
    });
  }
  function load() {
    if (loaded) return;
    loaded = true;
    audio.src = "/ky-music/audio/" + tracks[index][0];
  }
  function stop() {
    wanted = false;
    generation++;
    audio.pause();
    persist();
    preference(false);
    render();
    status.textContent = "Đã tắt nhạc.";
  }
  async function start(auto) {
    const request = ++generation;
    wanted = true;
    preference(true);
    load();
    render();
    status.textContent = "Đang tải: " + tracks[index][1];
    try {
      await audio.play();
      if (request !== generation) return;
      render();
      status.textContent = "Đang phát: " + tracks[index][1];
    } catch (e) {
      if (request !== generation) return;
      wanted = false;
      // Tự phát lại bị trình duyệt chặn: giữ nguyên lựa chọn bật nhạc, chờ thao tác đầu tiên.
      if (!(auto && e.name === "NotAllowedError")) preference(false);
      render();
      status.textContent =
        e.name === "NotAllowedError"
          ? "Bấm Phát nhạc để trình duyệt cho phép phát âm thanh."
          : "Không phát được. Kiểm tra file public/ky-music/audio/" +
            tracks[index][0];
    }
  }
  function choose(i) {
    const resume = wanted;
    generation++;
    audio.pause();
    persist();
    index = i;
    pendingTime = 0;
    loaded = false;
    audio.removeAttribute("src");
    audio.load();
    render();
    persist();
    status.textContent = "Đã chọn: " + tracks[index][1];
    if (resume) void start();
  }
  function command(c) {
    if (c === "stop") stop();
    else if (c === "toggle") {
      if (wanted) stop();
      else void start();
    }
  }
  function collapse() {
    el("body").hidden = true;
    el("open").setAttribute("aria-expanded", "false");
    el("open").focus();
  }
  el("open").onclick = () => {
    el("body").hidden = !el("body").hidden;
    el("open").setAttribute("aria-expanded", String(!el("body").hidden));
  };
  el("close").onclick = collapse;
  panel.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      collapse();
      e.stopPropagation();
    }
  });
  el("play").onclick = () => command("toggle");
  el("list").onchange = () => choose(Number(el("list").value));
  el("prev").onclick = () =>
    choose((index + tracks.length - 1) % tracks.length);
  el("next").onclick = () => choose((index + 1) % tracks.length);
  el("volume").oninput = (e) => {
    volume = Number(e.target.value);
    audio.volume = volume / 100;
    persist();
    render();
  };
  audio.addEventListener("loadedmetadata", () => {
    if (pendingTime > 0 && Number.isFinite(audio.duration)) {
      audio.currentTime = Math.min(
        pendingTime,
        Math.max(0, audio.duration - 1),
      );
      pendingTime = 0;
    }
  });
  audio.addEventListener("playing", () => {
    if (!wanted) {
      audio.pause();
      return;
    }
    status.textContent = "Đang phát: " + tracks[index][1];
    render();
  });
  audio.addEventListener("pause", render);
  audio.addEventListener("ended", () => {
    if (wanted) choose((index + 1) % tracks.length);
  });
  audio.addEventListener("error", () => {
    if (!loaded) return;
    wanted = false;
    generation++;
    preference(false);
    render();
    status.textContent =
      "Không tải được " +
      tracks[index][0] +
      ". Kiểm tra đường dẫn file hoặc chọn bài khác.";
  });
  window.addEventListener("kyvan-youtube-command", (e) => command(e.detail));
  window.addEventListener("kyvan-toggle-music", () => command("toggle"));
  window.addEventListener("message", (e) => {
    if (
      e.origin === location.origin &&
      e.data?.type === "kyvan-youtube-command" &&
      Array.from(document.querySelectorAll("iframe")).some(
        (f) => f.contentWindow === e.source,
      )
    )
      command(e.data.command);
  });
  function sync() {
    const enabled = read(PREF).music === true;
    if (enabled !== wanted) {
      if (enabled) void start();
      else stop();
    }
  }
  window.addEventListener("kyvan-settings", sync);
  window.addEventListener("storage", (e) => {
    if (e.key === PREF) sync();
  });
  window.addEventListener("pagehide", persist);
  setInterval(() => {
    if (wanted) persist();
  }, 5000);
  render();
  if (read(PREF).music === true) {
    status.textContent = "Bấm vào trang để tiếp tục bài đã lưu.";
    // Sau khi tải lại trang: thử phát ngay, nếu bị chặn thì phát ở thao tác đầu tiên.
    void start(true);
    const resume = () => {
      if (read(PREF).music === true && !wanted) void start(true);
      else if (wanted) cleanup();
    };
    const cleanup = () => {
      document.removeEventListener("pointerdown", resume, true);
      document.removeEventListener("keydown", resume, true);
    };
    document.addEventListener("pointerdown", resume, true);
    document.addEventListener("keydown", resume, true);
    audio.addEventListener("playing", cleanup, { once: true });
  }
})();

/* Legacy YouTube implementation retained below. The shared installation flag above prevents it from running. */
/* KYVIEN_YOUTUBE_V1 — one visible YouTube player per top-level page. */
(() => {
  if (window.__kyMusicInstalled) return;
  window.__kyMusicInstalled = true;
  if (window.parent !== window) {
    window.addEventListener("kyvan-toggle-music", () =>
      window.parent.postMessage(
        { type: "kyvan-youtube-command", command: "toggle" },
        location.origin,
      ),
    );
    return;
  }
  const tracks = [
    ["B4kdxiDArZA", "Trúc Lâm Tĩnh Tâm"],
    ["QU_ZXKlBk9I", "Vân Sơn Kỳ Hội"],
    ["Zyut294uVNE", "Nguyệt Dạ Đối Kỳ"],
    ["7QV9JIx-euE", "Phong Vân Kỳ Đài"],
    ["MzgMBrtrFc4", "Giang Hồ Tri Kỷ"],
  ];
  const KEY = "kyvan.youtube.v1",
    PREF = "kyvan.settings.v1";
  const read = (k) => {
    try {
      return JSON.parse(localStorage.getItem(k) || "{}") || {};
    } catch {
      return {};
    }
  };
  const save = (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  };
  const stored = read(KEY);
  let index = Math.max(
      0,
      tracks.findIndex((t) => t[0] === stored.id),
    ),
    volume = Number.isFinite(stored.volume)
      ? Math.max(0, Math.min(100, stored.volume))
      : 30;
  let player = null,
    ready = false,
    wanted = false,
    loading = false,
    timeout = null,
    offset = Number.isFinite(stored.time) ? Math.max(0, stored.time) : 0;
  const panel = document.createElement("section");
  panel.id = "ky-youtube-panel";
  panel.setAttribute("aria-label", "Nhạc nền Kỳ Viện");
  panel.innerHTML =
    '<button type="button" id="ky-music-open" aria-expanded="false">♫ Nhạc nền · Chọn bài</button><div id="ky-music-body" hidden><header><b>Âm Luật Kỳ Viện</b><button type="button" id="ky-music-close" aria-label="Đóng và tắt nhạc">×</button></header><label>Bài nhạc <select id="ky-music-list"></select></label><div id="ky-music-video"><div id="ky-music-embed"></div></div><div class="ky-music-actions"><button type="button" id="ky-music-prev">❮ Bài trước</button><button type="button" id="ky-music-play">Phát nhạc</button><button type="button" id="ky-music-next">Bài sau ❯</button></div><label>Âm lượng <input id="ky-music-volume" type="range" min="0" max="100" step="1"></label><p id="ky-music-status" role="status">Bấm Phát nhạc để bắt đầu.</p><a id="ky-music-source" target="_blank" rel="noopener noreferrer">Mở bài gốc trên YouTube ↗</a><small>Tên trong danh sách do Kỳ Viện đặt, không phải tên gốc.</small></div>';
  const css = document.createElement("style");
  css.textContent =
    "#ky-youtube-panel{position:fixed;right:12px;bottom:12px;z-index:9999;font:13px/1.5 Arial,sans-serif;color:#f5e5b9;width:min(360px,calc(100vw - 24px))}#ky-youtube-panel button,#ky-youtube-panel select{font:inherit;background:#23382b;color:#ffe4a2;border:1px solid #9b793e;border-radius:6px;padding:7px;cursor:pointer}#ky-music-open{float:right}#ky-music-body{clear:both;background:#201c16;border:2px solid #a98041;border-radius:12px;padding:10px;box-shadow:0 6px 22px #0008;max-height:calc(100dvh - 65px);overflow:auto}#ky-music-body[hidden]{display:none}#ky-music-body header,.ky-music-actions{display:flex;align-items:center;justify-content:space-between;gap:5px}#ky-music-body label{display:block;margin:8px 0}#ky-music-list{max-width:100%}#ky-music-video{width:100%;height:210px;margin:8px 0;background:#0b1215}#ky-music-video iframe{width:100%;height:210px}#ky-music-body small{display:block;color:#c7ba96}#ky-music-body a{color:#f3d28a}#ky-music-status{margin:8px 0}#ky-youtube-panel button:focus-visible,#ky-youtube-panel select:focus-visible{outline:3px solid #e7c46b;outline-offset:2px}";
  document.head.append(css);
  document.body.append(panel);
  const el = (id) => panel.querySelector("#" + id),
    body = el("ky-music-body"),
    list = el("ky-music-list"),
    status = el("ky-music-status");
  tracks.forEach(([id, title], i) => {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = i + 1 + ". " + title;
    list.append(o);
  });
  function label() {
    list.value = String(index);
    el("ky-music-source").href =
      "https://www.youtube.com/watch?v=" + tracks[index][0];
    el("ky-music-play").textContent = wanted ? "Tắt nhạc" : "Phát nhạc";
    el("ky-music-play").setAttribute("aria-pressed", String(wanted));
  }
  function persist() {
    let time = offset;
    try {
      if (ready) time = player.getCurrentTime() || 0;
    } catch {}
    save(KEY, { id: tracks[index][0], volume, time });
  }
  function preference(value) {
    save(PREF, { ...read(PREF), music: value });
    window.dispatchEvent(new Event("kyvan-settings"));
  }
  function open() {
    body.hidden = false;
    el("ky-music-open").setAttribute("aria-expanded", "true");
  }
  function stop() {
    wanted = false;
    if (ready) player.pauseVideo();
    persist();
    preference(false);
    label();
    status.textContent = "Đã tắt nhạc.";
  }
  function error(message) {
    wanted = false;
    loading = false;
    clearTimeout(timeout);
    preference(false);
    label();
    status.textContent = message;
  }
  function create() {
    if (player) return;
    player = new YT.Player("ky-music-embed", {
      width: "336",
      height: "210",
      videoId: tracks[index][0],
      playerVars: {
        playsinline: 1,
        controls: 1,
        origin: location.origin,
        start: Math.floor(offset),
      },
      events: {
        onReady: () => {
          clearTimeout(timeout);
          ready = true;
          loading = false;
          player.setVolume(volume);
          if (wanted) player.playVideo();
        },
        onStateChange: (e) => {
          if (e.data === 1) {
            wanted = true;
            preference(true);
            label();
            status.textContent = "Đang phát: " + tracks[index][1];
          } else if (e.data === 2) {
            wanted = false;
            preference(false);
            label();
            status.textContent = "Đã tạm dừng.";
            persist();
          } else if (e.data === 0) {
            choose((index + 1) % tracks.length, true);
          }
        },
        onAutoplayBlocked: () =>
          error("Trình duyệt chặn tự phát. Bấm nút phát ngay trong video."),
        onError: (e) =>
          error(
            "Không phát được bài này (mã " +
              e.data +
              "). Hãy chọn bài khác hoặc mở YouTube.",
          ),
      },
    });
  }
  function start() {
    wanted = true;
    open();
    preference(true);
    label();
    if (ready) {
      player.playVideo();
      return;
    }
    status.textContent = "Đang tải trình phát YouTube…";
    if (loading) return;
    loading = true;
    timeout = setTimeout(
      () => error("Chưa tải được YouTube. Kiểm tra mạng rồi bấm Phát lại."),
      15000,
    );
    if (window.YT?.Player) {
      create();
      return;
    }
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === "function") previous();
      create();
    };
    if (
      !document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]',
      )
    ) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.onerror = () =>
        error("Không tải được YouTube. Hãy tải lại trang và thử lại.");
      document.head.append(script);
    }
  }
  function choose(i, play = wanted) {
    persist();
    index = i;
    offset = 0;
    save(KEY, { id: tracks[index][0], volume, time: 0 });
    label();
    if (ready) {
      if (play) {
        wanted = true;
        preference(true);
        player.loadVideoById(tracks[index][0]);
      } else player.cueVideoById(tracks[index][0]);
    } else if (play) start();
    status.textContent = "Đã chọn: " + tracks[index][1];
  }
  function command(c) {
    if (c === "stop") stop();
    else if (c === "toggle") {
      if (wanted) stop();
      else start();
    }
  }
  el("ky-music-open").onclick = () => {
    if (body.hidden) open();
    else {
      stop();
      body.hidden = true;
      el("ky-music-open").setAttribute("aria-expanded", "false");
    }
  };
  el("ky-music-close").onclick = () => {
    stop();
    body.hidden = true;
    el("ky-music-open").setAttribute("aria-expanded", "false");
    el("ky-music-open").focus();
  };
  el("ky-music-play").onclick = () => command("toggle");
  list.onchange = () => choose(Number(list.value));
  el("ky-music-prev").onclick = () =>
    choose((index + tracks.length - 1) % tracks.length);
  el("ky-music-next").onclick = () => choose((index + 1) % tracks.length);
  el("ky-music-volume").value = String(volume);
  el("ky-music-volume").oninput = (e) => {
    volume = Number(e.target.value);
    if (ready) player.setVolume(volume);
    persist();
  };
  window.addEventListener("kyvan-youtube-command", (e) => command(e.detail));
  window.addEventListener("kyvan-toggle-music", () => command("toggle"));
  window.addEventListener("message", (e) => {
    if (
      e.origin === location.origin &&
      e.data?.type === "kyvan-youtube-command" &&
      Array.from(document.querySelectorAll("iframe")).some(
        (f) => f.contentWindow === e.source,
      )
    )
      command(e.data.command);
  });
  const sync = () => {
    const enabled = read(PREF).music === true;
    if (!enabled && wanted) {
      wanted = false;
      if (ready) player.pauseVideo();
      label();
    } else if (enabled && !wanted) start();
  };
  window.addEventListener("kyvan-settings", () => {
    if ((read(PREF).music === true) !== wanted) sync();
  });
  window.addEventListener("storage", (e) => {
    if (e.key === PREF) sync();
  });
  // Preserve choice and playback position, but require a fresh gesture after full navigation.
  const remembered = read(PREF).music === true;
  label();
  if (remembered) status.textContent = "Bấm Phát để tiếp tục bài đã chọn.";
  setInterval(persist, 5000);
  window.addEventListener("pagehide", persist);
})();
