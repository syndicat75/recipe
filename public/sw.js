/**
 * @file public/sw.js
 * @description 내 입맛 레시피 서비스 워커 (v2.2: GET+HTTPS+Same-Origin 보호 필터, Navigation Network-First 전략, PWA 오프라인 캐싱 지원)
 * chrome-extension://, non-GET, cross-origin, /api/* 요청 캐싱 차단으로 Cache.put 에러 원천 방지
 */

const CACHE_NAME = 'my-recipe-cache-v2.3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon-180.png',
];

// 서비스 워커 설치 및 정적 자산 프리캐싱
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching static assets for', CACHE_NAME);
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 활성화 및 구버전 my-recipe-cache-* 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key.startsWith('my-recipe-cache-')) {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 네트워크 요청 가로채기
// 1. GET 외 메소드(POST, PUT, DELETE 등) -> 직접 통과 (캐시 제외)
// 2. HTTP/HTTPS 외 스킴(chrome-extension://, blob:, data: 등) -> 직접 통과 (캐시 제외)
// 3. 외부 Origin 요청 -> 직접 통과 (캐시 제외)
// 4. /api/ 요청 -> 캐시 없이 네트워크 직접 통과
// 5. Navigation 요청 (/ 및 /index.html) -> Network First (최신 JS/배포본 즉시 반영, 오프라인 시 캐시 폴백)
// 6. 정적 자산 (JS, CSS, Images, Fonts) -> Stale-While-Revalidate
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Cache API는 GET 요청만 처리한다.
  // POST/PUT/DELETE 등의 요청은 서비스워커가 가로채지 않는다.
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // chrome-extension://, blob://, data:// 등
  // HTTP(S)가 아닌 요청은 캐시하지 않는다.
  if (
    url.protocol !== 'http:' &&
    url.protocol !== 'https:'
  ) {
    return;
  }

  // 이 PWA 자신의 정적 자산만 Service Worker에서 캐시한다.
  // 외부 사이트, 브라우저 확장프로그램 등의 요청은 그대로 통과시킨다.
  if (url.origin !== self.location.origin) {
    return;
  }

  // API 요청은 절대 캐시하지 않는다.
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Navigation 및 HTML 문서는 Network First 전략 적용
  const isNavigationOrHtml =
    request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    request.destination === 'document';

  if (isNavigationOrHtml) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // 네트워크 실패 시 캐시된 index.html 반환 (오프라인 PWA 지원)
          return caches.match(request).then((cached) => {
            return cached || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // 기타 정적 자산(CSS, JS, 이미지 등): Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (networkResponse.type === 'basic' || networkResponse.type === 'cors')
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // 네트워크 에러 시 캐시만 신뢰
        });

      return cachedResponse || fetchPromise;
    })
  );
});
