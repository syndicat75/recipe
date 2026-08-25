/**
 * @file src/hooks/useFirebaseAuth.ts
 * @description Firebase Authentication 상태 관리 훅 (Google 로그인/로그아웃, 세션 감지, 온라인/오프라인 네트워크 감지 및 동기화 상태)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  User,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseReady } from '../lib/firebase';
import { FirebaseAuthUser, SyncStatus } from '../types/firebase';
import { logger } from '../utils/logger';

/**
 * useFirebaseAuth 반환 인터페이스
 */
export interface UseFirebaseAuthReturn {
  /** 현재 로그인된 사용자 정보 (미로그인 시 null) */
  user: FirebaseAuthUser | null;
  /** 인증 로딩 상태 */
  isLoading: boolean;
  /** 현재 클라우드 동기화 상태 */
  syncStatus: SyncStatus;
  /** 동기화 상태 직접 설정 함수 */
  setSyncStatus: (status: SyncStatus) => void;
  /** Google 로그인 실행 (팝업 실패 시 리다이렉트 자동 대체) */
  loginWithGoogle: () => Promise<void>;
  /** 로그아웃 실행 */
  logout: () => Promise<void>;
  /** Firebase 환경 준비 여부 */
  isFirebaseAvailable: boolean;
  /** 온라인 연결 여부 */
  isOnline: boolean;
}

/**
 * Firebase 인증 및 네트워크 동기화 상태 커스텀 훅
 */
export function useFirebaseAuth(): UseFirebaseAuthReturn {
  const [user, setUser] = useState<FirebaseAuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local-only');

  // 1. 온라인 / 오프라인 네트워크 상태 감지
  useEffect(() => {
    const handleOnline = (): void => {
      logger.info('useFirebaseAuth.network', '네트워크 연결 복구 (Online)');
      setIsOnline(true);
      if (user) {
        setSyncStatus('synced');
      }
    };

    const handleOffline = (): void => {
      logger.warn('useFirebaseAuth.network', '네트워크 연결 끊김 (Offline)');
      setIsOnline(false);
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user]);

  // 2. Firebase Auth 상태 변화 구독 및 리다이렉트 결과 처리
  useEffect(() => {
    if (!auth || !isFirebaseReady) {
      logger.info('useFirebaseAuth.init', 'Firebase Auth가 활성화되지 않아 로컬 전용 모드로 시작합니다.');
      setIsLoading(false);
      setSyncStatus('local-only');
      return;
    }

    logger.info('useFirebaseAuth.init', 'Firebase Auth 상태 리스너 등록');

    // 리다이렉트 로그인 결과 확인
    getRedirectResult(auth)
      .then((result) => {
        if (result && result.user) {
          logger.info('useFirebaseAuth.redirect', `리다이렉트 로그인 성공: ${result.user.email}`);
        }
      })
      .catch((err) => {
        logger.error('useFirebaseAuth.redirect', `리다이렉트 로그인 확인 실패: ${err.message}`, err);
      });

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      if (firebaseUser) {
        logger.info('useFirebaseAuth.authChange', `로그인 감지: ${firebaseUser.displayName || firebaseUser.email} (UID: ${firebaseUser.uid})`);
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        });
        setSyncStatus(navigator.onLine ? 'synced' : 'offline');
      } else {
        logger.info('useFirebaseAuth.authChange', '로그아웃 감지 / 게스트 상태');
        setUser(null);
        setSyncStatus('local-only');
      }
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  /**
   * Google 로그인 핸들러
   */
  const loginWithGoogle = useCallback(async (): Promise<void> => {
    logger.info('useFirebaseAuth.loginWithGoogle', 'Google 로그인 요청');

    if (!auth || !googleProvider) {
      throw new Error('Firebase 인증 설정이 구성되지 않았습니다.');
    }

    try {
      setSyncStatus('syncing');
      // 1. Popup 시도
      await signInWithPopup(auth, googleProvider);
      logger.info('useFirebaseAuth.loginWithGoogle', 'Google 팝업 로그인 성공');
      setSyncStatus('synced');
    } catch (popupError: unknown) {
      const err = popupError as { code?: string; message?: string };
      logger.warn('useFirebaseAuth.loginWithGoogle', `팝업 로그인 실패 (${err.code}), 리다이렉트 방식으로 재시도합니다.`);

      // 팝업 차단 또는 제한 환경일 경우 리다이렉트로 fallback
      if (
        err.code === 'auth/popup-blocked' ||
        err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request'
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectError) {
          logger.error('useFirebaseAuth.loginWithGoogle', '리다이렉트 로그인 실패', redirectError);
          setSyncStatus('error');
          throw redirectError;
        }
      } else {
        setSyncStatus('error');
        throw popupError;
      }
    }
  }, []);

  /**
   * 로그아웃 핸들러
   */
  const logout = useCallback(async (): Promise<void> => {
    logger.info('useFirebaseAuth.logout', '로그아웃 요청');

    if (!auth) return;

    try {
      await signOut(auth);
      setUser(null);
      setSyncStatus('local-only');
      logger.info('useFirebaseAuth.logout', '로그아웃 완료');
    } catch (err) {
      logger.error('useFirebaseAuth.logout', '로그아웃 오류', err);
      throw err;
    }
  }, []);

  return {
    user,
    isLoading,
    syncStatus,
    setSyncStatus,
    loginWithGoogle,
    logout,
    isFirebaseAvailable: isFirebaseReady,
    isOnline,
  };
}
