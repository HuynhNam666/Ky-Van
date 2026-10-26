"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import KvTopbar from "@/components/kv-topbar";
import "./leaderboard.css";

type Entry = {
  rank: number;
  user_id: number;
  username: string;
  avatar_url: string;
  tier: { name: string; index: number };
  points: number;
  elo: number;
};
type Board = { items: Entry[]; me: Entry | null; total: number };

const MEDAL = ["🥇", "🥈", "🥉"];
const fmt = (n: number) => n.toLocaleString("vi-VN");

function Row({ e, mine }: { e: Entry; mine: boolean }) {
  return (
    <li className={"lb-row" + (mine ? " me" : "") + (e.rank <= 3 ? ` top${e.rank}` : "")}>
      <span className="lb-rank" aria-label={`Hạng ${e.rank}`}>
        {e.rank <= 3 ? MEDAL[e.rank - 1] : e.rank}
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="lb-avatar" src={e.avatar_url} alt="" width={44} height={44} />
      <a className="lb-name" href={`/ky-thu?uid=${e.user_id}`}>
        {e.username}
        {mine && <em> · Bạn</em>}
      </a>
      <span className="lb-tier">{e.tier.name}</span>
      <span className="lb-points">
        <b>{fmt(e.points)}</b> điểm
      </span>
      <span className="lb-elo">Elo {fmt(e.elo)}</span>
    </li>
  );
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [data, setData] = useState<Board | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await api<Board>("/progression/leaderboard?limit=50"));
      setError("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace("/dang-nhap");
        return;
      }
      setError((e as Error).message || "Chưa tải được bảng xếp hạng.");
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const t = setInterval(() => {
      if (!document.hidden) void load();
    }, 30000);
    return () => clearInterval(t);
  }, [load]);

  const inTop = data?.me ? data.items.some((x) => x.user_id === data.me!.user_id) : false;

  return (
    <main className="lb-page kv-page">
      <KvTopbar title="Bảng Phong Vân" current="/bang-phong-van" />
      <section className="lb-hero">
        <h1>Bảng Phong Vân</h1>
        {data && <p>{fmt(data.total)} kỳ thủ đã có hạng</p>}
      </section>

      {error && (
        <div className="kv-notice kv-error" role="alert">
          {error} <button className="kv-btn" onClick={() => void load()}>Tải lại</button>
        </div>
      )}
      {!data && !error && <p role="status" className="lb-empty">Đang mở bảng xếp hạng…</p>}

      {data && (
        <>
          {data.me ? (
            <section className="kv-card lb-me" aria-label="Hạng của bạn">
              <h2>Hạng của bạn</h2>
              <ol className="lb-list">
                <Row e={data.me} mine />
              </ol>
              {!inTop && <p className="lb-note">Bạn đang ngoài top {data.items.length}.</p>}
            </section>
          ) : (
            <section className="kv-card lb-me">
              <h2>Hạng của bạn</h2>
              <p className="lb-empty">
                Chưa có hạng. Hoàn thành một ván online (mỗi bên đi ít nhất 3 nước) để lên bảng.{" "}
                <a className="kv-btn kv-btn-primary" href="/ghep-tran">Ghép trận</a>
              </p>
            </section>
          )}

          <section className="kv-card">
            <h2>Top kỳ thủ</h2>
            {data.items.length ? (
              <ol className="lb-list">
                {data.items.map((e) => (
                  <Row key={e.user_id} e={e} mine={e.user_id === data.me?.user_id} />
                ))}
              </ol>
            ) : (
              <p className="lb-empty">Chưa có kỳ thủ nào có hạng. Hãy là người đầu tiên.</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
