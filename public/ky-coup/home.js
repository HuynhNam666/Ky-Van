/* Capture only the existing Cờ Úp card. Keep all its artwork and old handlers. */
(()=>{
 function activate(e){e.preventDefault();e.stopImmediatePropagation();if(window.kyVanEnterGame)void window.kyVanEnterGame('/ghep-tran?variant=coup');else window.top.location.assign('/co-up')}
 document.querySelectorAll('h3').forEach(title=>{
  if(title.textContent.trim().toLocaleLowerCase('vi-VN')!=='cờ úp')return;
  const card=title.closest('.group');if(!card)return;
  card.setAttribute('role','link');card.setAttribute('aria-label','Vào chơi Cờ Úp');card.tabIndex=0;
  card.addEventListener('click',activate,true);
  card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){activate(e)}},true);
 });
})();
