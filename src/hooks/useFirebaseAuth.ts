/**
 * @file src/hooks/useFirebaseAuth.ts
 * @description Firebase Authentication 상태 관리 훅 (Google 로그인/로그아웃, 세션 감지, 온라인/오프라인 네트워크 감지 및 동기화 상태)
 * PC 및 모바일/PWA 환경 모두에서 일관되게 signInWithPopup을 사용하여 즉각적인 인증 상태 갱신과 온디바이스 안정성을 제공합니다.
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
 * 모바일 디바이스 여부 감지 유틸리티 (필요 시 향후 확장을 위해 보존)
 */
export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

/**
 * 설치된 PWA(Standalone 모드) 여부 감지 유틸리티 (필요 시 향후 확장을 위해 보존)
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
      return 'Google 로그인 팝업이 차단되었습니다. 브라우저의 팝업 및 리디렉션을 허용한 뒤 다시 로그인해주세요.';
    case 'auth/popup-closed-by-user':
      return 'Google 로그인이 취소되었습니다.';
    case 'auth/unauthorized-domain':
      return '현재 도메인이 Firebase 인증에 승인되지 않았습니다.';
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
  /** Google 팝업 로그인 실행 (기본 signInWithPopup, popup-blocked 시 signInWithRedirect 자동 Fallback) */
  loginWithGoogle: (
    onErrorToast?: (msg: string) => void,
    onInfoToast?: (msg: string) => void
  ) => Promise<FirebaseAuthUser | null>;
  /** Google 리디렉션 로그인 실행 (팝업 차단 시 사용자 선택 폴백) */
  loginWithGoogleRedirect: () => Promise<void>;
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

  // 2. Firebase Auth 상태 변화 리스너 및 Redirect 결과 처리
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

    logger.info('useFirebaseAuth.init', 'Firebase onAuthStateChanged 및 getRedirectResult 리스너 등록');

    // 앱 초기화 시 getRedirectResult(auth)를 정확히 한 번 처리
    getRedirectResult(auth)
      .then((result) => {
        if (!result) return;
        const fbUser = result.user;
        logger.info(
          'useFirebaseAuth.redirectResult',
          `리디렉션 로그인 결과 수신: ${fbUser.displayName || fbUser.email} (UID: ${fbUser.uid})`
        );
        setUser({
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName,
          photoURL: fbUser.photoURL,
        });
        setSyncStatus('synced');
      })
      .catch((error) => {
        console.error('Firebase redirect login error:', error);
      });

    // onAuthStateChanged는 인증 상태의 최종 진실 공급원으로 유지
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
   * Google 로그인 핸들러 (기본: signInWithPopup, popup-blocked 시 signInWithRedirect 자동 Fallback)
   * 사용자 클릭 이벤트에서 직접 signInWithPopup을 호출하고
   * 브라우저 팝업 차단 발생 시 signInWithRedirect로 매끄럽게 자동 전환합니다.
   */
  const loginWithGoogle = useCallback(
    async (
      onErrorToast?: (msg: string) => void,
      onInfoToast?: (msg: string) => void
    ): Promise<FirebaseAuthUser | null> => {
      logger.info('useFirebaseAuth.loginWithGoogle', 'Google 로그인 요청 시작');

      if (!auth || !googleProvider) {
        const errorMsg = 'Firebase 인증 설정이 구성되지 않았습니다.';
        logger.error('useFirebaseAuth.loginWithGoogle', errorMsg);
        if (onErrorToast) onErrorToast(errorMsg);
        return null;
      }

      // 중복 실행 방지 가드 (Ref 및 State 동시 보호)
      if (isLoggingInRef.current) {
        logger.warn('useFirebaseAuth.loginWithGoogle', '이미 로그인이 진행 중입니다.');
        return null;
      }

      isLoggingInRef.current = true;
      setIsLoggingIn(true);
      setSyncStatus('syncing');

      try {
        // 1. 기본 방식: signInWithPopup 호출
        const userCredential = await signInWithPopup(auth, googleProvider);
        const fbUser = userCredential.user;

        // popup 완료 진단 로그 출력
        const maskedEmail = fbUser.email
          ? `${fbUser.email.slice(0, 3)}***@${fbUser.email.split('@')[1] || ''}`
          : 'N/A';
        console.log('[Firebase.auth] popup completed', {
          uid: fbUser.uid,
          email: maskedEmail,
          'auth.currentUser': Boolean(auth.currentUser),
        });

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
          authErr?.code,
          authErr?.message,
          authErr
        );

        // 1. 브라우저 팝업 차단(auth/popup-blocked) 감지 시 -> 자동 signInWithRedirect Fallback 실행
        if (authErr?.code === 'auth/popup-blocked') {
          logger.warn(
            'useFirebaseAuth.loginWithGoogle',
            '브라우저 팝업 차단 감지 (auth/popup-blocked) -> signInWithRedirect로 자동 전환'
          );
          const redirectNotice = '팝업 로그인이 차단되어 페이지 이동 방식으로 로그인합니다.';
          if (onInfoToast) {
            onInfoToast(redirectNotice);
          } else if (onErrorToast) {
            onErrorToast(redirectNotice);
          }

          try {
            await signInWithRedirect(auth, googleProvider);
            return null;
          } catch (redirectErr) {
            console.error('Firebase signInWithRedirect fallback error:', redirectErr);
            if (onErrorToast) {
              onErrorToast(getFirebaseAuthErrorMessage(redirectErr));
            }
            setSyncStatus(user ? 'synced' : 'error');
            return null;
          }
        }

        const friendlyMessage = getFirebaseAuthErrorMessage(authErr);

        // 2. 사용자가 단순히 창을 닫은 경우(popup-closed-by-user)나 취소인 경우 상태 원상복구 (리디렉션 안 함)
        if (
          authErr?.code === 'auth/popup-closed-by-user' ||
          authErr?.code === 'auth/cancelled-popup-request'
        ) {
          logger.info('useFirebaseAuth.loginWithGoogle', '사용자에 의한 로그인 팝업 취소');
          setSyncStatus(user ? 'synced' : 'local-only');
          if (onErrorToast) onErrorToast(friendlyMessage);
          return null;
        }

        // 3. 기타 인증 에러 (unauthorized-domain, network-request-failed 등은 리디렉션하지 않고 알림 표시)
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
   * Google 리디렉션 로그인 핸들러 (팝업 차단 시 사용자 선택 폴백)
   */
  const loginWithGoogleRedirect = useCallback(async (): Promise<void> => {
    logger.info('useFirebaseAuth.loginWithGoogleRedirect', 'Google 리디렉션 로그인 시작');
    if (!auth || !googleProvider) {
      logger.error('useFirebaseAuth.loginWithGoogleRedirect', 'Firebase 인증 미설정');
      return;
    }

    if (isLoggingInRef.current) return;
    isLoggingInRef.current = true;
    setIsLoggingIn(true);
    setSyncStatus('syncing');

    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (err) {
      console.error('Firebase signInWithRedirect error:', err);
      logger.error('useFirebaseAuth.loginWithGoogleRedirect', '리디렉션 로그인 실패', err);
      isLoggingInRef.current = false;
      setIsLoggingIn(false);
      setSyncStatus(user ? 'synced' : 'error');
    }
  }, [user]);

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
    loginWithGoogleRedirect,
    logout,
    isFirebaseAvailable: isFirebaseReady,
    isOnline,
  };
}
