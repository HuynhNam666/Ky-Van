import type { Metadata } from "next";
export const metadata: Metadata = {title:"Luyện với máy · Kỳ Viện",description:"Phòng luyện cờ tướng với bốn mức độ và sổ ván đấu."};
export default function TrainingPage(){return <iframe title="Phòng luyện cờ tướng" src="/ky-training/index.html" style={{position:"fixed",inset:0,width:"100%",height:"100dvh",border:0,background:"#f1eee5",zIndex:50}}/>}
