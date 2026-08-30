/**
 * @file src/utils/nutritionCalculator.ts
 * @description 레시피 영양성분(칼로리, 단백질, 탄수화물, 지방, 나트륨, 식이섬유) 포맷팅,
 * 영양 필터 매칭, 채소 풍부 여부 판별 및 영양정보 정규화 유틸리티.
 */

import { Recipe, NutritionInfo, NutritionFilterState } from '../types/recipe';
import { logger } from './logger';

/** 채소 풍부 여부를 판별하기 위한 대표 채소/식물성 식재료 키워드 목록 */
const VEGETABLE_KEYWORDS = [
  '채소', '야채', '시금치', '배추', '김치', '상추', '깻잎', '양배추', '브로콜리',
  '애호박', '호박', '오이', '당근', '양파', '대파', '쪽파', '부추', '콩나물', '숙주',
  '무', '열무', '가지', '파프리카', '피망', '버섯', '표고', '새송이', '느타리', '팽이',
  '미역', '다시마', '샐러드', '토마토', '아스파라거스', '샐러리', '콜리플라워', '케일',
];

/**
 * 영양 성분 수치를 한국어 표준 및 천 단위 콤마 형식으로 포맷팅합니다.
 * @param value 숫자 값 (g, mg, kcal)
 * @param unit 단위 문자열 ('g' | 'mg' | 'kcal')
 * @returns 포맷팅된 문자열 (예: "1,250 mg", "32 g", "520 kcal")
 */
export function formatNutrient(value?: number | null, unit: string = 'g'): string {
  if (value === undefined || value === null || isNaN(value)) {
    return `- ${unit}`;
  }
  const formattedNumber = Math.round(value).toLocaleString('ko-KR');
  return `${formattedNumber} ${unit}`;
}

/**
 * 숫자를 천 단위 콤마가 적용된 문자열로 변환합니다.
 * @param value 포맷할 숫자
 * @returns 포맷된 문자열
 */
export function formatNutrientValueOnly(value?: number | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '-';
  }
  return Math.round(value).toLocaleString('ko-KR');
}

/**
 * 레시피의 유효 1인분 영양정보 객체를 반환합니다.
 * nutrition 필드가 없을 경우 caloriesPerServing을 기반으로 최소 정보를 구성합니다.
 * @param recipe 레시피 객체
 * @returns NutritionInfo 또는 undefined
 */
export function getEffectiveNutrition(recipe?: Recipe | null): NutritionInfo | undefined {
  if (!recipe) return undefined;

  if (recipe.nutrition && typeof recipe.nutrition.calories === 'number') {
    return recipe.nutrition;
  }

  if (recipe.caloriesPerServing && recipe.caloriesPerServing > 0) {
    return {
      calories: recipe.caloriesPerServing,
      protein: 0,
      carbs: 0,
      fat: 0,
      sodium: 0,
      fiber: 0,
      vegetableLevel: 'medium',
    };
  }

  return undefined;
}

/**
 * 레시피가 채소가 풍부한 메뉴인지 판별합니다.
 * AI 분석의 vegetableLevel === 'high'이거나 식이섬유가 4g 이상인 경우, 또는 재료에 채소가 다수 포함된 경우 true를 반환합니다.
 * @param recipe 판별할 레시피
 * @returns 채소 풍부 여부 (boolean)
 */
