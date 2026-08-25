/**
 * @file src/components/RecipeDetailModal.tsx
 * @description 레시피 상세 정보 모달. 재료 체크박스, 조리 단계별 체크, 인분 조절, 장보기 담기, 요리모드 진입, 레시피 수정/삭제, 메모 영속화 및 고정 헤더 지원
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Bookmark,
  Share2,
  ShoppingCart,
  ChefHat,
  Clock,
  Flame,
  Check,
  CheckCircle2,
  Square,
  CheckSquare,
  Edit3,
  Trash2,
  StickyNote,
  Copy,
  Sparkles,
} from 'lucide-react';
import { APP_CONFIG, CATEGORY_CONFIG } from '../config/appConfig';
import { Recipe } from '../types/recipe';
import { getScaledIngredientsList } from '../utils/scaler';
import { logger } from '../utils/logger';

interface RecipeDetailModalProps {
  /** 표시할 레시피 데이터 (null이면 미표시) */
  recipe: Recipe | null;
  /** 북마크 여부 */
  isBookmarked: boolean;
  /** 사용자 레시피 메모 */
  userNote?: string;
  /** 북마크 토글 핸들러 */
  onToggleBookmark: (recipeId: number) => void;
  /** 모달 닫기 핸들러 */
  onClose: () => void;
  /** 장보기 목록에 재료 추가 핸들러 */
  onAddShoppingItem: (itemText: string, sourceName?: string) => void;
  /** 장보기 목록 일괄 추가 핸들러 */
  onAddAllShoppingItems: (items: string[], sourceName?: string) => void;
  /** 조리 모드 열기 핸들러 */
  onOpenCookingMode: (recipe: Recipe, multiplier: number) => void;
  /** 레시피 수정 모달 열기 핸들러 */
  onOpenEditRecipe: (recipe: Recipe) => void;
  /** AI 질의응답 모달 열기 핸들러 */
  onOpenAiModal?: (recipe: Recipe) => void;
  /** 레시피 삭제 요청 핸들러 */
  onDeleteRecipe: (recipeId: number) => void;
  /** 사용자 메모 저장 핸들러 */
  onSaveNote: (recipeId: number, note: string) => void;
  /** 토스트 메시지 표시 함수 */
  showToast: (msg: string) => void;
}

/**
 * 레시피 상세 모달 컴포넌트
 */
