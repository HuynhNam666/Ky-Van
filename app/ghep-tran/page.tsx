"use client";
// KYVIEN_YOUTUBE_V1
import { useYouTubeMusic } from "@/hooks/use-youtube-music";
// KYVIEN_JOURNEY_V1
import ClassicResult from "@/components/classic-result";

// KYVIEN_COUP_V1
import CoupRulesPanel from "@/components/coup-rules-panel";
import {
  coupArenaApi,
  useCoupMode,
  coupNames,
  coupVn,
} from "@/lib/coup-client";
import { coupLegal, coupCheck, coupWouldExpose } from "@/lib/coup-rules";
import {
  legal as standardLegal,
  check as standardCheck,
  wouldExposeKing as standardExpose,
} from "@/lib/chess";
import { useCoupAwareFeedback } from "@/hooks/use-coup-feedback";

// KYVIEN_RANK_V1

import {
  RankAvatar,
  RankLabel,
  RankMatchResult,
  type RankProfile,
  type RankedRoom,
} from "@/components/rank-profile";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Flag,
  Handshake,
  LogOut,
  Menu,
  MessageCircle,
  Mic,
  MicOff,
  MoreHorizontal,
  Music,
  PhoneOff,
  Send,
  ShieldAlert,
  Smile,
  Swords,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";

import { Toaster } from "sonner";

// --- CODE CU GIU NGUYEN DE DOI CHIEU; KHONG THUC THI ---
// ORIGINAL | import { api, ApiError, type Chat, type Room, type User } from "@/lib/api";
// --- PHAN CAP NHAT DANG SU DUNG ---
import {
  api,
  ApiError,
  sessionToken,
  type Chat,
  type Room,
  type User,
} from "@/lib/api";

import {
  initial,
  legal,
  names,
  vn,
  check,
  wouldExposeKing,
  type Side,
} from "@/lib/chess";

import { useRoomSocket } from "@/hooks/use-room-socket";

import { useCall } from "@/hooks/use-call";

import { useGamePreferences } from "@/hooks/use-game-preferences";

import { useChessFeedback } from "@/hooks/use-chess-feedback";

import { useArenaMusic } from "@/hooks/use-arena-music";

import GameResult from "@/components/game-result";

import "./arena.css";

type Match = { status: "searching" | "matched" | "idle"; room?: Room };

const EMOJIS = ["👍", "👏", "😄", "😮", "🤔", "😅", "😢", "🤝", "🔥", "❤️"];

const EMPTY = initial();

function formatClock(seconds: number) {
  const whole = Math.max(0, Math.ceil(seconds));

  return `${Math.floor(whole / 60)

    .toString()

    .padStart(2, "0")}:${(whole % 60).toString().padStart(2, "0")}`;
}

function ClockAvatar({
  profile,

  letter,

  running,

  remaining,

  limit,
}: {
  profile?: RankProfile | null;

  letter: string;

  running: boolean;

  remaining: number;

  limit: number;
}) {
  const urgent = running && remaining <= 10;

  const progress = Math.max(0, Math.min(1, remaining / Math.max(1, limit)));

  return (
    <div
      className={`arena-clock-avatar ${running ? "running" : ""} ${urgent ? "urgent" : ""}`}
    >
      <div className="arena-avatar">
        {letter}

        <a
          className="j-profile-hit"
          href={profile ? "/ky-thu?uid=" + profile.user_id : "/ky-thu"}
          aria-label="Xem hồ sơ kỳ thủ"
        >
          <RankAvatar profile={profile} overlay />
        </a>
      </div>

      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle className="clock-track" cx="32" cy="32" r="29" />

        <circle
          className="clock-progress"
          cx="32"
          cy="32"
          r="29"
          pathLength="100"
          strokeDasharray="100"
          strokeDashoffset={100 * (1 - (running ? progress : 0))}
        />
      </svg>

      {running && (
        <span
          className="arena-move-count"
          role="timer"
          aria-label="Thời gian còn lại của lượt"
        >
          {Math.max(0, Math.ceil(remaining))}s
        </span>
      )}
    </div>
  );
}

