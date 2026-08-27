/**
 * @file src/utils/pwaHelper.ts
 * @description PWA 설치 환경 감지(Standalone, iOS, Samsung Internet, Android 등) 및 헬퍼 함수
 */

export interface PwaEnvironmentInfo {
  isStandalone: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isSamsungBrowser: boolean;
  isChrome: boolean;
  isSafari: boolean;
  isMobile: boolean;
}

/**
 * 현재 브라우저의 PWA 실행 환경 및 브라우저 종류를 판별합니다.
 */
export function getPwaEnvironment(): PwaEnvironmentInfo {
  if (typeof window === 'undefined') {
    return {
      isStandalone: false,
      isIOS: false,
      isAndroid: false,
      isSamsungBrowser: false,
      isChrome: false,
      isSafari: false,
      isMobile: false,
    };
  }

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    document.referrer.includes('android-app://');

  const ua = navigator.userAgent || '';

  const isSamsungBrowser = /SamsungBrowser/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isChrome = /Chrome/i.test(ua) && !isSamsungBrowser && !/Edg/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua) && !/CriOS/i.test(ua) && !isSamsungBrowser;
  const isMobile = isIOS || isAndroid || /Mobi|Android/i.test(ua);

  return {
    isStandalone,
    isIOS,
    isAndroid,
    isSamsungBrowser,
    isChrome,
    isSafari,
    isMobile,
  };
}
