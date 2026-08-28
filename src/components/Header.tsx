/**
 * @file src/components/Header.tsx
 * @description 웹앱 상단 네비게이션 헤더 컴포넌트.
 * 브랜드 로고, 네비게이션 메뉴, 클라우드 동기화 상태, 사용자 인증,
 * 타이머 및 장보기/레시피 추가 액션 버튼들을 모듈화된 서브컴포넌트로 조립합니다.
 */

import React, { useState } from 'react';
import {
  ShoppingCart,
  PlusCircle,
  Timer,
  Menu,
  X,
  WifiOff,
} from 'lucide-react';
import { FilterCategory } from '../types/recipe';
import { AppViewMode } from '../types/navigation';
import { FirebaseAuthUser, SyncStatus } from '../types/firebase';
import { HeaderBrand } from './header/HeaderBrand';
import { DesktopNavigation } from './header/DesktopNavigation';
import { SyncStatusBadge } from './header/SyncStatusBadge';
import { UserAuthMenu } from './header/UserAuthMenu';
import { MobileNavMenu } from './header/MobileNavMenu';
import { logger } from '../utils/logger';

export interface HeaderProps {
  /** 현재 선택된 카테고리 필터 */
  currentCategory: FilterCategory;
  /** 카테고리 선택 핸들러 */
  onSelectCategory: (category: FilterCategory) => void;
  /** 현재 활성 뷰 (홈/레시피 vs AI 요리사 vs 주간 식단표) */
  currentView?: AppViewMode;
  /** 뷰 전환 핸들러 */
  onNavigateView?: (view: AppViewMode) => void;
  /** 즐겨찾기 레시피 개수 */
  bookmarkCount: number;
  /** 장보기 목록 아이템 개수 */
  shoppingCount: number;
  /** 장보기 모달 열기 핸들러 */
  onOpenShoppingList: () => void;
  /** 레시피 추가 모달 열기 핸들러 (관리자 전용) */
  onOpenAddRecipe: () => void;
  /** 외부 레시피 AI 가져오기 모달 열기 핸들러 (관리자 전용) */
  onOpenImportRecipe: () => void;
  /** 오늘 뭐 먹지 룰렛/AI 모달 열기 핸들러 */
  onOpenTodayMenu: () => void;
  /** 가족 공유 모달 열기 핸들러 */
  onOpenFamilyShare: () => void;
  /** 참여 중인 가족 공간 이름 (없으면 null) */
  currentFamilyName?: string | null;
  /** 백업/복원 모달 열기 핸들러 (관리자 전용) */
  onOpenBackupRestore: () => void;
  /** 타이머 위젯 토글 핸들러 */
  onToggleTimer: () => void;
  /** 타이머 활성화 여부 */
  isTimerOpen: boolean;
  /** PWA 설치 가능 여부 */
  canInstallPwa?: boolean;
  /** PWA가 이미 설치되었는지 여부 */
  isInstalled?: boolean;
  /** PWA standalone(독립 실행) 모드 여부 */
  isStandalone?: boolean;
  /** PWA 설치 핸들러 */
  onInstallPwa?: () => void;
  /** 오프라인 여부 */
  isOffline?: boolean;
  /** Firebase 로그인된 사용자 정보 */
  user?: FirebaseAuthUser | null;
  /** 관리자 권한 여부 */
  isAdmin?: boolean;
  /** 클라우드 동기화 상태 */
  syncStatus?: SyncStatus;
  /** 로그인 진행 중 여부 */
  isLoggingIn?: boolean;
  /** Google 로그인 핸들러 */
  onLogin?: () => void;
  /** 로그아웃 핸들러 */
  onLogout?: () => void;
  /** 클라우드 동기화 모달 열기 */
  onOpenCloudSyncModal?: () => void;
  /** 기본 시드 레시피 복구 핸들러 */
  onRestoreDefaultRecipes?: () => void;
}

/**
 * 상단 네비게이션 헤더 컴포넌트
 */
