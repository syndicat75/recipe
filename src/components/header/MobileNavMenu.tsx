/**
 * @file src/components/header/MobileNavMenu.tsx
 * @description 모바일 환경에서 표시되는 햄버거 드롭다운 네비게이션 메뉴 컴포넌트.
 * [주요 메뉴 / 개인 & 가족 / 편의 도구 / 관리자 기능]의 4개 그룹으로 구조화하여 제공합니다.
 */

import React from 'react';
import {
  Home,
  Dice5,
  Calendar,
  Sparkles,
  Bookmark,
  Users,
  BookOpen,
  PlusCircle,
  Camera,
  Database,
  RotateCcw,
  Download,
  RefreshCw,
  ShoppingCart,
  Timer,
  FolderKanban,
} from 'lucide-react';
import { FilterCategory } from '../../types/recipe';
import { AppViewMode } from '../../types/navigation';
import { FirebaseAuthUser, SyncStatus } from '../../types/firebase';
import { logger } from '../../utils/logger';

export interface MobileNavMenuProps {
  isOpen: boolean;
  onClose: () => void;
  user: FirebaseAuthUser | null;
  isAdmin?: boolean;
  syncStatus?: SyncStatus;
  isLoggingIn?: boolean;
  onLogin?: () => void;
  onLogout?: () => void;
  onNavigateView?: (view: AppViewMode) => void;
  onSelectCategory: (category: FilterCategory) => void;
  bookmarkCount: number;
  shoppingCount?: number;
  onOpenShoppingList?: () => void;
  isTimerOpen?: boolean;
  onToggleTimer?: () => void;
  onOpenTodayMenu: () => void;
  onOpenFamilyShare: () => void;
  onOpenAddRecipe: () => void;
  onOpenImportRecipe: () => void;
  /** 카테고리 관리 모달 열기 핸들러 (관리자 전용) */
  onOpenCategoryManager?: () => void;
  onOpenBackupRestore: () => void;
  onRestoreDefaultRecipes?: () => void;
  /** 칼로리 일괄 분석 모달 열기 핸들러 (관리자 전용) */
  onOpenAdminCalories?: () => void;
  isStandalone?: boolean;
  isInstalled?: boolean;
  onInstallPwa?: () => void;
  scrollToSection: (id: string) => void;
}

/**
 * 모바일 화면 전용 네비게이션 드로어 메뉴 (4대 영역 구조화)
 */
