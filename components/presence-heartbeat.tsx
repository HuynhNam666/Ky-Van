"use client";
import {useEffect} from "react";
import {api} from "@/lib/api";
export default function PresenceHeartbeat(){
  useEffect(()=>{
    let alive=true;
    const beat=()=>{if(alive&&!document.hidden)void api("/presence/heartbeat","POST",{}).catch(()=>{})};
    beat();const timer=setInterval(beat,20000);
    const visible=()=>{if(!document.hidden)beat()};
    document.addEventListener("visibilitychange",visible);
    return()=>{alive=false;clearInterval(timer);document.removeEventListener("visibilitychange",visible)};
  },[]);
  return null;
}
