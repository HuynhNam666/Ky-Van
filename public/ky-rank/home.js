/* Additive homepage integration: keeps existing account actions and scenery. */
(() => {
  const rank = document.getElementById('kv-account-rank');
  if (!rank) return;
  const avatar = document.querySelector('img[alt="Avatar Kỳ Thủ"],img[alt="Ảnh đại diện mặc định"],img[alt="Ảnh đại diện khách"]');
  const originalSrc = avatar?.getAttribute('src');
  const frame = avatar?.parentElement;
  const originalClass = frame?.className;
  const originalStyle = frame?.getAttribute('style');
  const stars = rank.parentElement?.nextElementSibling;
  const originalStars = stars?.innerHTML;
  const css = document.createElement('link'); css.rel='stylesheet';css.href='/ky-rank/rank.css';document.head.append(css);
  const anchor = document.createElement('a');anchor.href='/ho-so';anchor.target='_top';anchor.className='kv-home-profile-link';anchor.textContent='Avatar · Cấp bậc';
  const stat = document.createElement('span');stat.className='kv-home-rank-stats';
  const name = document.getElementById('kv-account-name');
  if(name?.parentElement) name.parentElement.append(anchor,stat);
  let inFlight=false, lastToken=null;
  function token(){try{return sessionStorage.getItem('kyvan.tab-session.v1')}catch{return null}}
  function clear(){if(avatar&&originalSrc)avatar.src=originalSrc;if(frame&&originalClass!==undefined){frame.className=originalClass;if(originalStyle===null)frame.removeAttribute('style');else frame.setAttribute('style',originalStyle)}if(stars&&originalStars!==undefined)stars.innerHTML=originalStars;stat.textContent='';anchor.href='/dang-nhap';rank.textContent='Khách'}
  async function refresh(){
    const session=token();
    if(!session){if(lastToken!==null)clear();lastToken=null;return}
    if(inFlight||document.hidden)return;
    lastToken=session;inFlight=true;
    try{
      const r=await fetch('/api/progression/me',{cache:'no-store',credentials:'omit',headers:{'X-Session-Mode':'tab',Authorization:'Bearer '+session}});
      if(!r.ok)return;
      const p=await r.json();if(token()!==session)return;
      rank.textContent=p.tier.name;rank.title=p.points+' điểm cấp bậc · Elo '+p.elo;
      if(avatar){avatar.src=p.avatar_url;avatar.alt='Avatar '+p.tier.name;avatar.style.opacity='1'}
      if(frame){frame.className=originalClass+' kv-rank-frame kv-rank-'+p.tier.index;frame.style.setProperty('--rank-color',p.tier.color)}
      if(stars){stars.replaceChildren();const s=document.createElement('span');s.className='kv-home-rank-stars';s.textContent='★'.repeat(p.tier.stars);s.setAttribute('aria-label',p.tier.stars+' sao');stars.append(s)}
      stat.textContent=p.points.toLocaleString('vi-VN')+' điểm · Elo '+p.elo;anchor.href='/ho-so';
    }catch{/* Account script continues to display backend connection status. */}finally{inFlight=false}
  }
  // The legacy account request may finish after this script; observe its label update.
  const observer=new MutationObserver(()=>{if(!token()&&lastToken){lastToken=null;clear()}else if(rank.textContent==='Kỳ thủ')void refresh()});observer.observe(rank,{childList:true});
  void refresh();const timer=setInterval(()=>void refresh(),15000);
  document.addEventListener('visibilitychange',()=>void refresh());window.addEventListener('focus',()=>void refresh());
  document.addEventListener('click',()=>{if(lastToken&&!token())clear()});
  window.addEventListener('pagehide',()=>{clearInterval(timer);observer.disconnect()},{once:true});
})();
