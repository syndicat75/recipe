/**
 * @file src/components/Header.tsx
 * @description 웹앱 상단 네비게이션 바, 브랜드 로고, 오늘 뭐 먹지(🎲), 주간 식단표(📅), AI 요리사(✨),
 * 가족 공유 공간(👨‍👩‍👧), 즐겨찾기, 장보기, 타이머 위젯 및 관리자 전용 레시피 관리(추가/가져오기/백업) 지원
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Bookmark,
  ShoppingCart,
  PlusCircle,
  Timer,
  Menu,
  X,
  Database,
  HelpCircle,
  Home,
  BookOpen,
  Sparkles,
  Download,
  WifiOff,
  Dice5,
  Calendar,
  Users,
  Camera,
  LogIn,
  LogOut,
  Cloud,
  CloudCheck,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { APP_CONFIG } from '../config/appConfig';
import { FilterCategory } from '../types/recipe';
import { FirebaseAuthUser, SyncStatus } from '../types/firebase';
import { logger } from '../utils/logger';

interface HeaderProps {
  /** 현재 선택된 카테고리 필터 */
  currentCategory: FilterCategory;
  /** 카테고리 선택 핸들러 */
  onSelectCategory: (category: FilterCategory) => void;
  /** 현재 활성 뷰 (홈/레시피 vs AI 요리사 vs 주간 식단표) */
  currentView?: 'home' | 'ai-chef' | 'meal-plan';
  /** 뷰 전환 핸들러 */
  onNavigateView?: (view: 'home' | 'ai-chef' | 'meal-plan') => void;
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
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 유저 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * 모바일 메뉴 토글
   */
  const handleToggleMobileMenu = (): void => {
    logger.info('Header.handleToggleMobileMenu', `모바일 메뉴 토글: ${!isMobileMenuOpen}`);
    setIsMobileMenuOpen((prev) => !prev);
  };

  /**
   * 홈 뷰 및 카테고리 이동
   */
  const handleNavClick = (targetCategory: FilterCategory): void => {
    logger.info('Header.handleNavClick', `네비게이션 클릭: ${targetCategory}`);
    if (onNavigateView) onNavigateView('home');
    onSelectCategory(targetCategory);
    setIsMobileMenuOpen(false);
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
      {/* Offline Alert Bar */}
      {isOffline && (
        <div className="flex items-center justify-center gap-1.5 bg-amber-500 py-1 px-3 text-center text-xs font-bold text-white shadow-xs">
          <WifiOff className="h-3.5 w-3.5" />
          <span>현재 오프라인 상태입니다. 저장된 레시피와 장보기 목록을 계속 이용하실 수 있습니다.</span>
        </div>
      )}

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
            <div className="font-soft text-[16px] font-black tracking-tight text-stone-900 sm:text-lg flex items-center gap-1.5">
              <span>{APP_CONFIG.appName}</span>
              {isAdmin && (
                <span className="rounded-md bg-orange-500 px-1.5 py-0.5 text-[9px] font-black text-white tracking-normal">
                  관리자
                </span>
              )}
            </div>
            <div className="hidden text-[9px] font-extrabold tracking-[0.2em] text-orange-600 sm:block">
              {APP_CONFIG.appSubTitle}
            </div>
          </div>
        </a>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="상단 메뉴">
          <button
            type="button"
            onClick={() => scrollToSection('home')}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              currentView === 'home' && currentCategory === '전체'
                ? 'bg-orange-100/80 text-orange-900 font-bold'
                : 'text-stone-600 hover:bg-orange-100 hover:text-orange-800'
            }`}
          >
            홈
          </button>

          {/* 🎲 오늘 뭐 먹지? 버튼 */}
          <button
            type="button"
            onClick={() => {
              logger.info('Header', '오늘 뭐 먹지 클릭');
              onOpenTodayMenu();
            }}
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200/70 transition shadow-2xs"
            title="고민될 때 랜덤 룰렛 또는 AI 추천받기"
          >
            <Dice5 className="h-3.5 w-3.5 text-orange-500" />
            <span>오늘 뭐 먹지?</span>
          </button>

          {/* 📅 주간 식단표 탭 */}
          <button
            type="button"
            onClick={() => {
              if (onNavigateView) onNavigateView('meal-plan');
            }}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              currentView === 'meal-plan'
                ? 'bg-orange-500 text-white font-bold shadow-xs'
                : 'text-stone-600 hover:bg-orange-100 hover:text-orange-800'
            }`}
            title="월~일 아침/점심/저녁 식단표 계획 및 장보기 생성"
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>주간 식단표</span>
          </button>

          {/* ✨ AI 요리사 정식 메뉴 버튼 (PC) */}
          <button
            type="button"
            onClick={() => {
              if (onNavigateView) onNavigateView('ai-chef');
            }}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition shadow-2xs ${
              currentView === 'ai-chef'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs'
                : 'bg-orange-50/90 text-orange-800 hover:bg-orange-100 hover:text-orange-900 border border-orange-200/60'
            }`}
            title="요리 고민이나 팁을 무엇이든 물어보는 AI 요리사"
          >
            <Sparkles className={`h-3.5 w-3.5 ${currentView === 'ai-chef' ? 'text-amber-200' : 'text-orange-600'}`} />
            <span>✨ AI 요리사</span>
          </button>

          {/* 즐겨찾기 */}
          <button
            type="button"
            onClick={() => {
              if (onNavigateView) onNavigateView('home');
              onSelectCategory('즐겨찾기');
              scrollToSection('recipes');
            }}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              currentView === 'home' && currentCategory === '즐겨찾기'
                ? 'bg-amber-100 font-bold text-amber-800'
                : 'text-stone-600 hover:bg-orange-100 hover:text-orange-800'
            }`}
          >
            <Bookmark className="h-3.5 w-3.5 fill-current text-amber-500" />
            <span>즐겨찾기</span>
            {bookmarkCount > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-black text-white">
                {bookmarkCount}
              </span>
            )}
          </button>

          {/* 👨‍👩‍👧 가족 공간 */}
          <button
            type="button"
            onClick={onOpenFamilyShare}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition ${
              currentFamilyName
                ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                : 'text-stone-600 hover:bg-orange-100 hover:text-orange-800'
            }`}
            title="가족 공유 공간"
          >
            <Users className="h-3.5 w-3.5 text-rose-500" />
            <span>{currentFamilyName ? currentFamilyName : '가족 공간'}</span>
          </button>

          {/* 관리자 전용: 외부 레시피 가져오기 */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                logger.info('Header', '관리자 외부 레시피 가져오기 클릭');
                onOpenImportRecipe();
              }}
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50/80 hover:bg-orange-100 transition"
              title="웹페이지 URL, 텍스트 또는 사진에서 AI로 레시피 가져오기 (관리자)"
            >
              <Camera className="h-3.5 w-3.5 text-orange-500" />
              <span>가져오기</span>
            </button>
          )}

          {/* 관리자 전용: 데이터 백업 및 복원 */}
          {isAdmin && (
            <button
              type="button"
              onClick={onOpenBackupRestore}
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-stone-600 transition hover:bg-orange-100 hover:text-orange-800"
              title="데이터 백업 및 복원 (관리자)"
            >
              <Database className="h-3.5 w-3.5 text-stone-500" />
              <span>백업/복원</span>
            </button>
          )}

          {!isStandalone && onInstallPwa && (
            <button
              type="button"
              id="desktop-pwa-install-btn"
              onClick={onInstallPwa}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition shadow-2xs ${
                isInstalled
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-orange-50 text-orange-700 border border-orange-200/80 hover:bg-orange-100 hover:text-orange-900'
              }`}
              title={isInstalled ? '앱이 이미 설치되어 있습니다' : '홈 화면에 앱 설치하기'}
            >
              {isInstalled ? (
                <>
                  <span className="text-emerald-600 font-black">✓</span>
                  <span>앱 설치됨</span>
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5 text-orange-600" />
                  <span>📲 앱 설치</span>
                </>
              )}
            </button>
          )}
        </nav>

        {/* Right Action Tools */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Sync Status Badge (Desktop) */}
          {user && (
            <div className="hidden xl:flex items-center">
              {syncStatus === 'synced' && (
                <span
                  className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200"
                  title="Cloud Firestore 실시간 동기화 완료"
                >
                  <CloudCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>☁️ 동기화됨</span>
                </span>
              )}
              {syncStatus === 'syncing' && (
                <span
                  className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 border border-amber-200 animate-pulse"
                  title="Firestore 동기화 중"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-amber-600 animate-spin" />
                  <span>↻ 동기화 중</span>
                </span>
              )}
              {syncStatus === 'offline' && (
                <span
                  className="flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-stone-600 border border-stone-200"
                  title="오프라인 영속 캐시 사용 중"
                >
                  <WifiOff className="h-3.5 w-3.5 text-stone-500" />
                  <span>📴 오프라인</span>
                </span>
              )}
              {syncStatus === 'error' && (
                <span
                  className="flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 border border-rose-200"
                  title="클라우드 동기화 오류 발생"
                >
                  <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                  <span>⚠️ 동기화 오류</span>
                </span>
              )}
            </div>
          )}

          {/* User Auth Profile / Login Button */}
          {user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className={`flex h-10 items-center gap-2 rounded-xl border px-2.5 sm:px-3 text-xs font-bold shadow-sm transition ${
                  isAdmin
                    ? 'border-orange-300 bg-orange-50/70 text-orange-950 hover:bg-orange-100'
                    : 'border-orange-200 bg-white text-stone-700 hover:bg-orange-50'
                }`}
                title={`${user.displayName || user.email} 계정 관리 (${isAdmin ? '관리자' : '일반 사용자'})`}
                aria-label="사용자 계정 메뉴"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || '사용자'}
                    className="h-6 w-6 rounded-full object-cover border border-orange-200"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-tr from-orange-400 to-amber-400 text-[11px] font-black text-white">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <span className="hidden md:inline max-w-[90px] truncate text-stone-800">
                  {user.displayName || '내 계정'}
                </span>
                {isAdmin && (
                  <span className="hidden lg:inline text-[10px] font-black text-orange-600 bg-white px-1.5 py-0.5 rounded-md border border-orange-200">
                    👑 관리자
                  </span>
                )}
              </button>

              {/* User Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-stone-200 bg-white p-3 shadow-xl animate-scale-up">
                  <div className="flex items-center gap-2.5 border-b border-stone-100 pb-3">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt=""
                        className="h-10 w-10 rounded-full border border-orange-200"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-orange-100 text-orange-700 font-bold text-sm">
                        {(user.displayName || user.email || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="overflow-hidden">
                      <div className="font-bold text-stone-900 text-xs truncate flex items-center gap-1">
                        <span>{user.displayName || 'Google 사용자'}</span>
                        {isAdmin && (
                          <span className="text-[9px] bg-orange-500 text-white font-black px-1 rounded">
                            관리자
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-stone-500 truncate">{user.email}</div>
                    </div>
                  </div>

                  <div className="py-2 space-y-1">
                    <div className="flex items-center justify-between px-2 py-1 text-[11px] text-stone-600 rounded-lg bg-stone-50">
                      <span>권한 상태:</span>
                      <span className="font-bold text-orange-600">
                        {isAdmin ? '👑 레시피 관리자' : '👤 일반 방문자'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between px-2 py-1 text-[11px] text-stone-600 rounded-lg bg-stone-50">
                      <span>동기화 상태:</span>
                      <span className="font-bold">
                        {syncStatus === 'synced'
                          ? '☁️ 동기화됨'
                          : syncStatus === 'syncing'
                          ? '↻ 동기화 중'
                          : syncStatus === 'offline'
                          ? '📴 오프라인'
                          : syncStatus === 'error'
                          ? '⚠️ 동기화 오류'
                          : '💻 로컬 모드'}
                      </span>
                    </div>

                    {isAdmin && onOpenCloudSyncModal && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenCloudSyncModal();
                        }}
                        className="w-full flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-stone-700 hover:bg-orange-50 hover:text-orange-900 transition text-left"
                      >
                        <Database className="h-4 w-4 text-orange-500" />
                        <span>🌐 공개 레시피 DB로 이전하기</span>
                      </button>
                    )}
                  </div>

                  <div className="border-t border-stone-100 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        if (onLogout) onLogout();
                      }}
                      className="w-full flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
                    >
                      <LogOut className="h-4 w-4 text-rose-500" />
                      <span>로그아웃</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onLogin}
              disabled={isLoggingIn}
              className={`flex h-10 items-center gap-1.5 rounded-xl border border-orange-200 bg-white px-2.5 sm:px-3 text-xs font-bold text-stone-700 shadow-sm transition hover:bg-stone-50 hover:border-orange-300 ${
                isLoggingIn ? 'opacity-70 cursor-not-allowed' : ''
              }`}
              title={isLoggingIn ? 'Google 로그인 처리 중입니다...' : '관리자 Google 계정으로 로그인하여 레시피 관리'}
              aria-label="관리자 Google 로그인"
            >
              {isLoggingIn ? (
                <RefreshCw className="h-4 w-4 text-orange-500 animate-spin" />
              ) : (
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              )}
              <span className="hidden sm:inline">
                {isLoggingIn ? '로그인 중...' : '관리자 로그인'}
              </span>
              <span className="sm:hidden">
                {isLoggingIn ? '로그인 중...' : '관리자 로그인'}
              </span>
            </button>
          )}

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
              <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                {shoppingCount}
              </span>
            )}
          </button>

          {/* Add Recipe Primary Button (관리자 전용) */}
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

          {/* Mobile Menu Toggle Button */}
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

      {/* Mobile Dropdown Menu */}
      {isMobileMenuOpen && (
        <div className="border-t border-orange-100 bg-white/98 p-4 shadow-xl md:hidden animate-fade-in space-y-3">
          {/* Mobile Auth Banner */}
          {user ? (
            <div className="flex items-center justify-between rounded-2xl bg-orange-50/80 p-3 border border-orange-100">
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
                    <span>
                      {syncStatus === 'synced'
                        ? '☁️ 동기화됨'
                        : syncStatus === 'syncing'
                        ? '↻ 동기화 중'
                        : syncStatus === 'offline'
                        ? '📴 오프라인'
                        : syncStatus === 'error'
                        ? '⚠️ 동기화 오류'
                        : '💻 로컬 모드'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
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
                <span className="text-xs font-bold text-stone-700">관리자 인증</span>
                <span className="text-[10px] text-stone-500">레시피 편집 및 관리</span>
              </div>
              <button
                type="button"
                onClick={() => {
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
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                )}
                <span>{isLoggingIn ? '로그인 중...' : '관리자 Google 로그인'}</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pb-2 border-b border-stone-100">
            <button
              type="button"
              onClick={() => {
                onOpenTodayMenu();
                setIsMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 rounded-xl bg-orange-50 p-2.5 text-xs font-black text-orange-800"
            >
              <Dice5 className="h-4 w-4 text-orange-500" />
              <span>🎲 오늘 뭐 먹지?</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onNavigateView) onNavigateView('meal-plan');
                setIsMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 rounded-xl bg-amber-50 p-2.5 text-xs font-black text-amber-800"
            >
              <Calendar className="h-4 w-4 text-amber-500" />
              <span>📅 주간 식단표</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onNavigateView) onNavigateView('ai-chef');
                setIsMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 rounded-xl bg-orange-100/70 p-2.5 text-xs font-black text-orange-900"
            >
              <Sparkles className="h-4 w-4 text-orange-600" />
              <span>✨ AI 요리사</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onOpenFamilyShare();
                setIsMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 rounded-xl bg-rose-50 p-2.5 text-xs font-black text-rose-800"
            >
              <Users className="h-4 w-4 text-rose-500" />
              <span>👨‍👩‍👧 가족 공간</span>
            </button>
          </div>

          <div className="flex flex-col gap-1 pt-1">
            <button
              type="button"
              onClick={() => {
                if (onNavigateView) onNavigateView('home');
                scrollToSection('home');
              }}
              className="flex items-center gap-2 rounded-xl p-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50"
            >
              <Home className="h-4 w-4 text-orange-500" />
              <span>홈으로</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('전체')}
              className="flex items-center gap-2 rounded-xl p-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50"
            >
              <BookOpen className="h-4 w-4 text-stone-500" />
              <span>전체 레시피 둘러보기</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('즐겨찾기')}
              className="flex items-center gap-2 rounded-xl p-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50"
            >
              <Bookmark className="h-4 w-4 text-amber-500" />
              <span>즐겨찾기 ({bookmarkCount})</span>
            </button>

            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onOpenAddRecipe();
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2 rounded-xl p-2.5 text-xs font-black text-orange-700 bg-orange-50 hover:bg-orange-100"
                >
                  <PlusCircle className="h-4 w-4 text-orange-600" />
                  <span>새 레시피 등록 (관리자)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onOpenImportRecipe();
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2 rounded-xl p-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50"
                >
                  <Camera className="h-4 w-4 text-orange-500" />
                  <span>레시피 가져오기 / 사진 인식 (관리자)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onOpenBackupRestore();
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2 rounded-xl p-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50"
                >
                  <Database className="h-4 w-4 text-stone-500" />
                  <span>데이터 백업 및 복원 (관리자)</span>
                </button>
              </>
            )}

            {/* PWA App Install Item (Mobile) */}
            {!isStandalone && onInstallPwa && (
              <div className="pt-2 border-t border-stone-100">
                {isInstalled ? (
                  <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-800 border border-emerald-200">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🍳</span>
                      <span>내 입맛 레시피</span>
                    </div>
                    <span className="flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                      ✓ 앱 설치됨
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    id="mobile-pwa-install-btn"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onInstallPwa();
                    }}
                    className="w-full flex items-center justify-between rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-3.5 py-3 text-xs font-black text-white shadow-md shadow-orange-500/20 active:scale-95 transition"
                  >
                    <div className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      <span>📲 앱 설치 (홈 화면에 추가)</span>
                    </div>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-md font-bold">
                      설치하기
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
