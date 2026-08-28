/**
 * @file src/components/header/UserAuthMenu.tsx
 * @description 사용자 인증 상태, Google 로그인 버튼 및 유저 프로필 드롭다운 메뉴 컴포넌트.
 */

import React, { useState, useRef } from 'react';
import { RefreshCw, Database, RotateCcw, LogOut } from 'lucide-react';
import { FirebaseAuthUser, SyncStatus } from '../../types/firebase';
import { useClickOutside } from '../../hooks/useClickOutside';
import { logger } from '../../utils/logger';

export interface UserAuthMenuProps {
  /** 현재 로그인한 Firebase 사용자 */
  user: FirebaseAuthUser | null;
  /** 관리자 여부 */
  isAdmin?: boolean;
  /** 동기화 상태 */
  syncStatus?: SyncStatus;
  /** 로그인 처리 중 여부 */
  isLoggingIn?: boolean;
  /** Google 로그인 시작 콜백 */
  onLogin?: () => void;
  /** 로그아웃 콜백 */
  onLogout?: () => void;
  /** 관리자 클라우드 동기화 모달 열기 콜백 */
  onOpenCloudSyncModal?: () => void;
  /** 관리자 기본 시드 레시피 복원 콜백 */
  onRestoreDefaultRecipes?: () => void;
}

/**
 * 사용자 인증 및 계정 관리 드롭다운 메뉴
 */
export const UserAuthMenu: React.FC<UserAuthMenuProps> = ({
  user,
  isAdmin = false,
  syncStatus = 'local-only',
  isLoggingIn = false,
  onLogin,
  onLogout,
  onOpenCloudSyncModal,
  onRestoreDefaultRecipes,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 드롭다운 닫기
  useClickOutside(userMenuRef, () => {
    setIsUserMenuOpen(false);
  });

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

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => {
          logger.info('UserAuthMenu', '로그인 버튼 클릭');
          if (onLogin) onLogin();
        }}
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
        <span className="hidden sm:inline">
          {isLoggingIn ? '로그인 중...' : '관리자 로그인'}
        </span>
        <span className="sm:hidden">
          {isLoggingIn ? '로그인 중...' : '관리자 로그인'}
        </span>
      </button>
    );
  }

  return (
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
              <span className="font-bold">{getSyncLabel(syncStatus)}</span>
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
                <span>🌐 공개 레시피 DB 관리</span>
              </button>
            )}

            {isAdmin && onRestoreDefaultRecipes && (
              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  onRestoreDefaultRecipes();
                }}
                className="w-full flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-stone-700 hover:bg-amber-50 hover:text-amber-900 transition text-left"
              >
                <RotateCcw className="h-4 w-4 text-amber-500" />
                <span>🔄 기본 시드 레시피 복구</span>
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
  );
};
