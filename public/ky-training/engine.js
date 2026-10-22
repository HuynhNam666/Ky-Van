import {allMoves,moved,other,check} from './rules.js';
export const LEVELS=[{name:'Dễ',depth:1,ms:250},{name:'Trung bình',depth:2,ms:650},{name:'Khó',depth:4,ms:2000},{name:'Cực khó',depth:6,ms:5000}];
const V={K:100000,R:900,C:450,H:420,E:200,A:200,P:100},MATE=1000000;
function evaluate(b,s){let v=0;for(let i=0;i<90;i++){const p=b[i];if(!p)continue;const advance=p[0]==='r'?9-Math.floor(i/9):Math.floor(i/9),center=4-Math.abs(i%9-4);v+=(p[0]===s?1:-1)*(V[p[1]]+(p[1]==='P'?advance*12+(advance>=5?55:0):['H','R','C'].includes(p[1])?center*7:0))}return v}
function ordered(ms,preferred){return ms.sort((a,b)=>priority(b)-priority(a));function priority(m){return (preferred&&m.from===preferred.from&&m.to===preferred.to?200000:0)+(m.captured?10*V[m.captured[1]]-V[m.piece[1]]:0)}}
export function searchMove(board,side,level=1,options={}){
 const cfg=LEVELS[level]||LEVELS[1],clock=options.clock||(()=>performance.now()),started=clock(),deadline=started+(options.ms??cfg.ms);let nodes=0,completed=0;
 const STOP={},roots=ordered(allMoves(board,side));if(!roots.length)return {move:null,depth:0,nodes,ms:0};
 let best=roots[0],score=-Infinity;
 function visit(b,s,d,alpha,beta,ply,q=0){if((++nodes&15)===0&&clock()>=deadline)throw STOP;if(!b.includes(s+'K'))return -MATE+ply;if(!b.includes(other(s)+'K'))return MATE-ply;
  let ms=ordered(allMoves(b,s));if(!ms.length)return -MATE+ply;
  if(d<=0){const base=evaluate(b,s);if(q>=2)return base;if(!check(b,s)){if(base>=beta)return base;alpha=Math.max(alpha,base);ms=ms.filter(m=>m.captured);if(!ms.length)return base}}
  let val=d<=0&&!check(b,s)?evaluate(b,s):-Infinity;
  for(const m of ms){const value=-visit(moved(b,m.from,m.to),other(s),d-1,-beta,-alpha,ply+1,d<=0?q+1:q);val=Math.max(val,value);alpha=Math.max(alpha,value);if(alpha>=beta)break}return val;
 }
 if(level===0){const ranked=roots.map(m=>({m,v:evaluate(moved(board,m.from,m.to),side)+(m.captured?.[1]==='K'?MATE:0)})).sort((a,b)=>b.v-a.v);const pool=ranked.filter(x=>x.v>=ranked[0].v-160).slice(0,6);best=pool[Math.floor((options.random||Math.random)()*pool.length)].m;return {move:best,depth:1,nodes:roots.length,ms:clock()-started}}
 for(let depth=1;depth<=cfg.depth;depth++){let current=best,currentScore=-Infinity,alpha=-Infinity;try{for(const m of ordered([...roots],best)){if(clock()>=deadline)throw STOP;const v=-visit(moved(board,m.from,m.to),other(side),depth-1,-Infinity,-alpha,1);if(v>currentScore){currentScore=v;current=m}alpha=Math.max(alpha,v)}best=current;score=currentScore;completed=depth;if(score>MATE-100)break}catch(e){if(e!==STOP)throw e;break}}
 return {move:best,score:Number.isFinite(score)?score:0,depth:completed,nodes,ms:Math.round(clock()-started)};
}
