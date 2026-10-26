"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import KvTopbar from "@/components/kv-topbar";
import PuzzleBoard from "@/components/puzzle-board";
import PuzzleEditor from "@/components/puzzle-editor";
import { allMoves, check, legal, moved, type Board } from "@/lib/chess";
import { bestDefence, parseFen, winningMoves } from "@/lib/puzzle";
import { loadCustom, MAX_CUSTOM, saveCustom, type CustomPuzzle } from "@/lib/puzzle-custom";
import data from "@/lib/puzzle-data.json";
import "./puzzle.css";

type Puzzle = { id: number; mate: 1 | 2 | 3; fen: string; name?: string; custom?: boolean };
const BUILT_IN = data as Puzzle[];
const KEY = "kyvan.puzzles.v1";
const TIERS: [number, string][] = [
  [1, "Chiếu bí 1 nước"],
  [2, "Chiếu bí 2 nước"],
  [3, "Chiếu bí 3 nước"],
  [0, "Thế của bạn"],
];
const READY = "Đỏ đi trước. Hãy tìm nước ép Đen vào thế chiếu bí.";

function loadSolved(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "{}");
    return Array.isArray(v.solved) ? v.solved.filter((n: unknown) => typeof n === "number") : [];
  } catch {
    return [];
  }
}

