// 고정 캐시명 — 갱신은 network-first(아래)로 자동 처리되므로 버전 수동 bump 불필요
const CACHE = 'myplanner';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', './index.html', './styles.css', './app.js', './icon.svg', './manifest.webmanifest'])));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // 외부 API(Firebase, 날씨, 폰트 등)는 캐시하지 않음
  if (url.origin !== location.origin) return;
  // 네트워크 우선, 실패 시 캐시 (오프라인 지원)
  e.respondWith(
    fetch(e.request)
      .then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return r;
      })
      .catch(() => caches.match(e.request).then(m => m || (e.request.mode === 'navigation' ? caches.match('./index.html') : Response.error())))
  );
});
