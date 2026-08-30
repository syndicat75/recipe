/**
 * @file tests/unit/mealPlanGenerator.test.ts
 * @description 주간 식단표 오프라인 생성 및 최근 식단 배제 휴리스틱 단위 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  fallbackGenerateMealPlan,
  getRecentMealRecipeIds,
  calculateWeeklyPlanCalories,
} from '../../src/utils/mealPlanGenerator';
import { Recipe, WeeklyMealPlan } from '../../src/types/recipe';
import { AiMealPlanRequestConfig } from '../../src/types/mealPlan';

describe('Meal Plan Generator Unit Tests', () => {
  const sampleRecipes: Recipe[] = [
    {
      id: 101,
      name: '소고기 미역국',
      category: '국·찌개',
      ingredients: '미역\n소고기',
      method: '끓인다',
      ingredientCount: 2,
      stepCount: 1,
      icon: '🍲',
      cookingTimeMinutes: 25,
      caloriesPerServing: 280,
    },
    {
      id: 102,
      name: '닭가슴살 샐러드',
      category: '다이어트',
      ingredients: '닭가슴살\n양상추',
      method: '버무린다',
      ingredientCount: 2,
      stepCount: 1,
      icon: '🥗',
      cookingTimeMinutes: 15,
      caloriesPerServing: 220,
    },
    {
      id: 103,
      name: '제육볶음',
      category: '일품요리',
      ingredients: '돼지고기\n양파',
      method: '볶는다',
      ingredientCount: 2,
      stepCount: 1,
      icon: '🍖',
      cookingTimeMinutes: 20,
      caloriesPerServing: 450,
    },
    {
      id: 104,
      name: '김치찌개',
      category: '국·찌개',
      ingredients: '김치\n돼지고기',
      method: '끓인다',
      ingredientCount: 2,
      stepCount: 1,
      icon: '🍲',
      cookingTimeMinutes: 30,
      caloriesPerServing: 350,
    },
  ];

  it('fallbackGenerateMealPlan이 요청된 날짜들에 맞추어 유효한 식단을 생성해야 함', () => {
    const config: AiMealPlanRequestConfig = {
      dates: ['2026-09-01', '2026-09-02', '2026-09-03'],
      mode: 'single',
      servings: 2,
      fillMode: 'replaceWeek',
      noDuplicates: true,
      excludeRecent: true,
      diverseCategories: true,
      prioritizeBookmarks: false,
      maxCaloriesPerServing: null,
      strictCalories: false,
      maxCookingTimeMinutes: null,
      customPrompt: '',
    };

    const result = fallbackGenerateMealPlan(config, sampleRecipes, []);
    expect(result.plan.length).toBe(3);
    expect(result.plan.every((s) => s.recipeId > 0)).toBe(true);
    expect(result.plan.every((s) => s.slot === 'single')).toBe(true);
  });

  it('getRecentMealRecipeIds가 최근 날짜에 등록된 식단의 레시피 ID 목록을 정확히 추출해야 함', () => {
    const currentPlan: WeeklyMealPlan = {
      '2026-08-28': [
        {
          id: 'm1',
          date: '2026-08-28',
          slot: 'single',
          recipeId: 101,
          servings: 2,
          createdAt: Date.now(),
        },
      ],
      '2026-08-29': [
        {
          id: 'm2',
          date: '2026-08-29',
          slot: 'single',
          recipeId: 103,
          servings: 2,
          createdAt: Date.now(),
        },
      ],
    };

    const recentIds = getRecentMealRecipeIds(currentPlan, new Date('2026-08-29'), 7);
    expect(recentIds).toContain(101);
    expect(recentIds).toContain(103);
  });

  it('calculateWeeklyPlanCalories가 총 칼로리 및 통계를 정확히 계산해야 함', () => {
    const slots = [
      { recipeId: 101, servings: 2 },
      { recipeId: 102, servings: 2 },
    ];

    const summary = calculateWeeklyPlanCalories(slots, sampleRecipes);
    expect(summary.totalCaloriesPerPerson).toBe(500); // 280 + 220
    expect(summary.totalGroupCalories).toBe(1000); // (280*2) + (220*2)
    expect(summary.analyzedCount).toBe(2);
    expect(summary.uncalculatedCount).toBe(0);
  });
});
