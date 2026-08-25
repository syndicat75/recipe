/**
 * @file src/components/RecipeDetailModal.tsx
 * @description 레시피 상세 모달 창 컴포넌트, 인분 수(배율) 스케일링, 재료 체크리스트, 조리 순서, 장보기 추가, 조리모드 진입, 메모 작성 및 레시피 복사 지원
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Bookmark,
  ShoppingCart,
  Play,
  Copy,
  Printer,
  Edit3,
  CheckSquare,
  Square,
  Clock,
  Flame,
  Check,
  Scale,
  StickyNote,
} from 'lucide-react';
import { APP_CONFIG, CATEGORY_CONFIG } from '../config/appConfig';
import { Recipe } from '../types/recipe';
import { getScaledIngredientsList } from '../utils/scaler';
import { logger } from '../utils/logger';

interface RecipeDetailModalProps {
  /** 표시할 레시피 데이터 (null이면 닫힘) */
  recipe: Recipe | null;
  /** 북마크 여부 */
  isBookmarked: boolean;
  /** 사용자 저장 메모 */
  userNote: string;
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 북마크 토글 핸들러 */
  onToggleBookmark: (recipeId: number) => void;
  /** 장보기 목록에 재료 추가 핸들러 */
  onAddToShoppingList: (items: string[], recipeName: string) => void;
  /** 조리 모드 시작 핸들러 */
  onStartCookingMode: (recipe: Recipe, multiplier: number) => void;
  /** 사용자 메모 저장 핸들러 */
  onSaveNote: (recipeId: number, note: string) => void;
  /** 토스트 메시지 표시 함수 */
  showToast: (msg: string) => void;
}

/**
 * 레시피 상세 팝업 모달 컴포넌트
 */
