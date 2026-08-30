/**
 * @file src/components/RecipeList.tsx
 * @description 레시피 그리드 레이아웃, 확장 정렬 옵션, 검색/필터링 결과 요약 및 빈 상태 UI 컴포넌트
 */

import React from 'react';
import { ArrowUpDown, SearchX, RotateCcw, PlusCircle } from 'lucide-react';
import { FilterCategory, Recipe, SortOption } from '../types/recipe';
import { RecipeCard } from './RecipeCard';
import { logger } from '../utils/logger';

interface RecipeListProps {
  /** 필터링 및 정렬된 레시피 목록 */
  recipes: Recipe[];
  /** 현재 활성화된 카테고리 필터 */
  activeCategory: FilterCategory;
  /** 현재 검색어 */
  searchQuery: string;
  /** 북마크 ID 목록 */
  bookmarkedIds: number[];
  /** 가족 공간에 공유된 레시피 ID 집합 */
  sharedRecipeIds?: Set<number>;
  /** 정렬 옵션 */
  sortOption: SortOption;
  /** 정렬 옵션 변경 핸들러 */
  onSortChange: (option: SortOption) => void;
  /** 북마크 토글 핸들러 */
  onToggleBookmark: (recipeId: number) => void;
  /** 상세 모달 열기 핸들러 */
  onOpenDetail: (recipe: Recipe) => void;
  /** 필터 초기화 핸들러 */
  onResetFilters: () => void;
  /** 새 레시피 추가 모달 열기 핸들러 */
  onOpenAddRecipe?: () => void;
  /** 관리자 여부 */
  isAdmin?: boolean;
}

/**
 * 레시피 그리드 및 결과 목록 컴포넌트
 */
export const RecipeList: React.FC<RecipeListProps> = ({
  recipes,
  activeCategory,
  searchQuery,
  bookmarkedIds,
  sharedRecipeIds,
  sortOption,
  onSortChange,
  onToggleBookmark,
  onOpenDetail,
  onResetFilters,
  onOpenAddRecipe,
  isAdmin = false,
}) => {
  /**
   * 결과 텍스트를 계산하여 반환합니다.
   * @returns 사용자 친화적 결과 문구
   */
  const getResultText = (): string => {
    logger.debug('RecipeList.getResultText', `결과 요약 문구 생성: 카테고리=${activeCategory}, 검색어=${searchQuery}`);
    if (searchQuery.trim()) {
      return `'${searchQuery}' 검색 결과 ${recipes.length}개의 레시피를 찾았습니다.`;
    }
    if (activeCategory === '즐겨찾기') {
      return `즐겨찾기한 레시피 ${recipes.length}개`;
    }
    if (activeCategory === '전체') {
      return `전체 ${recipes.length}개의 레시피`;
    }
    return `${activeCategory} 카테고리 레시피 ${recipes.length}개`;
  };

  /**
   * 정렬 셀렉트 변경 핸들러
   * @param e 변경 이벤트
   */
  const handleSortSelect = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const val = e.target.value as SortOption;
    logger.info('RecipeList.handleSortSelect', `정렬 옵션 변경: ${val}`);
    onSortChange(val);
  };

  return (
    <section id="recipes" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      {/* Top Header & Sort Control */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p id="resultText" className="text-sm font-semibold text-stone-600">
            {getResultText()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-stone-400" />
          <select
            value={sortOption}
            onChange={handleSortSelect}
            className="rounded-xl border border-orange-200 bg-white px-3 py-1.5 text-xs font-bold text-stone-700 shadow-sm outline-none transition focus:border-orange-400"
            aria-label="레시피 정렬 기준 선택"
          >
            <option value="default">기본 순서</option>
            <option value="nameAsc">이름 가나다순</option>
            <option value="nameDesc">이름 역순</option>
            <option value="latest">최근 추가순</option>
            <option value="updated">최근 수정순</option>
            <option value="favorite">즐겨찾기 우선순</option>
            <option value="ingredientsAsc">재료 적은 순</option>
            <option value="ingredientsDesc">재료 많은 순</option>
            <option value="caloriesAsc">🔥 칼로리 낮은 순 (1인분)</option>
            <option value="caloriesDesc">🔥 칼로리 높은 순 (1인분)</option>
            <option value="proteinDesc">🥩 단백질 높은 순 (1인분)</option>
            <option value="sodiumAsc">🧂 나트륨 낮은 순 (1인분)</option>
            <option value="fiberDesc">🌿 식이섬유 높은 순 (1인분)</option>
          </select>
        </div>
      </div>

      {/* Recipe Cards Grid */}
      {recipes.length > 0 ? (
        <div
          id="recipeGrid"
          className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              isBookmarked={bookmarkedIds.includes(recipe.id)}
              isFamilyShared={sharedRecipeIds?.has(recipe.id)}
              onToggleBookmark={onToggleBookmark}
              onOpenDetail={onOpenDetail}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div
          id="emptyState"
          className="mt-8 flex flex-col items-center justify-center rounded-3xl border border-dashed border-orange-200 bg-white/80 px-6 py-16 text-center shadow-sm"
        >
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-orange-50 text-3xl">
            <SearchX className="h-8 w-8 text-orange-500" />
          </div>
          <h3 className="mt-4 font-soft text-xl font-black text-stone-800">
            {activeCategory === '즐겨찾기'
              ? '즐겨찾기한 레시피가 없습니다'
              : searchQuery.trim()
              ? `'${searchQuery}' 검색 결과가 없습니다`
              : '등록된 레시피가 없습니다'}
          </h3>
          <p className="mt-2 max-w-md text-xs leading-6 text-stone-500 sm:text-sm">
            {activeCategory === '즐겨찾기'
              ? '자주 요리하는 레시피의 북마크(♡) 버튼을 눌러 모아보세요.'
              : '철자를 확인하시거나 다른 검색어를 입력해보세요.'}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onResetFilters}
              className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold text-stone-700 shadow-sm transition hover:bg-stone-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>전체 레시피 보기</span>
            </button>

            {isAdmin && onOpenAddRecipe && (
              <button
                type="button"
                onClick={onOpenAddRecipe}
                className="flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-orange-600"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>새 레시피 등록하기</span>
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
