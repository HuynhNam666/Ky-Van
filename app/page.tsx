"use client";
import GameResult from "@/components/game-result";
import { useChessFeedback } from "@/hooks/use-chess-feedback";
import { wouldExposeKing } from "@/lib/chess";
import "./chess-feedback.css";

import { useState, useEffect, useRef, useCallback } from "react";

import Link from "next/link";

import {
  Swords,
  Users,
  Bookmark,
  ChevronRight,
  ArrowUpRight,
  Plus,
  LogIn,
  LogOut,
  Monitor,
  Copy,
  Link as LinkIcon,
  Send,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RotateCcw,
  Flag,
  RefreshCw,
  Download,
  Upload,
  Check,
  Shield,
  BookOpen,
  Flower2,
  UserRound,
  LoaderCircle,
  WifiOff,
  PhoneOff,
  Trash2,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

import { Toaster } from "@/components/ui/sonner";

import { toast } from "sonner";

import {
  initial,
  names,
  vn,
  legal,
  moved,
  other,
  allMoves,
  chooseMove,
  check,
  label,
  validSave,
  Board,
  Move,
  Side,
} from "@/lib/chess";

import { api, Chat, Invite, Room, Saved, User } from "@/lib/api";

import { useRoomSocket } from "@/hooks/use-room-socket";

import { useCall } from "@/hooks/use-call";

import {
  inviteLink,
  inviteText,
  isPrivateHost,
  shareTargets,
} from "@/lib/share";

const SAVES = "kyvien-saves",
  CURRENT = "kyvien-current",
  ROOM = "kyvien-room";

type Loadable = Pick<Saved, "board" | "turn" | "history" | "mode">;

function readSaves(): Saved[] {
  try {
    const v = JSON.parse(localStorage.getItem(SAVES) || "[]");
    return Array.isArray(v)
      ? v.filter(
          (s: Saved) =>
            validSave(s) &&
            typeof s.id === "string" &&
            typeof s.name === "string" &&
            typeof s.date === "string",
        )
      : [];
  } catch {
    return [];
  }
}

function writeSaves(list: Saved[]) {
  localStorage.setItem(SAVES, JSON.stringify(list.slice(0, 50)));
}

export default function Home() {
  const [view, setView] = useState("play"),
    [modal, setModal] = useState(""),
    [authTab, setAuthTab] = useState("login"),
    [user, setUser] = useState<User | null>(null),
    [online, setOnline] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");

  const [board, setBoard] = useState<Board>(initial),
    [turn, setTurn] = useState<Side>("r"),
    [history, setHistory] = useState<Move[]>([]),
    [selected, setSelected] = useState<number | null>(null),
    [difficulty, setDifficulty] = useState("2"),
    [mode, setMode] = useState("ai"),
    [result, setResult] = useState(""),
    [sound, setSound] = useState(true),
    [flipped, setFlipped] = useState(false);

  const [room, setRoom] = useState<Room | null>(null),
    [rooms, setRooms] = useState<Room[]>([]),
    [mine, setMine] = useState<Room[]>([]),
    [code, setCode] = useState(""),
    [roomName, setRoomName] = useState("Giao hữu tại Kỳ Viện"),
    [saved, setSaved] = useState<Saved[]>([]),
    [saveName, setSaveName] = useState(""),
    [messages, setMessages] = useState<Chat[]>([]),
    [message, setMessage] = useState(""),
    [invites, setInvites] = useState<Invite[]>([]),
    [inviteName, setInviteName] = useState(""),
    [onlineIds, setOnlineIds] = useState<number[]>([]);

  const [next, setNext] = useState(""),
    [pendingLoad, setPendingLoad] = useState<Loadable | null>(null),
    [pendingDelete, setPendingDelete] = useState<Saved | null>(null);

  const fileInput = useRef<HTMLInputElement>(null),
    chatEnd = useRef<HTMLDivElement>(null),
    pending = useRef(false),
    booted = useRef(false),
    sessionReady = useRef<Promise<User | null>>(Promise.resolve(null)),
    roomRef = useRef<Room | null>(null),
    seenInvites = useRef(new Set<number>()),
    enterRef = useRef<(code: string, me: number) => void>(() => {});

  const uid = user?.id;

  const { connected, replaced, send, on, reconnect } = useRoomSocket(
    room?.code,
    uid,
  );

  const call = useCall(send, on, connected && !!room?.black_id);

  const { calling, stop: stopCall } = call;

  const mySide: Side = room?.black_id === uid ? "b" : "r";
  const topSide: Side = room ? other(mySide) : "b";
  const bottomSide: Side = other(topSide);

  const oppId = room ? (mySide === "r" ? room.black_id : room.red_id) : null;

  const peerOnline = connected && oppId ? onlineIds.includes(oppId) : null;

  // Giữ lại hàm âm thanh cũ để tham khảo; hook mới phụ trách phát tiếng.
  /*
  const tone = useCallback(() => {
    if (!sound) return;
    try {
      const a = new AudioContext(),
        o = a.createOscillator(),
        g = a.createGain();
      o.connect(g);
      g.connect(a.destination);
      o.frequency.setValueAtTime(500, a.currentTime);
      g.gain.setValueAtTime(0.04, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.08);
      o.start();
      o.stop(a.currentTime + 0.09);
      o.onended = () => void a.close();
    } catch {}
  }, [sound]);
  */

  const { feedback, warnExposedKing } = useChessFeedback(
    board,
    turn,
    history,
    sound,
    `${mode}:${room?.code ?? "local"}`,
  );

  function open(name: string) {
    setError("");
    setModal(name);
  }

  function requireOnline(intent = "") {
    if (!online) {
      open("offline");
      return false;
    }
    if (!user) {
      setNext(intent);
      open("auth");
      return false;
    }
    return true;
  }

  function leaveRoom() {
    if (room) {
      stopCall(false);
      setRoom(null);
    }
    setOnlineIds([]);
    try {
      sessionStorage.removeItem(ROOM);
    } catch {}
  }

  function reset(nextMode = "ai") {
    leaveRoom();
    setMode(nextMode);
    setFlipped(false);
    setBoard(initial());
    setTurn("r");
    setHistory([]);
    setSelected(null);
    setResult("");
    setView("play");
    setModal("");
    setMessages([]);
    try {
      localStorage.removeItem(CURRENT);
    } catch {}
  }

  const applyLocal = useCallback(
    (f: number, t: number) => {
      if (!legal(board, f, t)) return;
      const m: Move = { from: f, to: t, piece: board[f]!, captured: board[t] },
        b = moved(board, f, t),
        s = other(turn);
      setBoard(b);
      setTurn(s);
      setHistory((h) => [...h, m]);
      setSelected(null);
      // tone(); // Hook mới phát tiếng sau nước đi, tránh phát trùng.
      if (!allMoves(b, s).length)
        setResult(
          `${turn === "r" ? "Đỏ" : "Đen"} thắng! Đối phương không còn nước đi hợp lệ.`,
        );
    },
    [board, turn],
  );

  const consumeRoom = useCallback((r: Room) => {
    roomRef.current = r;
    setRoom(r);
    setBoard(r.board);
    setTurn(r.turn);
    setHistory(r.history);
    setSelected(null);
    setResult(
      r.status === "finished"
        ? r.winner
          ? `${r.winner === "r" ? "Đỏ" : "Đen"} thắng!`
          : "Ván cờ đã kết thúc."
        : r.status === "draw"
          ? "Ván cờ hòa."
          : "",
    );
    pending.current = false;
  }, []);

  const openRoom = useCallback(
    (r: Room, me: number) => {
      setMode("online");
      setFlipped(r.black_id === me);
      setMessages([]);
      setOnlineIds([]);
      consumeRoom(r);
      setView("play");
      setModal("");
      try {
        sessionStorage.setItem(ROOM, r.code);
      } catch {}
    },
    [consumeRoom],
  );

  useEffect(() => {
    roomRef.current = room;
    enterRef.current = (c, me) => {
      void enterRoom(true, c, me);
    };
  });

  // server reachable? keep asking while it is not, then restore the session

  useEffect(() => {
    if (!online) {
      const ping = () =>
        api("/health")
          .then(() => setOnline(true))
          .catch(() => {});
      ping();
      const t = setInterval(ping, 8000);
      return () => clearInterval(t);
    }

    sessionReady.current = api<User>("/auth/me")
      .then((u) => {
        setUser(u);
        return u;
      })
      .catch(() => null);
  }, [online]);

  // first paint is server-rendered with the opening position, so browser-only state is restored right after mount

  useEffect(() => {
    queueMicrotask(() => {
      if (booted.current) return;
      booted.current = true;

      setSaved(readSaves());

      const q = new URLSearchParams(window.location.search).get("room");

      if (q) {
        setCode(q.toUpperCase());
        setModal("join");
        return;
      }

      try {
        const s = JSON.parse(localStorage.getItem(CURRENT) || "null");

        if (
          validSave(s) &&
          s.history.length &&
          allMoves(s.board, s.turn).length
        ) {
          setBoard(s.board);
          setTurn(s.turn);
          setHistory(s.history);
          setMode((s as Saved).mode === "local" ? "local" : "ai");
          const d = (s as { difficulty?: string }).difficulty;
          if (d) setDifficulty(d);
          toast.info("Đã khôi phục ván cờ đang chơi dở.");
        }
      } catch {}
    });
  }, []);

  useEffect(() => {
    if (mode === "online") return;

    // (an empty history is never written or erased here: at mount it would wipe the saved game before it is restored)

    if (!history.length) return;

    try {
      if (result) localStorage.removeItem(CURRENT);
      else
        localStorage.setItem(
          CURRENT,
          JSON.stringify({ board, turn, history, mode, difficulty }),
        );
    } catch {}
  }, [board, turn, history, mode, result, difficulty]);

  useEffect(() => {
    if (mode !== "ai" || turn !== "b" || result) return;
    const timer = setTimeout(() => {
      const m = chooseMove(board, "b", Number(difficulty));
      if (m) applyLocal(m.from, m.to);
    }, 420);
    return () => clearTimeout(timer);
  }, [board, turn, mode, result, difficulty, applyLocal]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  // rooms the account is already in: resume after a refresh, list under "Phòng của bạn"

  useEffect(() => {
    if (uid == null || !online) return;
    let live = true;

    api<Room[]>("/rooms/mine")
      .then((list) => {
        if (!live) return;
        setMine(list);

        let want: string | null = null;
        try {
          want = sessionStorage.getItem(ROOM);
        } catch {}

        const r =
          want && !new URLSearchParams(window.location.search).get("room")
            ? list.find((x) => x.code === want)
            : undefined;

        if (r && !roomRef.current) openRoom(r, uid);
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, [uid, online, openRoom]);

  // invitations: badge in the menu plus a toast the moment one arrives, wherever the player is

  useEffect(() => {
    if (uid == null || !online) return;

    const load = () =>
      api<Invite[]>("/invitations")
        .then((list) => {
          setInvites(list);

          for (const i of list)
            if (!seenInvites.current.has(i.id)) {
              seenInvites.current.add(i.id);
              toast(`${i.sender} mời bạn vào phòng ${i.code}`, {
                duration: 20000,
                action: {
                  label: "Tham gia",
                  onClick: () => enterRef.current(i.code, uid),
                },
              });
            }
        })
        .catch(() => {});

    load();

    const tick = () => {
      if (!document.hidden) load();
    };

    const t = setInterval(tick, 6000);
    document.addEventListener("visibilitychange", tick);

    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [uid, online]);

  useEffect(() => {
    const offs = [
      on("state", consumeRoom),

      on("chat", (m) => setMessages((x) => [...x, m])),

      on("messages", setMessages),

      on("presence", setOnlineIds),

      on("error", (msg) => {
        pending.current = false;
        toast.error(msg);
      }),

      on("auth", () => {
        setUser(null);
        setRoom(null);
        setMode("ai");
        setOnlineIds([]);
        try {
          sessionStorage.removeItem(ROOM);
        } catch {}
        toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      }),
    ];

    return () => offs.forEach((off) => off());
  }, [on, consumeRoom]);

  useEffect(() => {
    if (!connected) pending.current = false;
  }, [connected]);

  // a dropped socket is not a dropped call; only end it when the peer stays offline

  useEffect(() => {
    if (!calling || peerOnline !== false) return;
    const t = setTimeout(() => {
      stopCall(false);
      toast.info("Đối phương đã rời phòng.");
    }, 6000);
    return () => clearTimeout(t);
  }, [calling, peerOnline, stopCall]);

  function clickSquare(i: number) {
    if (result) return;

    if (
      mode === "online" &&
      (!connected || room?.status !== "playing" || turn !== mySide)
    )
      return;

    if (mode === "ai" && turn === "b") return;

    // Chặn nước làm lộ Tướng và giữ quân đang chọn để người chơi thử nước khác.
    if (selected !== null && wouldExposeKing(board, selected, i)) {
      warnExposedKing(selected);
      return;
    }

    if (selected !== null && legal(board, selected, i)) {
      if (mode === "online") {
        if (pending.current) return;
        pending.current = send({
          type: "move",
          from: selected,
          to: i,
          version: room?.version,
        });
        setSelected(null);
      } else applyLocal(selected, i);

      return;
    }

    if (board[i]?.[0] === turn) setSelected(selected === i ? null : i);
    else setSelected(null);
  }

  async function authenticate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);

    try {
      const u = await api<User>("/auth/" + authTab, "POST", {
        username: f.get("username"),
        password: f.get("password"),
      });

      setUser(u);
      setModal("");
      toast.success(
        authTab === "register"
          ? "Đã tạo tài khoản. Chào mừng đến Kỳ Viện!"
          : "Đăng nhập thành công.",
      );

      // carry on with what the visitor came to do (invite link, "Tạo phòng mới")

      const step = next;
      setNext("");

      if (step === "join") void enterRoom(true, code, u.id);
      else if (step === "create") open("create");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function enterRoom(join = false, roomCode = code, me = uid) {
    if (!online) {
      open("offline");
      return;
    }

    // right after page load the session check may still be in flight: wait for it instead of asking a signed-in user to sign in

    if (me == null) me = (await sessionReady.current)?.id;

    if (me == null) {
      setNext(join ? "join" : "create");
      open("auth");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const r = await api<Room>(
        join ? "/rooms/" + roomCode.toUpperCase() + "/join" : "/rooms",
        "POST",
        join ? {} : { name: roomName },
      );

      openRoom(r, me);

      if (new URLSearchParams(window.location.search).has("room"))
        window.history.replaceState(null, "", window.location.pathname);
    } catch (err) {
      setError((err as Error).message);
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const loadRooms = useCallback(() => {
    if (!online) return;
    api<Room[]>("/rooms")
      .then(setRooms)
      .catch(() => {});
    if (uid != null)
      api<Room[]>("/rooms/mine")
        .then(setMine)
        .catch(() => {});
  }, [online, uid]);

  const loadSaved = useCallback(() => {
    if (uid != null && online)
      api<Saved[]>("/saves")
        .then(setSaved)
        .catch((err) => toast.error(err.message));
    else queueMicrotask(() => setSaved(readSaves()));
  }, [online, uid]);

  // (re)load a list when it is opened and again once the session turns out to be signed in

  useEffect(() => {
    if (view === "rooms") loadRooms();
    else if (view === "saved") loadSaved();
  }, [view, loadRooms, loadSaved]);

  async function saveGame() {
    if (result) {
      toast.info("Bạn có thể tải biên bản ván đã kết thúc bằng nút Xuất JSON.");
      return;
    }

    const s: Saved = {
      id:
        crypto.randomUUID?.() ||
        Date.now().toString(36) + Math.random().toString(36).slice(2),
      name:
        saveName.trim() || `Ván cờ ${new Date().toLocaleDateString("vi-VN")}`,
      date: new Date().toISOString(),
      board,
      turn,
      history,
      mode: mode === "online" ? "local" : mode,
    };

    try {
      if (user && online) {
        await api("/saves", "POST", s);
        toast.success("Đã lưu vào tài khoản.");
      } else {
        const all = [s, ...readSaves()];
        writeSaves(all);
        setSaved(all.slice(0, 50));
        toast.success("Đã lưu trên trình duyệt này.");
      }

      setModal("");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function askLoad(s: Loadable) {
    if (!validSave(s)) {
      toast.error("Dữ liệu bàn cờ không hợp lệ.");
      return;
    }
    setPendingLoad(s);
    open("resume");
  }

  function loadGame(m: "ai" | "local") {
    const s = pendingLoad;
    if (!s) return;

    leaveRoom();
    setFlipped(false);
    setBoard(s.board);
    setTurn(s.turn);
    setHistory(s.history);
    setMode(m);
    setSelected(null);
    setView("play");
    setModal("");
    setPendingLoad(null);

    setResult(
      allMoves(s.board, s.turn).length
        ? ""
        : `${s.turn === "r" ? "Đen" : "Đỏ"} thắng! Đối phương không còn nước đi hợp lệ.`,
    );

    toast.success(
      m === "ai"
        ? "Đã mở ván cờ. Bạn cầm quân Đỏ, máy cầm quân Đen."
        : "Đã mở ván cờ ở chế độ hai người cùng máy.",
    );
  }

  async function deleteSaved() {
    const s = pendingDelete;
    if (!s) return;

    try {
      if (user && online) await api("/saves/" + s.id, "DELETE");
      else writeSaves(readSaves().filter((v) => v.id !== s.id));
      setSaved((list) => list.filter((v) => v.id !== s.id));
      toast.success("Đã xóa ván đã lưu.");
    } catch (err) {
      toast.error((err as Error).message);
    }

    setPendingDelete(null);
    setModal("");
  }

  function exportGame() {
    const blob = new Blob(
        [
          JSON.stringify(
            {
              name: "Kỳ Viện",
              board,
              turn,
              history,
              mode: mode === "online" ? "local" : mode,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      u = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = u;
    a.download = "ky-vien-ban-co.json";
    a.click();
    URL.revokeObjectURL(u);
  }

  async function importGame(f?: File) {
    if (!f) return;
    if (f.size > 1000000) {
      toast.error("Tệp quá lớn (tối đa 1 MB).");
      return;
    }
    try {
      const s = JSON.parse(await f.text());
      if (!validSave(s)) throw Error();
      askLoad(s);
    } catch {
      toast.error(
        "Tệp bàn cờ không hợp lệ. Hãy chọn tệp JSON được xuất từ Kỳ Viện.",
      );
    }
  }

  async function invite() {
    try {
      await api("/rooms/" + room?.code + "/invite", "POST", {
        username: inviteName,
      });
      toast.success("Đã gửi lời mời trong game.");
      setInviteName("");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function shareRoom() {
    if (!room) return;

    try {
      if (navigator.share)
        await navigator.share({
          title: "Giao hữu tại Kỳ Viện",
          text: `Mời bạn vào phòng ${room.code}`,
          url: inviteLink(room.code),
        });
      else {
        await navigator.clipboard.writeText(inviteLink(room.code));
        toast.success(
          "Đã sao chép liên kết. Gửi cho bạn qua Zalo, Messenger hoặc mạng xã hội.",
        );
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError")
        toast.info("Bạn có thể sao chép mã phòng để gửi cho bạn bè.");
    }
  }

  async function copyInvite() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(inviteText(room.code));
      toast.success(
        "Đã sao chép lời mời. Dán vào Zalo, Messenger hoặc bất kỳ ứng dụng nào.",
      );
    } catch {
      toast.error("Không thể sao chép tự động.");
    }
  }

  function sendChat(e: React.FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (!text) return;

    if (!room) {
      toast.info("Chat khả dụng trong phòng chơi online.");
      return;
    }

    if (!send({ type: "chat", text })) {
      toast.info("Đang kết nối lại phòng chơi…");
      return;
    }

    setMessage("");
  }

  function undo() {
    if (mode === "online") {
      toast.info("Phòng online không hỗ trợ đi lại.");
      return;
    }

    if (!history.length) return;

    const count =
      mode === "ai" && turn === "r" ? Math.min(2, history.length) : 1;
    const b = board.slice();

    for (const m of history.slice(-count).reverse()) {
      b[m.from] = m.piece;
      b[m.to] = m.captured;
    }

    setBoard(b);
    setHistory(history.slice(0, -count));
    setTurn(history[history.length - count].piece[0] as Side);
    setResult("");
    setSelected(null);

    if (count >= history.length)
      try {
        localStorage.removeItem(CURRENT);
      } catch {}
  }

  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (t: unknown, o: unknown) => Promise<void>;
        };
      }
    ).modelContext;
    if (!context) return;
    const controller = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: "read_chess_position",
          description: "Read the current Xiangqi board, turn and legal moves.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true },
          execute: (input: unknown) => {
            if (input && Object.keys(input as object).length)
              throw Error("No parameters accepted");
            return {
              board,
              turn,
              mode,
              result,
              legalMoves: allMoves(board, turn),
            };
          },
        },
        { signal: controller.signal },
      ),
    ).catch(() => {});
    return () => controller.abort();
  }, [board, turn, mode, result]);

  const last = history[history.length - 1],
    checked = check(board, turn),
    destinations =
      selected === null
        ? []
        : Array.from({ length: 90 }, (_, i) => i).filter((i) =>
            legal(board, selected, i),
          );

  const opponent =
    mode === "ai"
      ? "Kỳ Sĩ AI"
      : room
        ? mySide === "r"
          ? room.black_name || "Chờ bằng hữu…"
          : room.red_name
        : "Người chơi Đen";

  const status =
    result ||
    (room?.status === "waiting"
      ? "Đang chờ người chơi thứ hai"
      : mode === "ai" && turn === "b"
        ? "Kỳ Sĩ đang suy nghĩ…"
        : checked
          ? "Chiếu tướng! Hãy bảo vệ Tướng."
          : `Lượt ${turn === "r" ? "Đỏ" : "Đen"} đi`);

  const navItems = [
    {
      id: "play",
      label: "Kỳ đài",
      icon: Swords,
      fn: () => setView("play"),
      badge: 0,
    },
    {
      id: "rooms",
      label: "Phòng chơi",
      icon: Users,
      fn: () => setView("rooms"),
      badge: invites.length,
    },
    {
      id: "saved",
      label: "Ván đã lưu",
      icon: Bookmark,
      fn: () => setView("saved"),
      badge: 0,
    },
  ];

  const cardRoom = (r: Room, mineList = false) => (
    <div className="room-card" key={r.code}>
      <div className="room-card-icon">棋</div>
      <h3>{r.name}</h3>
      <p>
        {mineList
          ? `${r.red_name} · ${r.black_name || "đang chờ đối thủ"} · ${r.status === "playing" ? "Đang chơi" : "Đang chờ"}`
          : `${r.red_name} · Đang chờ đối thủ`}
      </p>
      <div>
        <code>#{r.code}</code>
        <button
          className="outline-button"
          onClick={() =>
            mineList && uid != null
              ? openRoom(r, uid)
              : void enterRoom(true, r.code)
          }
        >
          {mineList ? "Vào lại" : "Vào phòng"} <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <SidebarProvider>
      <Toaster theme="dark" position="top-center" />
      <Sidebar className="app-sidebar" collapsible="none">
        <SidebarHeader>
          <Link href="/" className="brand">
            <span className="brand-seal">弈</span>
            <span>
              KỲ VIỆN<small>CỜ TƯỚNG TRỰC TUYẾN</small>
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <div className="nav-caption">KHÔNG GIAN KỲ ĐẠO</div>
          <SidebarMenu>
            {navItems.map((n) => (
              <SidebarMenuItem key={n.id}>
                <SidebarMenuButton
                  onClick={n.fn}
                  isActive={view === n.id}
                  className="nav-link"
                >
                  <n.icon size={20} />
                  <span>{n.label}</span>
                  {n.badge > 0 && (
                    <span
                      className="count nav-badge"
                      aria-label={`${n.badge} lời mời`}
                    >
                      {n.badge}
                    </span>
                  )}
                  {view === n.id && <span className="nav-mark" />}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <div className="sidebar-spacer" />
          <div className="small-seal">棋</div>
          <div className="sidebar-note">
            <span>MỖI NƯỚC ĐI, MỘT TÂM THẾ</span>
            <p>Tĩnh tâm khai cuộc.</p>
            <button onClick={() => open("rules")}>
              <BookOpen size={15} /> Luật cờ tướng <ArrowUpRight size={14} />
            </button>
          </div>
        </SidebarContent>
        <SidebarFooter>
          <button
            className="account"
            onClick={() => open(user ? "account" : "auth")}
          >
            <span className="avatar">
              <UserRound size={19} />
            </span>
            <span>
              {user?.username || "Khách ghé viện"}
              <small>
                {user ? "Tài khoản Kỳ Viện" : "Đăng nhập để giao hữu"}
              </small>
            </span>
            <ChevronRight size={16} />
          </button>
        </SidebarFooter>
      </Sidebar>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Kỳ Viện <ChevronRight size={13} />{" "}
            <span>
              {view === "play"
                ? "Kỳ đài"
                : view === "rooms"
                  ? "Phòng chơi"
                  : "Ván đã lưu"}
            </span>
          </div>
          <div className="top-actions">
            <span className="connection">
              <span className={online ? "dot live" : "dot"} />
              {online ? "Máy chủ sẵn sàng" : "Chế độ luyện tập"}
            </span>
            <button
              className="text-button login"
              onClick={() => open(user ? "account" : "auth")}
            >
              {user?.username || "Đăng nhập"}
              <LogIn size={16} />
            </button>
          </div>
        </header>

        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {view === "play"
                  ? "GẶP GỠ TRÊN BÀN CỜ"
                  : view === "rooms"
                    ? "BẰNG HỮU BỐN PHƯƠNG"
                    : "LƯU GIỮ TỪNG NƯỚC ĐI"}
              </div>
              <h1>
                {view === "play"
                  ? "Kỳ đài"
                  : view === "rooms"
                    ? "Phòng chơi"
                    : "Ván đã lưu"}
                <span className="heading-seal">弈</span>
              </h1>
              <p>
                {view === "play"
                  ? "Một ván giao hữu, một người tri kỷ."
                  : view === "rooms"
                    ? "Tạo phòng mới hoặc nhập mã để cùng bằng hữu so tài."
                    : "Mở lại bàn cờ, tiếp nối ván đấu còn dang dở."}
              </p>
            </div>
            <button
              className="outline-button"
              onClick={() => {
                if (requireOnline("create")) open("create");
              }}
            >
              <Plus size={17} /> Tạo phòng mới
            </button>
          </div>

          {view === "play" ? (
            <div className="game-layout">
              <section className="board-section">
                <div className="board-toolbar">
                  <span>
                    <span className="dot gold" />
                    {room
                      ? `PHÒNG ${room.code}`
                      : mode === "ai"
                        ? "LUYỆN CỜ CÙNG MÁY"
                        : "HAI NGƯỜI CÙNG MÁY"}
                  </span>
                  <button
                    onClick={() => setFlipped(!flipped)}
                    title="Đảo chiều bàn cờ"
                    aria-label="Đảo chiều bàn cờ"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>

                {replaced && (
                  <div className="notice replaced" role="alert">
                    <WifiOff size={18} />
                    <p>Phòng này đang mở ở một tab hoặc thiết bị khác.</p>
                    <button className="outline-button" onClick={reconnect}>
                      Dùng ở đây
                    </button>
                  </div>
                )}

                <div className="player-line">
                  <div className="player-main">
                    <div
                      className={`player-avatar ${topSide === "b" ? "dark-piece" : "red-piece"}`}
                    >
                      {mode === "ai" ? (
                        <Monitor size={23} />
                      ) : (
                        <UserRound size={23} />
                      )}
                    </div>
                    <div>
                      <strong>{opponent}</strong>
                      <small>
                        {mode === "ai" ? (
                          `Máy tính · ${difficulty === "1" ? "Nhập môn" : difficulty === "2" ? "Trung cấp" : "Cao thủ"}`
                        ) : room ? (
                          room.black_id ? (
                            <span
                              className={`presence ${peerOnline ? "on" : ""}`}
                            >
                              <i className="presence-dot" />
                              {peerOnline ? "Đang trực tuyến" : "Ngoại tuyến"}
                            </span>
                          ) : (
                            "Giao hữu trực tuyến"
                          )
                        ) : (
                          "Cầm quân Đen"
                        )}
                      </small>
                    </div>
                  </div>
                  <span className="player-badge">
                    {turn === topSide && !result ? (
                      <>
                        <span className="dot gold" /> Đang đi
                      </>
                    ) : (
                      <>
                        <span
                          className={`piece-dot ${topSide === "b" ? "black" : "red-dot"}`}
                        />{" "}
                        QUÂN {topSide === "b" ? "ĐEN" : "ĐỎ"}
                      </>
                    )}
                  </span>
                </div>

                <div className="board-frame kv-board-feedback">
                  {feedback?.message && (
                    <div
                      key={feedback.id}
                      className={`kv-alert-badge ${
                        feedback.kind === "blocked"
                          ? "kv-alert-badge--warning"
                          : board[feedback.king] === "rK"
                            ? "kv-alert-badge--red"
                            : "kv-alert-badge--black"
                      }`}
                      role="status"
                      aria-live="polite"
                      aria-atomic="true"
                    >
                      <span className="kv-alert-badge__icon" aria-hidden="true">
                        {feedback.kind === "blocked" ? (
                          <svg
                            width="23"
                            height="23"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M12 3 20 6v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3Z" />
                            <path d="M12 8v5" />
                            <path d="M12 16h.01" />
                          </svg>
                        ) : (
                          <span>
                            {board[feedback.king] === "rK" ? "帥" : "將"}
                          </span>
                        )}
                      </span>

                      <span className="kv-alert-badge__label">
                        {feedback.kind === "blocked"
                          ? "LỘ TƯỚNG"
                          : board[feedback.king] === "rK"
                            ? "ĐỎ BỊ CHIẾU"
                            : "ĐEN BỊ CHIẾU"}
                      </span>

                      <span className="kv-alert-badge__sr">
                        {feedback.kind === "blocked"
                          ? "Nước đi không được chấp nhận vì khiến Tướng của bạn bị chiếu."
                          : "Hãy đi một nước hóa giải chiếu tướng."}
                      </span>
                    </div>
                  )}
                  <div className="board-coordinates">
                    {Array.from({ length: 9 }, (_, i) => (
                      <span key={i}>{flipped ? i + 1 : 9 - i}</span>
                    ))}
                  </div>
                  <div
                    className="chessboard"
                    role="group"
                    aria-label="Bàn cờ tướng 9 cột 10 hàng"
                  >
                    <svg
                      className="board-grid"
                      viewBox="0 0 900 1000"
                      aria-hidden="true"
                    >
                      <rect
                        x="49"
                        y="49"
                        width="802"
                        height="902"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      />
                      {Array.from({ length: 10 }, (_, y) => (
                        <line
                          key={"h" + y}
                          x1="50"
                          y1={50 + y * 100}
                          x2="850"
                          y2={50 + y * 100}
                        />
                      ))}
                      {Array.from({ length: 9 }, (_, x) => (
                        <g key={"v" + x}>
                          <line
                            x1={50 + x * 100}
                            y1="50"
                            x2={50 + x * 100}
                            y2="450"
                          />
                          <line
                            x1={50 + x * 100}
                            y1="550"
                            x2={50 + x * 100}
                            y2="950"
                          />
                        </g>
                      ))}
                      <path d="M350 50L550 250M550 50L350 250M350 750L550 950M550 750L350 950" />
                      {[
                        19, 25, 27, 29, 31, 33, 35, 54, 56, 58, 60, 62, 64, 70,
                      ].map((i) => (
                        <g key={i}>
                          {[-1, 1].flatMap((x) =>
                            [-1, 1].map((y) =>
                              (i % 9 === 0 && x === -1) ||
                              (i % 9 === 8 && x === 1) ? null : (
                                <path
                                  key={`${x}${y}`}
                                  d={`M${50 + (i % 9) * 100 + x * 12} ${50 + Math.floor(i / 9) * 100 + y * 29} v${-y * 17} h${x * 17}`}
                                />
                              ),
                            ),
                          )}
                        </g>
                      ))}
                      <text x="250" y="518" textAnchor="middle">
                        楚 河
                      </text>
                      <text x="650" y="518" textAnchor="middle">
                        漢 界
                      </text>
                    </svg>
                    {Array.from({ length: 90 }, (_, position) => {
                      const i = flipped ? 89 - position : position,
                        p = board[i],
                        target = destinations.includes(i);
                      return (
                        <button
                          key={position}
                          className={`square ${selected === i ? "selected" : ""} ${last && (last.from === i || last.to === i) ? "last-move" : ""} ${target ? "legal" : ""} ${feedback?.square === i ? `kv-fx-${feedback.kind}` : ""} ${feedback?.king === i ? "kv-fx-king" : ""}`}
                          onClick={() => clickSquare(i)}
                          aria-label={`${String.fromCharCode(97 + (i % 9))}${10 - Math.floor(i / 9)}${p ? " " + vn[p[1]] + " " + (p[0] === "r" ? "Đỏ" : "Đen") : " ô trống"}`}
                          aria-pressed={selected === i}
                        >
                          {p ? (
                            <span
                              key={
                                feedback &&
                                (feedback.square === i || feedback.king === i)
                                  ? feedback.id
                                  : 0
                              }
                              className={`chess-piece ${p[0] === "r" ? "red" : "black"} ${checked && p === turn + "K" ? "in-check" : ""}`}
                            >
                              {names[p]}
                            </span>
                          ) : target ? (
                            <span className="move-dot" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  <div className="board-coordinates bottom">
                    {Array.from({ length: 9 }, (_, i) => (
                      <span key={i}>{flipped ? 9 - i : i + 1}</span>
                    ))}
                  </div>
                </div>

                <div className="player-line you">
                  <div className="player-main">
                    <div
                      className={`player-avatar ${bottomSide === "r" ? "red-piece" : "dark-piece"}`}
                    >
                      <UserRound size={24} />
                    </div>
                    <div>
                      <strong>
                        {room
                          ? mySide === "r"
                            ? room.red_name
                            : room.black_name
                          : user?.username || "Bạn"}{" "}
                        <span className="you-tag">
                          {room ? (mySide === "r" ? "Đỏ" : "Đen") : "Đỏ"}
                        </span>
                      </strong>
                      <small>
                        {room
                          ? connected
                            ? "Đã kết nối phòng chơi"
                            : "Đang kết nối lại…"
                          : "Tự do · Không tính giờ"}
                      </small>
                    </div>
                  </div>
                  <span className="player-badge">
                    {turn === bottomSide && !result ? (
                      <>
                        <span className="dot gold" /> Đang đi
                      </>
                    ) : (
                      <>
                        <span
                          className={`piece-dot ${bottomSide === "r" ? "red-dot" : "black"}`}
                        />{" "}
                        QUÂN {bottomSide === "r" ? "ĐỎ" : "ĐEN"}
                      </>
                    )}
                  </span>
                </div>
                <div className="board-bottom">
                  <span className={checked ? "check-text" : ""}>
                    {mode === "ai" && turn === "b" && !result ? (
                      <LoaderCircle className="spin" size={15} />
                    ) : (
                      <span className="dot gold" />
                    )}
                    {status}
                  </span>
                  <button
                    onClick={() => setSound(!sound)}
                    aria-label={sound ? "Tắt âm thanh" : "Bật âm thanh"}
                    title={sound ? "Tắt âm thanh" : "Bật âm thanh"}
                  >
                    {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
                  </button>
                </div>

                {result && (
                  <div className="result-banner" role="status">
                    <strong>{result}</strong>
                    <div>
                      {room ? (
                        <>
                          <button
                            className="outline-button"
                            onClick={() => reset("ai")}
                          >
                            <LogOut size={16} /> Rời phòng
                          </button>
                          <button
                            className="primary-button"
                            onClick={() => {
                              reset("ai");
                              open("create");
                            }}
                          >
                            <Plus size={16} /> Phòng mới
                          </button>
                        </>
                      ) : (
                        <button
                          className="primary-button"
                          onClick={() => reset(mode)}
                        >
                          <Swords size={16} /> Ván mới
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </section>

              <aside className="game-side">
                <section className="panel setup-panel">
                  <div className="panel-title">
                    <h2>Chọn cách chơi</h2>
                    <Swords size={18} />
                  </div>
                  <div className="mode-grid">
                    <button
                      className={`mode-card ${mode !== "online" ? "active" : ""}`}
                      onClick={() => {
                        if (room || mode === "local") open("new");
                        else setMode("ai");
                      }}
                    >
                      <Monitor size={23} />
                      <strong>
                        {mode === "local" ? "Cùng thiết bị" : "Chơi với máy"}
                      </strong>
                      <span>
                        {mode === "local"
                          ? "Hai người giao hữu"
                          : "Rèn luyện kỳ nghệ"}
                      </span>
                      {mode !== "online" && (
                        <Check size={13} className="mode-check" />
                      )}
                    </button>
                    <button
                      className={`mode-card ${mode === "online" ? "active" : ""}`}
                      onClick={() => {
                        if (requireOnline("create")) open("create");
                      }}
                    >
                      <Users size={23} />
                      <strong>Chơi online</strong>
                      <span>Giao hữu bằng hữu</span>
                      {mode === "online" && (
                        <Check size={13} className="mode-check" />
                      )}
                    </button>
                  </div>
                  {room ? (
                    <>
                      <div className="room-code">
                        <span>MÃ PHÒNG</span>
                        <strong>{room.code}</strong>
                        <button
                          onClick={() => {
                            navigator.clipboard
                              .writeText(room.code)
                              .then(() =>
                                toast.success("Đã sao chép mã phòng."),
                              )
                              .catch(() =>
                                toast.error("Không thể sao chép tự động."),
                              );
                          }}
                          aria-label="Sao chép mã phòng"
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                      <button
                        className="primary-button"
                        onClick={() => open("invite")}
                      >
                        <Users size={17} /> Mời bằng hữu
                      </button>
                      <button
                        className="outline-button leave-button"
                        onClick={() => open("leave")}
                      >
                        <LogOut size={16} /> Rời phòng
                      </button>
                    </>
                  ) : (
                    <>
                      <label className="field-label">Trình độ đối thủ</label>
                      <Select value={difficulty} onValueChange={setDifficulty}>
                        <SelectTrigger
                          className="level-select"
                          aria-label="Trình độ đối thủ"
                        >
                          <span className="level-icon">
                            {difficulty === "1"
                              ? "Ⅰ"
                              : difficulty === "2"
                                ? "Ⅱ"
                                : "Ⅲ"}
                          </span>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Nhập môn</SelectItem>
                          <SelectItem value="2">Trung cấp</SelectItem>
                          <SelectItem value="3">Cao thủ</SelectItem>
                        </SelectContent>
                      </Select>
                      <button
                        className="primary-button"
                        onClick={() => open("new")}
                      >
                        <Swords size={18} /> Khai cuộc mới{" "}
                        <ChevronRight size={17} />
                      </button>
                      <button
                        className="join-link"
                        onClick={() => open("join")}
                      >
                        <LinkIcon size={15} /> Vào phòng bằng mã{" "}
                        <ArrowUpRight size={14} />
                      </button>
                    </>
                  )}
                </section>

                {calling && (
                  <section className="call-window" aria-label="Cuộc gọi video">
                    <div className="call-top">
                      <strong>
                        Giao hữu · {call.voiceOnly ? "Gọi thoại" : "Video call"}
                      </strong>
                    </div>
                    <div className="call-stage">
                      <video
                        ref={call.remoteVideo}
                        autoPlay
                        playsInline
                        className="remote-video"
                      />
                      {!call.ready && <p>Đang chờ bằng hữu kết nối…</p>}
                      <video
                        ref={call.localVideo}
                        autoPlay
                        muted
                        playsInline
                        className={`local-video ${call.voiceOnly || call.camOff ? "off" : ""}`}
                      />
                    </div>
                    <div className="call-controls">
                      <button
                        onClick={() => call.toggle("audio")}
                        aria-pressed={call.muted}
                        aria-label={call.muted ? "Bật micro" : "Tắt micro"}
                        title={call.muted ? "Bật micro" : "Tắt micro"}
                      >
                        {call.muted ? <MicOff size={18} /> : <Mic size={18} />}
                      </button>
                      <button
                        onClick={() => call.toggle("video")}
                        disabled={call.voiceOnly}
                        aria-pressed={call.camOff}
                        aria-label={call.camOff ? "Bật camera" : "Tắt camera"}
                        title={call.camOff ? "Bật camera" : "Tắt camera"}
                      >
                        {call.camOff ? (
                          <VideoOff size={18} />
                        ) : (
                          <Video size={18} />
                        )}
                      </button>
                      <button
                        className="hang-up"
                        onClick={() => call.stop()}
                        aria-label="Kết thúc cuộc gọi"
                        title="Kết thúc cuộc gọi"
                      >
                        <PhoneOff size={18} />
                      </button>
                    </div>
                  </section>
                )}

                <section className="panel journal-panel">
                  <Tabs defaultValue="moves">
                    <TabsList className="journal-tabs">
                      <TabsTrigger value="moves">
                        Nước đi <span className="count">{history.length}</span>
                      </TabsTrigger>
                      <TabsTrigger value="chat">
                        Trò chuyện{" "}
                        {messages.length > 0 && (
                          <span className="count">{messages.length}</span>
                        )}
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="moves">
                      <div className="move-table-head">
                        <span>LƯỢT</span>
                        <span>
                          <i className="piece-dot red-dot" />
                          ĐỎ
                        </span>
                        <span>
                          <i className="piece-dot black" />
                          ĐEN
                        </span>
                      </div>
                      <div className="moves-list">
                        {!history.length ? (
                          <div className="empty-moves">
                            <span className="empty-piece">兵</span>
                            <p>Vạn nước cờ, một khởi đầu.</p>
                            <small>Chọn quân Đỏ để bắt đầu ván cờ.</small>
                          </div>
                        ) : (
                          Array.from(
                            { length: Math.ceil(history.length / 2) },
                            (_, i) => (
                              <div className="move-row" key={i}>
                                <span>{String(i + 1).padStart(2, "0")}</span>
                                <span>{label(history[i * 2])}</span>
                                <span>
                                  {history[i * 2 + 1]
                                    ? label(history[i * 2 + 1])
                                    : "—"}
                                </span>
                              </div>
                            ),
                          )
                        )}
                      </div>
                      <div className="journal-footer">
                        <Shield size={14} /> Nước đi được kiểm tra theo luật cờ
                        tướng
                      </div>
                    </TabsContent>
                    <TabsContent value="chat">
                      <div className="chat-head">
                        <span>
                          {room
                            ? "Trò chuyện trong phòng"
                            : "Cùng chuyện trò khi giao hữu"}
                        </span>
                        <button
                          onClick={() => void call.start()}
                          disabled={calling}
                          title="Gọi video"
                          aria-label="Gọi video"
                        >
                          <Video size={19} />
                        </button>
                      </div>
                      <div className="chat-messages">
                        {!messages.length ? (
                          <div className="empty-moves">
                            <Users size={30} />
                            <p>
                              {room
                                ? "Gửi lời chào đến bằng hữu."
                                : "Một ván cờ, thêm một người bạn."}
                            </p>
                            <small>
                              {room
                                ? "Chat và video call dành cho hai kỳ thủ."
                                : "Tạo hoặc tham gia phòng online để chat."}
                            </small>
                          </div>
                        ) : (
                          messages.map((m, i) => (
                            <div
                              className={
                                "chat-message " +
                                (m.username === user?.username ? "mine" : "")
                              }
                              key={i}
                            >
                              <small>
                                {m.username}
                                {m.time && (
                                  <>
                                    {" "}
                                    ·{" "}
                                    {new Date(m.time).toLocaleTimeString(
                                      "vi-VN",
                                      { hour: "2-digit", minute: "2-digit" },
                                    )}
                                  </>
                                )}
                              </small>
                              <p>{m.text}</p>
                            </div>
                          ))
                        )}
                        <div ref={chatEnd} />
                      </div>
                      <form className="chat-form" onSubmit={sendChat}>
                        <input
                          aria-label="Tin nhắn"
                          placeholder="Viết lời nhắn…"
                          value={message}
                          maxLength={1000}
                          onChange={(e) => setMessage(e.target.value)}
                        />
                        <button aria-label="Gửi tin nhắn">
                          <Send size={17} />
                        </button>
                      </form>
                    </TabsContent>
                  </Tabs>
                </section>

                <div className="game-actions">
                  <button
                    onClick={undo}
                    disabled={!history.length || mode === "online"}
                  >
                    <RotateCcw size={18} />
                    Đi lại
                  </button>
                  <button
                    onClick={() => {
                      setSaveName("");
                      open("save");
                    }}
                  >
                    <Bookmark size={18} />
                    Lưu ván
                  </button>
                  <button
                    disabled={
                      !!result ||
                      (!!room && (!connected || room.status !== "playing"))
                    }
                    onClick={() => open("resign")}
                  >
                    <Flag size={18} />
                    Đầu hàng
                  </button>
                </div>
                <div className="quiet-note">
                  <Flower2 size={18} />
                  <span>
                    Thắng không kiêu, bại không nản.
                    <br />
                    <small>Giữ lễ trên bàn cờ, giữ tình ngoài cuộc.</small>
                  </span>
                </div>
              </aside>
            </div>
          ) : view === "rooms" ? (
            <section className="lobby">
              <div className="lobby-top">
                <h2>Phòng đang chờ</h2>
                <div>
                  <button
                    className="outline-button"
                    onClick={() => open("join")}
                  >
                    <LinkIcon size={16} /> Nhập mã phòng
                  </button>
                  <button
                    className="icon-button"
                    onClick={loadRooms}
                    aria-label="Tải lại phòng"
                  >
                    <RefreshCw size={17} />
                  </button>
                </div>
              </div>
              {invites.length > 0 && (
                <div className="invites">
                  {invites.map((i) => (
                    <div key={i.id}>
                      <span>
                        <strong>{i.sender}</strong> mời bạn vào phòng {i.code}
                      </span>
                      <button
                        className="outline-button"
                        onClick={() => void enterRoom(true, i.code)}
                      >
                        Tham gia
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {mine.length > 0 && (
                <>
                  <h3 className="section-title">Phòng của bạn</h3>
                  <div className="room-list">
                    {mine.map((r) => cardRoom(r, true))}
                  </div>
                </>
              )}
              {rooms.filter((r) => !mine.some((m) => m.code === r.code))
                .length ? (
                <>
                  <h3 className="section-title">Đang chờ đối thủ</h3>
                  <div className="room-list">
                    {rooms
                      .filter((r) => !mine.some((m) => m.code === r.code))
                      .map((r) => cardRoom(r))}
                  </div>
                </>
              ) : (
                !mine.length && (
                  <div className="large-empty">
                    <Users size={38} />
                    <h2>
                      {online
                        ? "Chưa có phòng đang chờ"
                        : "Hẹn bằng hữu một ván cờ"}
                    </h2>
                    <p>
                      {online
                        ? "Tạo phòng đầu tiên và gửi mã cho bạn bè."
                        : "Phòng online sẽ mở khi máy chủ được kết nối. Bạn có thể luyện cờ với máy ngay bây giờ."}
                    </p>
                    <button
                      className="primary-button"
                      onClick={() =>
                        online
                          ? requireOnline("create") && open("create")
                          : reset()
                      }
                    >
                      {online ? "Tạo phòng mới" : "Luyện cờ với máy"}
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )
              )}
            </section>
          ) : (
            <section className="lobby">
              <div className="lobby-top">
                <div>
                  <h2>
                    {user && online
                      ? "Bàn cờ trong tài khoản"
                      : "Bàn cờ trên thiết bị này"}
                  </h2>
                  <p className="muted">{saved.length} ván đã lưu</p>
                </div>
                <button
                  className="outline-button"
                  onClick={() => fileInput.current?.click()}
                >
                  <Upload size={16} /> Nạp tệp JSON
                </button>
              </div>
              {saved.length ? (
                <div className="room-list">
                  {saved.map((s) => (
                    <div className="room-card" key={s.id}>
                      <Bookmark size={25} />
                      <h3>{s.name}</h3>
                      <p>
                        {new Date(s.date).toLocaleDateString("vi-VN")} ·{" "}
                        {s.history.length} nước đi ·{" "}
                        {s.mode === "ai" ? "Chơi với máy" : "Hai người"}
                      </p>
                      <div>
                        <button
                          className="outline-button"
                          onClick={() => askLoad(s)}
                        >
                          Tiếp tục ván cờ <ChevronRight size={16} />
                        </button>
                        <button
                          className="icon-button"
                          onClick={() => {
                            setPendingDelete(s);
                            open("remove");
                          }}
                          aria-label={`Xóa ${s.name}`}
                          title="Xóa ván đã lưu"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="large-empty">
                  <Bookmark size={38} />
                  <h2>Ván cờ hay, lưu lại để tiếp nối.</h2>
                  <p>Nhấn “Lưu ván” tại kỳ đài hoặc nạp bàn cờ từ tệp JSON.</p>
                  <button
                    className="primary-button"
                    onClick={() => setView("play")}
                  >
                    Trở về kỳ đài <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Hieu ung ket thuc van co: bo sung, giu nguyen result-banner cu. */}
          {result && (
            <GameResult
              result={result}
              winner={room?.winner}
              mySide={room ? mySide : "r"}
              mode={mode}
              moves={history.length}
              roomCode={room?.code}
              onExport={exportGame}
              onNewGame={() => {
                if (room) {
                  reset("ai");
                  open("create");
                } else {
                  reset(mode);
                }
              }}
            />
          )}

          <footer className="site-footer">
            <span>
              KỲ VIỆN <i /> Không gian của những người yêu cờ
            </span>
            <button onClick={() => open("rules")}>
              Luật chơi <ArrowUpRight size={13} />
            </button>
          </footer>
        </main>
      </div>

      <input
        type="file"
        accept="application/json,.json"
        hidden
        ref={fileInput}
        onChange={(e) => {
          void importGame(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <Dialog
        open={!!modal}
        onOpenChange={(o) => {
          if (!o) {
            setModal("");
            setNext("");
          }
        }}
      >
        <DialogContent className="ky-dialog">
          <DialogHeader>
            <DialogTitle>
              {
                {
                  auth:
                    authTab === "login"
                      ? "Trở lại Kỳ Viện"
                      : "Gia nhập Kỳ Viện",
                  account: "Tài khoản kỳ thủ",
                  create: "Tạo phòng giao hữu",
                  join: "Vào phòng bằng mã",
                  offline: "Kỳ đài online chưa mở",
                  save: "Lưu ván cờ",
                  new: "Khai cuộc mới",
                  resign: "Xác nhận đầu hàng",
                  invite: "Mời bằng hữu",
                  rules: "Luật cờ tướng",
                  leave: "Rời phòng chơi",
                  resume: "Tiếp tục ván cờ",
                  remove: "Xóa ván đã lưu",
                }[modal]
              }
            </DialogTitle>
            <DialogDescription>
              {
                {
                  auth:
                    next === "join" && code
                      ? `Đăng nhập hoặc tạo tài khoản để vào phòng ${code}.`
                      : "Đăng nhập để tạo phòng, mời bạn và lưu ván vào tài khoản.",
                  account: "Thông tin đăng nhập của bạn.",
                  create: "Bạn cầm quân Đỏ. Gửi mã phòng để mời người thứ hai.",
                  join: "Nhập mã gồm 6 ký tự do chủ phòng chia sẻ.",
                  offline:
                    "Bản hiện tại có thể chơi với máy, chơi cùng máy và lưu bàn cờ trên thiết bị.",
                  save:
                    user && online
                      ? "Lưu bàn cờ hiện tại vào tài khoản."
                      : "Ván cờ được lưu riêng trên trình duyệt này.",
                  new: "Bàn cờ hiện tại sẽ được thay bằng thế khai cuộc.",
                  resign: "Ván cờ sẽ kết thúc và đối thủ giành chiến thắng.",
                  invite:
                    "Chia sẻ mã phòng, đường dẫn hoặc gửi lời mời trong game.",
                  rules: "Hai bên lần lượt đi một quân. Bên Đỏ đi trước.",
                  leave:
                    "Ván cờ vẫn được giữ lại. Bạn có thể vào lại từ mục Phòng chơi hoặc bằng mã phòng.",
                  resume: "Chọn cách chơi tiếp thế cờ này.",
                  remove: pendingDelete
                    ? `Xóa “${pendingDelete.name}” khỏi danh sách ván đã lưu?`
                    : "",
                }[modal]
              }
            </DialogDescription>
          </DialogHeader>

          {modal === "auth" && (
            <>
              <Tabs value={authTab} onValueChange={setAuthTab}>
                <TabsList className="auth-tabs">
                  <TabsTrigger value="login">Đăng nhập</TabsTrigger>
                  <TabsTrigger value="register">Đăng ký</TabsTrigger>
                </TabsList>
              </Tabs>
              <form className="dialog-form" onSubmit={authenticate}>
                <label>
                  Tên kỳ thủ
                  <input
                    name="username"
                    autoComplete="username"
                    required
                    minLength={3}
                    maxLength={24}
                    pattern="[a-zA-Z0-9_]{3,24}"
                    placeholder="Tên không dấu, 3–24 ký tự"
                  />
                </label>
                <label>
                  Mật khẩu
                  <input
                    name="password"
                    type="password"
                    autoComplete={
                      authTab === "login" ? "current-password" : "new-password"
                    }
                    required
                    minLength={8}
                    maxLength={128}
                    placeholder="Ít nhất 8 ký tự"
                  />
                </label>
                {!online && (
                  <p className="notice">
                    Máy chủ online chưa được kết nối. Đăng ký/đăng nhập sẽ khả
                    dụng sau khi chạy backend.
                  </p>
                )}
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <button className="primary-button" disabled={busy || !online}>
                  {busy ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : authTab === "login" ? (
                    "Đăng nhập"
                  ) : (
                    "Tạo tài khoản"
                  )}
                </button>
              </form>
            </>
          )}

          {modal === "account" && (
            <>
              <p>
                Đang đăng nhập: <strong>{user?.username}</strong>
              </p>
              <button
                className="outline-button"
                onClick={async () => {
                  try {
                    await api("/auth/logout", "POST");
                    if (room) reset("ai");
                    setModal("");
                    setUser(null);
                    setMine([]);
                    setInvites([]);
                    seenInvites.current.clear();
                    toast.success("Đã đăng xuất.");
                  } catch (err) {
                    toast.error((err as Error).message);
                  }
                }}
              >
                Đăng xuất
              </button>
            </>
          )}

          {modal === "offline" && (
            <>
              <div className="notice">
                <WifiOff size={20} />
                <p>
                  Đăng nhập, phòng online, chat và video call cần máy chủ Python
                  đang hoạt động.
                </p>
              </div>
              <button
                className="primary-button"
                onClick={() => {
                  setModal("");
                  setView("play");
                }}
              >
                Tiếp tục luyện cờ <ChevronRight size={17} />
              </button>
            </>
          )}

          {modal === "create" && (
            <form
              className="dialog-form"
              onSubmit={(e) => {
                e.preventDefault();
                void enterRoom();
              }}
            >
              <label>
                Tên phòng
                <input
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  required
                  maxLength={60}
                />
              </label>
              <p className="notice">2 người · Không tính giờ · Đỏ đi trước</p>
              {error && <p className="form-error">{error}</p>}
              <button className="primary-button" disabled={busy}>
                <Plus size={17} />
                Tạo phòng
              </button>
            </form>
          )}

          {modal === "join" && (
            <form
              className="dialog-form"
              onSubmit={(e) => {
                e.preventDefault();
                void enterRoom(true);
              }}
            >
              <label>
                Mã phòng
                <input
                  className="code-input"
                  value={code}
                  onChange={(e) =>
                    setCode(
                      e.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase(),
                    )
                  }
                  placeholder="VD: A7K9F2"
                  required
                  minLength={6}
                  maxLength={6}
                />
              </label>
              {error && <p className="form-error">{error}</p>}
              <button className="primary-button" disabled={busy}>
                Vào phòng <ChevronRight size={17} />
              </button>
            </form>
          )}

          {modal === "save" && (
            <div className="dialog-form">
              <label>
                Tên ván cờ
                <input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  maxLength={80}
                  placeholder="Ván giao hữu đầu tiên"
                />
              </label>
              <button className="primary-button" onClick={saveGame}>
                <Bookmark size={17} />
                Lưu bàn cờ
              </button>
              <div className="split-buttons">
                <button className="outline-button" onClick={exportGame}>
                  <Download size={16} />
                  Xuất JSON
                </button>
                <button
                  className="outline-button"
                  onClick={() => fileInput.current?.click()}
                >
                  <Upload size={16} />
                  Nạp JSON
                </button>
              </div>
            </div>
          )}

          {modal === "new" && (
            <div className="dialog-form">
              <button className="primary-button" onClick={() => reset("ai")}>
                <Monitor size={18} />
                Chơi với máy
              </button>
              <button className="outline-button" onClick={() => reset("local")}>
                <Users size={18} />
                Hai người cùng thiết bị
              </button>
              <button className="text-button" onClick={() => open("save")}>
                Lưu ván hiện tại trước
              </button>
            </div>
          )}

          {modal === "resume" && (
            <div className="dialog-form">
              <button
                className={
                  pendingLoad?.mode === "local"
                    ? "outline-button"
                    : "primary-button"
                }
                onClick={() => loadGame("ai")}
              >
                <Monitor size={18} />
                Chơi tiếp với máy
              </button>
              <button
                className={
                  pendingLoad?.mode === "local"
                    ? "primary-button"
                    : "outline-button"
                }
                onClick={() => loadGame("local")}
              >
                <Users size={18} />
                Hai người cùng thiết bị
              </button>
            </div>
          )}

          {modal === "remove" && (
            <div className="dialog-form">
              <button
                className="primary-button"
                onClick={() => void deleteSaved()}
              >
                <Trash2 size={17} />
                Xóa ván này
              </button>
              <button
                className="outline-button"
                onClick={() => {
                  setPendingDelete(null);
                  setModal("");
                }}
              >
                Giữ lại
              </button>
            </div>
          )}

          {modal === "leave" && (
            <div className="dialog-form">
              <button className="primary-button" onClick={() => reset("ai")}>
                <LogOut size={17} />
                Rời phòng
              </button>
              <button className="outline-button" onClick={() => setModal("")}>
                Ở lại phòng
              </button>
            </div>
          )}

          {modal === "resign" && (
            <button
              className="primary-button"
              onClick={() => {
                if (room) send({ type: "resign" });
                else
                  setResult(
                    `${mode === "ai" || turn === "r" ? "Đen" : "Đỏ"} thắng do đối phương đầu hàng.`,
                  );
                setModal("");
              }}
            >
              <Flag size={17} />
              Đầu hàng
            </button>
          )}

          {modal === "invite" && room && (
            <div className="dialog-form">
              <div className="invite-code">{room.code}</div>
              <button className="primary-button" onClick={shareRoom}>
                <LinkIcon size={17} />
                Chia sẻ liên kết phòng
              </button>
              <div
                className="share-row"
                role="group"
                aria-label="Chia sẻ qua mạng xã hội"
              >
                {shareTargets(room.code).map((t) => (
                  <a
                    key={t.id}
                    className="share-chip"
                    href={t.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t.label}
                  </a>
                ))}
                <button className="share-chip" onClick={copyInvite}>
                  <Copy size={14} /> Sao chép lời mời
                </button>
              </div>
              {isPrivateHost(window.location.hostname) && (
                <p className="notice">
                  Liên kết này trỏ tới địa chỉ nội bộ nên chỉ bạn bè cùng mạng
                  mới mở được. Hãy đưa Kỳ Viện lên tên miền công khai để mời
                  người ở xa.
                </p>
              )}
              <label>
                Mời kỳ thủ trong game
                <input
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Tên đăng nhập của bằng hữu"
                  maxLength={24}
                />
              </label>
              <button
                className="outline-button"
                disabled={!inviteName.trim()}
                onClick={invite}
              >
                <Send size={16} />
                Gửi lời mời
              </button>
            </div>
          )}

          {modal === "rules" && (
            <div className="rules">
              <p>
                <strong>Mục tiêu:</strong> khiến đối phương không còn nước đi
                hợp lệ. Không được để Tướng của mình bị chiếu hoặc để hai Tướng
                nhìn thẳng nhau.
              </p>
              <p>
                <strong>Tướng / Sĩ:</strong> đi trong cung 3×3; Tướng đi ngang,
                dọc 1 ô; Sĩ đi chéo 1 ô.
              </p>
              <p>
                <strong>Tượng / Mã:</strong> Tượng đi chéo 2 ô, không qua sông
                và không được cản mắt. Mã đi hình chữ L, bị chặn khi có quân ở
                chân Mã.
              </p>
              <p>
                <strong>Xe / Pháo:</strong> Xe đi ngang, dọc không bị cản. Pháo
                phải nhảy qua đúng 1 quân khi bắt quân.
              </p>
              <p>
                <strong>Tốt:</strong> đi thẳng 1 ô. Qua sông được đi ngang,
                không được lùi.
              </p>
              <p className="notice">
                Chế độ giao hữu: không tính giờ. Phòng online hòa khi lặp lại
                cùng thế cờ và lượt đi 3 lần; chưa áp dụng phán xử chiếu đuổi
                của giải đấu.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={call.incoming}
        onOpenChange={(o) => {
          if (!o) call.stop();
        }}
      >
        <DialogContent className="ky-dialog">
          <DialogHeader>
            <DialogTitle>Cuộc gọi từ bằng hữu</DialogTitle>
            <DialogDescription>
              Cho phép camera và micro để bắt đầu cuộc gọi.
            </DialogDescription>
          </DialogHeader>
          <button className="primary-button" onClick={() => void call.accept()}>
            <Video size={18} />
            Nhận cuộc gọi
          </button>
          <button className="outline-button" onClick={() => call.stop()}>
            Từ chối
          </button>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
