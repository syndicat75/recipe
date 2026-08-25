/**
 * @file src/lib/firebase.ts
 * @description Firebase Modular SDK v11 초기화 및 Firestore 오프라인 persistence, Google Auth 제공자 설정
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

// Default config from Firebase provisioning
import firebaseAppletConfig from '../../firebase-applet-config.json';

/**
 * Firebase 클라이언트 설정 인터페이스
 */
interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  firestoreDatabaseId?: string;
}

// Production Firebase configuration for my-recipe-1569b
const TARGET_PROJECT_ID = 'my-recipe-1569b';
const TARGET_AUTH_DOMAIN = 'my-recipe-1569b.firebaseapp.com';
const TARGET_STORAGE_BUCKET = 'my-recipe-1569b.firebasestorage.app';

/**
 * 환경변수 또는 firebase-applet-config.json에서 synd-e4600 잔여물이 유입되지 않도록 정제하는 헬퍼
 */
const resolveConfigValue = (
  envVal: string | undefined,
  jsonVal: string | undefined,
  fallback: string
): string => {
  if (envVal && !envVal.includes('synd-e4600') && !envVal.includes('synd-')) {
    return envVal;
  }
  if (jsonVal && !jsonVal.includes('synd-e4600') && !jsonVal.includes('synd-')) {
    return jsonVal;
  }
  return fallback;
};

const firebaseConfig: FirebaseConfig = {
  apiKey: resolveConfigValue(
    import.meta.env.VITE_FIREBASE_API_KEY,
    firebaseAppletConfig.apiKey,
    'AIzaSyDliA_DSfW0omzUgKcXWnAQQYfCsQMrXFM'
  ),
  authDomain: TARGET_AUTH_DOMAIN,
  projectId: TARGET_PROJECT_ID,
  storageBucket: TARGET_STORAGE_BUCKET,
  messagingSenderId: resolveConfigValue(
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    firebaseAppletConfig.messagingSenderId,
    '569327742394'
  ),
  appId: resolveConfigValue(
    import.meta.env.VITE_FIREBASE_APP_ID,
    firebaseAppletConfig.appId,
    '1:569327742394:web:2c4983c3a3dd41afa9c183'
  ),
  firestoreDatabaseId: '(default)',
};

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

    // 1. Auth 초기화 및 로컬 영속성 설정
    authInstance = getAuth(firebaseApp);
    setPersistence(authInstance, browserLocalPersistence).catch((err) => {
      logger.warn('Firebase.auth', `인증 영속성 설정 경고: ${err.message}`);
    });

    // 2. Google Auth Provider 설정
    googleAuthProvider = new GoogleAuthProvider();
    googleAuthProvider.setCustomParameters({
      prompt: 'select_account',
    });

    // 3. Firestore 오프라인 영속 캐시(persistentLocalCache) 활성화
    const dbId =
      firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
        ? firebaseConfig.firestoreDatabaseId
        : undefined;

    try {
      if (dbId) {
        dbInstance = initializeFirestore(
          firebaseApp,
          {
            localCache: persistentLocalCache({
              tabManager: persistentMultipleTabManager(),
            }),
          },
          dbId
        );
      } else {
        dbInstance = initializeFirestore(firebaseApp, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        });
      }
      logger.info('Firebase.firestore', `Firestore 영속성 캐시 활성화 완료 (Database: ${dbId || 'default'})`);
    } catch (fsInitErr) {
      logger.warn('Firebase.firestore', `기존 Firestore 인스턴스 연결 시도: ${(fsInitErr as Error).message}`);
      dbInstance = dbId ? getFirestore(firebaseApp, dbId) : getFirestore(firebaseApp);
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
