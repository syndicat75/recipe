/**
 * @file src/services/mealPlanFirestore.ts
 * @description 개인 주간 식단표 Cloud Firestore 실시간 동기화 및 오프라인 영속성 서비스.
 * /users/{uid}/mealPlanEntries 컬렉션을 기반으로 다기기 실시간 동기화(onSnapshot),
 * 배치 저장, 삭제 및 로컬-클라우드 무손실 스마트 병합을 처리합니다.
 */

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseReady } from '../lib/firebase';
import { WeeklyMealPlan, MealPlanEntry } from '../types/recipe';
import { logger } from '../utils/logger';
import { removeUndefinedDeep } from '../utils/firestoreSanitizer';

/**
 * 로컬 식단표와 클라우드 식단표를 엔트리 ID 및 updatedAt 기준으로 스마트 병합합니다.
 * @param localPlan 로컬 기기 식단표
 * @param cloudPlan 클라우드에서 조회된 식단표
 * @returns 충돌 없이 병합된 최신 식단표
 */
export function mergeMealPlans(
  localPlan: WeeklyMealPlan = {},
  cloudPlan: WeeklyMealPlan = {}
): WeeklyMealPlan {
  logger.info(
    'mealPlanFirestore.mergeMealPlans',
    `식단표 병합 시작 (로컬 날짜 수: ${Object.keys(localPlan).length}, 클라우드 날짜 수: ${Object.keys(cloudPlan).length})`
  );

  const entryMap = new Map<string, MealPlanEntry>();

  // 1. 클라우드 엔트리 등록
  Object.values(cloudPlan).forEach((entries) => {
    if (Array.isArray(entries)) {
      entries.forEach((e) => {
        if (e && e.id) {
          entryMap.set(e.id, e);
        }
      });
    }
  });

  // 2. 로컬 엔트리 병합 (동일 ID인 경우 더 최신 updatedAt을 가진 엔트리 채택)
  Object.values(localPlan).forEach((entries) => {
    if (Array.isArray(entries)) {
      entries.forEach((localEntry) => {
        if (!localEntry || !localEntry.id) return;
        const existing = entryMap.get(localEntry.id);
        if (!existing) {
          entryMap.set(localEntry.id, localEntry);
        } else {
          const localTs = localEntry.updatedAt || localEntry.createdAt || 0;
          const existingTs = existing.updatedAt || existing.createdAt || 0;
          if (localTs >= existingTs) {
            entryMap.set(localEntry.id, { ...existing, ...localEntry });
          }
        }
      });
    }
  });

  // 3. 날짜별로 그룹화
  const mergedResult: WeeklyMealPlan = {};
  entryMap.forEach((entry) => {
    const dateKey = entry.date;
    if (!mergedResult[dateKey]) {
      mergedResult[dateKey] = [];
    }
    mergedResult[dateKey].push(entry);
  });

  // 각 날짜 내 엔트리 정렬 (createdAt 오름차순)
  Object.keys(mergedResult).forEach((dateKey) => {
    mergedResult[dateKey].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  });

  return mergedResult;
}

/**
 * 로그인한 사용자의 Firestore 개인 식단표(/users/{uid}/mealPlanEntries)를 실시간 구독합니다.
 * 
 * @param uid 사용자 Firebase UID
 * @param onUpdate 식단 변경 시 호출될 콜백
 * @param onError 에러 발생 시 호출될 콜백
 * @returns 실시간 리스너 해제(Unsubscribe) 함수
 */
export function subscribeUserMealPlan(
  uid: string,
  onUpdate: (plan: WeeklyMealPlan) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  logger.info('mealPlanFirestore.subscribeUserMealPlan', `개인 식단 실시간 구독 시작 (UID: ${uid})`);

  if (!db || !isFirebaseReady || !uid) {
    logger.warn('mealPlanFirestore.subscribeUserMealPlan', 'Firestore 미연결 또는 UID 부재');
    return () => {};
  }

  const colRef = collection(db, 'users', uid, 'mealPlanEntries');

  return onSnapshot(
    colRef,
    (snapshot) => {
      const planByDate: WeeklyMealPlan = {};

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const entry: MealPlanEntry = {
          id: data.id || docSnap.id,
          date: data.date,
          slot: data.slot || 'single',
          recipeId: Number(data.recipeId),
          customTitle: data.customTitle,
          servings: typeof data.servings === 'number' ? data.servings : 1,
          createdAt: Number(data.createdAt || Date.now()),
          updatedAt: Number(data.updatedAt || Date.now()),
        };

        if (entry.date) {
          if (!planByDate[entry.date]) {
            planByDate[entry.date] = [];
          }
          planByDate[entry.date].push(entry);
        }
      });

      // 날짜별 엔트리 정렬
      Object.keys(planByDate).forEach((dateKey) => {
        planByDate[dateKey].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      });

      logger.info(
        'mealPlanFirestore.subscribeUserMealPlan',
        `식단 스냅샷 수신: 총 ${snapshot.docs.length}개 엔트리 (${Object.keys(planByDate).length}일)`
      );

      onUpdate(planByDate);
    },
    (err) => {
      logger.error('mealPlanFirestore.subscribeUserMealPlan', '식단 구독 오류', err);
      if (onError) onError(err);
    }
  );
}

