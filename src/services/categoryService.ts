/**
 * @file src/services/categoryService.ts
 * @description Cloud Firestore /recipeCategories 컬렉션 실시간 구독 및 관리자 CRUD 서비스
 */

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
  query,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseReady } from '../lib/firebase';
import { RecipeCategoryDoc, Recipe } from '../types/recipe';
import { DEFAULT_CATEGORY_DOCS, APP_CONFIG, FALLBACK_CATEGORY } from '../config/appConfig';
import { removeUndefinedDeep } from '../utils/firestoreSanitizer';
import { logger } from '../utils/logger';

const CATEGORIES_COLLECTION = 'recipeCategories';

/**
 * 로컬 캐시에서 카테고리 목록 읽기 (초기 로딩 및 오프라인 대비)
 */
export function getLocalCategoriesCache(): RecipeCategoryDoc[] {
  try {
    const raw = localStorage.getItem(APP_CONFIG.storageKeys.categoriesCache);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    logger.warn('categoryService.getLocalCategoriesCache', '로컬 캐시 파싱 실패', err);
  }
  return DEFAULT_CATEGORY_DOCS;
}

/**
 * 로컬 캐시에 카테고리 목록 저장
 */
function saveLocalCategoriesCache(categories: RecipeCategoryDoc[]): void {
  try {
    localStorage.setItem(APP_CONFIG.storageKeys.categoriesCache, JSON.stringify(categories));
  } catch (err) {
    logger.warn('categoryService.saveLocalCategoriesCache', '로컬 캐시 저장 실패', err);
  }
}

/**
 * 카테고리 이름 정규화 (공백 정리, 소문자화)
 */
export function normalizeCategoryName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * 1. 카테고리 컬렉션 실시간 구독 (/recipeCategories)
 * - Firestore onSnapshot으로 최신 카테고리 목록을 실시간 수신합니다.
 * - Firestore 준비 전이나 오류 발생 시 로컬 캐시를 반환하여 화면 멈춤을 방지합니다.
 */
export function subscribeToCategories(
  onUpdate: (categories: RecipeCategoryDoc[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  logger.info('categoryService.subscribeToCategories', '카테고리 실시간 구독 시작');

  // 즉시 로컬 캐시 1차 방출 (초기 깜빡임 방지)
  const cached = getLocalCategoriesCache();
  onUpdate(cached);

  if (!db || !isFirebaseReady) {
    logger.warn('categoryService.subscribeToCategories', 'Firestore 미준비 상태로 로컬 캐시 유지');
    return () => {};
  }

  const colRef = collection(db, CATEGORIES_COLLECTION);
  const q = query(colRef, orderBy('order', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        logger.info('categoryService.subscribeToCategories', 'Firestore 카테고리 컬렉션이 비어있음');
        // 컬렉션이 완전히 비어있을 때는 기본값 제공
        onUpdate(cached.length > 0 ? cached : DEFAULT_CATEGORY_DOCS);
        return;
      }

      const categories: RecipeCategoryDoc[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: String(data.id || docSnap.id),
          name: String(data.name || '').trim(),
          icon: data.icon ? String(data.icon) : undefined,
          order: typeof data.order === 'number' ? data.order : 999,
          isActive: data.isActive !== false,
          createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
          updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
        };
      });

      // order 기준 오름차순 정렬 보장
      categories.sort((a, b) => a.order - b.order);

      saveLocalCategoriesCache(categories);
      onUpdate(categories);
    },
    (error) => {
      logger.error('categoryService.subscribeToCategories', '카테고리 구독 오류', error);
      if (onError) onError(error);
    }
  );
}

/**
 * 2. 기존 기본 카테고리 자동 초기화
 * Firestore /recipeCategories 컬렉션이 완전히 비어있을 때만 최초 1회 생성합니다.
 * 이미 1개 이상 존재하면 절대 덮어쓰지 않습니다.
 */
