/**
 * @file src/components/header/DesktopNavigation.tsx
 * @description 데스크톱 화면의 중앙 주요 메뉴 네비게이션 바 컴포넌트.
 * [홈, 오늘 뭐 먹지?, 주간 식단, AI 요리사, 즐겨찾기, 가족 공간]을 간결한 텍스트 버튼으로 렌더링합니다.
 */

import React from 'react';
import {
  Dice5,
  Calendar,
  Sparkles,
  Bookmark,
  Users,
} from 'lucide-react';
import { FilterCategory } from '../../types/recipe';
import { AppViewMode } from '../../types/navigation';
import { logger } from '../../utils/logger';

export interface DesktopNavigationProps {
  /** 현재 선택된 카테고리 필터 */
  currentCategory: FilterCategory;
  /** 카테고리 선택 핸들러 */
  onSelectCategory: (category: FilterCategory) => void;
  /** 현재 활성 뷰 */
  currentView: AppViewMode;
  /** 뷰 전환 핸들러 */
  onNavigateView?: (view: AppViewMode) => void;
  /** 즐겨찾기 레시피 개수 */
  bookmarkCount: number;
  /** 오늘 뭐 먹지 모달 열기 */
  onOpenTodayMenu: () => void;
  /** 가족 공유 모달 열기 */
  onOpenFamilyShare: () => void;
  /** 현재 가족 공간 이름 */
  currentFamilyName: string | null;
  /** 특정 섹션으로 스크롤 */
  scrollToSection: (id: string) => void;
}

/**
 * 데스크톱 중앙 핵심 네비게이션 메뉴 컴포넌트
 */
export const DesktopNavigation: React.FC<DesktopNavigationProps> = ({
  currentCategory,
  onSelectCategory,
  currentView,
  onNavigateView,
  bookmarkCount,
  onOpenTodayMenu,
  onOpenFamilyShare,
  currentFamilyName,
  scrollToSection,
}) => {
  return (
    <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1 select-none" aria-label="주요 메뉴">
      {/* 1. 홈 */}
      <button
        type="button"
        onClick={() => {
          logger.info('DesktopNavigation', '홈 메뉴 클릭');
          if (onNavigateView) onNavigateView('home');
          scrollToSection('home');
        }}
        className={`h-9 px-2.5 xl:px-3 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 ${
          currentView === 'home' && currentCategory === '전체'
            ? 'bg-orange-100/90 text-orange-950 font-bold'
            : 'text-stone-600 hover:bg-orange-50/80 hover:text-orange-900'
        }`}
      >
        <span>홈</span>
      </button>

      {/* 2. 🎲 오늘 뭐 먹지? */}
      <button
        type="button"
        onClick={() => {
          logger.info('DesktopNavigation', '오늘 뭐 먹지 클릭');
          onOpenTodayMenu();
        }}
        className="h-9 px-2.5 xl:px-3 rounded-xl text-xs font-semibold text-orange-800 bg-orange-50/60 hover:bg-orange-100/80 hover:text-orange-950 transition-colors flex items-center gap-1.5"
        title="랜덤 룰렛 및 맞춤 AI 요리 추천"
      >
        <Dice5 className="h-3.5 w-3.5 text-orange-500 shrink-0" />
        <span>오늘 뭐 먹지?</span>
      </button>

      {/* 3. 📅 주간 식단 */}
      <button
        type="button"
        onClick={() => {
          logger.info('DesktopNavigation', '주간 식단 메뉴 클릭');
          if (onNavigateView) onNavigateView('meal-plan');
        }}
        className={`h-9 px-2.5 xl:px-3 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
          currentView === 'meal-plan'
            ? 'bg-orange-100/90 text-orange-950 font-bold'
            : 'text-stone-600 hover:bg-orange-50/80 hover:text-orange-900'
        }`}
        title="주간 식단표 계획 및 장보기 추출"
      >
        <Calendar className="h-3.5 w-3.5 text-stone-500 shrink-0" />
        <span>주간 식단</span>
      </button>

      {/* 4. ✨ AI 요리사 */}
      <button
        type="button"
        onClick={() => {
          logger.info('DesktopNavigation', 'AI 요리사 메뉴 클릭');
          if (onNavigateView) onNavigateView('ai-chef');
        }}
        className={`h-9 px-2.5 xl:px-3 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
          currentView === 'ai-chef'
            ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold shadow-2xs'
            : 'text-orange-800 bg-orange-50/70 hover:bg-orange-100/80 hover:text-orange-950'
        }`}
        title="스마트 레시피 Q&A 및 요리 비법 AI 상담"
      >
        <Sparkles
          className={`h-3.5 w-3.5 shrink-0 ${
            currentView === 'ai-chef' ? 'text-amber-200' : 'text-orange-500'
          }`}
        />
        <span>AI 요리사</span>
      </button>

      {/* 5. 즐겨찾기 */}
      <button
        type="button"
        onClick={() => {
          logger.info('DesktopNavigation', '즐겨찾기 메뉴 클릭');
          if (onNavigateView) onNavigateView('home');
          onSelectCategory('즐겨찾기');
          scrollToSection('recipes');
        }}
        className={`h-9 px-2.5 xl:px-3 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
          currentView === 'home' && currentCategory === '즐겨찾기'
            ? 'bg-amber-100 text-amber-950 font-bold'
            : 'text-stone-600 hover:bg-orange-50/80 hover:text-orange-900'
        }`}
      >
        <Bookmark className="h-3.5 w-3.5 text-amber-500 fill-amber-500/30 shrink-0" />
        <span>즐겨찾기</span>
        {bookmarkCount > 0 && (
          <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-black text-white">
            {bookmarkCount}
          </span>
        )}
      </button>

      {/* 6. 👨‍👩‍👧 가족 공간 */}
      <button
        type="button"
        onClick={() => {
          logger.info('DesktopNavigation', '가족 공간 클릭');
          onOpenFamilyShare();
        }}
        className={`h-9 px-2.5 xl:px-3 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
          currentFamilyName
            ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            : 'text-stone-600 hover:bg-orange-50/80 hover:text-orange-900'
        }`}
        title="실시간 가족 레시피 및 장보기 공유 공간"
      >
        <Users className="h-3.5 w-3.5 text-rose-500 shrink-0" />
        <span className="max-w-[80px] xl:max-w-[100px] truncate">
          {currentFamilyName || '가족 공간'}
        </span>
      </button>
    </nav>
  );
};

