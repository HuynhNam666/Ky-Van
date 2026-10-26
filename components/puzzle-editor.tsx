"use client";
import { useState } from "react";
import PuzzleBoard from "@/components/puzzle-board";
import { names, type Board } from "@/lib/chess";
import { parseFen, toFen } from "@/lib/puzzle";
import { analyze, MAX_MATE, MAX_PIECES } from "@/lib/puzzle-custom";

const PIECES = ["rK", "rA", "rE", "rH", "rR", "rC", "rP", "bK", "bA", "bE", "bH", "bR", "bC", "bP"];

function startBoard(): Board {
  const b: Board = Array(90).fill(null);
  b[4] = "bK";
  b[85] = "rK";
  return b;
}

export default function PuzzleEditor({
  onSave,
  onCancel,
}: {
  onSave: (p: { fen: string; mate: 1 | 2 | 3; name: string }) => void;
  onCancel: () => void;
}) {
  const [board, setBoard] = useState<Board>(startBoard);
  const [piece, setPiece] = useState<string | null>("rR");
  const [name, setName] = useState("");
  const [fenText, setFenText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const count = board.filter(Boolean).length;

  function place(i: number) {
    setError("");
    setBoard((b) => {
      const next = b.slice();
      next[i] = piece === null || next[i] === piece ? null : piece;
      return next;
    });
  }

  function loadFen() {
    try {
      setBoard(parseFen(fenText.trim()));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function save() {
    setBusy(true);
    setError("");
    // Cho giao diện kịp hiện "Đang kiểm tra" trước khi bộ giải chạy.
    window.setTimeout(() => {
      const fen = toFen(board);
      const result = analyze(fen);
      setBusy(false);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onSave({ fen, mate: result.mate, name: name.trim().slice(0, 40) });
    }, 30);
  }

  return (
    <div className="pz-editor">
      <div className="pz-board-wrap">
        <PuzzleBoard
          board={board}
          selected={null}
          targets={[]}
          last={null}
          hintFrom={null}
          hintTo={null}
          checked={null}
          onSquare={place}
        />
      </div>
      <aside className="pz-side kv-card">
        <h2>Thêm thế cờ của bạn</h2>
        <p className="pz-goal">
          Chọn quân rồi bấm vào ô để đặt (bấm lại để xóa). Đỏ đi trước, phải ép chiếu bí trong tối đa {MAX_MATE} nước.
        </p>
        <div className="pz-palette" role="group" aria-label="Chọn quân">
          {PIECES.map((p) => (
            <button
              key={p}
              type="button"
              className={"pz-piece " + (p[0] === "r" ? "red" : "black") + (piece === p ? " on" : "")}
              aria-pressed={piece === p}
              aria-label={`${p[0] === "r" ? "Đỏ" : "Đen"} ${names[p]}`}
              onClick={() => setPiece(p)}
            >
              {names[p]}
            </button>
          ))}
          <button type="button" className={"pz-piece eraser" + (piece === null ? " on" : "")} aria-pressed={piece === null} onClick={() => setPiece(null)}>
            Xóa
          </button>
        </div>
        <label className="pz-field">
          Tên thế cờ (không bắt buộc)
          <input className="kv-input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Song xa chiếu tướng" />
        </label>
        <label className="pz-field">
          Hoặc dán FEN
          <span className="pz-fen-row">
            <input className="kv-input" value={fenText} onChange={(e) => setFenText(e.target.value)} placeholder="9/3Ca4/4ek3/9/… w" spellCheck={false} />
            <button type="button" className="kv-btn" onClick={loadFen} disabled={!fenText.trim()}>
              Nạp
            </button>
          </span>
        </label>
        <p className="pz-stat">
          Số quân: {count}/{MAX_PIECES}
        </p>
        {error && (
          <p className="kv-notice kv-error" role="alert">
            {error}
          </p>
        )}
        <div className="pz-actions">
          <button type="button" className="kv-btn kv-btn-primary" onClick={save} disabled={busy}>
            {busy ? "Đang kiểm tra…" : "Kiểm tra & lưu"}
          </button>
          <button type="button" className="kv-btn" onClick={() => setBoard(startBoard())} disabled={busy}>
            Xóa bàn
          </button>
          <button type="button" className="kv-btn" onClick={onCancel} disabled={busy}>
            Hủy
          </button>
        </div>
      </aside>
    </div>
  );
}
