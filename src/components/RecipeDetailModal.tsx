/**
 * @file src/components/RecipeDetailModal.tsx
 * @description 레시피 상세 정보 모달. 인분 자동 변환(스텝퍼 및 퀵 칩, 기준 인분 안내, 원래 양으로 초기화),
 * 재료 체크박스, 조리 단계별 체크, 장보기 담기, 요리모드 진입, 레시피 수정/삭제, 메모 영속화,
 * 가족 공유 상태 토글 및 원본 사진 미리보기를 지원합니다.
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  Users,
  RotateCcw,
  Minus,
  Plus,
  Lock,
  Camera,
  Image as ImageIcon,
} from 'lucide-react';
import { APP_CONFIG, CATEGORY_CONFIG } from '../config/appConfig';
import { Recipe } from '../types/recipe';
import { getScaledIngredientsList, calculateServingsMultiplier } from '../utils/scaler';
import { logger } from '../utils/logger';

interface RecipeDetailModalProps {
  /** 표시할 레시피 데이터 (null이면 미표시) */
  recipe: Recipe | null;
  /** 북마크 여부 */
  isBookmarked: boolean;
  /** 사용자 레시피 메모 */
  userNote?: string;
  /** 가족 공간 공유 여부 */
  isFamilyShared?: boolean;
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
  /** 가족 공유 상태 토글 핸들러 (선택) */
  onToggleFamilyShare?: (recipe: Recipe) => void;
  /** 관리자 여부 (레시피 수정/삭제 권한) */
  isAdmin?: boolean;
  /** 토스트 메시지 표시 함수 */
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

/**
 * 레시피 상세 모달 컴포넌트
 */
