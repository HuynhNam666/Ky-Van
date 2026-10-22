"use client";
// --- CODE CU GIU NGUYEN DE DOI CHIEU; KHONG THUC THI ---
// ORIGINAL | "use client";
// ORIGINAL | import {useEffect} from "react";
// ORIGINAL | import {api} from "@/lib/api";
// ORIGINAL | export default function PresenceHeartbeat(){
// ORIGINAL |   useEffect(()=>{
// ORIGINAL |     let alive=true;
// ORIGINAL |     const beat=()=>{if(alive&&!document.hidden)void api("/presence/heartbeat","POST",{}).catch(()=>{})};
// ORIGINAL |     beat();const timer=setInterval(beat,20000);
// ORIGINAL |     const visible=()=>{if(!document.hidden)beat()};
// ORIGINAL |     document.addEventListener("visibilitychange",visible);
// ORIGINAL |     return()=>{alive=false;clearInterval(timer);document.removeEventListener("visibilitychange",visible)};
// ORIGINAL |   },[]);
// ORIGINAL |   return null;
// ORIGINAL | }
// --- CODE CAP NHAT DANG SU DUNG ---
import { useEffect } from "react";
import { api, sessionToken } from "@/lib/api";
export default function PresenceHeartbeat() {
  useEffect(() => {
    let alive = true,
      inFlight = false;
    const beat = async () => {
      if (!alive || inFlight || document.hidden || !sessionToken()) return;
      inFlight = true;
      try {
        await api("/presence/heartbeat", "POST", {});
      } catch {
        /* A network/database failure must not log the player out. */
      } finally {
        inFlight = false;
      }
    };
    void beat();
    const timer = setInterval(() => void beat(), 20000);
    const visible = () => {
      if (!document.hidden) void beat();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  return null;
}
