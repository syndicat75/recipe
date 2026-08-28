/**
 * @file src/hooks/useFamilySync.ts
 * @description Cloud Firestore 기반 가족 공유 공간 실시간 동기화 커스텀 훅
 * 
 * 주요 역할:
 * 1. Firebase 인증 사용자(user)에 따른 가족 프로필 및 멤버십 실시간 구독
 * 2. 현재 활성화된 가족 공간(activeFamily)의 공간 정보, 구성원, 공유 레시피 참조, 식단표, 장보기 실시간 구독
 * 3. 사용자 변경 및 가족 공간 전환 시 이전 리스너의 완벽한 해제 (메모리 누수 방지)
 * 4. 가족 공간 생성, 초대코드 참여, 레시피 공유/해제, 식단/장보기 CRUD, 권한 위임 등 전체 액션 제공
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User } from 'firebase/auth';
import { FirebaseAuthUser } from '../types/firebase';
import {
  FamilySpaceDoc,
  FamilyMemberDoc,
  FamilyRecipeRefDoc,
  FamilyMealPlanEntryDoc,
  FamilyShoppingItemDoc,
  UserFamilyProfileDoc,
  UserFamilyMembershipDoc,
} from '../types/family';
import { MealSlot } from '../types/recipe';
import {
  createFamilySpace,
  joinFamilyByInviteCode,
  subscribeToUserFamilyProfile,
  subscribeToUserMemberships,
  subscribeToFamilySpace,
  subscribeToFamilyMembers,
  subscribeToFamilyRecipeRefs,
  addRecipeToFamily,
  removeRecipeFromFamily,
  subscribeToFamilyMealPlan,
  saveFamilyMealPlanEntry,
  deleteFamilyMealPlanEntry,
  subscribeToFamilyShopping,
  saveFamilyShoppingItem,
  updateFamilyShoppingItem,
  deleteFamilyShoppingItem,
  leaveFamilySpace,
  transferFamilyOwnership,
  archiveFamilySpace,
  updateFamilyProfile,
} from '../services/familySync';
import { logger } from '../utils/logger';

/**
 * useFamilySync 훅 반환 인터페이스
 */
export interface UseFamilySyncReturn {
  /** 현재 사용자의 가족 프로필 문서 */
  familyProfile: UserFamilyProfileDoc | null;
  /** 현재 활성화된 가족 공간 문서 */
  activeFamily: FamilySpaceDoc | null;
  /** 현재 가족 공간의 구성원 목록 */
  members: FamilyMemberDoc[];
  /** 가족에게 공유된 레시피 ID 집합 (Set<number>) */
  sharedRecipeIds: Set<number>;
  /** 가족 주간 식단 항목 목록 */
  familyMealPlanEntries: FamilyMealPlanEntryDoc[];
  /** 가족 장보기 항목 목록 */
  familyShoppingItems: FamilyShoppingItemDoc[];
  /** 사용자가 가입된 가족 멤버십 목록 */
  userMemberships: UserFamilyMembershipDoc[];
  /** 현재 사용자가 활성 가족의 방장(owner)인지 여부 */
  isFamilyOwner: boolean;
  /** 가족 공간 동기화 중 여부 */
  isSyncing: boolean;
  /** 가족 동기화 에러 메시지 */
  syncError: string | null;
  /** 가족 생성 중 로딩 상태 */
  isCreating: boolean;
  /** 가족 참여 중 로딩 상태 */
  isJoining: boolean;
  /** 가족 나가기/삭제 처리 중 로딩 상태 */
  isLeaving: boolean;

  // 액션 메서드
  /** 신규 가족 공간 생성 */
  createFamily: (familyName: string, creatorAvatar?: string) => Promise<FamilySpaceDoc>;
  /** 초대 코드로 가족 공간 참여 */
  joinFamily: (inviteCode: string, userAvatar?: string) => Promise<{ familyId: string; familyName: string }>;
  /** 현재 가족 공간 나가기 */
  leaveFamily: () => Promise<void>;
  /** 레시피 가족 공유 등록 */
  shareRecipe: (recipeId: number) => Promise<void>;
  /** 레시피 가족 공유 해제 */
  unshareRecipe: (recipeId: number) => Promise<void>;
  /** 레시피 가족 공유 토글 */
  toggleShareRecipe: (recipeId: number) => Promise<boolean>;
  /** 가족 주간 식단 항목 저장 */
  addMealPlanEntry: (entry: {
    id?: string;
    date: string;
    slot: MealSlot;
    recipeId: number;
    servings: number;
    customTitle?: string;
  }) => Promise<string>;
  /** 가족 주간 식단 항목 삭제 */
  deleteMealPlanEntry: (entryId: string) => Promise<void>;
  /** 가족 장보기 항목 추가 */
  addShoppingItem: (text: string, sourceRecipeName?: string) => Promise<string>;
  /** 가족 장보기 완료 토글 */
  toggleShoppingItem: (itemId: string, currentCompleted: boolean) => Promise<void>;
  /** 가족 장보기 항목 삭제 */
  deleteShoppingItem: (itemId: string) => Promise<void>;
  /** 방장 권한 위임 */
  transferOwnership: (newOwnerUid: string) => Promise<void>;
  /** 가족 공간 보관/삭제 */
  deleteFamilySpace: () => Promise<void>;
  /** 사용자 가족 프로필 닉네임/아바타 갱신 */
  updateProfile: (name: string, avatar: string) => Promise<void>;
  /** 활성 가족 공간 전환 */
  switchActiveFamily: (familyId: string | null) => Promise<void>;
}

