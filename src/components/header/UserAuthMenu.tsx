/**
 * @file src/components/header/UserAuthMenu.tsx
 * @description 사용자 인증 상태, Google 로그인 버튼 및 유저 프로필 드롭다운 메뉴 컴포넌트.
 * [프로필 사진] 사용자 이름 ▾ 형태로 단일화하고, 관리자/동기화 상태 및 로그아웃을 드롭다운 내부에 통합합니다.
 */

import React, { useState, useRef } from 'react';
import { ChevronDown, RefreshCw, Database, LogOut, CheckCircle2, ShieldCheck } from 'lucide-react';
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
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 드롭다운 닫기
  useClickOutside(userMenuRef, () => {
    setIsUserMenuOpen(false);
  });

  /**
   * 동기화 상태 라벨 및 색상 정보 반환
   */
  const getSyncInfo = (status: SyncStatus): { label: string; icon: string; color: string } => {
    switch (status) {
      case 'synced':
        return { label: '실시간 클라우드 동기화됨', icon: '☁️', color: 'text-emerald-700 bg-emerald-50' };
      case 'syncing':
        return { label: '클라우드 동기화 중...', icon: '↻', color: 'text-orange-700 bg-orange-50' };
      case 'offline':
        return { label: '오프라인 (로컬 보관)', icon: '📴', color: 'text-amber-700 bg-amber-50' };
      case 'error':
        return { label: '동기화 연결 오류', icon: '⚠️', color: 'text-rose-700 bg-rose-50' };
      default:
        return { label: '로컬 브라우저 저장소', icon: '💻', color: 'text-stone-700 bg-stone-50' };
    }
  };

  const syncInfo = getSyncInfo(syncStatus);

  // 비로그인 상태: 깔끔한 로그인 버튼
  if (!user) {
    return (
      <button
        type="button"
        onClick={() => {
          logger.info('UserAuthMenu', '로그인 버튼 클릭');
          if (onLogin) onLogin();
        }}
        disabled={isLoggingIn}
        className={`flex h-9 sm:h-10 items-center gap-1.5 rounded-xl border border-orange-200/80 bg-white/90 px-2.5 sm:px-3 text-xs font-semibold text-stone-700 shadow-2xs transition hover:bg-orange-50 hover:text-orange-950 ${
          isLoggingIn ? 'opacity-70 cursor-not-allowed' : ''
        }`}
        title={isLoggingIn ? 'Google 로그인 처리 중입니다...' : 'Google 계정 로그인'}
        aria-label="Google 로그인"
      >
        {isLoggingIn ? (
          <RefreshCw className="h-3.5 w-3.5 text-orange-500 animate-spin" />
        ) : (
          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24">
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
        <span className="hidden sm:inline">로그인</span>
      </button>
    );
  }

  // 로그인 상태: [프로필] 이름 ▾
  return (
    <div className="relative" ref={userMenuRef}>
      <button
        type="button"
        onClick={() => {
          logger.info('UserAuthMenu', `유저 메뉴 토글: ${!isUserMenuOpen}`);
          setIsUserMenuOpen((prev) => !prev);
        }}
        className={`flex h-9 sm:h-10 items-center gap-1.5 sm:gap-2 rounded-xl border px-2 sm:px-2.5 text-xs font-semibold shadow-2xs transition ${
          isUserMenuOpen
            ? 'border-orange-300 bg-orange-50 text-orange-950'
            : 'border-orange-200/70 bg-white/90 text-stone-700 hover:bg-orange-50/70 hover:text-orange-900'
        }`}
        title={`${user.displayName || user.email} 계정`}
        aria-label="사용자 프로필 메뉴"
        aria-expanded={isUserMenuOpen}
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            className="h-6 w-6 rounded-full object-cover border border-orange-200 shrink-0"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-tr from-orange-400 to-amber-400 text-[10px] font-black text-white shrink-0">
            {(user.displayName || user.email || 'U')[0].toUpperCase()}
          </div>
        )}
        <span className="hidden md:inline max-w-[80px] xl:max-w-[100px] truncate text-stone-800 font-bold">
          {user.displayName || '내 계정'}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-stone-400 transition-transform duration-200 ${
            isUserMenuOpen ? 'rotate-180 text-orange-600' : ''
          }`}
        />
      </button>

      {/* User Dropdown Menu */}
      {isUserMenuOpen && (
        <div className="absolute right-0 top-11 z-50 w-64 rounded-2xl border border-stone-200 bg-white/98 p-3 shadow-xl backdrop-blur-md animate-scale-up">
          {/* 사용자 정보 헤더 */}
          <div className="flex items-center gap-2.5 border-b border-stone-100 pb-3">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="h-9 w-9 rounded-full border border-orange-200 shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="grid h-9 w-9 place-items-center rounded-full bg-orange-100 text-orange-700 font-black text-sm shrink-0">
                {(user.displayName || user.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-bold text-stone-900 text-xs truncate">
                {user.displayName || 'Google 사용자'}
              </div>
              <div className="text-[11px] text-stone-500 truncate">{user.email}</div>
            </div>
          </div>

          {/* 권한 및 상태 배지 */}
          <div className="py-2.5 space-y-1.5">
            {/* 관리자 뱃지 (관리자일 때만 표시) */}
            {isAdmin && (
              <div className="flex items-center justify-between px-2.5 py-1.5 text-xs font-bold text-orange-900 rounded-xl bg-orange-50 border border-orange-200/60">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-orange-600" />
                  <span>👑 레시피 관리자</span>
                </div>
                <span className="text-[10px] text-orange-700 bg-white px-1.5 py-0.5 rounded font-black border border-orange-200/60">
                  인증됨
                </span>
              </div>
            )}

            {/* 동기화 상태 */}
            <div className={`flex items-center justify-between px-2.5 py-1.5 text-xs rounded-xl ${syncInfo.color}`}>
              <div className="flex items-center gap-1.5">
                <span>{syncInfo.icon}</span>
                <span className="font-medium text-[11px]">{syncInfo.label}</span>
              </div>
              {syncStatus === 'synced' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
            </div>

            {/* 관리자: 클라우드 DB 동기화 모달 열기 */}
            {isAdmin && onOpenCloudSyncModal && (
              <button
                type="button"
                onClick={() => {
                  logger.info('UserAuthMenu', '클라우드 DB 관리 클릭');
                  setIsUserMenuOpen(false);
                  onOpenCloudSyncModal();
                }}
                className="w-full flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-stone-700 hover:bg-orange-50 hover:text-orange-900 transition text-left mt-1"
              >
                <Database className="h-3.5 w-3.5 text-orange-500" />
                <span>공개 레시피 DB 관리</span>
              </button>
            )}
          </div>

          {/* 로그아웃 버튼 */}
          <div className="border-t border-stone-100 pt-2">
            <button
              type="button"
              onClick={() => {
                logger.info('UserAuthMenu', '로그아웃 클릭');
                setIsUserMenuOpen(false);
                if (onLogout) onLogout();
              }}
              className="w-full flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
            >
              <LogOut className="h-3.5 w-3.5 text-rose-500" />
              <span>로그아웃</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

