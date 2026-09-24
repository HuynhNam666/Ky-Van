import type {Board,Move,Side} from '@/lib/chess';
export const API=process.env.NEXT_PUBLIC_API_URL||'/api';
export type User={id:number;username:string};
export type Room={code:string;name:string;red_id:number;black_id:number|null;red_name:string;black_name:string|null;board:Board;turn:Side;history:Move[];status:string;winner?:Side|null;version:number};
export type Saved={id:string;name:string;date:string;board:Board;turn:Side;history:Move[];mode?:string};
export type Chat={username:string;text:string;time?:string};
export type Invite={id:number;code:string;sender:string};
export class ApiError extends Error{constructor(message:string,readonly status:number){super(message)}}
export async function api<T=unknown>(path:string,method='GET',body?:unknown):Promise<T>{
const r=await fetch(API+path,{method,credentials:'include',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}).catch(()=>{throw new ApiError('Không kết nối được máy chủ. Vui lòng thử lại.',0)});
const data=await r.json().catch(()=>({detail:'Máy chủ online chưa được kết nối.'})) as {detail?:unknown};
if(!r.ok)throw new ApiError(typeof data.detail==='string'?data.detail:'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.',r.status);
return data as T}
