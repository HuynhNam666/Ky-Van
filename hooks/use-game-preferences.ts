"use client";
import {useEffect} from "react";
export function useGamePreferences(setSound:(value:boolean)=>void){
 useEffect(()=>{const load=()=>{try{const p=JSON.parse(localStorage.getItem("kyvan.settings.v1")||"{}");setSound(p.sound!==false);document.documentElement.classList.toggle("kyvan-reduced-motion",p.motion===false)}catch{}};load();window.addEventListener("kyvan-settings",load);window.addEventListener("storage",load);return()=>{window.removeEventListener("kyvan-settings",load);window.removeEventListener("storage",load)}},[setSound]);
}
