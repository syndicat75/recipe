/**
 * @file src/services/firestoreSync.ts
 * @description Cloud Firestore 사용자별 실시간 동기화 서비스 (users/{uid}/recipes, users/{uid}/shoppingItems, users/{uid}/settings)
 */

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDoc,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseReady } from '../lib/firebase';
import { Recipe, ShoppingItem } from '../types/recipe';
import { CloudDataSummary, UserSettingsDoc } from '../types/firebase';
import { logger } from '../utils/logger';

/**
 * 사용자 레시피 컬렉션 실시간 구독 (users/{uid}/recipes)
 *
 * @param uid 사용자 Firebase UID
 * @param onUpdate 레시피 목록 갱신 콜백
 * @param onError 오류 발생 콜백
 * @returns 구독 해제 함수 (Unsubscribe)
 */
export function subscribeToUserRecipes(
  uid: string,
  onUpdate: (recipes: Recipe[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  logger.info('firestoreSync.subscribeToUserRecipes', `레시피 실시간 구독 시작 (UID: ${uid})`);

  if (!db || !isFirebaseReady) {
    logger.warn('firestoreSync.subscribeToUserRecipes', 'Firestore 인스턴스가 준비되지 않았습니다.');
    return () => {};
  }

  const recipesColRef = collection(db, 'users', uid, 'recipes');

  return onSnapshot(
    recipesColRef,
    (snapshot) => {
      logger.info(
        'firestoreSync.subscribeToUserRecipes',
        `레시피 스냅샷 수신 (문서 수: ${snapshot.docs.length}, fromCache: ${snapshot.metadata.fromCache})`
      );

      const recipes: Recipe[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: Number(data.id || docSnap.id),
          name: String(data.name || '무제 레시피'),
          category: data.category || '기타',
          ingredients: String(data.ingredients || ''),
          method: String(data.method || ''),
          ingredientCount: Number(data.ingredientCount || 0),
          stepCount: Number(data.stepCount || 0),
          icon: String(data.icon || '🍳'),
          imageUrl: data.imageUrl || undefined,
          cookingTimeMinutes: data.cookingTimeMinutes || undefined,
          difficulty: data.difficulty || undefined,
          baseServings: data.baseServings || 2,
          sharedWithFamily: Boolean(data.sharedWithFamily),
          sourceImageUrl: data.sourceImageUrl || undefined,
          isCustom: Boolean(data.isCustom),
          isBookmarked: Boolean(data.isBookmarked),
          userNotes: data.userNotes || '',
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || Date.now(),
        } as Recipe;
      });

      onUpdate(recipes);
    },
    (error) => {
      logger.error('firestoreSync.subscribeToUserRecipes', `레시피 구독 오류: ${error.message}`, error);
      if (onError) onError(error);
    }
  );
}

/**
 * 사용자 설정 및 메타데이터 실시간 구독 (users/{uid}/settings/data)
 *
 * @param uid 사용자 Firebase UID
 * @param onUpdate 설정 데이터 갱신 콜백 (즐겨찾기 목록, 사용자 메모 등)
 * @param onError 오류 발생 콜백
 * @returns 구독 해제 함수 (Unsubscribe)
 */
export function subscribeToUserSettings(
  uid: string,
  onUpdate: (settings: { bookmarks: number[]; notes: Record<number, string> }) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  logger.info('firestoreSync.subscribeToUserSettings', `사용자 설정 실시간 구독 시작 (UID: ${uid})`);

  if (!db || !isFirebaseReady) {
    return () => {};
  }

  const settingsDocRef = doc(db, 'users', uid, 'settings', 'data');

  return onSnapshot(
    settingsDocRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserSettingsDoc;
        const bookmarks: number[] = Array.isArray(data.bookmarks) ? data.bookmarks : [];
        const rawNotes = data.notes || {};
        const notes: Record<number, string> = {};

        Object.entries(rawNotes).forEach(([key, val]) => {
          const numKey = Number(key);
          if (!isNaN(numKey)) {
            notes[numKey] = String(val);
          }
        });

        logger.info(
          'firestoreSync.subscribeToUserSettings',
          `설정 스냅샷 수신 (즐겨찾기: ${bookmarks.length}개, 메모: ${Object.keys(notes).length}개)`
        );
        onUpdate({ bookmarks, notes });
      } else {
        onUpdate({ bookmarks: [], notes: {} });
      }
    },
    (error) => {
      logger.error('firestoreSync.subscribeToUserSettings', `설정 구독 오류: ${error.message}`, error);
      if (onError) onError(error);
    }
  );
}

