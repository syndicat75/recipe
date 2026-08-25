/**
 * @file src/lib/firebase.ts
 * @description Firebase Modular SDK v11 초기화, my-recipe-1569b 프로젝트 전용 Named App ('my-recipe-client') 바인딩,
 * 실제 options 진단 로깅, Identity Toolkit Authorized Domains 진단, Firestore 오프라인 영속성 및 Google Auth 설정
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  Auth,
  browserLocalPersistence,
  setPersistence,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
} from 'firebase/firestore';
import { logger } from '../utils/logger';

/**
 * Firebase 클라이언트 설정 인터페이스
 */
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
}

/**
 * my-recipe-1569b 공식 Firebase 웹 앱 설정 (Source of Truth - 단일 진실 소스)
 * 이번 단계에서는 Vercel 환경변수나 외부 설정에 의해 override되지 않고
 * my-recipe-1569b 설정만을 고정하여 사용합니다.
 */
export const OFFICIAL_MY_RECIPE_CONFIG: FirebaseConfig = {
  apiKey: 'AIzaSyCWry-CZJFqqtGmgDgXpd-4ze5dIAx5Aa0',
  authDomain: 'my-recipe-1569b.firebaseapp.com',
  projectId: 'my-recipe-1569b',
  storageBucket: 'my-recipe-1569b.firebasestorage.app',
  messagingSenderId: '184041102640',
  appId: '1:184041102640:web:75c10f4c6a17b598337cf5',
  firestoreDatabaseId: '(default)',
};

/**
 * 클라이언트 설정 객체 (단일 Source of Truth)
 */
export const firebaseConfig: FirebaseConfig = OFFICIAL_MY_RECIPE_CONFIG;

/**
 * Firebase가 실제로 인식하고 있는 Authorized Domains를 조회하는 진단 함수
 * Identity Toolkit API를 통해 현재 API key에 바인딩된 승인 도메인 목록을 콘솔에 출력합니다.
 */
export async function diagnoseAuthorizedDomains(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects?key=${apiKey}`);
    if (!res.ok) {
      console.warn('[Firebase.diagnostic] Authorized Domains HTTP status:', res.status, res.statusText);
      return;
    }
    const data = await res.json();
    const authorizedDomains: string[] = data?.authorizedDomains || [];
    const currentHost = window.location.hostname;
    const isHostAuthorized = authorizedDomains.includes(currentHost);

    console.log('[Firebase.diagnostic] Firebase Identity Toolkit Authorized Domains:', {
      currentHostname: currentHost,
      isCurrentHostnameAuthorized: isHostAuthorized,
      authorizedDomains,
    });
  } catch (diagError) {
    console.warn('[Firebase.diagnostic] Authorized Domains check skipped:', diagError);
  }
}

/**
 * Named Firebase App 식별자
 * 다른 기본 [DEFAULT] 앱이나 외부 인스턴스와 격리하여 my-recipe-1569b 전용 앱을 보장합니다.
 */
export const FIREBASE_APP_NAME = 'my-recipe-client';

let firebaseApp: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let googleAuthProvider: GoogleAuthProvider | null = null;

try {
  // 1. Named App 인스턴스 검색 또는 신규 생성 (기존 [DEFAULT] 앱 재사용 금지)
  const existingApp = getApps().find((app) => app.name === FIREBASE_APP_NAME);
  if (existingApp) {
    firebaseApp = existingApp;
  } else {
    firebaseApp = initializeApp(OFFICIAL_MY_RECIPE_CONFIG, FIREBASE_APP_NAME);
  }

  // 2. 실제 생성된 firebaseApp.options 기반 진단 콘솔 출력
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : 'server';
  console.log('[Firebase.init] Firebase 앱 초기화:', {
    hostname: currentHostname,
    name: firebaseApp.name,
    projectId: firebaseApp.options.projectId,
    authDomain: firebaseApp.options.authDomain,
    messagingSenderId: firebaseApp.options.messagingSenderId,
    appId: firebaseApp.options.appId,
  });

  // 3. 백그라운드 Authorized Domains 진단 실행 (비차단)
  diagnoseAuthorizedDomains(OFFICIAL_MY_RECIPE_CONFIG.apiKey);

  // 4. Auth 초기화 및 브라우저 로컬 영속성 설정
  authInstance = getAuth(firebaseApp);
  setPersistence(authInstance, browserLocalPersistence).catch((err) => {
    logger.warn('Firebase.auth', `인증 영속성 설정 경고: ${err.message}`);
  });

  // 5. Google Auth Provider 설정
  googleAuthProvider = new GoogleAuthProvider();
  googleAuthProvider.setCustomParameters({
    prompt: 'select_account',
  });

  // 6. Firestore 오프라인 영속 캐시(persistentLocalCache) 활성화
  try {
    dbInstance = initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
    logger.info('Firebase.firestore', 'Firestore 영속성 캐시 활성화 완료 (Database: default)');
  } catch (fsInitErr) {
    logger.warn('Firebase.firestore', `기존 Firestore 인스턴스 연결 시도: ${(fsInitErr as Error).message}`);
    dbInstance = getFirestore(firebaseApp);
  }
} catch (error) {
  logger.error('Firebase.init', 'Firebase 초기화 실패, 로컬 전용 모드로 동작합니다.', error);
  firebaseApp = null;
  authInstance = null;
  dbInstance = null;
  googleAuthProvider = null;
}

export const app = firebaseApp;
export const auth = authInstance;
export const db = dbInstance;
export const googleProvider = googleAuthProvider;
export const isFirebaseReady: boolean = Boolean(firebaseApp && authInstance && dbInstance);

