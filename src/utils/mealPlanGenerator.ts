/**
 * @file src/utils/mealPlanGenerator.ts
 * @description 📅 AI 주간 식단표 생성 유틸리티 및 오프라인 휴리스틱 알고리즘.
 * 최근 식단 이력 계산, 주간 칼로리 합산 통계, Gemini API 실패 시 안정적으로 동작하는
 * 지능형 클라이언트 자동 채우기(Fallback) 기능을 제공합니다.
 */

import { Recipe, MealPlanEntry, MealSlotType } from '../types/recipe';
import {
  AiMealPlanRequestConfig,
  AiMealPlanCandidateRecipe,
  AiGeneratedPlanItem,
  AiMealPlanPreviewSlot,
} from '../types/mealPlan';
import { logger } from './logger';

/**
 * 특정 기준일로부터 최근 N일(기본 14일) 동안 식단에 사용된 Recipe ID 목록을 계산
 * @param mealPlan 전체 식단 맵 (키: YYYY-MM-DD)
 * @param baseDate 기준 날짜 (기본: 오늘)
 * @param daysLookback 조회 일수 (기본 14일)
 * @returns 최근 사용된 고유 Recipe ID 배열
 */
export function getRecentMealRecipeIds(
  mealPlan: Record<string, MealPlanEntry[]>,
  baseDate: Date = new Date(),
  daysLookback: number = 14
): number[] {
  logger.info('mealPlanGenerator.getRecentMealRecipeIds', `최근 ${daysLookback}일간 식단 사용 레시피 조회`);

  const recentIds = new Set<number>();
  const cutoffTime = new Date(baseDate);
  cutoffTime.setDate(cutoffTime.getDate() - daysLookback);
  cutoffTime.setHours(0, 0, 0, 0);

  const baseTime = new Date(baseDate);
  baseTime.setHours(23, 59, 59, 999);

  Object.entries(mealPlan || {}).forEach(([dateStr, entries]) => {
    try {
      const entryDate = new Date(dateStr);
      if (entryDate >= cutoffTime && entryDate <= baseTime && Array.isArray(entries)) {
        entries.forEach((e) => {
          if (e && typeof e.recipeId === 'number') {
            recentIds.add(e.recipeId);
          }
        });
      }
    } catch {
      // 잘못된 날짜 키 무시
    }
  });

  const result = Array.from(recentIds);
  logger.debug('mealPlanGenerator.getRecentMealRecipeIds', `조회 완료: ${result.length}개 레시피 발견`);
  return result;
}

/**
 * 전체 Recipe 배열을 AI 페이로드에 적합한 경량 Candidate 객체 배열로 변환 (이미지 제외)
 * @param recipes 전체 레시피 목록
 * @param bookmarkedIds 즐겨찾기 ID 목록
 * @returns 경량 AI 후보 레시피 배열
 */
export function prepareAiCandidateRecipes(
  recipes: Recipe[],
  bookmarkedIds: number[] = []
): AiMealPlanCandidateRecipe[] {
  logger.info('mealPlanGenerator.prepareAiCandidateRecipes', `AI 전달 후보 레시피 변환: ${recipes.length}개`);

  const bookmarkedSet = new Set(bookmarkedIds);

  return recipes.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category || '기타',
    cookingTimeMinutes: typeof r.cookingTimeMinutes === 'number' && r.cookingTimeMinutes > 0 ? r.cookingTimeMinutes : null,
    caloriesPerServing: typeof r.caloriesPerServing === 'number' && r.caloriesPerServing > 0 ? r.caloriesPerServing : null,
    baseServings: typeof r.baseServings === 'number' && r.baseServings >= 1 ? r.baseServings : 1,
    isBookmarked: bookmarkedSet.has(r.id),
    // 재료 목록은 150자로 적절히 축약하여 토큰/페이로드 최적화
    ingredients: (r.ingredients || '').replace(/\s+/g, ' ').trim().slice(0, 150),
  }));
}

