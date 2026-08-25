/**
 * @file src/components/WeeklyMealPlanView.tsx
 * @description 📅 주간 식단표 전용 뷰 컴포넌트.
 * 주간 단위 메뉴 계획, 7일(월~일) 달력, 간단모드(하루 1메뉴) vs 상세모드(아침/점심/저녁),
 * 내 레시피 선택 모달, 식단 재료 기반 '이번 주 장보기 일괄 생성', 전체 비우기 및 오프라인 영속화를 지원합니다.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  ShoppingCart,
  RotateCcw,
  Sparkles,
  Search,
  Check,
  X,
  Clock,
  Eye,
  SlidersHorizontal,
  Dice5,
} from 'lucide-react';
import { Recipe, MealPlanEntry, MealSlotType, FilterCategory } from '../types/recipe';
import { CATEGORY_LIST } from '../config/appConfig';
import { getScaledIngredientsList, calculateServingsMultiplier } from '../utils/scaler';
import { logger } from '../utils/logger';

interface WeeklyMealPlanViewProps {
  mealPlan: Record<string, MealPlanEntry[]>;
  allRecipes: Recipe[];
  onSaveMealPlan: (plan: Record<string, MealPlanEntry[]>) => void;
  onOpenRecipeDetail: (recipe: Recipe) => void;
  onOpenTodayMenuModal: () => void;
  onAddShoppingItems: (items: string[]) => void;
  onBackToHome: () => void;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  onOpenConfirm: (config: {
    title: string;
    message: string;
    confirmText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }) => void;
}

type ViewMode = 'single' | 'detail';

/**
 * 특정 날짜를 기준으로 해당 주의 월요일과 일요일 Date 객체를 계산
 */
function getWeekRange(baseDate: Date): { monday: Date; sunday: Date; dates: Date[] } {
  logger.debug('WeeklyMealPlanView.getWeekRange', `주간 계산: ${baseDate.toISOString()}`);
  const current = new Date(baseDate);
  const day = current.getDay(); // 0(일) ~ 6(토)
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(current);
  monday.setDate(current.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }

  const sunday = dates[6];
  return { monday, sunday, dates };
}

/**
 * Date 객체를 'YYYY-MM-DD' 형식 문자열로 변환
 */
function formatDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'];
const MEAL_SLOT_LABELS: Record<MealSlotType, { label: string; icon: string }> = {
  breakfast: { label: '아침', icon: '🌅' },
  lunch: { label: '점심', icon: '☀️' },
  dinner: { label: '저녁', icon: '🌙' },
  single: { label: '오늘의 메뉴', icon: '🍽️' },
};

/**
 * 주간 식단표 전용 뷰 컴포넌트
 */
