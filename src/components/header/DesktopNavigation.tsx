/**
 * @file src/components/header/DesktopNavigation.tsx
 * @description 데스크톱 화면의 주요 메뉴 네비게이션 바 컴포넌트.
 * 홈, 오늘 뭐 먹지?, 주간 식단표, AI 요리사, 즐겨찾기, 가족 공간, 관리자 도구 및 PWA 설치 버튼을 렌더링합니다.
 */

import React from 'react';
import {
  Dice5,
  Calendar,
  Sparkles,
  Bookmark,
  Users,
  Camera,
  Database,
  Download,
} from 'lucide-react';
import { FilterCategory } from '../../types/recipe';
import { AppViewMode } from '../../types/navigation';
import { logger } from '../../utils/logger';

export interface DesktopNavigationProps {
  currentCategory: FilterCategory;
  onSelectCategory: (category: FilterCategory) => void;
  currentView: AppViewMode;
  onNavigateView?: (view: AppViewMode) => void;
  bookmarkCount: number;
  onOpenTodayMenu: () => void;
  onOpenFamilyShare: () => void;
  currentFamilyName: string | null;
  isAdmin?: boolean;
  onOpenImportRecipe: () => void;
  onOpenBackupRestore: () => void;
  isStandalone?: boolean;
  isInstalled?: boolean;
  onInstallPwa?: () => void;
  scrollToSection: (id: string) => void;
}

/**
 * 데스크톱 상단 네비게이션 메뉴 컴포넌트
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
  isAdmin = false,
  onOpenImportRecipe,
  onOpenBackupRestore,
  isStandalone = false,
  isInstalled = false,
  onInstallPwa,
  scrollToSection,
}) => {
  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="상단 메뉴">
      {/* 홈 버튼 */}
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
          logger.info('DesktopNavigation', '오늘 뭐 먹지 클릭');
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

      {/* ✨ AI 요리사 정식 메뉴 버튼 */}
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
        <Sparkles
          className={`h-3.5 w-3.5 ${currentView === 'ai-chef' ? 'text-amber-200' : 'text-orange-600'}`}
        />
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
            logger.info('DesktopNavigation', '관리자 외부 레시피 가져오기 클릭');
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

      {/* PWA 설치 버튼 */}
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
  );
};
