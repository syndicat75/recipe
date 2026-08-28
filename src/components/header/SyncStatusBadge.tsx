/**
 * @file src/components/header/SyncStatusBadge.tsx
 * @description 데스크톱 헤더의 Firestore 클라우드 실시간 동기화 상태 뱃지 컴포넌트.
 */

import React from 'react';
import { CloudCheck, RefreshCw, WifiOff, AlertCircle } from 'lucide-react';
import { SyncStatus } from '../../types/firebase';

export interface SyncStatusBadgeProps {
  /** 동기화 상태 */
  syncStatus: SyncStatus;
}

/**
 * 데스크톱 헤더용 클라우드 동기화 상태 뱃지
 */
export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({ syncStatus }) => {
  if (syncStatus === 'synced') {
    return (
      <span
        className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200"
        title="Cloud Firestore 실시간 동기화 완료"
      >
        <CloudCheck className="h-3.5 w-3.5 text-emerald-600" />
        <span>☁️ 동기화됨</span>
      </span>
    );
  }

  if (syncStatus === 'syncing') {
    return (
      <span
        className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 border border-amber-200 animate-pulse"
        title="Firestore 동기화 중"
      >
        <RefreshCw className="h-3.5 w-3.5 text-amber-600 animate-spin" />
        <span>↻ 동기화 중</span>
      </span>
    );
  }

  if (syncStatus === 'offline') {
    return (
      <span
        className="flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-stone-600 border border-stone-200"
        title="오프라인 영속 캐시 사용 중"
      >
        <WifiOff className="h-3.5 w-3.5 text-stone-500" />
        <span>📴 오프라인</span>
      </span>
    );
  }

  if (syncStatus === 'error') {
    return (
      <span
        className="flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 border border-rose-200"
        title="클라우드 동기화 오류 발생"
      >
        <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
        <span>⚠️ 동기화 오류</span>
      </span>
    );
  }

  return null;
};