/**
 * Cloud Firestore 기반 가족 공간 실시간 동기화 커스텀 훅
 * 
 * @param user Firebase Authentication 현재 로그인 사용자 객체
 * @returns 가족 데이터 상태 및 조작 함수
 */
export function useFamilySync(user: FirebaseAuthUser | User | null): UseFamilySyncReturn {
  const [familyProfile, setFamilyProfile] = useState<UserFamilyProfileDoc | null>(null);
  const [activeFamily, setActiveFamily] = useState<FamilySpaceDoc | null>(null);
  const [members, setMembers] = useState<FamilyMemberDoc[]>([]);
  const [recipeRefs, setRecipeRefs] = useState<FamilyRecipeRefDoc[]>([]);
  const [familyMealPlanEntries, setFamilyMealPlanEntries] = useState<FamilyMealPlanEntryDoc[]>([]);
  const [familyShoppingItems, setFamilyShoppingItems] = useState<FamilyShoppingItemDoc[]>([]);
  const [userMemberships, setUserMemberships] = useState<UserFamilyMembershipDoc[]>([]);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [isLeaving, setIsLeaving] = useState<boolean>(false);

  const activeFamilyId = familyProfile?.currentFamilyId || null;

  // 1. 사용자 가족 프로필 및 멤버십 실시간 리스너
  useEffect(() => {
    if (!user) {
      logger.debug('useFamilySync', '비로그인 상태 - 가족 상태 초기화');
      setFamilyProfile(null);
      setActiveFamily(null);
      setMembers([]);
      setRecipeRefs([]);
      setFamilyMealPlanEntries([]);
      setFamilyShoppingItems([]);
      setUserMemberships([]);
      setSyncError(null);
      return;
    }

    logger.info('useFamilySync', `사용자 가족 프로필 리스너 등록: UID=${user.uid}`);
    setIsSyncing(true);

    const unsubProfile = subscribeToUserFamilyProfile(
      user.uid,
      (profile) => {
        setFamilyProfile(profile);
        setIsSyncing(false);
      },
      (err) => {
        logger.error('useFamilySync', '사용자 프로필 구독 에러', err);
        setSyncError('가족 프로필 동기화 중 오류가 발생했습니다.');
        setIsSyncing(false);
      }
    );

    const unsubMemberships = subscribeToUserMemberships(
      user.uid,
      (memberships) => {
        setUserMemberships(memberships);
      },
      (err) => {
        logger.error('useFamilySync', '멤버십 구독 에러', err);
      }
    );

    return () => {
      logger.debug('useFamilySync', `사용자 리스너 해제: UID=${user.uid}`);
      unsubProfile();
      unsubMemberships();
    };
  }, [user]);

  // 2. 활성 가족 공간(activeFamilyId) 변경 시 하위 컬렉션 실시간 리스너 등록 및 해제
  useEffect(() => {
    if (!user || !activeFamilyId) {
      setActiveFamily(null);
      setMembers([]);
      setRecipeRefs([]);
      setFamilyMealPlanEntries([]);
      setFamilyShoppingItems([]);
      return;
    }

    logger.info('useFamilySync', `활성 가족 공간 리스너 등록: FamilyId=${activeFamilyId}`);

    // (1) 가족 공간 정보 리스너
    const unsubFamily = subscribeToFamilySpace(
      activeFamilyId,
      (space) => {
        setActiveFamily(space);
        setSyncError(null);
      },
      (err) => {
        logger.error('useFamilySync', '가족 공간 정보 구독 에러', err);
        setSyncError('가족 공간 정보를 불러오지 못했습니다.');
      }
    );

    // (2) 구성원 목록 리스너
    const unsubMembers = subscribeToFamilyMembers(
      activeFamilyId,
      (memberList) => {
        setMembers(memberList);
      },
      (err) => {
        logger.error('useFamilySync', '구성원 목록 구독 에러', err);
      }
    );

    // (3) 공유 레시피 참조 리스너
    const unsubRecipeRefs = subscribeToFamilyRecipeRefs(
      activeFamilyId,
      (refs) => {
        setRecipeRefs(refs);
      },
      (err) => {
        logger.error('useFamilySync', '공유 레시피 참조 구독 에러', err);
      }
    );

    // (4) 주간 식단표 리스너
    const unsubMealPlan = subscribeToFamilyMealPlan(
      activeFamilyId,
      (entries) => {
        setFamilyMealPlanEntries(entries);
      },
      (err) => {
        logger.error('useFamilySync', '가족 식단 구독 에러', err);
      }
    );

    // (5) 장보기 항목 리스너
    const unsubShopping = subscribeToFamilyShopping(
      activeFamilyId,
      (items) => {
        setFamilyShoppingItems(items);
      },
      (err) => {
        logger.error('useFamilySync', '가족 장보기 구독 에러', err);
      }
    );

    return () => {
      logger.debug('useFamilySync', `가족 공간 리스너 일괄 해제: FamilyId=${activeFamilyId}`);
      unsubFamily();
      unsubMembers();
      unsubRecipeRefs();
      unsubMealPlan();
      unsubShopping();
    };
  }, [user, activeFamilyId]);

  // 공유 레시피 ID 집합 메모이제이션
  const sharedRecipeIds = useMemo(() => {
    return new Set(recipeRefs.map((r) => r.recipeId));
  }, [recipeRefs]);

  // 방장 여부 판별
  const isFamilyOwner = useMemo(() => {
    if (!user || !activeFamily) return false;
    return activeFamily.ownerId === user.uid;
  }, [user, activeFamily]);

  // === 액션 메서드 구현 ===

  /**
   * 신규 가족 공간 생성
   */
  const createFamily = useCallback(
    async (familyName: string, creatorAvatar: string = '👑'): Promise<FamilySpaceDoc> => {
      if (!user) throw new Error('로그인 후 이용해주세요.');
      setIsCreating(true);
      try {
        const creatorName = familyProfile?.name || user.displayName || user.email?.split('@')[0] || '가족 대표';
        const newSpace = await createFamilySpace(user.uid, creatorName, familyName, creatorAvatar);
        return newSpace;
      } finally {
        setIsCreating(false);
      }
    },
    [user, familyProfile]
  );

  /**
   * 초대 코드로 가족 공간 참여
   */
  const joinFamily = useCallback(
    async (inviteCode: string, userAvatar: string = '👤'): Promise<{ familyId: string; familyName: string }> => {
      if (!user) throw new Error('로그인 후 이용해주세요.');
      setIsJoining(true);
      try {
        const userName = familyProfile?.name || user.displayName || user.email?.split('@')[0] || '가족 구성원';
        const res = await joinFamilyByInviteCode(user.uid, userName, inviteCode, userAvatar);
        return res;
      } finally {
        setIsJoining(false);
      }
    },
    [user, familyProfile]
  );

  /**
   * 현재 가족 공간 나가기
   */
  const leaveFamily = useCallback(async (): Promise<void> => {
    if (!user || !activeFamilyId) throw new Error('참여 중인 가족 공간이 없습니다.');
    setIsLeaving(true);
    try {
      await leaveFamilySpace(activeFamilyId, user.uid);
    } finally {
      setIsLeaving(false);
    }
  }, [user, activeFamilyId]);

  /**
   * 레시피 가족 공유 등록
   */
  const shareRecipe = useCallback(
    async (recipeId: number): Promise<void> => {
      if (!user || !activeFamilyId) throw new Error('가족 공간에 먼저 참여해주세요.');
      await addRecipeToFamily(activeFamilyId, recipeId, user.uid);
    },
    [user, activeFamilyId]
  );

  /**
   * 레시피 가족 공유 해제
   */
  const unshareRecipe = useCallback(
    async (recipeId: number): Promise<void> => {
      if (!activeFamilyId) throw new Error('가족 공간에 참여 중이지 않습니다.');
      await removeRecipeFromFamily(activeFamilyId, recipeId);
    },
    [activeFamilyId]
  );

  /**
   * 레시피 가족 공유 토글
   */
  const toggleShareRecipe = useCallback(
    async (recipeId: number): Promise<boolean> => {
      if (!user || !activeFamilyId) throw new Error('가족 공간에 먼저 참여해주세요.');
      const isCurrentlyShared = sharedRecipeIds.has(recipeId);
      if (isCurrentlyShared) {
        await removeRecipeFromFamily(activeFamilyId, recipeId);
        return false;
      } else {
        await addRecipeToFamily(activeFamilyId, recipeId, user.uid);
        return true;
      }
    },
    [user, activeFamilyId, sharedRecipeIds]
  );

  /**
   * 가족 주간 식단 항목 저장
   */
  const addMealPlanEntry = useCallback(
    async (entry: {
      id?: string;
      date: string;
      slot: MealSlot;
      recipeId: number;
      servings: number;
      customTitle?: string;
    }): Promise<string> => {
      if (!user || !activeFamilyId) throw new Error('가족 공간에 참여 중이지 않습니다.');
      return await saveFamilyMealPlanEntry(activeFamilyId, entry, user.uid);
    },
    [user, activeFamilyId]
  );

  /**
   * 가족 주간 식단 항목 삭제
   */
  const deleteMealPlanEntry = useCallback(
    async (entryId: string): Promise<void> => {
      if (!activeFamilyId) throw new Error('가족 공간에 참여 중이지 않습니다.');
      await deleteFamilyMealPlanEntry(activeFamilyId, entryId);
    },
    [activeFamilyId]
  );

  /**
   * 가족 장보기 항목 추가
   */
  const addShoppingItem = useCallback(
    async (text: string, sourceRecipeName?: string): Promise<string> => {
      if (!user || !activeFamilyId) throw new Error('가족 공간에 참여 중이지 않습니다.');
      return await saveFamilyShoppingItem(activeFamilyId, { text, sourceRecipeName }, user.uid);
    },
    [user, activeFamilyId]
  );

  /**
   * 가족 장보기 완료 상태 토글
   */
  const toggleShoppingItem = useCallback(
    async (itemId: string, currentCompleted: boolean): Promise<void> => {
      if (!activeFamilyId) throw new Error('가족 공간에 참여 중이지 않습니다.');
      await updateFamilyShoppingItem(activeFamilyId, itemId, { completed: !currentCompleted });
    },
    [activeFamilyId]
  );

  /**
   * 가족 장보기 항목 삭제
   */
  const deleteShoppingItem = useCallback(
    async (itemId: string): Promise<void> => {
      if (!activeFamilyId) throw new Error('가족 공간에 참여 중이지 않습니다.');
      await deleteFamilyShoppingItem(activeFamilyId, itemId);
    },
    [activeFamilyId]
  );

  /**
   * 방장 권한 위임
   */
  const transferOwnership = useCallback(
    async (newOwnerUid: string): Promise<void> => {
      if (!user || !activeFamilyId || !isFamilyOwner) {
        throw new Error('가족 대표만 권한을 넘길 수 있습니다.');
      }
      await transferFamilyOwnership(activeFamilyId, user.uid, newOwnerUid);
    },
    [user, activeFamilyId, isFamilyOwner]
  );

  /**
   * 가족 공간 보관/삭제 (soft-delete)
   */
  const deleteFamilySpaceAction = useCallback(async (): Promise<void> => {
    if (!user || !activeFamily || !isFamilyOwner) {
      throw new Error('가족 대표만 공간을 삭제할 수 있습니다.');
    }
    setIsLeaving(true);
    try {
      await archiveFamilySpace(activeFamily.id, user.uid, activeFamily.inviteCode);
    } finally {
      setIsLeaving(false);
    }
  }, [user, activeFamily, isFamilyOwner]);

  /**
   * 사용자 가족 프로필 정보 갱신
   */
  const updateProfile = useCallback(
    async (name: string, avatar: string): Promise<void> => {
      if (!user) throw new Error('로그인 후 이용해주세요.');
      await updateFamilyProfile(user.uid, name, avatar, activeFamilyId);
    },
    [user, activeFamilyId]
  );

  /**
   * 활성 가족 공간 전환
   */
  const switchActiveFamily = useCallback(
    async (familyId: string | null): Promise<void> => {
      if (!user) return;
      const currentName = familyProfile?.name || user.displayName || '가족 구성원';
      const currentAvatar = familyProfile?.avatar || '👤';
      await updateFamilyProfile(user.uid, currentName, currentAvatar, familyId);
    },
    [user, familyProfile]
  );

  return {
    familyProfile,
    activeFamily,
    members,
    sharedRecipeIds,
    familyMealPlanEntries,
    familyShoppingItems,
    userMemberships,
    isFamilyOwner,
    isSyncing,
    syncError,
    isCreating,
    isJoining,
    isLeaving,
    createFamily,
    joinFamily,
    leaveFamily,
    shareRecipe,
    unshareRecipe,
    toggleShareRecipe,
    addMealPlanEntry,
    deleteMealPlanEntry,
    addShoppingItem,
    toggleShoppingItem,
    deleteShoppingItem,
    transferOwnership,
    deleteFamilySpace: deleteFamilySpaceAction,
    updateProfile,
    switchActiveFamily,
  };
}
