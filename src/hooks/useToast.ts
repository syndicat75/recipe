/**
 * @file src/hooks/useToast.ts
 * @description 전역 토스트 알림 메시지 관리 훅.
 * 중복 방지(동일 message + type), 최대 3개 노출 제한 및 자동 타임아웃(3.2초) 해제 처리.
 */

import { useState, useCallback } from 'react';
import { ToastMessage } from '../types/recipe';
import { logger } from '../utils/logger';

export interface UseToastReturn {
  /** 현재 활성화된 토스트 알림 목록 */
  toasts: ToastMessage[];
  /** 토스트 알림 추가 함수 */
  showToast: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  /** 특정 ID의 토스트 수동 제거 함수 */
  dismissToast: (id: string) => void;
}

/**
 * 토스트 알림 관리 커스텀 훅
 * @returns toasts, showToast, dismissToast
 */
export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  /**
   * 전역 토스트 알림 메시지를 표시합니다.
   * 동일한 message + type 조합의 토스트가 이미 존재하면 중복 추가를 방지하고,
   * 화면에는 최대 3개까지만 노출합니다.
   *
   * @param message 표시할 안내 문구
   * @param type 알림 유형 ('success' | 'info' | 'warning' | 'error')
   */
  const showToast = useCallback(
    (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info'): void => {
      if (!message || !message.trim()) return;

      setToasts((prev) => {
        const duplicated = prev.some(
          (toast) => toast.message === message && toast.type === type
        );

        if (duplicated) {
          return prev;
        }

        const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
        logger.info('useToast.showToast', `토스트 생성: [${type}] ${message} (${id})`);

        // 타이머 등록: 중복되지 않고 실제로 추가된 Toast에 대해서만 개별 해제 예약
        setTimeout(() => {
          setToasts((current) => current.filter((t) => t.id !== id));
        }, 3200);

        return [...prev, { id, message, type }].slice(-3);
      });
    },
    []
  );

  /**
   * 특정 ID의 토스트를 수동으로 제거합니다.
   *
   * @param id 제거할 토스트 고유 ID
   */
  const dismissToast = useCallback((id: string): void => {
    logger.info('useToast.dismissToast', `토스트 수동 닫기: ${id}`);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return {
    toasts,
    showToast,
    dismissToast,
  };
}
