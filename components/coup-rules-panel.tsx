"use client";
import {names,type Move} from "@/lib/chess";
import "./coup.css";
export default function CoupRulesPanel({active,last}:{active:boolean;last?:Move}){
 if(!active)return null;
 const revealed=(last as (Move & {revealed?:string})|undefined)?.revealed;
 return <aside className="coup-panel"><div><strong>暗 CỜ ÚP</strong><span>Xáo quân kín · Lật sau nước đi đầu</span></div>{revealed&&<p className="coup-reveal" role="status">Vừa lật: <b>{names[revealed]}</b></p>}<details><summary>Luật cờ úp đang áp dụng</summary><ul><li>Tướng ngửa; 15 quân còn lại mỗi bên xáo ngẫu nhiên và úp kín.</li><li>Quân úp đi nước đầu theo vị trí ban đầu rồi lật lên; sau đó đi theo quân thật.</li><li>Sĩ đã lật được ra ngoài cung. Tượng đã lật được qua sông nhưng vẫn bị cản mắt.</li><li>Tướng không ra khỏi cung, không được lộ mặt hoặc tự đặt vào thế bị chiếu.</li><li>Quân úp bị ăn chỉ hiện danh tính cho người ăn; đối thủ vẫn thấy quân úp.</li><li>Chiếu bí hoặc hết nước đi là thua; ba lần lặp cùng thế cờ/lượt đi là hòa. Xin hòa, xin thua và đồng hồ như bàn cờ tướng.</li></ul></details></aside>
}
