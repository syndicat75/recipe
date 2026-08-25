/**
 * @file src/components/ImportRecipeModal.tsx
 * @description 외부 레시피 가져오기 모달 컴포넌트. 웹페이지 URL 또는 레시피 텍스트 붙여넣기를 통해 Gemini AI로 구조화 분석 후 검토 및 저장 지원
 */

import React, { useState } from 'react';
import {
  X,
  Link2,
  FileText,
  Sparkles,
  Loader2,
  Check,
  AlertCircle,
  Save,
  ArrowRight,
  Clock,
  Flame,
  ChefHat,
} from 'lucide-react';
import { APP_CONFIG, CATEGORY_CONFIG, CATEGORY_LIST } from '../config/appConfig';
import { Recipe, RecipeCategory } from '../types/recipe';
import { logger } from '../utils/logger';

interface ImportRecipeModalProps {
  /** 모달 열림 여부 */
  isOpen: boolean;
  /** 현재 등록된 전체 레시피 목록 (중복 체크용) */
  existingRecipes: Recipe[];
  /** 모달 닫기 핸들러 */
  onClose: () => void;
  /** 레시피 저장 핸들러 */
  onSaveRecipe: (recipe: Recipe, isBookmarked: boolean, userNote: string) => void;
  /** 토스트 메시지 표시 함수 */
  showToast: (msg: string) => void;
}

/**
 * 외부 레시피 AI 추출 및 가져오기 모달 컴포넌트
 */
