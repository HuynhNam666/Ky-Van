"use client";
import {useEffect} from "react";
import "@/components/coup.css";
export default function CoupEntry(){useEffect(()=>{location.replace('/ghep-tran?variant=coup')},[]);return <main className="coup-entry"><h1>Cờ úp · Kỳ Viện</h1><p>Đang chuyển đến hàng chờ cờ úp…</p><a href="/ghep-tran?variant=coup">Vào ghép trận cờ úp</a></main>}
