"use client";
import {useEffect,useMemo,useState} from "react";
import type {Board,Move} from "@/lib/chess";
import ReplayBoard from "./replay-board";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import "./journey.css";
export type Replay={code?:string;name?:string;variant:string;board:Board;history:(Move&{revealed?:string})[];turn?:string;red_name?:string;black_name?:string;mode?:string};
const piece=(p:unknown)=>p===null||typeof p==="string"&&/^[rb](K|A|E|H|R|C|P|U[AEHRCP])$/.test(p);
export function replayFrames(d:Replay):Board[]{
 if(!d||!Array.isArray(d.board)||d.board.length!==90||!d.board.every(piece)||!Array.isArray(d.history)||d.history.length>5000)throw Error("Biên bản không hợp lệ hoặc quá dài.");
 if(d.variant!=="coup"&&d.variant!=="xiangqi")throw Error("Loại cờ trong biên bản không hợp lệ.");
 for(const key of ["name","code","red_name","black_name","mode"] as const){if(d[key]!==undefined&&(typeof d[key]!=="string"||d[key]!.length>200))throw Error("Thông tin biên bản không hợp lệ.");}
 const current=[...d.board],out:Board[]=[[...current]];
 for(let i=d.history.length-1;i>=0;i--){const m=d.history[i];
  if(!m||!Number.isInteger(m.from)||!Number.isInteger(m.to)||m.from<0||m.from>89||m.to<0||m.to>89||m.from===m.to||!m.piece||!piece(m.piece)||!piece(m.captured??null)||(m.revealed!==undefined&&!piece(m.revealed)))throw Error("Biên bản chứa nước đi không hợp lệ.");
  if(current[m.to] !== (m.revealed??m.piece)||current[m.from]!==null)throw Error("Biên bản không khớp với bàn cờ cuối.");
  current[m.from]=m.piece;current[m.to]=m.captured??null;out.push([...current]);
 }return out.reverse();
}
export default function ReplayViewer({data,onClose}:{data:Replay;onClose:()=>void}){
 const [step,setStep]=useState(0),[play,setPlay]=useState(false),[speed,setSpeed]=useState(1),[flip,setFlip]=useState(false);
 const parsed=useMemo(()=>{try{return {frames:replayFrames(data),error:""}}catch(e){return {frames:[],error:(e as Error).message}}},[data]);
 const end=parsed.frames.length-1;
 useEffect(()=>{if(!play)return;const t=setInterval(()=>setStep(n=>{if(n>=end){setPlay(false);return n}return n+1}),1200/speed);return()=>clearInterval(t)},[play,end,speed]);
 return <Dialog open onOpenChange={open=>{if(!open)onClose()}}><DialogContent className="j-replay"><DialogTitle>Biên bản · {data.name||data.code||"Ván cờ"}</DialogTitle><DialogDescription>{data.red_name||"Quân Đỏ"} — {data.black_name||"Quân Đen"} · {data.variant==="coup"?"Cờ úp":"Cờ tướng"}</DialogDescription>{parsed.error?<p role="alert">{parsed.error}</p>:<><div className="j-replay-board"><ReplayBoard game={{board:parsed.frames[Math.min(step,end)],history:data.history.slice(0,step),turn:step%2?"b":"r",variant:data.variant}} flipped={flip}/></div><div className="j-replay-progress"><span>Nước {step} / {end}</span><input aria-label="Tua đến nước đi" type="range" min="0" max={Math.max(0,end)} value={step} onChange={e=>{setPlay(false);setStep(Number(e.target.value))}}/></div><div className="j-controls"><button onClick={()=>{setPlay(false);setStep(0)}} aria-label="Về đầu">|◀</button><button onClick={()=>{setPlay(false);setStep(n=>Math.max(0,n-1))}} aria-label="Nước trước">◀</button><button onClick={()=>{if(step===end)setStep(0);setPlay(!play)}}>{play?"Tạm dừng":"Phát lại"}</button><button onClick={()=>{setPlay(false);setStep(n=>Math.min(end,n+1))}} aria-label="Nước sau">▶</button><button onClick={()=>{setPlay(false);setStep(end)}} aria-label="Đến cuối">▶|</button><select aria-label="Tốc độ phát" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select><button onClick={()=>setFlip(!flip)}>Đảo bàn</button></div><p className="j-note">Biên bản phát lại từng nước, không phải MP4. Quân úp chỉ lật từ thời điểm đã được mở trong ván.</p></>}</DialogContent></Dialog>
}
