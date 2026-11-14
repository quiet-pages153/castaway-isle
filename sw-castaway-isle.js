// 표류섬 서비스워커 — 이 앱 주소(/castaway-isle/) 것만 다룸
const APP = 'castaway-isle';
const CACHE = APP + '-17';
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png", "./boy.png", "./girl.png", "./boy_x.png", "./girl_x.png", "./floor_beach.png", "./beach_objs.png", "./ui_icons.png"];
const APP_TAG = '<meta name="app-id" content="castaway-isle">';
const myScope = () => new URL('./', self.registration.scope).pathname;
const scopeOk = () => /\/castaway-isle\/$/.test(myScope()) || ['localhost', '127.0.0.1'].includes(location.hostname);

// 설치: 다른 앱 파일이 잘못 올라왔으면(app-id 없음) 또는 주소가 다르면 설치하지 않음 → 지금 쓰던 판이 그대로 남음
self.addEventListener('install', e => e.waitUntil((async () => {
  if (!scopeOk()) throw new Error('scope');
  const c = await caches.open(CACHE);
  const idx = await fetch(new Request('./index.html', {cache: 'reload'}));
  const text = await idx.clone().text();
  if (!idx.ok || !text.slice(0, 600).includes(APP_TAG)) throw new Error('app-id');
  await c.put('./index.html', idx.clone()); await c.put('./', idx);
  await c.addAll(FILES.filter(f => f !== './' && f !== './index.html').map(f => new Request(f, {cache: 'reload'})));
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
  if (req.mode === 'navigate') {   // 화면: 저장본 먼저 (오프라인·잘못 올린 파일에도 열림)
    e.respondWith(caches.match('./index.html').then(hit => hit || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, {ignoreSearch: true}).then(hit => hit || fetch(req).then(res => {
    if (res.ok && res.type === 'basic') { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); }
    return res;
  })));
});
