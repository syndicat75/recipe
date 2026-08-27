/**
 * @file src/utils/storage.ts
 * @description 로컬스토리지에 레시피, 즐겨찾기, 장보기, 메모, 최근 본 목록을 영속화하고 백업/복원을 지원하는 저장소 서비스
 */

import { APP_CONFIG } from '../config/appConfig';
import { INITIAL_RECIPES } from '../data/initialRecipes';
import { Recipe, ShoppingItem, RecipeBackupData } from '../types/recipe';
import { logger } from './logger';

/**
 * 로컬스토리지에서 전체 레시피 목록을 조회합니다.
 * 최초 실행 시 INITIAL_RECIPES 26개를 시드하여 로컬스토리지에 저장 후 반환합니다.
 * @returns 레시피 배열
 */
export function loadAllRecipes(): Recipe[] {
  logger.info('storage.loadAllRecipes', '전체 레시피 로드 시도');
  try {
    const raw = localStorage.getItem(APP_CONFIG.storageKeys.allRecipes);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        logger.info('storage.loadAllRecipes', `로컬스토리지에서 ${parsed.length}개 레시피 로드 완료`);
        return parsed;
      }
    }

    // 마이그레이션 확인 (이전 버전 커스텀 레시피가 있는 경우)
    const legacyCustomRaw = localStorage.getItem(APP_CONFIG.storageKeys.customRecipesLegacy);
    let legacyCustom: Recipe[] = [];
    if (legacyCustomRaw) {
      try {
        const parsedLegacy = JSON.parse(legacyCustomRaw);
        if (Array.isArray(parsedLegacy)) {
          legacyCustom = parsedLegacy;
        }
      } catch (e) {
        logger.warn('storage.loadAllRecipes', '레거시 커스텀 레시피 파싱 실패', e);
      }
    }

    // 초기 시드 생성
    const initialSeed: Recipe[] = [
      ...legacyCustom.map((r) => ({ ...r, syncScope: r.syncScope || ('local' as const) })),
      ...INITIAL_RECIPES.map((r, idx) => ({
        ...r,
        syncScope: 'public' as const,
        createdAt: Date.now() - (INITIAL_RECIPES.length - idx) * 1000,
        updatedAt: Date.now() - (INITIAL_RECIPES.length - idx) * 1000,
      })),
    ];

    localStorage.setItem(APP_CONFIG.storageKeys.allRecipes, JSON.stringify(initialSeed));
    logger.info('storage.loadAllRecipes', `초기 레시피 ${initialSeed.length}개 시딩 완료`);
    return initialSeed;
  } catch (error) {
    logger.error('storage.loadAllRecipes', '레시피 로드 중 예외 발생, 기본 레시피 반환', error);
    return INITIAL_RECIPES;
  }
}

/**
 * 전체 레시피 목록을 로컬스토리지에 영구 저장합니다.
 * @param recipes 저장할 전체 레시피 배열
 * @returns 저장 성공 여부 (boolean)
 */
export function saveAllRecipes(recipes: Recipe[]): boolean {
  logger.info('storage.saveAllRecipes', `전체 레시피 저장 (${recipes.length}개)`);
  try {
    const serialized = JSON.stringify(recipes);
    localStorage.setItem(APP_CONFIG.storageKeys.allRecipes, serialized);
    return true;
  } catch (error: any) {
    const isQuotaExceeded =
      error &&
      (error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        error.code === 22 ||
        error.code === 1014);

    if (isQuotaExceeded) {
      logger.error(
        'storage.saveAllRecipes',
        '로컬스토리지 용량 초과(QuotaExceededError)! 레시피 저장 실패. 브라우저 저장공간이 부족하거나 사진 용량이 너무 큽니다.',
        error
      );
    } else {
      logger.error('storage.saveAllRecipes', '레시피 저장 실패', error);
    }
    return false;
  }
}

/**
 * 즐겨찾기된 레시피 ID 목록을 조회합니다.
 * @returns 즐겨찾기 ID 배열
 */
export function getSavedBookmarks(): number[] {
  logger.debug('storage.getSavedBookmarks', '즐겨찾기 목록 로드');
  try {
    const raw = localStorage.getItem(APP_CONFIG.storageKeys.bookmarks);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    logger.error('storage.getSavedBookmarks', '즐겨찾기 파싱 실패', error);
    return [];
  }
}

/**
 * 즐겨찾기 레시피 ID 목록을 로컬스토리지에 저장합니다.
 * @param ids 저장할 레시피 ID 배열
 */
