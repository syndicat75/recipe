/**
 * @file src/components/TodayMenuModal.tsx
 * @description 🎲 '오늘 뭐 먹지?' 메뉴 추천 대화상자.
 * 저장된 내 레시피 풀 내에서 단일 랜덤 추천, 조건부 필터(카테고리, 즐겨찾기, 보유 재료),
 * 후보 3개 추천, 최근 추천 중복 방지, 자연어 기반 AI 추천, 주간 식단표 연동을 지원합니다.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dice5,
  X,
  RefreshCw,
  Eye,
  CalendarPlus,
  Sparkles,
  SlidersHorizontal,
  Bookmark,
  Check,
  Search,
  ChefHat,
  AlertCircle,
} from 'lucide-react';
import { Recipe, FilterCategory, RecipeCategory } from '../types/recipe';
import { CATEGORY_CONFIG, CATEGORY_LIST, APP_CONFIG } from '../config/appConfig';
import { logger } from '../utils/logger';
import { getRecentRecommendations, saveRecentRecommendations } from '../utils/storage';

interface TodayMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  allRecipes: Recipe[];
  bookmarkedIds: number[];
  onOpenRecipeDetail: (recipe: Recipe) => void;
  onAddToMealPlan: (recipe: Recipe, targetDate?: string) => void;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

type RecommendMode = 'single' | 'three' | 'ai';

/**
 * '오늘 뭐 먹지?' 추천 모달 컴포넌트
 */