/**
 * 주간 식단 슬롯들의 칼로리 및 통계를 계산
 * @param slots 식단 슬롯 목록
 * @param allRecipes 전체 레시피 목록
 * @returns 1인 기준 총 칼로리, 슬롯별 총 칼로리, 칼로리 미분석 레시피 수
 */
export function calculateWeeklyPlanCalories(
  slots: Array<{ recipeId: number; servings?: number }>,
  allRecipes: Recipe[]
): {
  totalCaloriesPerPerson: number;
  totalGroupCalories: number;
  uncalculatedCount: number;
  analyzedCount: number;
} {
  logger.debug('mealPlanGenerator.calculateWeeklyPlanCalories', `식단 칼로리 계산: ${slots.length}개 슬롯`);

  const recipeMap = new Map<number, Recipe>();
  allRecipes.forEach((r) => recipeMap.set(r.id, r));

  let totalCaloriesPerPerson = 0;
  let totalGroupCalories = 0;
  let uncalculatedCount = 0;
  let analyzedCount = 0;

  slots.forEach((slot) => {
    const recipe = recipeMap.get(slot.recipeId);
    if (!recipe) return;

    if (typeof recipe.caloriesPerServing === 'number' && recipe.caloriesPerServing > 0) {
      const perServing = recipe.caloriesPerServing;
      const servings = typeof slot.servings === 'number' && slot.servings >= 1 ? slot.servings : (recipe.baseServings || 1);
      totalCaloriesPerPerson += perServing;
      totalGroupCalories += perServing * servings;
      analyzedCount += 1;
    } else {
      uncalculatedCount += 1;
    }
  });

  return {
    totalCaloriesPerPerson,
    totalGroupCalories,
    uncalculatedCount,
    analyzedCount,
  };
}

/**
 * AI API 장애 시 또는 사용자 요청 시 동작하는 지능형 오프라인 식단 자동 채우기 (Fallback)
 * @param config 식단 생성 설정
 * @param allRecipes 전체 레시피 목록
 * @param recentRecipeIds 최근 사용된 레시피 ID 목록
 * @param existingMealPlan 현재 저장된 식단 맵
 * @returns 생성된 식단 아이템 배열 및 요약 설명
 */