export function saveBookmarks(ids: number[]): void {
  logger.info('storage.saveBookmarks', `즐겨찾기 저장 (${ids.length}개)`);
  try {
    localStorage.setItem(APP_CONFIG.storageKeys.bookmarks, JSON.stringify(ids));
  } catch (error) {
    logger.error('storage.saveBookmarks', '즐겨찾기 저장 실패', error);
  }
}

/**
 * 장보기 목록을 로컬스토리지에서 가져옵니다.
 * @returns 장보기 아이템 목록 배열
 */
export function getSavedShoppingList(): ShoppingItem[] {
  logger.debug('storage.getSavedShoppingList', '장보기 목록 로드');
  try {
    const raw = localStorage.getItem(APP_CONFIG.storageKeys.shoppingList);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    logger.error('storage.getSavedShoppingList', '장보기 목록 파싱 실패', error);
    return [];
  }
}

/**
 * 장보기 목록을 로컬스토리지에 저장합니다.
 * @param items 저장할 장보기 아이템 목록 배열
 */
export function saveShoppingList(items: ShoppingItem[]): void {
  logger.info('storage.saveShoppingList', `장보기 목록 저장 (${items.length}개)`);
  try {
    localStorage.setItem(APP_CONFIG.storageKeys.shoppingList, JSON.stringify(items));
  } catch (error) {
    logger.error('storage.saveShoppingList', '장보기 목록 저장 실패', error);
  }
}

/**
 * 레시피별 사용자 메모 맵을 가져옵니다.
 * @returns 레시피 ID를 키로 하는 메모 객체
 */
