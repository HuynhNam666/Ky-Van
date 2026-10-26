"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Chuyển trang không tải lại: giữ nguyên trình phát nhạc nền (public/ky-music/player.js).
// Nhận lệnh từ các trang tĩnh trong iframe và bắt các liên kết nội bộ <a href>.
export default function SoftNav() {
  const router = useRouter();
  useEffect(() => {
    const safe = (p: unknown): p is string =>
      typeof p === "string" && p.startsWith("/") && !p.startsWith("//");
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.data?.type !== "kyvan-navigate") return;
      if (safe(e.data.path)) router.push(e.data.path);
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.hasAttribute("download") || (a.target && a.target !== "_self")) return;
      const href = a.getAttribute("href") ?? "";
      if (!href || href.startsWith("#")) return;
      let u: URL;
      try {
        u = new URL(href, location.href);
      } catch {
        return;
      }
      if (u.origin !== location.origin || u.pathname.startsWith("/api/")) return;
      if (u.pathname === location.pathname && u.search === location.search) return;
      e.preventDefault();
      router.push(u.pathname + u.search + u.hash);
    };
    window.addEventListener("message", onMessage);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("click", onClick);
    };
  }, [router]);
  return null;
}