export const MobileNavMenu: React.FC<MobileNavMenuProps> = ({
  isOpen,
  onClose,
  user,
  isAdmin = false,
  syncStatus = 'local-only',
  isLoggingIn = false,
  onLogin,
  onLogout,
  onNavigateView,
  onSelectCategory,
  bookmarkCount,
  shoppingCount = 0,
  onOpenShoppingList,
  isTimerOpen = false,
  onToggleTimer,
  onOpenTodayMenu,
  onOpenFamilyShare,
  onOpenAddRecipe,
  onOpenImportRecipe,
  onOpenCategoryManager,
  onOpenBackupRestore,
  onRestoreDefaultRecipes,
  onOpenAdminCalories,
  isStandalone = false,
  isInstalled = false,
  onInstallPwa,
  scrollToSection,
}) => {
  if (!isOpen) return null;

  const handleNavClick = (targetCategory: FilterCategory) => {
    logger.info('MobileNavMenu', `카테고리 이동: ${targetCategory}`);
    if (onNavigateView) onNavigateView('home');
    onSelectCategory(targetCategory);
    onClose();
  };

  const getSyncLabel = (status: SyncStatus): string => {
    switch (status) {
      case 'synced':
        return '☁️ 동기화됨';
      case 'syncing':
        return '↻ 동기화 중';
      case 'offline':
        return '📴 오프라인';
      case 'error':
        return '⚠️ 동기화 오류';
      default:
        return '💻 로컬 모드';
    }
  };

  return (
    <div className="border-t border-orange-100 bg-white/98 p-4 shadow-xl lg:hidden animate-fade-in space-y-4 max-h-[calc(100vh-4.5rem)] overflow-y-auto">
      {/* 1. 사용자 계정 및 인증 배너 */}
      {user ? (
        <div className="flex items-center justify-between rounded-2xl bg-orange-50/80 p-3 border border-orange-100/90">
          <div className="flex items-center gap-2.5 overflow-hidden">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="h-9 w-9 rounded-full border border-orange-200 shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="grid h-9 w-9 place-items-center rounded-full bg-orange-200 text-orange-800 font-black text-xs shrink-0">
                {(user.displayName || user.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-bold text-xs text-stone-900 truncate flex items-center gap-1">
                <span>{user.displayName || 'Google 사용자'}</span>
                {isAdmin && (
                  <span className="text-[9px] bg-orange-500 text-white font-black px-1 rounded">
                    관리자
                  </span>
                )}
              </div>
              <div className="text-[10px] text-stone-500 flex items-center gap-1">
                <span>{getSyncLabel(syncStatus)}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              logger.info('MobileNavMenu', '로그아웃 클릭');
              onClose();
              if (onLogout) onLogout();
            }}
            className="rounded-xl bg-white px-2.5 py-1.5 text-xs font-bold text-rose-600 border border-stone-200 shadow-2xs hover:bg-rose-50"
          >
            로그아웃
          </button>
        </div>
      ) : (
        <div className="rounded-2xl bg-stone-50 p-3 border border-stone-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-700">로그인</span>
            <span className="text-[10px] text-stone-500">계정 연동 및 클라우드 동기화</span>
          </div>
          <button
            type="button"
            onClick={() => {
              logger.info('MobileNavMenu', '로그인 클릭');
              if (onLogin) onLogin();
            }}
            disabled={isLoggingIn}
            className={`w-full flex items-center justify-center gap-2 rounded-xl bg-white border border-stone-300 py-2.5 text-xs font-bold text-stone-800 shadow-2xs hover:bg-stone-50 ${
              isLoggingIn ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isLoggingIn ? (
              <RefreshCw className="h-4 w-4 text-orange-500 animate-spin" />
            ) : (
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>{isLoggingIn ? '로그인 중...' : 'Google 계정 로그인'}</span>
          </button>
        </div>
      )}

      {/* 2. 주요 메뉴 (Core Navigation) */}
      <div>
        <div className="text-[11px] font-bold text-stone-400 px-1 mb-1.5">📌 주요 메뉴</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              logger.info('MobileNavMenu', '홈 클릭');
              if (onNavigateView) onNavigateView('home');
              scrollToSection('home');
              onClose();
            }}
            className="flex items-center gap-2 rounded-xl bg-stone-50 p-2.5 text-xs font-bold text-stone-800 hover:bg-orange-50 hover:text-orange-900 transition"
          >
            <Home className="h-4 w-4 text-stone-600 shrink-0" />
            <span>홈 화면</span>
          </button>

          <button
            type="button"
            onClick={() => {
              logger.info('MobileNavMenu', '오늘 뭐 먹지 클릭');
              onOpenTodayMenu();
              onClose();
            }}
            className="flex items-center gap-2 rounded-xl bg-orange-50 p-2.5 text-xs font-bold text-orange-800 hover:bg-orange-100 transition"
          >
            <Dice5 className="h-4 w-4 text-orange-500 shrink-0" />
            <span>🎲 오늘 뭐 먹지?</span>
          </button>

          <button
            type="button"
            onClick={() => {
              logger.info('MobileNavMenu', '주간 식단표 클릭');
              if (onNavigateView) onNavigateView('meal-plan');
              onClose();
            }}
            className="flex items-center gap-2 rounded-xl bg-stone-50 p-2.5 text-xs font-bold text-stone-800 hover:bg-orange-50 transition"
          >
            <Calendar className="h-4 w-4 text-stone-500 shrink-0" />
            <span>📅 주간 식단표</span>
          </button>

          <button
            type="button"
            onClick={() => {
              logger.info('MobileNavMenu', 'AI 요리사 클릭');
              if (onNavigateView) onNavigateView('ai-chef');
              onClose();
            }}
            className="flex items-center gap-2 rounded-xl bg-orange-100/70 p-2.5 text-xs font-bold text-orange-900 hover:bg-orange-200/80 transition"
          >
            <Sparkles className="h-4 w-4 text-orange-600 shrink-0" />
            <span>✨ AI 요리사</span>
          </button>
        </div>
      </div>

      {/* 3. 개인 기능 & 가족 (Personal & Family) */}
      <div>
        <div className="text-[11px] font-bold text-stone-400 px-1 mb-1.5">👤 개인 & 가족</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleNavClick('즐겨찾기')}
            className="flex items-center justify-between rounded-xl bg-amber-50/70 p-2.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition"
          >
            <div className="flex items-center gap-1.5">
              <Bookmark className="h-4 w-4 text-amber-500 shrink-0" />
              <span>즐겨찾기</span>
            </div>
            {bookmarkCount > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-black text-white">
                {bookmarkCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              logger.info('MobileNavMenu', '가족 공간 클릭');
              onOpenFamilyShare();
              onClose();
            }}
            className="flex items-center gap-1.5 rounded-xl bg-rose-50 p-2.5 text-xs font-bold text-rose-800 hover:bg-rose-100 transition"
          >
            <Users className="h-4 w-4 text-rose-500 shrink-0" />
            <span>👨‍👩‍👧 가족 공간</span>
          </button>

          {onOpenShoppingList && (
            <button
              type="button"
              onClick={() => {
                logger.info('MobileNavMenu', '장보기 목록 클릭');
                onOpenShoppingList();
                onClose();
              }}
              className="flex items-center justify-between rounded-xl bg-stone-50 p-2.5 text-xs font-bold text-stone-800 hover:bg-orange-50 transition"
            >
              <div className="flex items-center gap-1.5">
                <ShoppingCart className="h-4 w-4 text-orange-600 shrink-0" />
                <span>장보기 목록</span>
              </div>
              {shoppingCount > 0 && (
                <span className="rounded-full bg-orange-500 px-1.5 py-0.2 text-[10px] font-black text-white">
                  {shoppingCount}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => handleNavClick('전체')}
            className="flex items-center gap-1.5 rounded-xl bg-stone-50 p-2.5 text-xs font-bold text-stone-700 hover:bg-stone-100 transition"
          >
            <BookOpen className="h-4 w-4 text-stone-500 shrink-0" />
            <span>전체 둘러보기</span>
          </button>
        </div>
      </div>

      {/* 4. 도구 (Tools) */}
      <div>
        <div className="text-[11px] font-bold text-stone-400 px-1 mb-1.5">🛠 편의 도구</div>
        <div className="space-y-1.5">
          {onToggleTimer && (
            <button
              type="button"
              onClick={() => {
                logger.info('MobileNavMenu', '타이머 토글 클릭');
                onToggleTimer();
                onClose();
              }}
              className={`w-full flex items-center justify-between rounded-xl p-2.5 text-xs font-bold transition ${
                isTimerOpen
                  ? 'bg-orange-500 text-white'
                  : 'bg-stone-50 text-stone-700 hover:bg-orange-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <Timer className={`h-4 w-4 ${isTimerOpen ? 'text-white' : 'text-orange-500'}`} />
                <span>요리 타이머</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${isTimerOpen ? 'bg-white/20' : 'bg-stone-200/70 text-stone-600'}`}>
                {isTimerOpen ? '실행 중' : '열기'}
              </span>
            </button>
          )}

          {/* 📲 PWA App Install Item (Mobile) */}
          {!isStandalone && onInstallPwa && (
            <div>
              {isInstalled ? (
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 border border-emerald-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🍳</span>
                    <span>앱 설치 완료</span>
                  </div>
                  <span className="text-[11px] font-black text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                    ✓ 설치됨
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  id="mobile-pwa-install-btn"
                  onClick={() => {
                    logger.info('MobileNavMenu', 'PWA 설치 클릭');
                    onClose();
                    onInstallPwa();
                  }}
                  className="w-full flex items-center justify-between rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-3.5 py-2.5 text-xs font-black text-white shadow-sm shadow-orange-500/20 active:scale-95 transition"
                >
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    <span>홈 화면에 앱 설치하기</span>
                  </div>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-bold">
                    PWA
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 5. 관리자 기능 (Admin Only) */}
      {isAdmin && (
        <div className="pt-2 border-t border-stone-100 space-y-1.5">
          <div className="text-[11px] font-bold text-orange-600 px-1 mb-1 flex items-center justify-between">
            <span>👑 관리자 기능</span>
            <span className="text-[9px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">
              인증됨
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              logger.info('MobileNavMenu', '레시피 추가 클릭');
              onOpenAddRecipe();
              onClose();
            }}
            className="w-full flex items-center gap-2 rounded-xl p-2.5 text-xs font-black text-white bg-gradient-to-r from-orange-500 to-amber-500 shadow-sm transition"
          >
            <PlusCircle className="h-4 w-4" />
            <span>+ 새 레시피 직접 등록</span>
          </button>

          <button
            type="button"
            onClick={() => {
              logger.info('MobileNavMenu', '레시피 가져오기 클릭');
              onOpenImportRecipe();
              onClose();
            }}
            className="w-full flex items-center gap-2 rounded-xl p-2.5 text-xs font-bold text-stone-700 bg-stone-50 hover:bg-orange-50 transition"
          >
            <Camera className="h-4 w-4 text-orange-500" />
            <span>레시피 가져오기 / 사진 인식</span>
          </button>

          {onOpenCategoryManager && (
            <button
              type="button"
              onClick={() => {
                logger.info('MobileNavMenu', '카테고리 관리 도구 클릭');
                onOpenCategoryManager();
                onClose();
              }}
              className="w-full flex items-center justify-between rounded-xl p-2.5 text-xs font-bold text-stone-700 bg-stone-50 hover:bg-orange-50 transition text-left"
            >
              <div className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-orange-500" />
                <span>카테고리 관리</span>
              </div>
              <span className="text-[10px] bg-orange-100 text-orange-800 font-bold px-1.5 py-0.5 rounded">
                관리자
              </span>
            </button>
          )}

          {onOpenAdminCalories && (
            <button
              type="button"
              onClick={() => {
                logger.info('MobileNavMenu', '칼로리 관리 도구 클릭');
                onOpenAdminCalories();
                onClose();
              }}
              className="w-full flex items-center justify-between rounded-xl p-2.5 text-xs font-bold text-stone-700 bg-stone-50 hover:bg-orange-50 transition text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">🔥</span>
                <span>칼로리(kcal) 관리 도구</span>
              </div>
              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">
                AI
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              logger.info('MobileNavMenu', '백업/복원 클릭');
              onOpenBackupRestore();
              onClose();
            }}
            className="w-full flex items-center gap-2 rounded-xl p-2.5 text-xs font-bold text-stone-700 bg-stone-50 hover:bg-stone-100 transition"
          >
            <Database className="h-4 w-4 text-stone-500" />
            <span>데이터 백업 및 복원</span>
          </button>

          {onRestoreDefaultRecipes && (
            <button
              type="button"
              onClick={() => {
                logger.info('MobileNavMenu', '기본 시드 복구 클릭');
                onRestoreDefaultRecipes();
                onClose();
              }}
              className="w-full flex items-center gap-2 rounded-xl p-2.5 text-xs font-bold text-stone-700 bg-stone-50 hover:bg-amber-50 hover:text-amber-900 transition text-left"
            >
              <RotateCcw className="h-4 w-4 text-amber-500" />
              <span>기본 시드 레시피 복구</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

