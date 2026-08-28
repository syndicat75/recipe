/**
 * @file src/components/Footer.tsx
 * @description 웹앱 하단 푸터 및 상단 이동(Top) 플로팅 버튼 컴포넌트
 */

import React, { useState, useEffect } from 'react';
import { ArrowUp, ChefHat, Heart } from 'lucide-react';
import { APP_CONFIG } from '../config/appConfig';
import { logger } from '../utils/logger';

/**
 * 하단 푸터 컴포넌트
 */
export const Footer: React.FC = () => {
  const [showTopButton, setShowTopButton] = useState(false);

  useEffect(() => {
    const handleScroll = (): void => {
      setShowTopButton(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /**
   * 화면 최상단으로 부드럽게 스크롤
   */
  const scrollToTop = (): void => {
    logger.info('Footer.scrollToTop', '최상단 스크롤 이동');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <footer className="border-t border-orange-100 bg-[#fffaf3] py-12 text-center">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl">🍚</span>
            <p className="font-soft text-lg font-black text-stone-800">
              맛있게 먹었던 건, 다음에도 쉽게
            </p>
          </div>
          <p className="mt-2 text-xs font-semibold text-stone-400">
            {APP_CONFIG.appName} · My Favorite Recipe Book Collection
          </p>
          <div className="mt-4 flex items-center justify-center gap-1 text-[11px] text-stone-400">
            <span>만든이의 정성이 담긴 레시피 컬렉션</span>
          </div>
        </div>
      </footer>

      {/* Floating TOP Scroll Button */}
      <button
        type="button"
        onClick={scrollToTop}
        className={`fixed bottom-6 right-6 z-30 grid h-12 w-12 place-items-center rounded-2xl bg-stone-900 text-white shadow-xl transition-all duration-300 hover:-translate-y-1 hover:bg-orange-600 focus:outline-none ${
          showTopButton
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-6 opacity-0'
        }`}
        title="맨 위로 이동"
        aria-label="페이지 맨 위로 이동"
      >
        <ArrowUp className="h-5 w-5" />
      </button>
    </>
  );
};