export function getSavedRecipeNotes(): Record<number, string> {
  logger.debug('storage.getSavedRecipeNotes', '레시피 메모 로드');
  try {
    const raw = localStorage.getItem(APP_CONFIG.storageKeys.recipeNotes);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (error) {
    logger.error('storage.getSavedRecipeNotes', '레시피 메모 파싱 실패', error);
    return {};
  }
}

/**
 * 레시피별 사용자 메모 맵 전체를 로컬 스토리지에 저장합니다.
 * @param notes 레시피 ID를 키로 하는 메모 객체
 */
export function saveAllRecipeNotes(notes: Record<number, string>): void {
  logger.debug('storage.saveAllRecipeNotes', '전체 레시피 메모 일괄 저장');
  try {
    localStorage.setItem(APP_CONFIG.storageKeys.recipeNotes, JSON.stringify(notes || {}));
  } catch (error) {
    logger.error('storage.saveAllRecipeNotes', '레시피 메모 전체 저장 실패', error);
  }
}

/**
 * 특정 레시피에 대한 사용자 메모를 저장합니다.
 * @param recipeId 레시피 고유 ID
 * @param note 저장할 메모 텍스트
 */
export function saveRecipeNote(recipeId: number, note: string): void {
  logger.info('storage.saveRecipeNote', `레시피(${recipeId}) 메모 저장`);
  try {
    const currentNotes = getSavedRecipeNotes();
    if (note.trim()) {
      currentNotes[recipeId] = note.trim();
    } else {
      delete currentNotes[recipeId];
    }
    localStorage.setItem(APP_CONFIG.storageKeys.recipeNotes, JSON.stringify(currentNotes));
  } catch (error) {
    logger.error('storage.saveRecipeNote', '레시피 메모 저장 실패', error);
  }
}

/**
 * 최근 열어본 레시피 ID 목록을 조회합니다. (최대 5개)
 * @returns 최근 본 레시피 ID 배열
 */
export function getRecentRecipeIds(): number[] {
  logger.debug('storage.getRecentRecipeIds', '최근 본 레시피 ID 조회');
  try {
    const raw = localStorage.getItem(APP_CONFIG.storageKeys.recentRecipes);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    logger.error('storage.getRecentRecipeIds', '최근 본 레시피 파싱 실패', error);
    return [];
  }
}

/**
 * 최근 열어본 레시피 ID를 저장 목록 최상단에 추가합니다.
 * @param recipeId 최근 조회한 레시피 ID
 * @returns 갱신된 최근 본 레시피 ID 배열
 */
export function addRecentRecipeId(recipeId: number): number[] {
  logger.info('storage.addRecentRecipeId', `최근 본 레시피 ID 추가: ${recipeId}`);
  try {
    const current = getRecentRecipeIds().filter((id) => id !== recipeId);
    const updated = [recipeId, ...current].slice(0, APP_CONFIG.maxRecentRecipes);
    localStorage.setItem(APP_CONFIG.storageKeys.recentRecipes, JSON.stringify(updated));
    return updated;
  } catch (error) {
    logger.error('storage.addRecentRecipeId', '최근 본 레시피 저장 실패', error);
    return [];
  }
}

/**
 * 전체 레시피, 즐겨찾기, 메모, 장보기 목록을 포함하는 백업 JSON 객체를 생성하고 브라우저 파일 다운로드를 실행합니다.
 * @param allRecipes 현재 전체 레시피 목록
 * @param bookmarks 현재 즐겨찾기 ID 목록
 * @param userNotes 현재 메모 객체
 * @param shoppingList 현재 장보기 목록
 * @returns 백업 데이터 객체
 */
export function exportBackupJson(
  allRecipes: Recipe[],
  bookmarks: number[],
  userNotes: Record<number, string>,
  shoppingList: ShoppingItem[]
): RecipeBackupData {
  logger.info('storage.exportBackupJson', '데이터 백업 파일 생성 시작');
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const filename = `my-recipes-${dateStr}.json`;

  const backupData: RecipeBackupData = {
    app: APP_CONFIG.appName,
    version: APP_CONFIG.version,
    exportedAt: now.toISOString(),
    recipes: allRecipes,
    bookmarks,
    userNotes,
    shoppingList,
    recentRecipeIds: getRecentRecipeIds(),
  };

  try {
    const dataStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    logger.info('storage.exportBackupJson', `백업 파일 다운로드 트리거 완료: ${filename}`);
  } catch (err) {
    logger.error('storage.exportBackupJson', '백업 파일 생성 실패', err);
    throw err;
  }

  return backupData;
}

/**
 * 백업 JSON 데이터를 파싱하고 검증하여 로컬 데이터와 병합(merge) 또는 전체 교체(replace)합니다.
 * @param jsonContent 사용자가 업로드한 JSON 문자열
 * @param mode 'merge'(기존 데이터와 병합) 또는 'replace'(전체 교체)
 * @param currentRecipes 현재 레시피 목록
 * @param currentBookmarks 현재 즐겨찾기 목록
 * @param currentNotes 현재 메모 목록
 * @param currentShopping 현재 장보기 목록
 * @returns 복원 완료된 전체 상태 객체
 */
export function restoreBackupData(
  jsonContent: string,
  mode: 'merge' | 'replace',
  currentRecipes: Recipe[],
  currentBookmarks: number[],
  currentNotes: Record<number, string>,
  currentShopping: ShoppingItem[]
): {
  recipes: Recipe[];
  bookmarks: number[];
  userNotes: Record<number, string>;
  shoppingList: ShoppingItem[];
  recentIds: number[];
} {
  logger.info('storage.restoreBackupData', `데이터 복원 실행 (모드: ${mode})`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonContent);
  } catch (err) {
    logger.error('storage.restoreBackupData', 'JSON 파싱 실패', err);
    throw new Error('올바른 JSON 파일 형식이 아닙니다.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('유효한 백업 데이터 구조가 아닙니다.');
  }

  const data = parsed as Partial<RecipeBackupData>;
  if (!Array.isArray(data.recipes)) {
    throw new Error('백업 파일에 레시피 목록이 포함되어 있지 않습니다.');
  }

  let finalRecipes: Recipe[] = [];
  let finalBookmarks: number[] = [];
  let finalNotes: Record<number, string> = {};
  let finalShopping: ShoppingItem[] = [];
  let finalRecent: number[] = [];

  if (mode === 'replace') {
    finalRecipes = data.recipes;
    finalBookmarks = Array.isArray(data.bookmarks) ? data.bookmarks : [];
    finalNotes = typeof data.userNotes === 'object' && data.userNotes !== null ? data.userNotes : {};
    finalShopping = Array.isArray(data.shoppingList) ? data.shoppingList : [];
    finalRecent = Array.isArray(data.recentRecipeIds) ? data.recentRecipeIds : [];
  } else {
    // Merge mode
    const recipeMap = new Map<number, Recipe>();
    currentRecipes.forEach((r) => recipeMap.set(r.id, r));
    data.recipes.forEach((r) => {
      // 겹치면 백업 데이터로 갱신하거나 새 ID로 추가
      recipeMap.set(r.id, r);
    });
    finalRecipes = Array.from(recipeMap.values());

    const bookmarkSet = new Set<number>([
      ...currentBookmarks,
      ...(Array.isArray(data.bookmarks) ? data.bookmarks : []),
    ]);
    finalBookmarks = Array.from(bookmarkSet);

    finalNotes = {
      ...currentNotes,
      ...(typeof data.userNotes === 'object' && data.userNotes !== null ? data.userNotes : {}),
    };

    const shoppingMap = new Map<string, ShoppingItem>();
    currentShopping.forEach((s) => shoppingMap.set(s.id, s));
    if (Array.isArray(data.shoppingList)) {
      data.shoppingList.forEach((s) => shoppingMap.set(s.id, s));
    }
    finalShopping = Array.from(shoppingMap.values());
    finalRecent = Array.isArray(data.recentRecipeIds) ? data.recentRecipeIds : getRecentRecipeIds();
  }

  // 로컬스토리지에 저장
  saveAllRecipes(finalRecipes);
  saveBookmarks(finalBookmarks);
  localStorage.setItem(APP_CONFIG.storageKeys.recipeNotes, JSON.stringify(finalNotes));
  saveShoppingList(finalShopping);
  localStorage.setItem(APP_CONFIG.storageKeys.recentRecipes, JSON.stringify(finalRecent));

  logger.info('storage.restoreBackupData', `데이터 복원 완료 (레시피: ${finalRecipes.length}개)`);

  return {
    recipes: finalRecipes,
    bookmarks: finalBookmarks,
    userNotes: finalNotes,
    shoppingList: finalShopping,
    recentIds: finalRecent,
  };
}

/**
 * 주간 식단표 데이터를 로컬스토리지에서 로드합니다.
 * @returns 날짜별 식단 항목 맵 (키: YYYY-MM-DD)
 */
export function loadWeeklyMealPlan(): Record<string, import('../types/recipe').MealPlanEntry[]> {
  logger.debug('storage.loadWeeklyMealPlan', '주간 식단표 로드 시도');
  try {
    const raw = localStorage.getItem(APP_CONFIG.storageKeys.weeklyMealPlan);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (error) {
    logger.error('storage.loadWeeklyMealPlan', '식단표 파싱 실패', error);
    return {};
  }
}

/**
 * 주간 식단표 데이터를 로컬스토리지에 저장합니다.
 * @param plan 저장할 날짜별 식단 데이터 맵
 */
export function saveWeeklyMealPlan(plan: Record<string, import('../types/recipe').MealPlanEntry[]>): void {
  logger.info('storage.saveWeeklyMealPlan', `주간 식단표 저장 (등록 날짜 수: ${Object.keys(plan).length})`);
  try {
    localStorage.setItem(APP_CONFIG.storageKeys.weeklyMealPlan, JSON.stringify(plan));
  } catch (error) {
    logger.error('storage.saveWeeklyMealPlan', '식단표 저장 실패', error);
  }
}

/**
 * 오늘 뭐 먹지 최근 추천 레시피 ID 목록을 조회합니다. (중복 최소화용 최대 5개)
 * @returns 최근 추천 레시피 ID 배열
 */
export function getRecentRecommendations(): number[] {
  logger.debug('storage.getRecentRecommendations', '최근 추천 목록 로드');
  try {
    const raw = localStorage.getItem(APP_CONFIG.storageKeys.recentRecommendations);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    logger.error('storage.getRecentRecommendations', '최근 추천 목록 파싱 실패', error);
    return [];
  }
}

/**
 * 오늘 뭐 먹지 최근 추천 레시피 ID 목록을 저장합니다. (최대 5개 유지)
 * @param ids 저장할 추천 ID 배열
 */
export function saveRecentRecommendations(ids: number[]): void {
  logger.info('storage.saveRecentRecommendations', `최근 추천 목록 저장 (${ids.length}개)`);
  try {
    const sliced = ids.slice(-5);
    localStorage.setItem(APP_CONFIG.storageKeys.recentRecommendations, JSON.stringify(sliced));
  } catch (error) {
    logger.error('storage.saveRecentRecommendations', '최근 추천 목록 저장 실패', error);
  }
}

/**
 * 특정 레시피의 저장된 요리 진행 상황을 조회합니다.
 * @param recipeId 레시피 ID
 * @returns 요리 진행 상태 또는 null
 */
export function loadCookingProgress(recipeId: number): import('../types/recipe').CookingProgressState | null {
  logger.debug('storage.loadCookingProgress', `요리 진행상태 로드: 레시피 ID ${recipeId}`);
  try {
    const raw = localStorage.getItem(APP_CONFIG.storageKeys.cookingProgress);
    if (!raw) return null;
    const map = JSON.parse(raw);
    if (map && typeof map === 'object' && map[recipeId]) {
      return map[recipeId];
    }
    return null;
  } catch (error) {
    logger.error('storage.loadCookingProgress', '진행상태 로드 실패', error);
    return null;
  }
}

/**
 * 특정 레시피의 요리 진행 상황을 저장합니다.
 * @param state 저장할 요리 진행 상태
 */
export function saveCookingProgress(state: import('../types/recipe').CookingProgressState): void {
  logger.info('storage.saveCookingProgress', `요리 진행상태 저장: 레시피 ID ${state.recipeId}, 단계 ${state.currentStepIndex}`);
  try {
    const raw = localStorage.getItem(APP_CONFIG.storageKeys.cookingProgress);
    const map = raw ? JSON.parse(raw) : {};
    map[state.recipeId] = state;
    localStorage.setItem(APP_CONFIG.storageKeys.cookingProgress, JSON.stringify(map));
  } catch (error) {
    logger.error('storage.saveCookingProgress', '진행상태 저장 실패', error);
  }
}

/**
 * 특정 레시피의 요리 진행 상황을 초기화합니다.
 * @param recipeId 레시피 ID
 */
export function clearCookingProgress(recipeId: number): void {
  logger.info('storage.clearCookingProgress', `요리 진행상태 초기화: 레시피 ID ${recipeId}`);
  try {
    const raw = localStorage.getItem(APP_CONFIG.storageKeys.cookingProgress);
    if (!raw) return;
    const map = JSON.parse(raw);
    delete map[recipeId];
    localStorage.setItem(APP_CONFIG.storageKeys.cookingProgress, JSON.stringify(map));
  } catch (error) {
    logger.error('storage.clearCookingProgress', '진행상태 초기화 실패', error);
  }
}

/**
 * 사용자 가족 프로필을 로컬스토리지에서 조회합니다.
 * 없으면 임의의 로컬 고유 ID를 생성하여 반환합니다.
 * @returns 가족 사용자 프로필
 */
export function loadFamilyProfile(): import('../types/recipe').FamilyUserProfile {
  logger.debug('storage.loadFamilyProfile', '가족 사용자 프로필 로드');
  try {
    const raw = localStorage.getItem(APP_CONFIG.storageKeys.familyProfile);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id) return parsed;
    }
  } catch (error) {
    logger.error('storage.loadFamilyProfile', '프로필 파싱 실패', error);
  }
  const defaultProfile: import('../types/recipe').FamilyUserProfile = {
    id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: '나의 요리사',
    currentFamilyId: null,
    avatar: '👨‍🍳',
  };
  try {
    localStorage.setItem(APP_CONFIG.storageKeys.familyProfile, JSON.stringify(defaultProfile));
  } catch {
    // 무시
  }
  return defaultProfile;
}

