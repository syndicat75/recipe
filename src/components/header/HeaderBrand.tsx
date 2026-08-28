/**
 * @file src/components/header/HeaderBrand.tsx
 * @description 헤더 상단 브랜드 로고 및 앱 타이틀/관리자 배지 컴포넌트.
 */

import React from 'react';
import { APP_CONFIG } from '../../config/appConfig';
import { logger } from '../../utils/logger';

export interface HeaderBrandProps {
  /** 관리자 여부 */
  isAdmin?: boolean;
  /** 홈 화면 이동 및 스크롤 콜백 */
  onGoHome: () => void;
}

/**
 * 헤더 브랜드 로고 및 타이틀 컴포넌트
 */
export const HeaderBrand: React.FC<HeaderBrandProps> = ({ isAdmin = false, onGoHome }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    logger.info('HeaderBrand', '브랜드 로고 클릭 - 홈 이동');
    onGoHome();
  };

  return (
    <a
      href="#home"
      onClick={handleClick}
      className="group flex items-center gap-2.5 transition"
      aria-label={`${APP_CONFIG.appName} 홈으로 이동`}
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
  );
};
