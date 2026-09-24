/** Everything needed to invite a friend into a room from outside the game (social networks, chat apps, e-mail). */
export function inviteLink(code:string){
const base=(process.env.NEXT_PUBLIC_SITE_URL||location.origin).replace(/\/$/,'');
return `${base}/?room=${code}`}
export function inviteText(code:string){return `Mời bạn đấu cờ tướng tại Kỳ Viện — mã phòng ${code}. Vào ngay: ${inviteLink(code)}`}
/** Share intents that work from a plain link (no app id): Facebook, Telegram, X and e-mail. Zalo/Messenger use the device share sheet or "copy invitation". */
export function shareTargets(code:string){
const url=encodeURIComponent(inviteLink(code)),text=encodeURIComponent(`Mời bạn đấu cờ tướng tại Kỳ Viện — mã phòng ${code}`);
return [
{id:'facebook',label:'Facebook',href:`https://www.facebook.com/sharer/sharer.php?u=${url}`},
{id:'telegram',label:'Telegram',href:`https://t.me/share/url?url=${url}&text=${text}`},
{id:'x',label:'X',href:`https://twitter.com/intent/tweet?url=${url}&text=${text}`},
{id:'email',label:'Email',href:`mailto:?subject=${encodeURIComponent('Mời chơi cờ tướng')}&body=${encodeURIComponent(inviteText(code))}`}]}
/** Links to localhost or a LAN address only work for people on the same network. */
export function isPrivateHost(host:string){return host==='localhost'||/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)||host.endsWith('.local')}
