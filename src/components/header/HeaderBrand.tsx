/**
 * @file src/components/header/HeaderBrand.tsx
 * @description 헤더 상단 브랜드 로고 및 앱 타이틀 컴포넌트.
 * 줄바꿈 방지(white-space: nowrap) 및 화면 크기별 부제 노출을 제어합니다.
 */

import React from 'react';
import { APP_CONFIG } from '../../config/appConfig';
import { logger } from '../../utils/logger';

export interface HeaderBrandProps {
  /** 홈 화면 이동 및 스크롤 콜백 */
  onGoHome: () => void;
}

/**
 * 헤더 브랜드 로고 및 타이틀 컴포넌트
 */
export const HeaderBrand: React.FC<HeaderBrandProps> = ({ onGoHome }) => {
  /**
   * 브랜드 로고 클릭 핸들러
   */
  const handleClick = (e: React.MouseEvent): void => {
    e.preventDefault();
    logger.info('HeaderBrand.handleClick', '브랜드 로고 클릭 - 홈 이동');
    onGoHome();
  };

  return (
    <a
      href="#home"
      onClick={handleClick}
      className="group flex shrink-0 items-center gap-2 sm:gap-2.5 transition whitespace-nowrap select-none min-w-fit"
      aria-label={`${APP_CONFIG.appName} 홈으로 이동`}
    >
      <span className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-lg sm:text-xl text-white shadow-2xs transition group-hover:-rotate-6 group-hover:scale-105 shrink-0">
        🍳
      </span>
      <div className="flex flex-col justify-center leading-tight">
        <div className="font-soft text-[15px] sm:text-[17px] font-black tracking-tight text-stone-900 whitespace-nowrap">
          {APP_CONFIG.appName}
        </div>
        {/* 1400px(2xl) 이상에서만 표시되는 영문 부제 */}
        <div className="hidden 2xl:block text-[9px] font-extrabold tracking-[0.18em] text-orange-600/90 whitespace-nowrap">
          {APP_CONFIG.appSubTitle}
        </div>
      </div>
    </a>
  );
};

