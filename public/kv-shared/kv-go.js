/* Chuyển trang mượt cho trang tĩnh nằm trong iframe: nhờ cửa sổ cha (Next.js) đổi route
   để trình phát nhạc ở cửa sổ cha không bị tải lại và tắt. */
(() => {
  if (window.kyVanGo) return;
  const internal = (href) => {
    try {
      const u = new URL(href, location.href);
      return u.origin === location.origin && !u.pathname.startsWith("/api/")
        ? u.pathname + u.search + u.hash
        : null;
    } catch {
      return null;
    }
  };
  window.kyVanGo = (path) => {
    const target = internal(path);
    if (!target) return void location.assign(path);
    if (window.top === window) return void location.assign(target);
    try {
      window.top.postMessage({ type: "kyvan-navigate", path: target }, location.origin);
    } catch {
      window.top.location.assign(target);
    }
  };
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.("a[href]");
    if (!a || a.hasAttribute("download") || (a.target && a.target !== "_top" && a.target !== "_self")) return;
    const href = a.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    const target = internal(href);
    if (!target || window.top === window) return;
    e.preventDefault();
    window.kyVanGo(target);
  });
  // Menu "Chức năng": đóng khi bấm ra ngoài hoặc nhấn Escape.
  const closeMenu = (e) => {
    document.querySelectorAll(".kv-menu[open]").forEach((m) => {
      if (e.type === "keydown" ? e.key === "Escape" : !m.contains(e.target)) m.open = false;
    });
  };
  document.addEventListener("pointerdown", closeMenu);
  document.addEventListener("keydown", closeMenu);
})();
