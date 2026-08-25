/**
 * @file public/sw.js
 * @description 내 입맛 레시피 서비스 워커 (v2.1: Navigation Network-First 전략, PWA 오프라인 캐싱 지원)
 */

const CACHE_NAME = 'my-recipe-cache-v2.1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
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
// 1. /api/ 요청 -> 캐시 없이 네트워크 직접 통과
// 2. Navigation 요청 (/ 및 /index.html) -> Network First (최신 JS/배포본 즉시 반영, 오프라인 시 캐시 폴백)
// 3. 정적 자산 (JS, CSS, Images, Fonts) -> Stale-While-Revalidate
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. API 요청은 항상 네트워크로 직접 전송
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 2. Navigation 및 HTML 문서는 Network First 전략 적용
  const isNavigationOrHtml =
    event.request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    event.request.destination === 'document';

  if (isNavigationOrHtml) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // 네트워크 실패 시 캐시된 index.html 반환 (오프라인 PWA 지원)
          return caches.match(event.request).then((cached) => {
            return cached || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // 3. 기타 정적 자산(CSS, JS, 이미지 등): Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (networkResponse.type === 'basic' || networkResponse.type === 'cors')
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
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

