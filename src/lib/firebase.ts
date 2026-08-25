/**
 * @file src/lib/firebase.ts
 * @description Firebase Modular SDK v11 초기화, my-recipe-1569b 프로젝트 단일 진실 소스(Single Source of Truth) 바인딩,
 * Firestore 오프라인 영속성(persistentLocalCache) 및 Google Auth (signInWithPopup) 제공자 설정
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
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
import firebaseAppletConfig from '../../firebase-applet-config.json';

/**
 * Firebase 클라이언트 설정 인터페이스
 */
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  firestoreDatabaseId?: string;
}

/**
 * my-recipe-1569b 공식 Firebase 웹 앱 설정 (Source of Truth)
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
 * 이전 프로젝트(예: synd-e4600, 569327742394 등)의 오염된 환경변수를 방어하고
 * my-recipe-1569b 정규 설정값을 반환하는 헬퍼 함수
 * @param envValue VITE 환경변수 값
 * @param jsonValue firebase-applet-config.json 값
 * @param officialValue my-recipe-1569b 정규 설정값
 */
export function resolveSafeConfigValue(
  envValue: string | undefined,
  jsonValue: string | undefined,
  officialValue: string
): string {
  // 이전 프로젝트 식별자가 포함된 경우 무시하고 공식 설정값 적용
  const isContaminated = (val: string | undefined): boolean => {
    if (!val) return false;
    return (
      val.includes('synd-') ||
      val.includes('569327742394') ||
      val.includes('AIzaSyDliA') ||
      val.includes('2c4983c3a3dd41afa9c183')
    );
  };

  if (envValue && !isContaminated(envValue)) {
    return envValue;
  }
  if (jsonValue && !isContaminated(jsonValue)) {
    return jsonValue;
  }
  return officialValue;
}

/**
 * 최종 조합된 Firebase 클라이언트 설정
 */
export const firebaseConfig: FirebaseConfig = {
  apiKey: resolveSafeConfigValue(
    import.meta.env.VITE_FIREBASE_API_KEY,
    firebaseAppletConfig.apiKey,
    OFFICIAL_MY_RECIPE_CONFIG.apiKey
  ),
  authDomain: resolveSafeConfigValue(
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    firebaseAppletConfig.authDomain,
    OFFICIAL_MY_RECIPE_CONFIG.authDomain
  ),
  projectId: resolveSafeConfigValue(
    import.meta.env.VITE_FIREBASE_PROJECT_ID,
    firebaseAppletConfig.projectId,
    OFFICIAL_MY_RECIPE_CONFIG.projectId
  ),
  storageBucket: resolveSafeConfigValue(
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    firebaseAppletConfig.storageBucket,
    OFFICIAL_MY_RECIPE_CONFIG.storageBucket || ''
  ),
  messagingSenderId: resolveSafeConfigValue(
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    firebaseAppletConfig.messagingSenderId,
    OFFICIAL_MY_RECIPE_CONFIG.messagingSenderId || ''
  ),
  appId: resolveSafeConfigValue(
    import.meta.env.VITE_FIREBASE_APP_ID,
    firebaseAppletConfig.appId,
    OFFICIAL_MY_RECIPE_CONFIG.appId
  ),
  firestoreDatabaseId: '(default)',
};

/**
 * 앱 시작 시 설정 일관성 검증 로그 출력 (요구사항 3)
 */
export function logFirebaseConfigVerification(): void {
  const maskedApiKey = firebaseConfig.apiKey
    ? `${firebaseConfig.apiKey.slice(0, 6)}...${firebaseConfig.apiKey.slice(-4)}`
    : 'N/A';

  // 브라우저 개발자 도구에 정확한 설정값 출력
  console.log('[Firebase.init] Firebase 앱 초기화 (Project: my-recipe-1569b)');
  console.log('[Firebase.config] Configuration Verification:', {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId,
    apiKey: maskedApiKey,
  });
}

/**
 * Firebase 설정 유효성 검사
 */
export const isFirebaseConfigValid: boolean = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

let firebaseApp: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let googleAuthProvider: GoogleAuthProvider | null = null;

if (isFirebaseConfigValid) {
  try {
    logFirebaseConfigVerification();

    if (!getApps().length) {
      logger.info('Firebase.init', `Firebase 앱 초기화 (Project: ${firebaseConfig.projectId})`);
      firebaseApp = initializeApp({
        apiKey: firebaseConfig.apiKey,
        authDomain: firebaseConfig.authDomain,
        projectId: firebaseConfig.projectId,
        storageBucket: firebaseConfig.storageBucket,
        messagingSenderId: firebaseConfig.messagingSenderId,
        appId: firebaseConfig.appId,
      });
    } else {
      firebaseApp = getApp();
    }

    // 1. Auth 초기화 및 브라우저 로컬 영속성 설정
    authInstance = getAuth(firebaseApp);
    setPersistence(authInstance, browserLocalPersistence).catch((err) => {
      logger.warn('Firebase.auth', `인증 영속성 설정 경고: ${err.message}`);
    });

    // 2. Google Auth Provider 설정 (PC signInWithPopup 대응)
    googleAuthProvider = new GoogleAuthProvider();
    googleAuthProvider.setCustomParameters({
      prompt: 'select_account',
    });

    // 3. Firestore 오프라인 영속 캐시(persistentLocalCache) 활성화
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
} else {
  logger.warn('Firebase.init', 'Firebase 설정값이 비어있어 로컬 모드로 실행됩니다.');
}

export const app = firebaseApp;
export const auth = authInstance;
export const db = dbInstance;
export const googleProvider = googleAuthProvider;
export const isFirebaseReady: boolean = Boolean(firebaseApp && authInstance && dbInstance);
