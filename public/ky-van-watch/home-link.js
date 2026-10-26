// Connect the existing homepage link without replacing any of its design.
(() => {
 document.querySelectorAll('a').forEach(link => {
  if (!link.textContent.replace(/\s+/g,' ').includes('Xem cờ')) return;
  link.href='/xem-co'; link.target='_top';
  link.addEventListener('click', event => {
   event.preventDefault();event.stopImmediatePropagation();
   window.kyVanGo('/xem-co');
  }, true);
 });
})();
