"use client";
import { useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "@/lib/api";
export default function SessionGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const changed = () => location.replace("/dang-nhap");
    window.addEventListener("kyvan-session-changed", changed);
    api("/auth/me")
      .then(() => {
        if (live) setReady(true);
      })
      .catch((e) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 401)
          location.replace("/dang-nhap");
        else setError(e.message);
      });
    return () => {
      live = false;
      window.removeEventListener("kyvan-session-changed", changed);
    };
  }, []);
  if (ready) return children;
  return (
    <div style={{ padding: 40, textAlign: "center", color: "#e3d0a6" }}>
      <p role="status">{error || "Đang kiểm tra tài khoản…"}</p>
      {error && <a href="/dang-nhap">Mở trang đăng nhập</a>}
    </div>
  );
}
