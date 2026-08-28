/**
 * @file src/services/familySync.ts
 * @description Cloud Firestore 기반 가족 공유 공간(Family Space) 실시간 동기화 서비스
 * 
 * 주요 기능:
 * 1. 가족 공간 생성 (암호학적 난수 초대코드 생성, 트랜잭션 기반 중복 방지)
 * 2. 초대 코드를 통한 가족 공간 참여 및 초대 링크 지원
 * 3. 가족 공간 정보, 구성원, 공유 레시피 참조, 주간 식단, 장보기 실시간 구독 (onSnapshot)
 * 4. 가족 레시피 등록 및 해제 (공개 /recipes 문서를 훼손하지 않고 참조 키로 관리)
 * 5. 가족 주간 식단 및 장보기 아이템 CRUD (단일 문서 단위 안전 저장)
 * 6. 가족 나가기, 대표 권한 위임(Ownership Transfer), 가족 공간 안전 보관/삭제
 * 7. 사용자 가족 프로필 및 참여 멤버십 동기화
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  runTransaction,
  writeBatch,
  Unsubscribe,
  query,
  where,
} from 'firebase/firestore';
import { db, isFirebaseReady } from '../lib/firebase';
import {
  FamilySpaceDoc,
  FamilyMemberDoc,
  FamilyRecipeRefDoc,
  FamilyMealPlanEntryDoc,
  FamilyShoppingItemDoc,
  FamilyInviteDoc,
  UserFamilyProfileDoc,
  UserFamilyMembershipDoc,
} from '../types/family';
import { MealSlot } from '../types/recipe';
import { logger } from '../utils/logger';
import { removeUndefinedDeep } from '../utils/firestoreSanitizer';

/**
 * Firebase/Firestore 에러를 사용자 친화적인 한국어 안내 메시지로 변환합니다.
 * 
 * @param err 원본 에러 객체
 * @param defaultMessage 기본 대체 메시지
 * @returns 사용자에게 노출할 안전하고 친절한 한국어 안내 메시지
 */
export function formatFamilyError(err: any, defaultMessage: string = '가족 공간 처리 중 오류가 발생했습니다.'): string {
  logger.debug('familySync.formatFamilyError', '에러 메시지 변환 분석 시작', { code: err?.code, message: err?.message });
  const code = (err?.code || '').toLowerCase();
  const message = (err?.message || '').toLowerCase();

  if (
    code.includes('permission-denied') ||
    code.includes('permission_denied') ||
    message.includes('missing or insufficient permissions') ||
    message.includes('permission-denied') ||
    message.includes('permission_denied')
  ) {
    return '가족 공간 생성 권한이 없습니다.\nFirestore 가족 공유 보안 규칙이 적용되었는지 확인해주세요.';
  }

  if (
    code.includes('unauthenticated') ||
    code.includes('auth/') ||
    message.includes('unauthenticated') ||
    message.includes('로그인')
  ) {
    return '가족 공간을 만들려면 Google 로그인이 필요합니다.';
  }

  if (
    code.includes('unavailable') ||
    code.includes('network') ||
    message.includes('network') ||
    message.includes('offline') ||
    message.includes('failed to get document')
  ) {
    return '네트워크 연결을 확인한 후 다시 시도해주세요.';
  }

  return err?.message || defaultMessage;
}

/**
 * 암호학적으로 안전한 초대 코드(예: FAM-8X2K9L)를 생성합니다.
 * @returns 6자리 영문 대문자 + 숫자로 구성된 초대 코드 문자열
 */
export function generateSecureInviteCode(): string {
  logger.debug('familySync.generateSecureInviteCode', '초대 코드 생성 시작');
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 혼동하기 쉬운 0, 1, I, O 제외
  const length = 6;
  const array = new Uint8Array(length);

  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }

  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[array[i] % chars.length];
  }

  const result = `FAM-${code}`;
  logger.info('familySync.generateSecureInviteCode', `생성된 초대 코드: ${result}`);
  return result;
}

/**
 * 신규 가족 공간을 생성하고 생성자를 방장(owner)으로 등록합니다.
 * 트랜잭션을 통해 초대 코드 중복을 엄격히 검증하고 관련 문서를 원자적으로 생성합니다.
 * 
 * @param uid 생성자 Firebase UID
 * @param creatorName 생성자 표시 이름
 * @param familyName 가족 공간 이름
 * @param creatorAvatar 생성자 아바타 이모지 (기본값: '👑')
 * @returns 생성된 FamilySpaceDoc
 */
