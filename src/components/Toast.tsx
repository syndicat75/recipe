/**
 * @file src/components/Toast.tsx
 * @description 사용자 작업 알림(즐겨찾기, 복사, 장보기 추가 등)을 표시하는 토스트 컴포넌트
 */

import React from 'react';
import { ToastMessage } from '../types/recipe';
import { logger } from '../utils/logger';

interface ToastProps {
  /** 현재 활성화된 토스트 목록 */
  toasts: ToastMessage[];
  /** 토스트 닫기 핸들러 */
  onDismiss: (id: string) => void;
}

/**
 * 전역 토스트 알림 컴포넌트
 */
export const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  logger.debug('Toast', `토스트 렌더링 (${toasts.length}개)`);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-stone-900/95 px-4 py-3 text-xs font-bold text-white shadow-2xl backdrop-blur-md transition duration-300"
        >
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="text-stone-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};