export const ImportRecipeModal: React.FC<ImportRecipeModalProps> = ({
  isOpen,
  existingRecipes,
  onClose,
  onSaveRecipe,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'url' | 'text'>('url');
  const [urlInput, setUrlInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // AI 분석 결과 검토 상태 (Step 2)
  const [parsedRecipe, setParsedRecipe] = useState<{
    name: string;
    category: RecipeCategory;
    icon: string;
    ingredients: string;
    method: string;
    cookingTimeMinutes: number;
    difficulty: '쉬움' | '보통' | '어려움';
    tips?: string;
  } | null>(null);

  if (!isOpen) return null;

  /**
   * AI 분석 요청 핸들러
   * @param e 폼 이벤트
   */
  const handleAnalyze = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setErrorMsg(null);

    const targetUrl = urlInput.trim();
    const targetText = textInput.trim();

    if (activeTab === 'url' && !targetUrl) {
      setErrorMsg('가져올 레시피 웹페이지 URL을 입력해주세요.');
      return;
    }
    if (activeTab === 'text' && !targetText) {
      setErrorMsg('레시피 내용이나 재료/조리법 텍스트를 입력해주세요.');
      return;
    }

    logger.info('ImportRecipeModal.handleAnalyze', `AI 레시피 분석 시작 (탭: ${activeTab})`);
    setIsLoading(true);

    try {
      const response = await fetch(APP_CONFIG.ai.importEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: activeTab === 'url' ? targetUrl : undefined,
          text: activeTab === 'text' ? targetText : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '레시피 분석에 실패했습니다.');
      }

      const resData = data.data;
      logger.info('ImportRecipeModal.handleAnalyze', `AI 분석 성공: ${resData.name}`);

      // 유효 카테고리 매핑
      let cat: RecipeCategory = '기타';
      if (CATEGORY_LIST.includes(resData.category)) {
        cat = resData.category as RecipeCategory;
      }

      setParsedRecipe({
        name: resData.name || '새로운 레시피',
        category: cat,
        icon: resData.icon || '🍳',
        ingredients: resData.ingredients || '',
        method: resData.method || '-',
        cookingTimeMinutes: Number(resData.cookingTimeMinutes) || 15,
        difficulty: resData.difficulty || '쉬움',
        tips: resData.tips || '',
      });

      showToast('✨ AI가 레시피를 성공적으로 분석했습니다! 내용을 확인하고 저장해주세요.');
    } catch (err) {
      logger.error('ImportRecipeModal.handleAnalyze', '분석 실패', err);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : '레시피를 분석하는 중 문제가 발생했습니다. 텍스트 직접 입력 탭을 이용해보세요.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 최종 검토 후 레시피 저장 핸들러
   */
  const handleFinalSave = (): void => {
    if (!parsedRecipe) return;

    logger.info('ImportRecipeModal.handleFinalSave', `가져온 레시피 저장: ${parsedRecipe.name}`);

    // 중복 확인
    const isDuplicate = existingRecipes.some(
      (r) => r.name.trim().toLowerCase() === parsedRecipe.name.trim().toLowerCase()
    );

    let finalName = parsedRecipe.name.trim();
    if (isDuplicate) {
      finalName = `${finalName} (가져옴)`;
    }

    const ingLines = parsedRecipe.ingredients
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const stepLines = parsedRecipe.method
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const newRecipe: Recipe = {
      id: Date.now(),
      name: finalName,
      category: parsedRecipe.category,
      icon: parsedRecipe.icon || '🍳',
      ingredients: parsedRecipe.ingredients.trim(),
      method: parsedRecipe.method.trim() || '-',
      ingredientCount: ingLines.length,
      stepCount: stepLines.length,
      cookingTimeMinutes: parsedRecipe.cookingTimeMinutes || 15,
      difficulty: parsedRecipe.difficulty || '쉬움',
      isCustom: true,
      isBookmarked: false,
      userNotes: parsedRecipe.tips ? `[AI 셰프 꿀팁]\n${parsedRecipe.tips}` : undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    onSaveRecipe(newRecipe, false, newRecipe.userNotes || '');
    showToast(`🎉 '${newRecipe.name}' 레시피가 내 요리책에 추가되었습니다!`);
    handleResetAndClose();
  };

  /**
   * 모달 닫기 및 상태 초기화
   */
  const handleResetAndClose = (): void => {
    setUrlInput('');
    setTextInput('');
    setParsedRecipe(null);
    setErrorMsg(null);
    setIsLoading(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="importRecipeTitle"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) handleResetAndClose();
      }}
    >
      <div className="modal-scroll max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white p-5 shadow-2xl sm:p-7">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-orange-100 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-xl text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h2 id="importRecipeTitle" className="font-soft text-xl font-black text-stone-900 sm:text-2xl">
                외부 레시피 가져오기
              </h2>
              <p className="text-xs font-semibold text-stone-500">
                인터넷 웹페이지 URL이나 텍스트를 넣으면 AI가 재료와 조리순서로 자동 정리해줍니다.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isLoading}
            onClick={handleResetAndClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-red-100 hover:text-red-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step 1: Input Form (URL or Text) */}
        {!parsedRecipe ? (
          <form onSubmit={handleAnalyze} className="mt-5 space-y-4">
            {/* Tab Selection */}
            <div className="flex gap-2 rounded-2xl bg-stone-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('url');
                  setErrorMsg(null);
                }}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
                  activeTab === 'url'
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Link2 className="h-4 w-4" />
                <span>웹페이지 URL 입력</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('text');
                  setErrorMsg(null);
                }}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
                  activeTab === 'text'
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <FileText className="h-4 w-4" />
                <span>레시피 텍스트 붙여넣기</span>
              </button>
            </div>

            {/* URL Input */}
            {activeTab === 'url' && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-stone-700">
                  블로그, 요리 사이트, 유튜브 레시피 링크 (URL)
                </label>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://m.blog.naver.com/... 또는 만개의레시피 URL"
                  className="w-full rounded-xl border border-orange-200 bg-[#fffdfa] px-3.5 py-3 text-xs text-stone-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
                <p className="text-[11px] text-stone-400">
                  💡 일부 웹사이트는 보안상 직접 읽기가 제한될 수 있습니다. 그럴 경우 텍스트 붙여넣기를 활용해주세요.
                </p>
              </div>
            )}

            {/* Text Input */}
            {activeTab === 'text' && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-stone-700">
                  레시피 메모 또는 게시글 본문 복사 붙여넣기
                </label>
                <textarea
                  rows={6}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="예:&#10;초간단 된장찌개 레시피 공유합니다!&#10;재료: 감자 1개, 두부 반모, 애호박 1/3개, 대파 반대, 된장 2스푼, 다진마늘 1스푼, 멸치다시마 육수 400ml&#10;만드는 법: 1. 냄비에 육수를 붓고 감자를 먼저 넣고 끓입니다..."
                  className="w-full rounded-xl border border-orange-200 bg-[#fffdfa] p-3 text-xs leading-relaxed text-stone-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
              </div>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                <p>{errorMsg}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 border-t border-orange-100 pt-4">
              <button
                type="button"
                disabled={isLoading}
                onClick={handleResetAndClose}
                className="rounded-xl px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-100"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-xs font-black text-white shadow-md transition hover:from-orange-600 hover:to-amber-600 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>AI가 레시피 분석 중...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>AI 레시피 자동 분석</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Step 2: Review and Edit Parsed Recipe */
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-xs font-bold text-emerald-800">
              ✅ AI가 내용을 성공적으로 정리했습니다. 저장하기 전 내용을 검토하거나 수정할 수 있습니다.
            </div>

            {/* Name, Category, Icon */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-stone-700">요리명 *</label>
                <input
                  type="text"
                  value={parsedRecipe.name}
                  onChange={(e) => setParsedRecipe({ ...parsedRecipe, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-orange-200 bg-[#fffdfa] px-3.5 py-2 text-xs font-bold text-stone-800 outline-none focus:border-orange-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700">카테고리</label>
                <select
                  value={parsedRecipe.category}
                  onChange={(e) =>
                    setParsedRecipe({ ...parsedRecipe, category: e.target.value as RecipeCategory })
                  }
                  className="mt-1 w-full rounded-xl border border-orange-200 bg-[#fffdfa] px-3 py-2 text-xs text-stone-800 outline-none focus:border-orange-400"
                >
                  {CATEGORY_LIST.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Time, Difficulty */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700">소요 시간 (분)</label>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={parsedRecipe.cookingTimeMinutes}
                  onChange={(e) =>
                    setParsedRecipe({
                      ...parsedRecipe,
                      cookingTimeMinutes: Number(e.target.value) || 15,
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-orange-200 bg-[#fffdfa] px-3.5 py-2 text-xs text-stone-800 outline-none focus:border-orange-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700">난이도</label>
                <select
                  value={parsedRecipe.difficulty}
                  onChange={(e) =>
                    setParsedRecipe({
                      ...parsedRecipe,
                      difficulty: e.target.value as '쉬움' | '보통' | '어려움',
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-orange-200 bg-[#fffdfa] px-3 py-2 text-xs text-stone-800 outline-none focus:border-orange-400"
                >
                  <option value="쉬움">쉬움</option>
                  <option value="보통">보통</option>
                  <option value="어려움">어려움</option>
                </select>
              </div>
            </div>

            {/* Ingredients */}
            <div>
              <label className="block text-xs font-bold text-stone-700">재료 목록 (줄바꿈 구분)</label>
              <textarea
                rows={4}
                value={parsedRecipe.ingredients}
                onChange={(e) =>
                  setParsedRecipe({ ...parsedRecipe, ingredients: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-orange-200 bg-[#fffdfa] p-3 text-xs leading-relaxed text-stone-800 outline-none focus:border-orange-400"
              />
            </div>

            {/* Method */}
            <div>
              <label className="block text-xs font-bold text-stone-700">조리 순서 (줄바꿈 구분)</label>
              <textarea
                rows={4}
                value={parsedRecipe.method}
                onChange={(e) => setParsedRecipe({ ...parsedRecipe, method: e.target.value })}
                className="mt-1 w-full rounded-xl border border-orange-200 bg-[#fffdfa] p-3 text-xs leading-relaxed text-stone-800 outline-none focus:border-orange-400"
              />
            </div>

            {/* AI Tips */}
            {parsedRecipe.tips && (
              <div>
                <label className="block text-xs font-bold text-amber-800">
                  💡 AI 셰프 추천 꿀팁 (메모로 저장됩니다)
                </label>
                <textarea
                  rows={2}
                  value={parsedRecipe.tips}
                  onChange={(e) => setParsedRecipe({ ...parsedRecipe, tips: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-amber-200 bg-amber-50/40 p-2.5 text-xs leading-relaxed text-amber-900 outline-none focus:border-amber-400"
                />
              </div>
            )}

            {/* Step 2 Actions */}
            <div className="flex items-center justify-between border-t border-orange-100 pt-4">
              <button
                type="button"
                onClick={() => setParsedRecipe(null)}
                className="rounded-xl px-3.5 py-2 text-xs font-bold text-stone-500 hover:bg-stone-100"
              >
                다시 입력하기
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="rounded-xl px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-100"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleFinalSave}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-xs font-black text-white shadow-md transition hover:from-orange-600 hover:to-amber-600"
                >
                  <Save className="h-4 w-4" />
                  <span>내 레시피에 저장하기</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
