"use client";
// KYVIEN_COUP_V1
import { roomVariantApi, type VariantRoom } from "@/lib/coup-client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, Room } from "@/lib/api";
import KvTopbar from "@/components/kv-topbar";
import "../ban-be/features.css";

export default function PrivateRoomPage() {
  const [variant, setVariant] = useState<"xiangqi" | "coup">("xiangqi");
  const api = roomVariantApi(variant);

  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("Giao hữu bằng hữu");
  const [stake, setStake] = useState(100);
  const [total, setTotal] = useState(900);
  const [move, setMove] = useState(60);
  const [code, setCode] = useState("");
  const [created, setCreated] = useState<Room | null>(null);
  useEffect(() => {
    if (!created) return;
    let live = true;
    const t = setInterval(() => {
      void api<Room>("/rooms/" + created.code)
        .then((r) => {
          if (live && r.status === "playing")
            router.push("/ghep-tran?room=" + r.code);
        })
        .catch(() => {});
    }, 2000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [created, router]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "create") {
        setCreated(
          await api<Room>("/rooms", "POST", {
            name,
            total_seconds: total,
            move_seconds: move,
            stake,
          }),
        );
      } else {
        const preview = await api<{
          stake: number;
          total_seconds: number;
          move_seconds: number;
          host: string;
          variant?: "xiangqi" | "coup";
        }>(
          "/rooms/" +
            encodeURIComponent(code.trim().toUpperCase()) +
            "/preview",
        );
        if (
          !window.confirm(
            `${preview.variant === "coup" ? "CỜ ÚP" : "CỜ TƯỚNG"} · Đấu với ${preview.host}: ${preview.stake} xu/người, ${preview.total_seconds / 60} phút/người, ${preview.move_seconds} giây/lượt. Xác nhận vào bàn và giữ xu?`,
          )
        )
          return;
        const room = await api<Room>(
          "/rooms/" + encodeURIComponent(code.trim().toUpperCase()) + "/join",
          "POST",
          {},
        );
        router.push("/ghep-tran?room=" + room.code);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.push("/dang-nhap");
        return;
      }
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="feature-page kv-page">
      <KvTopbar title="Phòng giao hữu" current="/phong" />
      <section className="feature-hero">
        <h1>Tạo hoặc tìm phòng</h1>
      </section>
      <div className="room-tabs">
        <button
          className={mode === "create" ? "selected" : ""}
          onClick={() => {
            setMode("create");
            setCreated(null);
            setError("");
          }}
        >
          ＋ Tạo phòng
        </button>
        <button
          className={mode === "join" ? "selected" : ""}
          onClick={() => {
            setMode("join");
            setCreated(null);
            setError("");
          }}
        >
          ⌕ Tìm phòng bằng mã
        </button>
      </div>
      {created && error && <p role="status">{error}</p>}
      {created ? (
        <section className="feature-card room-created">
          <p>
            {(created as VariantRoom).variant === "coup" ? "CỜ ÚP" : "CỜ TƯỚNG"}
          </p>
          <span>MÃ PHÒNG CỦA BẠN</span>
          <strong>{created.code}</strong>
          <p>
            Gửi mã này cho bạn bè. Họ vào mục “Tìm phòng bằng mã” để tham gia.
          </p>
          <div>
            <button
              onClick={() =>
                void navigator.clipboard
                  .writeText(created.code)
                  .then(() => setError("Đã sao chép mã phòng."))
                  .catch(() => setError("Hãy sao chép mã hiển thị phía trên."))
              }
            >
              Sao chép mã
            </button>
            <button
              onClick={() => router.push("/ghep-tran?room=" + created.code)}
            >
              Vào phòng chờ
            </button>
          </div>
        </section>
      ) : (
        <form className="feature-card room-form" onSubmit={submit}>
          {mode === "create" ? (
            <>
              <label>
                Loại cờ
                <select
                  value={variant}
                  onChange={(e) =>
                    setVariant(e.target.value as "xiangqi" | "coup")
                  }
                >
                  <option value="xiangqi">Cờ tướng</option>
                  <option value="coup">Cờ úp · xáo quân kín</option>
                </select>
              </label>

              <label>
                Tên phòng
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  required
                />
              </label>
              <label>
                Mức cược mỗi người
                <select
                  value={stake}
                  onChange={(e) => setStake(Number(e.target.value))}
                >
                  <option value={100}>100 xu · tối thiểu</option>
                  <option value={250}>250 xu</option>
                  <option value={500}>500 xu</option>
                  <option value={1000}>1.000 xu</option>
                </select>
              </label>
              <label>
                Thời gian tổng mỗi người
                <select
                  value={total}
                  onChange={(e) => setTotal(Number(e.target.value))}
                >
                  <option value={300}>5 phút</option>
                  <option value={600}>10 phút</option>
                  <option value={900}>15 phút</option>
                  <option value={1200}>20 phút</option>
                  <option value={1800}>30 phút</option>
                  <option value={3600}>60 phút</option>
                </select>
              </label>
              <label>
                Giới hạn mỗi lượt
                <select
                  value={move}
                  onChange={(e) => setMove(Number(e.target.value))}
                >
                  <option value={30}>30 giây</option>
                  <option value={60}>60 giây</option>
                </select>
              </label>
              <p className="room-note">
                Cả hai người cần đủ số xu cược. Xu được giữ khi người thứ hai
                tham gia; hòa thì hoàn lại, thắng nhận tổng xu của bàn.
              </p>
            </>
          ) : (
            <label>
              Mã phòng
              <input
                className="room-code-input"
                value={code}
                onChange={(e) =>
                  setCode(
                    e.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase(),
                  )
                }
                maxLength={6}
                minLength={6}
                placeholder="Ví dụ A7K9F2"
                required
              />
            </label>
          )}
          {error && <p className="feature-message">{error}</p>}
          <button className="room-submit" disabled={busy}>
            {busy
              ? "Đang xử lý…"
              : mode === "create"
                ? "Tạo phòng và nhận mã"
                : "Tìm phòng, vào trận"}
          </button>
        </form>
      )}
    </main>
  );
}
