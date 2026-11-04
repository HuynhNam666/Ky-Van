/* The homepage iframe and the Next pages share this tab's sessionStorage. */
(() => {
  const KEY = "kyvan.tab-session.v1";
  const name = document.getElementById("kv-account-name");
  const rank = document.getElementById("kv-account-rank");
  if (!name) return;
  const PROFILE_KEY = "kyvan.tab-profile.v1";
  let user = null;
  try {
    const profile = JSON.parse(sessionStorage.getItem(PROFILE_KEY) || "null");
    if (
      token() &&
      profile?.token === token() &&
      typeof profile?.user?.id === "number" &&
      typeof profile?.user?.username === "string"
    )
      user = profile.user;
  } catch {
    /* The server will load the profile. */
  }
  let checkingAccount = !!token(),
    walletBusy = false;
  const avatar = document.querySelector('img[alt="Avatar Kỳ Thủ"]');
  const style = document.createElement("style");
  style.textContent =
    ".kv-account-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.kv-account-actions a,.kv-account-actions button{font:11px Arial,sans-serif;color:#f6db9b;background:#273d2d;border:1px solid #ab8d4a88;border-radius:5px;padding:7px 9px;cursor:pointer;text-decoration:none}.kv-account-actions a:first-child{background:#bf9b58;color:#17281c}.kv-account-actions a[data-google]{display:inline-flex;align-items:center;gap:5px;background:#fff;color:#1f1f1f;border-color:#dadce0;font-weight:700}.kv-account-actions a[data-google] svg{width:13px;height:13px;flex:none}.kv-home-status{font:10px/1.5 Arial,sans-serif;color:#b7c7ad;margin-top:6px;max-width:240px}.kv-home-status.error{color:#ffc3a0}";
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

  function googleLink() {
    const a = document.createElement("a");
    a.dataset.google = "";
    a.href = "/api/auth/google/start?next=/";
    a.target = "_top";
    a.title = "Đăng nhập bằng Gmail";
    a.setAttribute("aria-label", "Đăng nhập bằng Gmail");
    a.innerHTML =
      '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg><span>Gmail</span>';
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
    // --- CODE CU GIU NGUYEN DE DOI CHIEU; KHONG THUC THI ---
    // ORIGINAL |     if (!user) {
    // ORIGINAL |       resetWallet();
    // ORIGINAL |       return;
    // ORIGINAL |     }
    // ORIGINAL |
    // --- PHAN CAP NHAT DANG SU DUNG ---
    if (!user) {
      resetWallet();
      return;
    }
    if (walletBusy) return;
    walletBusy = true;
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
      // --- CODE CU GIU NGUYEN DE DOI CHIEU; KHONG THUC THI ---
      // ORIGINAL |     }
      // --- PHAN CAP NHAT DANG SU DUNG ---
    } finally {
      walletBusy = false;
    }
  }

  function render() {
    actions.replaceChildren();
    // --- CODE CU GIU NGUYEN DE DOI CHIEU; KHONG THUC THI ---
    // ORIGINAL |     name.textContent = user ? user.username : "Khách chưa đăng nhập";
    // --- PHAN CAP NHAT DANG SU DUNG ---
    name.textContent = user
      ? user.username
      : checkingAccount
        ? "Đang tải tài khoản…"
        : "Khách chưa đăng nhập";
    if (rank) rank.textContent = user ? "Kỳ thủ" : "Khách";
    if (avatar) {
      avatar.style.opacity = user ? "1" : ".25";
      avatar.alt = user ? "Ảnh đại diện mặc định" : "Ảnh đại diện khách";
    }
    if (!user) {
      resetWallet();
      if (checkingAccount) return;
      link("Đăng nhập", "/dang-nhap");
      link("Đăng ký", "/dang-ky");
      googleLink();
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
        sessionStorage.removeItem(PROFILE_KEY);
        checkingAccount = false;
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
    // --- CODE CU GIU NGUYEN DE DOI CHIEU; KHONG THUC THI ---
    // ORIGINAL |     if (!token()) return;
    // --- PHAN CAP NHAT DANG SU DUNG ---
    const requestedToken = token();
    if (!requestedToken) return;
    try {
      const r = await fetch("/api/auth/me", {
        signal: AbortSignal.timeout(20000),
        credentials: "omit",
        cache: "no-store",
        headers: headers(),
      });
      if (token() !== requestedToken) return;
      if (r.status === 401) {
        sessionStorage.removeItem(KEY);
        sessionStorage.removeItem(PROFILE_KEY);
        checkingAccount = false;
        user = null;
        render();
        status.textContent = "Phiên hết hạn. Vui lòng đăng nhập lại.";
        return;
      }
      if (!r.ok)
        throw Error(
          "Chưa tải được tài khoản. Kiểm tra backend và tải lại trang.",
        );
      // --- CODE CU GIU NGUYEN DE DOI CHIEU; KHONG THUC THI ---
      // ORIGINAL |       user = await r.json();
      // --- PHAN CAP NHAT DANG SU DUNG ---
      const loadedUser = await r.json();
      if (token() !== requestedToken) return;
      user = loadedUser;
      checkingAccount = false;
      sessionStorage.setItem(
        PROFILE_KEY,
        JSON.stringify({
          token: requestedToken,
          user: { id: user.id, username: user.username },
          verifiedAt: Date.now(),
        }),
      );
      status.textContent = "";
      status.classList.remove("error");
      render();
    } catch (e) {
      status.textContent = e.message;
      status.classList.add("error");
    }
  };
  const loaded = load();
  const accountRetry = setInterval(() => {
    if (!checkingAccount || !token()) {
      clearInterval(accountRetry);
      return;
    }
    // load() runs once initially; retry only after that initial request settles.
    if (!document.hidden && !accountBusy) void retryAccount();
  }, 5000);
  let accountBusy = true;
  void loaded.finally(() => {
    accountBusy = false;
  });
  async function retryAccount() {
    accountBusy = true;
    try {
      await load();
    } finally {
      accountBusy = false;
    }
  }

  setInterval(() => {
    if (!document.hidden) void loadWallet();
  }, 30000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void loadWallet();
  });

  // --- CODE CU GIU NGUYEN DE DOI CHIEU; KHONG THUC THI ---
  // ORIGINAL |   const presence = () => {
  // ORIGINAL |     if (user && !document.hidden)
  // ORIGINAL |       void fetch("/api/presence/heartbeat", {
  // ORIGINAL |         method: "POST",
  // ORIGINAL |         credentials: "omit",
  // ORIGINAL |         headers: headers(),
  // ORIGINAL |       }).catch(() => {});
  // ORIGINAL |   };
  // ORIGINAL |   presence();
  // ORIGINAL |   setInterval(presence, 20000);
  // --- PHAN CAP NHAT DANG SU DUNG ---
  // PresenceHeartbeat in the parent layout owns the heartbeat.
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
        window.kyVanGo("/dang-nhap");
        return;
      }
      if (title === "Tạo phòng") window.kyVanGo("/phong");
      else if (title === "Bằng Hữu / Kết Giao")
        window.kyVanGo("/ban-be");
      else if (title === "Thiết Lập") window.kyVanGo("/cai-dat");
      else window.dispatchEvent(new Event("kyvan-toggle-music"));
    },
    true,
  );
  window.addEventListener("pagehide", stopHomeMusic);
  window.kyVanEnterGame = async (path) => {
    await loaded;
    if (!user) {
      window.kyVanGo("/dang-nhap");
      return;
    }
    window.kyVanGo(path);
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
        if (!user) window.kyVanGo("/dang-nhap");
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
        // --- CODE CU GIU NGUYEN DE DOI CHIEU; KHONG THUC THI ---
        // ORIGINAL |         "Chưa kết nối backend. Kiểm tra terminal cổng 8000 và BACKEND_URL.";
        // --- PHAN CAP NHAT DANG SU DUNG ---
        "Máy chủ đang kết nối lại. Tài khoản được giữ nguyên; vui lòng chờ một chút.";
      status.classList.add("error");
    });
})();
