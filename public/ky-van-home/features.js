/* Nối hai mục ở trang chủ: Phá Thế Sát Cục -> /pha-the, Bảng Phong Vân -> /bang-phong-van. */
(() => {
  const routes = [
    [/Phá\s*Thế\s*Sát\s*Cục/i, "/pha-the", "Phá thế sát cục · chiếu bí trong 1-3 nước"],
    [/Bảng\s*Phong\s*Vân/i, "/bang-phong-van", "Bảng xếp hạng kỳ thủ"],
  ];
  const find = (a) => a && routes.find(([re]) => re.test(a.textContent));
  document.querySelectorAll("a").forEach((a) => {
    const hit = find(a);
    if (hit) {
      a.href = hit[1];
      a.title = hit[2];
    }
  });
  document.addEventListener(
    "click",
    (e) => {
      const a = e.target.closest?.("a");
      const hit = find(a);
      if (!hit || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      window.kyVanGo(hit[1]);
    },
    true,
  );
})();