export const TodayMenuModal: React.FC<TodayMenuModalProps> = ({
  isOpen,
  onClose,
  allRecipes,
  bookmarkedIds,
  onOpenRecipeDetail,
  onAddToMealPlan,
  showToast,
}) => {
  const [mode, setMode] = useState<RecommendMode>('single');

  // 필터 상태
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('전체');
  const [onlyBookmarks, setOnlyBookmarks] = useState<boolean>(false);
  const [ingredientKeyword, setIngredientKeyword] = useState<string>('');

  // 추천 결과 상태
  const [singleResult, setSingleResult] = useState<Recipe | null>(null);
  const [tripleResults, setTripleResults] = useState<Recipe[]>([]);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);

  // AI 추천 상태
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiResultRecipe, setAiResultRecipe] = useState<Recipe | null>(null);
  const [aiReason, setAiReason] = useState<string>('');

  // 날짜 선택 모달/팝업 상태
  const [datePickerRecipe, setDatePickerRecipe] = useState<Recipe | null>(null);
  const [selectedTargetDate, setSelectedTargetDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  /**
   * 필터 조건에 부합하는 레시피 후보군 계산
   */
  const candidateRecipes = useMemo(() => {
    logger.debug('TodayMenuModal.candidateRecipes', '후보군 필터링 계산');
    return allRecipes.filter((recipe) => {
      // 1. 카테고리 필터
      if (selectedCategory !== '전체' && recipe.category !== selectedCategory) {
        return false;
      }
      // 2. 즐겨찾기 필터
      if (onlyBookmarks && !bookmarkedIds.includes(recipe.id)) {
        return false;
      }
      // 3. 주요 재료 필터
      if (ingredientKeyword.trim()) {
        const kw = ingredientKeyword.trim().toLowerCase();
        const inIngredients = recipe.ingredients.toLowerCase().includes(kw);
        const inName = recipe.name.toLowerCase().includes(kw);
        if (!inIngredients && !inName) {
          return false;
        }
      }
      return true;
    });
  }, [allRecipes, selectedCategory, onlyBookmarks, ingredientKeyword, bookmarkedIds]);

  /**
   * 최근 추천 이력을 반영한 무작위 추출 로직
   * @param pool 대상 레시피 배열
   * @param count 추출할 개수
   * @returns 추출된 레시피 배열
   */
  const pickRandomRecipes = useCallback(
    (pool: Recipe[], count: number = 1): Recipe[] => {
      logger.info('TodayMenuModal.pickRandomRecipes', `랜덤 추출 시도 (후보: ${pool.length}개, 요청: ${count}개)`);
      if (pool.length === 0) return [];

      const recentIds = getRecentRecommendations();
      // 최근 추천되지 않은 후보 우선 선별
      let freshPool = pool.filter((r) => !recentIds.includes(r.id));
      if (freshPool.length < count) {
        freshPool = [...pool];
      }

      // 셔플 알고리즘
      const shuffled = [...freshPool].sort(() => Math.random() - 0.5);
      const picked = shuffled.slice(0, count);

      // 최근 추천 이력 갱신
      const newRecent = [...recentIds, ...picked.map((r) => r.id)];
      saveRecentRecommendations(newRecent);

      return picked;
    },
    []
  );

  /**
   * 단일 랜덤 추천 실행
   */
  const handleRollSingle = useCallback(() => {
    logger.info('TodayMenuModal.handleRollSingle', '1개 추천 주사위 굴리기');
    if (candidateRecipes.length === 0) {
      setSingleResult(null);
      return;
    }
    setIsSpinning(true);
    setTimeout(() => {
      const [picked] = pickRandomRecipes(candidateRecipes, 1);
      setSingleResult(picked || null);
      setIsSpinning(false);
    }, 250);
  }, [candidateRecipes, pickRandomRecipes]);

  /**
   * 3개 후보 추천 실행
   */
  const handleRollTriple = useCallback(() => {
    logger.info('TodayMenuModal.handleRollTriple', '3개 후보 주사위 굴리기');
    if (candidateRecipes.length === 0) {
      setTripleResults([]);
      return;
    }
    setIsSpinning(true);
    setTimeout(() => {
      const picked = pickRandomRecipes(candidateRecipes, Math.min(3, candidateRecipes.length));
      setTripleResults(picked);
      setIsSpinning(false);
    }, 250);
  }, [candidateRecipes, pickRandomRecipes]);

  /**
   * 모달 오픈 시 초기 추천 자동 실행
   */
  useEffect(() => {
    if (isOpen) {
      logger.info('TodayMenuModal', '모달 오픈, 초기 추천 생성');
      if (mode === 'single') {
        const [picked] = pickRandomRecipes(candidateRecipes, 1);
        setSingleResult(picked || null);
      } else if (mode === 'three') {
        const picked = pickRandomRecipes(candidateRecipes, Math.min(3, candidateRecipes.length));
        setTripleResults(picked);
      }
    }
  }, [isOpen, mode, candidateRecipes, pickRandomRecipes]);

  /**
   * AI 자연어 맞춤 추천 실행
   */
  const handleAiRecommend = async (e?: React.FormEvent): Promise<void> => {
    if (e) e.preventDefault();
    if (!aiPrompt.trim()) {
      showToast('먹고 싶은 느낌이나 가지고 있는 재료를 입력해주세요.', 'info');
      return;
    }

    logger.info('TodayMenuModal.handleAiRecommend', `AI 추천 요청: "${aiPrompt}"`);
    setAiLoading(true);
    setAiResultRecipe(null);
    setAiReason('');

    try {
      const candidateSummary = allRecipes.map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        ingredients: r.ingredients,
      }));

      const res = await fetch(APP_CONFIG.ai.recommendEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: aiPrompt.trim(),
          candidateRecipes: candidateSummary,
        }),
      });

      if (!res.ok) {
        throw new Error('AI 추천 서버 응답 실패');
      }

      const data = await res.json();
      if (data.success) {
        if (data.recommendedRecipeId) {
          const matched = allRecipes.find((r) => r.id === data.recommendedRecipeId);
          setAiResultRecipe(matched || null);
        } else {
          setAiResultRecipe(null);
        }
        setAiReason(data.reason || '추천 메뉴를 선정했습니다.');
        logger.info('TodayMenuModal.handleAiRecommend', `AI 추천 완료: ID ${data.recommendedRecipeId}`);
      } else {
        throw new Error(data.error || '추천 생성 실패');
      }
    } catch (error) {
      logger.error('TodayMenuModal.handleAiRecommend', 'AI 추천 중 오류', error);
      showToast('AI 추천 중 문제가 발생했습니다. 일반 랜덤 추천을 이용해주세요.', 'error');
    } finally {
      setAiLoading(false);
    }
  };

  /**
   * 식단 추가 날짜 확정 핸들러
   */
  const handleConfirmAddToMealPlan = (): void => {
    if (!datePickerRecipe) return;
    logger.info('TodayMenuModal.handleConfirmAddToMealPlan', `식단 추가: ${datePickerRecipe.name} (${selectedTargetDate})`);
    onAddToMealPlan(datePickerRecipe, selectedTargetDate);
    showToast(`'${datePickerRecipe.name}' 요리가 ${selectedTargetDate} 식단에 추가되었습니다.`, 'success');
    setDatePickerRecipe(null);
  };

  if (!isOpen) return null;

  return (
    <div
      id="today-menu-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="today-menu-modal-title"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-amber-50/95 shadow-2xl ring-1 ring-orange-900/10 backdrop-blur-md">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-orange-100/80 bg-white/80 px-6 py-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 text-white shadow-md shadow-orange-500/20">
              <Dice5 className="h-5 w-5" />
            </div>
            <div>
              <h2 id="today-menu-modal-title" className="font-soft text-lg font-black text-stone-900 sm:text-xl">
                🎲 오늘 뭐 먹지?
              </h2>
              <p className="text-xs font-medium text-stone-500">
                내 레시피 중에서 오늘 먹을 맛있는 한 끼를 골라보세요
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 active:scale-95 transition-all"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-orange-100 bg-white/50 px-6 pt-3">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 font-soft text-xs font-bold transition-all sm:text-sm ${
              mode === 'single'
                ? 'border-orange-500 text-orange-700'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <span>🎯 1개 집중 추천</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('three')}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 font-soft text-xs font-bold transition-all sm:text-sm ${
              mode === 'three'
                ? 'border-orange-500 text-orange-700'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <span>🍱 후보 3개 보기</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('ai')}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 font-soft text-xs font-bold transition-all sm:text-sm ${
              mode === 'ai'
                ? 'border-orange-500 text-orange-700'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>✨ AI에게 부탁하기</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {mode !== 'ai' && (
            /* 조건 필터 바 */
            <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-stone-600">
                <span className="flex items-center gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-orange-500" />
                  추천 조건 필터
                </span>
                <span className="text-orange-600 font-extrabold">
                  {candidateRecipes.length}개 후보 가능
                </span>
              </div>

              {/* 카테고리 칩 */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('전체')}
                  className={`rounded-full px-2.5 py-1 text-xs font-bold transition-all ${
                    selectedCategory === '전체'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  전체
                </button>
                {CATEGORY_LIST.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`rounded-full px-2.5 py-1 text-xs font-bold transition-all ${
                      selectedCategory === cat
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* 즐겨찾기 & 재료 검색 */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-1 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setOnlyBookmarks(!onlyBookmarks)}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    onlyBookmarks
                      ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-300'
                      : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  <Bookmark className={`h-3.5 w-3.5 ${onlyBookmarks ? 'fill-amber-500 text-amber-500' : ''}`} />
                  <span>즐겨찾기만</span>
                </button>

                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    value={ingredientKeyword}
                    onChange={(e) => setIngredientKeyword(e.target.value)}
                    placeholder="재료 필터 (예: 돼지고기, 두부)"
                    className="w-full rounded-xl border border-stone-200 bg-stone-50/70 py-1.5 pl-8 pr-3 text-xs text-stone-800 placeholder-stone-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  {ingredientKeyword && (
                    <button
                      type="button"
                      onClick={() => setIngredientKeyword('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Mode 1: 단일 추천 */}
          {mode === 'single' && (
            <div className="space-y-4 text-center">
              {candidateRecipes.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-stone-300 bg-white/60 p-8 text-center">
                  <AlertCircle className="mx-auto h-8 w-8 text-stone-400 mb-2" />
                  <p className="font-soft font-bold text-stone-700">해당 조건에 맞는 레시피가 없습니다</p>
                  <p className="text-xs text-stone-500 mt-1">필터 조건을 완화해보세요.</p>
                </div>
              ) : singleResult ? (
                <div className="relative overflow-hidden rounded-3xl border border-orange-200 bg-gradient-to-b from-white to-orange-50/50 p-6 shadow-md transition-all">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-800 mb-3">
                    <Sparkles className="h-3.5 w-3.5 text-orange-600" />
                    오늘의 추천 메뉴
                  </div>

                  <div className="text-5xl my-2 animate-bounce-short">
                    {singleResult.icon || '🥘'}
                  </div>

                  <h3 className="font-soft text-2xl font-black text-stone-900 sm:text-3xl">
                    {singleResult.name}
                  </h3>

                  <p className="mt-2 text-sm font-medium text-stone-600">
                    오늘은 <span className="font-bold text-orange-600">{singleResult.name}</span> 어떠세요?
                  </p>

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-stone-500">
                    <span className="rounded-lg bg-stone-100 px-2.5 py-1 text-stone-700 font-bold">
                      {singleResult.category}
                    </span>
                    {singleResult.cookingTimeMinutes && (
                      <span className="rounded-lg bg-stone-100 px-2.5 py-1 text-stone-700">
                        ⏱️ {singleResult.cookingTimeMinutes}분
                      </span>
                    )}
                    {singleResult.difficulty && (
                      <span className="rounded-lg bg-stone-100 px-2.5 py-1 text-stone-700">
                        난이도: {singleResult.difficulty}
                      </span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={handleRollSingle}
                      disabled={isSpinning}
                      className="flex items-center gap-1.5 rounded-2xl border border-stone-200 bg-white px-4 py-2.5 font-soft text-xs font-bold text-stone-700 shadow-sm transition-all hover:bg-stone-50 active:scale-95"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isSpinning ? 'animate-spin text-orange-500' : ''}`} />
                      <span>다시 뽑기</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenRecipeDetail(singleResult);
                      }}
                      className="flex items-center gap-1.5 rounded-2xl bg-orange-500 px-5 py-2.5 font-soft text-xs font-bold text-white shadow-md shadow-orange-500/20 transition-all hover:bg-orange-600 active:scale-95"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>레시피 보기</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDatePickerRecipe(singleResult)}
                      className="flex items-center gap-1.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 font-soft text-xs font-bold text-emerald-800 transition-all hover:bg-emerald-100 active:scale-95"
                    >
                      <CalendarPlus className="h-3.5 w-3.5 text-emerald-600" />
                      <span>식단에 추가</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Mode 2: 후보 3개 */}
          {mode === 'three' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-stone-600">오늘의 추천 후보 3가지</p>
                <button
                  type="button"
                  onClick={handleRollTriple}
                  disabled={isSpinning}
                  className="flex items-center gap-1.5 rounded-xl border border-orange-200 bg-white px-3 py-1.5 text-xs font-bold text-orange-700 shadow-sm transition-all hover:bg-orange-50 active:scale-95"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSpinning ? 'animate-spin' : ''}`} />
                  <span>후보 다시 뽑기</span>
                </button>
              </div>

              {candidateRecipes.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-stone-300 bg-white/60 p-8 text-center">
                  <AlertCircle className="mx-auto h-8 w-8 text-stone-400 mb-2" />
                  <p className="font-soft font-bold text-stone-700">해당 조건에 맞는 레시피가 없습니다</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {tripleResults.map((recipe, idx) => (
                    <div
                      key={recipe.id}
                      className="flex flex-col justify-between rounded-2xl border border-orange-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-2xl">{recipe.icon || '🍲'}</span>
                          <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                            후보 {idx + 1}
                          </span>
                        </div>
                        <h4 className="mt-2 font-soft text-base font-bold text-stone-900 line-clamp-1">
                          {recipe.name}
                        </h4>
                        <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">
                          {recipe.category} · {recipe.ingredients.replace(/\n/g, ', ')}
                        </p>
                      </div>

                      <div className="mt-4 flex flex-col gap-1.5 pt-3 border-t border-stone-100">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenRecipeDetail(recipe);
                          }}
                          className="flex items-center justify-center gap-1 rounded-xl bg-stone-100 py-1.5 font-soft text-xs font-bold text-stone-700 hover:bg-stone-200 transition-all"
                        >
                          <Eye className="h-3 w-3" />
                          <span>레시피 보기</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDatePickerRecipe(recipe)}
                          className="flex items-center justify-center gap-1 rounded-xl bg-orange-50 py-1.5 font-soft text-xs font-bold text-orange-800 hover:bg-orange-100 transition-all"
                        >
                          <CalendarPlus className="h-3 w-3 text-orange-600" />
                          <span>식단에 추가</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Mode 3: AI 자연어 추천 */}
          {mode === 'ai' && (
            <div className="space-y-4">
              <form onSubmit={handleAiRecommend} className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm space-y-3">
                <label className="block text-xs font-bold text-stone-700">
                  먹고 싶은 느낌이나 가지고 있는 재료를 편하게 적어주세요
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="예: 오늘은 따뜻하고 얼큰한 국물이 먹고 싶어. 김치랑 계란 있어."
                    className="flex-1 rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs text-stone-800 placeholder-stone-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 sm:text-sm"
                  />
                  <button
                    type="submit"
                    disabled={aiLoading}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 font-soft text-xs font-bold text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600 active:scale-95 disabled:opacity-50 transition-all"
                  >
                    {aiLoading ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    <span>AI 추천</span>
                  </button>
                </div>

                {/* 예시 프롬프트 칩 */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    '얼큰하고 따뜻한 국물 요리',
                    '15분 만에 만드는 초간단 요리',
                    '계란과 두부로 만드는 단백질 식단',
                    '스트레스 풀리는 매콤한 반찬',
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setAiPrompt(chip)}
                      className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-600 hover:bg-orange-50 hover:text-orange-700 transition-all"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </form>

              {/* AI 추천 결과 카드 */}
              {aiLoading ? (
                <div className="rounded-2xl border border-amber-100 bg-white/70 p-8 text-center">
                  <Sparkles className="mx-auto h-8 w-8 animate-spin text-amber-500 mb-2" />
                  <p className="font-soft font-bold text-stone-700">AI 요리사가 내 레시피 중에서 고르는 중...</p>
                </div>
              ) : aiReason ? (
                <div className="rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50/50 to-white p-5 shadow-sm space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
                      <ChefHat className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800">
                        AI 요리사의 맞춤 조언
                      </h4>
                      <p className="mt-1 text-xs text-stone-700 leading-relaxed sm:text-sm">
                        {aiReason}
                      </p>
                    </div>
                  </div>

                  {aiResultRecipe ? (
                    <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{aiResultRecipe.icon || '🥘'}</span>
                        <div>
                          <h5 className="font-soft text-base font-bold text-stone-900">
                            {aiResultRecipe.name}
                          </h5>
                          <p className="text-xs text-stone-500">
                            {aiResultRecipe.category} · {aiResultRecipe.cookingTimeMinutes ? `${aiResultRecipe.cookingTimeMinutes}분` : '간단 조리'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenRecipeDetail(aiResultRecipe);
                          }}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1 rounded-xl bg-white px-3 py-1.5 font-soft text-xs font-bold text-stone-700 shadow-sm hover:bg-stone-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>보기</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDatePickerRecipe(aiResultRecipe)}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1 rounded-xl bg-orange-500 px-3 py-1.5 font-soft text-xs font-bold text-white shadow-sm hover:bg-orange-600"
                        >
                          <CalendarPlus className="h-3.5 w-3.5" />
                          <span>식단 추가</span>
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* 식단 날짜 선택 서브 팝업 */}
        {datePickerRecipe && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-stone-900/10 space-y-4 animate-scale-up">
              <div className="flex items-center gap-2">
                <CalendarPlus className="h-5 w-5 text-orange-500" />
                <h3 className="font-soft font-bold text-stone-900">
                  '{datePickerRecipe.name}' 식단 추가
                </h3>
              </div>
              <p className="text-xs text-stone-600">
                어느 날짜의 식단에 추가하시겠습니까?
              </p>

              <div className="space-y-2">
                <input
                  type="date"
                  value={selectedTargetDate}
                  onChange={(e) => setSelectedTargetDate(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 p-2.5 text-sm font-bold text-stone-800 focus:border-orange-500 focus:outline-none"
                />

                {/* 퀵 날짜 선택 버튼 */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTargetDate(new Date().toISOString().split('T')[0]);
                    }}
                    className="flex-1 rounded-lg bg-stone-100 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-200"
                  >
                    오늘
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const tm = new Date();
                      tm.setDate(tm.getDate() + 1);
                      setSelectedTargetDate(tm.toISOString().split('T')[0]);
                    }}
                    className="flex-1 rounded-lg bg-stone-100 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-200"
                  >
                    내일
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDatePickerRecipe(null)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAddToMealPlan}
                  className="rounded-xl bg-orange-500 px-5 py-2 font-soft text-xs font-bold text-white shadow-md hover:bg-orange-600"
                >
                  추가하기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