/**
 * 사용자 가족 프로필을 저장합니다.
 * @param profile 저장할 프로필
 */
export function saveFamilyProfile(profile: import('../types/recipe').FamilyUserProfile): void {
  logger.info('storage.saveFamilyProfile', `가족 프로필 저장: ${profile.name} (가족 ID: ${profile.currentFamilyId})`);
  try {
    localStorage.setItem(APP_CONFIG.storageKeys.familyProfile, JSON.stringify(profile));
  } catch (error) {
    logger.error('storage.saveFamilyProfile', '프로필 저장 실패', error);
  }
}

/**
 * 로컬에 캐시된 가족 공간 목록을 조회합니다.
 * @returns 가족 공간 배열
 */
export function loadFamilySpaces(): import('../types/recipe').FamilySpace[] {
  logger.debug('storage.loadFamilySpaces', '가족 공간 목록 로드');
  try {
    const raw = localStorage.getItem(APP_CONFIG.storageKeys.familySpaces);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    logger.error('storage.loadFamilySpaces', '가족 공간 파싱 실패', error);
    return [];
  }
}

/**
 * 가족 공간 목록을 로컬에 저장합니다.
 * @param spaces 가족 공간 배열
 */
export function saveFamilySpaces(spaces: import('../types/recipe').FamilySpace[]): void {
  logger.info('storage.saveFamilySpaces', `가족 공간 저장 (${spaces.length}개)`);
  try {
    localStorage.setItem(APP_CONFIG.storageKeys.familySpaces, JSON.stringify(spaces));
  } catch (error) {
    logger.error('storage.saveFamilySpaces', '가족 공간 저장 실패', error);
  }
}
