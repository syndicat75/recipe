/**
 * @file src/hooks/usePublicRecipes.ts
 * @description Firestore /recipes 공개 레시피 컬렉션 실시간 구독 및 관리자 CRUD 훅.
 * 단일 진실 공급원(Single Source of Truth) 원칙을 준수하며, 오프라인 시 로컬 캐시를 활용합니다.
 */

import { useState, useEffect, useCallback } from 'react';
import { Recipe, SaveRecipeResult } from '../types/recipe';
import { loadAllRecipes, saveAllRecipes } from '../utils/storage';
import {
  subscribeToPublicRecipes,
  savePublicRecipe,
  deletePublicRecipe,
} from '../services/firestoreSync';
import { logger } from '../utils/logger';
import { formatFirestoreError } from '../utils/firestoreSanitizer';

export interface UsePublicRecipesOptions {
  /** 관리자 여부 */
  isAdmin: boolean;
  /** 토스트 알림 함수 */
  showToast?: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export interface UsePublicRecipesReturn {
  /** 공개 레시피 목록 */
  recipes: Recipe[];
  /** 레시피 목록 수동 상태 변경자 */
  setRecipes: React.Dispatch<React.SetStateAction<Recipe[]>>;
  /** 레시피 로딩 상태 */
  isLoadingRecipes: boolean;
  /** 레시피 동기화 에러 메시지 */
  recipeSyncError: string | null;
  /** 레시피 등록/수정 함수 */
  saveRecipe: (recipeData: Recipe) => Promise<SaveRecipeResult>;
  /** 레시피 삭제 함수 */
  deleteRecipe: (recipeId: number) => Promise<boolean>;
}

/**
 * 공개 레시피 관리 및 실시간 동기화 훅
 * @param options { isAdmin, showToast }
 */
export function usePublicRecipes({
  isAdmin,
  showToast,
}: UsePublicRecipesOptions): UsePublicRecipesReturn {
  const [recipes, setRecipes] = useState<Recipe[]>(() => loadAllRecipes());
  const [isLoadingRecipes, setIsLoadingRecipes] = useState<boolean>(true);
  const [recipeSyncError, setRecipeSyncError] = useState<string | null>(null);

  // 1. 공개 레시피 컬렉션 실시간 구독 (/recipes)
  // 단일 진실 공급원(Single Source of Truth): 로그인 여부와 관계없이 모든 방문자에게 동일한 레시피 제공
  useEffect(() => {
    logger.info('usePublicRecipes', '공개 레시피(/recipes) 실시간 리스너 등록');
    setIsLoadingRecipes(true);

    const unsub = subscribeToPublicRecipes(
      (incomingPublic) => {
        logger.info('usePublicRecipes', `공개 레시피 수신: ${incomingPublic.length}개`);
        setRecipes(incomingPublic);
        setIsLoadingRecipes(false);
        setRecipeSyncError(null);
        const saved = saveAllRecipes(incomingPublic);
        if (!saved) {
          logger.warn('usePublicRecipes', '공개 레시피 로컬 캐시 저장 실패');
        }
      },
      (err) => {
        logger.warn('usePublicRecipes', '공개 레시피 구독 실패 - 기존 캐시 유지', err);
        setIsLoadingRecipes(false);
        setRecipeSyncError(err?.message || '레시피 동기화 실패');
        const cached = loadAllRecipes();
        if (cached.length > 0) {
          setRecipes(cached);
        }
      }
    );

    return () => {
      logger.info('usePublicRecipes', '공개 레시피 리스너 해제');
      unsub();
    };
  }, []);

  /**
   * 레시피 등록 또는 수정 저장 핸들러 (관리자 전용)
   * Firestore /recipes 단일 진실 공급원에 저장하고 로컬 캐시를 갱신합니다.
   */
  const saveRecipe = useCallback(
    async (recipeData: Recipe): Promise<SaveRecipeResult> => {
      logger.info(
        'usePublicRecipes.saveRecipe',
        `레시피 저장 시도: ${recipeData.name} (ID: ${recipeData.id}, isAdmin: ${isAdmin})`
      );

      if (!isAdmin) {
        logger.warn('usePublicRecipes.saveRecipe', '비관리자의 레시피 등록/수정 시도 차단');
        if (showToast) {
          showToast('🔒 관리자만 등록 및 수정할 수 있습니다.', 'warning');
        }
        return {
          success: false,
          error: '관리자만 등록 및 수정할 수 있습니다.',
        };
      }

      const normalizedRecipe: Recipe = {
        ...recipeData,
        syncScope: 'public',
        updatedAt: Date.now(),
      };

      try {
        await savePublicRecipe(normalizedRecipe);
      } catch (err) {
        logger.error('usePublicRecipes.saveRecipe', '공개 레시피 클라우드 저장 실패', err);
        const friendlyMessage = formatFirestoreError(err, '공개 레시피 클라우드 저장에 실패했습니다.');
        if (showToast) {
          showToast(friendlyMessage, 'error');
        }
        return {
          success: false,
          error: friendlyMessage,
        };
      }

      // 로컬 상태 및 localStorage 캐시 즉시 갱신
      setRecipes((prev) => {
        const next = [
          normalizedRecipe,
          ...prev.filter((r) => r.id !== normalizedRecipe.id),
        ];
        saveAllRecipes(next);
        return next;
      });

      return { success: true, scope: 'public' };
    },
    [isAdmin, showToast]
  );

  /**
   * 레시피 삭제 처리 (관리자 전용)
   */
  const deleteRecipe = useCallback(
    async (recipeId: number): Promise<boolean> => {
      logger.info('usePublicRecipes.deleteRecipe', `레시피 삭제 시도: ID ${recipeId}`);
      if (!isAdmin) {
        if (showToast) {
          showToast('🔒 관리자만 삭제할 수 있습니다.', 'warning');
        }
        return false;
      }

      try {
        await deletePublicRecipe(recipeId);
        setRecipes((prev) => {
          const next = prev.filter((r) => r.id !== recipeId);
          saveAllRecipes(next);
          return next;
        });
        return true;
      } catch (err) {
        logger.error('usePublicRecipes.deleteRecipe', '공개 레시피 삭제 실패', err);
        const friendlyMessage = formatFirestoreError(err, '공개 레시피 삭제 중 오류가 발생했습니다.');
        if (showToast) {
          showToast(friendlyMessage, 'error');
        }
        return false;
      }
    },
    [isAdmin, showToast]
  );

  return {
    recipes,
    setRecipes,
    isLoadingRecipes,
    recipeSyncError,
    saveRecipe,
    deleteRecipe,
  };
}
