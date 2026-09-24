'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {toast} from 'sonner';
import {api} from '@/lib/api';
import type {RoomSocket} from '@/hooks/use-room-socket';
export type Signal={kind:'offer'|'answer'|'ice'|'hangup'|'busy';sdp?:RTCSessionDescriptionInit;candidate?:RTCIceCandidateInit};
function mediaError(e:unknown){
const name=e instanceof DOMException?e.name:'';
if(name==='NotAllowedError'||name==='SecurityError')return 'Bạn chưa cấp quyền camera/micro cho trình duyệt.';
if(name==='NotFoundError')return 'Không tìm thấy camera hoặc micro trên thiết bị.';
if(name==='NotSupportedError')return 'Trình duyệt chỉ cho phép camera/micro trên HTTPS (hoặc localhost).';
return 'Chưa mở được camera/micro. Hãy kiểm tra quyền truy cập.'}
/** Camera+mic; without a camera fall back to voice only (the peer's video is still received). */
async function getMedia(){
if(!navigator.mediaDevices?.getUserMedia)throw new DOMException('Insecure context','NotSupportedError');
try{return {media:await navigator.mediaDevices.getUserMedia({video:true,audio:true}),voiceOnly:false}}
catch(e){
if(e instanceof DOMException&&['NotFoundError','NotReadableError','OverconstrainedError'].includes(e.name))return {media:await navigator.mediaDevices.getUserMedia({audio:true}),voiceOnly:true};
throw e}}
/** WebRTC call between the two players of a room; signalling travels over the room socket. */
export function useCall(send:RoomSocket['send'],on:RoomSocket['on'],canCall:boolean){
const pc=useRef<RTCPeerConnection|null>(null),stream=useRef<MediaStream|null>(null),remote=useRef<MediaStream|null>(null),offer=useRef<RTCSessionDescriptionInit|null>(null),ice=useRef<RTCIceCandidateInit[]>([]);
const localVideo=useRef<HTMLVideoElement|null>(null),remoteVideo=useRef<HTMLVideoElement|null>(null);
const [calling,setCalling]=useState(false),[incoming,setIncoming]=useState(false),[ready,setReady]=useState(false),[muted,setMuted]=useState(false),[camOff,setCamOff]=useState(false),[voiceOnly,setVoiceOnly]=useState(false);
const signal=useCallback((data:Signal)=>send({type:'signal',data}),[send]);
const stop=useCallback((notify=true)=>{
if(notify)signal({kind:'hangup'});
pc.current?.close();pc.current=null;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;remote.current=null;offer.current=null;ice.current=[];
setCalling(false);setIncoming(false);setReady(false);setMuted(false);setCamOff(false);setVoiceOnly(false)},[signal]);
const setup=useCallback(async()=>{
const {media,voiceOnly:voice}=await getMedia();stream.current=media;setVoiceOnly(voice);setCalling(true);
const peer=new RTCPeerConnection(await api<RTCConfiguration>('/rtc-config'));pc.current=peer;
media.getTracks().forEach(t=>peer.addTrack(t,media));
if(voice)peer.addTransceiver('video',{direction:'recvonly'});
peer.ontrack=e=>{remote.current=e.streams[0];setReady(true);if(remoteVideo.current)remoteVideo.current.srcObject=e.streams[0]};
peer.onicecandidate=e=>{if(e.candidate)signal({kind:'ice',candidate:e.candidate.toJSON()})};
peer.onconnectionstatechange=()=>{if(peer.connectionState==='failed'){toast.error('Không thể kết nối cuộc gọi. Kiểm tra cấu hình TURN của máy chủ.');stop()}};
return peer},[signal,stop]);
const start=useCallback(async()=>{
if(!canCall){toast.info('Video call khả dụng khi hai người đã vào phòng.');return}
let offered=false;
try{const peer=await setup();const o=await peer.createOffer();await peer.setLocalDescription(o);offered=signal({kind:'offer',sdp:o});if(!offered)throw new Error('socket')}
catch(e){stop(offered);toast.error(mediaError(e))}},[canCall,setup,signal,stop]);
const accept=useCallback(async()=>{
try{
const peer=await setup();await peer.setRemoteDescription(offer.current!);
for(const c of ice.current)await peer.addIceCandidate(c);ice.current=[];
const answer=await peer.createAnswer();await peer.setLocalDescription(answer);signal({kind:'answer',sdp:answer});setIncoming(false)
}catch(e){stop();toast.error(e instanceof DOMException?mediaError(e):'Không thể nhận cuộc gọi.')}},[setup,signal,stop]);
const toggle=useCallback((kind:'audio'|'video')=>{
const tracks=stream.current?.getTracks().filter(t=>t.kind===kind)??[];if(!tracks.length)return;
const enable=!tracks[0].enabled;tracks.forEach(t=>{t.enabled=enable});(kind==='audio'?setMuted:setCamOff)(!enable)},[]);
useEffect(()=>on('signal',async s=>{
try{
if(s.kind==='offer'){if(pc.current){signal({kind:'busy'});return}offer.current=s.sdp!;setIncoming(true)}
else if(s.kind==='answer'&&pc.current){await pc.current.setRemoteDescription(s.sdp!);for(const c of ice.current)await pc.current.addIceCandidate(c);ice.current=[]}
else if(s.kind==='ice'){if(pc.current?.remoteDescription)await pc.current.addIceCandidate(s.candidate!);else ice.current.push(s.candidate!)}
else if(s.kind==='hangup'||s.kind==='busy'){stop(false);toast.info(s.kind==='busy'?'Đối phương đang bận.':'Cuộc gọi đã kết thúc.')}
}catch{toast.error('Không thể thiết lập cuộc gọi.');stop()}}),[on,signal,stop]);
useEffect(()=>{if(!calling)return;if(localVideo.current)localVideo.current.srcObject=stream.current;if(remoteVideo.current)remoteVideo.current.srcObject=remote.current},[calling,ready]);
useEffect(()=>()=>stop(false),[stop]);
return {calling,incoming,ready,muted,camOff,voiceOnly,localVideo,remoteVideo,start,accept,stop,toggle}}
