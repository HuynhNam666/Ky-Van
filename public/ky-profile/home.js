/* Avatar entry point. Does not alter the existing homepage artwork or account code. */
(()=>{
 const avatar=document.querySelector('img[alt="Avatar Kỳ Thủ"],img[alt="Ảnh đại diện mặc định"],img[alt="Ảnh đại diện khách"],img[alt^="Avatar "]');
 if(!avatar)return;
 const target=avatar.parentElement;
 if(!target)return;
 target.setAttribute('role','link');target.setAttribute('tabindex','0');target.setAttribute('aria-label','Mở hồ sơ của tôi');target.style.cursor='pointer';
 const go=e=>{e.preventDefault();e.stopImmediatePropagation();window.top.location.assign('/ky-thu')};
 target.addEventListener('click',go,true);target.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')go(e)},true);
})();
