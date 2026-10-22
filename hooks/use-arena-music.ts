"use client";
import { useCallback, useEffect, useRef, useState } from "react";
/** Locally synthesized, quiet pentatonic accompaniment; starts only on click. */
export function useArenaMusic() {
  const [music, setMusic] = useState(false);
  const context = useRef<AudioContext | null>(null),
    timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    void context.current?.close();
    context.current = null;
    setMusic(false);
  }, []);
  const toggle = useCallback(async () => {
    if (context.current) {
      stop();
      return;
    }
    try {
      const c = new AudioContext();
      context.current = c;
      await c.resume();
      let step = 0;
      const notes = [261.63, 329.63, 392, 440, 392, 329.63, 293.66, 329.63];
      const play = () => {
        if (c.state === "closed") return;
        const o = c.createOscillator(),
          g = c.createGain();
        o.type = "sine";
        o.frequency.value = notes[step++ % notes.length];
        g.gain.setValueAtTime(0, c.currentTime);
        g.gain.linearRampToValueAtTime(0.045, c.currentTime + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.8);
        o.connect(g);
        g.connect(c.destination);
        o.start();
        o.stop(c.currentTime + 2);
      };
      play();
      timer.current = setInterval(play, 900);
      setMusic(true);
    } catch {
      stop();
    }
  }, [stop]);
  useEffect(() => {
    const enabled = () => {
      try {
        return (
          JSON.parse(localStorage.getItem("kyvan.settings.v1") || "{}")
            .music === true
        );
      } catch {
        return false;
      }
    };
    const unlock = (e: Event) => {
      if ((e.target as HTMLElement)?.closest?.("button")) return;
      if (enabled() && !context.current) void toggle();
    };
    const sync = () => {
      if (!enabled()) stop();
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("storage", sync);
    window.addEventListener("kyvan-settings", sync);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("storage", sync);
      window.removeEventListener("kyvan-settings", sync);
    };
  }, [toggle, stop]);
  const toggleSaved = useCallback(async () => {
    const next = !context.current;
    try {
      const p = JSON.parse(localStorage.getItem("kyvan.settings.v1") || "{}");
      localStorage.setItem(
        "kyvan.settings.v1",
        JSON.stringify({ ...p, music: next }),
      );
    } catch {}
    await toggle();
  }, [toggle]);
  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      void context.current?.close();
    },
    [],
  );
  return { music, toggle: toggleSaved, stop };
}
