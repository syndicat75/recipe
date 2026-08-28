/**
 * @file src/hooks/useRecipeFilter.ts
 * @description 레시피 목록의 카테고리 필터링, 실시간 검색, 다중 정렬 및 카테고리별 개수 계산 훅.
 */

import { useState, useMemo } from 'react';
import { Recipe, FilterCategory, SortOption } from '../types/recipe';
import { CATEGORY_LIST } from '../config/appConfig';

export interface UseRecipeFilterOptions {
  /** 전체 레시피 목록 */
  recipes: Recipe[];
  /** 즐겨찾기 ID 목록 */
  bookmarkedIds: number[];
  /** 레시피별 메모 맵 */
  userNotes: Record<number, string>;
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
 * 레시피 필터 및 검색 정렬 훅
 * @param options { recipes, bookmarkedIds, userNotes }
 */
export function useRecipeFilter({
  recipes,
  bookmarkedIds,
  userNotes,
}: UseRecipeFilterOptions): UseRecipeFilterReturn {
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('전체');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOption, setSortOption] = useState<SortOption>('default');

  // 카테고리별 개수 맵 계산
  const categoryCounts = useMemo((): Record<string, number> => {
    const counts: Record<string, number> = {};
    CATEGORY_LIST.forEach((cat) => {
      counts[cat] = recipes.filter((r) => r.category === cat).length;
    });
    return counts;
  }, [recipes]);

  // 검색 및 필터링, 정렬 적용된 레시피 목록 계산
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

      return true;
    });

    // 3. 정렬 적용
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
      return 0;
    });
  }, [recipes, activeCategory, searchQuery, bookmarkedIds, sortOption, userNotes]);

  return {
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    sortOption,
    setSortOption,
    categoryCounts,
    filteredAndSortedRecipes,
  };
}
