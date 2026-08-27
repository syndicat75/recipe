/**
 * @file src/types/firebase.ts
 * @description Firebase Authentication 및 Cloud Firestore 동기화 관련 타입 정의
 */

import { Recipe, ShoppingItem } from './recipe';

/**
 * 실시간 클라우드 동기화 상태
 */
export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error' | 'local-only';

/**
 * 로그인한 Firebase 사용자 정보
 */
export interface FirebaseAuthUser {
  /** Firebase 고유 사용자 식별자 (UID) */
  uid: string;
  /** 사용자 이메일 주소 */
  email: string | null;
  /** 사용자 이름 */
  displayName: string | null;
  /** 사용자 프로필 사진 URL */
  photoURL: string | null;
}

/**
 * 클라우드에 저장된 데이터 통계 요약
 */
export interface CloudDataSummary {
  /** 클라우드 레시피 개수 */
  recipeCount: number;
  /** 클라우드 장보기 개수 */
  shoppingCount: number;
  /** 클라우드 즐겨찾기 개수 */
  bookmarkCount: number;
  /** 클라우드 개인 메모 개수 */
  noteCount: number;
  /** 최근 수정 일시 */
  lastUpdated?: number;
}

/**
 * 로컬 ↔ 클라우드 데이터 마이그레이션 모드
 */
export type MigrationMode = 'initial' | 'conflict' | 'admin_public';

/**
 * 마이그레이션 모달 상태 인터페이스
 */
export interface MigrationModalState {
  /** 모달 열림 여부 */
  isOpen: boolean;
  /** 마이그레이션 모드 ('initial': 로컬만 있고 클라우드 비어있음, 'conflict': 둘 다 존재) */
  mode: MigrationMode;
  /** 로컬 기기 레시피 개수 */
  localRecipeCount: number;
  /** 클라우드 레시피 개수 */
  cloudRecipeCount: number;
  /** 진행 중 로딩 상태 */
  isMigrating: boolean;
}

/**
 * Firestore 사용자 설정/메타데이터 문서 구조
 * 경로: users/{uid}/settings/data
 */
export interface UserSettingsDoc {
  /** 즐겨찾기 레시피 ID 목록 */
  bookmarks: number[];
  /** 개인 메모 맵 (레시피 ID -> 메모) */
  notes: Record<string, string>;
  /** 마이그레이션 완료 여부 */
  migrationCompleted: boolean;
  /** 마이그레이션 시점 타임스탬프 */
  migratedAt?: number;
  /** 최종 갱신 일시 */
  updatedAt: number;
}