export async function initDefaultCategoriesIfEmpty(isAdmin: boolean): Promise<boolean> {
  if (!isAdmin || !db || !isFirebaseReady) {
    return false;
  }

  try {
    const colRef = collection(db, CATEGORIES_COLLECTION);
    const existingSnap = await getDocs(colRef);

    if (!existingSnap.empty) {
      logger.info('categoryService.initDefaultCategoriesIfEmpty', `기존 카테고리 ${existingSnap.docs.length}개 확인됨. 초기화 생략.`);
      return false;
    }

    logger.info('categoryService.initDefaultCategoriesIfEmpty', 'Firestore에 카테고리가 없어 기본 7개 카테고리를 최초 1회 초기화합니다.');
    const batch = writeBatch(db);

    const now = Date.now();
    for (const def of DEFAULT_CATEGORY_DOCS) {
      const docRef = doc(db, CATEGORIES_COLLECTION, def.id);
      const sanitized = removeUndefinedDeep({
        id: def.id,
        name: def.name,
        icon: def.icon,
        order: def.order,
        isActive: def.isActive,
        createdAt: now,
        updatedAt: now,
      });
      batch.set(docRef, sanitized);
    }

    await batch.commit();
    logger.info('categoryService.initDefaultCategoriesIfEmpty', '기본 카테고리 초기화 완료');
    return true;
  } catch (err) {
    logger.error('categoryService.initDefaultCategoriesIfEmpty', '기본 카테고리 초기화 중 오류', err);
    return false;
  }
}

/**
 * 3. 새 카테고리 추가
 */
export async function addCategory(
  input: { name: string; icon?: string },
  currentCategories: RecipeCategoryDoc[]
): Promise<RecipeCategoryDoc> {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error('카테고리 이름을 입력해주세요.');
  }

  // 중복 검사 (대소문자/공백 정규화 비교)
  const normalized = normalizeCategoryName(trimmedName);
  const isDuplicate = currentCategories.some((c) => normalizeCategoryName(c.name) === normalized);
  if (isDuplicate) {
    throw new Error('이미 존재하는 카테고리입니다.');
  }

  if (!db || !isFirebaseReady) {
    throw new Error('Firestore 데이터베이스에 연결할 수 없습니다.');
  }

  const maxOrder = currentCategories.reduce((max, c) => Math.max(max, c.order || 0), 0);
  const now = Date.now();
  const slugId = `cat_${now}_${Math.random().toString(36).substring(2, 7)}`;

  const newDoc: RecipeCategoryDoc = {
    id: slugId,
    name: trimmedName,
    icon: input.icon?.trim() || undefined,
    order: maxOrder + 1,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  const sanitized = removeUndefinedDeep(newDoc);
  await setDoc(doc(db, CATEGORIES_COLLECTION, slugId), sanitized);
  logger.info('categoryService.addCategory', `새 카테고리 추가 성공: ${trimmedName} (${slugId})`);

  return newDoc;
}

/**
 * 4. 카테고리 수정 (이름/아이콘/활성상태 등)
 * 이름이 변경된 경우 기존 /recipes 컬렉션에서 해당 카테고리를 사용 중인 레시피들의 category도 일괄 업데이트합니다.
 */
export async function updateCategory(
  id: string,
  updates: { name?: string; icon?: string; isActive?: boolean },
  oldCategory: RecipeCategoryDoc,
  allCategories: RecipeCategoryDoc[]
): Promise<{ updatedCategory: RecipeCategoryDoc; affectedRecipesCount: number }> {
  if (!db || !isFirebaseReady) {
    throw new Error('Firestore 데이터베이스에 연결할 수 없습니다.');
  }

  let newName = oldCategory.name;
  if (updates.name !== undefined) {
    const trimmed = updates.name.trim();
    if (!trimmed) {
      throw new Error('카테고리 이름을 비워둘 수 없습니다.');
    }
    const normalized = normalizeCategoryName(trimmed);
    const isDuplicate = allCategories.some(
      (c) => c.id !== id && normalizeCategoryName(c.name) === normalized
    );
    if (isDuplicate) {
      throw new Error('이미 존재하는 카테고리입니다.');
    }
    newName = trimmed;
  }

  const now = Date.now();
  const updatedDoc: RecipeCategoryDoc = {
    ...oldCategory,
    name: newName,
    icon: updates.icon !== undefined ? (updates.icon.trim() || undefined) : oldCategory.icon,
    isActive: updates.isActive !== undefined ? updates.isActive : oldCategory.isActive,
    updatedAt: now,
  };

  let affectedRecipesCount = 0;

  // 이름이 실제로 바뀐 경우, 해당 카테고리를 사용 중인 공개 레시피 일괄 업데이트
  if (newName !== oldCategory.name) {
    logger.info(
      'categoryService.updateCategory',
      `카테고리명 변경: "${oldCategory.name}" -> "${newName}". 레시피 일괄 동기화 시작`
    );

    const recipesColRef = collection(db, 'recipes');
    const recipesSnap = await getDocs(recipesColRef);
    const batch = writeBatch(db);

    recipesSnap.docs.forEach((docSnap) => {
      const rData = docSnap.data();
      if (rData.category === oldCategory.name) {
        batch.update(docSnap.ref, {
          category: newName,
          updatedAt: now,
        });
        affectedRecipesCount++;
      }
    });

    // 카테고리 자체 업데이트도 동일 batch에 포함
    const sanitized = removeUndefinedDeep(updatedDoc);
    batch.set(doc(db, CATEGORIES_COLLECTION, id), sanitized, { merge: true });
    await batch.commit();

    logger.info(
      'categoryService.updateCategory',
      `카테고리 및 연결 레시피 ${affectedRecipesCount}개 일괄 변경 완료`
    );
  } else {
    // 이름 변경이 아닌 경우 단일 업데이트
    const sanitized = removeUndefinedDeep(updatedDoc);
    await setDoc(doc(db, CATEGORIES_COLLECTION, id), sanitized, { merge: true });
  }

  return { updatedCategory: updatedDoc, affectedRecipesCount };
}

