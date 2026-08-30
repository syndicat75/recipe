/**
 * @file src/components/NutritionFilterBar.tsx
 * @description 레시피 영양 필터(최대 칼로리, 최소 단백질, 최대 나트륨, 최소 식이섬유, 채소 많은 메뉴)
 * 퀵 칩 및 상세 슬라이더/인풋 컨트롤 컴포넌트.
 */

import React, { useState } from 'react';
import { SlidersHorizontal, X, RotateCcw, Flame, Sparkles, Check } from 'lucide-react';
import { NutritionFilterState } from '../types/recipe';
import { hasActiveNutritionFilter } from '../utils/nutritionCalculator';
import { logger } from '../utils/logger';

interface NutritionFilterBarProps {
  /** 현재 영양 필터 상태 */
  filter: NutritionFilterState;
  /** 영양 필터 변경 핸들러 */
  onFilterChange: (next: NutritionFilterState) => void;
  /** 영양 필터 초기화 핸들러 */
  onResetFilter: () => void;
  /** 필터링된 레시피 개수 */
  filteredCount?: number;
}

/**
 * 레시피 영양성분 전용 필터 바 컴포넌트
 */
export const NutritionFilterBar: React.FC<NutritionFilterBarProps> = ({
  filter,
  onFilterChange,
  onResetFilter,
  filteredCount,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const isActive = hasActiveNutritionFilter(filter);

  // 활성화된 필터 개수 계산
  const activeCount = [
    typeof filter.maxCalories === 'number' && filter.maxCalories > 0,
    typeof filter.minProtein === 'number' && filter.minProtein > 0,
    typeof filter.maxSodium === 'number' && filter.maxSodium > 0,
    typeof filter.minFiber === 'number' && filter.minFiber > 0,
    filter.vegetableRichOnly,
  ].filter(Boolean).length;

  /**
   * 퀵 프리셋 토글 핸들러
   */
  const handleToggleVegetable = (): void => {
    logger.info('NutritionFilterBar.handleToggleVegetable', `채소 필터 토글: ${!filter.vegetableRichOnly}`);
    onFilterChange({
      ...filter,
      vegetableRichOnly: !filter.vegetableRichOnly,
    });
  };

  const handleToggleMaxCalories500 = (): void => {
    const nextVal = filter.maxCalories === 500 ? undefined : 500;
    logger.info('NutritionFilterBar.handleToggleMaxCalories500', `최대 500kcal 토글: ${nextVal}`);
    onFilterChange({
      ...filter,
      maxCalories: nextVal,
    });
  };

  const handleToggleHighProtein25 = (): void => {
    const nextVal = filter.minProtein === 25 ? undefined : 25;
    logger.info('NutritionFilterBar.handleToggleHighProtein25', `고단백 25g 토글: ${nextVal}`);
    onFilterChange({
      ...filter,
      minProtein: nextVal,
    });
  };

  const handleToggleLowSodium800 = (): void => {
    const nextVal = filter.maxSodium === 800 ? undefined : 800;
    logger.info('NutritionFilterBar.handleToggleLowSodium800', `저나트륨 800mg 토글: ${nextVal}`);
    onFilterChange({
      ...filter,
      maxSodium: nextVal,
    });
  };

  const handleToggleHighFiber5 = (): void => {
    const nextVal = filter.minFiber === 5 ? undefined : 5;
    logger.info('NutritionFilterBar.handleToggleHighFiber5', `고식이섬유 5g 토글: ${nextVal}`);
    onFilterChange({
      ...filter,
      minFiber: nextVal,
    });
  };

  return (
    <div id="nutrition-filter-bar" className="w-full space-y-2.5">
      {/* Quick Chips & Open Detail Button */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-bold text-amber-900 flex items-center gap-1 mr-1 text-[11px]">
            <Flame className="h-3.5 w-3.5 text-orange-500" />
            <span>영양 필터:</span>
          </span>

          {/* 1. 채소 많은 메뉴 */}
          <button
            type="button"
            onClick={handleToggleVegetable}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition ${
              filter.vegetableRichOnly
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-stone-700 border border-stone-200/80 hover:bg-emerald-50 hover:text-emerald-800'
            }`}
          >
            <span>🥦 채소 많은 메뉴</span>
            {filter.vegetableRichOnly && <Check className="h-3 w-3" />}
          </button>

          {/* 2. 500kcal 이하 */}
          <button
            type="button"
            onClick={handleToggleMaxCalories500}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition ${
              filter.maxCalories === 500
                ? 'bg-orange-500 text-white shadow-xs'
                : 'bg-white text-stone-700 border border-stone-200/80 hover:bg-orange-50 hover:text-orange-800'
            }`}
          >
            <span>🔥 500kcal 이하</span>
            {filter.maxCalories === 500 && <Check className="h-3 w-3" />}
          </button>

          {/* 3. 단백질 25g 이상 */}
          <button
            type="button"
            onClick={handleToggleHighProtein25}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition ${
              filter.minProtein === 25
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-stone-700 border border-stone-200/80 hover:bg-amber-50 hover:text-amber-800'
            }`}
          >
            <span>🥩 고단백(25g+)</span>
            {filter.minProtein === 25 && <Check className="h-3 w-3" />}
          </button>

          {/* 4. 저나트륨 800mg 이하 */}
          <button
            type="button"
            onClick={handleToggleLowSodium800}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition ${
              filter.maxSodium === 800
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-stone-700 border border-stone-200/80 hover:bg-blue-50 hover:text-blue-800'
            }`}
          >
            <span>🧂 저나트륨(800mg↓)</span>
            {filter.maxSodium === 800 && <Check className="h-3 w-3" />}
          </button>

          {/* 5. 식이섬유 5g 이상 */}
          <button
            type="button"
            onClick={handleToggleHighFiber5}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition ${
              filter.minFiber === 5
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-white text-stone-700 border border-stone-200/80 hover:bg-teal-50 hover:text-teal-800'
            }`}
          >
            <span>🌿 식이섬유(5g+)</span>
            {filter.minFiber === 5 && <Check className="h-3 w-3" />}
          </button>
        </div>

        {/* Detailed Filter Toggle & Reset */}
        <div className="flex items-center gap-2">
          {isActive && (
            <button
              type="button"
              onClick={onResetFilter}
              className="flex items-center gap-1 rounded-xl bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-stone-600 hover:bg-stone-200 transition"
              title="영양 필터 초기화"
            >
              <RotateCcw className="h-3 w-3" />
              <span>초기화</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-bold transition ${
              isOpen || isActive
                ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-300'
                : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-amber-700" />
            <span>상세 필터</span>
            {activeCount > 0 && (
              <span className="rounded-full bg-amber-600 px-1.5 py-0.2 text-[10px] font-black text-white">
                {activeCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Expandable Custom Nutrition Filter Drawer */}
      {isOpen && (
        <div className="rounded-3xl border border-amber-200/90 bg-white p-4 shadow-sm animate-scale-up space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2">
            <div className="flex items-center gap-2">
              <span className="font-soft text-xs font-black text-stone-900">
                1인분 영양 조건 상세 설정
              </span>
              <span className="text-[11px] text-stone-400">
                (원하는 영양 기준을 자유롭게 설정하세요)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-stone-400 hover:bg-stone-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {/* 1. 최대 칼로리 */}
            <div className="rounded-2xl bg-amber-50/50 p-3 border border-amber-100">
              <label className="block text-[11px] font-bold text-amber-950 mb-1.5">
                🔥 최대 열량 (kcal 이하)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="예: 600"
                  value={filter.maxCalories || ''}
                  onChange={(e) =>
                    onFilterChange({
                      ...filter,
                      maxCalories: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-full rounded-xl border border-amber-200 bg-white p-2 text-xs font-bold text-stone-800 outline-none focus:ring-1 focus:ring-amber-500"
                />
                <span className="text-[11px] text-stone-500 shrink-0">kcal</span>
              </div>
            </div>

            {/* 2. 최소 단백질 */}
            <div className="rounded-2xl bg-amber-50/50 p-3 border border-amber-100">
              <label className="block text-[11px] font-bold text-amber-950 mb-1.5">
                🥩 최소 단백질 (g 이상)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="예: 20"
                  value={filter.minProtein || ''}
                  onChange={(e) =>
                    onFilterChange({
                      ...filter,
                      minProtein: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-full rounded-xl border border-amber-200 bg-white p-2 text-xs font-bold text-stone-800 outline-none focus:ring-1 focus:ring-amber-500"
                />
                <span className="text-[11px] text-stone-500 shrink-0">g</span>
              </div>
            </div>

            {/* 3. 최대 나트륨 */}
            <div className="rounded-2xl bg-amber-50/50 p-3 border border-amber-100">
              <label className="block text-[11px] font-bold text-amber-950 mb-1.5">
                🧂 최대 나트륨 (mg 이하)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="예: 1000"
                  value={filter.maxSodium || ''}
                  onChange={(e) =>
                    onFilterChange({
                      ...filter,
                      maxSodium: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-full rounded-xl border border-amber-200 bg-white p-2 text-xs font-bold text-stone-800 outline-none focus:ring-1 focus:ring-amber-500"
                />
                <span className="text-[11px] text-stone-500 shrink-0">mg</span>
              </div>
            </div>

            {/* 4. 최소 식이섬유 */}
            <div className="rounded-2xl bg-amber-50/50 p-3 border border-amber-100">
              <label className="block text-[11px] font-bold text-amber-950 mb-1.5">
                🌿 최소 식이섬유 (g 이상)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="예: 5"
                  value={filter.minFiber || ''}
                  onChange={(e) =>
                    onFilterChange({
                      ...filter,
                      minFiber: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-full rounded-xl border border-amber-200 bg-white p-2 text-xs font-bold text-stone-800 outline-none focus:ring-1 focus:ring-amber-500"
                />
                <span className="text-[11px] text-stone-500 shrink-0">g</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!filter.vegetableRichOnly}
                onChange={(e) =>
                  onFilterChange({
                    ...filter,
                    vegetableRichOnly: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="font-bold text-stone-800">🥦 채소 많은 메뉴만 보기</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onResetFilter}
                className="rounded-xl bg-stone-100 px-3 py-1.5 font-bold text-stone-600 hover:bg-stone-200"
              >
                필터 초기화
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl bg-stone-800 px-4 py-1.5 font-bold text-white hover:bg-stone-900"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
