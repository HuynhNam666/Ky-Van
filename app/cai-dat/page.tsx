"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {api,ApiError} from "@/lib/api";
import KvTopbar from "@/components/kv-topbar";
import "../ban-be/features.css";

const KEY="kyvan.settings.v1";
type Prefs={music:boolean;sound:boolean;motion:boolean};
const DEFAULT:Prefs={music:false,sound:true,motion:true};
export default function SettingsPage(){
 const router=useRouter();const [prefs,setPrefs]=useState<Prefs>(DEFAULT);const [ready,setReady]=useState(false);
 useEffect(()=>{try{setPrefs({...DEFAULT,...JSON.parse(localStorage.getItem(KEY)||"{}")})}catch{}setReady(true);api("/auth/me").catch(e=>{if(e instanceof ApiError&&e.status===401)router.replace("/dang-nhap")})},[router]);
 function change(k:keyof Prefs,v:boolean){const next={...prefs,[k]:v};setPrefs(next);localStorage.setItem(KEY,JSON.stringify(next));document.documentElement.classList.toggle("kyvan-reduced-motion",next.motion===false);window.dispatchEvent(new CustomEvent("kyvan-settings",{detail:next}));}
 return <main className="feature-page kv-page"><KvTopbar title="Thiết lập Kỳ Các" current="/cai-dat"/><section className="feature-hero"><h1>Cài đặt</h1></section><section className="feature-card settings-card">
  {([["music","Nhạc nền"],["sound","Âm thanh nước cờ"],["motion","Hiệu ứng chuyển động"]] as [keyof Prefs,string][]).map(([key,title])=><label className="setting-row" key={key}><span><b>{title}</b></span><input type="checkbox" disabled={!ready} checked={prefs[key]} onChange={e=>change(key,e.target.checked)}/></label>)}
  <a className="kv-btn kv-btn-primary" href="/">Quay về trang chủ</a>
 </section></main>
}

