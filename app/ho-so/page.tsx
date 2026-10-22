"use client";
// KYVIEN_JOURNEY_V1

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import {
  RankAvatar,
  RankLabel,
  type RankProfile,
  type RankTier,
} from "@/components/rank-profile";
type Avatar = {
  id: string;
  name: string;
  url: string;
  required_tier: number;
  exclusive: boolean;
};
type Catalog = { tiers: RankTier[]; avatars: Avatar[] };
export default function RankPage() {
  const [profile, setProfile] = useState<RankProfile | null>(null),
    [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "exclusive">("all"),
    [tab, setTab] = useState<"avatars" | "ranks">("avatars");
  async function load() {
    try {
      const [p, c] = await Promise.all([
        api<RankProfile>("/progression/me"),
        api<Catalog>("/progression/catalog"),
      ]);
      setProfile(p);
      setCatalog(c);
      setError("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        location.assign("/dang-nhap");
        return;
      }
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function equip(a: Avatar) {
    if (busy || !profile || a.required_tier > profile.tier.index) return;
    setBusy(a.id);
    setError("");
    setNotice("");
    try {
      setProfile(
        await api<RankProfile>("/progression/avatar", "POST", {
          avatar_id: a.id,
        }),
      );
      setNotice(`Đã trang bị ${a.name}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <main className="kv-profile-page">
      <header className="kv-profile-nav">
        <a href="/ky-thu">Hồ sơ · Lịch sử · Ván đã lưu</a>
        <a href="/">← Kỳ Viện</a>
        <span>HỒ SƠ KỲ THỦ</span>
        <a href="/ghep-tran">Vào kỳ đài →</a>
      </header>
      {error && (
        <div className="kv-profile-error" role="alert">
          {error} <button onClick={() => void load()}>Thử lại</button>
        </div>
      )}
      {!profile || !catalog ? (
        <p role="status">
          {error ? "Chưa tải được hồ sơ." : "Đang mở hồ sơ kỳ thủ…"}
        </p>
      ) : (
        <>
          <section className="kv-profile-hero">
            <div className="kv-profile-portrait">
              <RankAvatar profile={profile} />
              <RankLabel profile={profile} />
            </div>
            <div>
              <p className="kv-eyebrow">MỖI VÁN CỜ · MỘT BƯỚC TIẾN</p>
              <h1>Hành trình kỳ thủ</h1>
              <p>
                Gom chiến thắng, chinh phục danh hiệu và mở khóa những chân dung
                dành riêng cho bạn.
              </p>
              <div className="kv-profile-progress">
                <label htmlFor="rank-progress">
                  {profile.next_tier
                    ? `Còn ${profile.next_tier.minimum - profile.points} điểm đến ${profile.next_tier.name}`
                    : "Đã đạt danh hiệu cao nhất"}
                </label>
                <progress id="rank-progress" max="1" value={profile.progress} />
                <small>
                  {profile.points.toLocaleString("vi-VN")} /{" "}
                  {profile.next_tier?.minimum.toLocaleString("vi-VN") ??
                    "Đỉnh cao"}{" "}
                  điểm
                </small>
              </div>
              <div className="kv-profile-stats">
                <div>
                  <b>{profile.wins}</b>Thắng
                </div>
                <div>
                  <b>{profile.draws}</b>Hòa
                </div>
                <div>
                  <b>{profile.losses}</b>Thua
                </div>
                <div>
                  <b>{profile.elo}</b>Elo
                </div>
              </div>
            </div>
          </section>
          <p className="kv-profile-rules">
            Thắng +40 · Hòa +10 · Thua không trừ điểm cấp bậc. Mỗi bên phải đi
            ít nhất 3 nước. Elo tính riêng theo đối thủ; thua có thể giảm Elo.
            Áp dụng trận online, không cộng khi đánh máy hoặc hủy ván.
          </p>
          <div className="kv-profile-tabs" aria-label="Nội dung hồ sơ">
            <button
              aria-pressed={tab === "avatars"}
              onClick={() => setTab("avatars")}
            >
              Kho avatar · 50 mẫu + 20 độc quyền
            </button>
            <button
              aria-pressed={tab === "ranks"}
              onClick={() => setTab("ranks")}
            >
              20 cột mốc thăng hạng
            </button>
          </div>
          <p role="status" className="kv-profile-notice">
            {notice}
          </p>
          {tab === "avatars" ? (
            <section aria-label="Kho avatar">
              <div className="kv-profile-filters">
                <h2>Chọn diện mạo của bạn</h2>
                <div>
                  {(["all", "open", "exclusive"] as const).map((f, i) => (
                    <button
                      key={f}
                      aria-pressed={filter === f}
                      onClick={() => setFilter(f)}
                    >
                      {["Tất cả", "Đã mở khóa", "Độc quyền"][i]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="kv-avatar-grid">
                {catalog.avatars
                  .filter(
                    (a) =>
                      filter === "all" ||
                      (filter === "open"
                        ? a.required_tier <= profile.tier.index
                        : a.exclusive),
                  )
                  .map((a) => {
                    const locked = a.required_tier > profile.tier.index,
                      selected = a.id === profile.avatar_id;
                    return (
                      <button
                        key={a.id}
                        className={`kv-avatar-card${locked ? " locked" : ""}${selected ? " selected" : ""}`}
                        disabled={locked || !!busy}
                        aria-pressed={selected}
                        onClick={() => void equip(a)}
                        title={
                          locked
                            ? `Mở ở cấp ${catalog.tiers[a.required_tier].name}`
                            : `Trang bị ${a.name}`
                        }
                      >
                        <img
                          src={a.url}
                          alt={a.name}
                          width="160"
                          height="160"
                          loading="lazy"
                        />
                        <strong>{a.name}</strong>
                        <small>
                          {locked
                            ? `🔒 ${catalog.tiers[a.required_tier].name} · ${catalog.tiers[a.required_tier].minimum} điểm`
                            : busy === a.id
                              ? "Đang lưu…"
                              : selected
                                ? "✓ Đang sử dụng"
                                : a.exclusive
                                  ? "✦ Đã mở khóa"
                                  : "Trang bị"}
                        </small>
                      </button>
                    );
                  })}
              </div>
            </section>
          ) : (
            <section aria-label="Cột mốc cấp bậc">
              <h2>Từ Tập sự đến Kỳ thần</h2>
              <p>
                Đạt mốc là mở vĩnh viễn một avatar độc quyền. Sao tăng từ 1 đến
                5 trong mỗi nhóm; màu sắc, hoa văn và hiệu ứng viền tiếp tục
                tăng theo cấp.
              </p>
              <div className="kv-tier-grid">
                {catalog.tiers.map((t) => {
                  const unlocked = t.index <= profile.tier.index,
                    a = catalog.avatars.find(
                      (a) =>
                        a.id === `rank-${String(t.index + 1).padStart(2, "0")}`,
                    )!;
                  return (
                    <article
                      key={t.index}
                      className={`kv-tier-card${unlocked ? " unlocked" : ""}`}
                    >
                      <span className="kv-tier-number">
                        BẬC {String(t.index + 1).padStart(2, "0")}
                      </span>
                      <RankAvatar
                        profile={{
                          ...profile,
                          avatar_url: a.url,
                          tier: t,
                          points: t.minimum,
                        }}
                      />
                      <h3>{t.name}</h3>
                      <span>{"★".repeat(t.stars)}</span>
                      <b>{t.minimum.toLocaleString("vi-VN")} điểm</b>
                      <small>
                        {profile.tier.index === t.index
                          ? "● Cấp hiện tại"
                          : unlocked
                            ? "✓ Đã chinh phục"
                            : "🔒 Chưa đạt"}
                      </small>
                      <button
                        disabled={!unlocked || !!busy}
                        onClick={() => void equip(a)}
                      >
                        {profile.avatar_id === a.id
                          ? "Đang sử dụng"
                          : "Trang bị avatar"}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