export function fallbackGenerateMealPlan(
  config: AiMealPlanRequestConfig,
  allRecipes: Recipe[],
  recentRecipeIds: number[] = [],
  existingMealPlan: Record<string, MealPlanEntry[]> = {}
): { plan: AiGeneratedPlanItem[]; summary: string } {
  logger.info('mealPlanGenerator.fallbackGenerateMealPlan', `오프라인 휴리스틱 식단 생성 시작 (모드: ${config.mode})`);

  if (!allRecipes || allRecipes.length === 0) {
    logger.warn('mealPlanGenerator.fallbackGenerateMealPlan', '등록된 레시피가 없습니다.');
    return {
      plan: [],
      summary: '등록된 레시피가 없어 식단을 구성하지 못했습니다. 먼저 레시피를 등록해주세요.',
    };
  }

  const recentSet = new Set(recentRecipeIds);
  const usedInThisPlan = new Set<number>();
  const generatedPlan: AiGeneratedPlanItem[] = [];

  // 필요한 슬롯 정의
  const targetSlots: MealSlotType[] = config.mode === 'single' ? ['single'] : ['breakfast', 'lunch', 'dinner'];

  // 카테고리 연속 중복 방지용 최근 사용 카테고리
  let lastUsedCategory: string | null = null;

  config.dates.forEach((dateStr) => {
    const existingDayEntries = existingMealPlan[dateStr] || [];

    targetSlots.forEach((slot) => {
      // 1. 빈 날짜만 채우기 모드이고 이미 해당 슬롯에 메뉴가 있는 경우 건너뛰기
      if (config.fillMode === 'emptyOnly') {
        const existingEntry = existingDayEntries.find((e) => e.slot === slot);
        if (existingEntry) {
          usedInThisPlan.add(existingEntry.recipeId);
          return;
        }
      }

      // 2. 후보 레시피 필터링 및 점수화
      const scoredCandidates = allRecipes.map((r) => {
        let score = 50;

        // 2-1. 이번 식단 내 중복 패널티
        if (usedInThisPlan.has(r.id)) {
          score -= config.noDuplicates ? 100 : 20;
        }

        // 2-2. 최근 식단 이력 패널티
        if (recentSet.has(r.id)) {
          score -= config.excludeRecent ? 30 : 5;
        }

        // 2-3. 직전 카테고리 연속 방지
        if (config.diverseCategories && lastUsedCategory && r.category === lastUsedCategory) {
          score -= 15;
        }

        // 2-4. 즐겨찾기 가중치
        if (config.prioritizeBookmarks) {
          // 즐겨찾기 여부는 외부에서 전달되거나 가중치 부여
          score += 15;
        }

        // 2-5. 칼로리 조건
        if (typeof config.maxCaloriesPerServing === 'number' && config.maxCaloriesPerServing > 0) {
          if (typeof r.caloriesPerServing === 'number' && r.caloriesPerServing > 0) {
            if (r.caloriesPerServing <= config.maxCaloriesPerServing) {
              score += 20;
            } else {
              score -= config.strictCalories ? 60 : 25;
            }
          } else if (config.strictCalories) {
            score -= 20;
          }
        }

        // 2-6. 조리시간 조건
        if (typeof config.maxCookingTimeMinutes === 'number' && config.maxCookingTimeMinutes > 0) {
          if (typeof r.cookingTimeMinutes === 'number' && r.cookingTimeMinutes > 0) {
            if (r.cookingTimeMinutes <= config.maxCookingTimeMinutes) {
              score += 20;
            } else {
              score -= 30;
            }
          }
        }

        // 약간의 무작위성 부여 (동점 방지)
        score += Math.random() * 8;

        return { recipe: r, score };
      });

      // 점수 내림차순 정렬
      scoredCandidates.sort((a, b) => b.score - a.score);

      const chosen = scoredCandidates[0]?.recipe;
      if (chosen) {
        generatedPlan.push({
          date: dateStr,
          slot,
          recipeId: chosen.id,
        });
        usedInThisPlan.add(chosen.id);
        lastUsedCategory = chosen.category;
      }
    });
  });

  const summary =
    config.mode === 'single'
      ? `중복을 최소화하고 다양한 카테고리의 요리로 하루 1메뉴 식단을 균형 있게 구성했습니다.`
      : `아침, 점심, 저녁에 맞춰 카테고리와 영양 균형을 고려한 식단을 구성했습니다.`;

  logger.info('mealPlanGenerator.fallbackGenerateMealPlan', `오프라인 식단 생성 완료: ${generatedPlan.length}개 슬롯`);
  return {
    plan: generatedPlan,
    summary,
  };
}

/**
 * AI 응답 데이터와 기존 식단을 병합하여 미리보기 슬롯 리스트로 변환
 * @param config 요청 설정
 * @param aiPlan AI가 제안한 식단 리스트
 * @param existingPlan 현재 저장된 식단
 * @param allRecipes 전체 레시피 목록
 * @returns 화면에서 바로 렌더링/교체 가능한 미리보기 슬롯 목록
 */
