/**
 * @file src/components/SearchBar.tsx
 * @description 레시피 음식명 및 재료명 통합 검색창 컴포넌트, 검색어 초기화 및 실시간 검색어 추천 태그 지원
 */

import React from 'react';
import { Search, X, Sparkles } from 'lucide-react';
import { logger } from '../utils/logger';

interface SearchBarProps {
  /** 현재 검색어 */
  searchQuery: string;
  /** 검색어 변경 핸들러 */
  onSearchChange: (query: string) => void;
  /** 추천 검색 태그 클릭 핸들러 */
  onSelectTag?: (tag: string) => void;
}

/** 추천 검색어 키워드 목록 */
const POPULAR_TAGS = ['두부', '참치', '계란', '간장', '김치', '돼지고기', '스팸', '새우'];

/**
 * 검색 입력창 컴포넌트
 */
export const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery,
  onSearchChange,
  onSelectTag,
}) => {
  /**
   * 검색어 입력 이벤트 핸들러
   * @param e 입력 이벤트 객체
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    logger.info('SearchBar.handleInputChange', `검색어 입력: "${value}"`);
    onSearchChange(value);
  };

  /**
   * 검색어 초기화 핸들러
   */
  const handleClear = (): void => {
    logger.info('SearchBar.handleClear', '검색어 초기화');
    onSearchChange('');
  };

  /**
   * 추천 태그 클릭 핸들러
   * @param tag 클릭한 태그
   */
  const handleTagClick = (tag: string): void => {
    logger.info('SearchBar.handleTagClick', `추천 검색 태그 클릭: ${tag}`);
    onSearchChange(tag);
    if (onSelectTag) {
      onSelectTag(tag);
    }
  };

  return (
    <div className="w-full">
      <div className="relative">
        <span className="sr-only">레시피 검색</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
        <input
          id="searchInput"
          type="search"
          value={searchQuery}
          onChange={handleInputChange}
          placeholder="음식명 또는 재료 검색 (예: 두부, 계란, 참치, 된장)"
          className="w-full rounded-2xl border border-orange-200 bg-white py-3.5 pl-12 pr-10 text-sm text-stone-800 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            aria-label="검색어 지우기"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Recommended Tag Chips */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 px-1 text-xs text-stone-500">
        <span className="flex items-center gap-1 font-semibold text-orange-600">
          <Sparkles className="h-3 w-3" />
          <span>추천 재료:</span>
        </span>
        {POPULAR_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => handleTagClick(tag)}
            className={`rounded-lg px-2 py-0.5 text-[11px] font-medium transition ${
              searchQuery === tag
                ? 'bg-orange-500 font-bold text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-orange-100 hover:text-orange-800'
            }`}
          >
            #{tag}
          </button>
        ))}
      </div>
    </div>
  );
};
