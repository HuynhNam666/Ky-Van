"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {useChessFeedback as useStandardFeedback} from "@/hooks/use-chess-feedback";
import {coupCheck} from "@/lib/coup-rules";
import type {Board,Move,Side} from "@/lib/chess";
type Feedback={id:number;kind:'move'|'capture'|'check'|'blocked';message:string;square:number;king:number};
export function useCoupAwareFeedback(board:Board,turn:Side,history:Move[],sound:boolean,gameKey:string,coup=false){
 const standard=useStandardFeedback(board,turn,history,sound&&!coup,gameKey);
 const [feedback,setFeedback]=useState<Feedback|null>(null);
 const prev=useRef({gameKey,count:history.length}),timer=useRef<ReturnType<typeof setTimeout>|null>(null),audio=useRef<AudioContext|null>(null),serial=useRef(0),enabled=useRef(sound);
 useEffect(()=>{enabled.current=sound},[sound]);
 useEffect(()=>{
  if(!coup)return;
  const unlock=()=>{if(!enabled.current)return;try{audio.current??=new AudioContext();void audio.current.resume().catch(()=>{})}catch{}};
  window.addEventListener('pointerdown',unlock);window.addEventListener('keydown',unlock);
  return()=>{window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock);if(timer.current)clearTimeout(timer.current);if(audio.current)void audio.current.close().catch(()=>{});audio.current=null}
 },[coup]);
 const tone=useCallback((kind:Feedback['kind'])=>{
  const ctx=audio.current;if(!enabled.current||!ctx||ctx.state!=='running')return;
  const notes=kind==='check'?[587,784,1175]:kind==='blocked'?[260,195]:kind==='capture'?[150,740]:[620];
  try{notes.forEach((hz,i)=>{const o=ctx.createOscillator(),g=ctx.createGain(),start=ctx.currentTime+i*.13;o.frequency.value=hz;g.gain.setValueAtTime(.0001,start);g.gain.exponentialRampToValueAtTime(.12,start+.01);g.gain.exponentialRampToValueAtTime(.0001,start+.18);o.connect(g);g.connect(ctx.destination);o.start(start);o.stop(start+.2);o.onended=()=>{o.disconnect();g.disconnect()}})}catch{}
 },[]);
 const show=useCallback((kind:Feedback['kind'],message:string,square:number,king:number)=>{if(timer.current)clearTimeout(timer.current);setFeedback({id:++serial.current,kind,message,square,king});timer.current=setTimeout(()=>setFeedback(null),kind==='move'?650:2200);tone(kind)},[tone]);
 useEffect(()=>{
  const old=prev.current;prev.current={gameKey,count:history.length};
  if(!coup)return;
  if(old.gameKey!==gameKey){setFeedback(null);return}
  if(history.length!==old.count+1)return;
  const last=history.at(-1);if(!last)return;
  const checked=coupCheck(board,turn),kind=checked?'check':last.captured?'capture':'move';
  show(kind,checked?`CHIẾU TƯỚNG · ${turn==='r'?'Đỏ':'Đen'} cần hóa giải!`:'',last.to,checked?board.indexOf(turn+'K'):-1);
 },[board,turn,history,gameKey,coup,show]);
 const warnExposedKing=useCallback((from:number)=>{const side=board[from]?.[0];show('blocked','Nước đi này làm Tướng của bạn bị chiếu!',from,board.indexOf(side+'K'))},[board,show]);
 return coup?{feedback,warnExposedKing}:standard;
}