/**
 * 사용자 장보기 목록 실시간 구독 (users/{uid}/shoppingItems)
 *
 * @param uid 사용자 Firebase UID
 * @param onUpdate 장보기 목록 갱신 콜백
 * @param onError 오류 발생 콜백
 * @returns 구독 해제 함수 (Unsubscribe)
 */
export function subscribeToUserShopping(
  uid: string,
  onUpdate: (items: ShoppingItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  logger.info('firestoreSync.subscribeToUserShopping', `장보기 실시간 구독 시작 (UID: ${uid})`);

  if (!db || !isFirebaseReady) {
    return () => {};
  }

  const shoppingColRef = collection(db, 'users', uid, 'shoppingItems');

  return onSnapshot(
    shoppingColRef,
    (snapshot) => {
      logger.info('firestoreSync.subscribeToUserShopping', `장보기 스냅샷 수신 (항목 수: ${snapshot.docs.length})`);
      const items: ShoppingItem[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: String(data.id || docSnap.id),
          text: String(data.text || ''),
          sourceRecipeName: data.sourceRecipeName || undefined,
          completed: Boolean(data.completed),
          createdAt: Number(data.createdAt || Date.now()),
        };
      });

      // 최신순 정렬
      items.sort((a, b) => b.createdAt - a.createdAt);
      onUpdate(items);
    },
    (error) => {
      logger.error('firestoreSync.subscribeToUserShopping', `장보기 구독 오류: ${error.message}`, error);
      if (onError) onError(error);
    }
  );
}

/**
 * 단일 레시피 클라우드 저장/수정 (users/{uid}/recipes/{recipeId})
 *
 * @param uid 사용자 Firebase UID
 * @param recipe 저장할 레시피 객체
 */
export async function saveRecipeToCloud(uid: string, recipe: Recipe): Promise<void> {
  logger.info('firestoreSync.saveRecipeToCloud', `레시피 클라우드 저장 (UID: ${uid}, RecipeId: ${recipe.id})`);

  if (!db || !isFirebaseReady) {
    throw new Error('Firestore가 연결되지 않았습니다.');
  }

  const recipeDocRef = doc(db, 'users', uid, 'recipes', String(recipe.id));
  const recipePayload = {
    ...recipe,
    id: recipe.id,
    updatedAt: Date.now(),
  };

  await setDoc(recipeDocRef, recipePayload, { merge: true });
}

/**
 * 단일 레시피 클라우드 삭제 (users/{uid}/recipes/{recipeId})
 *
 * @param uid 사용자 Firebase UID
 * @param recipeId 삭제할 레시피 ID
 */
export async function deleteRecipeFromCloud(uid: string, recipeId: number): Promise<void> {
  logger.info('firestoreSync.deleteRecipeFromCloud', `레시피 클라우드 삭제 (UID: ${uid}, RecipeId: ${recipeId})`);

  if (!db || !isFirebaseReady) {
    throw new Error('Firestore가 연결되지 않았습니다.');
  }

  const recipeDocRef = doc(db, 'users', uid, 'recipes', String(recipeId));
  await deleteDoc(recipeDocRef);
}

/**
 * 즐겨찾기 목록 클라우드 저장 (users/{uid}/settings/data)
 *
 * @param uid 사용자 Firebase UID
 * @param bookmarks 즐겨찾기 ID 배열
 */
export async function saveBookmarksToCloud(uid: string, bookmarks: number[]): Promise<void> {
  logger.info('firestoreSync.saveBookmarksToCloud', `즐겨찾기 목록 저장 (${bookmarks.length}개)`);

  if (!db || !isFirebaseReady) return;

  const settingsDocRef = doc(db, 'users', uid, 'settings', 'data');
  await setDoc(
    settingsDocRef,
    {
      bookmarks,
      updatedAt: Date.now(),
    },
    { merge: true }
  );
}

/**
 * 개인 메모 클라우드 저장 (users/{uid}/settings/data)
 *
 * @param uid 사용자 Firebase UID
 * @param recipeId 레시피 ID
 * @param note 메모 내용
 * @param currentNotes 현재 전체 메모 맵
 */
