// 고정 캐시명 — 갱신은 network-first(아래)로 자동 처리되므로 버전 수동 bump 불필요
const CACHE = 'myplanner';
// 배포 스탬프: 이 값을 배포마다 바꾸면 sw.js 바이트가 달라져 브라우저가 새 버전을 감지 → 앱이 "새로고침" 배너를 띄움
const SW_VERSION = '2026-07-03b';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', './index.html', './styles.css', './app.js', './icon.svg', './icon-192.png', './icon-512.png', './icon-512-maskable.png', './manifest.webmanifest'])));
  // skipWaiting은 사용자가 배너의 "새로고침"을 누를 때 메시지로 호출 → 작업 중 갑작스런 새로고침 방지
});

// 페이지가 "지금 새 버전 적용" 요청 시 즉시 활성화
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

// 백그라운드 푸시 수신 → 알림 표시 (앱이 닫혀 있어도 동작)
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: '🗓 마이플래너', body: e.data ? e.data.text() : '' }; }
  const title = d.title || '🗓 마이플래너';
  const opts = { body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || undefined, data: d.data || {}, renotify: !!d.tag };
  e.waitUntil(self.registration.showNotification(title, opts));
});
// 알림 클릭 → 열린 앱 포커스(없으면 새 창)
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if ('focus' in c) return c.focus(); }
    if (self.clients.openWindow) return self.clients.openWindow('./');
  }));
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
        // 정상 응답만 캐시 — 404/500이나 포털 리다이렉트를 저장하면
        // 다음 오프라인 실행 때 앱이 통째로 깨진다
        if (r.ok && r.type === 'basic') {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return r;
      })
      .catch(() => caches.match(e.request).then(m => m || (e.request.mode === 'navigation' ? caches.match('./index.html') : Response.error())))
  );
});
