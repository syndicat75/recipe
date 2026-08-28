/**
 * @file src/hooks/usePwaInstall.ts
 * @description Progressive Web App (PWA) 설치 프롬프트 및 설치 상태 관리 훅.
 * Chrome 네이티브 설치 대화상자(beforeinstallprompt) 및 Samsung Internet, iOS Safari 등 맞춤 안내 모달 상태 제어.
 */

import { useState, useEffect, useCallback } from 'react';
import { getPwaEnvironment, PwaEnvironmentInfo } from '../utils/pwaHelper';
import { logger } from '../utils/logger';

export interface UsePwaInstallOptions {
  /** 토스트 알림 함수 */
  showToast?: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export interface UsePwaInstallReturn {
  /** PWA 브라우저 및 OS 환경 정보 */
  pwaEnv: PwaEnvironmentInfo;
  /** PWA가 이미 설치되었거나 standalone 모드로 실행 중인지 여부 */
  isInstalled: boolean;
  /** PWA standalone(독립 앱) 실행 여부 */
  isStandalone: boolean;
  /** 네이티브 설치 또는 맞춤 안내 모달을 통한 설치 가능 여부 */
  canInstall: boolean;
  /** PWA 수동 설치 안내 모달 노출 여부 */
  isInstallModalOpen: boolean;
  /** PWA 수동 설치 안내 모달 상태 설정 함수 */
  setIsInstallModalOpen: (open: boolean) => void;
  /** PWA 설치 실행 함수 (네이티브 프롬프트 또는 수동 모달 오픈) */
  installPwa: () => Promise<void>;
}

/**
 * PWA 설치 및 환경 감지 관리 훅
 * @param options 설정 옵션 (showToast)
 * @returns PWA 설치 관련 상태 및 핸들러
 */
export function usePwaInstall(options: UsePwaInstallOptions = {}): UsePwaInstallReturn {
  const { showToast } = options;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [pwaEnv] = useState<PwaEnvironmentInfo>(() => getPwaEnvironment());
  const [isInstalled, setIsInstalled] = useState<boolean>(() => getPwaEnvironment().isStandalone);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState<boolean>(false);

  const isStandalone = pwaEnv.isStandalone || isInstalled;
  const canInstall = !isStandalone;

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleBeforeInstall = (e: any): void => {
      e.preventDefault();
      logger.info('usePwaInstall', 'PWA 설치 프롬프트 수신(beforeinstallprompt)');
      setDeferredPrompt(e);
    };

    const handleAppInstalled = (): void => {
      logger.info('usePwaInstall', 'PWA 앱 설치 완료 감지(appinstalled)');
      setIsInstalled(true);
      setDeferredPrompt(null);
      if (showToast) {
        showToast('🎉 내 입맛 레시피 앱이 설치되었습니다.', 'success');
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [showToast]);

  /**
   * PWA 설치 핸들러
   * 1. deferredPrompt가 존재하는 브라우저(Chrome 등): 네이티브 설치 대화상자 호출
   * 2. deferredPrompt가 없는 환경(Samsung Internet, iOS Safari 등): 브라우저 맞춤 설치 안내 모달 표시
   */
  const installPwa = useCallback(async (): Promise<void> => {
    logger.info('usePwaInstall.installPwa', 'PWA 설치 요청 처리 시작');
    if (deferredPrompt) {
      try {
        logger.info('usePwaInstall.installPwa', 'PWA 네이티브 설치 프롬프트 표시');
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        logger.info('usePwaInstall.installPwa', `PWA 설치 결과: ${outcome}`);
        if (outcome === 'accepted') {
          if (showToast) {
            showToast('🎉 내 입맛 레시피 앱이 설치되었습니다.', 'success');
          }
          setIsInstalled(true);
        }
      } catch (err) {
        logger.error('usePwaInstall.installPwa', 'PWA 설치 프롬프트 실행 실패', err);
        setIsInstallModalOpen(true);
      } finally {
        setDeferredPrompt(null);
      }
      return;
    }

    // deferredPrompt가 없는 경우 (Samsung Internet, iOS Safari, 기타 모바일 환경)
    logger.info('usePwaInstall.installPwa', '수동 설치 안내 모달 열기');
    setIsInstallModalOpen(true);
  }, [deferredPrompt, showToast]);

  return {
    pwaEnv,
    isInstalled,
    isStandalone,
    canInstall,
    isInstallModalOpen,
    setIsInstallModalOpen,
    installPwa,
  };
}
