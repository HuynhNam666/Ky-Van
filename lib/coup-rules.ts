import type {Board,Side} from "@/lib/chess";
export const covered=(p:string|null|undefined)=>!!p && /^[rb]U[AEHRCP]$/.test(p);
export function coupPseudo(b:Board,f:number,t:number):boolean{
 if(!Number.isInteger(f)||!Number.isInteger(t)||f<0||f>=90||t<0||t>=90||f===t)return false;
 const p=b[f];if(!p||b[t]?.[0]===p[0])return false;
 const x=f%9,y=Math.floor(f/9),X=t%9,Y=Math.floor(t/9),dx=X-x,dy=Y-y,a=Math.abs(dx),d=Math.abs(dy),red=p[0]==='r',hidden=covered(p),kind=hidden?p[2]:p[1];
 let n=0;if(x===X||y===Y){const step=x===X?(dy>0?9:-9):(dx>0?1:-1);for(let i=f+step;i!==t;i+=step)if(b[i])n++}
 const palace=X>=3&&X<=5&&(red?Y>=7:Y<=2);
 switch(kind){
  case 'K':return (b[t]===(red?'bK':'rK')&&x===X&&n===0)||(a+d===1&&palace);
  case 'A':return a===1&&d===1&&(!hidden||palace);
  case 'E':return a===2&&d===2&&(!hidden||(red?Y>=5:Y<=4))&&!b[(y+dy/2)*9+x+dx/2];
  case 'H':return (a===2&&d===1&&!b[y*9+x+dx/2])||(a===1&&d===2&&!b[(y+dy/2)*9+x]);
  case 'R':return (x===X||y===Y)&&n===0;
  case 'C':return (x===X||y===Y)&&n===(b[t]?1:0);
  case 'P':return (dx===0&&dy===(red?-1:1))||((red?y<=4:y>=5)&&a===1&&dy===0);
  default:return false;
 }
}
export function coupCheck(b:Board,side:Side){const king=b.indexOf(side+'K');return king<0||b.some((p,i)=>!!p&&p[0]!==side&&coupPseudo(b,i,king))}
export function coupMoved(b:Board,f:number,t:number){const c=b.slice();c[t]=c[f];c[f]=null;return c}
export function coupLegal(b:Board,f:number,t:number){return coupPseudo(b,f,t)&&!coupCheck(coupMoved(b,f,t),b[f]![0] as Side)}
export function coupWouldExpose(b:Board,f:number,t:number){return coupPseudo(b,f,t)&&coupCheck(coupMoved(b,f,t),b[f]![0] as Side)}
