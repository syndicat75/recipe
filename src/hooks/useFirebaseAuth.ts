/**
 * @file src/hooks/useFirebaseAuth.ts
 * @description Firebase Authentication 상태 관리 훅 (Google 로그인/로그아웃, 세션 감지, 온라인/오프라인 네트워크 감지 및 동기화 상태)
 * PC에서는 팝업 방식을 우선 사용하며, 모바일/PWA 환경 및 Vercel 프록시 호스팅 환경에 최적화된 인증 흐름을 제공합니다.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  User,
  AuthError,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseReady } from '../lib/firebase';
import { FirebaseAuthUser, SyncStatus } from '../types/firebase';
import { logger } from '../utils/logger';

/**
 * 모바일 디바이스 여부 감지
 */
export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

/**
 * 설치된 PWA(Standalone 모드) 여부 감지
 */
export const isPwaStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
  const isIosStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
  return Boolean(isStandaloneMedia || isIosStandalone);
};

/**
 * Firebase Auth 에러 코드를 사용자 친화적 한국어 메시지로 변환
 * @param error Firebase AuthError 또는 일반 에러 객체
 */
export function getFirebaseAuthErrorMessage(error: unknown): string {
  const authErr = error as AuthError;
  const code = authErr?.code || '';

  switch (code) {
    case 'auth/popup-blocked':
      return '브라우저가 Google 로그인 창을 차단했습니다. 팝업 차단을 해제해 주세요.';
    case 'auth/unauthorized-domain':
      return '현재 도메인이 Firebase Authentication에 승인되지 않았습니다.';
    case 'auth/popup-closed-by-user':
      return 'Google 로그인이 취소되었습니다.';
    case 'auth/network-request-failed':
      return '네트워크 연결을 확인해 주세요.';
    case 'auth/cancelled-popup-request':
      return '이전 로그인 요청이 취소되었습니다.';
    case 'auth/operation-not-allowed':
      return 'Firebase 콘솔에서 Google 로그인이 활성화되지 않았습니다.';
    case 'auth/user-disabled':
      return '해당 계정은 비활성화되었습니다.';
    default:
      return 'Google 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.';
  }
}

/**
 * useFirebaseAuth 반환 인터페이스
 */
export interface UseFirebaseAuthReturn {
  /** 현재 로그인된 사용자 정보 (미로그인 시 null) */
  user: FirebaseAuthUser | null;
  /** 인증 초기화 로딩 상태 */
  isLoading: boolean;
  /** 로그인 처리 진행 중 여부 (중복 클릭 방지용) */
  isLoggingIn: boolean;
  /** 현재 클라우드 동기화 상태 */
  syncStatus: SyncStatus;
  /** 동기화 상태 직접 설정 함수 */
  setSyncStatus: (status: SyncStatus) => void;
  /** Google 로그인 실행 */
  loginWithGoogle: (onErrorToast?: (msg: string) => void) => Promise<FirebaseAuthUser | null>;
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
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local-only');

  // 중복 로그인 호출 방지를 위한 Ref
  const isLoggingInRef = useRef<boolean>(false);

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

