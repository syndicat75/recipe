/**
 * @file src/components/ConfirmModal.tsx
 * @description 중요한 작업(레시피 삭제, 데이터 덮어쓰기 등) 수행 전 사용자 확인을 받는 모달 대화상자 컴포넌트
 */

import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, HelpCircle, X } from 'lucide-react';
import { logger } from '../utils/logger';

interface ConfirmModalProps {
  /** 모달 표시 여부 */
  isOpen: boolean;
  /** 확인창 제목 */
  title: string;
  /** 확인창 설명 문구 */
  message: string;
  /** 확인 버튼 텍스트 (예: '삭제', '복원하기') */
  confirmText?: string;
  /** 취소 버튼 텍스트 (기본 '취소') */
  cancelText?: string;
  /** 위험 액션 스타일 여부 (빨간색 강조) */
  isDestructive?: boolean;
  /** 확인 콜백 핸들러 */
  onConfirm: () => void;
  /** 취소/닫기 콜백 핸들러 */
  onCancel: () => void;
}

/**
 * 전역 확인 대화상자 모달 컴포넌트
 */
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = '확인',
  cancelText = '취소',
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (isOpen) {
      logger.info('ConfirmModal', `확인 모달 표시: "${title}"`);
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, title]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm animate-fade-in"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirmModalTitle"
      aria-describedby="confirmModalDesc"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl transition-all sm:p-7">
        <div className="flex items-start gap-4">
          <div
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${
              isDestructive ? 'bg-red-50 text-red-500' : 'bg-orange-50 text-orange-500'
            }`}
          >
            {isDestructive ? <Trash2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
          </div>

          <div className="min-w-0 flex-1">
            <h3 id="confirmModalTitle" className="font-soft text-lg font-black text-stone-900 sm:text-xl">
              {title}
            </h3>
            <p id="confirmModalDesc" className="mt-2 text-xs leading-relaxed text-stone-600 sm:text-sm">
              {message}
            </p>
          </div>
        </div>

        {/* Modal Buttons */}
        <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-stone-100">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold text-stone-700 transition hover:bg-stone-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-black text-white shadow-md transition ${
              isDestructive
                ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
                : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