/**
 * 5. 카테고리 삭제 안전장치
 * - '기타' 카테고리는 삭제 불가 (보호)
 * - 연결된 레시피가 있다면 반드시 다른 카테고리(fallbackCategory)로 이동 후 삭제 실행
 */
export async function deleteCategory(
  id: string,
  categoryToDelete: RecipeCategoryDoc,
  targetCategoryName?: string
): Promise<{ migratedCount: number }> {
  if (id === 'etc' || categoryToDelete.name === FALLBACK_CATEGORY) {
    throw new Error(`'${FALLBACK_CATEGORY}' 카테고리는 시스템 기본 카테고리이므로 삭제할 수 없습니다.`);
  }

  if (!db || !isFirebaseReady) {
    throw new Error('Firestore 데이터베이스에 연결할 수 없습니다.');
  }

  // 1. 해당 카테고리를 사용하는 공개 레시피 확인
  const recipesColRef = collection(db, 'recipes');
  const recipesSnap = await getDocs(recipesColRef);
  const matchingRecipeDocs = recipesSnap.docs.filter(
    (docSnap) => docSnap.data().category === categoryToDelete.name
  );

  let migratedCount = 0;
  const now = Date.now();

  if (matchingRecipeDocs.length > 0) {
    const destination = (targetCategoryName || FALLBACK_CATEGORY).trim();
    if (!destination || destination === categoryToDelete.name) {
      throw new Error(
        `연결된 레시피(${matchingRecipeDocs.length}개)가 있습니다. 이동할 다른 카테고리를 선택해주세요.`
      );
    }

    logger.info(
      'categoryService.deleteCategory',
      `연결된 레시피 ${matchingRecipeDocs.length}개를 "${destination}" 카테고리로 이동 후 삭제합니다.`
    );

    const batch = writeBatch(db);
    matchingRecipeDocs.forEach((docSnap) => {
      batch.update(docSnap.ref, {
        category: destination,
        updatedAt: now,
      });
      migratedCount++;
    });

    batch.delete(doc(db, CATEGORIES_COLLECTION, id));
    await batch.commit();
  } else {
    // 연결된 레시피가 없으면 바로 카테고리 삭제
    await deleteDoc(doc(db, CATEGORIES_COLLECTION, id));
  }

  logger.info('categoryService.deleteCategory', `카테고리 "${categoryToDelete.name}" 삭제 완료`);
  return { migratedCount };
}

/**
 * 6. 카테고리 순서 일괄 변경 (▲, ▼ 또는 드래그앤드롭)
 */
export async function reorderCategories(orderedIds: string[]): Promise<void> {
  if (!db || !isFirebaseReady) {
    throw new Error('Firestore 데이터베이스에 연결할 수 없습니다.');
  }

  const batch = writeBatch(db);
  const now = Date.now();

  orderedIds.forEach((id, index) => {
    const docRef = doc(db, CATEGORIES_COLLECTION, id);
    batch.update(docRef, {
      order: index + 1,
      updatedAt: now,
    });
  });

  await batch.commit();
  logger.info('categoryService.reorderCategories', `카테고리 ${orderedIds.length}개 순서 변경 완료`);
}

/**
 * 7. 카테고리 활성/비활성 토글
 */
export async function toggleCategoryActive(id: string, currentActive: boolean): Promise<void> {
  if (!db || !isFirebaseReady) {
    throw new Error('Firestore 데이터베이스에 연결할 수 없습니다.');
  }

  const docRef = doc(db, CATEGORIES_COLLECTION, id);
  await setDoc(
    docRef,
    {
      isActive: !currentActive,
      updatedAt: Date.now(),
    },
    { merge: true }
  );
  logger.info('categoryService.toggleCategoryActive', `카테고리 ${id} 활성상태 변경: ${!currentActive}`);
}