export default function PuzzlePage() {
  const [custom, setCustom] = useState<CustomPuzzle[]>([]);
  const all = useMemo<Puzzle[]>(() => [...BUILT_IN, ...custom.map((c) => ({ ...c, custom: true }))], [custom]);
  const [tier, setTier] = useState<number>(1);
  const [id, setId] = useState<number>(BUILT_IN[0].id);
  const [solved, setSolved] = useState<number[]>([]);
  const [editing, setEditing] = useState(false);
  const puzzle = all.find((p) => p.id === id) ?? BUILT_IN[0];

  const [board, setBoard] = useState<Board>(() => parseFen(BUILT_IN[0].fen));
  const [left, setLeft] = useState<number>(BUILT_IN[0].mate);
  const [selected, setSelected] = useState<number | null>(null);
  const [last, setLast] = useState<{ from: number; to: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [hint, setHint] = useState<{ from: number; to: number | null } | null>(null);
  const [message, setMessage] = useState(READY);

  useEffect(() => {
    // Đọc tiến độ và thế cờ tự thêm đã lưu trên trình duyệt sau khi trang hiển thị.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSolved(loadSolved());
    setCustom(loadCustom());
  }, []);

  const reset = useCallback((p: Puzzle) => {
    setBoard(parseFen(p.fen));
    setLeft(p.mate);
    setSelected(null);
    setLast(null);
    setBusy(false);
    setDone(false);
    setMistakes(0);
    setHint(null);
    setMessage(READY);
  }, []);

  const open = (p: Puzzle) => {
    setEditing(false);
    setId(p.id);
    setTier(p.custom ? 0 : p.mate);
    reset(p);
  };

  const targets = useMemo(
    () => (selected === null ? [] : Array.from({ length: 90 }, (_, t) => t).filter((t) => legal(board, selected, t))),
    [board, selected],
  );
  const checked = useMemo(() => {
    if (check(board, "b")) return board.indexOf("bK");
    if (check(board, "r")) return board.indexOf("rK");
    return null;
  }, [board]);

  function markSolved() {
    const next = solved.includes(puzzle.id) ? solved : [...solved, puzzle.id];
    setSolved(next);
    try {
      localStorage.setItem(KEY, JSON.stringify({ solved: next }));
    } catch {}
  }

  function play(from: number, to: number) {
    const good = winningMoves(board, left).some((m) => m.from === from && m.to === to);
    if (!good) {
      setMistakes((n) => n + 1);
      setSelected(null);
      setHint(null);
      setMessage("Chưa đúng: nước này chưa ép được chiếu bí. Thử nước khác.");
      return;
    }
    const after = moved(board, from, to);
    setHint(null);
    setSelected(null);
    setBoard(after);
    setLast({ from, to });
    const reply = bestDefence(after, left);
    if (!reply) {
      setDone(true);
      markSolved();
      setMessage(mistakes === 0 ? "Chiếu bí! Bạn giải đúng ngay từ đầu." : `Chiếu bí! Hoàn thành sau ${mistakes} lần thử sai.`);
      return;
    }
    setBusy(true);
    setMessage("Đen chống đỡ…");
    window.setTimeout(() => {
      setBoard(moved(after, reply.from, reply.to));
      setLast({ from: reply.from, to: reply.to });
      setLeft((n) => n - 1);
      setBusy(false);
      setMessage(`Đen đáp lại. Còn ${left - 1} nước để chiếu bí, Đỏ đi.`);
    }, 550);
  }

  function onSquare(i: number) {
    if (done || busy) return;
    if (selected !== null && targets.includes(i)) {
      play(selected, i);
      return;
    }
    setSelected(board[i]?.[0] === "r" ? i : null);
  }

  function showHint() {
    if (done || busy) return;
    const [m] = winningMoves(board, left);
    if (!m) return;
    if (!hint) {
      setHint({ from: m.from, to: null });
      setMessage("Gợi ý: hãy cân nhắc quân đang được đánh dấu.");
    } else {
      setHint({ from: m.from, to: m.to });
      setMessage("Gợi ý: đi quân đó tới ô đánh dấu.");
    }
  }

  function addPuzzle(p: { fen: string; mate: 1 | 2 | 3; name: string }) {
    if (custom.length >= MAX_CUSTOM) return;
    const item: CustomPuzzle = { id: Math.max(1000, ...custom.map((c) => c.id + 1)), ...p };
    const next = [...custom, item];
    setCustom(next);
    saveCustom(next);
    open({ ...item, custom: true });
  }

  function removeCustom(p: Puzzle) {
    if (!window.confirm("Xóa thế cờ này khỏi danh sách của bạn?")) return;
    const next = custom.filter((c) => c.id !== p.id);
    setCustom(next);
    saveCustom(next);
    const rest = next.at(-1);
    if (rest) open({ ...rest, custom: true });
    else open(BUILT_IN[0]);
  }

  const list = all.filter((p) => (tier === 0 ? p.custom : !p.custom && p.mate === tier));
  const position = list.findIndex((p) => p.id === puzzle.id);
  const nextPuzzle = position >= 0 ? list[position + 1] : undefined;
  const blackMoves = useMemo(() => allMoves(board, "b").length, [board]);
  const title = puzzle.custom ? puzzle.name || `Thế của bạn #${custom.findIndex((c) => c.id === puzzle.id) + 1}` : `Thế ${puzzle.id}`;
  const solvedBuiltIn = BUILT_IN.filter((p) => solved.includes(p.id)).length;

  return (
    <main className="pz-page kv-page">
      <KvTopbar title="Phá thế sát cục" current="/pha-the" />
      <section className="pz-hero">
        <h1>Phá Thế Sát Cục</h1>
        <p className="pz-progress">
          Đã giải {solvedBuiltIn}/{BUILT_IN.length} thế có sẵn
          {custom.length > 0 && ` · ${custom.length} thế của bạn`}
        </p>
      </section>

      <div className="pz-tabs" role="tablist" aria-label="Chọn nhóm thế cờ">
        {TIERS.map(([n, label]) => {
          const group = all.filter((p) => (n === 0 ? p.custom : !p.custom && p.mate === n));
          return (
            <button
              key={n}
              role="tab"
              aria-selected={!editing && tier === n}
              className={"pz-tab" + (!editing && tier === n ? " on" : "")}
              onClick={() => {
                if (group[0]) open(group[0]);
                else {
                  setTier(n);
                  setEditing(n === 0);
                }
              }}
            >
              {label} · {group.filter((p) => solved.includes(p.id)).length}/{group.length}
            </button>
          );
        })}
        <button className={"pz-tab add" + (editing ? " on" : "")} onClick={() => setEditing(true)}>
          ＋ Thêm thế cờ
        </button>
      </div>

      {editing ? (
        <PuzzleEditor onSave={addPuzzle} onCancel={() => setEditing(false)} />
      ) : (
        <div className="pz-layout">
          <div className="pz-board-wrap">
            <PuzzleBoard
              board={board}
              selected={selected}
              targets={targets}
              last={last}
              hintFrom={hint?.from ?? null}
              hintTo={hint?.to ?? null}
              checked={checked}
              disabled={done || busy}
              onSquare={onSquare}
            />
          </div>

          <aside className="pz-side kv-card">
            <h2>{title}</h2>
            <p className="pz-goal">
              Đỏ đi trước · chiếu bí trong <b>{left}</b> nước
            </p>
            <p className={"pz-msg" + (done ? " win" : "")} role="status" aria-live="polite">
              {message}
            </p>
            <div className="pz-actions">
              <button className="kv-btn" onClick={showHint} disabled={done || busy}>
                Gợi ý
              </button>
              <button className="kv-btn" onClick={() => reset(puzzle)} disabled={busy}>
                Làm lại
              </button>
              {done && nextPuzzle && (
                <button className="kv-btn kv-btn-primary" onClick={() => open(nextPuzzle)}>
                  Thế tiếp theo
                </button>
              )}
            </div>
            <p className="pz-stat">
              Lần thử sai: {mistakes}
              {done ? "" : ` · Đen còn ${blackMoves} nước đi`}
            </p>
            {list.length > 0 ? (
              <ol className="pz-list" aria-label="Danh sách thế cờ">
                {list.map((p, k) => (
                  <li key={p.id}>
                    <button
                      className={"pz-chip" + (p.id === puzzle.id ? " on" : "") + (solved.includes(p.id) ? " ok" : "")}
                      onClick={() => open(p)}
                      aria-label={`${p.custom ? "Thế của bạn " + (k + 1) : "Thế " + p.id}${solved.includes(p.id) ? ", đã giải" : ""}`}
                    >
                      {solved.includes(p.id) ? "✓" : p.custom ? k + 1 : p.id}
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="pz-stat">Bạn chưa có thế cờ nào. Bấm “＋ Thêm thế cờ” để tạo.</p>
            )}
            {puzzle.custom && (
              <div className="pz-actions pz-own">
                <button
                  className="kv-btn"
                  onClick={() => void navigator.clipboard?.writeText(puzzle.fen).then(() => setMessage("Đã sao chép FEN của thế cờ."))}
                >
                  Sao chép FEN
                </button>
                <button className="kv-btn kv-btn-danger" onClick={() => removeCustom(puzzle)}>
                  Xóa thế này
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
