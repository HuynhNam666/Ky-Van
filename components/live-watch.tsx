"use client";
// KYVIEN_JOURNEY_V1

import { useEffect, useState, type CSSProperties } from "react";
import KvTopbar from "@/components/kv-topbar";
import { go } from "@/lib/go";
import { API, api, type Room } from "@/lib/api";
import {
  RankAvatar,
  RankLabel,
  type RankProfile,
} from "@/components/rank-profile";
import { coupNames } from "@/lib/coup-client";
import "./live-watch.css";

type Game = {
  code: string;
  name: string;
  red_name: string;
  black_name: string;
  red_profile?: RankProfile;
  black_profile?: RankProfile;
  variant: "xiangqi" | "coup";
  source: "random" | "private";
  viewers: number;
  move_count: number;
  status: string;
  winner?: string | null;
  turn: string;
  server_time: number;
  clock?: Room["clock"];
  coins?: Room["coins"];
  board?: Room["board"];
  history?: Room["history"];
};
const variantName = (g: Game) => (g.variant === "coup" ? "Cờ úp" : "Cờ tướng");
const sourceName = (g: Game) =>
  g.source === "random" ? "Ghép ngẫu nhiên" : "Phòng riêng";
function Player({
  name,
  profile,
  side,
}: {
  name: string;
  profile?: RankProfile;
  side: string;
}) {
  return (
    <div className={`lw-player lw-${side}`}>
      <div
        className="lw-avatar"
        role={profile ? "link" : undefined}
        tabIndex={profile ? 0 : undefined}
        aria-label="Xem hồ sơ kỳ thủ"
        onClick={() => {
          if (profile) go("/ky-thu?uid=" + profile.user_id);
        }}
        onKeyDown={(e) => {
          if (profile && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            go("/ky-thu?uid=" + profile.user_id);
          }
        }}
      >
        {profile ? (
          <RankAvatar profile={profile} />
        ) : (
          <span>{name.slice(0, 1).toUpperCase()}</span>
        )}
      </div>
      <div className="lw-player-name">
        <strong title={name}>{name}</strong>
        {profile ? <RankLabel profile={profile} /> : <small>Kỳ thủ</small>}
      </div>
    </div>
  );
}
function Board({ game, flipped }: { game: Game; flipped: boolean }) {
  const last = game.history?.at(-1);
  return (
    <svg
      className="lw-board"
      viewBox="0 0 900 1000"
      role="img"
      aria-label={`Bàn ${variantName(game)}, lượt ${game.turn === "r" ? "Đỏ" : "Đen"}`}
    >
      <defs>
        <linearGradient id="lw-wood" x2="1" y2="1">
          <stop stopColor="#edcf91" />
          <stop offset=".5" stopColor="#d9ab65" />
          <stop offset="1" stopColor="#eccd8b" />
        </linearGradient>
        <radialGradient id="lw-stone">
          <stop stopColor="#fff0c4" />
          <stop offset=".83" stopColor="#e4bd79" />
          <stop offset="1" stopColor="#a9793e" />
        </radialGradient>
      </defs>
      <rect width="900" height="1000" rx="22" fill="url(#lw-wood)" />
      <g stroke="#704b27" strokeWidth="2" fill="none">
        {Array.from({ length: 10 }, (_, i) => (
          <path key={`h${i}`} d={`M50 ${50 + i * 100}H850`} />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <path
            key={`v${i}`}
            d={
              i === 0 || i === 8
                ? `M${50 + i * 100} 50V950`
                : `M${50 + i * 100} 50V450 M${50 + i * 100} 550V950`
            }
          />
        ))}
        <path d="M350 50L550 250M550 50L350 250M350 750L550 950M550 750L350 950" />
        <rect x="40" y="40" width="820" height="920" strokeWidth="4" />
      </g>
      <text
        x="450"
        y="513"
        textAnchor="middle"
        fill="#795634"
        fontFamily="serif"
        fontSize="30"
        letterSpacing="13"
      >
        SỞ HÀ • HÁN GIỚI
      </text>
      {game.board?.map((p, i) => {
        const n = flipped ? 89 - i : i,
          x = 50 + (n % 9) * 100,
          y = 50 + Math.floor(n / 9) * 100;
        const mark = last && (last.from === i || last.to === i);
        return (
          <g key={i}>
            {mark && (
              <circle
                cx={x}
                cy={y}
                r="47"
                fill="#5a763655"
                stroke="#3c642f"
                strokeWidth="4"
              />
            )}
            {p && (
              <g>
                <title>
                  {p[1] === "U" ? "Quân úp chưa lật" : coupNames[p]}
                </title>
                <circle cx={x + 2} cy={y + 5} r="39" fill="#50351655" />
                <circle
                  cx={x}
                  cy={y}
                  r="39"
                  fill={p[1] === "U" ? "#87603b" : "url(#lw-stone)"}
                  stroke="#70471e"
                  strokeWidth="3"
                />
                <circle
                  cx={x}
                  cy={y}
                  r="31"
                  fill="none"
                  stroke={
                    p[1] === "U"
                      ? "#cba572"
                      : p[0] === "r"
                        ? "#a72e22"
                        : "#343629"
                  }
                  strokeWidth="1.5"
                  strokeDasharray={p[1] === "U" ? "4 5" : undefined}
                />
                <text
                  x={x}
                  y={y + 16}
                  textAnchor="middle"
                  fontSize={p[1] === "U" ? "35" : "49"}
                  fontFamily="serif"
                  fontWeight="bold"
                  fill={
                    p[1] === "U"
                      ? "#efd6a4"
                      : p[0] === "r"
                        ? "#a72e22"
                        : "#343629"
                  }
                >
                  {p[1] === "U" ? "✦" : coupNames[p]}
                </text>
                {p[1] === "U" && (
                  <circle
                    cx={x}
                    cy={y + 28}
                    r="4"
                    fill={p[0] === "r" ? "#de6b4b" : "#202f27"}
                  />
                )}
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
function Clock({
  game,
  side,
  now,
}: {
  game: Game;
  side: "r" | "b";
  now: number;
}) {
  const c = game.clock;
  if (!c) return null;
  const elapsed =
    game.status === "playing" && game.turn === side && c.turn_started
      ? Math.max(0, now - c.turn_started)
      : 0;
  const left = Math.max(
    0,
    (side === "r" ? c.red_remaining : c.black_remaining) - elapsed,
  );
  const turnLeft = Math.max(0, c.move_seconds - elapsed);
  return (
    <div className={`lw-clock ${game.turn === side ? "active" : ""}`}>
      <span>{side === "r" ? "Đỏ" : "Đen"}</span>
      <b>
        {Math.floor(left / 60)
          .toString()
          .padStart(2, "0")}
        :
        {Math.floor(left % 60)
          .toString()
          .padStart(2, "0")}
      </b>
      {game.turn === side && game.status === "playing" && (
        <small>Lượt: {Math.ceil(turnLeft)}s</small>
      )}
    </div>
  );
}
export default function LiveWatch() {
  const [rooms, setRooms] = useState<Game[]>([]),
    [loading, setLoading] = useState(true),
    [listError, setListError] = useState("");
  const [code, setCode] = useState<string | null>(null),
    [game, setGame] = useState<Game | null>(null),
    [gameError, setGameError] = useState("");
  const [variant, setVariant] = useState("all"),
    [source, setSource] = useState("all"),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("viewers"),
    [flipped, setFlipped] = useState(false);
  const [now, setNow] = useState(Date.now() / 1000),
    [offset, setOffset] = useState(0),
    [motion, setMotion] = useState(true);
  useEffect(() => {
    const sync = () =>
      setCode(new URLSearchParams(location.search).get("room"));
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  function open(next: string | null) {
    setGame(null);
    setGameError("");
    setCode(next);
    history.pushState(
      null,
      "",
      next ? "/xem-co?room=" + encodeURIComponent(next) : "/xem-co",
    );
    window.scrollTo({ top: 0 });
  }
  useEffect(() => {
    let alive = true,
      busy = false;
    async function refresh() {
      if (document.hidden || busy) return;
      busy = true;
      try {
        const d = await api<{ rooms: Game[] }>("/spectate/rooms");
        if (alive) {
          setRooms(d.rooms);
          setListError("");
        }
      } catch (e) {
        if (alive) setListError((e as Error).message);
      } finally {
        busy = false;
        if (alive) setLoading(false);
      }
    }
    void refresh();
    const timer = setInterval(refresh, 5000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  useEffect(() => {
    if (!code) return;
    let alive = true,
      busy = false;
    const viewer = crypto.randomUUID();
    const path = "/spectate/rooms/" + encodeURIComponent(code) + "/view";
    const leave = () => {
      void fetch(API + path, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({ viewer }),
        keepalive: true,
      }).catch(() => {});
    };
    async function refresh() {
      if (!alive || document.hidden || busy) return;
      busy = true;
      try {
        const d = await api<Game>(path, "POST", { viewer });
        if (alive && !document.hidden) {
          setGame(d);
          setOffset(d.server_time - Date.now() / 1000);
          setGameError("");
        } else leave();
      } catch (e) {
        if (alive) setGameError((e as Error).message);
      } finally {
        busy = false;
      }
    }
    const visible = () => {
      if (document.hidden) leave();
      else void refresh();
    };
    void refresh();
    const timer = setInterval(refresh, 2000);
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", visible);
      leave();
    };
  }, [code]);
  useEffect(() => {
    if (!code) return;
    const t = setInterval(() => setNow(Date.now() / 1000), 250);
    return () => clearInterval(t);
  }, [code]);
  const filtered = rooms
    .filter(
      (r) =>
        (variant === "all" || r.variant === variant) &&
        (source === "all" || r.source === source) &&
        `${r.red_name} ${r.black_name} ${r.code} ${r.name}`
          .toLocaleLowerCase("vi")
          .includes(search.toLocaleLowerCase("vi")),
    )
    .sort((a, b) =>
      sort === "moves" ? b.move_count - a.move_count : b.viewers - a.viewers,
    );
  return (
    <main className={`kv-page lw-page ${motion ? "" : "lw-still"}`}>
      <div className="lw-leaves" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <i key={i} style={{ "--i": i } as CSSProperties} />
        ))}
      </div>
      <div className="lw-wrap">
        <KvTopbar title="Khán đài trực tuyến" current="/xem-co" />
        <div className="lw-tools">
          <button onClick={() => setMotion(!motion)} aria-pressed={motion}>
            {motion ? "Tắt" : "Bật"} lá bay
          </button>
        </div>
        {code ? (
          <>
            <button className="lw-back" onClick={() => open(null)}>
              ← Tất cả ván đang đấu
            </button>
            {gameError && (
              <p className="lw-error" role="alert">
                {gameError} — Đang thử kết nối lại; bàn cờ có thể chưa cập nhật.
              </p>
            )}
            {!game ? (
              <div className="lw-empty" role="status">
                {gameError ? "Chưa tải được ván cờ." : "Đang mở bàn cờ…"}
              </div>
            ) : (
              <>
                <div className="lw-watch-title">
                  <div>
                    <small>THƯỞNG CỜ · #{game.code}</small>
                    <h1>{variantName(game)} tại Trúc Hiên</h1>
                  </div>
                  <span className="lw-eye">◉ {game.viewers} đang xem</span>
                </div>
                <div className="lw-view-layout">
                  <section className="lw-table">
                    <div className="lw-table-players">
                      <Player
                        name={flipped ? game.red_name : game.black_name}
                        profile={
                          flipped ? game.red_profile : game.black_profile
                        }
                        side={flipped ? "red" : "black"}
                      />
                      <Clock
                        game={game}
                        side={flipped ? "r" : "b"}
                        now={now + offset}
                      />
                    </div>
                    <Board game={game} flipped={flipped} />
                    <div className="lw-table-players">
                      <Player
                        name={flipped ? game.black_name : game.red_name}
                        profile={
                          flipped ? game.black_profile : game.red_profile
                        }
                        side={flipped ? "black" : "red"}
                      />
                      <Clock
                        game={game}
                        side={flipped ? "b" : "r"}
                        now={now + offset}
                      />
                    </div>
                  </section>
                  <aside className="lw-info">
                    <span className="lw-tag">{sourceName(game)}</span>
                    <h2>{game.name}</h2>
                    <p role="status">
                      {game.status === "playing"
                        ? `Đang đấu · Lượt quân ${game.turn === "r" ? "Đỏ" : "Đen"}`
                        : game.status === "draw"
                          ? "Ván đấu đã hòa"
                          : game.status === "cancelled"
                            ? "Ván đấu đã hủy"
                            : `Ván đấu kết thúc${game.winner ? ` · Quân ${game.winner === "r" ? "Đỏ" : "Đen"} thắng` : ""}`}
                    </p>
                    <dl>
                      <div>
                        <dt>Số nước đã đi</dt>
                        <dd>{game.move_count}</dd>
                      </div>
                      <div>
                        <dt>Xu mỗi người</dt>
                        <dd>
                          {game.coins?.stake?.toLocaleString("vi-VN") ?? "—"}
                        </dd>
                      </div>
                    </dl>
                    <button onClick={() => setFlipped(!flipped)}>
                      ⇄ Đảo chiều bàn cờ
                    </button>
                    <h3>Nước đi gần đây</h3>
                    <ol className="lw-moves">
                      {game.history?.slice(-12).map((m, i) => (
                        <li key={game.move_count - 12 + i}>
                          <span>
                            {Math.max(0, game.move_count - 12) + i + 1}.
                          </span>{" "}
                          {String.fromCharCode(97 + (m.from % 9))}
                          {10 - Math.floor(m.from / 9)} →{" "}
                          {String.fromCharCode(97 + (m.to % 9))}
                          {10 - Math.floor(m.to / 9)}{" "}
                          <b>
                            {m.piece[1] === "U"
                              ? "Lật quân"
                              : coupNames[m.piece]}
                          </b>
                        </li>
                      ))}
                    </ol>
                  </aside>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <section className="lw-hero">
              
              <h1>
                Ngồi dưới hiên trúc,
                <br />
                <em>thưởng một ván cờ.</em>
              </h1>
              <div className="lw-stats">
                <span>
                  <b>{rooms.length}</b> bàn đang đấu
                </span>
                <span>
                  <b>{rooms.reduce((n, r) => n + r.viewers, 0)}</b> lượt xem
                  trực tiếp
                </span>
                <span className="lw-live">● Cập nhật mỗi 5 giây</span>
              </div>
              <div className="lw-seal" aria-hidden="true">
                觀<br />棋
              </div>
            </section>
            <section className="lw-hall">
              <div className="lw-hall-heading">
                <div>
                  
                  <h2>Những ván cờ đang đấu</h2>
                </div>
                <span>{filtered.length} bàn</span>
              </div>
              <div className="lw-filters">
                <div className="lw-tabs" aria-label="Loại cờ">
                  {[
                    ["all", "Tất cả"],
                    ["xiangqi", "Cờ tướng"],
                    ["coup", "Cờ úp"],
                  ].map(([v, label]) => (
                    <button
                      key={v}
                      aria-pressed={variant === v}
                      onClick={() => setVariant(v)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="lw-search">
                  <span className="lw-sr">Tìm người chơi hoặc mã phòng</span>
                  <input
                    placeholder="Tìm kỳ thủ, mã phòng…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Nguồn trận"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                >
                  <option value="all">Mọi loại phòng</option>
                  <option value="random">Ghép ngẫu nhiên</option>
                  <option value="private">Phòng riêng</option>
                </select>
                <select
                  aria-label="Sắp xếp"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="viewers">Nhiều người xem</option>
                  <option value="moves">Nhiều nước đi</option>
                </select>
              </div>
              {listError && (
                <p className="lw-error" role="alert">
                  {listError} — Danh sách có thể chưa cập nhật.
                </p>
              )}
              {loading ? (
                <div className="lw-empty" role="status">
                  Đang tìm các bàn cờ đang đấu…
                </div>
              ) : !filtered.length ? (
                <div className="lw-empty">
                  <span>♟</span>
                  <h3>
                    {rooms.length
                      ? "Chưa có bàn phù hợp bộ lọc"
                      : "Hiên trúc đang chờ ván mới"}
                  </h3>
                  <p>
                    {rooms.length
                      ? "Thử đổi bộ lọc hoặc tên tìm kiếm."
                      : "Khi hai kỳ thủ bắt đầu thi đấu, bàn cờ sẽ tự xuất hiện tại đây."}
                  </p>
                  <a href="/phong">Tạo một ván giao hữu →</a>
                </div>
              ) : (
                <div className="lw-cards">
                  {filtered.map((r) => (
                    <article className="lw-card" key={r.code}>
                      <div className="lw-card-top">
                        <span
                          className={`lw-tag ${r.variant === "coup" ? "coup" : ""}`}
                        >
                          {variantName(r)}
                        </span>
                        <small>
                          {sourceName(r)} · #{r.code}
                        </small>
                        <span className="lw-live">● Đang đấu</span>
                      </div>
                      <div className="lw-duel">
                        <Player
                          name={r.red_name}
                          profile={r.red_profile}
                          side="red"
                        />
                        <div className="lw-versus">
                          <span>{r.variant === "coup" ? "暗" : "棋"}</span>
                          <small>ĐỎ · ĐEN</small>
                        </div>
                        <Player
                          name={r.black_name}
                          profile={r.black_profile}
                          side="black"
                        />
                      </div>
                      <footer>
                        <span>
                          ◉ {r.viewers} đang xem{" "}
                          <small>· {r.move_count} nước</small>
                        </span>
                        <button
                          onClick={() => open(r.code)}
                          aria-label={`Xem ${r.red_name} đấu với ${r.black_name}`}
                        >
                          Thưởng cờ <span>→</span>
                        </button>
                      </footer>
                    </article>
                  ))}
                </div>
              )}
            </section>
            
          </>
        )}
      </div>
    </main>
  );
}