export const WeeklyMealPlanView: React.FC<WeeklyMealPlanViewProps> = ({
  mealPlan,
  allRecipes,
  onSaveMealPlan,
  onOpenRecipeDetail,
  onOpenTodayMenuModal,
  onAddShoppingItems,
  onBackToHome,
  showToast,
  onOpenConfirm,
}) => {
  const [currentWeekBase, setCurrentWeekBase] = useState<Date>(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('single');

  // 레시피 선택 모달 상태
  const [selectingSlot, setSelectingSlot] = useState<{
    dateStr: string;
    slot: MealSlotType;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('전체');

  // 현재 주의 월~일 날짜 목록
  const { monday, sunday, dates } = useMemo(() => {
    return getWeekRange(currentWeekBase);
  }, [currentWeekBase]);

  // 주간 헤더 표시 문자열 (예: "2026년 8월 24일 ~ 30일")
  const weekLabel = useMemo(() => {
    const y1 = monday.getFullYear();
    const m1 = monday.getMonth() + 1;
    const d1 = monday.getDate();
    const m2 = sunday.getMonth() + 1;
    const d2 = sunday.getDate();

    if (m1 === m2) {
      return `${y1}년 ${m1}월 ${d1}일 ~ ${d2}일`;
    }
    return `${y1}년 ${m1}월 ${d1}일 ~ ${m2}월 ${d2}일`;
  }, [monday, sunday]);

  // 주간 이동 핸들러
  const handlePrevWeek = (): void => {
    logger.info('WeeklyMealPlanView.handlePrevWeek', '이전 주 이동');
    const d = new Date(currentWeekBase);
    d.setDate(d.getDate() - 7);
    setCurrentWeekBase(d);
  };

  const handleNextWeek = (): void => {
    logger.info('WeeklyMealPlanView.handleNextWeek', '다음 주 이동');
    const d = new Date(currentWeekBase);
    d.setDate(d.getDate() + 7);
    setCurrentWeekBase(d);
  };

  const handleTodayWeek = (): void => {
    logger.info('WeeklyMealPlanView.handleTodayWeek', '이번 주 이동');
    setCurrentWeekBase(new Date());
  };

  /**
   * 레시피 선택 후 식단에 추가
   * @param recipe 선택된 레시피
   */
  const handleSelectRecipeForSlot = (recipe: Recipe): void => {
    if (!selectingSlot) return;
    const { dateStr, slot } = selectingSlot;
    logger.info('WeeklyMealPlanView.handleSelectRecipeForSlot', `식단 등록: ${recipe.name} (${dateStr}, ${slot})`);

    const existingEntries = mealPlan[dateStr] || [];
    // 동일 슬롯 기존 항목 덮어쓰기 또는 교체
    const filtered = existingEntries.filter((entry) => entry.slot !== slot);
    const newEntry: MealPlanEntry = {
      id: `meal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date: dateStr,
      slot: slot,
      recipeId: recipe.id,
      servings: recipe.baseServings || 2,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const newPlan = {
      ...mealPlan,
      [dateStr]: [...filtered, newEntry],
    };

    onSaveMealPlan(newPlan);
    showToast(`'${recipe.name}' 요리가 식단에 등록되었습니다.`, 'success');
    setSelectingSlot(null);
  };

  /**
   * 식단 항목 삭제
   * @param dateStr 날짜 문자열
   * @param entryId 식단 항목 ID
   */
  const handleDeleteMealEntry = (dateStr: string, entryId: string): void => {
    logger.info('WeeklyMealPlanView.handleDeleteMealEntry', `식단 항목 삭제: ${dateStr}, ID: ${entryId}`);
    const existing = mealPlan[dateStr] || [];
    const updated = existing.filter((e) => e.id !== entryId);
    const newPlan = { ...mealPlan };
    if (updated.length === 0) {
      delete newPlan[dateStr];
    } else {
      newPlan[dateStr] = updated;
    }
    onSaveMealPlan(newPlan);
    showToast('식단 항목이 삭제되었습니다.', 'info');
  };

  /**
   * 이번 주 식단 전체 비우기
   */
  const handleClearCurrentWeek = (): void => {
    logger.info('WeeklyMealPlanView.handleClearCurrentWeek', '이번 주 식단 비우기 요청');
    onOpenConfirm({
      title: '이번 주 식단 전체 비우기',
      message: '이번 주에 등록된 모든 식단 항목을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
      confirmText: '전체 삭제',
      isDestructive: true,
      onConfirm: () => {
        const newPlan = { ...mealPlan };
        dates.forEach((d) => {
          const k = formatDateKey(d);
          delete newPlan[k];
        });
        onSaveMealPlan(newPlan);
        showToast('이번 주 식단이 모두 삭제되었습니다.', 'info');
      },
    });
  };

  /**
   * 이번 주 식단 재료들을 모아 기존 장보기 목록으로 일괄 전달
   */
  const handleGenerateShoppingList = (): void => {
    logger.info('WeeklyMealPlanView.handleGenerateShoppingList', '이번 주 장보기 생성 시도');
    const weeklyEntries: MealPlanEntry[] = [];
    dates.forEach((d) => {
      const k = formatDateKey(d);
      const dayEntries = mealPlan[k] || [];
      weeklyEntries.push(...dayEntries);
    });

    if (weeklyEntries.length === 0) {
      showToast('이번 주에 등록된 식단 메뉴가 없습니다. 먼저 식단을 추가해주세요.', 'info');
      return;
    }

    const allIngredients: string[] = [];
    weeklyEntries.forEach((entry) => {
      const recipe = allRecipes.find((r) => r.id === entry.recipeId);
      if (recipe && recipe.ingredients) {
        const multiplier = calculateServingsMultiplier(recipe.baseServings || 2, entry.servings || 2);
        const scaledList = getScaledIngredientsList(recipe.ingredients, multiplier);
        allIngredients.push(...scaledList);
      }
    });

    if (allIngredients.length === 0) {
      showToast('추가할 재료가 없습니다.', 'info');
      return;
    }

    onAddShoppingItems(allIngredients);
    showToast(`이번 주 식단의 재료 ${allIngredients.length}개가 장보기 목록에 추가되었습니다!`, 'success');
  };

  // 모달 검색 필터링된 레시피 목록
  const selectableRecipes = useMemo(() => {
    return allRecipes.filter((r) => {
      if (selectedCategory !== '전체' && r.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return r.name.toLowerCase().includes(q) || r.ingredients.toLowerCase().includes(q);
      }
      return true;
    });
  }, [allRecipes, selectedCategory, searchQuery]);

  return (
    <div id="weekly-meal-plan-view" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Top Header Card */}
      <div className="rounded-3xl border border-orange-200/80 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-yellow-500/10 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-md shadow-orange-500/20">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-soft text-2xl font-black text-stone-900 sm:text-3xl">
                  📅 주간 식단표
                </h1>
                <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-black text-orange-800">
                  Weekly Plan
                </span>
              </div>
              <p className="text-xs font-medium text-stone-600 sm:text-sm mt-0.5">
                한 주간의 식사를 미리 계획하고, 필요한 재료를 장보기 목록으로 한 번에 넘겨보세요
              </p>
            </div>
          </div>

          {/* Quick Action Tools */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenTodayMenuModal}
              className="flex items-center gap-1.5 rounded-2xl border border-orange-200 bg-white px-3.5 py-2 font-soft text-xs font-bold text-orange-800 shadow-sm hover:bg-orange-50 active:scale-95 transition-all"
            >
              <Dice5 className="h-4 w-4 text-orange-500" />
              <span>오늘 뭐 먹지? 추천</span>
            </button>

            <button
              type="button"
              onClick={handleGenerateShoppingList}
              className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 font-soft text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:from-emerald-700 hover:to-teal-700 active:scale-95 transition-all"
            >
              <ShoppingCart className="h-4 w-4" />
              <span>🛒 이번 주 장보기 만들기</span>
            </button>

            <button
              type="button"
              onClick={handleClearCurrentWeek}
              className="flex items-center gap-1.5 rounded-2xl border border-stone-200 bg-white px-3 py-2 font-soft text-xs font-bold text-stone-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 active:scale-95 transition-all"
              title="이번 주 식단 전체 비우기"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">비우기</span>
            </button>
          </div>
        </div>

        {/* Date Navigation & View Mode Bar */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-orange-200/50 pt-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevWeek}
              className="rounded-xl border border-stone-200 bg-white p-2 text-stone-600 hover:bg-stone-50 active:scale-95"
              aria-label="이전 주"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="font-soft text-sm sm:text-base font-black text-stone-900 px-2 min-w-[200px] text-center">
              {weekLabel}
            </div>

            <button
              type="button"
              onClick={handleNextWeek}
              className="rounded-xl border border-stone-200 bg-white p-2 text-stone-600 hover:bg-stone-50 active:scale-95"
              aria-label="다음 주"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleTodayWeek}
              className="rounded-xl bg-orange-100 px-3 py-1.5 font-soft text-xs font-bold text-orange-800 hover:bg-orange-200 active:scale-95 ml-1"
            >
              오늘
            </button>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center rounded-2xl bg-white/80 p-1 ring-1 ring-stone-200 shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode('single')}
              className={`rounded-xl px-3 py-1.5 font-soft text-xs font-bold transition-all ${
                viewMode === 'single'
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              하루 1메뉴 (간단)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('detail')}
              className={`rounded-xl px-3 py-1.5 font-soft text-xs font-bold transition-all ${
                viewMode === 'detail'
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              아침/점심/저녁 (상세)
            </button>
          </div>
        </div>
      </div>

      {/* Weekly Grid (7 Days) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-7">
        {dates.map((dateObj, idx) => {
          const dateStr = formatDateKey(dateObj);
          const isToday = formatDateKey(new Date()) === dateStr;
          const isWeekend = idx >= 5;
          const dayEntries = mealPlan[dateStr] || [];

          return (
            <div
              key={dateStr}
              className={`flex flex-col rounded-3xl border transition-all ${
                isToday
                  ? 'border-orange-400 bg-orange-50/40 ring-2 ring-orange-400/20 shadow-md'
                  : 'border-stone-200/80 bg-white/90 shadow-xs hover:border-orange-200'
              } p-4 min-h-[220px]`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`font-soft text-sm font-black ${
                      isWeekend ? 'text-rose-600' : isToday ? 'text-orange-600' : 'text-stone-900'
                    }`}
                  >
                    {DAY_NAMES[idx]}요일
                  </span>
                  <span className="text-xs font-medium text-stone-500">
                    {dateObj.getMonth() + 1}/{dateObj.getDate()}
                  </span>
                </div>
                {isToday && (
                  <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-black text-white">
                    오늘
                  </span>
                )}
              </div>

              {/* Day Body (Entries or Slots) */}
              <div className="flex-1 py-3 space-y-2">
                {viewMode === 'single' ? (
                  /* 하루 1메뉴 모드 */
                  <div>
                    {dayEntries.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => setSelectingSlot({ dateStr, slot: 'single' })}
                        className="group flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 p-4 text-center hover:border-orange-300 hover:bg-orange-50/50 transition-all"
                      >
                        <Plus className="h-5 w-5 text-stone-400 group-hover:text-orange-500 transition-colors" />
                        <span className="mt-1 text-xs font-bold text-stone-400 group-hover:text-orange-600">
                          메뉴 추가
                        </span>
                      </button>
                    ) : (
                      dayEntries.map((entry) => {
                        const recipe = allRecipes.find((r) => r.id === entry.recipeId);
                        if (!recipe) return null;
                        return (
                          <div
                            key={entry.id}
                            className="group relative rounded-2xl border border-orange-200 bg-white p-3 shadow-xs hover:shadow-md transition-all"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div
                                onClick={() => onOpenRecipeDetail(recipe)}
                                className="cursor-pointer flex-1"
                              >
                                <span className="text-xl">{recipe.icon || '🥘'}</span>
                                <h4 className="font-soft text-sm font-bold text-stone-900 hover:text-orange-600 line-clamp-1 mt-0.5">
                                  {recipe.name}
                                </h4>
                                <p className="text-[11px] text-stone-500 line-clamp-1">
                                  {recipe.category}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteMealEntry(dateStr, entry.id)}
                                className="rounded-lg p-1 text-stone-300 hover:bg-rose-50 hover:text-rose-500 transition-all"
                                title="삭제"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <div className="mt-2 flex items-center justify-between border-t border-stone-100 pt-2 text-[10px] text-stone-400">
                              <span>{entry.servings || 2}인분 기준</span>
                              <button
                                type="button"
                                onClick={() => setSelectingSlot({ dateStr, slot: entry.slot })}
                                className="font-bold text-orange-600 hover:underline"
                              >
                                변경
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  /* 아침 / 점심 / 저녁 상세 모드 */
                  <div className="space-y-2">
                    {(['breakfast', 'lunch', 'dinner'] as MealSlotType[]).map((slotKey) => {
                      const entry = dayEntries.find((e) => e.slot === slotKey);
                      const recipe = entry ? allRecipes.find((r) => r.id === entry.recipeId) : null;
                      const slotInfo = MEAL_SLOT_LABELS[slotKey];

                      return (
                        <div
                          key={slotKey}
                          className="rounded-xl border border-stone-100 bg-stone-50/60 p-2 text-xs"
                        >
                          <div className="flex items-center justify-between text-[10px] font-bold text-stone-500 mb-1">
                            <span>
                              {slotInfo.icon} {slotInfo.label}
                            </span>
                            {entry && (
                              <button
                                type="button"
                                onClick={() => handleDeleteMealEntry(dateStr, entry.id)}
                                className="text-stone-300 hover:text-rose-500"
                              >
                                ×
                              </button>
                            )}
                          </div>

                          {recipe ? (
                            <div
                              onClick={() => onOpenRecipeDetail(recipe)}
                              className="cursor-pointer font-bold text-stone-800 hover:text-orange-600 line-clamp-1"
                            >
                              {recipe.icon} {recipe.name}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSelectingSlot({ dateStr, slot: slotKey })}
                              className="flex w-full items-center justify-center gap-1 rounded-lg py-1 font-bold text-stone-400 hover:bg-white hover:text-orange-600 transition-all text-[11px]"
                            >
                              <Plus className="h-3 w-3" />
                              <span>추가</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recipe Selection Modal */}
      {selectingSlot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-stone-900/10">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-100 p-5">
              <div>
                <h3 className="font-soft text-lg font-bold text-stone-900">
                  {selectingSlot.dateStr} ({MEAL_SLOT_LABELS[selectingSlot.slot].label}) 식단 선택
                </h3>
                <p className="text-xs text-stone-500">내 레시피 목록에서 추가할 메뉴를 선택하세요</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectingSlot(null)}
                className="rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Filter & Search */}
            <div className="p-4 border-b border-stone-100 bg-stone-50/50 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="메뉴명 또는 재료 검색..."
                  className="w-full rounded-xl border border-stone-200 bg-white py-2 pl-9 pr-3 text-xs text-stone-800 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 sm:text-sm"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('전체')}
                  className={`rounded-full px-2.5 py-1 text-xs font-bold transition-all ${
                    selectedCategory === '전체'
                      ? 'bg-orange-500 text-white'
                      : 'bg-white border border-stone-200 text-stone-600'
                  }`}
                >
                  전체
                </button>
                {CATEGORY_LIST.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedCategory(c)}
                    className={`rounded-full px-2.5 py-1 text-xs font-bold transition-all ${
                      selectedCategory === c
                        ? 'bg-orange-500 text-white'
                        : 'bg-white border border-stone-200 text-stone-600'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Recipe List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-stone-100">
              {selectableRecipes.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-500">
                  해당 조건에 맞는 레시피가 없습니다.
                </div>
              ) : (
                selectableRecipes.map((recipe) => (
                  <div
                    key={recipe.id}
                    className="flex items-center justify-between pt-2 pb-1 hover:bg-orange-50/50 p-2 rounded-xl transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{recipe.icon || '🍲'}</span>
                      <div>
                        <h4 className="font-soft text-sm font-bold text-stone-900">
                          {recipe.name}
                        </h4>
                        <p className="text-xs text-stone-500">
                          {recipe.category} · {recipe.cookingTimeMinutes ? `${recipe.cookingTimeMinutes}분` : '간편'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectRecipeForSlot(recipe)}
                      className="rounded-xl bg-orange-500 px-3.5 py-1.5 font-soft text-xs font-bold text-white shadow-xs hover:bg-orange-600 active:scale-95"
                    >
                      선택
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