export const RecipeDetailModal: React.FC<RecipeDetailModalProps> = ({
  recipe,
  isBookmarked,
  userNote = '',
  isFamilyShared = false,
  onToggleBookmark,
  onClose,
  onAddShoppingItem,
  onAddAllShoppingItems,
  onOpenCookingMode,
  onOpenEditRecipe,
  onOpenAiModal,
  onDeleteRecipe,
  onSaveNote,
  onToggleFamilyShare,
  isAdmin = false,
  showToast,
}) => {
  const baseServings = recipe?.baseServings || 2;
  const [currentServings, setCurrentServings] = useState<number>(baseServings);
  const [checkedIngredients, setCheckedIngredients] = useState<Record<number, boolean>>({});
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const [noteInput, setNoteInput] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [showSourceImage, setShowSourceImage] = useState<boolean>(false);

  // 모달 열림 시 상태 초기화
  useEffect(() => {
    if (recipe) {
      logger.info('RecipeDetailModal.useEffect', `레시피 상세 모달 열림: ${recipe.name}`);
      setCurrentServings(recipe.baseServings || 2);
      setCheckedIngredients({});
      setCompletedSteps({});
      setNoteInput(userNote || recipe.userNotes || '');
      setIsCopied(false);
      setShowSourceImage(false);

      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [recipe, userNote]);

  // 인분 수 기반 배율 계산
  const portionMultiplier = useMemo(() => {
    return calculateServingsMultiplier(baseServings, currentServings);
  }, [baseServings, currentServings]);

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
      showToast('준비 완료로 모두 체크되었습니다.', 'info');
    }
    setCheckedIngredients(nextState);
  };

  /**
   * 조리 단계 전체 체크/해제 토글
   */
  const handleToggleAllSteps = (): void => {
    const allChecked = rawSteps.every((_, idx) => !!completedSteps[idx]);
    const nextState: Record<number, boolean> = {};
    if (!allChecked) {
      rawSteps.forEach((_, idx) => {
        nextState[idx] = true;
      });
      showToast('모든 조리 단계가 완료로 표시되었습니다.', 'info');
    }
    setCompletedSteps(nextState);
  };

  /**
   * 장보기 목록에 단일 재료 추가
   */
  const handleAddSingleToShopping = (ingredientLine: string): void => {
    logger.info('RecipeDetailModal.handleAddSingleToShopping', `장보기 단일 추가: ${ingredientLine}`);
    onAddShoppingItem(ingredientLine, recipe.name);
    showToast(`'${ingredientLine}'이(가) 장보기 목록에 추가되었습니다.`, 'success');
  };

  /**
   * 장보기 목록에 전체 재료 일괄 추가
   */
  const handleAddAllToShopping = (): void => {
    logger.info('RecipeDetailModal.handleAddAllToShopping', `장보기 전체 추가 (${scaledIngredients.length}개, ${currentServings}인분 기준)`);
    if (scaledIngredients.length === 0) {
      showToast('추가할 재료가 없습니다.', 'info');
      return;
    }
    onAddAllShoppingItems(scaledIngredients, recipe.name);
    showToast(
      `'${recipe.name}'의 ${currentServings}인분 재료 ${scaledIngredients.length}개가 장보기에 추가되었습니다.`,
      'success'
    );
  };

  /**
   * 레시피 텍스트 복사
   */
  const handleCopyRecipeText = async (): Promise<void> => {
    const textToCopy = `[${recipe.name}] (${recipe.category}) - ${currentServings}인분 기준
⏱️ 예상 시간: ${recipe.cookingTimeMinutes ? `${recipe.cookingTimeMinutes}분` : '정보 없음'} / 난이도: ${recipe.difficulty || '보통'}

[재료]
${scaledIngredients.join('\n')}

[조리 순서]
${recipe.method || '등록된 조리 순서 없음'}
${recipe.tip ? `\n[💡 꿀팁]\n${recipe.tip}` : ''}
${userNote ? `\n[📝 나의 메모]\n${userNote}` : ''}`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      showToast('레시피 텍스트가 클립보드에 복사되었습니다.', 'success');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      showToast('클립보드 복사에 실패했습니다.', 'error');
    }
  };

  /**
   * 사용자 메모 저장
   */
  const handleSaveUserNote = (): void => {
    logger.info('RecipeDetailModal.handleSaveUserNote', `메모 저장: 레시피 ID ${recipe.id}`);
    onSaveNote(recipe.id, noteInput);
    showToast('나만의 꿀팁 메모가 저장되었습니다.', 'success');
  };

  return (
    <div
      id="recipe-detail-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-recipe-title"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-amber-50/95 shadow-2xl ring-1 ring-orange-900/10 backdrop-blur-md">
        {/* Sticky Header */}
        <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-orange-100/80 bg-white/90 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="text-3xl sm:text-4xl">{recipe.icon || '🍲'}</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-black ${categoryMeta.badgeClass}`}>
                  {recipe.category}
                </span>
                {recipe.syncScope === 'public' && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-800" title="모든 사용자에게 공개된 레시피">
                    ☁️ 공개
                  </span>
                )}
                {recipe.syncScope === 'private' && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-800" title="내 계정에 저장되어 모든 기기에서 동기화되는 개인 레시피">
                    ☁️ 개인 클라우드
                  </span>
                )}
                {recipe.syncScope === 'local' && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-700" title="현재 기기에만 저장된 로컬 레시피">
                    📱 이 기기
                  </span>
                )}
                {recipe.isCustom && recipe.syncScope !== 'local' && (
                  <span className="inline-flex items-center rounded-lg bg-orange-100 px-2 py-0.5 text-xs font-black text-orange-800">
                    직접 등록
                  </span>
                )}
                {recipe.sharedWithFamily && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2 py-0.5 text-xs font-black text-emerald-800">
                    <Users className="h-3 w-3" />
                    가족 공유
                  </span>
                )}
              </div>
              <h2 id="modal-recipe-title" className="font-soft text-lg font-black text-stone-900 sm:text-xl line-clamp-1 mt-0.5">
                {recipe.name}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Bookmark Button */}
            <button
              type="button"
              onClick={() => onToggleBookmark(recipe.id)}
              className={`rounded-2xl p-2.5 transition-all ${
                isBookmarked
                  ? 'bg-amber-100 text-amber-600 ring-1 ring-amber-300'
                  : 'text-stone-400 hover:bg-stone-100 hover:text-stone-600'
              }`}
              aria-label={isBookmarked ? '즐겨찾기 해제' : '즐겨찾기 추가'}
            >
              <Bookmark className={`h-5 w-5 ${isBookmarked ? 'fill-amber-500 text-amber-500' : ''}`} />
            </button>

            {/* AI Consultation Button */}
            {onOpenAiModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAiModal(recipe);
                }}
                className="flex items-center gap-1 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-2 text-xs font-bold text-white shadow-sm hover:from-orange-600 hover:to-amber-600 active:scale-95 transition-all"
              >
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">AI 질문</span>
              </button>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl p-2.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 active:scale-95 transition-all"
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          {/* Metadata Card (Time, Difficulty, Servings, Source Image) */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-100 bg-white p-4 shadow-xs">
            <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-stone-600">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-orange-500" />
                <span>시간: {recipe.cookingTimeMinutes ? `${recipe.cookingTimeMinutes}분` : '약 15분'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-rose-500" />
                <span>난이도: {recipe.difficulty || '보통'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-amber-500" />
                <span>기준: {baseServings}인분</span>
              </div>
              {recipe.caloriesPerServing && recipe.caloriesPerServing > 0 && (
                <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1 font-bold text-amber-900 border border-amber-200/80">
                  <span className="text-orange-500">🔥</span>
                  <span>{recipe.caloriesPerServing} kcal <span className="text-[10px] font-normal text-amber-700">/ 1인분</span></span>
                </div>
              )}
            </div>

            {/* Extra Actions (Copy Text, Source Image Toggle) */}
            <div className="flex items-center gap-2">
              {recipe.sourceImageUrl && (
                <button
                  type="button"
                  onClick={() => setShowSourceImage(!showSourceImage)}
                  className="flex items-center gap-1 rounded-xl bg-stone-100 px-2.5 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-200"
                >
                  <Camera className="h-3.5 w-3.5 text-stone-500" />
                  <span>{showSourceImage ? '사진 닫기' : '원본 사진'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleCopyRecipeText}
                className="flex items-center gap-1 rounded-xl bg-stone-100 px-2.5 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-200"
                title="레시피 전체 복사"
              >
                {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{isCopied ? '복사됨' : '복사'}</span>
              </button>
            </div>
          </div>

          {/* Calorie Detailed Card (If analyzed) */}
          {recipe.caloriesPerServing && recipe.caloriesPerServing > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50/90 via-orange-50/80 to-amber-50/90 p-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500 text-white shadow-xs">
                    🔥
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-soft text-sm font-black text-amber-950">
                        1인분 예상 칼로리
                      </span>
                      <span className="text-base font-black text-amber-700">
                        {recipe.caloriesPerServing} <span className="text-xs font-normal">kcal</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800/80">
                      현재 <span className="font-bold text-amber-900">{currentServings}인분</span> 기준 총 예상 열량: 약 <span className="font-black text-amber-950">{Math.round(recipe.caloriesPerServing * currentServings)} kcal</span>
                    </p>
                  </div>
                </div>

                <div className="text-right text-[11px] text-amber-700/70 sm:self-center">
                  <span>※ 재료·분량 기반 추정치 (의료·영양 측정값 아님)</span>
                  {recipe.calorieBreakdown && (
                    <div className="mt-0.5 text-stone-600 font-medium">
                      {recipe.calorieBreakdown}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Source Image View (If applicable) */}
          {showSourceImage && recipe.sourceImageUrl && (
            <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-xs animate-scale-up">
              <div className="flex items-center justify-between pb-2 text-xs font-bold text-stone-600">
                <span>📷 촬영/참고한 원본 레시피 사진</span>
                <button
                  type="button"
                  onClick={() => setShowSourceImage(false)}
                  className="text-stone-400 hover:text-stone-600"
                >
                  ×
                </button>
              </div>
              <img
                src={recipe.sourceImageUrl}
                alt="원본 레시피 사진"
                className="max-h-80 w-full rounded-xl object-contain bg-stone-900"
              />
            </div>
          )}

          {/* Servings Stepper & Portion Multiplier Tool */}
          <section className="rounded-2xl border border-orange-200 bg-gradient-to-b from-orange-50/70 to-white p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="font-soft text-sm font-black text-stone-900 flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-orange-600" />
                  인분 수 조절 및 계량 자동 변환
                </h3>
                <p className="text-xs text-stone-500">
                  인분을 조절하면 아래 재료 수량이 자동으로 정확하게 재계산됩니다.
                </p>
              </div>

              {/* Stepper Controls */}
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-2xl bg-white p-1 ring-1 ring-stone-200 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setCurrentServings((prev) => Math.max(1, prev - 1))}
                    disabled={currentServings <= 1}
                    className="rounded-xl p-2 text-stone-600 hover:bg-stone-100 disabled:opacity-30 disabled:pointer-events-none"
                    aria-label="1인분 줄이기"
                  >
                    <Minus className="h-4 w-4" />
                  </button>

                  <span className="font-soft px-4 text-base font-black text-orange-600 min-w-[70px] text-center">
                    {currentServings}인분
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentServings((prev) => Math.min(12, prev + 1))}
                    disabled={currentServings >= 12}
                    className="rounded-xl p-2 text-stone-600 hover:bg-stone-100 disabled:opacity-30 disabled:pointer-events-none"
                    aria-label="1인분 늘리기"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {/* Reset to Base Servings Button */}
                {currentServings !== baseServings && (
                  <button
                    type="button"
                    onClick={() => setCurrentServings(baseServings)}
                    className="flex items-center gap-1 rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold text-stone-600 hover:bg-stone-200 active:scale-95"
                    title="원래 레시피 양으로 복원"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>원래 양으로</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Portion Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-orange-100">
              <span className="text-[11px] font-bold text-stone-400 mr-1">빠른 선택:</span>
              {[1, 2, 3, 4, 6].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setCurrentServings(num)}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
                    currentServings === num
                      ? 'bg-orange-500 text-white shadow-xs'
                      : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  {num}인분 {num === baseServings ? '(기본)' : ''}
                </button>
              ))}
            </div>
          </section>

          {/* Ingredients Section */}
          <section className="rounded-2xl border border-orange-100 bg-white p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-soft text-base font-black text-stone-900">
                  필요한 재료
                </h3>
                <span className="text-xs font-bold text-orange-600">
                  ({currentServings}인분 계량 적용)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleAllIngredients}
                  className="text-xs font-bold text-stone-500 hover:text-stone-800"
                >
                  전체 준비 완료 체크
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={handleAddAllToShopping}
                  className="flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900"
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  <span>전체 장보기 담기</span>
                </button>
              </div>
            </div>

            {/* Ingredients List */}
            {scaledIngredients.length === 0 ? (
              <p className="py-4 text-center text-xs text-stone-400">등록된 재료가 없습니다.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {scaledIngredients.map((ingredientLine, idx) => {
                  const isChecked = !!checkedIngredients[idx];
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between rounded-xl p-2.5 transition-all ${
                        isChecked
                          ? 'bg-stone-50 text-stone-400 line-through'
                          : 'bg-orange-50/40 text-stone-800 hover:bg-orange-50/70'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleIngredientCheck(idx)}
                        className="flex flex-1 items-center gap-2.5 text-left text-xs sm:text-sm"
                      >
                        {isChecked ? (
                          <CheckSquare className="h-4 w-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Square className="h-4 w-4 text-stone-300 shrink-0" />
                        )}
                        <span className="font-medium">{ingredientLine}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddSingleToShopping(ingredientLine)}
                        className="ml-2 rounded-lg p-1 text-stone-400 hover:bg-white hover:text-emerald-600"
                        title="장보기에 추가"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Cooking Steps Section */}
          <section className="rounded-2xl border border-orange-100 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-soft text-base font-black text-stone-900">
                조리 순서
              </h3>
              <button
                type="button"
                onClick={handleToggleAllSteps}
                className="text-xs font-bold text-stone-500 hover:text-stone-800"
              >
                전체 완료 체크
              </button>
            </div>

            {rawSteps.length === 0 ? (
              <p className="py-4 text-center text-xs text-stone-400">등록된 조리 순서가 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {rawSteps.map((stepText, idx) => {
                  const isDone = !!completedSteps[idx];
                  return (
                    <div
                      key={idx}
                      onClick={() => handleToggleStepCheck(idx)}
                      className={`cursor-pointer flex items-start gap-3 rounded-2xl p-4 transition-all ${
                        isDone
                          ? 'bg-stone-50 text-stone-400 opacity-60'
                          : 'bg-stone-50/80 text-stone-800 hover:bg-orange-50/50'
                      }`}
                    >
                      <div
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                          isDone ? 'bg-emerald-500 text-white' : 'bg-orange-500 text-white'
                        }`}
                      >
                        {isDone ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                      </div>
                      <p className={`flex-1 text-xs sm:text-sm leading-relaxed ${isDone ? 'line-through' : 'font-medium'}`}>
                        {stepText}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Chef Tip Card (If available) */}
          {recipe.tip && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-950 space-y-1">
              <span className="font-soft font-black text-amber-800">💡 셰프의 특급 비법:</span>
              <p className="leading-relaxed text-stone-700">{recipe.tip}</p>
            </div>
          )}

          {/* User Notes Section */}
          <section className="rounded-2xl border border-orange-100 bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-amber-500" />
              <h3 className="font-soft text-sm font-bold text-stone-900">
                나만의 요리 꿀팁 & 메모
              </h3>
            </div>
            <textarea
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="예: 우리 집 간장으로는 1.5스푼이 딱 맞음. 고추장 대신 쌈장 반 스푼 넣으면 더 감칠맛 남!"
              rows={3}
              className="w-full rounded-xl border border-stone-200 bg-stone-50/60 p-3 text-xs text-stone-800 placeholder-stone-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 sm:text-sm"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveUserNote}
                className="rounded-xl bg-stone-800 px-4 py-2 font-soft text-xs font-bold text-white hover:bg-stone-900 active:scale-95"
              >
                메모 저장
              </button>
            </div>
          </section>

          {/* Custom Recipe Management (Edit / Delete / Family Share) */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-stone-200/60">
            <div className="flex items-center gap-2">
              {onToggleFamilyShare && (
                <button
                  type="button"
                  onClick={() => onToggleFamilyShare(recipe)}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                    isFamilyShared
                      ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300 shadow-xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {isFamilyShared ? (
                    <Users className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-stone-400" />
                  )}
                  <span>{isFamilyShared ? '👨‍👩‍👧 가족 공간에 공유 중' : '👨‍👩‍👧 가족에게 공유하기'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenEditRecipe(recipe);
                    }}
                    className="flex items-center gap-1 rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-200"
                    title="레시피 수정"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-stone-600" />
                    <span>레시피 수정</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onDeleteRecipe(recipe.id);
                    }}
                    className="flex items-center gap-1 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                    title="레시피 삭제"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>삭제</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Modal Sticky Bottom Action Bar */}
        <footer className="sticky bottom-0 z-20 flex shrink-0 items-center justify-between border-t border-orange-100/80 bg-white/95 px-6 py-4 backdrop-blur-md">
          <div className="text-xs font-medium text-stone-500">
            현재 <span className="font-bold text-orange-600">{currentServings}인분</span> ({portionMultiplier}배) 설정
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleAddAllToShopping}
              className="flex items-center gap-1.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 font-soft text-xs font-bold text-emerald-800 shadow-xs hover:bg-emerald-100 active:scale-95 transition-all"
            >
              <ShoppingCart className="h-4 w-4 text-emerald-600" />
              <span>장보기 담기</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCookingMode(recipe, portionMultiplier);
              }}
              className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 font-soft text-xs font-bold text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600 active:scale-95 transition-all"
            >
              <ChefHat className="h-4 w-4" />
              <span>🍳 요리 시작 (조리 모드)</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