export const RecipeDetailModal: React.FC<RecipeDetailModalProps> = ({
  recipe,
  isBookmarked,
  userNote = '',
  onToggleBookmark,
  onClose,
  onAddShoppingItem,
  onAddAllShoppingItems,
  onOpenCookingMode,
  onOpenEditRecipe,
  onOpenAiModal,
  onDeleteRecipe,
  onSaveNote,
  showToast,
}) => {
  const [portionMultiplier, setPortionMultiplier] = useState<number>(1);
  const [checkedIngredients, setCheckedIngredients] = useState<Record<number, boolean>>({});
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const [noteInput, setNoteInput] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // 모달 열림 시 상태 초기화 및 바디 스크롤 락
  useEffect(() => {
    if (recipe) {
      logger.info('RecipeDetailModal.useEffect', `레시피 상세 모달 열림: ${recipe.name}`);
      setPortionMultiplier(1);
      setCheckedIngredients({});
      setCompletedSteps({});
      setNoteInput(userNote || recipe.userNotes || '');
      setIsCopied(false);

      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [recipe, userNote]);

  if (!recipe) return null;

  const categoryMeta = CATEGORY_CONFIG[recipe.category] || CATEGORY_CONFIG['기타'];

  // 재료 배열 파싱 및 스케일링
  const rawIngredients = recipe.ingredients
    ? recipe.ingredients
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const scaledIngredients = getScaledIngredientsList(recipe.ingredients, portionMultiplier);

  // 조리 단계 배열 파싱
  const rawSteps = recipe.method && recipe.method !== '-'
    ? recipe.method
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  /**
   * 재료 체크박스 토글
   * @param idx 재료 인덱스
   */
  const handleToggleIngredientCheck = (idx: number): void => {
    setCheckedIngredients((prev) => {
      const next = { ...prev, [idx]: !prev[idx] };
      logger.debug('RecipeDetailModal.handleToggleIngredientCheck', `재료 #${idx} 체크 토글: ${next[idx]}`);
      return next;
    });
  };

  /**
   * 조리 단계 체크 토글
   * @param idx 단계 인덱스
   */
  const handleToggleStepCheck = (idx: number): void => {
    setCompletedSteps((prev) => {
      const next = { ...prev, [idx]: !prev[idx] };
      logger.debug('RecipeDetailModal.handleToggleStepCheck', `단계 #${idx} 체크 토글: ${next[idx]}`);
      return next;
    });
  };

  /**
   * 재료 전체 체크/해제 토글
   */
  const handleToggleAllIngredients = (): void => {
    const allChecked = scaledIngredients.every((_, idx) => !!checkedIngredients[idx]);
    const nextState: Record<number, boolean> = {};
    if (!allChecked) {
      scaledIngredients.forEach((_, idx) => {
        nextState[idx] = true;
      });
      showToast('준비 완료로 모두 체크되었습니다.');
    }
    setCheckedIngredients(nextState);
  };

  /**
   * 장보기 목록에 모든 재료 일괄 담기
   */
  const handleAddAllToShopping = (): void => {
    logger.info('RecipeDetailModal.handleAddAllToShopping', `전체 재료 장보기 담기: ${scaledIngredients.length}개`);
    onAddAllShoppingItems(scaledIngredients, recipe.name);
    showToast(`🛒 '${recipe.name}' 재료 ${scaledIngredients.length}개가 장보기 목록에 담겼습니다!`);
  };

  /**
   * 레시피 텍스트 복사 핸들러
   */
  const handleCopyRecipeText = (): void => {
    logger.info('RecipeDetailModal.handleCopyRecipeText', `레시피 복사: ${recipe.name}`);
    const textToCopy = `[${recipe.name} (${recipe.category})]\n\n■ 재료 (${portionMultiplier}인분/배):\n${scaledIngredients.join(
      '\n'
    )}\n\n■ 조리 순서:\n${rawSteps.map((st, i) => `${i + 1}. ${st}`).join('\n')}\n\n- 출처: 내 입맛 레시피`;

    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        setIsCopied(true);
        showToast('📋 레시피 내용이 클립보드에 복사되었습니다.');
        setTimeout(() => setIsCopied(false), 2000);
      })
      .catch(() => {
        showToast('⚠️ 복사에 실패했습니다.');
      });
  };

  /**
   * 사용자 메모 저장 핸들러
   */
  const handleSaveNote = (): void => {
    logger.info('RecipeDetailModal.handleSaveNote', `메모 저장: 레시피 ID ${recipe.id}`);
    onSaveNote(recipe.id, noteInput);
    showToast('📝 나만의 레시피 메모가 저장되었습니다.');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modalRecipeName"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-scroll relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-2xl sm:max-h-[88vh] sm:rounded-[2rem]">
        {/* Sticky Fixed Header */}
        <div className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-orange-100 bg-[#fffaf3]/95 px-4 py-3.5 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-orange-100 text-lg sm:h-10 sm:w-10 sm:text-xl">
              {recipe.icon || categoryMeta.icon}
            </span>
            <div className="min-w-0">
              <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-extrabold ${categoryMeta.badgeClass}`}>
                {recipe.category}
              </span>
              <h2 id="modalRecipeName" className="truncate font-soft text-base font-black text-stone-900 sm:text-lg">
                {recipe.name}
              </h2>
            </div>
          </div>

          {/* Header Action Tools */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Edit Button */}
            <button
              type="button"
              onClick={() => {
                logger.info('RecipeDetailModal', `수정 모달 열기 요청: ${recipe.name}`);
                onOpenEditRecipe(recipe);
              }}
              className="flex h-9 items-center gap-1 rounded-xl border border-stone-200 bg-white px-2.5 text-xs font-bold text-stone-700 shadow-xs transition hover:bg-stone-50"
              title="레시피 수정"
              aria-label="레시피 수정하기"
            >
              <Edit3 className="h-3.5 w-3.5 text-orange-600" />
              <span className="hidden sm:inline">수정</span>
            </button>

            {/* Bookmark Button */}
            <button
              type="button"
              onClick={() => onToggleBookmark(recipe.id)}
              className={`grid h-9 w-9 place-items-center rounded-xl transition ${
                isBookmarked
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-stone-100 text-stone-400 hover:bg-orange-100 hover:text-orange-600'
              }`}
              title={isBookmarked ? '즐겨찾기 해제' : '즐겨찾기 추가'}
              aria-label={isBookmarked ? '즐겨찾기 해제' : '즐겨찾기 추가'}
            >
              <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-amber-500 text-amber-500' : ''}`} />
            </button>

            {/* Delete Button (if custom recipe) */}
            <button
              type="button"
              onClick={() => onDeleteRecipe(recipe.id)}
              className="grid h-9 w-9 place-items-center rounded-xl text-stone-400 transition hover:bg-red-50 hover:text-red-500"
              title="레시피 삭제"
              aria-label="레시피 삭제하기"
            >
              <Trash2 className="h-4 w-4" />
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-xl bg-stone-100 text-stone-600 transition hover:bg-stone-200"
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {/* Optional Large Photo Display (4:3 aspect ratio) */}
          {recipe.imageUrl && (
            <div className="relative mb-5 aspect-[4/3] w-full overflow-hidden rounded-2xl bg-stone-100 shadow-inner">
              <img
                src={recipe.imageUrl}
                alt={recipe.name}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </div>
          )}

          {/* Quick Meta Info Badges */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600">
            {recipe.cookingTimeMinutes && (
              <span className="flex items-center gap-1 rounded-xl bg-stone-100 px-3 py-1.5 font-bold">
                <Clock className="h-3.5 w-3.5 text-stone-400" />
                <span>조리시간 {recipe.cookingTimeMinutes}분</span>
              </span>
            )}
            {recipe.difficulty && (
              <span className="flex items-center gap-1 rounded-xl bg-stone-100 px-3 py-1.5 font-bold">
                <Flame className="h-3.5 w-3.5 text-orange-500" />
                <span>난이도 {recipe.difficulty}</span>
              </span>
            )}
            <span className="rounded-xl bg-orange-50 px-3 py-1.5 font-bold text-orange-700">
              재료 {scaledIngredients.length}가지
            </span>
            {rawSteps.length > 0 && (
              <span className="rounded-xl bg-amber-50 px-3 py-1.5 font-bold text-amber-700">
                조리 {rawSteps.length}단계
              </span>
            )}
          </div>

          {/* Focus Cooking Mode & AI Assistant Action Banners */}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {rawSteps.length > 0 && (
              <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 p-4 text-white shadow-md">
                <div>
                  <h3 className="font-soft text-sm font-extrabold">
                    🍳 집중 조리 모드
                  </h3>
                  <p className="text-[11px] text-orange-100">
                    화면 꺼짐 방지 & 큰 글씨
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    logger.info('RecipeDetailModal', `집중 조리 모드 시작: ${recipe.name}`);
                    onOpenCookingMode(recipe, portionMultiplier);
                  }}
                  className="rounded-xl bg-white px-3.5 py-2 text-xs font-black text-orange-600 shadow-sm transition hover:bg-orange-50 active:scale-95"
                >
                  요리 시작
                </button>
              </div>
            )}

            {/* AI Recipe Assistant Button */}
            {onOpenAiModal && (
              <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 shadow-xs">
                <div>
                  <div className="flex items-center gap-1 font-soft text-sm font-extrabold text-amber-900">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                    <span>AI에게 물어보기</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    대체 재료 · 특급 비법 · 곁들임 추천
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    logger.info('RecipeDetailModal', `AI 질문 모달 열기: ${recipe.name}`);
                    onOpenAiModal(recipe);
                  }}
                  className="rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-black text-white shadow-sm transition hover:bg-amber-600 active:scale-95"
                >
                  질문하기
                </button>
              </div>
            )}
          </div>

          {/* Portion Scaling Selector */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-100 bg-[#fffaf3] p-4">
            <div>
              <span className="block text-xs font-bold text-stone-800">
                분량 및 인분 조절 ({portionMultiplier}배)
              </span>
              <span className="text-[11px] text-stone-500">
                재료의 양이 비율에 맞게 자동 계산됩니다.
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {APP_CONFIG.availablePortionMultipliers.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPortionMultiplier(m)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    portionMultiplier === m
                      ? 'bg-orange-500 text-white shadow-xs'
                      : 'bg-white text-stone-600 hover:bg-orange-100'
                  }`}
                >
                  {m}배
                </button>
              ))}
            </div>
          </div>

          {/* Section: Ingredients with Checkboxes */}
          <div className="mt-6">
            <div className="flex items-center justify-between border-b border-orange-100 pb-2.5">
              <div className="flex items-center gap-2">
                <h3 className="font-soft text-base font-black text-stone-900">
                  필요한 재료 ({scaledIngredients.length})
                </h3>
                <button
                  type="button"
                  onClick={handleToggleAllIngredients}
                  className="rounded-lg bg-stone-100 px-2 py-0.5 text-[11px] font-bold text-stone-600 hover:bg-stone-200"
                >
                  전체 체크/해제
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddAllToShopping}
                className="flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700"
                title="모든 재료를 장보기 목록에 담기"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                <span>장보기 일괄담기</span>
              </button>
            </div>

            <ul className="mt-3 space-y-2">
              {scaledIngredients.map((item, idx) => {
                const isChecked = !!checkedIngredients[idx];
                return (
                  <li
                    key={idx}
                    className={`flex items-center justify-between rounded-xl border p-3 text-xs transition ${
                      isChecked
                        ? 'border-stone-200 bg-stone-50/80 text-stone-400'
                        : 'border-orange-100/90 bg-white text-stone-800 hover:border-orange-300'
                    }`}
                  >
                    <label className="flex flex-1 items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleIngredientCheck(idx)}
                        className="hidden"
                      />
                      {isChecked ? (
                        <CheckSquare className="h-4 w-4 shrink-0 text-orange-500" />
                      ) : (
                        <Square className="h-4 w-4 shrink-0 text-stone-300" />
                      )}
                      <span className={isChecked ? 'line-through text-stone-400' : 'font-semibold'}>
                        {item}
                      </span>
                    </label>

                    {/* Single Item Add to Shopping List */}
                    <button
                      type="button"
                      onClick={() => {
                        onAddShoppingItem(item, recipe.name);
                        showToast(`🛒 '${item}'을(를) 장보기 목록에 담았습니다.`);
                      }}
                      className="ml-2 rounded-lg p-1.5 text-stone-400 hover:bg-orange-50 hover:text-orange-600"
                      title="이 재료만 장보기 담기"
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Section: Cooking Method with Step Check */}
          <div className="mt-8">
            <div className="flex items-center justify-between border-b border-orange-100 pb-2.5">
              <h3 className="font-soft text-base font-black text-stone-900">
                조리 순서 {rawSteps.length > 0 && `(${rawSteps.length}단계)`}
              </h3>
              <span className="text-[11px] text-stone-400">완료한 단계는 클릭하여 체크</span>
            </div>

            {rawSteps.length > 0 ? (
              <ol className="mt-3 space-y-3">
                {rawSteps.map((step, idx) => {
                  const isDone = !!completedSteps[idx];
                  return (
                    <li
                      key={idx}
                      onClick={() => handleToggleStepCheck(idx)}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                        isDone
                          ? 'border-emerald-200 bg-emerald-50/40 text-stone-500'
                          : 'border-orange-100/90 bg-white text-stone-800 hover:border-orange-300'
                      }`}
                    >
                      <div
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black transition ${
                          isDone
                            ? 'bg-emerald-500 text-white'
                            : 'bg-orange-100 text-orange-700'
                        }`}
                      >
                        {isDone ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                      </div>
                      <p className={`flex-1 text-xs sm:text-sm leading-relaxed ${isDone ? 'line-through text-stone-400' : ''}`}>
                        {step}
                      </p>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="mt-3 text-xs text-stone-400">상세 조리 순서 정보가 등록되어 있지 않습니다.</p>
            )}
          </div>

          {/* Section: Personal Recipe Notes */}
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-soft text-xs font-bold text-amber-900">
                <StickyNote className="h-4 w-4 text-amber-600" />
                <span>나만의 조리 팁 & 메모</span>
              </div>
              <button
                type="button"
                onClick={handleSaveNote}
                className="rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-amber-600"
              >
                메모 저장
              </button>
            </div>
            <textarea
              rows={2}
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="예: 물 1스푼 추가하면 더 촉촉함, 우리 집 고춧가루는 매우니 0.5스푼만 넣기"
              className="mt-2.5 w-full rounded-xl border border-amber-200 bg-white p-2.5 text-xs leading-relaxed text-stone-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
          </div>

          {/* Quick Copy Recipe Button */}
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleCopyRecipeText}
              className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-600 transition hover:bg-stone-50"
            >
              {isCopied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{isCopied ? '복사 완료!' : '레시피 텍스트 복사'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