export const Header: React.FC<HeaderProps> = ({
  currentCategory,
  onSelectCategory,
  currentView = 'home',
  onNavigateView,
  bookmarkCount,
  shoppingCount,
  onOpenShoppingList,
  onOpenAddRecipe,
  onOpenImportRecipe,
  onOpenTodayMenu,
  onOpenFamilyShare,
  currentFamilyName,
  onOpenBackupRestore,
  onToggleTimer,
  isTimerOpen,
  canInstallPwa,
  isInstalled = false,
  isStandalone = false,
  onInstallPwa,
  isOffline = false,
  user = null,
  isAdmin = false,
  syncStatus = 'local-only',
  isLoggingIn = false,
  onLogin,
  onLogout,
  onOpenCloudSyncModal,
  onRestoreDefaultRecipes,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  /**
   * 모바일 메뉴 토글
   */
  const handleToggleMobileMenu = (): void => {
    logger.info('Header.handleToggleMobileMenu', `모바일 메뉴 토글: ${!isMobileMenuOpen}`);
    setIsMobileMenuOpen((prev) => !prev);
  };

  /**
   * 특정 섹션으로 스크롤 이동
   */
  const scrollToSection = (id: string): void => {
    logger.info('Header.scrollToSection', `스크롤 이동: #${id}`);
    if (onNavigateView) onNavigateView('home');
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 50);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-orange-100/80 bg-[#fffaf3]/95 backdrop-blur-xl transition-all">
      {/* 오프라인 상태 알림 바 */}
      {isOffline && (
        <div className="flex items-center justify-center gap-1.5 bg-amber-500 py-1 px-3 text-center text-xs font-bold text-white shadow-xs">
          <WifiOff className="h-3.5 w-3.5" />
          <span>현재 오프라인 상태입니다. 저장된 레시피와 장보기 목록을 계속 이용하실 수 있습니다.</span>
        </div>
      )}

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* 브랜드 로고 */}
        <HeaderBrand
          isAdmin={isAdmin}
          onGoHome={() => scrollToSection('home')}
        />

        {/* 데스크톱 네비게이션 바 */}
        <DesktopNavigation
          currentCategory={currentCategory}
          onSelectCategory={onSelectCategory}
          currentView={currentView}
          onNavigateView={onNavigateView}
          bookmarkCount={bookmarkCount}
          onOpenTodayMenu={onOpenTodayMenu}
          onOpenFamilyShare={onOpenFamilyShare}
          currentFamilyName={currentFamilyName || null}
          isAdmin={isAdmin}
          onOpenImportRecipe={onOpenImportRecipe}
          onOpenBackupRestore={onOpenBackupRestore}
          isStandalone={isStandalone}
          isInstalled={isInstalled}
          onInstallPwa={onInstallPwa}
          scrollToSection={scrollToSection}
        />

        {/* 우측 액션 툴바 */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* 클라우드 동기화 상태 뱃지 (데스크톱) */}
          {user && (
            <div className="hidden xl:flex items-center">
              <SyncStatusBadge syncStatus={syncStatus} />
            </div>
          )}

          {/* 사용자 인증 프로필 / 로그인 버튼 */}
          <UserAuthMenu
            user={user}
            isAdmin={isAdmin}
            syncStatus={syncStatus}
            isLoggingIn={isLoggingIn}
            onLogin={onLogin}
            onLogout={onLogout}
            onOpenCloudSyncModal={onOpenCloudSyncModal}
            onRestoreDefaultRecipes={onRestoreDefaultRecipes}
          />

          {/* 타이머 토글 버튼 */}
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

          {/* 장보기 목록 버튼 */}
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
              <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                {shoppingCount}
              </span>
            )}
          </button>

          {/* 레시피 추가 메인 버튼 (관리자 전용) */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                logger.info('Header', '관리자 레시피 등록 모달 열기 클릭');
                onOpenAddRecipe();
              }}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-3.5 sm:px-4 text-xs font-black text-white shadow-md shadow-orange-500/20 transition hover:from-orange-600 hover:to-amber-600 active:scale-95"
              title="새 레시피 직접 등록 (관리자)"
            >
              <PlusCircle className="h-4 w-4" />
              <span>레시피 추가</span>
            </button>
          )}

          {/* 모바일 햄버거 메뉴 버튼 */}
          <button
            type="button"
            onClick={handleToggleMobileMenu}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-200 bg-white text-stone-700 md:hidden"
            aria-label="메뉴 열기/닫기"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* 모바일 드롭다운 네비게이션 드로어 */}
      <MobileNavMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        user={user}
        isAdmin={isAdmin}
        syncStatus={syncStatus}
        isLoggingIn={isLoggingIn}
        onLogin={onLogin}
        onLogout={onLogout}
        onNavigateView={onNavigateView}
        onSelectCategory={onSelectCategory}
        bookmarkCount={bookmarkCount}
        onOpenTodayMenu={onOpenTodayMenu}
        onOpenFamilyShare={onOpenFamilyShare}
        onOpenAddRecipe={onOpenAddRecipe}
        onOpenImportRecipe={onOpenImportRecipe}
        onOpenBackupRestore={onOpenBackupRestore}
        onRestoreDefaultRecipes={onRestoreDefaultRecipes}
        isStandalone={isStandalone}
        isInstalled={isInstalled}
        onInstallPwa={onInstallPwa}
        scrollToSection={scrollToSection}
      />
    </header>
  );
};
