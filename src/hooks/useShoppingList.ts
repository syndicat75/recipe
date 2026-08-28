/**
 * @file src/hooks/useShoppingList.ts
 * @description 개인 장보기 목록 관리 및 Firestore 클라우드 동기화 훅.
 * 가족 장보기 목록과 명확히 격리되어 개인 단위의 아이템 추가/수정/삭제를 처리합니다.
 */

import { useState, useEffect, useCallback } from 'react';
import { ShoppingItem } from '../types/recipe';
import { FirebaseAuthUser, SyncStatus } from '../types/firebase';
import { getSavedShoppingList, saveShoppingList } from '../utils/storage';
import {
  subscribeToUserShopping,
  saveShoppingItemToCloud,
  deleteShoppingItemFromCloud,
  syncAllShoppingItemsToCloud,
} from '../services/firestoreSync';
import { logger } from '../utils/logger';

export interface UseShoppingListOptions {
  /** 현재 로그인한 Firebase 사용자 객체 */
  user: FirebaseAuthUser | null;
  /** 동기화 상태 설정 콜백 */
  setSyncStatus?: React.Dispatch<React.SetStateAction<SyncStatus>>;
  /** 토스트 알림 함수 */
  showToast?: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export interface UseShoppingListReturn {
  /** 개인 장보기 목록 */
  shoppingList: ShoppingItem[];
  /** 장보기 목록 상태 변경자 */
  setShoppingList: React.Dispatch<React.SetStateAction<ShoppingItem[]>>;
  /** 장보기 단일 아이템 추가 */
  addShoppingItem: (text: string, sourceName?: string) => void;
  /** 장보기 아이템 일괄 추가 */
  addAllShoppingItems: (items: string[], sourceName?: string) => void;
  /** 장보기 완료 여부 토글 */
  toggleShoppingItem: (id: string) => void;
  /** 장보기 단일 아이템 삭제 */
  deleteShoppingItem: (id: string) => void;
  /** 완료된 장보기 아이템 일괄 정리 */
  clearCompletedShopping: () => void;
  /** 장보기 목록 전체 비우기 */
  clearAllShopping: () => void;
  /** 로그아웃 시 로컬 스토리지 데이터로 복원 */
  restoreLocalShoppingList: () => void;
}

/**
 * 개인 장보기 목록 관리 훅
 * @param options { user, setSyncStatus, showToast }
 */
export function useShoppingList({
  user,
  setSyncStatus,
  showToast,
}: UseShoppingListOptions): UseShoppingListReturn {
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(() => getSavedShoppingList());

  // 로그인 사용자 개인 장보기 목록 리스너 (/users/{uid}/shoppingItems)
  useEffect(() => {
    if (!user) {
      return;
    }

    logger.info('useShoppingList', `장보기 동기화 연결: UID ${user.uid}`);
    const unsub = subscribeToUserShopping(
      user.uid,
      (cloudShopping) => {
        logger.info('useShoppingList', `클라우드 장보기 수신: ${cloudShopping.length}개`);
        setShoppingList(cloudShopping);
        saveShoppingList(cloudShopping);
        if (setSyncStatus) {
          setSyncStatus('synced');
        }
      },
      (err) => {
        logger.warn('useShoppingList', '장보기 구독 경고', err);
        if (setSyncStatus) {
          setSyncStatus('synced');
        }
      }
    );

    return () => {
      logger.info('useShoppingList', '장보기 리스너 해제');
      unsub();
    };
  }, [user, setSyncStatus]);

  /**
   * 장보기 단일 아이템 추가
   */
  const addShoppingItem = useCallback(
    (text: string, sourceName?: string): void => {
      if (!text.trim()) return;
      logger.info('useShoppingList.addShoppingItem', `장보기 추가: ${text}`);
      const newItem: ShoppingItem = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        text: text.trim(),
        completed: false,
        sourceRecipeName: sourceName,
        createdAt: Date.now(),
      };
      setShoppingList((prev) => {
        const next = [newItem, ...prev];
        saveShoppingList(next);
        return next;
      });

      if (user) {
        saveShoppingItemToCloud(user.uid, newItem).catch((err) => {
          logger.error('useShoppingList.addShoppingItem', '클라우드 장보기 저장 에러', err);
        });
      }
    },
    [user]
  );

