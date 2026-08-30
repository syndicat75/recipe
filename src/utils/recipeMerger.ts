/**
 * @file src/utils/recipeMerger.ts
 * @description 3단계 레시피 저장소(공개 /recipes, 개인 /users/{uid}/recipes, 로컬 localStorage)의
 * 목록을 안전하게 병합하고 충돌을 해결하는 전용 병합 유틸리티입니다.
 */

import { Recipe } from '../types/recipe';
import { logger } from './logger';

/**
 * 타임스탬프 또는 날짜 문자열을 숫자 밀리초로 정규화합니다.
 * @param val 타임스탬프(number) 또는 ISO 문자열(string)
 * @returns 정규화된 밀리초 타임스탬프 (유효하지 않을 경우 0)
 */
export function getRecipeTimestamp(val?: number | string): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
}

/**
 * 로컬 레시피와 클라우드 레시피를 ID 기준으로 스마트 병합
 */
export function mergeRecipeLists(localRecipes: Recipe[], cloudRecipes: Recipe[]): Recipe[] {
  logger.info(
    'recipeMerger.mergeRecipeLists',
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
      const localUpdated = getRecipeTimestamp(local.updatedAt || local.createdAt);
      const existingUpdated = getRecipeTimestamp(existing.updatedAt || existing.createdAt);

      if (localUpdated > existingUpdated) {
        recipeMap.set(local.id, { ...existing, ...local });
      }
    }
  });

  return Array.from(recipeMap.values());
}

/**
 * 공개(/recipes), 개인(/users/{uid}/recipes), 로컬(localStorage) 3단계 레시피 목록을
 * ID 기준으로 안전하게 병합합니다.
 * 
 * 병합 규칙:
 * 1. 공개(public) 레시피를 기본 베이스로 설정합니다.
 * 2. 개인(private) 레시피를 병합합니다 (동일 ID 충돌 시 개인 레시피가 공개 레시피보다 우선).
 * 3. 로컬(local) 레시피를 병합합니다 (비로그인 기기 전용 수정/생성분 반영, 최신 updatedAt 비교).
 * 4. Firestore 공개 스냅샷이 새로 오더라도 사용자의 개인/로컬 레시피를 덮어쓰거나 유실시키지 않습니다.
 * 
 * @param publicRecipes Firestore /recipes에서 수신한 공개 레시피 목록
 * @param privateRecipes Firestore /users/{uid}/recipes에서 수신한 사용자 개인 레시피 목록
 * @param localRecipes 기기 localStorage에 보관 중인 로컬 전용 레시피 목록
 * @returns 3단계 데이터가 완벽하게 통합된 레시피 목록
 */
export function mergeThreeTiers(
  publicRecipes: Recipe[] = [],
  privateRecipes: Recipe[] = [],
  localRecipes: Recipe[] = []
): Recipe[] {
  logger.info(
    'recipeMerger.mergeThreeTiers',
    `3단계 병합 시작: 공개 ${publicRecipes.length}개, 개인 ${privateRecipes.length}개, 로컬 ${localRecipes.length}개`
  );

  const mergedMap = new Map<number, Recipe>();

  // 1단계: 공개 레시피 (기본 베이스)
  for (const item of publicRecipes) {
    if (!item || typeof item.id !== 'number') continue;
    mergedMap.set(item.id, {
      ...item,
      syncScope: 'public',
    });
  }

  // 2단계: 로그인 사용자의 개인 레시피 (/users/{uid}/recipes)
  // 개인 레시피는 공개 레시피를 오버라이드하여 사용자 개인 맞춤형 내용을 우선 보존
  for (const item of privateRecipes) {
    if (!item || typeof item.id !== 'number') continue;
    const normalized: Recipe = {
      ...item,
      syncScope: 'private',
    };
    mergedMap.set(item.id, normalized);
  }

  // 3단계: 현재 기기의 로컬 레시피 (localStorage)
  for (const item of localRecipes) {
    if (!item || typeof item.id !== 'number') continue;
    const normalized: Recipe = {
      ...item,
      syncScope: 'local',
    };

    const existing = mergedMap.get(item.id);
    if (!existing) {
      // 신규 등록된 로컬 레시피
      mergedMap.set(item.id, normalized);
    } else {
      // 기존에 동일 ID가 있는 경우
      if (existing.syncScope === 'public') {
        // 공개 레시피보다 로컬 수정본을 우선
        mergedMap.set(item.id, normalized);
      } else if (existing.syncScope === 'private') {
        // 개인 클라우드 레시피와 로컬 레시피 충돌 시 더 최신 updatedAt을 가진 쪽 채택
        const existingTs = getRecipeTimestamp(existing.updatedAt || existing.createdAt);
        const localTs = getRecipeTimestamp(normalized.updatedAt || normalized.createdAt);
        if (localTs > existingTs) {
          mergedMap.set(item.id, normalized);
        }
      }
    }
  }

  const result = Array.from(mergedMap.values());
  logger.info('recipeMerger.mergeThreeTiers', `3단계 병합 완료: 총 ${result.length}개 산출`);
  return result;
}

/**
 * 레시피 목록에서 특정 syncScope를 가진 레시피들만 필터링합니다.
 * @param recipes 전체 레시피 목록
 * @param scope 필터링할 동기화 스코프 ('public' | 'private' | 'local')
 * @returns 필터링된 레시피 목록
 */
export function filterRecipesByScope(
  recipes: Recipe[],
  scope: 'public' | 'private' | 'local'
): Recipe[] {
  logger.debug('recipeMerger.filterRecipesByScope', `스코프 필터링 [${scope}]`);
  return recipes.filter((r) => r.syncScope === scope);
}
