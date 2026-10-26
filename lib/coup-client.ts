"use client";
import {useEffect,useState} from "react";
import {api as baseApi,type Room} from "@/lib/api";
import {names,vn} from "@/lib/chess";
export type VariantRoom=Room & {variant?:'coup'|'xiangqi'};
export const coupNames:Record<string,string>={...names};
for(const side of ['r','b'])for(const role of 'AEHRCP')coupNames[side+'U'+role]='暗';
export const coupVn:Record<string,string>={...vn,U:'Quân úp'};
export function useCoupMode(room:Room|null){const [requested,setRequested]=useState(false);useEffect(()=>{setRequested(new URLSearchParams(location.search).get('variant')==='coup')},[]);return room?(room as VariantRoom).variant==='coup':requested}
export const coupArenaApi:typeof baseApi=(path,method='GET',body)=>{
 const coup=typeof window!=='undefined'&&new URLSearchParams(location.search).get('variant')==='coup';
 return baseApi((coup&&path.startsWith('/matchmaking/'))?'/coup'+path:path,method,body);
};
export function roomVariantApi(variant:'coup'|'xiangqi'):typeof baseApi{return (path,method='GET',body)=>baseApi(variant==='coup'&&path==='/rooms'&&method==='POST'?'/coup/rooms':path,method,body)}
