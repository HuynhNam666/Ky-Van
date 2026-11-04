"use client";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
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
import GoogleMark from "@/components/google-mark";
import { api, googleSignInUrl, safeNextPath, type User } from "@/lib/api";
import "./account-form.css";
const GOOGLE_ERRORS: Record<string, string> = {
  unconfigured:
    "Đăng nhập bằng Gmail chưa được bật trên máy chủ. Quản trị viên cần đặt GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET.",
  denied: "Bạn đã hủy đăng nhập bằng Google.",
  state: "Phiên xác thực Google đã hết hạn. Vui lòng bấm đăng nhập lại.",
  missing_code: "Google không trả về mã xác thực. Vui lòng thử lại.",
  exchange: "Chưa xác minh được tài khoản Google. Vui lòng thử lại.",
  account:
    "Không đăng nhập được bằng tài khoản Google này. Vui lòng thử tài khoản khác.",
};
const noSubscribe = () => () => {};
export default function AccountForm({ register }: { register: boolean }) {
  // False during server rendering, true once the browser takes over.
  const hydrated = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [show, setShow] = useState(false),
    googleOnce = useRef("");
  // The Google callback sends a one-time ticket back to this page.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ticket = params.get("google_ticket");
    const failure = params.get("google_error");
    const nextPath = safeNextPath(params.get("next"));
    if (!ticket && !failure) return;
    // StrictMode runs the effect twice; only the first run may spend the ticket.
    const marker = ticket || "error:" + failure;
    if (googleOnce.current === marker) return;
    googleOnce.current = marker;
    params.delete("google_ticket");
    params.delete("google_error");
    const query = params.toString();
    history.replaceState(
      null,
      "",
      location.pathname + (query ? "?" + query : ""),
    );
    if (failure) {
      const message =
        GOOGLE_ERRORS[failure] || "Đăng nhập bằng Google chưa hoàn tất.";
      queueMicrotask(() => setError(message));
      return;
    }
    void (async () => {
      // Yield first so these updates aren't treated as synchronous effect state.
      await Promise.resolve();
      setBusy(true);
      try {
        await api<User>("/auth/google/exchange", "POST", { ticket });
        location.replace(nextPath);
      } catch (e) {
        setError((e as Error).message);
        setBusy(false);
      }
    })();
  }, []);
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
    <main className="kv-account kv-page">
      <Link className="kv-account-back" href="/">
        <ArrowLeft size={17} /> Về trang chủ
      </Link>
      <section className="kv-account-shell">
        <aside className="kv-account-art">
          <span className="kv-account-brand">KỲ VÂN CÁC</span>
          <div className="kv-account-emblem">帥</div>
          
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
          
          <h2>{register ? "Đăng ký kỳ thủ" : "Đăng nhập"}</h2>
          <p>
            {register
              ? "Tạo tài khoản để lưu danh tính và giao hữu cùng người chơi khác."
              : "Đăng nhập để gặp đối thủ đang chờ bạn trên kỳ đài."}
          </p>
          <a className="kv-google-button" href={googleSignInUrl("/")}>
            <GoogleMark />
            {register ? "Đăng ký bằng Gmail" : "Đăng nhập bằng Gmail"}
          </a>
          <div className="kv-google-divider">hoặc dùng tên kỳ thủ</div>
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
