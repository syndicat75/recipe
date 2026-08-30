/**
 * @file src/hooks/useRecipeFilter.ts
 * @description 레시피 목록의 카테고리 필터링, 실시간 검색, 영양성분 조건 필터링(칼로리, 단백질, 나트륨, 식이섬유, 채소 비중),
 * 다중 정렬 및 카테고리별 개수 계산 훅.
 */

import { useState, useMemo, useCallback } from 'react';
import { Recipe, FilterCategory, SortOption, RecipeCategoryDoc, NutritionFilterState } from '../types/recipe';
import { CATEGORY_LIST } from '../config/appConfig';
import { matchesNutritionFilter, getEffectiveNutrition, isVegetableRich } from '../utils/nutritionCalculator';
import { logger } from '../utils/logger';

export interface UseRecipeFilterOptions {
  /** 전체 레시피 목록 */
  recipes: Recipe[];
  /** 즐겨찾기 ID 목록 */
  bookmarkedIds: number[];
  /** 레시피별 메모 맵 */
  userNotes: Record<number, string>;
  /** 동적 카테고리 목록 */
  categories?: RecipeCategoryDoc[];
}

export interface UseRecipeFilterReturn {
  /** 현재 활성 카테고리 필터 */
  activeCategory: FilterCategory;
  /** 카테고리 필터 변경자 */
  setActiveCategory: React.Dispatch<React.SetStateAction<FilterCategory>>;
  /** 현재 검색어 */
  searchQuery: string;
  /** 검색어 변경자 */
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  /** 영양 성분 필터 상태 */
  nutritionFilter: NutritionFilterState;
  /** 영양 성분 필터 변경자 */
  setNutritionFilter: React.Dispatch<React.SetStateAction<NutritionFilterState>>;
  /** 영양 성분 필터 초기화 */
  resetNutritionFilter: () => void;
  /** 현재 정렬 옵션 */
  sortOption: SortOption;
  /** 정렬 옵션 변경자 */
  setSortOption: React.Dispatch<React.SetStateAction<SortOption>>;
  /** 카테고리별 레시피 개수 맵 */
  categoryCounts: Record<string, number>;
  /** 필터 및 정렬이 적용된 최종 레시피 목록 */
  filteredAndSortedRecipes: Recipe[];
}

/**
 * 초기 영양 필터 상태
 */
const initialNutritionFilter: NutritionFilterState = {
  maxCalories: undefined,
  minProtein: undefined,
  maxSodium: undefined,
  minFiber: undefined,
  vegetableRichOnly: false,
};

/**
 * 레시피 필터 및 검색 정렬 훅
 * @param options { recipes, bookmarkedIds, userNotes, categories }
 */
