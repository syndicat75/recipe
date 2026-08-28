/**
 * @file src/types/family.ts
 * @description Cloud Firestore 기반 다기기 실시간 가족 공유 시스템 전용 타입 정의
 */

import { MealSlot } from './recipe';

/**
 * 가족 공간 상태
 */
export type FamilySpaceStatus = 'active' | 'archived' | 'deleted';

/**
 * 가족 구성원 역할
 */
export type FamilyRole = 'owner' | 'member';

/**
 * Firestore /families/{familyId} 문서 인터페이스
 */
export interface FamilySpaceDoc {
  /** 가족 공간 고유 ID (문서 ID) */
  id: string;
  /** 가족 공간 이름 */
  name: string;
  /** 가족 공간 대표(방장)의 Firebase UID */
  ownerId: string;
  /** 고유 초대 코드 (예: FAM-8X2K9L) */
  inviteCode: string;
  /** 공간 상태 */
  status: FamilySpaceStatus;
  /** 생성 시각 (타임스탬프 ms) */
  createdAt: number;
  /** 최종 수정 시각 (타임스탬프 ms) */
  updatedAt: number;
}

/**
 * Firestore /families/{familyId}/members/{uid} 문서 인터페이스
 */
export interface FamilyMemberDoc {
  /** 구성원의 Firebase UID (문서 ID) */
  id: string;
  /** 구성원 표시 이름 / 닉네임 */
  name: string;
  /** 역할 ('owner' | 'member') */
  role: FamilyRole;
  /** 프로필 이모지 또는 아바타 */
  avatar: string;
  /** 참여 시각 (타임스탬프 ms) */
  joinedAt: number;
}

/**
 * Firestore /families/{familyId}/recipeRefs/{recipeId} 문서 인터페이스
 */
export interface FamilyRecipeRefDoc {
  /** 공유된 레시피 고유 ID (숫자) */
  recipeId: number;
  /** 공유를 등록한 사용자의 Firebase UID */
  addedByUid: string;
  /** 공유 등록 시각 (타임스탬프 ms) */
  addedAt: number;
}

/**
 * Firestore /families/{familyId}/mealPlanEntries/{entryId} 문서 인터페이스
 */
export interface FamilyMealPlanEntryDoc {
  /** 식단 항목 고유 ID (문서 ID) */
  id: string;
  /** 날짜 (YYYY-MM-DD) */
  date: string;
  /** 식사 시간대 ('breakfast' | 'lunch' | 'dinner' | 'snack') */
  slot: MealSlot;
  /** 레시피 ID */
  recipeId: number;
  /** 인분 수 */
  servings: number;
  /** 커스텀 메뉴 제목 (선택) */
  customTitle?: string;
  /** 등록한 사용자의 Firebase UID */
  addedByUid: string;
  /** 생성 시각 (타임스탬프 ms) */
  createdAt: number;
  /** 수정 시각 (타임스탬프 ms) */
  updatedAt: number;
}

/**
 * Firestore /families/{familyId}/shoppingItems/{itemId} 문서 인터페이스
 */
export interface FamilyShoppingItemDoc {
  /** 장보기 항목 고유 ID (문서 ID) */
  id: string;
  /** 장보기 항목 내용 */
  text: string;
  /** 출처 레시피 이름 (선택) */
  sourceRecipeName?: string;
  /** 완료(구매완료) 여부 */
  completed: boolean;
  /** 등록한 사용자의 Firebase UID */
  addedByUid: string;
  /** 생성 시각 (타임스탬프 ms) */
  createdAt: number;
  /** 수정 시각 (타임스탬프 ms) */
  updatedAt: number;
}

/**
 * Firestore /familyInvites/{inviteCode} 문서 인터페이스
 */
export interface FamilyInviteDoc {
  /** 초대 코드 (문서 ID, 예: FAM-8X2K9L) */
  inviteCode: string;
  /** 연결된 가족 공간 ID */
  familyId: string;
  /** 가족 공간 이름 */
  familyName: string;
  /** 방장 Firebase UID */
  ownerId: string;
  /** 초대 코드 활성화 여부 */
  active: boolean;
  /** 생성 시각 (타임스탬프 ms) */
  createdAt: number;
}

/**
 * Firestore /users/{uid}/familyProfile/profile 문서 인터페이스
 */
export interface UserFamilyProfileDoc {
  /** 사용자 이름 / 닉네임 */
  name: string;
  /** 프로필 아바타 / 이모지 */
  avatar: string;
  /** 현재 활성화된 가족 공간 ID (없으면 null) */
  currentFamilyId: string | null;
  /** 최종 갱신 시각 (타임스탬프 ms) */
  updatedAt: number;
}

/**
 * Firestore /users/{uid}/familyMemberships/{familyId} 문서 인터페이스
 */
export interface UserFamilyMembershipDoc {
  /** 참여 중인 가족 공간 ID (문서 ID) */
  familyId: string;
  /** 가족 공간 내 역할 ('owner' | 'member') */
  role: FamilyRole;
  /** 참여 시각 (타임스탬프 ms) */
  joinedAt: number;
}

/**
 * 가족 식단 및 장보기 모달 탭 상태
 */
export type FamilySharingTab = 'personal' | 'family';
