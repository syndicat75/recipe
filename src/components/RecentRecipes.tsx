/**
 * @file src/components/RecentRecipes.tsx
 * @description 최근 열람한 레시피 목록(최대 5개)을 가로 스크롤 캐러셀 형태로 보여주는 퀵 액세스 컴포넌트
 */

import React from 'react';
import { History, Clock, ArrowRight } from 'lucide-react';
import { Recipe } from '../types/recipe';
import { CATEGORY_CONFIG } from '../config/appConfig';
import { logger } from '../utils/logger';

interface RecentRecipesProps {
  /** 전체 레시피 목록 */
  allRecipes: Recipe[];
  /** 최근 본 레시피 ID 목록 (최신순) */
  recentIds: number[];
  /** 레시피 상세 열기 핸들러 */
  onOpenDetail: (recipe: Recipe) => void;
}

/**
 * 최근 본 레시피 가로 목록 컴포넌트
 */
export const RecentRecipes: React.FC<RecentRecipesProps> = ({
  allRecipes,
  recentIds,
  onOpenDetail,
}) => {
  // 최근 본 레시피 매핑
  const recipeMap = new Map<number, Recipe>();
  allRecipes.forEach((r) => recipeMap.set(r.id, r));

  const recentRecipes = recentIds
    .map((id) => recipeMap.get(id))
    .filter((r): r is Recipe => r !== undefined);

  if (recentRecipes.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-orange-100/90 bg-white/70 p-4 shadow-sm backdrop-blur-sm sm:p-5">
        <div className="flex items-center justify-between pb-3 border-b border-orange-50">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-xl bg-orange-100 text-orange-600">
              <History className="h-4 w-4" />
            </span>
            <h3 className="font-soft text-sm font-black text-stone-800 sm:text-base">
              최근 확인한 레시피
            </h3>
          </div>
          <span className="text-[11px] font-bold text-stone-400">
            {recentRecipes.length}개 기록
          </span>
        </div>

        {/* Horizontal Scroll List */}
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1 pt-1 no-scrollbar">
          {recentRecipes.map((recipe) => {
            const catMeta = CATEGORY_CONFIG[recipe.category] || CATEGORY_CONFIG['기타'];
            return (
              <button
                key={recipe.id}
                type="button"
                onClick={() => {
                  logger.info('RecentRecipes', `최근 본 레시피 클릭: ${recipe.name}`);
                  onOpenDetail(recipe);
                }}
                className="group flex min-w-[200px] max-w-[240px] shrink-0 items-center gap-3 rounded-2xl border border-orange-100/80 bg-white p-3 text-left shadow-xs transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md"
              >
                {/* Visual Icon / Photo */}
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-orange-50 text-xl grid place-items-center">
                  {recipe.imageUrl ? (
                    <img
                      src={recipe.imageUrl}
                      alt={recipe.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    recipe.icon || catMeta.icon
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <span className={`inline-block rounded-md px-1.5 py-0.2 text-[10px] font-bold ${catMeta.badgeClass}`}>
                    {recipe.category}
                  </span>
                  <h4 className="mt-0.5 truncate font-soft text-xs font-bold text-stone-900 group-hover:text-orange-600">
                    {recipe.name}
                  </h4>
                  {recipe.cookingTimeMinutes && (
                    <span className="mt-0.5 flex items-center gap-1 text-[10px] text-stone-400">
                      <Clock className="h-3 w-3" />
                      <span>{recipe.cookingTimeMinutes}분</span>
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
