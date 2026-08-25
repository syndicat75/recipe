/**
 * @file src/components/Header.tsx
 * @description 웹앱 상단 네비게이션 바, 브랜드 로고, 즐겨찾기/장보기/레시피 추가/타이머 빠른 실행 및 모바일 반응형 메뉴
 */

import React, { useState } from 'react';
import { Bookmark, ShoppingCart, PlusCircle, Timer, Menu, X, ChefHat } from 'lucide-react';
import { APP_CONFIG } from '../config/appConfig';
import { FilterCategory } from '../types/recipe';
import { logger } from '../utils/logger';

interface HeaderProps {
  /** 현재 선택된 카테고리 필터 */
  currentCategory: FilterCategory;
  /** 카테고리 선택 핸들러 */
  onSelectCategory: (category: FilterCategory) => void;
  /** 즐겨찾기 레시피 개수 */
  bookmarkCount: number;
  /** 장보기 목록 아이템 개수 */
  shoppingCount: number;
  /** 장보기 모달 열기 핸들러 */
  onOpenShoppingList: () => void;
  /** 레시피 추가 모달 열기 핸들러 */
  onOpenAddRecipe: () => void;
  /** 타이머 위젯 토글 핸들러 */
  onToggleTimer: () => void;
  /** 타이머 활성화 여부 */
  isTimerOpen: boolean;
}

/**
 * 상단 네비게이션 헤더 컴포넌트
 */