export function useRecipeFilter({
  recipes,
  bookmarkedIds,
  userNotes,
  categories,
}: UseRecipeFilterOptions): UseRecipeFilterReturn {
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('전체');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [nutritionFilter, setNutritionFilter] = useState<NutritionFilterState>(initialNutritionFilter);
  const [sortOption, setSortOption] = useState<SortOption>('default');

  /**
   * 영양 필터만 초기화하는 함수
   */
  const resetNutritionFilter = useCallback(() => {
    logger.info('useRecipeFilter.resetNutritionFilter', '영양 필터 초기화');
    setNutritionFilter(initialNutritionFilter);
  }, []);

  // 카테고리별 개수 맵 계산 (동적 카테고리 + 기본 카테고리 + 실제 레시피에 존재하는 모든 카테고리 통합)
  const categoryCounts = useMemo((): Record<string, number> => {
    const counts: Record<string, number> = {};

    // 1. 기본 카테고리 0으로 초기화
    CATEGORY_LIST.forEach((cat) => {
      counts[cat] = 0;
    });

    // 2. 동적 카테고리 목록이 있으면 0으로 초기화
    if (categories && Array.isArray(categories)) {
      categories.forEach((cat) => {
        counts[cat.name] = 0;
      });
    }

    // 3. 실제 레시피 순회하며 카운트 누적
    recipes.forEach((r) => {
      const cat = r.category || '기타';
      counts[cat] = (counts[cat] || 0) + 1;
    });

    return counts;
  }, [recipes, categories]);

  // 검색, 카테고리, 영양 필터링 및 정렬 적용된 레시피 목록 계산
  const filteredAndSortedRecipes = useMemo((): Recipe[] => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = recipes.filter((r) => {
      // 1. 카테고리 필터
      if (activeCategory === '즐겨찾기') {
        if (!bookmarkedIds.includes(r.id)) return false;
      } else if (activeCategory !== '전체') {
        if (r.category !== activeCategory) return false;
      }

      // 2. 검색어 필터
      if (q) {
        const note = userNotes[r.id] || '';
        const fullText = `${r.name} ${r.ingredients} ${r.method || ''} ${note}`.toLowerCase();
        if (!fullText.includes(q)) return false;
      }

      // 3. 영양 성분 필터 (최대 칼로리, 최소 단백질, 최대 나트륨, 최소 식이섬유, 채소 많은 메뉴)
      if (!matchesNutritionFilter(r, nutritionFilter)) {
        return false;
      }

      return true;
    });

    // 4. 정렬 적용
    return [...filtered].sort((a, b) => {
      if (sortOption === 'nameAsc') return a.name.localeCompare(b.name, 'ko');
      if (sortOption === 'nameDesc') return b.name.localeCompare(a.name, 'ko');
      if (sortOption === 'latest') return (b.createdAt || 0) - (a.createdAt || 0);
      if (sortOption === 'updated') {
        const timeA = typeof a.updatedAt === 'number' ? a.updatedAt : new Date(a.updatedAt || 0).getTime();
        const timeB = typeof b.updatedAt === 'number' ? b.updatedAt : new Date(b.updatedAt || 0).getTime();
        return timeB - timeA;
      }
      if (sortOption === 'favorite') {
        const aFav = bookmarkedIds.includes(a.id) ? 1 : 0;
        const bFav = bookmarkedIds.includes(b.id) ? 1 : 0;
        return bFav - aFav;
      }
      if (sortOption === 'ingredientsAsc') return a.ingredientCount - b.ingredientCount;
      if (sortOption === 'ingredientsDesc') return b.ingredientCount - a.ingredientCount;

      // 칼로리 정렬 (1인분 기준)
      if (sortOption === 'caloriesAsc') {
        const calA = a.caloriesPerServing && a.caloriesPerServing > 0 ? a.caloriesPerServing : 999999;
        const calB = b.caloriesPerServing && b.caloriesPerServing > 0 ? b.caloriesPerServing : 999999;
        return calA - calB;
      }
      if (sortOption === 'caloriesDesc') {
        const calA = a.caloriesPerServing && a.caloriesPerServing > 0 ? a.caloriesPerServing : -1;
        const calB = b.caloriesPerServing && b.caloriesPerServing > 0 ? b.caloriesPerServing : -1;
        return calB - calA;
      }

      // 단백질 높은 순 (1인분 기준)
      if (sortOption === 'proteinDesc') {
        const pA = a.nutrition?.protein || 0;
        const pB = b.nutrition?.protein || 0;
        return pB - pA;
      }

      // 나트륨 낮은 순 (1인분 기준)
      if (sortOption === 'sodiumAsc') {
        const sA = a.nutrition?.sodium ?? 999999;
        const sB = b.nutrition?.sodium ?? 999999;
        return sA - sB;
      }

      // 식이섬유 높은 순 (1인분 기준)
      if (sortOption === 'fiberDesc') {
        const fA = a.nutrition?.fiber || 0;
        const fB = b.nutrition?.fiber || 0;
        return fB - fA;
      }

      return 0;
    });
  }, [recipes, activeCategory, searchQuery, nutritionFilter, bookmarkedIds, sortOption, userNotes]);

  return {
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    nutritionFilter,
    setNutritionFilter,
    resetNutritionFilter,
    sortOption,
    setSortOption,
    categoryCounts,
    filteredAndSortedRecipes,
  };
}