export async function saveRecipeNoteToCloud(
  uid: string,
  recipeId: number,
  note: string,
  currentNotes: Record<number, string>
): Promise<void> {
  logger.info('firestoreSync.saveRecipeNoteToCloud', `레시피 메모 클라우드 저장 (ID: ${recipeId})`);

  if (!db || !isFirebaseReady) return;

  const updatedNotes = { ...currentNotes };
  if (note.trim()) {
    updatedNotes[recipeId] = note.trim();
  } else {
    delete updatedNotes[recipeId];
  }

  // Record<string, string>으로 직렬화
  const serializedNotes: Record<string, string> = {};
  Object.entries(updatedNotes).forEach(([key, val]) => {
    serializedNotes[String(key)] = val;
  });

  const settingsDocRef = doc(db, 'users', uid, 'settings', 'data');
  await setDoc(
    settingsDocRef,
    {
      notes: serializedNotes,
      updatedAt: Date.now(),
    },
    { merge: true }
  );

  // 레시피 문서 자체의 userNotes 필드도 동시 업데이트 (단일 조회 시 편리함 제공)
  try {
    const recipeDocRef = doc(db, 'users', uid, 'recipes', String(recipeId));
    await setDoc(recipeDocRef, { userNotes: note.trim(), updatedAt: Date.now() }, { merge: true });
  } catch (err) {
    logger.warn('firestoreSync.saveRecipeNoteToCloud', `레시피 본문 메모 업데이트 건너뜀: ${(err as Error).message}`);
  }
}

/**
 * 단일 장보기 항목 클라우드 저장/수정 (users/{uid}/shoppingItems/{itemId})
 *
 * @param uid 사용자 Firebase UID
 * @param item 장보기 항목
 */
export async function saveShoppingItemToCloud(uid: string, item: ShoppingItem): Promise<void> {
  logger.info('firestoreSync.saveShoppingItemToCloud', `장보기 항목 클라우드 저장 (ID: ${item.id})`);

  if (!db || !isFirebaseReady) return;

  const itemDocRef = doc(db, 'users', uid, 'shoppingItems', item.id);
  await setDoc(itemDocRef, item, { merge: true });
}

/**
 * 단일 장보기 항목 클라우드 삭제 (users/{uid}/shoppingItems/{itemId})
 *
 * @param uid 사용자 Firebase UID
 * @param itemId 삭제할 항목 ID
 */
export async function deleteShoppingItemFromCloud(uid: string, itemId: string): Promise<void> {
  logger.info('firestoreSync.deleteShoppingItemFromCloud', `장보기 항목 클라우드 삭제 (ID: ${itemId})`);

  if (!db || !isFirebaseReady) return;

  const itemDocRef = doc(db, 'users', uid, 'shoppingItems', itemId);
  await deleteDoc(itemDocRef);
}

/**
 * 전체 장보기 목록 클라우드 일괄 갱신 (users/{uid}/shoppingItems)
 *
 * @param uid 사용자 Firebase UID
 * @param items 최신 장보기 목록 배열
 */
export async function syncAllShoppingItemsToCloud(uid: string, items: ShoppingItem[]): Promise<void> {
  logger.info('firestoreSync.syncAllShoppingItemsToCloud', `장보기 전체 목록 일괄 동기화 (${items.length}개)`);

  if (!db || !isFirebaseReady) return;

  const batch = writeBatch(db);
  const shoppingColRef = collection(db, 'users', uid, 'shoppingItems');

  // 1. 기존 항목 조회 후 삭제 배치 등록
  const existingDocs = await getDocs(shoppingColRef);
  const currentIds = new Set(items.map((i) => i.id));

  existingDocs.docs.forEach((d) => {
    if (!currentIds.has(d.id)) {
      batch.delete(d.ref);
    }
  });

  // 2. 새 항목/수정 항목 쓰기 배치 등록
  items.forEach((item) => {
    const docRef = doc(db, 'users', uid, 'shoppingItems', item.id);
    batch.set(docRef, item, { merge: true });
  });

  await batch.commit();
}

/**
 * 클라우드 데이터 통계 요약 조회 (최초 로그인 및 마이그레이션 판단용)
 *
 * @param uid 사용자 Firebase UID
 * @returns CloudDataSummary 객체
 */
export async function fetchCloudSummary(uid: string): Promise<CloudDataSummary> {
  logger.info('firestoreSync.fetchCloudSummary', `클라우드 데이터 요약 조회 (UID: ${uid})`);

  if (!db || !isFirebaseReady) {
    return { recipeCount: 0, shoppingCount: 0, bookmarkCount: 0, noteCount: 0 };
  }

  try {
    const recipesSnap = await getDocs(collection(db, 'users', uid, 'recipes'));
    const shoppingSnap = await getDocs(collection(db, 'users', uid, 'shoppingItems'));
    const settingsSnap = await getDoc(doc(db, 'users', uid, 'settings', 'data'));

    let bookmarkCount = 0;
    let noteCount = 0;
    let lastUpdated: number | undefined = undefined;

    if (settingsSnap.exists()) {
      const data = settingsSnap.data() as UserSettingsDoc;
      bookmarkCount = Array.isArray(data.bookmarks) ? data.bookmarks.length : 0;
      noteCount = data.notes ? Object.keys(data.notes).length : 0;
      lastUpdated = data.updatedAt;
    }

    return {
      recipeCount: recipesSnap.docs.length,
      shoppingCount: shoppingSnap.docs.length,
      bookmarkCount,
      noteCount,
      lastUpdated,
    };
  } catch (err) {
    logger.error('firestoreSync.fetchCloudSummary', '클라우드 요약 조회 실패', err);
    return { recipeCount: 0, shoppingCount: 0, bookmarkCount: 0, noteCount: 0 };
  }
}

