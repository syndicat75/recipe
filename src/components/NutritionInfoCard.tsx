/**
 * @file src/components/NutritionInfoCard.tsx
 * @description 레시피 상세 화면에 표시되는 1인분 예상 영양정보(열량, 단백질, 탄수화물, 지방, 나트륨, 식이섬유)
 * 및 인분별 총 열량 계산 카드 컴포넌트.
 */

import React from 'react';
import { Flame, Sparkles } from 'lucide-react';
import { Recipe } from '../types/recipe';
import { formatNutrient, getVegetableLevelLabel } from '../utils/nutritionCalculator';
import { logger } from '../utils/logger';

interface NutritionInfoCardProps {
  /** 레시피 데이터 */
  recipe: Recipe;
  /** 현재 사용자가 선택한 인분 수 (선택, 기본값은 recipe.baseServings 또는 1) */
  currentServings?: number;
  /** 관리자 여부 (재분석 또는 수정 유도용) */
  isAdmin?: boolean;
}

/**
 * 1인분 예상 영양정보 카드 컴포넌트
 */
export const NutritionInfoCard: React.FC<NutritionInfoCardProps> = ({
  recipe,
  currentServings = 1,
  isAdmin = false,
}) => {
  const nutrition = recipe.nutrition;
  const caloriesPerServing = recipe.caloriesPerServing || nutrition?.calories;

  // 영양정보 및 칼로리가 전혀 없는 경우 미표시
  if (!caloriesPerServing && !nutrition) {
    return null;
  }

  logger.debug('NutritionInfoCard.render', `영양정보 카드 렌더링: ${recipe.name} (${caloriesPerServing} kcal)`);

  const totalCurrentCalories = Math.round((caloriesPerServing || 0) * currentServings);

  return (
    <div
      id={`nutrition-card-${recipe.id}`}
      className="rounded-3xl border border-amber-200/90 bg-gradient-to-b from-amber-50/90 via-orange-50/60 to-amber-50/80 p-5 shadow-xs transition-all"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-amber-200/70 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white shadow-xs">
            <Flame className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-soft text-base font-black text-amber-950">
                1인분 예상 영양정보
              </h3>
              <span className="rounded-lg bg-amber-200/80 px-2 py-0.5 text-[11px] font-black text-amber-900">
                1인분 기준
              </span>
            </div>
            {currentServings > 1 && (
              <p className="text-[11px] font-medium text-amber-800/90 mt-0.5">
                현재 선택된 <span className="font-bold text-amber-950">{currentServings}인분</span> 기준 총 열량: 약 <span className="font-black text-orange-700">{totalCurrentCalories.toLocaleString('ko-KR')} kcal</span>
              </p>
            )}
          </div>
        </div>

        {nutrition?.vegetableLevel && (
          <div className="self-start sm:self-center">
            <span className="inline-flex items-center rounded-xl bg-emerald-100/90 px-2.5 py-1 text-xs font-black text-emerald-800 border border-emerald-200/60 shadow-2xs">
              {getVegetableLevelLabel(nutrition.vegetableLevel)}
            </span>
          </div>
        )}
      </div>

      {/* Detailed Nutrients Grid */}
      {nutrition ? (
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {/* 1. 열량 */}
          <div className="flex items-center justify-between rounded-2xl bg-white/90 p-3 shadow-2xs border border-amber-100/80">
            <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700">
              <span className="text-base">🔥</span>
              <span>열량</span>
            </div>
            <span className="font-soft text-sm font-black text-amber-700">
              {formatNutrient(nutrition.calories || caloriesPerServing, 'kcal')}
            </span>
          </div>

          {/* 2. 단백질 */}
          <div className="flex items-center justify-between rounded-2xl bg-white/90 p-3 shadow-2xs border border-amber-100/80">
            <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700">
              <span className="text-base">🥩</span>
              <span>단백질</span>
            </div>
            <span className="font-soft text-sm font-black text-stone-900">
              {formatNutrient(nutrition.protein, 'g')}
            </span>
          </div>

          {/* 3. 탄수화물 */}
          <div className="flex items-center justify-between rounded-2xl bg-white/90 p-3 shadow-2xs border border-amber-100/80">
            <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700">
              <span className="text-base">🍚</span>
              <span>탄수화물</span>
            </div>
            <span className="font-soft text-sm font-black text-stone-900">
              {formatNutrient(nutrition.carbs, 'g')}
            </span>
          </div>

          {/* 4. 지방 */}
          <div className="flex items-center justify-between rounded-2xl bg-white/90 p-3 shadow-2xs border border-amber-100/80">
            <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700">
              <span className="text-base">🥑</span>
              <span>지방</span>
            </div>
            <span className="font-soft text-sm font-black text-stone-900">
              {formatNutrient(nutrition.fat, 'g')}
            </span>
          </div>

          {/* 5. 나트륨 */}
          <div className="flex items-center justify-between rounded-2xl bg-white/90 p-3 shadow-2xs border border-amber-100/80">
            <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700">
              <span className="text-base">🧂</span>
              <span>나트륨</span>
            </div>
            <span className="font-soft text-sm font-black text-stone-900">
              {formatNutrient(nutrition.sodium, 'mg')}
            </span>
          </div>

          {/* 6. 식이섬유 */}
          <div className="flex items-center justify-between rounded-2xl bg-white/90 p-3 shadow-2xs border border-amber-100/80">
            <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700">
              <span className="text-base">🌿</span>
              <span>식이섬유</span>
            </div>
            <span className="font-soft text-sm font-black text-emerald-700">
              {formatNutrient(nutrition.fiber, 'g')}
            </span>
          </div>
        </div>
      ) : (
        /* Legacy Calorie Only Display */
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/90 p-3.5 shadow-2xs border border-amber-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔥</span>
            <div>
              <span className="text-xs font-bold text-stone-600 block">1인분 예상 열량</span>
              <span className="font-soft text-lg font-black text-amber-700">
                {caloriesPerServing} kcal
              </span>
            </div>
          </div>
          {recipe.calorieBreakdown && (
            <span className="text-xs text-stone-500 max-w-xs text-right">
              {recipe.calorieBreakdown}
            </span>
          )}
        </div>
      )}

      {/* Calorie Breakdown or AI Note */}
      {recipe.calorieBreakdown && nutrition && (
        <div className="mt-3 text-xs text-stone-600 font-medium px-1">
          <span className="font-bold text-amber-900">💡 주요 열량 요인:</span> {recipe.calorieBreakdown}
        </div>
      )}

      {/* Mandatory Disclaimer */}
      <div className="mt-3.5 pt-2.5 border-t border-amber-200/60 flex items-center justify-between gap-2 text-[11px] text-amber-800/80">
        <p className="flex items-center gap-1 leading-normal">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span>AI 기반 예상치이며 실제 영양성분과 차이가 있을 수 있습니다.</span>
        </p>
      </div>
    </div>
  );
};