  /**
   * 장보기 여러 아이템 일괄 추가
   */
  const addAllShoppingItems = useCallback(
    (items: string[], sourceName?: string): void => {
      if (!items || items.length === 0) return;
      logger.info('useShoppingList.addAllShoppingItems', `장보기 일괄 추가: ${items.length}개`);
      const newItems: ShoppingItem[] = items
        .map((text) => text.trim())
        .filter(Boolean)
        .map((text, idx) => ({
          id: `${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
          text: text,
          completed: false,
          sourceRecipeName: sourceName,
          createdAt: Date.now() + idx,
        }));

      setShoppingList((prev) => {
        const next = [...newItems, ...prev];
        saveShoppingList(next);
        return next;
      });

      if (user) {
        Promise.all(newItems.map((item) => saveShoppingItemToCloud(user.uid, item))).catch((err) => {
          logger.error('useShoppingList.addAllShoppingItems', '클라우드 일괄 장보기 저장 에러', err);
        });
      }
    },
    [user]
  );

  /**
   * 장보기 완료 토글
   */
  const toggleShoppingItem = useCallback(
    (id: string): void => {
      logger.info('useShoppingList.toggleShoppingItem', `장보기 완료 토글: ${id}`);
      setShoppingList((prev) => {
        const target = prev.find((item) => item.id === id);
        const next = prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item));
        saveShoppingList(next);
        if (user && target) {
          saveShoppingItemToCloud(user.uid, { ...target, completed: !target.completed }).catch((err) => {
            logger.error('useShoppingList.toggleShoppingItem', '클라우드 장보기 수정 에러', err);
          });
        }
        return next;
      });
    },
    [user]
  );

  /**
   * 장보기 단일 삭제
   */
  const deleteShoppingItem = useCallback(
    (id: string): void => {
      logger.info('useShoppingList.deleteShoppingItem', `장보기 삭제: ${id}`);
      setShoppingList((prev) => {
        const next = prev.filter((item) => item.id !== id);
        saveShoppingList(next);
        if (user) {
          deleteShoppingItemFromCloud(user.uid, id).catch((err) => {
            logger.error('useShoppingList.deleteShoppingItem', '클라우드 장보기 삭제 에러', err);
          });
        }
        return next;
      });
    },
    [user]
  );

  /**
   * 완료된 장보기 항목 정리
   */
  const clearCompletedShopping = useCallback((): void => {
    logger.info('useShoppingList.clearCompletedShopping', '완료 항목 일괄 정리');
    setShoppingList((prev) => {
      const next = prev.filter((item) => !item.completed);
      saveShoppingList(next);
      if (user) {
        syncAllShoppingItemsToCloud(user.uid, next).catch((err) => {
          logger.error('useShoppingList.clearCompletedShopping', '클라우드 장보기 정리 에러', err);
        });
      }
      return next;
    });
    if (showToast) {
      showToast('🧹 완료된 장보기 항목이 정리되었습니다.', 'info');
    }
  }, [user, showToast]);

  /**
   * 장보기 목록 전체 비우기
   */
  const clearAllShopping = useCallback((): void => {
    logger.info('useShoppingList.clearAllShopping', '장보기 전체 비우기');
    setShoppingList([]);
    saveShoppingList([]);
    if (user) {
      syncAllShoppingItemsToCloud(user.uid, []).catch((err) => {
        logger.error('useShoppingList.clearAllShopping', '클라우드 장보기 전체 비우기 에러', err);
      });
    }
    if (showToast) {
      showToast('🗑️ 장보기 목록이 비워졌습니다.', 'info');
    }
  }, [user, showToast]);

  /**
   * 로그아웃 시 로컬 스토리지 장보기 데이터 복원
   */
  const restoreLocalShoppingList = useCallback((): void => {
    logger.info('useShoppingList.restoreLocalShoppingList', '로컬 스토리지 장보기 복원');
    const localShopping = getSavedShoppingList();
    setShoppingList(localShopping);
  }, []);

  return {
    shoppingList,
    setShoppingList,
    addShoppingItem,
    addAllShoppingItems,
    toggleShoppingItem,
    deleteShoppingItem,
    clearCompletedShopping,
    clearAllShopping,
    restoreLocalShoppingList,
  };
}
