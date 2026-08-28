/**
 * @file src/hooks/useNetworkStatus.ts
 * @description 브라우저의 온라인 및 오프라인 네트워크 연결 상태 감지 훅.
 */

import { useState, useEffect } from 'react';
import { logger } from '../utils/logger';

export interface UseNetworkStatusReturn {
  /** 현재 온라인 상태 여부 */
  isOnline: boolean;
  /** 현재 오프라인 상태 여부 */
  isOffline: boolean;
}

/**
 * 네트워크 상태 감지 훅
 * @returns { isOnline, isOffline }
 */
export function useNetworkStatus(): UseNetworkStatusReturn {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    const handleOnline = (): void => {
      logger.info('useNetworkStatus', '네트워크 온라인 복구');
      setIsOnline(true);
    };

    const handleOffline = (): void => {
      logger.warn('useNetworkStatus', '네트워크 오프라인 전환');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
  };
}
