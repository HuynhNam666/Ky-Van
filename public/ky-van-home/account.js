/* The homepage iframe and the Next pages share this tab's sessionStorage. */
(() => {
  const KEY = "kyvan.tab-session.v1";
  const name = document.getElementById("kv-account-name");
  const rank = document.getElementById("kv-account-rank");
  if (!name) return;
  let user = null;
  const avatar = document.querySelector('img[alt="Avatar Kỳ Thủ"]');
  const style = document.createElement("style");
  style.textContent =
    ".kv-account-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.kv-account-actions a,.kv-account-actions button{font:11px Arial,sans-serif;color:#f6db9b;background:#273d2d;border:1px solid #ab8d4a88;border-radius:5px;padding:7px 9px;cursor:pointer;text-decoration:none}.kv-account-actions a:first-child{background:#bf9b58;color:#17281c}.kv-home-status{font:10px/1.5 Arial,sans-serif;color:#b7c7ad;margin-top:6px;max-width:240px}.kv-home-status.error{color:#ffc3a0}";
  document.head.append(style);
  const actions = document.createElement("div");
  actions.className = "kv-account-actions";
  const status = document.createElement("p");
  status.className = "kv-home-status";
  status.setAttribute("role", "status");
  name.parentElement.parentElement.append(actions, status);

  function token() {
    try {
      return sessionStorage.getItem(KEY);
    } catch {
      return null;
    }
  }

  function headers() {
    const h = { "Content-Type": "application/json", "X-Session-Mode": "tab" };
    if (token()) h.Authorization = "Bearer " + token();
    return h;
  }

  function link(label, url) {
    const a = document.createElement("a");
    a.textContent = label;
    a.href = url;
    a.target = "_top";
    actions.append(a);
  }

  function resetWallet() {
    for (const id of ["kv-coins", "kv-points", "kv-quest-count"]) {
      const el = document.getElementById(id);
      if (el) el.textContent = "—";
    }
    const bar = document.getElementById("kv-quest-progress");
    if (bar) bar.style.width = "0%";
  }

  async function loadWallet() {
    if (!user) {
      resetWallet();
      return;
    }

    const current = user.id;
    try {
      const r = await fetch("/api/economy", {
        credentials: "omit",
        cache: "no-store",
        headers: headers(),
      });
      if (!r.ok) throw Error("Chưa tải được số xu.");

      const d = await r.json();
      if (user?.id !== current) return;

      const coin = document.getElementById("kv-coins");
      const point = document.getElementById("kv-points");
      const count = document.getElementById("kv-quest-count");
      const bar = document.getElementById("kv-quest-progress");

      if (coin) coin.textContent = d.coins.toLocaleString("vi-VN");
      if (point) point.textContent = d.points.toLocaleString("vi-VN");

      const done = d.tasks.filter((t) => t.claimed).length;
      if (count) count.textContent = done + "/" + d.tasks.length;
      if (bar) {
        bar.style.width =
          (d.tasks.length ? (done / d.tasks.length) * 100 : 0) + "%";
      }
    } catch (e) {
      status.textContent = e.message;
    }
  }

  function render() {
    actions.replaceChildren();
    name.textContent = user ? user.username : "Khách chưa đăng nhập";
    if (rank) rank.textContent = user ? "Kỳ thủ" : "Khách";
    if (avatar) {
      avatar.style.opacity = user ? "1" : ".25";
      avatar.alt = user ? "Ảnh đại diện mặc định" : "Ảnh đại diện khách";
    }
    if (!user) {
      resetWallet();
      link("Đăng nhập", "/dang-nhap");
      link("Đăng ký", "/dang-ky");
      return;
    }
    const out = document.createElement("button");
    out.type = "button";
    out.textContent = "Đăng xuất";
    out.onclick = async () => {
      out.disabled = true;
      try {
        const r = await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "omit",
          headers: headers(),
        });
        if (!r.ok && r.status !== 401)
          throw Error("Chưa đăng xuất được. Hãy kiểm tra backend rồi thử lại.");
        sessionStorage.removeItem(KEY);
        user = null;
        render();
        status.textContent = "Đã đăng xuất khỏi tab này.";
      } catch (e) {
        status.textContent = e.message;
        status.classList.add("error");
        out.disabled = false;
      }
    };
    actions.append(out);
    link("Nhận xu · Nhiệm vụ", "/nhiem-vu");
    void loadWallet();
  }

  render();
  const load = async () => {
    if (!token()) return;
    try {
      const r = await fetch("/api/auth/me", {
        credentials: "omit",
        cache: "no-store",
        headers: headers(),
      });
      if (r.status === 401) {
        sessionStorage.removeItem(KEY);
        render();
        status.textContent = "Phiên hết hạn. Vui lòng đăng nhập lại.";
        return;
      }
      if (!r.ok)
        throw Error(
          "Chưa tải được tài khoản. Kiểm tra backend và tải lại trang.",
        );
      user = await r.json();
      render();
    } catch (e) {
      status.textContent = e.message;
      status.classList.add("error");
    }
  };
  const loaded = load();

  setInterval(() => {
    if (!document.hidden) void loadWallet();
  }, 30000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void loadWallet();
  });

  const presence = () => {
    if (user && !document.hidden)
      void fetch("/api/presence/heartbeat", {
        method: "POST",
        credentials: "omit",
        headers: headers(),
      }).catch(() => {});
  };
  presence();
  setInterval(presence, 20000);
  let musicContext = null,
    musicTimer = null,
    musicStep = 0;
  function stopHomeMusic() {
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = null;
    if (musicContext) {
      void musicContext.close();
      musicContext = null;
    }
  }
  function toggleHomeMusic(button) {
    if (musicContext) {
      stopHomeMusic();
      button.setAttribute("aria-pressed", "false");
      status.textContent = "Đã tắt nhạc nền.";
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) throw Error();
      const ctx = new Ctx();
      musicContext = ctx;
      void ctx.resume();
      const notes = [261.63, 329.63, 392, 440, 392, 329.63, 293.66, 329.63];
      const play = () => {
        if (ctx.state === "closed") return;
        const o = ctx.createOscillator(),
          g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = notes[musicStep++ % notes.length];
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.025, ctx.currentTime + 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.1);
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 2.2);
      };
      play();
      musicTimer = setInterval(play, 1800);
      button.setAttribute("aria-pressed", "true");
      status.textContent = "Đang phát nhạc nền Kỳ Viện.";
    } catch {
      status.textContent = "Trình duyệt hiện không hỗ trợ phát nhạc nền.";
    }
  }
  document.addEventListener(
    "click",
    async (event) => {
      const button = event.target.closest("button[title]");
      if (!button) return;
      const title = button.title;
      if (
        ![
          "Tạo phòng",
          "Bằng Hữu / Kết Giao",
          "Âm Luật Kỳ Các",
          "Thiết Lập",
        ].includes(title)
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      await loaded;
      if (!user) {
        window.top.location.assign("/dang-nhap");
        return;
      }
      if (title === "Tạo phòng") window.top.location.assign("/phong");
      else if (title === "Bằng Hữu / Kết Giao")
        window.top.location.assign("/ban-be");
      else if (title === "Thiết Lập") window.top.location.assign("/cai-dat");
      else window.dispatchEvent(new Event("kyvan-toggle-music"));
    },
    true,
  );
  window.addEventListener("pagehide", stopHomeMusic);
  window.kyVanEnterGame = async (path) => {
    await loaded;
    if (!user) {
      window.top.location.assign("/dang-nhap");
      return;
    }
    window.top.location.assign(path);
  };
  document.querySelectorAll('a[href="/kydai"],a[href="/ky-dai"]').forEach((a) =>
    a.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        void window.kyVanEnterGame(a.getAttribute("href"));
      },
      true,
    ),
  );
  const edit = document.querySelector('button[title="Chỉnh sửa ngoại hiệu"]');
  if (edit)
    edit.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!user) window.top.location.assign("/dang-nhap");
        else status.textContent = "Bạn đang đăng nhập: " + user.username;
      },
      true,
    );
  fetch("/api/health", { cache: "no-store", credentials: "omit" })
    .then(async (r) => {
      const data = await r.json();
      if (!r.ok || data.status !== "ok") throw Error();
      if (!status.textContent) status.textContent = "Máy chủ đã kết nối.";
    })
    .catch(() => {
      status.textContent =
        "Chưa kết nối backend. Kiểm tra terminal cổng 8000 và BACKEND_URL.";
      status.classList.add("error");
    });
})();