export const RecipeDetailModal: React.FC<RecipeDetailModalProps> = ({
  recipe,
  isBookmarked,
  userNote,
  onClose,
  onToggleBookmark,
  onAddToShoppingList,
  onStartCookingMode,
  onSaveNote,
  showToast,
}) => {
  const [portionMultiplier, setPortionMultiplier] = useState<number>(1);
  const [checkedIngredients, setCheckedIngredients] = useState<Record<number, boolean>>({});
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // 모달 열릴 때 상태 초기화
  useEffect(() => {
    if (recipe) {
      logger.info('RecipeDetailModal.useEffect', `상세 모달 초기화: ${recipe.name}`);
      setPortionMultiplier(1);
      setCheckedIngredients({});
      setNoteText(userNote || '');
      setIsEditingNote(false);
      setIsCopied(false);
    }
  }, [recipe, userNote]);

  // ESC 키 닫기 이벤트 리스너
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        logger.info('RecipeDetailModal.handleKeyDown', 'ESC로 상세 모달 닫기');
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!recipe) return null;

  const categoryMeta = CATEGORY_CONFIG[recipe.category] || CATEGORY_CONFIG['기타'];
  const scaledIngredients = getScaledIngredientsList(recipe.ingredients, portionMultiplier);

  /**
   * 조리 단계 파싱
   * @returns 단계별 문자열 배열
   */
  const getSteps = (): string[] => {
    logger.debug('RecipeDetailModal.getSteps', '조리 단계 파싱');
    if (!recipe.method || !recipe.method.trim() || recipe.method.trim() === '-') {
      return [];
    }
    return recipe.method
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const steps = getSteps();

  /**
   * 재료 준비 체크박스 토글 핸들러
   * @param index 재료 인덱스
   */
  const handleToggleIngredientCheck = (index: number): void => {
    logger.info('RecipeDetailModal.handleToggleIngredientCheck', `재료 체크 토글: 인덱스 ${index}`);
    setCheckedIngredients((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  /**
   * 장보기 목록에 재료 전체 담기
   */
  const handleAddAllToShopping = (): void => {
    logger.info('RecipeDetailModal.handleAddAllToShopping', `장보기 목록 일괄 추가: ${recipe.name}`);
    onAddToShoppingList(scaledIngredients, recipe.name);
    showToast(`🛒 '${recipe.name}' 재료가 장보기 목록에 추가되었습니다.`);
  };

  /**
   * 레시피 내용 클립보드 복사
   */
  const handleCopyRecipeText = async (): Promise<void> => {
    logger.info('RecipeDetailModal.handleCopyRecipeText', `레시피 복사: ${recipe.name}`);
    const textToCopy = `[내 입맛 레시피] ${recipe.name} (${recipe.category})\n\n[재료 (x${portionMultiplier}배)]\n${scaledIngredients.map((i) => `• ${i}`).join('\n')}\n\n[조리 순서]\n${
      steps.length > 0
        ? steps.map((s, idx) => `${idx + 1}. ${s}`).join('\n')
        : '별도 조리법 없음'
    }\n\n출처: 내 입맛 레시피`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      showToast('📋 레시피 내용이 클립보드에 복사되었습니다.');
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      logger.error('RecipeDetailModal.handleCopyRecipeText', '클립보드 복사 실패', err);
      showToast('복사에 실패했습니다. 브라우저 권한을 확인해주세요.');
    }
  };

  /**
   * 브라우저 인쇄 다이얼로그 호출
   */
  const handlePrint = (): void => {
    logger.info('RecipeDetailModal.handlePrint', `레시피 인쇄: ${recipe.name}`);
    window.print();
  };

  /**
   * 사용자 메모 저장
   */
  const handleSaveNote = (): void => {
    logger.info('RecipeDetailModal.handleSaveNote', `메모 저장: ${recipe.name}`);
    onSaveNote(recipe.id, noteText);
    setIsEditingNote(false);
    showToast('📝 나만의 팁/메모가 저장되었습니다.');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modalTitle"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="modal-scroll max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-t-[2rem] bg-white shadow-2xl sm:max-h-[88vh] sm:rounded-[2rem]">
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-orange-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-7">
          <div className="flex items-center gap-3 min-w-0">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-orange-50 text-2xl shadow-inner">
              {recipe.icon || categoryMeta.icon}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${categoryMeta.badgeClass}`}>
                  {recipe.category}
                </span>
                {recipe.cookingTimeMinutes && (
                  <span className="flex items-center gap-1 text-xs text-stone-500">
                    <Clock className="h-3 w-3" />
                    <span>{recipe.cookingTimeMinutes}분</span>
                  </span>
                )}
                {recipe.difficulty && (
                  <span className="flex items-center gap-1 text-xs text-stone-500">
                    <Flame className="h-3 w-3 text-orange-500" />
                    <span>{recipe.difficulty}</span>
                  </span>
                )}
              </div>
              <h2 id="modalTitle" className="truncate font-soft text-xl font-black text-stone-900 sm:text-2xl">
                {recipe.name}
              </h2>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Bookmark Toggle */}
            <button
              type="button"
              onClick={() => onToggleBookmark(recipe.id)}
              className={`grid h-9 w-9 place-items-center rounded-full transition ${
                isBookmarked ? 'bg-amber-100 text-amber-600' : 'bg-stone-100 text-stone-600 hover:bg-orange-100'
              }`}
              title="즐겨찾기 토글"
            >
              <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-amber-500' : ''}`} />
            </button>

            {/* Copy Text */}
            <button
              type="button"
              onClick={handleCopyRecipeText}
              className="grid h-9 w-9 place-items-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-orange-100 hover:text-orange-700"
              title="레시피 복사"
            >
              {isCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-red-100 hover:text-red-600"
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Content Grid */}
        <div className="grid gap-0 lg:grid-cols-[0.88fr_1.12fr]">
          {/* Left Column: Ingredients & Portion Scaler */}
          <section className="border-b border-orange-100 bg-[#fffdfa] p-5 sm:p-7 lg:border-b-0 lg:border-r">
            {/* Portion Scaler Selector */}
            <div className="rounded-2xl border border-orange-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-black text-stone-700">
                  <Scale className="h-4 w-4 text-orange-600" />
                  <span>분량(인분) 계량 조절</span>
                </div>
                <span className="rounded-lg bg-orange-100 px-2 py-0.5 text-xs font-black text-orange-700">
                  {portionMultiplier}배 기준
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-1.5">
                {APP_CONFIG.availablePortionMultipliers.map((mult) => (
                  <button
                    key={mult}
                    type="button"
                    onClick={() => {
                      logger.info('RecipeDetailModal', `배율 변경: ${mult}x`);
                      setPortionMultiplier(mult);
                    }}
                    className={`flex-1 rounded-xl py-1.5 text-xs font-black transition ${
                      portionMultiplier === mult
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'bg-stone-50 text-stone-600 hover:bg-orange-50 hover:text-orange-700'
                    }`}
                  >
                    {mult}x
                  </button>
                ))}
              </div>
            </div>

            {/* Ingredients Header & Actions */}
            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🛒</span>
                <h3 className="font-soft text-lg font-black text-stone-900">
                  필요한 재료 ({scaledIngredients.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={handleAddAllToShopping}
                className="flex items-center gap-1 rounded-xl bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700 transition hover:bg-orange-200"
                title="모든 재료를 장보기 목록에 추가"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                <span>장보기 담기</span>
              </button>
            </div>

            {/* Ingredients Checklist */}
            <ul className="mt-4 space-y-2">
              {scaledIngredients.length > 0 ? (
                scaledIngredients.map((item, idx) => {
                  const isChecked = !!checkedIngredients[idx];
                  return (
                    <li
                      key={idx}
                      onClick={() => handleToggleIngredientCheck(idx)}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl p-3 text-sm transition ${
                        isChecked
                          ? 'bg-stone-100/80 text-stone-400 line-through'
                          : 'bg-white text-stone-800 shadow-sm ring-1 ring-orange-100 hover:bg-orange-50/50'
                      }`}
                    >
                      <button type="button" className="mt-0.5 text-orange-500">
                        {isChecked ? (
                          <CheckSquare className="h-4 w-4 text-stone-400" />
                        ) : (
                          <Square className="h-4 w-4 text-orange-400" />
                        )}
                      </button>
                      <span className="flex-1 leading-relaxed font-medium">{item}</span>
                    </li>
                  );
                })
              ) : (
                <li className="p-4 text-center text-sm text-stone-400">등록된 재료가 없습니다.</li>
              )}
            </ul>

            {/* User Note Section */}
            <div className="mt-8 rounded-2xl border border-orange-100 bg-amber-50/40 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-black text-amber-900">
                  <StickyNote className="h-4 w-4 text-amber-600" />
                  <span>나만의 조리 메모 / 꿀팁</span>
                </div>
                {!isEditingNote && (
                  <button
                    type="button"
                    onClick={() => setIsEditingNote(true)}
                    className="flex items-center gap-1 text-xs font-bold text-amber-700 hover:underline"
                  >
                    <Edit3 className="h-3 w-3" />
                    <span>{userNote ? '수정' : '작성하기'}</span>
                  </button>
                )}
              </div>

              {isEditingNote ? (
                <div className="mt-2.5">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="예: 우리집은 고춧가루를 반 스푼 덜 넣는 게 딱 맞음! 설탕 대신 매실액 추천."
                    rows={3}
                    className="w-full rounded-xl border border-amber-200 bg-white p-2.5 text-xs leading-relaxed text-stone-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNoteText(userNote || '');
                        setIsEditingNote(false);
                      }}
                      className="rounded-lg px-2.5 py-1 text-xs font-bold text-stone-500 hover:bg-stone-100"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveNote}
                      className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-amber-700"
                    >
                      저장
                    </button>
                  </div>
                </div>
              ) : userNote ? (
                <p className="mt-2 text-xs leading-relaxed text-amber-950 whitespace-pre-line">
                  {userNote}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-amber-800/60">
                  이 레시피를 요리하면서 나만의 간 조절 팁이나 메모를 남겨보세요.
                </p>
              )}
            </div>
          </section>

          {/* Right Column: Cooking Steps */}
          <section className="flex flex-col justify-between p-5 sm:p-7">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">👩‍🍳</span>
                  <h3 className="font-soft text-lg font-black text-stone-900">
                    조리 방법 ({steps.length}단계)
                  </h3>
                </div>

                {/* Big CTA for Focus Cooking Mode */}
                {steps.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      logger.info('RecipeDetailModal', `조리 모드 시작: ${recipe.name}`);
                      onStartCookingMode(recipe, portionMultiplier);
                    }}
                    className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-xs font-black text-white shadow-md shadow-orange-500/20 transition hover:from-orange-600 hover:to-amber-600 hover:scale-105"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>조리 모드 시작</span>
                  </button>
                )}
              </div>

              {/* Steps List */}
              <ol className="mt-5 space-y-4">
                {steps.length > 0 ? (
                  steps.map((step, idx) => (
                    <li
                      key={idx}
                      className="group flex gap-3.5 rounded-2xl border border-stone-100 bg-stone-50/50 p-4 transition hover:bg-white hover:shadow-sm"
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-orange-500 text-xs font-black text-white shadow-sm">
                        {idx + 1}
                      </span>
                      <p className="pt-0.5 text-sm leading-relaxed text-stone-700 sm:text-[15px]">
                        {step}
                      </p>
                    </li>
                  ))
                ) : (
                  <li className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/60 p-6 text-center text-sm leading-7 text-stone-600">
                    💡 엑셀 원본에 별도 조리 순서가 입력되어 있지 않습니다.
                    <br />
                    위의 재료를 참고하여 자유롭게 조리해 보세요.
                  </li>
                )}
              </ol>
            </div>

            {/* Bottom Footer Tool Buttons */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-xs font-bold text-stone-600 transition hover:bg-stone-50"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>인쇄하기</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyRecipeText}
                  className="flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-xs font-bold text-stone-600 transition hover:bg-stone-50"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>텍스트 복사</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-stone-900 px-5 py-2.5 text-xs font-black text-white transition hover:bg-stone-800"
              >
                닫기
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
