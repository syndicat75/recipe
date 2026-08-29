/**
 * @file src/components/CategoryFilter.tsx
 * @description 카테고리별 탭 필터링 및 즐겨찾기 필터 버튼 목록 컴포넌트
 */

import React from 'react';
import { Bookmark } from 'lucide-react';
import { DEFAULT_CATEGORY_DOCS, getCategoryMeta } from '../config/appConfig';
import { FilterCategory, RecipeCategoryDoc } from '../types/recipe';
import { logger } from '../utils/logger';

interface CategoryFilterProps {
  /** 현재 활성화된 카테고리 */
  activeCategory: FilterCategory;
  /** 카테고리 변경 핸들러 */
  onCategoryChange: (category: FilterCategory) => void;
  /** 카테고리별 레시피 개수 맵 */
  categoryCounts: Record<string, number>;
  /** 전체 레시피 개수 */
  totalCount: number;
  /** 즐겨찾기 레시피 개수 */
  bookmarkCount: number;
  /** 동적 카테고리 문서 목록 (활성화된 카테고리만 전달 권장) */
  categories?: RecipeCategoryDoc[];
}

/**
 * 카테고리 필터 탭 컴포넌트
 */
export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  activeCategory,
  onCategoryChange,
  categoryCounts,
  totalCount,
  bookmarkCount,
  categories = DEFAULT_CATEGORY_DOCS,
}) => {
  /**
   * 카테고리 클릭 핸들러
   * @param category 클릭한 카테고리
   */
  const handleCategoryClick = (category: FilterCategory): void => {
    logger.info('CategoryFilter.handleCategoryClick', `카테고리 필터 선택: ${category}`);
    onCategoryChange(category);
  };

  // 활성화된 카테고리만 필터 버튼으로 표시 (isActive !== false)
  const displayCategories = categories.filter((c) => c.isActive);

  return (
    <div
      id="categories"
      className="no-scrollbar mt-6 flex scroll-mt-24 items-center gap-2 overflow-x-auto pb-2"
      aria-label="레시피 카테고리 목록"
    >
      {/* 전체 버튼 */}
      <button
        type="button"
        onClick={() => handleCategoryClick('전체')}
        className={`whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-bold shadow-sm transition shrink-0 ${
          activeCategory === '전체'
            ? 'bg-stone-900 text-white'
            : 'border border-orange-200 bg-white text-stone-600 hover:border-orange-300 hover:bg-orange-50'
        }`}
      >
        전체 <span className="ml-1 text-xs opacity-75">{totalCount}</span>
      </button>

      {/* 동적 카테고리 목록 버튼들 */}
      {displayCategories.map((catDoc) => {
        const catName = catDoc.name;
        const meta = getCategoryMeta(catName, categories);
        const count = categoryCounts[catName] || 0;
        const isActive = activeCategory === catName;

        return (
          <button
            key={catDoc.id}
            type="button"
            onClick={() => handleCategoryClick(catName)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-bold shadow-sm transition shrink-0 ${
              isActive
                ? 'bg-orange-600 text-white shadow-md'
                : 'border border-orange-200 bg-white text-stone-600 hover:border-orange-300 hover:bg-orange-50'
            }`}
          >
            <span>{meta.icon}</span>
            <span>{catName}</span>
            <span className={`ml-0.5 text-xs ${isActive ? 'text-orange-100' : 'text-stone-400'}`}>
              {count}
            </span>
          </button>
        );
      })}

      {/* 즐겨찾기 필터 버튼 */}
      <button
        type="button"
        onClick={() => handleCategoryClick('즐겨찾기')}
        className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-bold shadow-sm transition shrink-0 ${
          activeCategory === '즐겨찾기'
            ? 'bg-amber-500 text-white shadow-md'
            : 'border border-amber-200 bg-amber-50/70 text-amber-900 hover:bg-amber-100'
        }`}
      >
        <Bookmark className={`h-4 w-4 ${activeCategory === '즐겨찾기' ? 'fill-white' : 'fill-amber-500 text-amber-500'}`} />
        <span>즐겨찾기</span>
        <span className="ml-0.5 text-xs opacity-75">{bookmarkCount}</span>
      </button>
    </div>
  );
};