export async function createFamilySpace(
  uid: string,
  creatorName: string,
  familyName: string,
  creatorAvatar: string = '👑'
): Promise<FamilySpaceDoc> {
  logger.info('familySync.createFamilySpace', `가족 공간 생성 시도: "${familyName}" (UID: ${uid})`);

  if (!db || !isFirebaseReady) {
    throw new Error('Firestore에 연결되어 있지 않습니다. 잠시 후 다시 시도해주세요.');
  }
  if (!uid) {
    throw new Error('가족 공간을 만들려면 Google 로그인이 필요합니다.');
  }

  const trimmedName = familyName.trim();
  if (!trimmedName) {
    throw new Error('가족 공간 이름을 입력해주세요.');
  }

  const familyColRef = collection(db, 'families');
  const newFamilyDocRef = doc(familyColRef);
  const familyId = newFamilyDocRef.id;
  const now = Date.now();

  let inviteCode = generateSecureInviteCode();
  let attempts = 0;
  const maxAttempts = 5;

  // 트랜잭션을 통한 초대 코드 고유성 검증 및 일괄 문서 생성
  while (attempts < maxAttempts) {
    try {
      attempts++;
      const currentInviteCode = inviteCode;
      const inviteDocRef = doc(db, 'familyInvites', currentInviteCode);

      await runTransaction(db, async (transaction) => {
        const inviteSnap = await transaction.get(inviteDocRef);
        if (inviteSnap.exists()) {
          throw new Error('INVITE_CODE_COLLISION');
        }

        // 1. /families/{familyId} 생성
        const familyDocData: FamilySpaceDoc = {
          id: familyId,
          name: trimmedName,
          ownerId: uid,
          inviteCode: currentInviteCode,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        };
        transaction.set(newFamilyDocRef, removeUndefinedDeep(familyDocData));

        // 2. /families/{familyId}/members/{uid} 생성 (owner)
        const memberDocRef = doc(db, 'families', familyId, 'members', uid);
        const memberDocData: FamilyMemberDoc = {
          id: uid,
          name: creatorName || '가족 대표',
          role: 'owner',
          avatar: creatorAvatar,
          joinedAt: now,
        };
        transaction.set(memberDocRef, removeUndefinedDeep(memberDocData));

        // 3. /familyInvites/{inviteCode} 생성
        const inviteDocData: FamilyInviteDoc = {
          inviteCode: currentInviteCode,
          familyId: familyId,
          familyName: trimmedName,
          ownerId: uid,
          active: true,
          createdAt: now,
        };
        transaction.set(inviteDocRef, removeUndefinedDeep(inviteDocData));

        // 4. /users/{uid}/familyMemberships/{familyId} 생성
        const membershipDocRef = doc(db, 'users', uid, 'familyMemberships', familyId);
        const membershipData: UserFamilyMembershipDoc = {
          familyId: familyId,
          role: 'owner',
          joinedAt: now,
        };
        transaction.set(membershipDocRef, removeUndefinedDeep(membershipData));

        // 5. /users/{uid}/familyProfile/profile currentFamilyId 갱신
        const profileDocRef = doc(db, 'users', uid, 'familyProfile', 'profile');
        transaction.set(
          profileDocRef,
          removeUndefinedDeep({
            name: creatorName || '가족 대표',
            avatar: creatorAvatar,
            currentFamilyId: familyId,
            updatedAt: now,
          }),
          { merge: true }
        );
      });

      logger.info(
        'familySync.createFamilySpace',
        `가족 공간 생성 완료: ID=${familyId}, 초대코드=${currentInviteCode}`
      );

      return {
        id: familyId,
        name: trimmedName,
        ownerId: uid,
        inviteCode: currentInviteCode,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
    } catch (err: any) {
      if (err.message === 'INVITE_CODE_COLLISION') {
        logger.warn('familySync.createFamilySpace', `초대코드 충돌 감지 (${inviteCode}), 재시도 중 (${attempts}/${maxAttempts})`);
        inviteCode = generateSecureInviteCode();
        continue;
      }
      logger.error('familySync.createFamilySpace', '가족 공간 생성 트랜잭션 실패', err);
      const friendlyMessage = formatFamilyError(err, '가족 공간 생성에 실패했습니다.');
      throw new Error(friendlyMessage);
    }
  }

  throw new Error('초대 코드 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
}

/**
 * 초대 코드를 검증하고 해당 가족 공간에 구성원(member)으로 참여합니다.
 * 
 * @param uid 참여자 Firebase UID
 * @param userName 참여자 표시 이름
 * @param rawInviteCode 사용자가 입력한 초대 코드 문자열
 * @param userAvatar 참여자 아바타 이모지 (기본값: '👤')
 * @returns 참여한 가족 공간 정보
 */
export async function joinFamilyByInviteCode(
  uid: string,
  userName: string,
  rawInviteCode: string,
  userAvatar: string = '👤'
): Promise<{ familyId: string; familyName: string }> {
  const inviteCode = rawInviteCode.trim().toUpperCase();
  logger.info('familySync.joinFamilyByInviteCode', `가족 공간 참여 시도: 코드 "${inviteCode}" (UID: ${uid})`);

  if (!db || !isFirebaseReady) {
    throw new Error('Firestore에 연결되어 있지 않습니다. 잠시 후 다시 시도해주세요.');
  }
  if (!uid) {
    throw new Error('가족 공간을 만들려면 Google 로그인이 필요합니다.');
  }
  if (!inviteCode) {
    throw new Error('초대 코드를 입력해주세요.');
  }

  try {
    // 1. /familyInvites/{inviteCode} 조회
    const inviteDocRef = doc(db, 'familyInvites', inviteCode);
    const inviteSnap = await getDoc(inviteDocRef);

    if (!inviteSnap.exists()) {
      logger.warn('familySync.joinFamilyByInviteCode', `존재하지 않는 초대 코드: ${inviteCode}`);
      throw new Error('유효하지 않은 초대 코드입니다. 코드를 다시 확인해주세요.');
    }

    const inviteData = inviteSnap.data() as FamilyInviteDoc;
    if (!inviteData.active) {
      logger.warn('familySync.joinFamilyByInviteCode', `비활성화된 초대 코드: ${inviteCode}`);
      throw new Error('더 이상 사용할 수 없는 초대 코드입니다.');
    }

    const familyId = inviteData.familyId;
    const familyName = inviteData.familyName;

    // 2. 가족 공간 활성 상태 확인
    const familyDocRef = doc(db, 'families', familyId);
    const familySnap = await getDoc(familyDocRef);
    if (!familySnap.exists() || (familySnap.data() as FamilySpaceDoc).status === 'deleted') {
      throw new Error('해당 가족 공간을 찾을 수 없거나 이미 삭제되었습니다.');
    }

    const now = Date.now();
    const batch = writeBatch(db);

    // 3. /families/{familyId}/members/{uid} 추가 (기본 role: 'member')
    const memberDocRef = doc(db, 'families', familyId, 'members', uid);
    const memberSnap = await getDoc(memberDocRef);
    const existingRole = memberSnap.exists() ? (memberSnap.data() as FamilyMemberDoc).role : 'member';

    const memberData: FamilyMemberDoc = {
      id: uid,
      name: userName || '가족 구성원',
      role: existingRole,
      avatar: userAvatar,
      joinedAt: memberSnap.exists() ? (memberSnap.data() as FamilyMemberDoc).joinedAt : now,
    };
    batch.set(memberDocRef, removeUndefinedDeep(memberData), { merge: true });

    // 4. /users/{uid}/familyMemberships/{familyId} 추가
    const membershipDocRef = doc(db, 'users', uid, 'familyMemberships', familyId);
    const membershipData: UserFamilyMembershipDoc = {
      familyId: familyId,
      role: existingRole,
      joinedAt: now,
    };
    batch.set(membershipDocRef, removeUndefinedDeep(membershipData), { merge: true });

    // 5. /users/{uid}/familyProfile/profile currentFamilyId 갱신
    const profileDocRef = doc(db, 'users', uid, 'familyProfile', 'profile');
    batch.set(
      profileDocRef,
      removeUndefinedDeep({
        name: userName || '가족 구성원',
        avatar: userAvatar,
        currentFamilyId: familyId,
        updatedAt: now,
      }),
      { merge: true }
    );

    await batch.commit();
    logger.info('familySync.joinFamilyByInviteCode', `가족 공간 참여 성공: ${familyName} (${familyId})`);

    return {
      familyId,
      familyName,
    };
  } catch (err: any) {
    logger.error('familySync.joinFamilyByInviteCode', '가족 공간 참여 실패', err);
    const friendlyMessage = formatFamilyError(err, '가족 공간 참여에 실패했습니다.');
    throw new Error(friendlyMessage);
  }
}

/**
 * 사용자의 가족 프로필(/users/{uid}/familyProfile/profile) 실시간 구독
 * 
 * @param uid 사용자 Firebase UID
 * @param onUpdate 갱신 콜백
 * @param onError 에러 콜백
 * @returns 구독 해제 함수 (Unsubscribe)
 */
export function subscribeToUserFamilyProfile(
  uid: string,
  onUpdate: (profile: UserFamilyProfileDoc | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  logger.debug('familySync.subscribeToUserFamilyProfile', `사용자 가족 프로필 리스너 등록 (UID: ${uid})`);

  if (!db || !isFirebaseReady || !uid) {
    onUpdate(null);
    return () => {};
  }

  const profileDocRef = doc(db, 'users', uid, 'familyProfile', 'profile');
  return onSnapshot(
    profileDocRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UserFamilyProfileDoc;
        logger.debug('familySync.subscribeToUserFamilyProfile', `프로필 갱신: currentFamilyId=${data.currentFamilyId}`);
        onUpdate(data);
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      logger.error('familySync.subscribeToUserFamilyProfile', '프로필 구독 에러', err);
      if (onError) onError(err);
    }
  );
}

/**
 * 사용자가 참여 중인 가족 공간 목록(/users/{uid}/familyMemberships) 실시간 구독
 * 
 * @param uid 사용자 Firebase UID
 * @param onUpdate 갱신 콜백
 * @param onError 에러 콜백
 * @returns 구독 해제 함수 (Unsubscribe)
 */
export function subscribeToUserMemberships(
  uid: string,
  onUpdate: (memberships: UserFamilyMembershipDoc[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  logger.debug('familySync.subscribeToUserMemberships', `사용자 멤버십 리스너 등록 (UID: ${uid})`);

  if (!db || !isFirebaseReady || !uid) {
    onUpdate([]);
    return () => {};
  }

  const membershipColRef = collection(db, 'users', uid, 'familyMemberships');
  return onSnapshot(
    membershipColRef,
    (snap) => {
      const list: UserFamilyMembershipDoc[] = snap.docs.map((d) => d.data() as UserFamilyMembershipDoc);
      logger.debug('familySync.subscribeToUserMemberships', `멤버십 수신: ${list.length}개`);
      onUpdate(list);
    },
    (err) => {
      logger.error('familySync.subscribeToUserMemberships', '멤버십 구독 에러', err);
      if (onError) onError(err);
    }
  );
}

/**
 * 특정 가족 공간(/families/{familyId}) 정보 실시간 구독
 * 
 * @param familyId 가족 공간 ID
 * @param onUpdate 갱신 콜백
 * @param onError 에러 콜백
 * @returns 구독 해제 함수 (Unsubscribe)
 */
export function subscribeToFamilySpace(
  familyId: string,
  onUpdate: (space: FamilySpaceDoc | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  logger.debug('familySync.subscribeToFamilySpace', `가족 공간 리스너 등록 (FamilyId: ${familyId})`);

  if (!db || !isFirebaseReady || !familyId) {
    onUpdate(null);
    return () => {};
  }

  const docRef = doc(db, 'families', familyId);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as FamilySpaceDoc;
        if (data.status === 'deleted') {
          logger.warn('familySync.subscribeToFamilySpace', `삭제된 가족 공간 감지: ${familyId}`);
          onUpdate(null);
        } else {
          onUpdate(data);
        }
      } else {
        logger.warn('familySync.subscribeToFamilySpace', `존재하지 않는 가족 공간: ${familyId}`);
        onUpdate(null);
      }
    },
    (err) => {
      logger.error('familySync.subscribeToFamilySpace', '가족 공간 구독 에러', err);
      if (onError) onError(err);
    }
  );
}

/**
 * 가족 구성원 목록(/families/{familyId}/members) 실시간 구독
 * 
 * @param familyId 가족 공간 ID
 * @param onUpdate 갱신 콜백
 * @param onError 에러 콜백
 * @returns 구독 해제 함수 (Unsubscribe)
 */
export function subscribeToFamilyMembers(
  familyId: string,
  onUpdate: (members: FamilyMemberDoc[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  logger.debug('familySync.subscribeToFamilyMembers', `가족 구성원 리스너 등록 (FamilyId: ${familyId})`);

  if (!db || !isFirebaseReady || !familyId) {
    onUpdate([]);
    return () => {};
  }

  const colRef = collection(db, 'families', familyId, 'members');
  return onSnapshot(
    colRef,
    (snap) => {
      const members: FamilyMemberDoc[] = snap.docs.map((d) => d.data() as FamilyMemberDoc);
      // owner 먼저, 이후 가입일 순 정렬
      members.sort((a, b) => {
        if (a.role === 'owner') return -1;
        if (b.role === 'owner') return 1;
        return a.joinedAt - b.joinedAt;
      });
      logger.debug('familySync.subscribeToFamilyMembers', `가족 구성원 수신: ${members.length}명`);
      onUpdate(members);
    },
    (err) => {
      logger.error('familySync.subscribeToFamilyMembers', '가족 구성원 구독 에러', err);
      if (onError) onError(err);
    }
  );
}

/**
 * 가족 공유 레시피 참조 목록(/families/{familyId}/recipeRefs) 실시간 구독
 * 
 * @param familyId 가족 공간 ID
 * @param onUpdate 갱신 콜백 (공유된 레시피 ID 목록)
 * @param onError 에러 콜백
 * @returns 구독 해제 함수 (Unsubscribe)
 */
export function subscribeToFamilyRecipeRefs(
  familyId: string,
  onUpdate: (recipeRefs: FamilyRecipeRefDoc[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  logger.debug('familySync.subscribeToFamilyRecipeRefs', `가족 공유 레시피 참조 리스너 등록 (FamilyId: ${familyId})`);

  if (!db || !isFirebaseReady || !familyId) {
    onUpdate([]);
    return () => {};
  }

  const colRef = collection(db, 'families', familyId, 'recipeRefs');
  return onSnapshot(
    colRef,
    (snap) => {
      const refs: FamilyRecipeRefDoc[] = snap.docs.map((d) => d.data() as FamilyRecipeRefDoc);
      logger.debug('familySync.subscribeToFamilyRecipeRefs', `공유 레시피 참조 수신: ${refs.length}개`);
      onUpdate(refs);
    },
    (err) => {
      logger.error('familySync.subscribeToFamilyRecipeRefs', '공유 레시피 참조 구독 에러', err);
      if (onError) onError(err);
    }
  );
}

/**
 * 특정 레시피를 가족 공간에 공유 등록합니다.
 * 공개 레시피 원본 문서를 수정하지 않고 오직 /families/{familyId}/recipeRefs/{recipeId}에 등록합니다.
 * 
 * @param familyId 가족 공간 ID
 * @param recipeId 레시피 ID (숫자)
 * @param uid 등록자 Firebase UID
 */
export async function addRecipeToFamily(familyId: string, recipeId: number, uid: string): Promise<void> {
  logger.info('familySync.addRecipeToFamily', `가족 레시피 공유 등록: Recipe ${recipeId} -> Family ${familyId}`);

  if (!db || !isFirebaseReady) {
    throw new Error('Firestore에 연결되어 있지 않습니다.');
  }

  const docRef = doc(db, 'families', familyId, 'recipeRefs', String(recipeId));
  const data: FamilyRecipeRefDoc = {
    recipeId,
    addedByUid: uid,
    addedAt: Date.now(),
  };

  await setDoc(docRef, data, { merge: true });
  logger.info('familySync.addRecipeToFamily', `레시피 ${recipeId} 공유 완료`);
}

/**
 * 특정 레시피의 가족 공간 공유를 해제합니다.
 * 
 * @param familyId 가족 공간 ID
 * @param recipeId 레시피 ID (숫자)
 */
export async function removeRecipeFromFamily(familyId: string, recipeId: number): Promise<void> {
  logger.info('familySync.removeRecipeFromFamily', `가족 레시피 공유 해제: Recipe ${recipeId} from Family ${familyId}`);

  if (!db || !isFirebaseReady) {
    throw new Error('Firestore에 연결되어 있지 않습니다.');
  }

  const docRef = doc(db, 'families', familyId, 'recipeRefs', String(recipeId));
  await deleteDoc(docRef);
  logger.info('familySync.removeRecipeFromFamily', `레시피 ${recipeId} 공유 해제 완료`);
}

/**
 * 가족 주간 식단 항목 목록(/families/{familyId}/mealPlanEntries) 실시간 구독
 * 
 * @param familyId 가족 공간 ID
 * @param onUpdate 갱신 콜백
 * @param onError 에러 콜백
 * @returns 구독 해제 함수 (Unsubscribe)
 */
export function subscribeToFamilyMealPlan(
  familyId: string,
  onUpdate: (entries: FamilyMealPlanEntryDoc[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  logger.debug('familySync.subscribeToFamilyMealPlan', `가족 식단 리스너 등록 (FamilyId: ${familyId})`);

  if (!db || !isFirebaseReady || !familyId) {
    onUpdate([]);
    return () => {};
  }

  const colRef = collection(db, 'families', familyId, 'mealPlanEntries');
  return onSnapshot(
    colRef,
    (snap) => {
      const entries: FamilyMealPlanEntryDoc[] = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as FamilyMealPlanEntryDoc[];
      logger.debug('familySync.subscribeToFamilyMealPlan', `가족 식단 항목 수신: ${entries.length}개`);
      onUpdate(entries);
    },
    (err) => {
      logger.error('familySync.subscribeToFamilyMealPlan', '가족 식단 구독 에러', err);
      if (onError) onError(err);
    }
  );
}

/**
 * 가족 주간 식단 항목을 생성 또는 갱신합니다.
 * 
 * @param familyId 가족 공간 ID
 * @param entry 식단 데이터 객체
 * @param uid 등록자 Firebase UID
 */
export async function saveFamilyMealPlanEntry(
  familyId: string,
  entry: {
    id?: string;
    date: string;
    slot: MealSlot;
    recipeId: number;
    servings: number;
    customTitle?: string;
  },
  uid: string
): Promise<string> {
  logger.info('familySync.saveFamilyMealPlanEntry', `가족 식단 항목 저장: ${entry.date} ${entry.slot} (Family: ${familyId})`);

  if (!db || !isFirebaseReady) {
    throw new Error('Firestore에 연결되어 있지 않습니다.');
  }

  const colRef = collection(db, 'families', familyId, 'mealPlanEntries');
  const docRef = entry.id ? doc(colRef, entry.id) : doc(colRef);
  const now = Date.now();

  const data: FamilyMealPlanEntryDoc = {
    id: docRef.id,
    date: entry.date,
    slot: entry.slot,
    recipeId: entry.recipeId,
    servings: entry.servings || 2,
    customTitle: entry.customTitle || '',
    addedByUid: uid,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(docRef, removeUndefinedDeep(data), { merge: true });
  logger.info('familySync.saveFamilyMealPlanEntry', `가족 식단 항목 저장 완료 (ID: ${docRef.id})`);
  return docRef.id;
}

/**
 * 가족 주간 식단 항목을 삭제합니다.
 * 
 * @param familyId 가족 공간 ID
 * @param entryId 식단 항목 ID
 */
export async function deleteFamilyMealPlanEntry(familyId: string, entryId: string): Promise<void> {
  logger.info('familySync.deleteFamilyMealPlanEntry', `가족 식단 항목 삭제: ${entryId} (Family: ${familyId})`);

  if (!db || !isFirebaseReady) {
    throw new Error('Firestore에 연결되어 있지 않습니다.');
  }

  const docRef = doc(db, 'families', familyId, 'mealPlanEntries', entryId);
  await deleteDoc(docRef);
  logger.info('familySync.deleteFamilyMealPlanEntry', `가족 식단 항목 삭제 완료 (ID: ${entryId})`);
}

/**
 * 가족 장보기 항목 목록(/families/{familyId}/shoppingItems) 실시간 구독
 * 
 * @param familyId 가족 공간 ID
 * @param onUpdate 갱신 콜백
 * @param onError 에러 콜백
 * @returns 구독 해제 함수 (Unsubscribe)
 */
export function subscribeToFamilyShopping(
  familyId: string,
  onUpdate: (items: FamilyShoppingItemDoc[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  logger.debug('familySync.subscribeToFamilyShopping', `가족 장보기 리스너 등록 (FamilyId: ${familyId})`);

  if (!db || !isFirebaseReady || !familyId) {
    onUpdate([]);
    return () => {};
  }

  const colRef = collection(db, 'families', familyId, 'shoppingItems');
  return onSnapshot(
    colRef,
    (snap) => {
      const items: FamilyShoppingItemDoc[] = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as FamilyShoppingItemDoc[];
      // 생성일 순 정렬
      items.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      logger.debug('familySync.subscribeToFamilyShopping', `가족 장보기 수신: ${items.length}개`);
      onUpdate(items);
    },
    (err) => {
      logger.error('familySync.subscribeToFamilyShopping', '가족 장보기 구독 에러', err);
      if (onError) onError(err);
    }
  );
}

/**
 * 가족 장보기 항목을 추가합니다.
 * 
 * @param familyId 가족 공간 ID
 * @param item 장보기 텍스트 및 출처 레시피
 * @param uid 등록자 Firebase UID
 */
export async function saveFamilyShoppingItem(
  familyId: string,
  item: {
    text: string;
    sourceRecipeName?: string;
    completed?: boolean;
  },
  uid: string
): Promise<string> {
  logger.info('familySync.saveFamilyShoppingItem', `가족 장보기 추가: "${item.text}" (Family: ${familyId})`);

  if (!db || !isFirebaseReady) {
    throw new Error('Firestore에 연결되어 있지 않습니다.');
  }

  const trimmed = item.text.trim();
  if (!trimmed) {
    throw new Error('장보기 내용을 입력해주세요.');
  }

  const colRef = collection(db, 'families', familyId, 'shoppingItems');
  const docRef = doc(colRef);
  const now = Date.now();

  const data: FamilyShoppingItemDoc = {
    id: docRef.id,
    text: trimmed,
    sourceRecipeName: item.sourceRecipeName || '',
    completed: Boolean(item.completed),
    addedByUid: uid,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(docRef, removeUndefinedDeep(data));
  logger.info('familySync.saveFamilyShoppingItem', `가족 장보기 추가 완료 (ID: ${docRef.id})`);
  return docRef.id;
}

/**
 * 가족 장보기 항목의 완료 여부 또는 내용을 갱신합니다.
 * 
 * @param familyId 가족 공간 ID
 * @param itemId 장보기 아이템 ID
 * @param updates 갱신 필드
 */
export async function updateFamilyShoppingItem(
  familyId: string,
  itemId: string,
  updates: Partial<Pick<FamilyShoppingItemDoc, 'completed' | 'text'>>
): Promise<void> {
  logger.info('familySync.updateFamilyShoppingItem', `가족 장보기 수정: ${itemId} (Family: ${familyId})`);

  if (!db || !isFirebaseReady) {
    throw new Error('Firestore에 연결되어 있지 않습니다.');
  }

  const docRef = doc(db, 'families', familyId, 'shoppingItems', itemId);
  await updateDoc(docRef, removeUndefinedDeep({
    ...updates,
    updatedAt: Date.now(),
  }));
  logger.info('familySync.updateFamilyShoppingItem', `가족 장보기 수정 완료: ${itemId}`);
}

/**
 * 가족 장보기 항목을 삭제합니다.
 * 
 * @param familyId 가족 공간 ID
 * @param itemId 장보기 아이템 ID
 */
export async function deleteFamilyShoppingItem(familyId: string, itemId: string): Promise<void> {
  logger.info('familySync.deleteFamilyShoppingItem', `가족 장보기 삭제: ${itemId} (Family: ${familyId})`);

  if (!db || !isFirebaseReady) {
    throw new Error('Firestore에 연결되어 있지 않습니다.');
  }

  const docRef = doc(db, 'families', familyId, 'shoppingItems', itemId);
  await deleteDoc(docRef);
  logger.info('familySync.deleteFamilyShoppingItem', `가족 장보기 삭제 완료: ${itemId}`);
}

/**
 * 가족 구성원이 공간을 탈퇴(나가기)합니다.
 * 
 * @param familyId 가족 공간 ID
 * @param uid 나가는 사용자 Firebase UID
 */
export async function leaveFamilySpace(familyId: string, uid: string): Promise<void> {
  logger.info('familySync.leaveFamilySpace', `가족 공간 나가기: UID ${uid} from Family ${familyId}`);

  if (!db || !isFirebaseReady) {
    throw new Error('Firestore에 연결되어 있지 않습니다.');
  }

  const batch = writeBatch(db);

  // 1. /families/{familyId}/members/{uid} 삭제
  const memberDocRef = doc(db, 'families', familyId, 'members', uid);
  batch.delete(memberDocRef);

  // 2. /users/{uid}/familyMemberships/{familyId} 삭제
  const membershipDocRef = doc(db, 'users', uid, 'familyMemberships', familyId);
  batch.delete(membershipDocRef);

  // 3. /users/{uid}/familyProfile/profile currentFamilyId null 설정
  const profileDocRef = doc(db, 'users', uid, 'familyProfile', 'profile');
  batch.set(
    profileDocRef,
    {
      currentFamilyId: null,
      updatedAt: Date.now(),
    },
    { merge: true }
  );

  await batch.commit();
  logger.info('familySync.leaveFamilySpace', `가족 공간 나가기 완료 (UID: ${uid})`);
}

/**
 * 가족 대표(owner) 권한을 다른 구성원에게 위임(양도)합니다.
 * 트랜잭션을 통해 families.ownerId 변경, 이전 owner role='member', 새 owner role='owner'를 원자적으로 처리합니다.
 * 
 * @param familyId 가족 공간 ID
 * @param currentOwnerUid 현재 방장 UID
 * @param newOwnerUid 새 방장으로 지정할 구성원 UID
 */
export async function transferFamilyOwnership(
  familyId: string,
  currentOwnerUid: string,
  newOwnerUid: string
): Promise<void> {
  logger.info(
    'familySync.transferFamilyOwnership',
    `대표 권한 위임: ${currentOwnerUid} -> ${newOwnerUid} (Family: ${familyId})`
  );

  if (!db || !isFirebaseReady) {
    throw new Error('Firestore에 연결되어 있지 않습니다.');
  }

  const familyDocRef = doc(db, 'families', familyId);
  const oldOwnerMemberRef = doc(db, 'families', familyId, 'members', currentOwnerUid);
  const newOwnerMemberRef = doc(db, 'families', familyId, 'members', newOwnerUid);
  const oldOwnerMembershipRef = doc(db, 'users', currentOwnerUid, 'familyMemberships', familyId);
  const newOwnerMembershipRef = doc(db, 'users', newOwnerUid, 'familyMemberships', familyId);

  await runTransaction(db, async (transaction) => {
    const familySnap = await transaction.get(familyDocRef);
    if (!familySnap.exists()) {
      throw new Error('가족 공간이 존재하지 않습니다.');
    }
    const familyData = familySnap.data() as FamilySpaceDoc;
    if (familyData.ownerId !== currentOwnerUid) {
      throw new Error('가족 대표만 권한을 위임할 수 있습니다.');
    }

    const newOwnerMemberSnap = await transaction.get(newOwnerMemberRef);
    if (!newOwnerMemberSnap.exists()) {
      throw new Error('새 대표로 지정할 구성원이 가족 공간에 존재하지 않습니다.');
    }

    const now = Date.now();

    // 1. families/{familyId} ownerId 갱신
    transaction.update(familyDocRef, {
      ownerId: newOwnerUid,
      updatedAt: now,
    });

    // 2. 이전 owner의 role을 'member'로 변경
    transaction.update(oldOwnerMemberRef, { role: 'member' });
    transaction.set(oldOwnerMembershipRef, { role: 'member' }, { merge: true });

    // 3. 새 owner의 role을 'owner'로 변경
    transaction.update(newOwnerMemberRef, { role: 'owner' });
    transaction.set(newOwnerMembershipRef, { role: 'owner' }, { merge: true });
  });

  logger.info('familySync.transferFamilyOwnership', '대표 권한 위임 완료');
}

/**
 * 가족 공간을 보관/삭제(soft-delete) 처리합니다.
 * status를 'deleted'로 전환하고 초대 코드를 비활성화합니다.
 * 
 * @param familyId 가족 공간 ID
 * @param ownerUid 방장 Firebase UID
 * @param inviteCode 비활성화할 초대 코드
 */
export async function archiveFamilySpace(familyId: string, ownerUid: string, inviteCode: string): Promise<void> {
  logger.info('familySync.archiveFamilySpace', `가족 공간 삭제 처리: Family ${familyId} (Owner: ${ownerUid})`);

  if (!db || !isFirebaseReady) {
    throw new Error('Firestore에 연결되어 있지 않습니다.');
  }

  const batch = writeBatch(db);

  // 1. /families/{familyId} 상태 deleted 변경
  const familyDocRef = doc(db, 'families', familyId);
  batch.update(familyDocRef, {
    status: 'deleted',
    updatedAt: Date.now(),
  });

  // 2. /familyInvites/{inviteCode} 비활성화
  if (inviteCode) {
    const inviteDocRef = doc(db, 'familyInvites', inviteCode);
    batch.update(inviteDocRef, {
      active: false,
    });
  }

  // 3. 방장의 currentFamilyId null 처리
  const profileDocRef = doc(db, 'users', ownerUid, 'familyProfile', 'profile');
  batch.set(
    profileDocRef,
    {
      currentFamilyId: null,
      updatedAt: Date.now(),
    },
    { merge: true }
  );

  await batch.commit();
  logger.info('familySync.archiveFamilySpace', '가족 공간 삭제 처리 완료');
}

/**
 * 사용자의 가족 닉네임 및 아바타를 Firestore에 저장하여 기기 간 동기화합니다.
 * 
 * @param uid 사용자 Firebase UID
 * @param name 새 이름/닉네임
 * @param avatar 새 아바타 이모지
 * @param currentFamilyId 현재 참여 중인 가족 공간 ID (선택)
 */
export async function updateFamilyProfile(
  uid: string,
  name: string,
  avatar: string,
  currentFamilyId?: string | null
): Promise<void> {
  logger.info('familySync.updateFamilyProfile', `사용자 프로필 갱신: ${name} (UID: ${uid})`);

  if (!db || !isFirebaseReady) {
    throw new Error('Firestore에 연결되어 있지 않습니다.');
  }

  const profileDocRef = doc(db, 'users', uid, 'familyProfile', 'profile');
  const updates: Partial<UserFamilyProfileDoc> = {
    name: name.trim() || '가족 구성원',
    avatar: avatar || '👤',
    updatedAt: Date.now(),
  };

  if (currentFamilyId !== undefined) {
    updates.currentFamilyId = currentFamilyId;
  }

  await setDoc(profileDocRef, removeUndefinedDeep(updates), { merge: true });

  // 현재 활성 가족 공간이 있다면 members 컬렉션 내 본인 정보도 함께 갱신
  if (currentFamilyId) {
    const memberDocRef = doc(db, 'families', currentFamilyId, 'members', uid);
    try {
      const snap = await getDoc(memberDocRef);
      if (snap.exists()) {
        await updateDoc(memberDocRef, removeUndefinedDeep({
          name: name.trim() || '가족 구성원',
          avatar: avatar || '👤',
        }));
      }
    } catch (err) {
      logger.warn('familySync.updateFamilyProfile', '가족 멤버 문서 갱신 비차단 경고', err);
    }
  }

  logger.info('familySync.updateFamilyProfile', '프로필 갱신 완료');
}
