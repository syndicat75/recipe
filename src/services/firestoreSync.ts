/**
 * @file src/services/firestoreSync.ts
 * @description Cloud Firestore 레시피 공개 컬렉션(recipes/{recipeId}) 및 사용자 개인 데이터(users/{uid}/...) 실시간 동기화 서비스
 *
 * 1. 공개 레시피 (/recipes/{recipeId}): 로그인 여부와 관계없이 누구나 읽기 가능, 관리자만 추가/수정/삭제
 * 2. 개인 데이터 (users/{uid}/settings, users/{uid}/shoppingItems): 로그인한 사용자만 본인 데이터 읽기/쓰기
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
import { INITIAL_RECIPES } from '../data/initialRecipes';
import { logger } from '../utils/logger';

/**
 * 1. 공개 레시피 컬렉션 실시간 구독 (/recipes)
 * 비로그인 방문자 및 로그인 사용자 모두 실시간으로 최신 레시피 목록을 구독합니다.
 *
 * @param onUpdate 레시피 목록 갱신 콜백
 * @param onError 오류 발생 콜백
 * @returns 구독 해제 함수 (Unsubscribe)
 */
export function subscribeToPublicRecipes(
  onUpdate: (recipes: Recipe[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  logger.info('firestoreSync.subscribeToPublicRecipes', '공개 레시피(/recipes) 실시간 구독 시작');

  if (!db || !isFirebaseReady) {
    logger.warn('firestoreSync.subscribeToPublicRecipes', 'Firestore 인스턴스가 준비되지 않았습니다.');
    return () => {};
  }

  const publicRecipesColRef = collection(db, 'recipes');

  return onSnapshot(
    publicRecipesColRef,
    (snapshot) => {
      logger.info(
        'firestoreSync.subscribeToPublicRecipes',
        `공개 레시피 스냅샷 수신 (문서 수: ${snapshot.docs.length}, fromCache: ${snapshot.metadata.fromCache})`
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
          syncScope: 'public',
          isBookmarked: Boolean(data.isBookmarked),
          userNotes: data.userNotes || '',
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || Date.now(),
        } as Recipe;
      });

      onUpdate(recipes);
    },
    (error) => {
      logger.error('firestoreSync.subscribeToPublicRecipes', `공개 레시피 구독 오류: ${error.message}`, error);
      if (onError) onError(error);
    }
  );
}

/**
 * 공개 레시피 문서 수 조회 (/recipes)
 */
export async function fetchPublicRecipeCount(): Promise<number> {
  if (!db || !isFirebaseReady) return 0;
  try {
    const snap = await getDocs(collection(db, 'recipes'));
    return snap.docs.length;
  } catch (err) {
    logger.error('firestoreSync.fetchPublicRecipeCount', '공개 레시피 개수 조회 실패', err);
    return 0;
  }
}

/**
 * 단일 레시피 공개 컬렉션 저장/수정 (/recipes/{recipeId}) - 관리자 전용
 *
 * @param recipe 저장할 레시피 객체
 */
export async function savePublicRecipe(recipe: Recipe): Promise<void> {
  logger.info('firestoreSync.savePublicRecipe', `공개 레시피 저장 (ID: ${recipe.id}, Name: ${recipe.name})`);

  if (!db || !isFirebaseReady) {
    throw new Error('Firestore가 연결되지 않았습니다.');
  }

  const recipeDocRef = doc(db, 'recipes', String(recipe.id));
  const recipePayload = {
    ...recipe,
    id: recipe.id,
    syncScope: 'public',
    updatedAt: Date.now(),
  };

  await setDoc(recipeDocRef, recipePayload, { merge: true });
}

/**
 * 단일 레시피 공개 컬렉션 삭제 (/recipes/{recipeId}) - 관리자 전용
 *
 * @param recipeId 삭제할 레시피 ID
 */
export async function deletePublicRecipe(recipeId: number): Promise<void> {
  logger.info('firestoreSync.deletePublicRecipe', `공개 레시피 삭제 (ID: ${recipeId})`);

  if (!db || !isFirebaseReady) {
    throw new Error('Firestore가 연결되지 않았습니다.');
  }

  const recipeDocRef = doc(db, 'recipes', String(recipeId));
  await deleteDoc(recipeDocRef);
}

