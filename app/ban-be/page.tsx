"use client";

import {useCallback, useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import {api, ApiError} from "@/lib/api";
import "./features.css";

type Friend={id:number;username:string;online:boolean};
type Request={id:number;user_id:number;username:string;created_at:number};
type SearchUser=Friend&{status:"friend"|"sent"|"received"|"none"};

export default function FriendsPage(){
  const router=useRouter();
  const [friends,setFriends]=useState<Friend[]>([]);
  const [incoming,setIncoming]=useState<Request[]>([]);
  const [outgoing,setOutgoing]=useState<Request[]>([]);
  const [query,setQuery]=useState("");
  const [results,setResults]=useState<SearchUser[]>([]);
  const [roomCodes,setRoomCodes]=useState<Record<number,string>>({});
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const reload=useCallback(async()=>{
    try{
      const [f,r]=await Promise.all([
        api<Friend[]>("/friends"),
        api<{incoming:Request[];outgoing:Request[]}>("/friends/requests")
      ]);
      setFriends(f);setIncoming(r.incoming);setOutgoing(r.outgoing);setError("");
    }catch(e){if(e instanceof ApiError&&e.status===401){router.replace("/dang-nhap");return}setError((e as Error).message)}
  },[router]);
  useEffect(()=>{void reload();const t=setInterval(()=>void reload(),10000);return()=>clearInterval(t)},[reload]);
  async function search(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");try{setResults(await api<SearchUser[]>("/friends/search?q="+encodeURIComponent(query.trim())))}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  async function send(username:string){setBusy(true);try{await api("/friends/requests","POST",{username});await reload();if(query)await search(new Event("submit") as unknown as React.FormEvent)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  async function decide(id:number,action:"accept"|"reject"){setBusy(true);try{await api("/friends/requests/"+action,"POST",{request_id:id});await reload()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  async function invite(friend:Friend){let code:string|undefined=roomCodes[friend.id]?.trim().toUpperCase();setBusy(true);try{if(!code){const mine=await api<Array<{code:string;status:string;red_id:number}>>("/rooms/mine");const me=await api<{id:number}>("/auth/me");code=mine.find(r=>r.status==="waiting"&&r.red_id===me.id)?.code;if(!code)code=(await api<{code:string}>("/rooms","POST",{name:"Giao hữu · "+friend.username,stake:100,total_seconds:900,move_seconds:60})).code;setRoomCodes(v=>({...v,[friend.id]:code!}));}await api("/rooms/"+encodeURIComponent(code)+"/invite","POST",{username:friend.username});router.push("/ghep-tran?room="+code)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  return <main className="feature-page"><header className="feature-header"><a href="/" className="feature-back">← Kỳ Viện</a><span>BẰNG HỮU · KẾT GIAO</span><a href="/phong" className="feature-link">Tạo / tìm phòng</a></header>
    <section className="feature-hero"><small>KỲ HỮU CÙNG KỲ ĐẠO</small><h1>Bằng hữu</h1><p>Tìm kỳ thủ, quản lý lời mời kết bạn và mời bạn đang trực tuyến vào phòng cờ.</p></section>
    <form className="feature-search" onSubmit={search}><input value={query} onChange={e=>setQuery(e.target.value)} minLength={3} placeholder="Tìm bằng tên đăng nhập, ví dụ quangtinh" /><button disabled={busy||query.trim().length<3}>Tìm kỳ thủ</button></form>
    {error&&<p className="feature-message" role="status">{error}</p>}
    {results.length>0&&<section className="feature-card"><h2>Kết quả tìm kiếm</h2>{results.map(x=><div className="feature-row" key={x.id}><div className="feature-avatar">{x.username[0]?.toUpperCase()}<i className={x.online?"online":""}/></div><div className="feature-grow"><b>{x.username}</b><small>{x.online?"Đang trực tuyến":"Ngoại tuyến"}</small></div>{x.status==="none"?<button onClick={()=>void send(x.username)} disabled={busy}>＋ Kết bạn</button>:<span className="feature-muted">{x.status==="friend"?"Đã là bạn":x.status==="sent"?"Đã gửi yêu cầu":"Đã gửi yêu cầu cho bạn"}</span>}</div>)}</section>}
    <section className="feature-card"><div className="feature-title"><h2>Yêu cầu kết bạn</h2><b>{incoming.length}</b></div>{incoming.length?incoming.map(x=><div className="feature-row" key={x.id}><div className="feature-avatar">{x.username[0]?.toUpperCase()}</div><div className="feature-grow"><b>{x.username}</b><small>Muốn kết bạn với bạn</small></div><button onClick={()=>void decide(x.id,"accept")} disabled={busy}>Chấp nhận</button><button className="feature-secondary" onClick={()=>void decide(x.id,"reject")} disabled={busy}>Từ chối</button></div>):<p className="feature-muted">Chưa có yêu cầu mới.</p>}</section>
    <section className="feature-card"><div className="feature-title"><h2>Bạn bè của bạn</h2><b>{friends.length}</b></div>{friends.length?friends.map(f=><div className="feature-row" key={f.id}><div className="feature-avatar">{f.username[0]?.toUpperCase()}<i className={f.online?"online":""}/></div><div className="feature-grow"><b>{f.username}</b><small className={f.online?"feature-online":""}>{f.online?"Đang trực tuyến":"Ngoại tuyến"}</small></div>{f.online&&<div className="feature-invite"><input value={roomCodes[f.id]||""} onChange={e=>setRoomCodes(v=>({...v,[f.id]:e.target.value}))} placeholder="Mã phòng (bỏ trống: bàn 100 xu)"/><button onClick={()=>void invite(f)} disabled={busy}>Mời đấu</button></div>}<button className="feature-secondary" onClick={async()=>{if(!confirm("Xóa "+f.username+" khỏi danh sách bạn bè?"))return;try{await api("/friends/"+f.id,"DELETE");await reload()}catch(e){setError((e as Error).message)}}}>Xóa</button></div>):<p className="feature-muted">Bạn chưa kết bạn với ai. Hãy tìm một kỳ thủ ở phía trên.</p>}</section>
    <section className="feature-card"><h2>Đã gửi</h2>{outgoing.length?outgoing.map(x=><div className="feature-row" key={x.id}><div className="feature-avatar">{x.username[0]?.toUpperCase()}</div><div className="feature-grow"><b>{x.username}</b><small>Đang chờ xác nhận</small></div></div>):<p className="feature-muted">Không có lời mời đang chờ.</p>}</section>
  </main>
}

