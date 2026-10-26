"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {api,ApiError} from "@/lib/api";
import "../ban-be/features.css";

const KEY="kyvan.settings.v1";
type Prefs={music:boolean;sound:boolean;motion:boolean};
const DEFAULT:Prefs={music:false,sound:true,motion:true};
export default function SettingsPage(){
 const router=useRouter();const [prefs,setPrefs]=useState<Prefs>(DEFAULT);const [ready,setReady]=useState(false);
 useEffect(()=>{try{setPrefs({...DEFAULT,...JSON.parse(localStorage.getItem(KEY)||"{}")})}catch{}setReady(true);api("/auth/me").catch(e=>{if(e instanceof ApiError&&e.status===401)router.replace("/dang-nhap")})},[router]);
 function change(k:keyof Prefs,v:boolean){const next={...prefs,[k]:v};setPrefs(next);localStorage.setItem(KEY,JSON.stringify(next));document.documentElement.classList.toggle("kyvan-reduced-motion",next.motion===false);window.dispatchEvent(new CustomEvent("kyvan-settings",{detail:next}));}
 return <main className="feature-page"><header className="feature-header"><a href="/" className="feature-back">← Kỳ Viện</a><span>THIẾT LẬP KỲ CÁC</span><a href="/phong" className="feature-link">Phòng đấu</a></header><section className="feature-hero"><small>ĐIỀU CHỈNH TRẢI NGHIỆM</small><h1>Cài đặt</h1><p>Các lựa chọn được lưu trên trình duyệt này, dùng chung cho các tài khoản trên cùng trình duyệt.</p></section><section className="feature-card settings-card">
  {([["music","Nhạc nền","Nhạc nền nhẹ ở trang chủ và kỳ đài."],["sound","Âm thanh nước cờ","Âm thanh di chuyển, ăn quân và cảnh báo chiếu."],["motion","Hiệu ứng chuyển động","Giảm hoặc bật hiệu ứng giao diện."]] as [keyof Prefs,string,string][]).map(([key,title,desc])=><label className="setting-row" key={key}><span><b>{title}</b><small>{desc}</small></span><input type="checkbox" disabled={!ready} checked={prefs[key]} onChange={e=>change(key,e.target.checked)}/></label>)}
  <p className="room-note">Nhạc nền chỉ phát sau thao tác bật nhạc trên trang chủ để trình duyệt cho phép phát âm thanh.</p><a className="feature-link" href="/">Quay về trang chủ</a>
 </section></main>
}

