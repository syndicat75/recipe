/**
 * @file src/hooks/useMealPlan.ts
 * @description 개인 주간 식단표 관리 훅.
 * 로컬 스토리지 오프라인 저장과 Cloud Firestore 실시간 동기화(/users/{uid}/mealPlanEntries)를
 * 결합하여 로그인 상태에서는 다기기 실시간 동기화, 비로그인/오프라인 상태에서는 로컬 영속성을 지원합니다.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Recipe, WeeklyMealPlan, MealPlanEntry } from '../types/recipe';
import { loadWeeklyMealPlan, saveWeeklyMealPlan } from '../utils/storage';
import {
  subscribeUserMealPlan,
  saveEntireMealPlanToCloud,
  migrateLocalMealPlanToCloud,
} from '../services/mealPlanFirestore';
import { logger } from '../utils/logger';

export interface UseMealPlanOptions {
  /** 토스트 알림 함수 */
  showToast?: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  /** 현재 로그인한 사용자 Firebase UID (선택) */
  userId?: string | null;
}

export interface UseMealPlanReturn {
  /** 주간 식단표 데이터 */
  weeklyMealPlan: WeeklyMealPlan;
  /** 주간 식단표 상태 변경자 */
  setWeeklyMealPlan: React.Dispatch<React.SetStateAction<WeeklyMealPlan>>;
  /** 주간 식단표 저장 함수 (로컬 + 클라우드 동시 동기화) */
  savePlan: (plan: WeeklyMealPlan) => void;
  /** 특정 날짜에 레시피 추가 */
  addRecipeToMealPlan: (recipe: Recipe, targetDate?: string) => void;
}

/**
 * 주간 식단표 관리 훅
 * @param options { showToast, userId }
 */
export function useMealPlan(options: UseMealPlanOptions = {}): UseMealPlanReturn {
  const { showToast, userId } = options;
  const [weeklyMealPlan, setWeeklyMealPlan] = useState<WeeklyMealPlan>(() => loadWeeklyMealPlan());
  const isInitialSyncDone = useRef(false);

  // 1. 사용자 로그인 시 Firestore 식단표 실시간 구독 및 최초 마이그레이션
  useEffect(() => {
    if (!userId) {
      isInitialSyncDone.current = false;
      return;
    }

    logger.info('useMealPlan.useEffect', `사용자 로그인 감지 -> 식단표 클라우드 동기화 시작 (UID: ${userId})`);

    // 로컬 식단이 존재하면 최초 1회 클라우드와 병합 마이그레이션
    const currentLocal = loadWeeklyMealPlan();
    if (Object.keys(currentLocal).length > 0 && !isInitialSyncDone.current) {
      migrateLocalMealPlanToCloud(userId, currentLocal).catch((err) => {
        logger.warn('useMealPlan', '로컬 식단 클라우드 마이그레이션 경고:', err);
      });
      isInitialSyncDone.current = true;
    }

    const unsubscribe = subscribeUserMealPlan(
      userId,
      (cloudPlan) => {
        logger.info('useMealPlan', `클라우드 식단표 실시간 수신 (${Object.keys(cloudPlan).length}일)`);
        setWeeklyMealPlan(cloudPlan);
        saveWeeklyMealPlan(cloudPlan); // 오프라인용 로컬 미러링
      },
      (err) => {
        logger.warn('useMealPlan', '식단표 클라우드 구독 에러, 로컬 캐시 유지:', err);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [userId]);

  /**
   * 주간 식단표 저장 (로컬 스토리지 + 로그인 시 클라우드 동기화)
   */
  const savePlan = useCallback(
    (plan: WeeklyMealPlan): void => {
      logger.info('useMealPlan.savePlan', `주간 식단표 저장: ${Object.keys(plan).length}일 등록`);
      setWeeklyMealPlan(plan);
      saveWeeklyMealPlan(plan);

      if (userId) {
        saveEntireMealPlanToCloud(userId, plan).catch((err) => {
          logger.error('useMealPlan.savePlan', '클라우드 식단 저장 실패 (로컬은 보존됨)', err);
        });
      }
    },
    [userId]
  );

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
        servings: typeof recipe.baseServings === 'number' && recipe.baseServings >= 1 ? recipe.baseServings : 1,
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
