/**
 * @file src/hooks/useMealPlan.ts
 * @description 개인 주간 식단표 관리 훅.
 * 로컬 스토리지에 식단 데이터를 안전하게 보존하며 식단 추가/수정/삭제를 처리합니다.
 */

import { useState, useCallback } from 'react';
import { Recipe, WeeklyMealPlan, MealPlanEntry } from '../types/recipe';
import { loadWeeklyMealPlan, saveWeeklyMealPlan } from '../utils/storage';
import { logger } from '../utils/logger';

export interface UseMealPlanOptions {
  /** 토스트 알림 함수 */
  showToast?: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export interface UseMealPlanReturn {
  /** 주간 식단표 데이터 */
  weeklyMealPlan: WeeklyMealPlan;
  /** 주간 식단표 상태 변경자 */
  setWeeklyMealPlan: React.Dispatch<React.SetStateAction<WeeklyMealPlan>>;
  /** 주간 식단표 저장 함수 */
  savePlan: (plan: WeeklyMealPlan) => void;
  /** 특정 날짜에 레시피 추가 */
  addRecipeToMealPlan: (recipe: Recipe, targetDate?: string) => void;
}

/**
 * 주간 식단표 관리 훅
 * @param options { showToast }
 */
export function useMealPlan(options: UseMealPlanOptions = {}): UseMealPlanReturn {
  const { showToast } = options;
  const [weeklyMealPlan, setWeeklyMealPlan] = useState<WeeklyMealPlan>(() => loadWeeklyMealPlan());

  /**
   * 주간 식단표 저장
   */
  const savePlan = useCallback((plan: WeeklyMealPlan): void => {
    logger.info('useMealPlan.savePlan', `주간 식단표 저장: ${Object.keys(plan).length}일 등록`);
    setWeeklyMealPlan(plan);
    saveWeeklyMealPlan(plan);
  }, []);

  /**
   * 오늘 뭐 먹지 또는 검색에서 주간 식단에 메뉴 추가
   */
  const addRecipeToMealPlan = useCallback(
    (recipe: Recipe, targetDate?: string): void => {
      const date = targetDate || new Date().toISOString().split('T')[0];
      logger.info('useMealPlan.addRecipeToMealPlan', `식단 추가: ${recipe.name} (${date})`);
      const existingEntries = weeklyMealPlan[date] || [];
      const now = Date.now();
      const newEntry: MealPlanEntry = {
        id: `meal_${now}_${Math.random().toString(36).substring(2, 6)}`,
        date,
        slot: 'single',
        recipeId: recipe.id,
        servings: recipe.baseServings || 2,
        createdAt: now,
        updatedAt: now,
      };

      const withoutExistingSingle = existingEntries.filter((entry) => entry.slot !== 'single');
      const nextPlan: WeeklyMealPlan = {
        ...weeklyMealPlan,
        [date]: [...withoutExistingSingle, newEntry],
      };

      savePlan(nextPlan);
      if (showToast) {
        showToast(`'${recipe.name}' 요리가 ${date} 식단에 추가되었습니다!`, 'success');
      }
    },
    [weeklyMealPlan, savePlan, showToast]
  );

  return {
    weeklyMealPlan,
    setWeeklyMealPlan,
    savePlan,
    addRecipeToMealPlan,
  };
}
