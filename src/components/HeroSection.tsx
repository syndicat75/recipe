/**
 * @file src/components/HeroSection.tsx
 * @description 웹앱 메인 히어로 섹션, 레시피 통계 요약 카드 및 빠른 카테고리 선택 칩 제공
 */

import React from 'react';
import { Sparkles, ArrowDown, BookOpen, Layers, Heart, ChefHat } from 'lucide-react';
import { FilterCategory } from '../types/recipe';
import { logger } from '../utils/logger';

interface HeroSectionProps {
  /** 총 레시피 개수 */
  totalRecipeCount: number;
  /** 카테고리 수 */
  categoryCount: number;
  /** 즐겨찾기 수 */
  bookmarkCount: number;
  /** 빠른 카테고리 선택 핸들러 */
  onSelectCategory: (category: FilterCategory) => void;
  /** 레시피 목록으로 스크롤 이동 핸들러 */
  onScrollToRecipes: () => void;
}

/**
 * 메인 히어로 소개 섹션 컴포넌트
 */
export const HeroSection: React.FC<HeroSectionProps> = ({
  totalRecipeCount,
  categoryCount,
  bookmarkCount,
  onSelectCategory,
  onScrollToRecipes,
}) => {
  /**
   * 빠른 카테고리 칩 클릭 이벤트 핸들러
   * @param cat 대상 카테고리명
   */
  const handleQuickChipClick = (cat: FilterCategory): void => {
    logger.info('HeroSection.handleQuickChipClick', `퀵 칩 선택: ${cat}`);
    onSelectCategory(cat);
    onScrollToRecipes();
  };

  return (
    <section id="home" className="relative overflow-hidden">
      {/* Background Decorative Radial Gradients */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(251,146,60,0.18),transparent_35%),radial-gradient(circle_at_85%_30%,rgba(250,204,21,0.16),transparent_30%)]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-20">
        {/* Left Intro Text */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/90 px-3.5 py-1.5 text-xs font-extrabold text-orange-700 shadow-sm backdrop-blur">
            <span>📒</span> 엑셀 속 알짜 레시피를 한곳에
          </span>

          <h1 className="mt-5 font-soft text-4xl font-extrabold leading-[1.2] tracking-tight text-stone-900 sm:text-5xl lg:text-6xl">
            자주 해먹는 맛만 모은 <br />
            <span className="text-orange-600">나만의 레시피 북</span>
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-8 text-stone-600 sm:text-lg">
            국·찌개부터 황금비율 양념장, 중식·양식, 간편 계란요리까지! 필요한 메뉴를 검색하고
            원하는 인분 수에 맞춰 계량 조절 및 조리 타이머를 사용해 보세요.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onScrollToRecipes}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-orange-500/25 transition hover:-translate-y-0.5 hover:from-orange-600 hover:to-amber-600"
            >
              <span>레시피 보러가기</span>
              <ArrowDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handleQuickChipClick('계란요리')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-white px-5 py-3.5 text-sm font-bold text-stone-700 shadow-sm transition hover:bg-orange-50"
            >
              <span>🍳 간편 계란요리</span>
            </button>
          </div>
        </div>

        {/* Right Interactive Stats Card */}
        <div className="relative mx-auto w-full max-w-xl">
          <div className="absolute -inset-3 rounded-[2.5rem] bg-gradient-to-br from-orange-200/60 via-amber-100/60 to-rose-100/50 blur-2xl" />
          <div className="relative rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-xl shadow-orange-950/5 backdrop-blur sm:p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-orange-500">
                  Recipe Collection
                </p>
                <h2 className="mt-1 font-soft text-2xl font-black text-stone-900">
                  오늘 뭐 해먹지?
                </h2>
              </div>
              <span className="text-4xl">🍲</span>
            </div>

            {/* Stat Counters */}
            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-orange-50 p-4 text-center">
                <strong className="block text-2xl font-black text-orange-600">
                  {totalRecipeCount}
                </strong>
                <span className="text-xs font-bold text-stone-500">전체 레시피</span>
              </div>
              <div className="rounded-2xl bg-amber-50 p-4 text-center">
                <strong className="block text-2xl font-black text-amber-600">
                  {categoryCount}
                </strong>
                <span className="text-xs font-bold text-stone-500">카테고리</span>
              </div>
              <div className="rounded-2xl bg-rose-50 p-4 text-center">
                <strong className="block text-2xl font-black text-rose-600">
                  {bookmarkCount}
                </strong>
                <span className="text-xs font-bold text-stone-500">즐겨찾기</span>
              </div>
            </div>

            {/* Quick Pick Chips */}
            <div className="mt-5 rounded-2xl border border-orange-100 bg-[#fffaf3] p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold tracking-wider text-stone-400">QUICK PICK</p>
                <span className="text-[11px] font-semibold text-orange-600">클릭 시 바로 이동</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickChipClick('국·찌개')}
                  className="rounded-full bg-white px-3.5 py-2 text-xs font-bold text-stone-700 shadow-sm ring-1 ring-orange-200 transition hover:bg-orange-500 hover:text-white"
                >
                  🥘 국·찌개
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickChipClick('소스·양념')}
                  className="rounded-full bg-white px-3.5 py-2 text-xs font-bold text-stone-700 shadow-sm ring-1 ring-orange-200 transition hover:bg-orange-500 hover:text-white"
                >
                  🥣 소스·양념
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickChipClick('중식·양식')}
                  className="rounded-full bg-white px-3.5 py-2 text-xs font-bold text-stone-700 shadow-sm ring-1 ring-orange-200 transition hover:bg-orange-500 hover:text-white"
                >
                  🍽️ 중식·양식
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickChipClick('계란요리')}
                  className="rounded-full bg-white px-3.5 py-2 text-xs font-bold text-stone-700 shadow-sm ring-1 ring-orange-200 transition hover:bg-orange-500 hover:text-white"
                >
                  🍳 계란요리
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickChipClick('밥·한그릇')}
                  className="rounded-full bg-white px-3.5 py-2 text-xs font-bold text-stone-700 shadow-sm ring-1 ring-orange-200 transition hover:bg-orange-500 hover:text-white"
                >
                  🍛 밥·한그릇
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
