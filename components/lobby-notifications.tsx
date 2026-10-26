"use client";
import {useEffect,useState} from "react";
import {api,sessionToken} from "@/lib/api";
type Invitation={id:number;code:string;sender:string;stake:number;total_seconds:number;move_seconds:number};
export default function LobbyNotifications(){
 const [items,setItems]=useState<Invitation[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{let live=true;const poll=async()=>{if(!sessionToken()){if(live)setItems([]);return}try{const rows=await api<Invitation[]>("/invitations");if(live)setItems(rows)}catch{}};void poll();const t=setInterval(()=>void poll(),10000);return()=>{live=false;clearInterval(t)}},[]);
 const item=items[0];if(!item)return null;
 async function decide(accept:boolean){if(!item)return;setBusy(true);setError("");try{if(accept){await api("/rooms/"+item.code+"/join","POST",{});location.assign("/ghep-tran?room="+item.code)}else{await api("/invitations/"+item.id,"DELETE");setItems(v=>v.filter(x=>x.id!==item.id))}}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <aside role="status" className="lobby-invite"><b>{item.sender} mời bạn đấu cờ</b><p>Phòng {item.code} · {item.stake} xu/người</p><p>{item.total_seconds/60} phút/người · {item.move_seconds}s/lượt</p><small>Chấp nhận sẽ giữ xu và bắt đầu trận.</small>{error&&<p role="alert">{error}</p>}<div><button disabled={busy} onClick={()=>void decide(true)}>Chấp nhận</button><button disabled={busy} onClick={()=>void decide(false)}>Từ chối</button><a href="/ban-be">Bạn bè</a></div></aside>
}
