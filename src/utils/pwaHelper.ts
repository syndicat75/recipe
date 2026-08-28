/**
 * @file src/utils/pwaHelper.ts
 * @description PWA(프로그레시브 웹 앱) 설치 환경 감지(Standalone, iOS, Samsung Internet, Android, Chrome 등) 및 헬퍼 함수
 */

import { logger } from './logger';

export interface PwaEnvironmentInfo {
  /** PWA가 이미 설치되어 독립 창(standalone)으로 실행 중인지 여부 */
  isStandalone: boolean;
  /** iOS (iPhone, iPad, iPod) 기기 여부 */
  isIOS: boolean;
  /** Android OS 기반 기기 여부 */
  isAndroid: boolean;
  /** Samsung Internet 브라우저 여부 */
  isSamsungBrowser: boolean;
  /** Chrome 브라우저 여부 */
  isChrome: boolean;
  /** Safari 브라우저 여부 */
  isSafari: boolean;
  /** 모바일 장치 여부 */
  isMobile: boolean;
}

/**
 * PWA가 이미 설치되어 독립 실행 모드(standalone)로 실행 중인지 판별합니다.
 * @returns standalone 모드 실행 여부
 */
export function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    document.referrer.includes('android-app://');

  logger.debug('pwaHelper.checkIsStandalone', `Standalone 실행 여부: ${isStandalone}`);
  return isStandalone;
}

/**
 * 현재 브라우저의 PWA 실행 환경 및 브라우저 종류를 상세 판별합니다.
 * @returns PwaEnvironmentInfo 객체
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

  const ua = navigator.userAgent || '';

  // 1. Standalone 실행 여부
  const isStandalone = checkIsStandalone();

  // 2. 브라우저 및 OS 환경 판별
  const isSamsungBrowser = /SamsungBrowser/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isChrome = /Chrome/i.test(ua) && !isSamsungBrowser && !/Edg/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua) && !/CriOS/i.test(ua) && !isSamsungBrowser;
  const isMobile = isIOS || isAndroid || /Mobi|Android/i.test(ua);

  const envInfo: PwaEnvironmentInfo = {
    isStandalone,
    isIOS,
    isAndroid,
    isSamsungBrowser,
    isChrome,
    isSafari,
    isMobile,
  };

  logger.info('pwaHelper.getPwaEnvironment', 'PWA 환경 감지 완료', envInfo);
  return envInfo;
}