export const Header: React.FC<HeaderProps> = ({
  currentCategory,
  onSelectCategory,
  bookmarkCount,
  shoppingCount,
  onOpenShoppingList,
  onOpenAddRecipe,
  onToggleTimer,
  isTimerOpen,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  /**
   * 모바일 메뉴 토글 이벤트 핸들러
   */
  const handleToggleMobileMenu = (): void => {
    logger.info('Header.handleToggleMobileMenu', `모바일 메뉴 토글: ${!isMobileMenuOpen}`);
    setIsMobileMenuOpen((prev) => !prev);
  };

  /**
   * 네비게이션 링크 클릭 이벤트 핸들러
   * @param targetCategory 선택한 카테고리
   */
  const handleNavClick = (targetCategory: FilterCategory): void => {
    logger.info('Header.handleNavClick', `네비게이션 클릭: ${targetCategory}`);
    onSelectCategory(targetCategory);
    setIsMobileMenuOpen(false);
  };

  /**
   * 특정 섹션으로 스크롤 이동
   * @param id 타겟 요소 ID
   */
  const scrollToSection = (id: string): void => {
    logger.info('Header.scrollToSection', `스크롤 이동: #${id}`);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-orange-100/80 bg-[#fffaf3]/95 backdrop-blur-xl transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <a
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            scrollToSection('home');
          }}
          className="group flex items-center gap-2.5 transition"
          aria-label="내 입맛 레시피 홈으로 이동"
        >
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-xl text-white shadow-sm transition group-hover:-rotate-6 group-hover:scale-105">
            🍳
          </span>
          <div>
            <div className="font-soft text-[16px] font-black tracking-tight text-stone-900 sm:text-lg">
              {APP_CONFIG.appName}
            </div>
            <div className="hidden text-[9px] font-extrabold tracking-[0.2em] text-orange-600 sm:block">
              {APP_CONFIG.appSubTitle}
            </div>
          </div>
        </a>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1.5 md:flex" aria-label="상단 메뉴">
          <button
            type="button"
            onClick={() => scrollToSection('home')}
            className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-stone-600 transition hover:bg-orange-100 hover:text-orange-800"
          >
            홈
          </button>
          <button
            type="button"
            onClick={() => {
              onSelectCategory('전체');
              scrollToSection('recipes');
            }}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
              currentCategory === '전체'
                ? 'bg-orange-100 font-bold text-orange-800'
                : 'text-stone-600 hover:bg-orange-100 hover:text-orange-800'
            }`}
          >
            전체 레시피
          </button>
          <button
            type="button"
            onClick={() => {
              onSelectCategory('즐겨찾기');
              scrollToSection('recipes');
            }}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
              currentCategory === '즐겨찾기'
                ? 'bg-amber-100 font-bold text-amber-800'
                : 'text-stone-600 hover:bg-orange-100 hover:text-orange-800'
            }`}
          >
            <Bookmark className="h-3.5 w-3.5 fill-current" />
            <span>즐겨찾기</span>
            {bookmarkCount > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-black text-white">
                {bookmarkCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('about')}
            className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-stone-600 transition hover:bg-orange-100 hover:text-orange-800"
          >
            이용안내
          </button>
        </nav>

        {/* Right Action Tools */}
        <div className="flex items-center gap-2">
          {/* Kitchen Timer Toggle Button */}
          <button
            type="button"
            onClick={() => {
              logger.info('Header', '타이머 버튼 클릭');
              onToggleTimer();
            }}
            className={`relative flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition shadow-sm ${
              isTimerOpen
                ? 'border-orange-300 bg-orange-500 text-white'
                : 'border-orange-200 bg-white text-stone-700 hover:bg-orange-50'
            }`}
            title="요리 타이머"
            aria-label="요리 타이머 열기"
          >
            <Timer className="h-4 w-4" />
            <span className="hidden sm:inline">타이머</span>
          </button>

          {/* Shopping List Button */}
          <button
            type="button"
            onClick={() => {
              logger.info('Header', '장보기 목록 열기 클릭');
              onOpenShoppingList();
            }}
            className="relative flex h-10 items-center gap-1.5 rounded-xl border border-orange-200 bg-white px-3 text-xs font-bold text-stone-700 shadow-sm transition hover:bg-orange-50"
            title="장보기 목록"
            aria-label="장보기 목록 보기"
          >
            <ShoppingCart className="h-4 w-4 text-orange-600" />
            <span className="hidden sm:inline">장보기</span>
            {shoppingCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-600 px-1 text-[11px] font-black text-white">
                {shoppingCount}
              </span>
            )}
          </button>

          {/* Add Recipe Button */}
          <button
            type="button"
            onClick={() => {
              logger.info('Header', '새 레시피 추가 클릭');
              onOpenAddRecipe();
            }}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-3.5 text-xs font-bold text-white shadow-sm transition hover:from-orange-600 hover:to-amber-600 hover:shadow-md"
            title="새 레시피 등록"
          >
            <PlusCircle className="h-4 w-4" />
            <span className="hidden sm:inline">레시피 추가</span>
          </button>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={handleToggleMobileMenu}
            className="grid h-10 w-10 place-items-center rounded-xl border border-orange-200 bg-white text-stone-700 shadow-sm transition hover:bg-orange-50 md:hidden"
            aria-label="모바일 메뉴 열기"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="border-t border-orange-100 bg-[#fffaf3] px-4 py-3 shadow-lg md:hidden">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                scrollToSection('home');
              }}
              className="rounded-xl bg-orange-50 px-4 py-3 text-center text-sm font-bold text-stone-700 transition hover:bg-orange-100"
            >
              🏠 홈으로
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('전체')}
              className="rounded-xl bg-orange-50 px-4 py-3 text-center text-sm font-bold text-stone-700 transition hover:bg-orange-100"
            >
              📖 전체 레시피
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('즐겨찾기')}
              className="flex items-center justify-center gap-1 rounded-xl bg-amber-50 px-4 py-3 text-center text-sm font-bold text-amber-800 transition hover:bg-amber-100"
            >
              ⭐ 즐겨찾기 ({bookmarkCount})
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('about')}
              className="rounded-xl bg-orange-50 px-4 py-3 text-center text-sm font-bold text-stone-700 transition hover:bg-orange-100"
            >
              💡 이용안내
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
