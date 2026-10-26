"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  UserRound,
  ShieldCheck,
  Swords,
} from "lucide-react";
import { api, type User } from "@/lib/api";
import "./account-form.css";
export default function AccountForm({ register }: { register: boolean }) {
  const [hydrated,setHydrated]=useState(false);
  useEffect(()=>setHydrated(true),[]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [show, setShow] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password") ?? "");
    if (register && password !== f.get("confirm")) {
      setError("Hai lần nhập mật khẩu chưa giống nhau.");
      return;
    }
    setBusy(true);
    try {
      await api<User>(register ? "/auth/register" : "/auth/login", "POST", {
        username: String(f.get("username")).trim(),
        password,
      });
      location.assign("/");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <main className="kv-account">
      <a className="kv-account-back" href="/">
        <ArrowLeft size={17} /> Về trang chủ
      </a>
      <section className="kv-account-shell">
        <aside className="kv-account-art">
          <span className="kv-account-brand">KỲ VÂN CÁC</span>
          <div className="kv-account-emblem">帥</div>
          <span className="kv-account-caption">GẶP TRI KỶ · ĐẤU TRÍ CỜ</span>
          <h1>
            Một nước cờ.
            <br />
            Một cuộc gặp.
          </h1>
          <p>
            Bước vào kỳ đài, tìm một đối thủ và cùng viết nên ván cờ của riêng
            mình.
          </p>
          <div className="kv-account-note">
            <Swords size={18} />
            <span>Ghép trận ngẫu nhiên · Chat trong ván</span>
          </div>
        </aside>
        <div className="kv-account-form">
          <span className="kv-account-kicker">
            {register ? "BẮT ĐẦU HÀNH TRÌNH" : "CHÀO MỪNG TRỞ LẠI"}
          </span>
          <h2>{register ? "Đăng ký kỳ thủ" : "Đăng nhập"}</h2>
          <p>
            {register
              ? "Tạo tài khoản để lưu danh tính và giao hữu cùng người chơi khác."
              : "Đăng nhập để gặp đối thủ đang chờ bạn trên kỳ đài."}
          </p>
          <form method="post" onSubmit={submit}>
            <label htmlFor="account-name">Tên đăng nhập</label>
            <div className="kv-account-input">
              <UserRound size={18} />
              <input
                id="account-name"
                name="username"
                required
                minLength={3}
                maxLength={24}
                pattern="[a-zA-Z0-9_]{3,24}"
                title="3–24 ký tự gồm chữ không dấu, số hoặc dấu gạch dưới"
                autoComplete="username"
                placeholder="Ví dụ: ky_thu_01"
                spellCheck={false}
              />
            </div>
            <label htmlFor="account-pass">Mật khẩu</label>
            <div className="kv-account-input">
              <LockKeyhole size={18} />
              <input
                id="account-pass"
                name="password"
                required
                minLength={8}
                maxLength={128}
                type={show ? "text" : "password"}
                autoComplete={register ? "new-password" : "current-password"}
                placeholder="Tối thiểu 8 ký tự"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {register && (
              <>
                <label htmlFor="account-confirm">Nhập lại mật khẩu</label>
                <div className="kv-account-input">
                  <ShieldCheck size={18} />
                  <input
                    id="account-confirm"
                    name="confirm"
                    required
                    minLength={8}
                    maxLength={128}
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Nhập lại mật khẩu vừa chọn"
                  />
                </div>
              </>
            )}
            {error && (
              <div className="kv-account-error" role="alert">
                {error}
              </div>
            )}
            <button className="kv-account-submit" disabled={busy || !hydrated}>
              {busy ? "Đang xử lý…" : register ? "Tạo tài khoản" : "Đăng nhập"}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="kv-account-switch">
            {register ? "Đã có tài khoản? " : "Chưa có tài khoản? "}
            <a href={register ? "/dang-nhap" : "/dang-ky"}>
              {register ? "Đăng nhập" : "Đăng ký ngay"}
            </a>
          </p>
          <div className="kv-account-foot">
            <ShieldCheck size={15} /> Phiên đăng nhập riêng cho từng tab.
          </div>
        </div>
      </section>
    </main>
  );
}
