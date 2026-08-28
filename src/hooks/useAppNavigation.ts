/**
 * @file src/hooks/useAppNavigation.ts
 * @description URL 해시 기반 화면 라우팅 및 뷰 전환 상태 관리 훅.
 * #/ai-chef, #/meal-plan 및 메인 홈 간의 전환과 브라우저 히스토리 동기화 지원.
 */

import { useState, useEffect, useCallback } from 'react';
import { AppViewMode } from '../types/navigation';
import { logger } from '../utils/logger';

export interface UseAppNavigationReturn {
  /** 현재 활성화된 화면 뷰 모드 */
  currentView: AppViewMode;
  /** 화면 뷰 전환 및 URL 해시 동기화 함수 */
  navigateView: (view: AppViewMode) => void;
}

/**
 * 애플리케이션 화면 네비게이션 관리 훅
 * @returns currentView, navigateView
 */
export function useAppNavigation(): UseAppNavigationReturn {
  const [currentView, setCurrentView] = useState<AppViewMode>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash.includes('ai-chef')) return 'ai-chef';
      if (hash.includes('meal-plan')) return 'meal-plan';
    }
    return 'home';
  });

  // URL Hash 변경 이벤트 리스너 등록
  useEffect(() => {
    const handleHashChange = (): void => {
      const hash = window.location.hash;
      logger.info('useAppNavigation.handleHashChange', `해시 변경 감지: ${hash}`);
      if (hash.includes('ai-chef')) {
        setCurrentView('ai-chef');
      } else if (hash.includes('meal-plan')) {
        setCurrentView('meal-plan');
      } else {
        setCurrentView('home');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  /**
   * 화면 뷰 전환 및 브라우저 해시 URL 동기화
   * @param view 이동할 뷰 모드 ('home' | 'ai-chef' | 'meal-plan')
   */
  const navigateView = useCallback((view: AppViewMode): void => {
    logger.info('useAppNavigation.navigateView', `뷰 전환: ${view}`);
    setCurrentView(view);
    if (view === 'ai-chef') {
      window.location.hash = '#/ai-chef';
    } else if (view === 'meal-plan') {
      window.location.hash = '#/meal-plan';
    } else {
      window.location.hash = '';
    }
  }, []);

  return {
    currentView,
    navigateView,
  };
}
