"use client";
import {useCallback,useEffect,useState} from "react";
import {api,ApiError} from "@/lib/api";
import {Coins,Gift,Check,Star,Clock,Swords,BookOpen} from "lucide-react";
import KvTopbar from "@/components/kv-topbar";
import "./quests.css";
type Task={id:string;title:string;target:number;progress:number;reward:number;claimed:boolean};
type Economy={coins:number;points:number;held:number;day:string;resets_at:string;tasks:Task[];puzzle:{question:string;choices:string[]}};
export default function Quests(){
 const [data,setData]=useState<Economy|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[answer,setAnswer]=useState("");
 const report=useCallback((e:unknown)=>{if(e instanceof ApiError&&e.status===401){location.replace('/dang-nhap');return}setError(e instanceof Error?e.message:'Chưa tải được dữ liệu.');},[]);
 const load=useCallback(async()=>{try{setData(await api<Economy>('/economy'));setError('')}catch(e){report(e)}},[report]);
 useEffect(()=>{void load();const id=setInterval(()=>{if(!document.hidden)void load()},30000);const focus=()=>{if(!document.hidden)void load()};document.addEventListener('visibilitychange',focus);return()=>{clearInterval(id);document.removeEventListener('visibilitychange',focus)}},[load]);
 async function submit(path:string,body:unknown){if(busy)return;setBusy(true);setError('');try{setData(await api<Economy>(path,'POST',body))}catch(e){report(e)}finally{setBusy(false)}}
 return <main className="quest-page kv-page"><div className="quest-shell">
  <KvTopbar title="Phòng thưởng" current="/nhiem-vu"/>
  <div className="quest-intro"><h1>Gom xu. Khai cuộc.</h1></div>
  {error&&<div className="quest-error" role="alert">{error}<button onClick={()=>void load()}>Tải lại</button></div>}
  {!data?<p role="status">Đang tải ví và nhiệm vụ…</p>:<>
   <section className="quest-wallet"><div><Coins/><small>XU MIỄN PHÍ</small><strong>{data.coins.toLocaleString('vi-VN')}</strong><span>{data.held.toLocaleString('vi-VN')} xu đang giữ tại bàn</span></div><div><Star/><small>ĐIỂM NHIỆM VỤ</small><strong>{data.points.toLocaleString('vi-VN')}</strong><span>Mỗi nhiệm vụ đã nhận: +1 điểm</span></div><div><Gift/><small>QUÀ TÂN THỦ</small><strong>1.000 xu</strong><span>Tặng một lần cho mỗi tài khoản</span></div></section>
   <div className="quest-section-title"><div><h2>Nhiệm vụ hôm nay</h2><p><Clock size={14}/> Ngày {data.day} · {data.tasks.filter(t=>t.claimed).length}/{data.tasks.length} đã nhận</p></div><a className="quest-play" href="/ghep-tran"><Swords size={17}/>Tìm trận</a></div>
   <div className="quest-grid">{data.tasks.map(t=><article key={data.day+t.id} className={t.claimed?'claimed':''}><div className="quest-task-top"><span>{t.claimed?<Check size={18}/>:<Gift size={18}/>}</span><b>+{t.reward} xu</b></div><h3>{t.title}</h3><div className="quest-meter" role="progressbar" aria-label={t.title} aria-valuenow={t.progress} aria-valuemin={0} aria-valuemax={t.target}><i style={{width:`${Math.min(100,t.progress/t.target*100)}%`}}/></div><p>{t.progress}/{t.target} hoàn thành</p>
    {t.id==='rules'&&!t.claimed&&t.progress<t.target&&<details><summary><BookOpen size={14}/>Đọc luật tính xu</summary><p>Tân thủ nhận 1.000 xu. Mức bàn theo số dư thấp hơn: dưới 5.000 xu → 100 xu/người; từ 5.000 → 250; từ 10.000 → 500; từ 25.000 → 1.000. Hai bên giữ xu khi ghép. Thắng nhận toàn bộ bàn; hòa/hủy trước khai cuộc được hoàn lại. Xin thua, rời trận hoặc hết giờ sau khi bắt đầu sẽ mất mức xu đã giữ. Đây là xu giải trí, không nạp/rút hay đổi tiền.</p><button disabled={busy} onClick={()=>void submit('/economy/action',{action:'rules'})}>Đã đọc và hiểu</button></details>}
    {t.id==='puzzle'&&!t.claimed&&t.progress<t.target&&<div className="quest-puzzle"><p>{data.puzzle.question}</p><label>Chọn nước đi<select value={answer} onChange={e=>setAnswer(e.target.value)}><option value="">Chọn ô đến</option>{data.puzzle.choices.map(c=><option key={c}>{c}</option>)}</select></label><button disabled={busy||!answer} onClick={()=>void submit('/economy/action',{action:'puzzle',answer})}>Kiểm tra</button></div>}
    <button className="quest-claim" disabled={busy||t.claimed||t.progress<t.target} onClick={()=>void submit('/economy/claim',{day:data.day,task_id:t.id})}>{t.claimed?'Đã nhận thưởng':t.progress>=t.target?'Nhận '+t.reward+' xu':'Đang thực hiện'}</button>
   </article>)}</div>
   
  </>}
 </div></main>
}
