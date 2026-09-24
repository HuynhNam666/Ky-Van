'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {API,api,ApiError} from '@/lib/api';
import type {Chat,Room} from '@/lib/api';
import type {Signal} from '@/hooks/use-call';
export type SocketEvents={state:Room;chat:Chat;messages:Chat[];error:string;signal:Signal;presence:number[];auth:null};
export type RoomSocket=ReturnType<typeof useRoomSocket>;
/** One WebSocket per room: ticket auth, reconnect, heartbeat. Server close code 4001 = "opened in another tab", never retried. */
export function useRoomSocket(code:string|undefined,userId:number|undefined){
const ws=useRef<WebSocket|null>(null),listeners=useRef(new Map<string,Set<(value:never)=>void>>());
const [connected,setConnected]=useState(false),[replaced,setReplaced]=useState(false),[attempt,setAttempt]=useState(0);
const send=useCallback((message:unknown)=>{const s=ws.current;if(s?.readyState!==WebSocket.OPEN)return false;s.send(JSON.stringify(message));return true},[]);
const on=useCallback(<K extends keyof SocketEvents>(type:K,fn:(value:SocketEvents[K])=>void)=>{
let set=listeners.current.get(type);if(!set)listeners.current.set(type,set=new Set());set.add(fn);return()=>{set.delete(fn)}},[]);
const emit=useCallback(<K extends keyof SocketEvents>(type:K,value:SocketEvents[K])=>{listeners.current.get(type)?.forEach(fn=>fn(value as never))},[]);
const reconnect=useCallback(()=>{setReplaced(false);setAttempt(a=>a+1)},[]);
useEffect(()=>{
if(!code||!userId)return;
let closed=false,timer:ReturnType<typeof setTimeout>|undefined,beat:ReturnType<typeof setInterval>|undefined,sock:WebSocket|undefined;
async function connect(){
try{
const {ticket}=await api<{ticket:string}>('/ws-ticket','POST');
if(closed)return;
const url=new URL(API,location.origin);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.pathname=url.pathname.replace(/\/$/,'')+'/ws/'+code;url.search='ticket='+ticket;
const s=new WebSocket(url);sock=s;ws.current=s;
s.onopen=()=>{setConnected(true);setReplaced(false);beat=setInterval(()=>{if(s.readyState===WebSocket.OPEN)s.send('{"type":"ping"}')},20000)};
s.onclose=e=>{clearInterval(beat);if(closed)return;setConnected(false);if(e.code===4001){closed=true;setReplaced(true);return}timer=setTimeout(connect,2500)};
s.onmessage=e=>{
let d:{type:string;[k:string]:unknown};try{d=JSON.parse(e.data)}catch{return}
if(d.type==='state')emit('state',d.room as Room);
else if(d.type==='chat')emit('chat',d.message as Chat);
else if(d.type==='messages')emit('messages',d.messages as Chat[]);
else if(d.type==='error')emit('error',d.message as string);
else if(d.type==='signal')emit('signal',d.data as Signal);
else if(d.type==='presence')emit('presence',d.online as number[])}
}catch(e){
if(closed)return;
if(e instanceof ApiError&&e.status===401){closed=true;emit('auth',null);return}
timer=setTimeout(connect,4000)}}
connect();
return()=>{closed=true;clearTimeout(timer);clearInterval(beat);sock?.close();if(ws.current===sock)ws.current=null;setConnected(false)}
},[code,userId,attempt,emit]);
return {connected,replaced,send,on,reconnect}}
