"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { check, moved, type Board, type Move, type Side } from "@/lib/chess";

type Sound = "move" | "capture" | "check" | "blocked";
type Feedback = {
  id: number;
  kind: Sound;
  message: string;
  square: number;
  king: number;
};

export function useChessFeedback(
  board: Board,
  turn: Side,
  history: Move[],
  sound: boolean,
  gameKey: string,
) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const context = useRef<AudioContext | null>(null);
  const enabled = useRef(sound);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serial = useRef(0);
  const previous = useRef({ board, history, gameKey });

  useEffect(() => {
    enabled.current = sound;
  }, [sound]);

  // Unlock audio during a real user interaction, including online play.
  useEffect(() => {
    function unlock() {
      if (!enabled.current) return;
      try {
        context.current ??= new AudioContext();
        if (context.current.state === "suspended")
          void context.current.resume().catch(() => {});
      } catch {
        /* Visual feedback remains available without audio. */
      }
    }
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      if (timer.current) clearTimeout(timer.current);
      if (context.current) void context.current.close().catch(() => {});
      context.current = null;
    };
  }, []);

  const play = useCallback((kind: Sound, delay = 0) => {
    const a = context.current;
    if (!enabled.current || !a || a.state !== "running") return;
    // Short synthesized sounds: no MP3 downloads or extra packages.
    const notes: Record<Sound, number[][]> = {
      // Tiếng đi quân: gõ ngắn, rõ hơn.
      move: [
        [620, 0, 0.1, 0.22],
        [230, 0.015, 0.13, 0.14],
      ],

      // Tiếng ăn quân: mạnh và ngân dài hơn tiếng đi.
      capture: [
        [150, 0, 0.24, 0.48],
        [740, 0.03, 0.2, 0.28],
        [1100, 0.11, 0.28, 0.24],
      ],

      // Tiếng chiếu tướng.
      check: [
        [587, 0, 0.2, 0.25],
        [784, 0.2, 0.2, 0.25],
        [1175, 0.4, 0.32, 0.28],
      ],

      // Tiếng cảnh báo nước đi làm lộ Tướng.
      blocked: [
        [260, 0, 0.16, 0.22],
        [195, 0.17, 0.2, 0.2],
      ],
    };
    try {
      for (const [frequency, offset, duration, volume] of notes[kind]) {
        const start = a.currentTime + delay + offset;
        const oscillator = a.createOscillator();
        const gain = a.createGain();
        oscillator.type = kind === "blocked" ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(frequency, start);
        if (kind === "move" || kind === "capture")
          oscillator.frequency.exponentialRampToValueAtTime(
            frequency * 0.55,
            start + duration,
          );
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(volume, start + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        oscillator.connect(gain);
        gain.connect(a.destination);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.02);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
      }
    } catch {
      /* Do not interrupt a move when audio is unavailable. */
    }
  }, []);

  const show = useCallback(
    (kind: Sound, message: string, square: number, king: number) => {
      if (timer.current) clearTimeout(timer.current);
      setFeedback({ id: ++serial.current, kind, message, square, king });
      timer.current = setTimeout(
        () => setFeedback(null),
        kind === "move" ? 650 : 2200,
      );
    },
    [],
  );

  useEffect(() => {
    const old = previous.current;
    previous.current = { board, history, gameKey };
    const last = history[history.length - 1];
    // Ignore initial loads, undo, room changes and repeated socket snapshots.
    const isMove =
      old.gameKey === gameKey &&
      last &&
      history.length === old.history.length + 1 &&
      JSON.stringify(history.slice(0, -1)) === JSON.stringify(old.history) &&
      old.board[last.from] === last.piece &&
      old.board[last.to] === last.captured &&
      JSON.stringify(moved(old.board, last.from, last.to)) ===
        JSON.stringify(board);
    if (!isMove) {
      if (
        old.gameKey !== gameKey ||
        JSON.stringify(old.board) !== JSON.stringify(board)
      ) {
        if (timer.current) clearTimeout(timer.current);
        const frame = requestAnimationFrame(() => setFeedback(null));
        return () => cancelAnimationFrame(frame);
      }
      return;
    }
    const isCheck = check(board, turn);
    play(last.captured ? "capture" : "move");
    if (isCheck) play("check", 0.19);
    const kind = isCheck ? "check" : last.captured ? "capture" : "move";
    const message = isCheck
      ? `CHIẾU TƯỚNG · ${turn === "r" ? "Đỏ" : "Đen"} cần hóa giải!`
      : "";
    const frame = requestAnimationFrame(() =>
      show(kind, message, last.to, isCheck ? board.indexOf(turn + "K") : -1),
    );
    return () => cancelAnimationFrame(frame);
  }, [board, history, turn, gameKey, play, show]);

  const warnExposedKing = useCallback(
    (from: number) => {
      const side = board[from]?.[0];
      show(
        "blocked",
        "Nước này khiến Tướng của bạn bị chiếu. Hãy chọn nước khác.",
        from,
        board.indexOf(side + "K"),
      );
      play("blocked");
    },
    [board, play, show],
  );

  return { feedback, warnExposedKing };
}