  // 2. Firebase Auth 상태 변화 구독 및 리다이렉트 결과 처리 (초기 1회 안전 실행)
  useEffect(() => {
    if (!auth || !isFirebaseReady) {
      logger.info(
        'useFirebaseAuth.init',
        'Firebase Auth가 활성화되지 않아 로컬 전용 모드로 시작합니다.'
      );
      setIsLoading(false);
      setSyncStatus('local-only');
      return;
    }

    logger.info('useFirebaseAuth.init', 'Firebase Auth 상태 리스너 등록');

    // 리다이렉트 로그인 결과 안전하게 처리 (getRedirectResult)
    getRedirectResult(auth)
      .then((result) => {
        if (result && result.user) {
          logger.info(
            'useFirebaseAuth.redirect',
            `리다이렉트 로그인 성공: ${result.user.displayName || result.user.email} (UID: ${result.user.uid})`
          );
        }
      })
      .catch((error: unknown) => {
        const err = error as AuthError;
        if (err && err.code !== 'auth/null-user') {
          console.error(
            'Firebase Google redirect result error:',
            err.code,
            err.message,
            err
          );
        }
      });

    // onAuthStateChanged 단일 진실 공급원
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      if (firebaseUser) {
        logger.info(
          'useFirebaseAuth.authChange',
          `로그인 감지: ${firebaseUser.displayName || firebaseUser.email} (UID: ${firebaseUser.uid})`
        );
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
   * 사용자 클릭 이벤트에서 직접 동기적으로 시작되며, 중복 클릭을 방지하고
   * 에러 발생 시 상세 로그 및 Toast 메시지를 지원합니다.
   */
  const loginWithGoogle = useCallback(
    async (onErrorToast?: (msg: string) => void): Promise<FirebaseAuthUser | null> => {
      logger.info('useFirebaseAuth.loginWithGoogle', 'Google 로그인 요청 시작');

      if (!auth || !googleProvider) {
        const errorMsg = 'Firebase 인증 설정이 구성되지 않았습니다.';
        logger.error('useFirebaseAuth.loginWithGoogle', errorMsg);
        if (onErrorToast) onErrorToast(errorMsg);
        return null;
      }

      // 중복 실행 방지 가드
      if (isLoggingInRef.current) {
        logger.warn('useFirebaseAuth.loginWithGoogle', '이미 로그인이 진행 중입니다.');
        return null;
      }

      isLoggingInRef.current = true;
      setIsLoggingIn(true);
      setSyncStatus('syncing');

      try {
        const isMobileOrPwa = isMobileDevice() || isPwaStandalone();

        if (isMobileOrPwa) {
          logger.info(
            'useFirebaseAuth.loginWithGoogle',
            '모바일/PWA 환경 감지: signInWithRedirect 실행'
          );
          await signInWithRedirect(auth, googleProvider);
          return null;
        }

        // PC 환경: signInWithPopup 직접 호출
        logger.info('useFirebaseAuth.loginWithGoogle', 'PC 환경: signInWithPopup 실행');
        const userCredential = await signInWithPopup(auth, googleProvider);
        const fbUser = userCredential.user;

        logger.info(
          'useFirebaseAuth.loginWithGoogle',
          `Google 팝업 로그인 성공: ${fbUser.displayName || fbUser.email}`
        );

        const loggedInUser: FirebaseAuthUser = {
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName,
          photoURL: fbUser.photoURL,
        };

        setUser(loggedInUser);
        setSyncStatus('synced');
        return loggedInUser;
      } catch (error: unknown) {
        const authErr = error as AuthError;

        // 콘솔에 Firebase Auth 실제 에러 상세 출력
        console.error(
          'Firebase Google login error:',
          authErr.code,
          authErr.message,
          authErr
        );

        const friendlyMessage = getFirebaseAuthErrorMessage(authErr);

        // 사용자가 단순히 창을 닫은 경우(popup-closed-by-user)나 취소인 경우 상태만 원상복구
        if (
          authErr.code === 'auth/popup-closed-by-user' ||
          authErr.code === 'auth/cancelled-popup-request'
        ) {
          logger.info('useFirebaseAuth.loginWithGoogle', '사용자에 의한 로그인 팝업 취소');
          setSyncStatus(user ? 'synced' : 'local-only');
          if (onErrorToast) onErrorToast(friendlyMessage);
          return null;
        }

        // auth/unauthorized-domain, auth/popup-blocked 등 모든 실제 오류를 Toast 및 상태에 즉시 반영
        if (onErrorToast) {
          onErrorToast(friendlyMessage);
        }
        setSyncStatus('error');
        return null;
      } finally {
        // 반드시 finally에서 로딩 플래그 해제 (버튼 영구 disabled 방지)
        isLoggingInRef.current = false;
        setIsLoggingIn(false);
      }
    },
    [user]
  );

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
      console.error('Firebase Logout error:', err);
      logger.error('useFirebaseAuth.logout', '로그아웃 오류', err);
      throw err;
    }
  }, []);

  return {
    user,
    isLoading,
    isLoggingIn,
    syncStatus,
    setSyncStatus,
    loginWithGoogle,
    logout,
    isFirebaseAvailable: isFirebaseReady,
    isOnline,
  };
}
