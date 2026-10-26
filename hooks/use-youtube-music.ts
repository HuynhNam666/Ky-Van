"use client";
import {useEffect,useState,useCallback} from "react";
export function useYouTubeMusic(){
 const [music,setMusic]=useState(false);
 useEffect(()=>{const sync=()=>{try{setMusic(JSON.parse(localStorage.getItem("kyvan.settings.v1")||"{}").music===true)}catch{setMusic(false)}};sync();window.addEventListener("kyvan-settings",sync);window.addEventListener("storage",sync);return()=>{window.removeEventListener("kyvan-settings",sync);window.removeEventListener("storage",sync)}},[]);
 const toggle=useCallback(()=>window.dispatchEvent(new CustomEvent("kyvan-youtube-command",{detail:"toggle"})),[]);
 const stop=useCallback(()=>window.dispatchEvent(new CustomEvent("kyvan-youtube-command",{detail:"stop"})),[]);
 return {music,toggle,stop};
}