export function isVegetableRich(recipe: Recipe): boolean {
  // 1. AI 영양정보 분석 결과 확인
  if (recipe.nutrition) {
    if (recipe.nutrition.vegetableLevel === 'high') {
      return true;
    }
    if (recipe.nutrition.fiber && recipe.nutrition.fiber >= 4) {
      return true;
    }
  }

  // 2. 카테고리가 '반찬' 또는 샐러드인 경우 가중치
  const cat = (recipe.category || '').toLowerCase();
  if (cat.includes('샐러드') || cat.includes('나물')) {
    return true;
  }

  // 3. 재료 텍스트 키워드 매칭 분석
  const ingText = (recipe.ingredients || '').toLowerCase();
  const nameText = (recipe.name || '').toLowerCase();
  let matchedVegCount = 0;

  for (const keyword of VEGETABLE_KEYWORDS) {
    if (ingText.includes(keyword) || nameText.includes(keyword)) {
      matchedVegCount++;
      if (matchedVegCount >= 2) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 레시피가 주어진 영양 필터 조건에 부합하는지 검사합니다.
 * @param recipe 검사할 대상 레시피
 * @param filter 영양 필터 상태
 * @returns 조건 충족 여부 (boolean)
 */
export function matchesNutritionFilter(recipe: Recipe, filter: NutritionFilterState): boolean {
  const calories = recipe.caloriesPerServing || recipe.nutrition?.calories;

  // 1. 최대 칼로리 필터 (kcal 이하)
  if (typeof filter.maxCalories === 'number' && filter.maxCalories > 0) {
    if (!calories || calories > filter.maxCalories) {
      return false;
    }
  }

  // 2. 최소 단백질 필터 (g 이상)
  if (typeof filter.minProtein === 'number' && filter.minProtein > 0) {
    const protein = recipe.nutrition?.protein;
    if (typeof protein !== 'number' || protein < filter.minProtein) {
      return false;
    }
  }

  // 3. 최대 나트륨 필터 (mg 이하)
  if (typeof filter.maxSodium === 'number' && filter.maxSodium > 0) {
    const sodium = recipe.nutrition?.sodium;
    if (typeof sodium !== 'number' || sodium > filter.maxSodium) {
      return false;
    }
  }

  // 4. 최소 식이섬유 필터 (g 이상)
  if (typeof filter.minFiber === 'number' && filter.minFiber > 0) {
    const fiber = recipe.nutrition?.fiber;
    if (typeof fiber !== 'number' || fiber < filter.minFiber) {
      return false;
    }
  }

  // 5. 채소 많은 메뉴 필터
  if (filter.vegetableRichOnly) {
    if (!isVegetableRich(recipe)) {
      return false;
    }
  }

  return true;
}

/**
 * 현재 영양 필터에 활성화된 조건이 하나라도 있는지 확인합니다.
 * @param filter 영양 필터 객체
 * @returns 활성 필터 존재 여부
 */
export function hasActiveNutritionFilter(filter?: NutritionFilterState | null): boolean {
  if (!filter) return false;
  return Boolean(
    (typeof filter.maxCalories === 'number' && filter.maxCalories > 0) ||
    (typeof filter.minProtein === 'number' && filter.minProtein > 0) ||
    (typeof filter.maxSodium === 'number' && filter.maxSodium > 0) ||
    (typeof filter.minFiber === 'number' && filter.minFiber > 0) ||
    filter.vegetableRichOnly
  );
}

/**
 * 레시피의 영양/칼로리 분석 결과가 현재 레시피 기준 인분과 다른 Stale 상태인지 확인합니다.
 * @param recipe 레시피 객체
 * @returns 재분석 권장 여부 (boolean)
 */
export function isNutritionStale(recipe: Recipe): boolean {
  const currentBase = typeof recipe.baseServings === 'number' && recipe.baseServings >= 1
    ? recipe.baseServings
    : 1;

  if (!recipe.caloriesPerServing || recipe.caloriesPerServing <= 0) {
    return false; // 미분석 상태는 stale이 아님 (미분석으로 분류)
  }

  if (
    typeof recipe.caloriesAnalyzedServings === 'number' &&
    recipe.caloriesAnalyzedServings >= 1 &&
    recipe.caloriesAnalyzedServings !== currentBase
  ) {
    return true;
  }

  return false;
}

/**
 * 채소 비중 수준에 대한 한국어 라벨을 반환합니다.
 * @param level 채소 수준 ('high' | 'medium' | 'low')
 * @returns 한국어 라벨
 */
export function getVegetableLevelLabel(level?: 'high' | 'medium' | 'low'): string {
  switch (level) {
    case 'high':
      return '채소 듬뿍 🥦';
    case 'medium':
      return '보통 🥗';
    case 'low':
      return '적음 🥩';
    default:
      return '보통 🥗';
  }
}
