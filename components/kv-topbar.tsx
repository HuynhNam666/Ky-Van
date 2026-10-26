"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";

// Thanh đầu trang chung cho các trang phụ (giao diện: public/kv-shared/kv-theme.css).
// Gọn một hàng: nút "Trang chủ" · tên trang · menu "Chức năng" (gom mọi mục điều hướng).
export const KV_PLAY_NAV = [
  { href: "/ghep-tran", label: "Ghép trận" },
  { href: "/phong", label: "Phòng riêng" },
  { href: "/luyen-may", label: "Luyện với máy" },
  { href: "/pha-the", label: "Phá thế sát cục" },
  { href: "/xem-co", label: "Xem cờ" },
] as const;

export const KV_ACCOUNT_NAV = [
  { href: "/bang-phong-van", label: "Bảng Phong Vân" },
  { href: "/ban-be", label: "Bằng hữu" },
  { href: "/nhiem-vu", label: "Nhiệm vụ" },
  { href: "/ky-thu", label: "Hồ sơ" },
  { href: "/cai-dat", label: "Cài đặt" },
] as const;

type Item = { href: string; label: string };

function NavGroup({ title, items, current }: { title: string; items: readonly Item[]; current?: string }) {
  return (
    <nav className="kv-menu-group" aria-label={title}>
      <span className="kv-menu-label">{title}</span>
      {items.map((n) => (
        <a key={n.href} href={n.href} className="kv-nav-link" aria-current={current === n.href ? "page" : undefined}>
          {n.label}
        </a>
      ))}
    </nav>
  );
}

export default function KvTopbar({ title, current }: { title: string; current?: string }) {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: Event) => {
      const m = menu.current;
      if (!m?.open) return;
      if (e.type === "keydown" && (e as KeyboardEvent).key !== "Escape") return;
      if (e.type === "pointerdown" && m.contains(e.target as Node)) return;
      m.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  return (
    <header className="kv-topbar">
      <Link href="/" className="kv-home-btn" aria-label="Quay về trang chủ Kỳ Vân Các">
        <span className="kv-topbar-seal" aria-hidden="true">棋</span>
        <span>← Trang chủ</span>
      </Link>
      <span className="kv-topbar-title">{title}</span>
      <details className="kv-menu" ref={menu}>
        <summary>☰ Chức năng</summary>
        <div className="kv-menu-panel">
          <NavGroup title="Vào ván cờ" items={KV_PLAY_NAV} current={current} />
          <NavGroup title="Tài khoản" items={KV_ACCOUNT_NAV} current={current} />
        </div>
      </details>
    </header>
  );
}
