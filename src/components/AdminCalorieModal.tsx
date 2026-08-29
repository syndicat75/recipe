/**
 * @file src/components/AdminCalorieModal.tsx
 * @description 관리자 전용 레시피 칼로리(kcal) 일괄 분석 및 관리 도구 모달.
 * Gemini API를 활용하여 미분석 레시피의 1인분 및 총 칼로리를 자동 분석하고 Firestore에 일괄 저장합니다.
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  Flame,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Edit3,
  Play,
  Save,
} from 'lucide-react';
import { Recipe } from '../types/recipe';
import { APP_CONFIG } from '../config/appConfig';
import { removeUndefinedDeep } from '../utils/firestoreSanitizer';
import { logger } from '../utils/logger';

interface AdminCalorieModalProps {
  /** 모달 열림 여부 */
  isOpen: boolean;
  /** 전체 레시피 목록 */
  recipes: Recipe[];
  /** 모달 닫기 핸들러 */
  onClose: () => void;
  /** 레시피 저장 핸들러 */
  onSaveRecipe: (recipe: Recipe, isBookmarked: boolean, userNote: string) => Promise<any>;
  /** 토스트 메시지 표시 함수 */
  showToast: (msg: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

/**
 * 관리자 전용 칼로리 일괄 분석 및 관리 모달 컴포넌트
 */
export const AdminCalorieModal: React.FC<AdminCalorieModalProps> = ({
  isOpen,
  recipes,
  onClose,
  onSaveRecipe,
  showToast,
}) => {
  const [filterType, setFilterType] = useState<'unanalyzed' | 'analyzed' | 'all'>('unanalyzed');
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);
  const [analyzingRecipeId, setAnalyzingRecipeId] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number; success: number; failed: number }>({
    current: 0,
    total: 0,
    success: 0,
    failed: 0,
  });
  const [editingRecipeId, setEditingRecipeId] = useState<number | null>(null);
  const [customCalorieInput, setCustomCalorieInput] = useState<string>('');

  // 미분석 / 분석완료 목록 분류
  const unanalyzedRecipes = useMemo(
    () => recipes.filter((r) => !r.caloriesPerServing || r.caloriesPerServing <= 0),
    [recipes]
  );
  const analyzedRecipes = useMemo(
    () => recipes.filter((r) => r.caloriesPerServing && r.caloriesPerServing > 0),
    [recipes]
  );

  const displayedRecipes = useMemo(() => {
    if (filterType === 'unanalyzed') return unanalyzedRecipes;
    if (filterType === 'analyzed') return analyzedRecipes;
    return recipes;
  }, [filterType, unanalyzedRecipes, analyzedRecipes, recipes]);

  if (!isOpen) return null;

  /**
   * 단일 레시피 AI 칼로리 분석 실행
   * @param recipe 분석할 대상 레시피
   */
  const analyzeSingleRecipe = async (recipe: Recipe): Promise<boolean> => {
    try {
      logger.info('AdminCalorieModal.analyzeSingleRecipe', `칼로리 분석 시작: ${recipe.name} (ID: ${recipe.id})`);
      setAnalyzingRecipeId(recipe.id);

      const recipeServings =
        typeof recipe.baseServings === 'number' && recipe.baseServings >= 1
          ? recipe.baseServings
          : 1;

      const response = await fetch(APP_CONFIG.ai.analyzeCaloriesEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeId: recipe.id,
          name: recipe.name,
          category: recipe.category,
          ingredients: recipe.ingredients,
          baseServings: recipeServings,
        }),
      });

      const json = await response.json();
      if (!response.ok || !json.success || !json.data) {
        throw new Error(json.error || '칼로리 분석 API 실패');
      }

      const {
        caloriesPerServing,
        totalCalories,
        caloriesAnalyzedServings,
        caloriesConfidence,
        calorieBreakdown,
      } = json.data;

      const updatedRecipe: Recipe = removeUndefinedDeep({
        ...recipe,
        caloriesPerServing: Math.round(caloriesPerServing),
        totalCalories: Math.round(totalCalories),
        caloriesAnalyzedServings: caloriesAnalyzedServings || recipeServings,
        caloriesAnalyzedAt: Date.now(),
        caloriesConfidence: caloriesConfidence || 'medium',
        calorieBreakdown: calorieBreakdown || undefined,
        updatedAt: Date.now(),
      });

      await onSaveRecipe(updatedRecipe, !!recipe.isBookmarked, recipe.userNotes || '');
      logger.info('AdminCalorieModal.analyzeSingleRecipe', `칼로리 저장 완료: ${recipe.name} (${caloriesPerServing} kcal/1인분)`);
      return true;
    } catch (err: any) {
      logger.error('AdminCalorieModal.analyzeSingleRecipe', `분석 실패: ${recipe.name}`, err);
      return false;
    } finally {
      setAnalyzingRecipeId(null);
    }
  };

  /**
   * 전체 미분석 레시피 일괄 AI 분석 실행
   */
  const handleStartBatchAnalysis = async (): Promise<void> => {
    if (unanalyzedRecipes.length === 0) {
      showToast('모든 레시피의 칼로리 분석이 이미 완료되었습니다.', 'info');
      return;
    }

    setIsBatchRunning(true);
    const targetList = [...unanalyzedRecipes];
    setProgress({ current: 0, total: targetList.length, success: 0, failed: 0 });

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < targetList.length; i++) {
      const target = targetList[i];
      setProgress({
        current: i + 1,
        total: targetList.length,
        success: successCount,
        failed: failedCount,
      });

      const success = await analyzeSingleRecipe(target);
      if (success) {
        successCount++;
      } else {
        failedCount++;
      }

      setProgress({
        current: i + 1,
        total: targetList.length,
        success: successCount,
        failed: failedCount,
      });

      // Gemini Rate Limit 방지를 위한 지연 (800ms)
      if (i < targetList.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }

    setIsBatchRunning(false);
    showToast(
      `🎉 일괄 칼로리 분석 완료! (성공: ${successCount}개 / 실패: ${failedCount}개)`,
      failedCount === 0 ? 'success' : 'warning'
    );
  };

  /**
   * 단일 레시피 분석 버튼 클릭 핸들러
   */
  const handleAnalyzeClick = async (recipe: Recipe): Promise<void> => {
    showToast(`'${recipe.name}'의 칼로리를 AI로 분석 중...`, 'info');
    const success = await analyzeSingleRecipe(recipe);
    if (success) {
      showToast(`'${recipe.name}' 칼로리 분석 완료!`, 'success');
    } else {
      showToast(`'${recipe.name}' 칼로리 분석에 실패했습니다.`, 'error');
    }
  };

  /**
   * 수동 칼로리 직접 저장 핸들러
   */
  const handleSaveManualCalorie = async (recipe: Recipe): Promise<void> => {
    const val = Number(customCalorieInput);
    if (!val || isNaN(val) || val <= 0) {
      showToast('올바른 칼로리(kcal) 숫자를 입력해주세요.', 'warning');
      return;
    }

    const recipeServings =
      typeof recipe.baseServings === 'number' && recipe.baseServings >= 1
        ? recipe.baseServings
        : 1;

    const updatedRecipe: Recipe = removeUndefinedDeep({
      ...recipe,
      caloriesPerServing: Math.round(val),
      totalCalories: Math.round(val * recipeServings),
      caloriesAnalyzedServings: recipeServings,
      caloriesAnalyzedAt: Date.now(),
      caloriesConfidence: 'high',
      updatedAt: Date.now(),
    });

    try {
      await onSaveRecipe(updatedRecipe, !!recipe.isBookmarked, recipe.userNotes || '');
      showToast(`'${recipe.name}'의 1인분 칼로리가 ${val} kcal로 직접 저장되었습니다.`, 'success');
      setEditingRecipeId(null);
      setCustomCalorieInput('');
    } catch {
      showToast('칼로리 저장 중 오류가 발생했습니다.', 'error');
    }
  };

  return (
    <div
      id="admin-calorie-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-calorie-title"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-orange-900/10">
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between border-b border-orange-100 bg-amber-50/70 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white shadow-sm">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="admin-calorie-title" className="font-soft text-lg font-black text-stone-900 sm:text-xl">
                  레시피 예상 칼로리(kcal) 관리 도구
                </h2>
                <span className="rounded-md bg-amber-200 px-2 py-0.5 text-[10px] font-black text-amber-900">
                  관리자 전용
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Gemini AI를 사용하여 모든 레시피의 재료 기반 1인분 예상 칼로리를 일괄 산출하고 관리합니다.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isBatchRunning}
            className="rounded-2xl p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-30"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Stats & Batch Action Banner */}
        <div className="border-b border-stone-100 bg-gradient-to-r from-orange-50/50 via-amber-50/30 to-orange-50/50 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4 text-xs font-bold">
              <div className="rounded-2xl bg-white px-3.5 py-2.5 shadow-xs border border-orange-100">
                <span className="text-stone-400 block text-[10px]">전체 레시피</span>
                <span className="text-base text-stone-900 font-black">{recipes.length}개</span>
              </div>
              <div className="rounded-2xl bg-white px-3.5 py-2.5 shadow-xs border border-amber-100">
                <span className="text-amber-600 block text-[10px]">분석 완료</span>
                <span className="text-base text-amber-700 font-black">{analyzedRecipes.length}개</span>
              </div>
              <div className="rounded-2xl bg-white px-3.5 py-2.5 shadow-xs border border-rose-100">
                <span className="text-rose-600 block text-[10px]">미분석 (분석 필요)</span>
                <span className="text-base text-rose-700 font-black">{unanalyzedRecipes.length}개</span>
              </div>
            </div>

            {/* Batch Start Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleStartBatchAnalysis}
                disabled={isBatchRunning || unanalyzedRecipes.length === 0}
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-xs font-black text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
              >
                {isBatchRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>
                      일괄 분석 중 ({progress.current}/{progress.total})...
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>미분석 레시피 전체 일괄 AI 분석 ({unanalyzedRecipes.length}개)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Batch Progress Bar */}
          {isBatchRunning && (
            <div className="mt-4 space-y-1.5 animate-fade-in">
              <div className="flex justify-between text-xs font-bold text-stone-600">
                <span>진행률: {Math.round((progress.current / (progress.total || 1)) * 100)}%</span>
                <span>
                  성공 {progress.success}건 / 실패 {progress.failed}건
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-300"
                  style={{ width: `${(progress.current / (progress.total || 1)) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-stone-100 px-6 py-3 text-xs font-bold">
          <button
            type="button"
            onClick={() => setFilterType('unanalyzed')}
            className={`rounded-xl px-3 py-1.5 transition ${
              filterType === 'unanalyzed'
                ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                : 'text-stone-500 hover:bg-stone-100'
            }`}
          >
            미분석 목록 ({unanalyzedRecipes.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('analyzed')}
            className={`rounded-xl px-3 py-1.5 transition ${
              filterType === 'analyzed'
                ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                : 'text-stone-500 hover:bg-stone-100'
            }`}
          >
            분석 완료 ({analyzedRecipes.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`rounded-xl px-3 py-1.5 transition ${
              filterType === 'all'
                ? 'bg-stone-800 text-white'
                : 'text-stone-500 hover:bg-stone-100'
            }`}
          >
            전체 보기 ({recipes.length})
          </button>
        </div>

        {/* Recipe List Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {displayedRecipes.length === 0 ? (
            <div className="py-12 text-center text-xs text-stone-400">
              {filterType === 'unanalyzed'
                ? '🎉 모든 레시피의 칼로리 분석이 완료되었습니다!'
                : '표시할 레시피가 없습니다.'}
            </div>
          ) : (
            displayedRecipes.map((r) => {
              const isAnalyzed = r.caloriesPerServing && r.caloriesPerServing > 0;
              const isAnalyzingThis = analyzingRecipeId === r.id;
              const isEditingThis = editingRecipeId === r.id;

              return (
                <div
                  key={r.id}
                  className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border p-4 transition-all ${
                    isAnalyzed
                      ? 'border-amber-100 bg-amber-50/20 hover:bg-amber-50/40'
                      : 'border-rose-100 bg-rose-50/20 hover:bg-rose-50/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{r.icon || '🍲'}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-soft text-sm font-black text-stone-900">{r.name}</span>
                        <span className="text-[11px] text-stone-400">({r.category})</span>
                        <span className="text-[11px] text-stone-400">
                          기준: {typeof r.baseServings === 'number' && r.baseServings >= 1 ? r.baseServings : 1}인분
                        </span>
                      </div>

                      {/* Calorie Info */}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        {isAnalyzed ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2 py-0.5 font-black text-amber-900">
                              🔥 {r.caloriesPerServing} kcal / 1인분
                            </span>
                            <span className="text-stone-500 text-[11px]">
                              (총 약{' '}
                              {r.totalCalories ||
                                Math.round(
                                  (r.caloriesPerServing || 0) *
                                    (typeof r.baseServings === 'number' && r.baseServings >= 1 ? r.baseServings : 1)
                                )}{' '}
                              kcal)
                            </span>
                            {r.calorieBreakdown && (
                              <span className="text-[11px] text-stone-500 truncate max-w-xs">
                                💡 {r.calorieBreakdown}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-2 py-0.5 font-bold text-rose-800 text-[11px]">
                            <AlertCircle className="h-3 w-3" />
                            칼로리 미분석
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {isEditingThis ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          placeholder="1인분 kcal"
                          value={customCalorieInput}
                          onChange={(e) => setCustomCalorieInput(e.target.value)}
                          className="w-24 rounded-xl border border-orange-300 px-2.5 py-1.5 text-xs font-bold text-stone-800 outline-none focus:ring-1 focus:ring-orange-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveManualCalorie(r)}
                          className="rounded-xl bg-stone-800 p-2 text-white hover:bg-stone-900"
                          title="저장"
                        >
                          <Save className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingRecipeId(null)}
                          className="rounded-xl bg-stone-100 p-2 text-stone-600 hover:bg-stone-200"
                          title="취소"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRecipeId(r.id);
                            setCustomCalorieInput(String(r.caloriesPerServing || ''));
                          }}
                          className="rounded-xl bg-stone-100 p-2 text-stone-600 hover:bg-stone-200"
                          title="칼로리 직접 수정"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAnalyzeClick(r)}
                          disabled={isAnalyzingThis || isBatchRunning}
                          className="flex items-center gap-1.5 rounded-xl bg-orange-100 px-3 py-1.5 text-xs font-bold text-orange-800 hover:bg-orange-200 disabled:opacity-40"
                          title="AI 칼로리 분석"
                        >
                          {isAnalyzingThis ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5 text-orange-600" />
                          )}
                          <span>{isAnalyzed ? '재분석' : 'AI 분석'}</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <footer className="flex shrink-0 items-center justify-between border-t border-stone-100 px-6 py-4">
          <span className="text-xs text-stone-400">
            총 {recipes.length}개 중 {analyzedRecipes.length}개 분석 완료 ({Math.round((analyzedRecipes.length / (recipes.length || 1)) * 100)}%)
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={isBatchRunning}
            className="rounded-xl bg-stone-800 px-5 py-2.5 font-soft text-xs font-bold text-white hover:bg-stone-900 disabled:opacity-50"
          >
            닫기
          </button>
        </footer>
      </div>
    </div>
  );
};
