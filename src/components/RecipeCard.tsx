/**
 * @file src/components/RecipeCard.tsx
 * @description 개별 레시피 카드 컴포넌트. 4:3 비율 사진/이모지 지원, 카테고리 뱃지, 재료 프리뷰, 즐겨찾기 토글 및 상세 모달 열기 지원
 */

import React from 'react';
import { Bookmark, Clock, Flame, ArrowRight, Sparkles } from 'lucide-react';
import { CATEGORY_CONFIG } from '../config/appConfig';
import { Recipe } from '../types/recipe';
import { logger } from '../utils/logger';

interface RecipeCardProps {
  /** 레시피 데이터 객체 */
  recipe: Recipe;
  /** 북마크 여부 */
  isBookmarked: boolean;
  /** 북마크 토글 이벤트 핸들러 */
  onToggleBookmark: (recipeId: number) => void;
  /** 레시피 상세 모달 열기 이벤트 핸들러 */
  onOpenDetail: (recipe: Recipe) => void;
  /** 관리자 여부 */
  isAdmin?: boolean;
}

/**
 * 개별 레시피 카드 컴포넌트
 */
export const RecipeCard: React.FC<RecipeCardProps> = ({
  recipe,
  isBookmarked,
  onToggleBookmark,
  onOpenDetail,
  isAdmin = false,
}) => {
  /**
   * 재료 텍스트를 파싱하여 첫 줄부터 배열로 분리합니다.
   * @returns 재료 문자열 배열
   */
  const getIngredientLines = (): string[] => {
    logger.debug('RecipeCard.getIngredientLines', `레시피(${recipe.name}) 재료 파싱`);
    if (!recipe.ingredients) return [];
    return recipe.ingredients
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const ingredients = getIngredientLines();
  const previewIngredients = ingredients.slice(0, 4);
  const remainingCount = Math.max(0, ingredients.length - 4);
  const categoryMeta = CATEGORY_CONFIG[recipe.category] || CATEGORY_CONFIG['기타'];
  const hasMethod = recipe.method && recipe.method.trim() && recipe.method.trim() !== '-';

  /**
   * 북마크 버튼 클릭 핸들러
   * @param e 클릭 이벤트
   */
  const handleBookmarkClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    logger.info('RecipeCard.handleBookmarkClick', `즐겨찾기 토글 클릭: 레시피 ID ${recipe.id}`);
    onToggleBookmark(recipe.id);
  };

  /**
   * 카드 전체 클릭 핸들러
   */
  const handleCardClick = (): void => {
    logger.info('RecipeCard.handleCardClick', `레시피 상세 열기: ${recipe.name}`);
    onOpenDetail(recipe);
  };

  return (
    <article className="h-full">
      <div
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCardClick();
          }
        }}
        className="group relative flex h-full w-full flex-col justify-between overflow-hidden rounded-[1.75rem] border border-orange-100/90 bg-white text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-orange-300 hover:shadow-xl hover:shadow-orange-900/5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-400"
      >
        {/* Optional Recipe Header Photo (4:3 aspect ratio) */}
        {recipe.imageUrl && (
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100">
            <img
              src={recipe.imageUrl}
              alt={recipe.name}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              <span className="rounded-lg bg-black/60 px-2.5 py-1 text-[11px] font-extrabold text-white backdrop-blur-md">
                {recipe.icon} {recipe.category}
              </span>
              <button
                type="button"
                onClick={handleBookmarkClick}
                className={`grid h-8 w-8 place-items-center rounded-full shadow-md backdrop-blur-md transition ${
                  isBookmarked
                    ? 'bg-amber-500 text-white'
                    : 'bg-white/80 text-stone-700 hover:bg-white hover:text-orange-600'
                }`}
                aria-label={isBookmarked ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                title={isBookmarked ? '즐겨찾기 해제' : '즐겨찾기 추가'}
              >
                <Bookmark
                  className={`h-4 w-4 ${isBookmarked ? 'fill-white text-white' : ''}`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Card Content Body */}
        <div className="flex flex-1 flex-col justify-between p-5 sm:p-6">
          <div>
            {/* Top Row if no photo: Icon & Badges */}
            {!recipe.imageUrl && (
              <div className="flex items-start justify-between gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-50 text-2xl shadow-inner transition group-hover:scale-110 group-hover:rotate-3">
                  {recipe.icon || categoryMeta.icon}
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${categoryMeta.badgeClass}`}
                  >
                    {recipe.category}
                  </span>

                  {/* Bookmark Button */}
                  <button
                    type="button"
                    onClick={handleBookmarkClick}
                    className={`grid h-8 w-8 place-items-center rounded-full transition ${
                      isBookmarked
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-stone-50 text-stone-400 hover:bg-orange-100 hover:text-orange-600'
                    }`}
                    aria-label={isBookmarked ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                    title={isBookmarked ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                  >
                    <Bookmark
                      className={`h-4 w-4 ${isBookmarked ? 'fill-amber-500 text-amber-500' : ''}`}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* Recipe Name */}
            <h3 className="mt-3 font-soft text-lg font-black leading-snug text-stone-900 transition group-hover:text-orange-600 sm:text-xl">
              {recipe.name}
            </h3>

            {/* Meta Info (Time & Difficulty) */}
            <div className="mt-2 flex items-center gap-3 text-xs text-stone-500">
              {recipe.cookingTimeMinutes && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-stone-400" />
                  <span>{recipe.cookingTimeMinutes}분</span>
                </span>
              )}
              {recipe.difficulty && (
                <span className="flex items-center gap-1">
                  <Flame className="h-3.5 w-3.5 text-orange-500" />
                  <span>{recipe.difficulty}</span>
                </span>
              )}
              {isAdmin && (
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800" title="공개 공식 레시피 (/recipes)">
                  🌐 공개
                </span>
              )}
              {isAdmin && recipe.isCustom && (
                <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">
                  직접등록
                </span>
              )}
            </div>

            {/* Ingredients Preview Tags */}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {previewIngredients.length > 0 ? (
                <>
                  {previewIngredients.map((item, idx) => (
                    <span
                      key={idx}
                      className="inline-flex rounded-full bg-stone-100/80 px-2.5 py-1 text-[11px] font-medium text-stone-600"
                    >
                      {item}
                    </span>
                  ))}
                  {remainingCount > 0 && (
                    <span className="inline-flex rounded-full bg-orange-50 px-2 py-1 text-[11px] font-bold text-orange-600">
                      +{remainingCount}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-xs text-stone-400">재료 정보 없음</span>
              )}
            </div>
          </div>

          {/* Card Bottom Footer */}
          <div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-4 text-xs font-semibold text-stone-400">
            <span>재료 {ingredients.length}개</span>
            <span className="inline-flex items-center gap-1 font-bold text-orange-600 transition group-hover:translate-x-0.5">
              <span>{hasMethod ? '레시피 보기' : '재료 보기'}</span>
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
            </span>
          </div>
        </div>
      </div>
    </article>
  );
};
