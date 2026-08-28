/**
 * @file src/components/header/ToolsMenu.tsx
 * @description 헤더 상단 도구(앱 설치, 타이머, 백업/복원, 기본 레시피 복구) 드롭다운 메뉴 컴포넌트.
 * 독립적으로 분산되어 있던 부가 도구들을 하나의 깔끔한 '도구 ▾' 드롭다운으로 통합합니다.
 */

import React, { useState, useRef } from 'react';
import { Wrench, ChevronDown, Download, Timer, Database, RotateCcw } from 'lucide-react';
import { useClickOutside } from '../../hooks/useClickOutside';
import { logger } from '../../utils/logger';

export interface ToolsMenuProps {
  /** PWA standalone(독립 실행) 모드 여부 */
  isStandalone?: boolean;
  /** PWA 설치 완료 여부 */
  isInstalled?: boolean;
  /** PWA 설치 모달/프롬프트 핸들러 */
  onInstallPwa?: () => void;
  /** 타이머 위젯 활성화 여부 */
  isTimerOpen: boolean;
  /** 타이머 위젯 토글 핸들러 */
  onToggleTimer: () => void;
  /** 관리자 권한 여부 */
  isAdmin?: boolean;
  /** 백업/복원 모달 열기 핸들러 (관리자 전용) */
  onOpenBackupRestore?: () => void;
  /** 기본 시드 레시피 복구 핸들러 (관리자 전용) */
  onRestoreDefaultRecipes?: () => void;
}

/**
 * 헤더 상단 통합 도구 드롭다운 메뉴 컴포넌트
 */
export const ToolsMenu: React.FC<ToolsMenuProps> = ({
  isStandalone = false,
  isInstalled = false,
  onInstallPwa,
  isTimerOpen,
  onToggleTimer,
  isAdmin = false,
  onOpenBackupRestore,
  onRestoreDefaultRecipes,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 드롭다운 닫기
  useClickOutside(menuRef, () => {
    setIsOpen(false);
  });

  /**
   * 메뉴 열기/닫기 토글
   */
  const handleToggle = (): void => {
    logger.info('ToolsMenu.handleToggle', `도구 드롭다운 토글: ${!isOpen}`);
    setIsOpen((prev) => !prev);
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* 도구 트리거 버튼 */}
      <button
        type="button"
        onClick={handleToggle}
        className={`flex h-9 sm:h-10 items-center gap-1.5 rounded-xl border px-2.5 sm:px-3 text-xs font-semibold transition ${
          isOpen
            ? 'border-orange-300 bg-orange-50 text-orange-900 shadow-xs'
            : 'border-orange-200/70 bg-white/90 text-stone-700 hover:bg-orange-50/70 hover:text-orange-900 shadow-2xs'
        }`}
        title="앱 설치, 타이머, 데이터 관리 등 도구 모음"
        aria-label="도구 메뉴 열기"
        aria-expanded={isOpen}
      >
        <Wrench className="h-3.5 w-3.5 text-stone-600" />
        <span className="hidden lg:inline">도구</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-stone-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-orange-600' : ''
          }`}
        />
        {/* 타이머 실행 중일 때 시각적 인디케이터 */}
        {isTimerOpen && (
          <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" title="타이머 실행 중" />
        )}
      </button>

      {/* 드롭다운 메뉴 */}
      {isOpen && (
        <div className="absolute right-0 top-11 z-50 w-52 sm:w-56 rounded-2xl border border-stone-200 bg-white/98 p-1.5 shadow-xl backdrop-blur-md animate-scale-up">
          <div className="px-2.5 py-1.5 text-[11px] font-bold text-stone-400 border-b border-stone-100 mb-1 flex items-center justify-between">
            <span>🛠 편의 도구</span>
            {isAdmin && (
              <span className="text-[9px] text-orange-600 font-bold bg-orange-50 px-1.5 py-0.5 rounded">
                관리자 모드
              </span>
            )}
          </div>

          <div className="space-y-0.5">
            {/* 📲 PWA 앱 설치 */}
            {!isStandalone && onInstallPwa && (
              <button
                type="button"
                onClick={() => {
                  logger.info('ToolsMenu', '앱 설치 항목 클릭');
                  setIsOpen(false);
                  onInstallPwa();
                }}
                className="w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-semibold text-stone-700 hover:bg-orange-50 hover:text-orange-900 transition text-left"
              >
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-orange-500" />
                  <span>{isInstalled ? '앱 설치 안내' : '앱 설치'}</span>
                </div>
                {isInstalled ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                    ✓ 설치됨
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-md">
                    PWA
                  </span>
                )}
              </button>
            )}

            {/* ⏱ 요리 타이머 토글 */}
            <button
              type="button"
              onClick={() => {
                logger.info('ToolsMenu', '타이머 항목 클릭');
                setIsOpen(false);
                onToggleTimer();
              }}
              className={`w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-semibold transition text-left ${
                isTimerOpen
                  ? 'bg-orange-50 text-orange-900 font-bold'
                  : 'text-stone-700 hover:bg-orange-50 hover:text-orange-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-orange-500" />
                <span>요리 타이머</span>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                  isTimerOpen ? 'bg-orange-500 text-white' : 'bg-stone-100 text-stone-600'
                }`}
              >
                {isTimerOpen ? '열림' : '닫힘'}
              </span>
            </button>

            {/* 관리자 전용 기능 구분선 */}
            {isAdmin && (onOpenBackupRestore || onRestoreDefaultRecipes) && (
              <div className="my-1 border-t border-stone-100 pt-1" />
            )}

            {/* 💾 백업 / 복원 (관리자 전용) */}
            {isAdmin && onOpenBackupRestore && (
              <button
                type="button"
                onClick={() => {
                  logger.info('ToolsMenu', '백업/복원 항목 클릭');
                  setIsOpen(false);
                  onOpenBackupRestore();
                }}
                className="w-full flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-stone-700 hover:bg-orange-50 hover:text-orange-900 transition text-left"
              >
                <Database className="h-4 w-4 text-amber-600" />
                <span>데이터 백업 / 복원</span>
              </button>
            )}

            {/* ↻ 기본 시드 레시피 복구 (관리자 전용) */}
            {isAdmin && onRestoreDefaultRecipes && (
              <button
                type="button"
                onClick={() => {
                  logger.info('ToolsMenu', '기본 레시피 복구 항목 클릭');
                  setIsOpen(false);
                  onRestoreDefaultRecipes();
                }}
                className="w-full flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-stone-700 hover:bg-amber-50 hover:text-amber-900 transition text-left"
              >
                <RotateCcw className="h-4 w-4 text-amber-500" />
                <span>기본 레시피 복구</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