export default function Arena() {
  const useArenaMusic = useYouTubeMusic;

  const GameResult = ClassicResult;

  const api = coupArenaApi;
  const names = coupNames;
  const vn = coupVn;
  const useChessFeedback = useCoupAwareFeedback;

  // BỔ SUNG: trạng thái và xử lý yêu cầu kết bạn trong trận.

  const [friendStatus, setFriendStatus] = useState<"friend" | "sent" | "none">(
    "none",
  );

  const [friendNotice, setFriendNotice] = useState<{
    username: string;

    request_id: number;
  } | null>(null);

  useEffect(() => {
    if (!friendNotice) return;

    const timer = setTimeout(() => setFriendNotice(null), 10000);

    return () => clearTimeout(timer);
  }, [friendNotice]);

  async function decideFriend(action: "accept" | "reject") {
    if (!friendNotice) return;

    try {
      await api("/friends/requests/" + action, "POST", {
        request_id: friendNotice.request_id,
      });

      setFriendNotice(null);

      if (action === "accept") setFriendStatus("friend");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false);

  const [room, setRoom] = useState<Room | null>(null),
    [searching, setSearching] = useState(false),
    [error, setError] = useState("");

  const [selected, setSelected] = useState<number | null>(null),
    [pending, setPending] = useState(false),
    [sound, setSound] = useState(true),
    [menu, setMenu] = useState(false),
    [emotes, setEmotes] = useState(false);

  const [messages, setMessages] = useState<Chat[]>([]),
    [text, setText] = useState(""),
    [online, setOnline] = useState<number[]>([]),
    [reaction, setReaction] = useState<{
      user_id: number;

      emoji: string;
    } | null>(null);

  const [confirm, setConfirm] = useState<"leave" | "resign" | null>(null),
    [now, setNow] = useState(0);

  const leaving = useRef(false);

  const clockOffset = useRef(0),
    chatEnd = useRef<HTMLDivElement>(null),
    request = useRef<Promise<void> | null>(null),
    roomRef = useRef<Room | null>(null);

  const socket = useRoomSocket(room?.code, user?.id);
  const isCoup = useCoupMode(room);
  const legal = isCoup ? coupLegal : standardLegal;
  const check = isCoup ? coupCheck : standardCheck;
  const wouldExposeKing = isCoup ? coupWouldExpose : standardExpose;

  const side: Side = room?.red_id === user?.id ? "r" : "b";

  const opponentId = side === "r" ? room?.black_id : room?.red_id;

  const opponent = side === "r" ? room?.black_name : room?.red_name;

  const active = room?.status === "playing",
    ended = room?.status === "finished" || room?.status === "draw";

  const call = useCall(
    socket.send,

    socket.on,

    !!opponentId && online.includes(opponentId) && socket.connected && !ended,
  );

  // BỔ SUNG: tìm trạng thái bạn bè, cập nhật mỗi 10 giây.

  useEffect(() => {
    if (!opponentId || !opponent) {
      setFriendStatus("none");

      return;
    }

    let live = true;

    const refresh = () =>
      void api<
        Array<{
          id: number;

          username: string;

          status: "friend" | "sent" | "received" | "none";
        }>
      >("/friends/search?q=" + encodeURIComponent(opponent))
        .then((rows) => {
          if (!live) return;

          const status = rows.find((x) => x.id === opponentId)?.status;

          setFriendStatus(
            status === "friend"
              ? "friend"
              : status === "sent"
                ? "sent"
                : "none",
          );
        })

        .catch(() => {});

    refresh();

    const timer = setInterval(refresh, 10000);

    return () => {
      live = false;

      clearInterval(timer);
    };
  }, [opponentId, opponent]);

  async function addOpponentFriend() {
    if (!opponent) return;

    try {
      const result = await api<{ status: "friend" | "sent" }>(
        "/friends/requests",

        "POST",

        { username: opponent },
      );

      setFriendStatus(result.status);

      setError(
        result.status === "friend"
          ? "Hai bạn đã kết bạn."
          : "Đã gửi yêu cầu kết bạn cho " + opponent + ".",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useGamePreferences(setSound);

  const music = useArenaMusic();

  const { feedback, warnExposedKing } = useChessFeedback(
    room?.board ?? EMPTY,

    room?.turn ?? "r",

    room?.history ?? [],

    sound,

    room?.code ?? "queue",
    isCoup,
  );

  const receive = useCallback((next: Room) => {
    if (
      roomRef.current &&
      roomRef.current.code === next.code &&
      next.version < roomRef.current.version
    )
      return;

    if (next.server_time)
      clockOffset.current = next.server_time * 1000 - Date.now();

    if (
      leaving.current &&
      (next.status === "finished" ||
        next.status === "draw" ||
        next.status === "cancelled")
    ) {
      location.assign("/");

      return;
    }

    roomRef.current = next;

    setRoom(next);

    setSearching(false);

    setPending(false);

    setSelected(null);

    setNow(Date.now());
  }, []);

  const findMatch = useCallback(() => {
    if (request.current) return request.current;

    // BỔ SUNG: có mã phòng thì tải phòng riêng; giữ nguyên nhánh ghép ngẫu nhiên bên dưới.

    const privateCode = new URLSearchParams(location.search).get("room");

    if (privateCode) {
      setError("");

      setSearching(false);

      const privateTask = api<Room>("/rooms/" + encodeURIComponent(privateCode))
        .then(receive)

        .catch((e) => {
          setError(e.message);
        })

        .finally(() => {
          request.current = null;
        });

      request.current = privateTask;

      return privateTask;
    }

    setError("");

    roomRef.current = null;
    setRoom(null);
    setSearching(true);

    const task = api<Match>("/matchmaking/join", "POST")
      .then((m) => {
        if (m.room) receive(m.room);
      })

      .catch((e) => {
        // ORIGINAL | setSearching(false);
        // A failed response can still belong to a committed match. Read status;
        // never repeat the POST automatically or abandon the other player.
        const transient =
          e instanceof ApiError && (e.status === 0 || e.status >= 500);
        setSearching(transient);

        setError(e.message);
      })

      .finally(() => {
        request.current = null;
      });

    request.current = task;

    return task;
  }, [receive]);

  useEffect(() => {
    let live = true;
    // --- CODE CU GIU NGUYEN DE DOI CHIEU; KHONG THUC THI ---
    // ORIGINAL |
    // ORIGINAL |     api<User>("/auth/me")
    // ORIGINAL |       .then((u) => {
    // ORIGINAL |         if (live) setUser(u);
    // ORIGINAL |       })
    // ORIGINAL |
    // ORIGINAL |       .catch((e) => {
    // --- PHAN CAP NHAT DANG SU DUNG ---
    let retry: ReturnType<typeof setTimeout> | undefined;
    const loadAccount = async () => {
      if (!sessionToken()) {
        if (live) setLoading(false);
        return;
      }
      try {
        const u = await api<User>("/auth/me");
        if (live) {
          setUser(u);
          setLoading(false);
          setError("");
        }
      } catch (e) {
        if (!live) return;
        // --- CODE CU GIU NGUYEN DE DOI CHIEU; KHONG THUC THI ---
        // ORIGINAL |
        // --- PHAN CAP NHAT DANG SU DUNG ---
        if (e instanceof ApiError && e.status === 401) {
          // --- CODE CU GIU NGUYEN DE DOI CHIEU; KHONG THUC THI ---
          // ORIGINAL |           location.replace("/dang-nhap");
          // ORIGINAL |
          // ORIGINAL |           return;
          // --- PHAN CAP NHAT DANG SU DUNG ---
          location.replace("/dang-nhap");
          return;
        }
        // --- CODE CU GIU NGUYEN DE DOI CHIEU; KHONG THUC THI ---
        // ORIGINAL |
        // ORIGINAL |         setError(e.message);
        // ORIGINAL |       })
        // ORIGINAL |
        // ORIGINAL |       .finally(() => {
        // ORIGINAL |         if (live) setLoading(false);
        // ORIGINAL |       });
        // ORIGINAL |
        // ORIGINAL |     return () => {
        // ORIGINAL |       live = false;
        // --- PHAN CAP NHAT DANG SU DUNG ---
        setError(e instanceof Error ? e.message : "Đang kết nối lại máy chủ…");
        // Keep the loading state instead of showing a false signed-out screen.
        retry = setTimeout(() => void loadAccount(), 5000);
      }
    };
    void loadAccount();
    return () => {
      live = false;
      clearTimeout(retry);
    };
  }, []);

  useEffect(() => {
    if (user) void findMatch();
  }, [user, findMatch]);

  useEffect(() => {
    if (!searching || room) return;

    let live = true,
      inFlight = false;

    const t = setInterval(async () => {
      // ORIGINAL | if (inFlight) return;
      if (inFlight || request.current) return;

      inFlight = true;

      try {
        const m = await api<Match>("/matchmaking/status");

        if (!live) return;

        if (m.room) receive(m.room);
        else if (m.status === "idle") {
          setSearching(false);

          setError("Phiên tìm trận đã hết hạn. Bấm Tìm lại để tiếp tục.");
        }
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        inFlight = false;
      }
    }, 2000);

    return () => {
      live = false;

      clearInterval(t);
    };
  }, [searching, room, receive]);

  useEffect(() => {
    const off = [
      socket.on("state", receive),

      socket.on("messages", setMessages),

      socket.on("chat", (m) => setMessages((a) => [...a.slice(-199), m])),

      socket.on("presence", setOnline),

      socket.on("reaction", setReaction),

      socket.on("friend_request", ({ username, request_id, status }) => {
        if (status === "friend") setFriendStatus("friend");
        else if (request_id) setFriendNotice({ username, request_id });
      }),

      socket.on("error", (e) => {
        setError(e);

        setPending(false);
      }),

      socket.on("auth", () => {
        setError("Phiên đăng nhập đã hết hạn. Hãy tải lại trang để đăng nhập.");

        setSearching(false);
      }),
    ];

    return () => off.forEach((f) => f());
  }, [socket.on, receive]);

  useEffect(() => {
    if (!room?.code || ended || room.status === "cancelled" || socket.replaced)
      return;

    let live = true;

    const t = setInterval(() => {
      void api<Room>("/rooms/" + room.code)
        .then((r) => {
          if (live && r.version !== (roomRef.current?.version ?? -1))
            receive(r);
        })

        .catch(() => {});
    }, 2500);

    return () => {
      live = false;

      clearInterval(t);
    };
  }, [room?.code, room?.status, ended, socket.replaced, receive]);

  useEffect(() => {
    if (room?.status !== "ready" && room?.status !== "playing") return;

    const t = setInterval(() => setNow(Date.now()), 100);

    return () => clearInterval(t);
  }, [room?.status]);

  useEffect(() => {
    if (!reaction) return;

    const t = setTimeout(() => setReaction(null), 3000);

    return () => clearTimeout(t);
  }, [reaction]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (ended || room?.status === "cancelled" || socket.replaced)
      call.stop(false);
  }, [ended, room?.status, socket.replaced, call.stop]);

  useEffect(() => {
    if (room?.status !== "cancelled") return;

    const t = setTimeout(() => location.assign("/"), 2500);

    return () => clearTimeout(t);
  }, [room?.status]);

  useEffect(() => {
    if (!pending) return;

    const t = setTimeout(() => {
      setPending(false);

      setError("Chưa nhận được xác nhận. Kiểm tra kết nối rồi thử lại.");
    }, 5000);

    return () => clearTimeout(t);
  }, [pending]);

  async function authenticate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setBusy(true);

    setError("");

    const form = new FormData(e.currentTarget);

    try {
      const u = await api<User>(
        register ? "/auth/register" : "/auth/login",

        "POST",

        { username: form.get("username"), password: form.get("password") },
      );

      setUser(u);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function send(data: unknown) {
    setError("");

    if (!socket.send(data)) {
      setError("Mất kết nối. Vui lòng chờ kết nối lại.");

      return false;
    }

    return true;
  }

  async function leaveQueue() {
    setBusy(true);

    await request.current;

    try {
      await api("/matchmaking/queue", "DELETE");

      location.assign("/");
    } catch (e) {
      setError((e as Error).message);

      const m = await api<Match>("/matchmaking/status").catch(() => null);

      if (m?.room) receive(m.room);
    } finally {
      setBusy(false);
    }
  }

  function square(index: number) {
    if (
      !room ||
      !active ||
      room.turn !== side ||
      pending ||
      !socket.connected ||
      socket.replaced
    )
      return;

    const p = room.board[index];

    if (p?.[0] === side) {
      setSelected(selected === index ? null : index);

      return;
    }

    if (selected === null) return;

    if (legal(room.board, selected, index)) {
      if (
        send({ type: "move", from: selected, to: index, version: room.version })
      )
        setPending(true);
    } else if (wouldExposeKing(room.board, selected, index))
      warnExposedKing(selected);
    else setError("Quân này không thể đi đến ô đã chọn.");
  }

  const targets = useMemo(
    () =>
      room && selected !== null
        ? Array.from({ length: 90 }, (_, i) => legal(room.board, selected, i))
        : [],

    [room, selected],
  );

  const last = room?.history.at(-1),
    king =
      room && check(room.board, room.turn)
        ? room.board.indexOf(room.turn + "K")
        : -1;

  const seconds = Math.max(
    0,

    Math.ceil(
      ((room?.ready_deadline ?? 0) * 1000 - now - clockOffset.current) / 1000,
    ),
  );

  const clock = room?.clock;

  const elapsed =
    active && clock?.turn_started != null
      ? Math.max(0, (now + clockOffset.current) / 1000 - clock.turn_started)
      : 0;

  const bankFor = (playerSide: Side) => {
    if (!clock) return 0;

    const bank =
      playerSide === "r" ? clock.red_remaining : clock.black_remaining;

    return Math.max(
      0,

      bank -
        (active && room?.turn === playerSide
          ? Math.min(elapsed, clock.move_seconds)
          : 0),
    );
  };

  const moveLeft = clock
    ? Math.max(
        0,

        Math.min(clock.move_seconds - elapsed, bankFor(room?.turn ?? "r")),
      )
    : 0;

  const otherSide: Side = side === "r" ? "b" : "r";

  const capturedBy = (playerSide: Side) =>
    (room?.history ?? []).filter(
      (m) => m.piece[0] === playerSide && m.captured,
    );

  const myReady = side === "r" ? room?.red_ready : room?.black_ready,
    otherReady = side === "r" ? room?.black_ready : room?.red_ready;

  function exportGame() {
    if (!room) return;

    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              variant: isCoup ? "coup" : "xiangqi",
              board: room.board,
              turn: room.turn,
              history: room.history,
            },

            null,

            2,
          ),
        ],

        { type: "application/json" },
      ),
    );

    const a = document.createElement("a");

    a.href = url;

    a.download = `ky-van-${room.code}.json`;

    a.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const result =
    room?.status === "draw"
      ? "Hai kỳ thủ đồng ý hòa hoặc thế cờ lặp lại ba lần."
      : `${room?.winner === "r" ? "Đỏ" : "Đen"} thắng. ${clock?.finish_reason === "total_timeout" ? "Đối phương đã hết tổng thời gian." : clock?.finish_reason === "move_timeout" ? "Đối phương đã hết thời gian của lượt đi." : "Ván cờ đã kết thúc."}`;

  return (
    <div className="kv-arena">
      <Toaster richColors position="top-center" />

      <header className="arena-header">
        <a
          href="/"
          onClick={(e) => {
            if (searching || (room && !ended)) {
              e.preventDefault();

              room ? setConfirm("leave") : void leaveQueue();
            }
          }}
        >
          <ArrowLeft size={17} /> Trang chủ
        </a>

        <div className="arena-brand">
          弈{" "}
          <span>
            KỲ VÂN CÁC<small>GẶP TRI KỶ · ĐẤU TRÍ CỜ</small>
          </span>
        </div>

        <span className="arena-header-right">
          {isCoup && "CỜ ÚP · "}

          {room ? "# " + room.code : "KỲ ĐÀI TRỰC TUYẾN"}
        </span>
      </header>

      {friendNotice && (
        <div className="arena-error" role="status">
          {friendNotice.username} muốn kết bạn với bạn.
          <button onClick={() => void decideFriend("accept")}>Chấp nhận</button>
          <button onClick={() => void decideFriend("reject")}>Từ chối</button>
          <button onClick={() => setFriendNotice(null)}>Để sau</button>
        </div>
      )}

      {error && (
        <div className="arena-error" role="alert">
          {error}

          <button onClick={() => setError("")} aria-label="Đóng thông báo">
            <X size={17} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="arena-wait">
          <div className="arena-seal">弈</div>

          <p>Đang mở kỳ đài…</p>
        </div>
      ) : !user ? (
        <section className="arena-login">
          <span className="arena-kicker">CHÀO MỪNG ĐẾN KỲ ĐÀI</span>

          <h1>{register ? "Tạo danh tính kỳ thủ" : "Hẹn một ván cờ hay"}</h1>

          <p>Đăng nhập để ghép trận với người chơi đang tìm đối thủ.</p>

          <form onSubmit={authenticate}>
            <label>
              Tên đăng nhập
              <input
                name="username"
                required
                pattern="[a-zA-Z0-9_]{3,24}"
                title="3–24 ký tự: chữ không dấu, số hoặc dấu gạch dưới"
                minLength={3}
                maxLength={24}
                autoComplete="username"
              />
            </label>

            <label>
              Mật khẩu
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete={register ? "new-password" : "current-password"}
              />
            </label>

            <button className="arena-gold" disabled={busy}>
              {busy
                ? "Đang xử lý…"
                : register
                  ? "Đăng ký & tìm trận"
                  : "Đăng nhập & tìm trận"}

              <ArrowRight size={18} />
            </button>
          </form>

          <button className="arena-link" onClick={() => setRegister(!register)}>
            {register
              ? "Đã có tài khoản? Đăng nhập"
              : "Chưa có tài khoản? Đăng ký"}
          </button>
        </section>
      ) : !room ? (
        <section className="arena-wait">
          <span className="arena-kicker">ĐẤU TRƯỜNG NGẪU NHIÊN</span>

          <div className={`arena-seal ${searching ? "searching" : ""}`}>帥</div>

          <h1>{searching ? "Đang tìm tri kỷ…" : "Sẵn sàng khai cuộc?"}</h1>

          <p>
            {searching
              ? isCoup
                ? "Chờ một người chơi khác cùng bấm Cờ Úp."
                : "Chờ một người chơi khác cùng bấm Cờ Tướng."
              : "Bắt đầu tìm người chơi đang trực tuyến."}
          </p>

          <small>
            Ghép xong, cả hai có 30 giây để sẵn sàng. Tối thiểu 100 xu/người;
            mức bàn theo số dư thấp hơn của hai bên.
          </small>

          <a className="arena-link" href="/nhiem-vu">
            Nhận xu miễn phí · Nhiệm vụ hôm nay
          </a>

          {!searching && (
            <button className="arena-gold" onClick={() => void findMatch()}>
              Tìm lại <Swords size={18} />
            </button>
          )}

          <button
            className="arena-link"
            disabled={busy}
            onClick={() => void leaveQueue()}
          >
            Hủy tìm trận · Về trang chủ
          </button>

          <a className="arena-link" href="/kydai">
            Vào kỳ đài / luyện với máy
          </a>
        </section>
      ) : (
        <>
          <div className="arena-layout arena-layout--timed">
            <aside className="arena-captures" aria-label="Quân đã ăn">
              <span className="arena-kicker">CHIẾN TÍCH TRÊN BÀN</span>

              <h2>Quân đã ăn</h2>

              {room.coins && (
                <div className="arena-coin-pot">
                  <strong>
                    {room.coins.stake.toLocaleString("vi-VN")} xu/người
                  </strong>

                  <span>
                    Tổng bàn: {room.coins.pot.toLocaleString("vi-VN")} xu
                  </span>

                  <small>
                    {room.coins.settled
                      ? `Đã trả về ví bạn: ${(side === "r" ? room.coins.red_payout : room.coins.black_payout).toLocaleString("vi-VN")} xu`
                      : "Đã giữ xu từ hai ví · Hòa/hủy trước trận hoàn xu"}
                  </small>
                </div>
              )}

              {(["r", "b"] as Side[]).map((capturer) => (
                <section key={capturer}>
                  <h3>
                    {capturer === "r" ? "Đỏ ăn Đen" : "Đen ăn Đỏ"}

                    <small>{capturedBy(capturer).length} quân</small>
                  </h3>

                  <div className="arena-captured-list">
                    {capturedBy(capturer).map((m, i) => (
                      <span
                        key={i}
                        className={`arena-captured-piece ${m.captured?.[0] === "r" ? "red" : "black"}`}
                        title={`${vn[m.captured![1]]} ${m.captured?.[0] === "r" ? "Đỏ" : "Đen"}`}
                        aria-label={`${vn[m.captured![1]]} ${m.captured?.[0] === "r" ? "Đỏ" : "Đen"}`}
                      >
                        {names[m.captured!]}
                      </span>
                    ))}

                    {!capturedBy(capturer).length && <p>Chưa ăn quân nào</p>}
                  </div>
                </section>
              ))}

              <p className="arena-clock-rules">
                {clock
                  ? `${clock.total_seconds / 60} phút/người · ${clock.move_seconds} giây/lượt. Thời gian còn dư giữ sang lượt sau; không cộng thêm giây.`
                  : "Ván cũ chưa áp dụng đồng hồ."}
              </p>
            </aside>

            <section className="arena-game" aria-label="Bàn cờ tướng">
              <CoupRulesPanel active={isCoup} last={room.history.at(-1)} />

              <RankMatchResult
                result={(room as RankedRoom).rank_result}
                userId={user?.id}
              />

              <div className="arena-player">
                <div className="arena-opponent-avatar">
                  <ClockAvatar
                    profile={
                      side === "r"
                        ? (room as RankedRoom).black_profile
                        : (room as RankedRoom).red_profile
                    }
                    letter={opponent?.slice(0, 1).toUpperCase() ?? "?"}
                    running={!!clock && active && room.turn === otherSide}
                    remaining={moveLeft}
                    limit={clock?.move_seconds ?? 60}
                  />

                  {opponentId && friendStatus !== "friend" && (
                    <button
                      className="arena-add-friend"
                      type="button"
                      onClick={() => void addOpponentFriend()}
                      disabled={friendStatus === "sent"}
                      title="Gửi lời mời kết bạn trong ván"
                    >
                      {friendStatus === "sent" ? "Đã gửi" : "＋ Kết bạn"}
                    </button>
                  )}
                </div>

                <div>
                  <strong className="arena-player-name">
                    {opponent}

                    {clock && (
                      <time
                        className={`arena-bank ${active && room.turn === otherSide ? "active" : ""}`}
                        aria-label="Tổng thời gian của đối phương"
                      >
                        {formatClock(bankFor(otherSide))}
                      </time>
                    )}
                  </strong>

                  <RankLabel
                    profile={
                      side === "r"
                        ? (room as RankedRoom).black_profile
                        : (room as RankedRoom).red_profile
                    }
                  />

                  <span>
                    {side === "r" ? "Quân Đen" : "Quân Đỏ"} ·{" "}
                    {online.includes(opponentId ?? -1)
                      ? "Trực tuyến"
                      : "Đang kết nối"}
                  </span>
                </div>

                {room.status === "ready" ? (
                  <b className={otherReady ? "arena-ready-label" : ""}>
                    {otherReady ? "✓ Sẵn sàng" : "Chờ sẵn sàng"}
                  </b>
                ) : (
                  <b>
                    {active && room.turn !== side ? "Đang suy nghĩ…" : "Kỳ thủ"}
                  </b>
                )}

                {reaction && reaction.user_id === opponentId && (
                  <div className="arena-reaction" key={reaction.emoji}>
                    {reaction.emoji}
                  </div>
                )}
              </div>

              {active && clock && moveLeft <= 10 && (
                <div className="arena-time-warning" role="status">
                  <Clock size={17} />

                  <strong>{Math.ceil(moveLeft)}s</strong>

                  {moveLeft <= 0
                    ? "Đang chờ server xác nhận hết giờ…"
                    : room.turn === side
                      ? "Đến lượt bạn — sắp hết giờ!"
                      : "Đối phương sắp hết giờ!"}
                </div>
              )}

              <div className="arena-board-frame">
                <div className="arena-board">
                  <svg
                    className="arena-grid"
                    viewBox="0 0 900 1000"
                    aria-hidden="true"
                  >
                    <g fill="none" stroke="currentColor" strokeWidth="2.3">
                      {Array.from({ length: 10 }, (_, y) => (
                        <path key={"h" + y} d={`M50 ${50 + y * 100}H850`} />
                      ))}

                      {Array.from({ length: 9 }, (_, x) => (
                        <path
                          key={"v" + x}
                          d={
                            x === 0 || x === 8
                              ? `M${50 + x * 100} 50V950`
                              : `M${50 + x * 100} 50V450 M${50 + x * 100} 550V950`
                          }
                        />
                      ))}

                      <path d="M350 50L550 250M550 50L350 250M350 750L550 950M550 750L350 950" />

                      <rect
                        x="36"
                        y="36"
                        width="828"
                        height="928"
                        strokeWidth="4"
                      />
                    </g>

                    <g fill="currentColor" fontFamily="serif" fontSize="41">
                      <text x="190" y="516">
                        楚 河
                      </text>

                      <text x="560" y="516">
                        漢 界
                      </text>
                    </g>
                  </svg>

                  {Array.from({ length: 90 }, (_, display) => {
                    const i = side === "r" ? display : 89 - display,
                      p = room.board[i];

                    return (
                      <button
                        key={i}
                        type="button"
                        aria-label={`${p ? names[p] : "Ô trống"} ${String.fromCharCode(97 + (i % 9))}${10 - Math.floor(i / 9)}`}
                        aria-pressed={selected === i}
                        disabled={
                          !active ||
                          room.turn !== side ||
                          !socket.connected ||
                          pending
                        }
                        onClick={() => square(i)}
                        className={`arena-square ${selected === i ? "selected" : ""} ${last && (last.from === i || last.to === i) ? "last" : ""} ${targets[i] ? "target" : ""} ${king === i ? "checked" : ""} ${feedback?.kind === "blocked" && feedback.king === i ? "exposed" : ""}`}
                      >
                        {p && (
                          <span
                            data-covered={p[1] === "U" ? "true" : undefined}
                            className={`arena-piece ${p[0] === "r" ? "red" : "black"}`}
                          >
                            {names[p]}
                          </span>
                        )}

                        {!p && targets[i] && <i />}
                      </button>
                    );
                  })}

                  {room.status === "ready" && (
                    <div className="arena-ready-overlay">
                      <div>
                        <span className="arena-kicker">
                          ĐÃ TÌM THẤY ĐỐI THỦ
                        </span>

                        <h2>Giao hữu khai cuộc</h2>

                        <div className="arena-countdown">
                          <Clock size={20} />

                          <strong>{Math.min(30, seconds)}</strong>

                          <span>giây</span>
                        </div>

                        <button
                          className="arena-gold"
                          disabled={
                            myReady || !socket.connected || seconds === 0
                          }
                          onClick={() => send({ type: "ready" })}
                        >
                          {myReady ? (
                            <>
                              <Check size={18} /> Đã sẵn sàng
                            </>
                          ) : (
                            <>
                              Sẵn sàng <Swords size={18} />
                            </>
                          )}
                        </button>

                        <p>
                          {myReady
                            ? "Đang đợi đối phương xác nhận."
                            : "Cả hai sẵn sàng để bắt đầu. Đỏ đi trước. Kiểm tra mức xu bên trái trước khi xác nhận."}
                        </p>
                      </div>
                    </div>
                  )}

                  {room.status === "waiting" && (
                    <div className="arena-ready-overlay">
                      <div>
                        <h2>Chờ bạn vào phòng</h2>

                        <p>
                          Mã phòng: <strong>{room.code}</strong>
                        </p>

                        <p>
                          Gửi mã này cho đối thủ hoặc{" "}
                          <a href="/ban-be">mời bạn bè</a>.
                        </p>

                        <p>Trận bắt đầu khi người thứ hai xác nhận vào bàn.</p>
                      </div>
                    </div>
                  )}

                  {room.status === "cancelled" && (
                    <div className="arena-ready-overlay">
                      <div>
                        <ShieldAlert size={32} />

                        <h2>Ván cờ đã hủy</h2>

                        <p>{room.cancel_reason}</p>

                        <a href="/">Đang trở về trang chủ…</a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="arena-player self">
                <ClockAvatar
                  profile={
                    side === "r"
                      ? (room as RankedRoom).red_profile
                      : (room as RankedRoom).black_profile
                  }
                  letter={user.username.slice(0, 1).toUpperCase()}
                  running={!!clock && active && room.turn === side}
                  remaining={moveLeft}
                  limit={clock?.move_seconds ?? 60}
                />

                <div>
                  <strong className="arena-player-name">
                    {user.username} <small>· Bạn</small>
                    {clock && (
                      <time
                        className={`arena-bank ${active && room.turn === side ? "active" : ""}`}
                        aria-label="Tổng thời gian của bạn"
                      >
                        {formatClock(bankFor(side))}
                      </time>
                    )}
                  </strong>

                  <RankLabel
                    profile={
                      side === "r"
                        ? (room as RankedRoom).red_profile
                        : (room as RankedRoom).black_profile
                    }
                  />

                  <span>
                    {side === "r" ? "Quân Đỏ" : "Quân Đen"} ·{" "}
                    {active
                      ? room.turn === side
                        ? "Đến lượt bạn"
                        : "Lượt đối phương"
                      : "Giao hữu"}
                  </span>
                </div>

                <div className="arena-tools">
                  <button
                    aria-label="Menu ván cờ"
                    aria-expanded={menu}
                    onClick={() => {
                      setMenu(!menu);

                      setEmotes(false);
                    }}
                  >
                    <Menu size={21} />
                  </button>

                  <button
                    aria-label="Gửi cảm xúc"
                    aria-expanded={emotes}
                    onClick={() => {
                      setEmotes(!emotes);

                      setMenu(false);
                    }}
                  >
                    <MoreHorizontal size={22} />
                  </button>
                </div>

                {reaction?.user_id === user.id && (
                  <div className="arena-reaction">{reaction.emoji}</div>
                )}

                {menu && (
                  <div className="arena-menu">
                    <button
                      onClick={() => {
                        setMenu(false);

                        ended ? location.assign("/") : setConfirm("leave");
                      }}
                    >
                      <LogOut /> Ra ngoài
                    </button>

                    <button
                      disabled={!active || !!room.draw_by}
                      onClick={() => {
                        send({ type: "draw_offer" });

                        setMenu(false);
                      }}
                    >
                      <Handshake /> Cầu hòa
                    </button>

                    <button
                      disabled={!active}
                      onClick={() => {
                        setConfirm("resign");

                        setMenu(false);
                      }}
                    >
                      <Flag /> Xin thua
                    </button>

                    <button onClick={() => setSound(!sound)}>
                      {sound ? <Volume2 /> : <VolumeX />}

                      {sound ? "Tắt tiếng hiệu ứng" : "Bật tiếng hiệu ứng"}
                    </button>

                    <button onClick={() => void music.toggle()}>
                      <Music />

                      {music.music ? "Tắt nhạc" : "Bật nhạc"}
                    </button>
                  </div>
                )}

                {emotes && (
                  <div className="arena-emotes">
                    {EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        aria-label={"Gửi " + emoji}
                        onClick={() => {
                          send({ type: "reaction", emoji });

                          setEmotes(false);
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="arena-status" aria-live="polite">
                <span>
                  {socket.connected ? (
                    <Wifi size={14} />
                  ) : (
                    <WifiOff size={14} />
                  )}{" "}
                  {socket.replaced
                    ? "Ván đã mở ở tab khác"
                    : socket.connected
                      ? "Đã đồng bộ"
                      : "Đang kết nối lại…"}
                </span>

                <span>{room.history.length} nước đi</span>

                {feedback?.kind === "blocked" ? (
                  <b>
                    <ShieldAlert size={15} /> Lộ tướng
                  </b>
                ) : king >= 0 ? (
                  <b>
                    <Swords size={15} /> Chiếu tướng{" "}
                    {room.turn === "r" ? "Đỏ" : "Đen"}
                  </b>
                ) : null}
              </div>

              {socket.replaced && (
                <button className="arena-link" onClick={socket.reconnect}>
                  Tiếp tục trên tab này
                </button>
              )}

              {room.draw_by && active && (
                <div className="arena-draw">
                  <Handshake size={20} />

                  {room.draw_by === user.id ? (
                    <span>Đã gửi đề nghị hòa. Chờ đối phương.</span>
                  ) : (
                    <>
                      <span>Đối phương muốn cầu hòa.</span>

                      <button onClick={() => send({ type: "draw_accept" })}>
                        Đồng ý
                      </button>

                      <button onClick={() => send({ type: "draw_decline" })}>
                        Tiếp tục đấu
                      </button>
                    </>
                  )}
                </div>
              )}

              {ended && (
                <GameResult
                  board={room.board}
                  history={room.history}
                  variant={isCoup ? "coup" : "xiangqi"}
                  key={room.code}
                  result={result}
                  winner={room.winner}
                  mySide={side}
                  mode="online"
                  moves={room.history.length}
                  roomCode={room.code}
                  onNewGame={() => location.assign("/ghep-tran")}
                  onExport={exportGame}
                />
              )}
            </section>

            <aside className="arena-social">
              <div className="arena-social-title">
                <span>
                  <MessageCircle size={19} /> Giao lưu trong ván
                </span>

                <small>CHỈ HAI KỲ THỦ</small>
              </div>

              <section className="arena-video">
                <div className="arena-video-stage">
                  {call.calling ? (
                    <>
                      <video ref={call.remoteVideo} autoPlay playsInline />

                      <video
                        className="arena-local-video"
                        ref={call.localVideo}
                        autoPlay
                        playsInline
                        muted
                      />

                      {!call.ready && <span>Đang kết nối cuộc gọi…</span>}
                    </>
                  ) : (
                    <>
                      <div className="arena-camera-icon">
                        <Video size={26} />
                      </div>

                      <h3>Đối diện tri kỷ</h3>

                      <p>Một lời chào, thêm gần nhau.</p>
                    </>
                  )}
                </div>

                {call.calling ? (
                  <div className="arena-call-controls">
                    <button
                      aria-label={call.muted ? "Bật micro" : "Tắt micro"}
                      onClick={() => call.toggle("audio")}
                    >
                      {call.muted ? <MicOff /> : <Mic />}
                    </button>

                    <button
                      disabled={call.voiceOnly}
                      aria-label={call.camOff ? "Bật camera" : "Tắt camera"}
                      onClick={() => call.toggle("video")}
                    >
                      {call.camOff ? <VideoOff /> : <Video />}
                    </button>

                    <button
                      className="hangup"
                      aria-label="Kết thúc cuộc gọi"
                      onClick={() => call.stop()}
                    >
                      <PhoneOff />
                    </button>
                  </div>
                ) : (
                  <button
                    className="arena-call-button"
                    disabled={
                      !socket.connected ||
                      !online.includes(opponentId ?? -1) ||
                      ended ||
                      room.status === "cancelled"
                    }
                    onClick={() => void call.start()}
                  >
                    <Video size={16} /> Mời gọi video
                  </button>
                )}
              </section>

              <div
                className="arena-chat"
                role="log"
                aria-label="Tin nhắn trong ván"
              >
                {!messages.length && (
                  <div className="arena-chat-empty">
                    <Handshake size={27} />

                    <p>Mở lời chào trước nước cờ đầu tiên.</p>
                  </div>
                )}

                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`arena-message ${m.username === user.username ? "mine" : ""}`}
                  >
                    <small>{m.username}</small>

                    <p>{m.text}</p>
                  </div>
                ))}

                <div ref={chatEnd} />
              </div>

              <form
                className="arena-chat-form"
                onSubmit={(e) => {
                  e.preventDefault();

                  if (text.trim() && send({ type: "chat", text: text.trim() }))
                    setText("");
                }}
              >
                <Smile size={18} />

                <input
                  aria-label="Tin nhắn"
                  placeholder="Gửi lời đến đối thủ…"
                  value={text}
                  maxLength={1000}
                  onChange={(e) => setText(e.target.value)}
                  disabled={room.status === "cancelled"}
                />

                <button
                  type="submit"
                  aria-label="Gửi tin nhắn"
                  disabled={
                    !text.trim() ||
                    !socket.connected ||
                    room.status === "cancelled"
                  }
                >
                  <Send size={18} />
                </button>
              </form>

              <p className="arena-etiquette">
                GIỮ LỄ TRÊN BÀN CỜ · GIỮ TÌNH NGOÀI CUỘC
              </p>
            </aside>
          </div>
        </>
      )}

      {(confirm || call.incoming) && (
        <div className="arena-modal-shade">
          <section
            className="arena-prompt"
            role="dialog"
            aria-modal="true"
            aria-labelledby="arena-prompt-title"
          >
            <h2 id="arena-prompt-title">
              {call.incoming
                ? "Lời mời gọi video"
                : confirm === "resign"
                  ? "Bạn muốn xin thua?"
                  : "Rời kỳ đài?"}
            </h2>

            <p>
              {call.incoming
                ? `${opponent} muốn trò chuyện cùng bạn. Camera và micro chỉ mở khi bạn nhận lời.`
                : active
                  ? "Rời bàn hoặc xin thua khi trận đang diễn ra sẽ tính đối phương thắng."
                  : "Ván đang chờ sẽ được hủy."}
            </p>

            <div>
              <button
                autoFocus
                onClick={() => {
                  if (call.incoming) call.stop();
                  else setConfirm(null);
                }}
              >
                {call.incoming ? "Từ chối" : "Ở lại"}
              </button>

              <button
                className="arena-gold"
                onClick={() => {
                  if (call.incoming) {
                    void call.accept();

                    return;
                  }

                  if (!room) return;

                  if (room.status === "waiting") {
                    leaving.current = true;

                    if (send({ type: "leave" })) setConfirm(null);
                    else leaving.current = false;

                    return;
                  }

                  if (!active) {
                    void leaveQueue();

                    setConfirm(null);

                    return;
                  }

                  leaving.current = confirm === "leave";

                  if (
                    send({ type: confirm === "resign" ? "resign" : "leave" })
                  ) {
                    setConfirm(null);

                    call.stop();
                  } else leaving.current = false;
                }}
              >
                {call.incoming ? "Nhận cuộc gọi" : "Xác nhận"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