/**
 * 레시피 목록을 공개 컬렉션(/recipes)으로 일괄 등록/게시 - 관리자 전용
 *
 * @param recipes 일괄 등록할 레시피 목록
 */
export async function publishAllRecipesToPublic(recipes: Recipe[]): Promise<void> {
  logger.info('firestoreSync.publishAllRecipesToPublic', `공개 레시피 일괄 등록 시작 (${recipes.length}개)`);

  if (!db || !isFirebaseReady) {
    throw new Error('Firestore가 연결되지 않았습니다.');
  }

  // Firestore 배치 제한(500개) 고려하여 400개 단위 청크로 분할 커밋
  const chunkSize = 400;
  for (let i = 0; i < recipes.length; i += chunkSize) {
    const chunk = recipes.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    chunk.forEach((recipe) => {
      const docRef = doc(db, 'recipes', String(recipe.id));
      batch.set(
        docRef,
        {
          ...recipe,
          id: recipe.id,
          syncScope: 'public',
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    });

    await batch.commit();
  }

  logger.info('firestoreSync.publishAllRecipesToPublic', '공개 레시피 일괄 등록 완료');
}

/**
 * 이전 버전 사용자 개인 컬렉션 실시간 구독 (하위 호환용: users/{uid}/recipes)
 */
export function subscribeToUserRecipes(
  uid: string,
  onUpdate: (recipes: Recipe[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  logger.info('firestoreSync.subscribeToUserRecipes', `사용자 레시피 구독 (UID: ${uid})`);

  if (!db || !isFirebaseReady) {
    return () => {};
  }

  const recipesColRef = collection(db, 'users', uid, 'recipes');

  return onSnapshot(
    recipesColRef,
    (snapshot) => {
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
          syncScope: 'private',
          isBookmarked: Boolean(data.isBookmarked),
          userNotes: data.userNotes || '',
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || Date.now(),
        } as Recipe;
      });

      logger.info('firestoreSync.subscribeToUserRecipes', `사용자 개인 레시피 수신 (${recipes.length}개)`);
      onUpdate(recipes);
    },
    (error) => {
      logger.error('firestoreSync.subscribeToUserRecipes', `사용자 레시피 구독 오류: ${error.message}`, error);
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
 * 로그인 일반 사용자용 Firestore 개인 레시피 저장/수정 (users/{uid}/recipes/{recipeId})
 * 사용자의 개인 레시피는 절대 공개 컬렉션(/recipes)에 노출되지 않고 오직 본인의 모든 기기에서만 동기화됩니다.
 *
 * @param uid 사용자 Firebase UID
 * @param recipe 저장할 레시피 객체
 */
export async function savePrivateRecipe(uid: string, recipe: Recipe): Promise<void> {
  logger.info('firestoreSync.savePrivateRecipe', `개인 레시피 클라우드 저장 (UID: ${uid}, ID: ${recipe.id}, Name: ${recipe.name})`);

  if (!db || !isFirebaseReady) {
    throw new Error('Firestore가 연결되지 않았습니다.');
  }

  const ref = doc(db, 'users', uid, 'recipes', String(recipe.id));
  await setDoc(
    ref,
    {
      ...recipe,
      id: recipe.id,
      syncScope: 'private',
      updatedAt: Date.now(),
    },
    { merge: true }
  );
}

/**
 * 로그인 일반 사용자용 Firestore 개인 레시피 삭제 (users/{uid}/recipes/{recipeId})
 *
 * @param uid 사용자 Firebase UID
 * @param recipeId 삭제할 레시피 ID
 */
export async function deletePrivateRecipe(uid: string, recipeId: number): Promise<void> {
  logger.info('firestoreSync.deletePrivateRecipe', `개인 레시피 클라우드 삭제 (UID: ${uid}, ID: ${recipeId})`);

  if (!db || !isFirebaseReady) {
    throw new Error('Firestore가 연결되지 않았습니다.');
  }

  const ref = doc(db, 'users', uid, 'recipes', String(recipeId));
  await deleteDoc(ref);
}

/**
 * 레거시 호환용: 단일 레시피 클라우드 저장 (권한에 따라 안전하게 분기)
 * @deprecated savePrivateRecipe 또는 savePublicRecipe를 직접 사용하세요.
 */
export async function saveRecipeToCloud(uid: string, recipe: Recipe, isAdmin: boolean = false): Promise<void> {
  logger.info('firestoreSync.saveRecipeToCloud', `레시피 클라우드 저장 분기 (UID: ${uid}, RecipeId: ${recipe.id}, isAdmin: ${isAdmin})`);
  if (isAdmin) {
    await savePublicRecipe(recipe);
  } else {
    await savePrivateRecipe(uid, recipe);
  }
}

/**
 * 레거시 호환용: 단일 레시피 클라우드 삭제 (권한에 따라 안전하게 분기)
 * @deprecated deletePrivateRecipe 또는 deletePublicRecipe를 직접 사용하세요.
 */
export async function deleteRecipeFromCloud(uid: string, recipeId: number, isAdmin: boolean = false): Promise<void> {
  logger.info('firestoreSync.deleteRecipeFromCloud', `레시피 클라우드 삭제 분기 (UID: ${uid}, RecipeId: ${recipeId}, isAdmin: ${isAdmin})`);
  if (isAdmin) {
    await deletePublicRecipe(recipeId);
  } else {
    await deletePrivateRecipe(uid, recipeId);
  }
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

  const existingDocs = await getDocs(shoppingColRef);
  const currentIds = new Set(items.map((i) => i.id));

  existingDocs.docs.forEach((d) => {
    if (!currentIds.has(d.id)) {
      batch.delete(d.ref);
    }
  });

  items.forEach((item) => {
    const docRef = doc(db, 'users', uid, 'shoppingItems', item.id);
    batch.set(docRef, item, { merge: true });
  });

  await batch.commit();
}

/**
 * 클라우드 데이터 통계 요약 조회 (공개 레시피 및 사용자 데이터)
 *
 * @param uid 사용자 Firebase UID
 * @returns CloudDataSummary 객체
 */
export async function fetchCloudSummary(uid?: string): Promise<CloudDataSummary> {
  logger.info('firestoreSync.fetchCloudSummary', `클라우드 데이터 요약 조회 (UID: ${uid || 'public'})`);

  if (!db || !isFirebaseReady) {
    return { recipeCount: 0, shoppingCount: 0, bookmarkCount: 0, noteCount: 0 };
  }

  try {
    const publicRecipesSnap = await getDocs(collection(db, 'recipes'));
    let shoppingCount = 0;
    let bookmarkCount = 0;
    let noteCount = 0;
    let lastUpdated: number | undefined = undefined;

    if (uid) {
      const shoppingSnap = await getDocs(collection(db, 'users', uid, 'shoppingItems'));
      shoppingCount = shoppingSnap.docs.length;

      const settingsSnap = await getDoc(doc(db, 'users', uid, 'settings', 'data'));
      if (settingsSnap.exists()) {
        const data = settingsSnap.data() as UserSettingsDoc;
        bookmarkCount = Array.isArray(data.bookmarks) ? data.bookmarks.length : 0;
        noteCount = data.notes ? Object.keys(data.notes).length : 0;
        lastUpdated = data.updatedAt;
      }
    }

    return {
      recipeCount: publicRecipesSnap.docs.length,
      shoppingCount,
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
 * 로컬 데이터를 클라우드 개인 컬렉션(users/{uid}/recipes)으로 안전하게 마이그레이션 업로드
 * 일반 사용자의 로컬 레시피는 절대로 공개 컬렉션(/recipes)으로 유출되지 않으며,
 * 본인 계정의 개인 레시피 컬렉션에 syncScope: 'private'로 보관됩니다.
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
    `로컬 데이터 클라우드 개인 컬렉션 마이그레이션 시작 (레시피 ${localRecipes.length}개, 장보기 ${localShopping.length}개)`
  );

  if (!db || !isFirebaseReady) {
    throw new Error('Firestore에 연결할 수 없습니다.');
  }

  // 1. 사용자 개인 레시피 컬렉션 (users/{uid}/recipes)에 private 스코프로 청크 분할 업로드
  const chunkSize = 400;
  for (let i = 0; i < localRecipes.length; i += chunkSize) {
    const chunk = localRecipes.slice(i, i + chunkSize);
    const recipeBatch = writeBatch(db);
    chunk.forEach((recipe) => {
      const docRef = doc(db, 'users', uid, 'recipes', String(recipe.id));
      recipeBatch.set(
        docRef,
        {
          ...recipe,
          id: recipe.id,
          syncScope: 'private',
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    });
    await recipeBatch.commit();
  }

  // 2. 장보기 목록 일괄 등록
  const batch = writeBatch(db);
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
  logger.info('firestoreSync.migrateLocalDataToCloud', '로컬 데이터 개인 클라우드 마이그레이션 완료');
}

/**
 * 로컬 레시피와 클라우드 레시피를 ID 기준으로 스마트 병합
 */
export function mergeRecipeLists(localRecipes: Recipe[], cloudRecipes: Recipe[]): Recipe[] {
  logger.info(
    'firestoreSync.mergeRecipeLists',
    `레시피 목록 병합 (로컬: ${localRecipes.length}개, 클라우드: ${cloudRecipes.length}개)`
  );

  const recipeMap = new Map<number, Recipe>();

  cloudRecipes.forEach((recipe) => {
    recipeMap.set(recipe.id, recipe);
  });

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

/**
 * 관리자 전용: 공개 DB(/recipes) 마이그레이션 필요 여부를 실제 데이터 기반으로 검사
 * - 레시피 개수(26/27)가 아닌, 실제 이전 대상(관리자 개인 보관함 또는 미이전 커스텀/로컬 레시피)이 존재하는지 판단합니다.
 *
 * @param adminUid 관리자 UID
 * @param localRecipes 현재 로컬 기기 레시피 목록
 * @returns { needed, privateCount, localLegacyCount }
 */
export async function checkPublicMigrationNeeded(
  adminUid: string,
  localRecipes: Recipe[]
): Promise<{
  needed: boolean;
  privateCount: number;
  localLegacyCount: number;
}> {
  logger.info(
    'firestoreSync.checkPublicMigrationNeeded',
    `마이그레이션 필요 여부 검사 시작 (Admin UID: ${adminUid}, 로컬 수: ${localRecipes.length})`
  );

  if (!db || !isFirebaseReady || !adminUid) {
    return { needed: false, privateCount: 0, localLegacyCount: 0 };
  }

  let privateCount = 0;
  let localLegacyCount = 0;

  try {
    // 1. 관리자 개인 보관함(/users/{adminUid}/recipes) 레시피 개수 조회
    const userColRef = collection(db, 'users', adminUid, 'recipes');
    const userSnap = await getDocs(userColRef);
    privateCount = userSnap.docs.length;

    // 2. 현재 공개 DB(/recipes) ID 집합 조회
    const publicColRef = collection(db, 'recipes');
    const publicSnap = await getDocs(publicColRef);
    const publicIds = new Set<number>();
    publicSnap.docs.forEach((docSnap) => {
      const d = docSnap.data();
      const idNum = Number(d.id || docSnap.id);
      if (!isNaN(idNum)) {
        publicIds.add(idNum);
      }
    });

    // 3. 로컬 레시피 중 아직 공개 DB에 등록되지 않은 커스텀 또는 private/local 레시피 검색
    localRecipes.forEach((r) => {
      if (!publicIds.has(r.id)) {
        // 커스텀 레시피이거나 명시적 local/private 레시피인 경우에만 이전 대상으로 산정
        if (r.isCustom || r.syncScope === 'private' || r.syncScope === 'local') {
          localLegacyCount++;
        }
      }
    });

    // 관리자 개인 컬렉션에 레시피가 1개 이상 존재 OR localStorage에 아직 public DB로 이전되지 않은 legacy/local 데이터 존재
    const needed = privateCount > 0 || localLegacyCount > 0;

    logger.info(
      'firestoreSync.checkPublicMigrationNeeded',
      `마이그레이션 필요 여부 검사 완료: needed=${needed} (개인: ${privateCount}개, 미이전 로컬: ${localLegacyCount}개)`
    );

    return {
      needed,
      privateCount,
      localLegacyCount,
    };
  } catch (err) {
    logger.error('firestoreSync.checkPublicMigrationNeeded', '마이그레이션 필요 여부 검사 실패', err);
    return { needed: false, privateCount: 0, localLegacyCount: 0 };
  }
}

/**
 * 관리자 전용: 기존 개인/로컬 레시피를 Firestore 공개 DB(/recipes)로 안전하게 병합 이전
 * 
 * 병합 대상:
 * 1. Firestore /recipes 기존 공개 문서 (절대 삭제 금지, 원본 완벽 보존)
 * 2. Firestore /users/{adminUid}/recipes 문서 (관리자 개인 보관함 레시피)
 * 3. 실제 로컬 기기 미이전 커스텀/로컬 레시피
 * 
 * 데이터 무결성 원칙:
 * - INITIAL_RECIPES(기본 시드)는 절대로 자동 삽입하지 않습니다 (관리자가 의도적으로 삭제한 레시피의 부활 방지).
 * - ID 기준으로 중복 없이 스마트 병합하며 모든 문서에 syncScope: 'public' 부여.
 * 
 * @param adminUid 관리자 UID
 * @param localRecipes 로컬 기기 레시피 목록
 * @returns { totalMerged, publicCount }
 */
export async function migrateAllRecipesToPublicDb(
  adminUid: string,
  localRecipes: Recipe[]
): Promise<{ totalMerged: number; publicCount: number }> {
  logger.info(
    'firestoreSync.migrateAllRecipesToPublicDb',
    `관리자 공개 DB 마이그레이션 시작 (Admin UID: ${adminUid}, 로컬 수: ${localRecipes.length})`
  );

  if (!db || !isFirebaseReady) {
    throw new Error('Firestore에 연결할 수 없습니다.');
  }

  const recipeMap = new Map<number, Recipe>();

  // 1. Firestore /recipes 기존 공개 문서 먼저 조회 (기존 공개 문서 원본 완벽 보존)
  try {
    const publicColRef = collection(db, 'recipes');
    const publicSnap = await getDocs(publicColRef);
    logger.info('firestoreSync.migrateAllRecipesToPublicDb', `기존 공개 레시피 조회: ${publicSnap.docs.length}개`);

    publicSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const id = Number(data.id || docSnap.id);
      const pubRecipe: Recipe = {
        ...data,
        id,
        name: String(data.name || '무제 레시피'),
        category: data.category || '기타',
        ingredients: String(data.ingredients || ''),
        method: String(data.method || ''),
        ingredientCount: Number(data.ingredientCount || 0),
        stepCount: Number(data.stepCount || 0),
        icon: String(data.icon || '🍳'),
        syncScope: 'public',
      } as Recipe;

      recipeMap.set(id, pubRecipe);
    });
  } catch (err) {
    logger.error('firestoreSync.migrateAllRecipesToPublicDb', '기존 공개 레시피 조회 오류', err);
  }

  // 2. Firestore /users/{adminUid}/recipes 조회 및 병합 (개인 보관함 레시피)
  if (adminUid) {
    try {
      const userColRef = collection(db, 'users', adminUid, 'recipes');
      const userSnap = await getDocs(userColRef);
      logger.info('firestoreSync.migrateAllRecipesToPublicDb', `관리자 개인 레시피 조회 성공: ${userSnap.docs.length}개`);

      userSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const id = Number(data.id || docSnap.id);
        const userRecipe: Recipe = {
          ...data,
          id,
          name: String(data.name || '무제 레시피'),
          category: data.category || '기타',
          ingredients: String(data.ingredients || ''),
          method: String(data.method || ''),
          ingredientCount: Number(data.ingredientCount || 0),
          stepCount: Number(data.stepCount || 0),
          icon: String(data.icon || '🍳'),
          syncScope: 'public',
        } as Recipe;

        const existing = recipeMap.get(id);
        if (!existing) {
          recipeMap.set(id, userRecipe);
        } else {
          const userUpdated = Number(userRecipe.updatedAt || userRecipe.createdAt || 0);
          const existingUpdated = Number(existing.updatedAt || existing.createdAt || 0);
          if (userUpdated >= existingUpdated) {
            recipeMap.set(id, { ...existing, ...userRecipe, syncScope: 'public' });
          }
        }
      });
    } catch (err) {
      logger.warn('firestoreSync.migrateAllRecipesToPublicDb', '관리자 개인 레시피 조회 경고 (계속 진행)', err);
    }
  }

  // 3. 로컬 기기 레시피 중 미이전 커스텀/로컬 레시피 병합
  localRecipes.forEach((r) => {
    const existing = recipeMap.get(r.id);
    if (!existing) {
      // 의도적으로 삭제된 기본 레시피 부활을 방지하기 위해 오직 커스텀이거나 private/local인 경우에만 이전
      if (r.isCustom || r.syncScope === 'private' || r.syncScope === 'local') {
        recipeMap.set(r.id, { ...r, syncScope: 'public' });
      }
    } else {
      const localUpdated = Number(r.updatedAt || r.createdAt || 0);
      const existingUpdated = Number(existing.updatedAt || existing.createdAt || 0);
      if (localUpdated > existingUpdated && r.isCustom) {
        recipeMap.set(r.id, { ...existing, ...r, syncScope: 'public' });
      }
    }
  });

  const mergedList = Array.from(recipeMap.values());
  logger.info(
    'firestoreSync.migrateAllRecipesToPublicDb',
    `최종 병합된 공개 레시피 수: ${mergedList.length}개 -> publishAllRecipesToPublic 실행`
  );

  // 4. 공개 컬렉션(/recipes)으로 일괄 커밋
  await publishAllRecipesToPublic(mergedList);

  return {
    totalMerged: mergedList.length,
    publicCount: mergedList.length,
  };
}

/**
 * 관리자 전용 명시적 기능: 기본 시드 레시피 복원
 * - 자동 실행되지 않으며, 관리자가 명시적으로 복원을 승인하고 실행한 경우에만 호출됩니다.
 * - 현재 공개 DB(/recipes)에 누락된 기본 시드 레시피만 골라 보충합니다.
 *
 * @param adminUid 관리자 UID
 * @returns { restoredCount, totalCount } 복원된 레시피 수 및 전체 레시피 수
 */
export async function restoreDefaultSeedRecipesToPublic(
  adminUid: string
): Promise<{ restoredCount: number; totalCount: number }> {
  logger.info('firestoreSync.restoreDefaultSeedRecipesToPublic', `기본 시드 레시피 복원 실행 (Admin: ${adminUid})`);

  if (!db || !isFirebaseReady) {
    throw new Error('Firestore에 연결할 수 없습니다.');
  }

  const publicColRef = collection(db, 'recipes');
  const publicSnap = await getDocs(publicColRef);
  const recipeMap = new Map<number, Recipe>();

  publicSnap.docs.forEach((d) => {
    const data = d.data();
    const id = Number(data.id || d.id);
    recipeMap.set(id, { ...data, id, syncScope: 'public' } as Recipe);
  });

  let restoredCount = 0;
  INITIAL_RECIPES.forEach((seed) => {
    if (!recipeMap.has(seed.id)) {
      recipeMap.set(seed.id, { ...seed, syncScope: 'public', updatedAt: Date.now() });
      restoredCount++;
    }
  });

  const allRecipes = Array.from(recipeMap.values());
  await publishAllRecipesToPublic(allRecipes);

  logger.info('firestoreSync.restoreDefaultSeedRecipesToPublic', `시드 복원 완료: 추가 ${restoredCount}개, 총 ${allRecipes.length}개`);
  return {
    restoredCount,
    totalCount: allRecipes.length,
  };
}

