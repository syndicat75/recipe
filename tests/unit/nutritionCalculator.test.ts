/**
 * @file tests/unit/nutritionCalculator.test.ts
 * @description 1인분 영양정보 포맷팅, 기준인분 변경 감지(Stale), 채소 풍부 감지, 및 영양성분 필터링 단위 테스트.
 */

import { describe, it, expect } from 'vitest';
import {
  formatNutrient,
  getEffectiveNutrition,
  isNutritionStale,
  isVegetableRich,
  matchesNutritionFilter,
  hasActiveNutritionFilter,
} from '../../src/utils/nutritionCalculator';
import { Recipe, NutritionFilterState } from '../../src/types/recipe';

describe('nutritionCalculator unit tests', () => {
  const mockRecipeFull: Recipe = {
    id: 1,
    name: '소고기 야채 볶음',
    category: '메인요리',
    icon: '🥩',
    ingredients: '소고기 200g\n양파 1개\n당근 1/2개\n브로콜리 100g\n간장 2큰술',
    ingredientCount: 5,
    method: '1. 야채와 소고기를 볶는다.',
    stepCount: 1,
    baseServings: 2,
    caloriesPerServing: 450,
    totalCalories: 900,
    caloriesAnalyzedServings: 2,
    nutrition: {
      calories: 450,
      protein: 35,
      carbs: 20,
      fat: 15,
      sodium: 750,
      fiber: 6,
      vegetableLevel: 'high',
    },
  };

  const mockRecipeLegacy: Recipe = {
    id: 2,
    name: '달걀 볶음밥',
    category: '밥류',
    icon: '🍳',
    ingredients: '밥 1공기\n달걀 2개\n식용유 1큰술\n소금 약간',
    ingredientCount: 4,
    method: '1. 밥과 달걀을 볶는다.',
    stepCount: 1,
    baseServings: 1,
    caloriesPerServing: 520,
    totalCalories: 520,
    caloriesAnalyzedServings: 1,
  };

  const mockRecipeStale: Recipe = {
    id: 3,
    name: '된장찌개',
    category: '국/찌개',
    icon: '🍲',
    ingredients: '된장 2큰술\n두부 1/2모\n애호박 1/3개\n양파 1/2개',
    ingredientCount: 4,
    method: '1. 찌개를 끓인다.',
    stepCount: 1,
    baseServings: 4, // 변경됨
    caloriesPerServing: 180,
    totalCalories: 360,
    caloriesAnalyzedServings: 2, // 분석 당시 2인분
  };

  describe('formatNutrient', () => {
    it('숫자와 단위를 알맞게 포맷팅한다', () => {
      expect(formatNutrient(1250, 'mg')).toBe('1,250 mg');
      expect(formatNutrient(32, 'g')).toBe('32 g');
      expect(formatNutrient(0, 'g')).toBe('0 g');
      expect(formatNutrient(undefined, 'g')).toBe('- g');
    });
  });

  describe('getEffectiveNutrition', () => {
    it('nutrition 객체가 있으면 해당 영양성분을 반환한다', () => {
      const n = getEffectiveNutrition(mockRecipeFull);
      expect(n.calories).toBe(450);
      expect(n.protein).toBe(35);
      expect(n.sodium).toBe(750);
      expect(n.vegetableLevel).toBe('high');
    });

    it('legacy 칼로리만 있는 경우 fallback 칼로리를 반환한다', () => {
      const n = getEffectiveNutrition(mockRecipeLegacy);
      expect(n.calories).toBe(520);
      expect(n.protein).toBe(0);
    });
  });

  describe('isNutritionStale', () => {
    it('분석 당시 인분수와 현재 기본 인분수가 다르면 true를 반환한다', () => {
      expect(isNutritionStale(mockRecipeStale)).toBe(true);
    });

    it('분석 당시 인분수와 기본 인분수가 일치하면 false를 반환한다', () => {
      expect(isNutritionStale(mockRecipeFull)).toBe(false);
    });

    it('칼로리가 분석되지 않은 레시피는 false를 반환한다', () => {
      const unanalyzed: Recipe = {
        id: 4,
        name: '미분석 라면',
        category: '면류',
        icon: '🍜',
        ingredients: '라면 1개',
        ingredientCount: 1,
        method: '1. 라면을 끓인다.',
        stepCount: 1,
      };
      expect(isNutritionStale(unanalyzed)).toBe(false);
    });
  });

  describe('isVegetableRich', () => {
    it('vegetableLevel이 high이거나 채소 키워드가 다수 포함되면 true를 반환한다', () => {
      expect(isVegetableRich(mockRecipeFull)).toBe(true);
    });

    it('채소 재료가 적은 경우 false를 반환한다', () => {
      expect(isVegetableRich(mockRecipeLegacy)).toBe(false);
    });
  });

  describe('matchesNutritionFilter', () => {
    it('필터가 비어있으면 모든 레시피가 통과한다', () => {
      const emptyFilter: NutritionFilterState = {};
      expect(matchesNutritionFilter(mockRecipeFull, emptyFilter)).toBe(true);
      expect(matchesNutritionFilter(mockRecipeLegacy, emptyFilter)).toBe(true);
    });

    it('최대 칼로리 조건을 올바르게 필터링한다', () => {
      const filter500: NutritionFilterState = { maxCalories: 500 };
      expect(matchesNutritionFilter(mockRecipeFull, filter500)).toBe(true); // 450 <= 500
      expect(matchesNutritionFilter(mockRecipeLegacy, filter500)).toBe(false); // 520 > 500
    });

    it('최소 단백질 조건을 올바르게 필터링한다', () => {
      const filterProtein30: NutritionFilterState = { minProtein: 30 };
      expect(matchesNutritionFilter(mockRecipeFull, filterProtein30)).toBe(true); // 35 >= 30
      expect(matchesNutritionFilter(mockRecipeLegacy, filterProtein30)).toBe(false); // 0 < 30
    });

    it('최대 나트륨 조건을 올바르게 필터링한다', () => {
      const filterSodium800: NutritionFilterState = { maxSodium: 800 };
      expect(matchesNutritionFilter(mockRecipeFull, filterSodium800)).toBe(true); // 750 <= 800
      expect(matchesNutritionFilter(mockRecipeLegacy, filterSodium800)).toBe(false); // undefined/unspecified defaults to reject if required
    });

    it('채소 많은 메뉴 필터를 올바르게 필터링한다', () => {
      const vegFilter: NutritionFilterState = { vegetableRichOnly: true };
      expect(matchesNutritionFilter(mockRecipeFull, vegFilter)).toBe(true);
      expect(matchesNutritionFilter(mockRecipeLegacy, vegFilter)).toBe(false);
    });
  });

  describe('hasActiveNutritionFilter', () => {
    it('활성화된 필터가 있으면 true를 반환한다', () => {
      expect(hasActiveNutritionFilter({ maxCalories: 500 })).toBe(true);
      expect(hasActiveNutritionFilter({ vegetableRichOnly: true })).toBe(true);
      expect(hasActiveNutritionFilter({ minProtein: 20 })).toBe(true);
    });

    it('모든 조건이 비어있으면 false를 반환한다', () => {
      expect(hasActiveNutritionFilter({})).toBe(false);
      expect(hasActiveNutritionFilter({ maxCalories: undefined, vegetableRichOnly: false })).toBe(false);
    });
  });
});