/**
 * 로컬 데이터를 클라우드로 최초 마이그레이션 업로드
 *
 * @param uid 사용자 Firebase UID
 * @param localRecipes 로컬 레시피 목록
 * @param localBookmarks 로컬 즐겨찾기 ID 목록
 * @param localNotes 로컬 개인 메모 맵
 * @param localShopping 로컬 장보기 목록
 */
export async function migrateLocalDataToCloud(
  uid: string,
  localRecipes: Recipe[],
  localBookmarks: number[],
  localNotes: Record<number, string>,
  localShopping: ShoppingItem[]
): Promise<void> {
  logger.info(
    'firestoreSync.migrateLocalDataToCloud',
    `로컬 데이터 클라우드 마이그레이션 시작 (레시피 ${localRecipes.length}개, 장보기 ${localShopping.length}개)`
  );

  if (!db || !isFirebaseReady) {
    throw new Error('Firestore에 연결할 수 없습니다.');
  }

  // 1. 레시피 일괄 등록
  const batch = writeBatch(db);

  localRecipes.forEach((recipe) => {
    const docRef = doc(db, 'users', uid, 'recipes', String(recipe.id));
    batch.set(docRef, { ...recipe, id: recipe.id, updatedAt: Date.now() }, { merge: true });
  });

  // 2. 장보기 목록 일괄 등록
  localShopping.forEach((item) => {
    const docRef = doc(db, 'users', uid, 'shoppingItems', item.id);
    batch.set(docRef, item, { merge: true });
  });

  // 3. 설정 및 즐겨찾기, 메모 등록
  const serializedNotes: Record<string, string> = {};
  Object.entries(localNotes).forEach(([key, val]) => {
    serializedNotes[String(key)] = val;
  });

  const settingsRef = doc(db, 'users', uid, 'settings', 'data');
  batch.set(
    settingsRef,
    {
      bookmarks: localBookmarks,
      notes: serializedNotes,
      migrationCompleted: true,
      migratedAt: Date.now(),
      updatedAt: Date.now(),
    },
    { merge: true }
  );

  await batch.commit();
  logger.info('firestoreSync.migrateLocalDataToCloud', '로컬 데이터 마이그레이션 완료');
}

/**
 * 로컬 레시피와 클라우드 레시피를 ID 기준으로 스마트 병합
 *
 * @param localRecipes 로컬 레시피 배열
 * @param cloudRecipes 클라우드 레시피 배열
 * @returns 병합된 최신 레시피 배열
 */
export function mergeRecipeLists(localRecipes: Recipe[], cloudRecipes: Recipe[]): Recipe[] {
  logger.info(
    'firestoreSync.mergeRecipeLists',
    `레시피 목록 병합 (로컬: ${localRecipes.length}개, 클라우드: ${cloudRecipes.length}개)`
  );

  const recipeMap = new Map<number, Recipe>();

  // 1. 클라우드 레시피 먼저 채우기
  cloudRecipes.forEach((recipe) => {
    recipeMap.set(recipe.id, recipe);
  });

  // 2. 로컬 레시피 병합 (ID가 같으면 최신 수정본 우선, 없으면 추가)
  localRecipes.forEach((local) => {
    const existing = recipeMap.get(local.id);
    if (!existing) {
      recipeMap.set(local.id, local);
    } else {
      const localUpdated =
        typeof local.updatedAt === 'number'
          ? local.updatedAt
          : typeof local.updatedAt === 'string'
          ? new Date(local.updatedAt).getTime()
          : local.createdAt || 0;

      const existingUpdated =
        typeof existing.updatedAt === 'number'
          ? existing.updatedAt
          : typeof existing.updatedAt === 'string'
          ? new Date(existing.updatedAt).getTime()
          : existing.createdAt || 0;

      if (localUpdated > existingUpdated) {
        recipeMap.set(local.id, { ...existing, ...local });
      }
    }
  });

  return Array.from(recipeMap.values());
}
