// 표류섬 서비스워커 — 이 앱 주소(/castaway-isle/) 것만 다룸
const APP = 'castaway-isle';
const VERSION = '42';
const CACHE = APP + '-' + VERSION;
const FILES = [
  "./manifest.webmanifest", "./icon-192.png", "./icon-192.png?v=5", "./icon-512.png?v=5",
  "./icon-maskable-512.png?v=5", "./apple-touch-icon.png?v=5", "./beach_objs.png",
  "./ui_icons.png", "./ui_frame.png", "./beach_camp.png", "./beach_tools.png",
  "./felled_tree.png", "./thin_tree.png", "./beach_story_items.png", "./beach_cooking.png",
  "./beach_soups.png", "./castaway_carry.png", "./hut_views.png", "./paper_beach_map.png",
  "./floor_beachA.png", "./floor_beachB.png", "./beach-audio.js", "./beacon_lit.png",
  "./catch_icons.png", "./coconut-chips.png", "./beacon_ash.png", "./cliff_mask.png",
  "./shore_items.png", "./carried_ember.png"
];
// 이 릴리스에서 요청하는 실제 PNG 크기. HTML만 먼저 올라온 경우 이전 판을 유지한다.
const SPRITES = {
  "boy.png":[2000,713], "boy_x.png":[1200,230], "girl.png":[4000,1392], "girl_x.png":[2400,460],
  "wake.png":[1536,736], "fishing_front.png":[1536,1024], "hut_build.png":[1536,600],
  "castaway_run.png":[1920,1920], "palm_empty.png":[754,500], "cliff_notch.png":[39,37]
};
const AUDIO = ["./audio/hut.mp3", "./audio/files.json", "./audio/day.mp3", "./audio/night.mp3", "./audio/waves.mp3", "./audio/fire.mp3", "./audio/cast.wav", "./audio/bite.wav", "./audio/wake.wav", "./audio/chop.wav", "./audio/pickup.wav", "./audio/pickup-hard.wav", "./audio/vine.wav", "./audio/cricket.wav", "./audio/sand-1.wav", "./audio/grass-1.wav", "./audio/wet-1.wav", "./audio/sand-2.wav", "./audio/grass-2.wav", "./audio/wet-2.wav", "./audio/sand-3.wav", "./audio/grass-3.wav", "./audio/wet-3.wav"];
const APP_TAG = '<meta name="app-id" content="castaway-isle">';
const VERSION_TAG = '<meta name="app-version" content="'+VERSION+'">';
const myScope = () => new URL('./', self.registration.scope).pathname;
const scopeOk = () => /\/castaway-isle\/$/.test(myScope()) || ['localhost', '127.0.0.1'].includes(location.hostname);

async function cacheSprite(cache,file,[width,height]){
  const req=new Request('./'+file+'?sprite=v'+VERSION,{cache:'reload'});
  const res=await fetch(req);
  if(!res.ok)throw new Error(file);
  const header=new DataView(await res.clone().arrayBuffer());
  if(header.byteLength<24||header.getUint32(0)!==0x89504e47||header.getUint32(12)!==0x49484452||
      header.getUint32(16)!==width||header.getUint32(20)!==height)throw new Error(file);
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