/**
 * 단일 식단 항목을 클라우드 Firestore에 저장하거나 수정합니다.
 * @param uid 사용자 Firebase UID
 * @param entry 저장할 MealPlanEntry
 */
export async function saveMealPlanEntryToCloud(uid: string, entry: MealPlanEntry): Promise<void> {
  logger.info('mealPlanFirestore.saveMealPlanEntryToCloud', `단일 식단 저장: ${entry.id} (${entry.date})`);

  if (!db || !isFirebaseReady || !uid) {
    logger.warn('mealPlanFirestore.saveMealPlanEntryToCloud', 'Firestore 미연결로 로컬에만 보관');
    return;
  }

  const entryDocRef = doc(db, 'users', uid, 'mealPlanEntries', entry.id);
  const payload = removeUndefinedDeep({
    ...entry,
    updatedAt: Date.now(),
  });

  await setDoc(entryDocRef, payload, { merge: true });
}

/**
 * 단일 식단 항목을 클라우드 Firestore에서 삭제합니다.
 * @param uid 사용자 Firebase UID
 * @param entryId 삭제할 식단 항목 ID
 */
export async function deleteMealPlanEntryFromCloud(uid: string, entryId: string): Promise<void> {
  logger.info('mealPlanFirestore.deleteMealPlanEntryFromCloud', `식단 항목 삭제: ${entryId}`);

  if (!db || !isFirebaseReady || !uid || !entryId) return;

  const entryDocRef = doc(db, 'users', uid, 'mealPlanEntries', entryId);
  await deleteDoc(entryDocRef);
}

/**
 * 전체 주간 식단표를 Firestore에 일괄(Batch) 저장합니다.
 * @param uid 사용자 Firebase UID
 * @param plan 전체 주간 식단표
 */
export async function saveEntireMealPlanToCloud(uid: string, plan: WeeklyMealPlan): Promise<void> {
  logger.info('mealPlanFirestore.saveEntireMealPlanToCloud', `전체 식단표 일괄 저장 시작 (UID: ${uid})`);

  if (!db || !isFirebaseReady || !uid) {
    logger.warn('mealPlanFirestore.saveEntireMealPlanToCloud', 'Firestore 미연결');
    return;
  }

  // 1. 기존 엔트리 목록 조회
  const colRef = collection(db, 'users', uid, 'mealPlanEntries');
  const snap = await getDocs(colRef);
  const existingDocIds = new Set(snap.docs.map((d) => d.id));

  const batch = writeBatch(db);
  const activeIds = new Set<string>();

  // 2. 새 식단 엔트리 일괄 업서트
  Object.values(plan).forEach((entries) => {
    if (Array.isArray(entries)) {
      entries.forEach((entry) => {
        if (!entry || !entry.id) return;
        activeIds.add(entry.id);
        const docRef = doc(db, 'users', uid, 'mealPlanEntries', entry.id);
        const payload = removeUndefinedDeep({
          ...entry,
          updatedAt: Date.now(),
        });
        batch.set(docRef, payload, { merge: true });
      });
    }
  });

  // 3. 더 이상 존재하지 않는 과거 엔트리 삭제
  existingDocIds.forEach((id) => {
    if (!activeIds.has(id)) {
      const docRef = doc(db, 'users', uid, 'mealPlanEntries', id);
      batch.delete(docRef);
    }
  });

  await batch.commit();
  logger.info('mealPlanFirestore.saveEntireMealPlanToCloud', `식단 일괄 커밋 완료: 활성 엔트리 ${activeIds.size}개`);
}

/**
 * 로컬 기기 식단을 클라우드 계정으로 마이그레이션 및 병합합니다.
 * @param uid 사용자 Firebase UID
 * @param localPlan 기기 로컬 식단표
 * @returns { migratedCount } 마이그레이션된 엔트리 수
 */
export async function migrateLocalMealPlanToCloud(
  uid: string,
  localPlan: WeeklyMealPlan
): Promise<{ migratedCount: number }> {
  logger.info('mealPlanFirestore.migrateLocalMealPlanToCloud', `로컬 식단 클라우드 이전 시작 (UID: ${uid})`);

  if (!db || !isFirebaseReady || !uid) {
    return { migratedCount: 0 };
  }

  const colRef = collection(db, 'users', uid, 'mealPlanEntries');
  const snap = await getDocs(colRef);
  const cloudPlan: WeeklyMealPlan = {};

  snap.docs.forEach((docSnap) => {
    const data = docSnap.data() as MealPlanEntry;
    if (data.date) {
      if (!cloudPlan[data.date]) {
        cloudPlan[data.date] = [];
      }
      cloudPlan[data.date].push(data);
    }
  });

  const merged = mergeMealPlans(localPlan, cloudPlan);
  await saveEntireMealPlanToCloud(uid, merged);

  const totalEntries = Object.values(merged).reduce((sum, list) => sum + list.length, 0);
  logger.info('mealPlanFirestore.migrateLocalMealPlanToCloud', `로컬 식단 이전 완료: 총 ${totalEntries}개`);

  return { migratedCount: totalEntries };
}
