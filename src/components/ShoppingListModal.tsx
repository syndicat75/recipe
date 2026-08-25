/**
 * @file src/components/ShoppingListModal.tsx
 * @description 장보기 목록 모달 컴포넌트, 재료 구매 체크, 개별/일괄 삭제, 수동 재료 추가 및 텍스트 복사 지원
 */

import React, { useState } from 'react';
import {
  X,
  ShoppingCart,
  Trash2,
  Check,
  Plus,
  Copy,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react';
import { ShoppingItem } from '../types/recipe';
import { logger } from '../utils/logger';

interface ShoppingListModalProps {
  /** 모달 열림 여부 */
  isOpen: boolean;
  /** 장보기 아이템 목록 */
  items: ShoppingItem[];
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 단일 아이템 체크 토글 */
  onToggleComplete: (id: string) => void;
  /** 단일 아이템 삭제 */
  onDeleteItem: (id: string) => void;
  /** 새 아이템 추가 */
  onAddItem: (text: string) => void;
  /** 완료된 항목 일괄 삭제 */
  onClearCompleted: () => void;
  /** 전체 항목 비우기 */
  onClearAll: () => void;
  /** 토스트 메시지 표시 함수 */
  showToast: (msg: string) => void;
}

/**
 * 장보기 목록 모달 컴포넌트
 */
export const ShoppingListModal: React.FC<ShoppingListModalProps> = ({
  isOpen,
  items,
  onClose,
  onToggleComplete,
  onDeleteItem,
  onAddItem,
  onClearCompleted,
  onClearAll,
  showToast,
}) => {
  const [newItemText, setNewItemText] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen) return null;

  const completedCount = items.filter((item) => item.completed).length;

  /**
   * 새 재료 추가 제출 핸들러
   * @param e 폼 이벤트
   */
  const handleAddNewItem = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!newItemText.trim()) return;
    logger.info('ShoppingListModal.handleAddNewItem', `새 장보기 재료 추가: "${newItemText}"`);
    onAddItem(newItemText.trim());
    setNewItemText('');
    showToast('🛒 재료가 장보기 목록에 추가되었습니다.');
  };

  /**
   * 장보기 목록 클립보드 복사
   */
  const handleCopyList = async (): Promise<void> => {
    logger.info('ShoppingListModal.handleCopyList', '장보기 목록 복사');
    if (items.length === 0) {
      showToast('⚠️ 복사할 재료가 없습니다.');
      return;
    }

    const text = `[내 입맛 레시피 - 장보기 목록]\n${items
      .map((item) => `${item.completed ? '✅' : '⬜'} ${item.text}${item.sourceRecipeName ? ` (${item.sourceRecipeName})` : ''}`)
      .join('\n')}\n\n총 ${items.length}개 품목`;

    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      showToast('📋 장보기 목록이 클립보드에 복사되었습니다.');
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      logger.error('ShoppingListModal.handleCopyList', '클립보드 복사 실패', err);
      showToast('복사에 실패했습니다.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shoppingModalTitle"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-scroll flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-orange-100 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-orange-500 text-white shadow-sm">
              <ShoppingCart className="h-5 w-5" />
            </span>
            <div>
              <h2 id="shoppingModalTitle" className="font-soft text-xl font-black text-stone-900 sm:text-2xl">
                장보기 목록 ({items.length})
              </h2>
              <p className="text-xs font-semibold text-stone-500">
                {items.length > 0
                  ? `완료 ${completedCount}개 / 남은 재료 ${items.length - completedCount}개`
                  : '마트나 장볼 때 필요한 재료를 담아두세요.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-red-100 hover:text-red-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Add Item Input Form */}
        <form onSubmit={handleAddNewItem} className="mt-4 flex gap-2">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            placeholder="추가할 재료 입력 (예: 대파 1단, 순두부 2봉)"
            className="flex-1 rounded-xl border border-orange-200 bg-[#fffdfa] px-3.5 py-2.5 text-xs text-stone-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
          <button
            type="submit"
            className="flex items-center gap-1 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" />
            <span>추가</span>
          </button>
        </form>

        {/* Item List */}
        <div className="mt-4 flex-1 overflow-y-auto max-h-80 pr-1">
          {items.length > 0 ? (
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-center justify-between gap-3 rounded-xl p-3 text-xs transition ${
                    item.completed
                      ? 'bg-stone-50 text-stone-400'
                      : 'bg-white text-stone-800 shadow-sm ring-1 ring-orange-100 hover:bg-orange-50/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onToggleComplete(item.id)}
                    className="flex flex-1 items-center gap-2.5 text-left"
                  >
                    {item.completed ? (
                      <CheckSquare className="h-4 w-4 text-stone-400 shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 text-orange-500 shrink-0" />
                    )}
                    <span className={`font-medium ${item.completed ? 'line-through' : ''}`}>
                      {item.text}
                    </span>
                    {item.sourceRecipeName && (
                      <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-bold text-orange-600">
                        {item.sourceRecipeName}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteItem(item.id)}
                    className="p-1 text-stone-400 hover:text-red-500"
                    title="항목 삭제"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-12 text-center text-stone-400">
              <ShoppingCart className="mx-auto h-8 w-8 text-stone-300" />
              <p className="mt-3 text-xs">장보기 목록이 비어 있습니다.</p>
              <p className="mt-1 text-[11px] text-stone-400">
                레시피 상세 모달에서 [장보기 담기] 버튼을 누르면 재료가 바로 등록됩니다.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {items.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-orange-100 pt-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyList}
                className="flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-xs font-bold text-stone-700 transition hover:bg-stone-50"
              >
                {isCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>전체 복사</span>
              </button>

              {completedCount > 0 && (
                <button
                  type="button"
                  onClick={onClearCompleted}
                  className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-bold text-stone-500 transition hover:bg-stone-50 hover:text-red-600"
                >
                  완료된 항목 삭제
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClearAll}
              className="text-xs font-bold text-stone-400 hover:text-red-500"
            >
              전체 비우기
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