export function buildPreviewSlots(
  config: AiMealPlanRequestConfig,
  aiPlan: AiGeneratedPlanItem[],
  existingPlan: Record<string, MealPlanEntry[]>,
  allRecipes: Recipe[]
): AiMealPlanPreviewSlot[] {
  logger.info('mealPlanGenerator.buildPreviewSlots', `미리보기 슬롯 생성 시작`);

  const recipeIdSet = new Set(allRecipes.map((r) => r.id));
  const aiPlanMap = new Map<string, number>();
  aiPlan.forEach((item) => {
    if (recipeIdSet.has(item.recipeId)) {
      aiPlanMap.set(`${item.date}_${item.slot}`, item.recipeId);
    }
  });

  const targetSlots: MealSlotType[] = config.mode === 'single' ? ['single'] : ['breakfast', 'lunch', 'dinner'];
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  const previewSlots: AiMealPlanPreviewSlot[] = [];

  config.dates.forEach((dateStr) => {
    const d = new Date(dateStr);
    const dayName = dayNames[d.getDay()] || '';
    const dayExistingEntries = existingPlan[dateStr] || [];

    targetSlots.forEach((slot) => {
      const key = `${dateStr}_${slot}`;
      const existingEntry = dayExistingEntries.find((e) => e.slot === slot);

      // 빈 날짜만 채우기 모드이고 기존 항목이 있는 경우 기존 항목 우선 유지
      if (config.fillMode === 'emptyOnly' && existingEntry && recipeIdSet.has(existingEntry.recipeId)) {
        previewSlots.push({
          date: dateStr,
          dayName,
          slot,
          recipeId: existingEntry.recipeId,
          servings: existingEntry.servings || config.servings,
          isPreservedFromExisting: true,
        });
        return;
      }

      // AI가 제안한 레시피
      const aiRecipeId = aiPlanMap.get(key);
      if (aiRecipeId && recipeIdSet.has(aiRecipeId)) {
        previewSlots.push({
          date: dateStr,
          dayName,
          slot,
          recipeId: aiRecipeId,
          servings: config.servings,
          isPreservedFromExisting: false,
        });
      } else if (existingEntry && recipeIdSet.has(existingEntry.recipeId)) {
        // AI 제안이 누락된 경우 기존 항목 유지
        previewSlots.push({
          date: dateStr,
          dayName,
          slot,
          recipeId: existingEntry.recipeId,
          servings: existingEntry.servings || config.servings,
          isPreservedFromExisting: true,
        });
      }
    });
  });

  logger.info('mealPlanGenerator.buildPreviewSlots', `미리보기 슬롯 생성 완료: ${previewSlots.length}개`);
  return previewSlots;
}

/**
 * 확정된 미리보기 슬롯들을 기존 MealPlanEntry 맵으로 변환
 * @param previewSlots 미리보기에서 확정된 슬롯 목록
 * @param existingMealPlan 현재 전체 식단 맵
 * @param targetDates 이번에 업데이트된 날짜 목록
 * @param fillMode 'emptyOnly' | 'replaceWeek'
 * @returns 최종 저장용 Record<string, MealPlanEntry[]>
 */
export function convertPreviewSlotsToMealPlan(
  previewSlots: AiMealPlanPreviewSlot[],
  existingMealPlan: Record<string, MealPlanEntry[]>,
  targetDates: string[],
  fillMode: 'emptyOnly' | 'replaceWeek'
): Record<string, MealPlanEntry[]> {
  logger.info('mealPlanGenerator.convertPreviewSlotsToMealPlan', `식단 데이터 변환 및 병합 (모드: ${fillMode})`);

  const newPlan: Record<string, MealPlanEntry[]> = { ...existingMealPlan };

  // 'replaceWeek' 모드인 경우 해당 주간의 날짜 항목들을 먼저 초기화
  if (fillMode === 'replaceWeek') {
    targetDates.forEach((dateStr) => {
      delete newPlan[dateStr];
    });
  }

  // 슬롯들을 날짜별로 그룹화하여 추가/갱신
  previewSlots.forEach((slotItem) => {
    const { date, slot, recipeId, servings } = slotItem;
    const currentDayEntries = newPlan[date] || [];

    // 동일 슬롯 기존 항목 필터링
    const filtered = currentDayEntries.filter((e) => e.slot !== slot);

    const newEntry: MealPlanEntry = {
      id: `meal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      date,
      slot,
      recipeId,
      servings: typeof servings === 'number' && servings >= 1 ? servings : 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    newPlan[date] = [...filtered, newEntry];
  });

  return newPlan;
}
