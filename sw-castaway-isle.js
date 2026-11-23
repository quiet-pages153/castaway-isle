// 표류섬 서비스워커 — 이 앱 주소(/castaway-isle/) 것만 다룸
const APP = 'castaway-isle';
const VERSION = '57';
const CACHE = APP + '-' + VERSION;
const FILES = [
  "./manifest.webmanifest", "./icon-192.png", "./icon-192.png?v=5", "./icon-512.png?v=5",
  "./icon-maskable-512.png?v=5", "./apple-touch-icon.png?v=5", "./beach_objs.webp",
  "./ui_icons.webp", "./ui_frame.webp", "./beach_camp.webp", "./beach_tools.webp",
  "./felled_tree.webp", "./thin_tree.webp", "./beach_story_items.webp", "./beach_cooking.webp",
  "./beach_soups.webp", "./castaway_carry.webp", "./hut_views.webp", "./paper_beach_map.webp",
  "./floor_beachA.webp", "./title_ship.webp", "./floor_beachB.webp",
  "./floor_jungleA.webp", "./floor_jungleB.webp", "./jungle_foot.webp", "./tough_vine.webp", "./tough_vine_cut.webp", "./jungle_berry_red.webp", "./jungle_berry_red_empty.webp", "./jungle_berry_yellow.webp", "./jungle_berry_yellow_empty.webp", "./jungle_berry_purple.webp", "./jungle_berry_purple_empty.webp", "./icon_berry_red.webp", "./icon_berry_yellow.webp", "./icon_berry_purple.webp", "./jungle_chest.webp", "./jungle_chest_open.webp", "./map_piece2.webp", "./jungle_banana.webp", "./jungle_banana_empty.webp", "./jungle_icon_banana.webp", "./beach-audio.js", "./beacon_lit.webp",
  "./catch_icons.webp", "./coconut-chips.webp", "./beacon_ash.webp", "./cliff_mask.png",
  "./shore_items.webp", "./carried_ember.webp"
];
// 이 릴리스에서 요청하는 실제 PNG 크기. HTML만 먼저 올라온 경우 이전 판을 유지한다.
const SPRITES = {
  "boy.webp":[2000,713], "boy_x.webp":[1200,230], "girl.webp":[4000,1392], "girl_x.webp":[2400,460], "wake.webp":[1536,736], "fishing_front.webp":[1536,1024], "hut_build.webp":[1536,600], "castaway_run.webp":[1920,1920], "palm_empty.webp":[754,500], "cliff_notch.png":[39,37], "jungle_objs.webp":[2048,1218]
};
const AUDIO = ["./audio/hut.mp3", "./audio/files.json", "./audio/day.mp3", "./audio/night.mp3", "./audio/waves.mp3", "./audio/fire.mp3", "./audio/cast.wav", "./audio/bite.wav", "./audio/wake.wav", "./audio/chop.wav", "./audio/pickup.wav", "./audio/pickup-hard.wav", "./audio/vine.wav", "./audio/cricket.wav", "./audio/sand-1.wav", "./audio/grass-1.wav", "./audio/wet-1.wav", "./audio/sand-2.wav", "./audio/grass-2.wav", "./audio/wet-2.wav", "./audio/sand-3.wav", "./audio/grass-3.wav", "./audio/wet-3.wav", "./audio/jungle-day.mp3", "./audio/jungle-night.mp3"];
const RUN_HASH = '84b177cbf9cc2fe67b2d46d6f0ce597991e511e68564bcfe31feeb02bd253999';
const APP_TAG = '<meta name="app-id" content="castaway-isle">';
const VERSION_TAG = '<meta name="app-version" content="'+VERSION+'">';
const myScope = () => new URL('./', self.registration.scope).pathname;
const scopeOk = () => /\/castaway-isle\/$/.test(myScope()) || ['localhost', '127.0.0.1'].includes(location.hostname);

// PNG·WebP 머리에서 가로·세로 읽기
function imageSize(d){
  if(d.byteLength<30)return null;
  if(d.getUint32(0)===0x89504e47)return [d.getUint32(16),d.getUint32(20)];
  if(d.getUint32(0)!==0x52494646||d.getUint32(8)!==0x57454250)return null;
  const c=d.getUint32(12), u24=o=>d.getUint8(o)|d.getUint8(o+1)<<8|d.getUint8(o+2)<<16;
  if(c===0x56503858)return [1+u24(24),1+u24(27)];
  if(c===0x5650384c){const b=d.getUint32(21,true);return [(b&0x3fff)+1,(b>>>14&0x3fff)+1];}
  if(c===0x56503820)return [d.getUint16(26,true)&0x3fff,d.getUint16(28,true)&0x3fff];
  return null;
}
async function cacheSprite(cache,file,[width,height]){
  const req=new Request('./'+file+'?sprite=v'+VERSION,{cache:'reload'});
  const res=await fetch(req);
  if(!res.ok)throw new Error(file);
  const bytes=await res.clone().arrayBuffer(),header=new DataView(bytes);
  const size=imageSize(header);
  if(!size||size[0]!==width||size[1]!==height)throw new Error(file);
  if(file==='castaway_run.webp'){
    const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
    const hash=Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
    if(hash!==RUN_HASH)throw new Error(file);
  }
  await cache.put(req,res);
}

// 같은 배포본의 화면과 핵심 그림이 준비된 뒤에만 이전 판에서 전환한다.
self.addEventListener('install', e => e.waitUntil((async () => {
  if (!scopeOk()) throw new Error('scope');
  const c = await caches.open(CACHE);
  const idx = await fetch(new Request('./index.html', {cache: 'reload'}));
  const head=(await idx.clone().text()).slice(0,600);
  if(!idx.ok||!head.includes(APP_TAG)||!head.includes(VERSION_TAG))throw new Error('build');
  await Promise.all([
    c.addAll(FILES.map(file=>new Request(file,{cache:'reload'}))),
    ...Object.entries(SPRITES).map(([file,size])=>cacheSprite(c,file,size)),
  ]);
  await c.put('./index.html',idx.clone()); await c.put('./',idx);
  await Promise.allSettled(AUDIO.map(file=>c.add(new Request(file,{cache:'reload'}))));
  await self.skipWaiting();
})()));

// 활성화: 이 앱의 옛 저장본만 지움 (다른 앱 것은 손대지 않음)
self.addEventListener('activate', e => e.waitUntil(caches.keys()
  .then(ks => Promise.all(ks.filter(k => k.startsWith(APP + '-') && k !== CACHE).map(k => caches.delete(k))))
  .then(() => self.clients.claim())));

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  if (!url.pathname.startsWith(myScope())) return;
  if (url.pathname.endsWith('/version.json')) return;
  if (req.cache === 'no-store' || req.cache === 'reload') return;   // 업데이트 확인용 요청은 항상 인터넷
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    if(req.mode==='navigate')return await cache.match('./index.html')||fetch(req);
    const hit=await cache.match(req);
    if(hit)return hit;
    const res=await fetch(req);
    if(res.ok&&res.type==='basic')await cache.put(req,res.clone());
    return res;
  })());
});
