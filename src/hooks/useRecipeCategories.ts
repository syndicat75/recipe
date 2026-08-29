/**
 * @file src/hooks/useRecipeCategories.ts
 * @description Firestore /recipeCategories 실시간 동기화 및 카테고리 관리 훅
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { RecipeCategoryDoc } from '../types/recipe';
import { DEFAULT_CATEGORY_DOCS, FALLBACK_CATEGORY } from '../config/appConfig';
import {
  subscribeToCategories,
  initDefaultCategoriesIfEmpty,
  addCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  toggleCategoryActive,
} from '../services/categoryService';
import { logger } from '../utils/logger';

interface UseRecipeCategoriesProps {
  isAdmin?: boolean;
  showToast?: (msg: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export function useRecipeCategories({ isAdmin = false, showToast }: UseRecipeCategoriesProps = {}) {
  const [categories, setCategories] = useState<RecipeCategoryDoc[]>(DEFAULT_CATEGORY_DOCS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasInitializedDefault, setHasInitializedDefault] = useState<boolean>(false);

  // 1. 실시간 구독
  useEffect(() => {
    logger.info('useRecipeCategories', '카테고리 실시간 리스너 바인딩');

    const unsubscribe = subscribeToCategories(
      (updatedCats) => {
        if (updatedCats && updatedCats.length > 0) {
          setCategories(updatedCats);
        }
        setIsLoading(false);
      },
      (err) => {
        logger.error('useRecipeCategories', '카테고리 실시간 수신 오류', err);
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // 2. 관리자 로그인 시 Firestore 기본 카테고리가 비어있으면 1회 자동 초기화
  useEffect(() => {
    if (!isAdmin || hasInitializedDefault || isLoading) return;

    // 만약 현재 categories가 DEFAULT_CATEGORY_DOCS와 동일하지만 Firestore에 없을 수 있으므로 체크
    initDefaultCategoriesIfEmpty(isAdmin)
      .then((seeded) => {
        if (seeded) {
          logger.info('useRecipeCategories', 'Firestore 기본 카테고리 초기화 성공');
        }
        setHasInitializedDefault(true);
      })
      .catch((err) => {
        logger.error('useRecipeCategories', '기본 카테고리 초기화 확인 실패', err);
        setHasInitializedDefault(true);
      });
  }, [isAdmin, hasInitializedDefault, isLoading]);

  // 3. 활성화된 카테고리 목록 (isActive !== false)
  const activeCategories = useMemo(() => {
    return categories.filter((c) => c.isActive);
  }, [categories]);

  // 4. 활성화된 카테고리 이름 배열
  const activeCategoryNames = useMemo(() => {
    const names = activeCategories.map((c) => c.name);
    // 혹시 '기타'가 활성 목록에 빠져있다면 안전하게 포함
    if (!names.includes(FALLBACK_CATEGORY)) {
      names.push(FALLBACK_CATEGORY);
    }
    return names;
  }, [activeCategories]);

  // 5. 작업 핸들러
  const addNewCategory = useCallback(
    async (input: { name: string; icon?: string }) => {
      return await addCategory(input, categories);
    },
    [categories]
  );

  const editCategory = useCallback(
    async (
      id: string,
      updates: { name?: string; icon?: string; isActive?: boolean },
      oldCat: RecipeCategoryDoc
    ) => {
      return await updateCategory(id, updates, oldCat, categories);
    },
    [categories]
  );

  const removeCategory = useCallback(
    async (id: string, catToDelete: RecipeCategoryDoc, targetCategoryName?: string) => {
      return await deleteCategory(id, catToDelete, targetCategoryName);
    },
    []
  );

  const moveOrder = useCallback(
    async (orderedCategoryIds: string[]) => {
      // 로컬 즉각 반영 (낙관적 업데이트)
      setCategories((prev) => {
        const map = new Map(prev.map((c) => [c.id, c]));
        return orderedCategoryIds
          .map((id, idx) => {
            const item = map.get(id);
            return item ? { ...item, order: idx + 1 } : null;
          })
          .filter((c): c is RecipeCategoryDoc => c !== null);
      });

      await reorderCategories(orderedCategoryIds);
    },
    []
  );

  const toggleActive = useCallback(
    async (id: string, currentActive: boolean) => {
      // 로컬 즉각 반영 (낙관적 업데이트)
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isActive: !currentActive } : c))
      );

      await toggleCategoryActive(id, currentActive);
    },
    []
  );

  return {
    categories,
    activeCategories,
    activeCategoryNames,
    isLoading,
    addNewCategory,
    addCategory: addNewCategory,
    editCategory,
    updateCategory: editCategory,
    removeCategory,
    deleteCategory: removeCategory,
    moveOrder,
    reorderCategories: moveOrder,
    toggleActive,
    toggleCategoryActive: toggleActive,
  };
}
