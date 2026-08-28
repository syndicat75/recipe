/**
 * @file src/hooks/useRecipePreferences.ts
 * @description 사용자 개인 설정(즐겨찾기, 레시피 메모, 최근 본 레시피) 및 Firebase 동기화 훅.
 */

import { useState, useEffect, useCallback } from 'react';
import { FirebaseAuthUser } from '../types/firebase';
import {
  getSavedBookmarks,
  saveBookmarks,
  getSavedRecipeNotes,
  saveRecipeNote,
  saveAllRecipeNotes,
  getRecentRecipeIds,
  addRecentRecipeId,
} from '../utils/storage';
import {
  subscribeToUserSettings,
  saveBookmarksToCloud,
  saveRecipeNoteToCloud,
} from '../services/firestoreSync';
import { logger } from '../utils/logger';

export interface UseRecipePreferencesOptions {
  /** 현재 로그인한 Firebase 사용자 객체 */
  user: FirebaseAuthUser | null;
  /** 토스트 알림 함수 */
  showToast?: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export interface UseRecipePreferencesReturn {
  /** 즐겨찾기 레시피 ID 목록 */
  bookmarkedIds: number[];
  /** 레시피별 사용자 메모 맵 */
  userNotes: Record<number, string>;
  /** 최근 본 레시피 ID 목록 */
  recentRecipeIds: number[];
  /** 즐겨찾기 상태 변경자 */
  setBookmarkedIds: React.Dispatch<React.SetStateAction<number[]>>;
  /** 메모 상태 변경자 */
  setUserNotes: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  /** 최근 본 레시피 상태 변경자 */
  setRecentRecipeIds: React.Dispatch<React.SetStateAction<number[]>>;
  /** 즐겨찾기 토글 함수 */
  toggleBookmark: (recipeId: number) => void;
  /** 레시피 사용자 메모 저장 함수 */
  updateRecipeNote: (recipeId: number, note: string) => void;
  /** 최근 본 레시피 추가 함수 */
  addRecentRecipe: (recipeId: number) => void;
  /** 로그아웃 시 로컬 스토리지 데이터로 복원하는 함수 */
  restoreLocalPreferences: () => void;
}

/**
 * 사용자 개인 설정 및 클라우드 동기화 훅
 * @param options { user, showToast }
 */
export function useRecipePreferences({
  user,
  showToast,
}: UseRecipePreferencesOptions): UseRecipePreferencesReturn {
  const [bookmarkedIds, setBookmarkedIds] = useState<number[]>(() => getSavedBookmarks());
  const [userNotes, setUserNotes] = useState<Record<number, string>>(() => getSavedRecipeNotes());
  const [recentRecipeIds, setRecentRecipeIds] = useState<number[]>(() => getRecentRecipeIds());

  // 로그인 사용자 개인 설정(북마크, 메모) 실시간 동기화
  useEffect(() => {
    if (!user) {
      logger.info('useRecipePreferences', '게스트 상태: 로컬 개인 설정 유지');
      return;
    }

    logger.info('useRecipePreferences', `개인 설정 동기화 연결: UID ${user.uid}`);
    const unsub = subscribeToUserSettings(
      user.uid,
      ({ bookmarks, notes }) => {
        logger.info(
          'useRecipePreferences',
          `클라우드 개인 설정 수신: 북마크 ${bookmarks.length}개, 메모 ${Object.keys(notes).length}개`
        );
        setBookmarkedIds(bookmarks);
        saveBookmarks(bookmarks);
        setUserNotes(notes);
        saveAllRecipeNotes(notes);
      },
      (err) => {
        logger.warn('useRecipePreferences', '개인 설정 구독 에러', err);
      }
    );

    return () => {
      logger.info('useRecipePreferences', '개인 설정 리스너 해제');
      unsub();
    };
  }, [user]);

  /**
   * 북마크 토글 이벤트 핸들러
   */
  const toggleBookmark = useCallback(
    (recipeId: number): void => {
      logger.info('useRecipePreferences.toggleBookmark', `즐겨찾기 토글: ID ${recipeId}`);
      setBookmarkedIds((prev) => {
        const isExisting = prev.includes(recipeId);
        const next = isExisting ? prev.filter((id) => id !== recipeId) : [...prev, recipeId];
        saveBookmarks(next);
        if (user) {
          saveBookmarksToCloud(user.uid, next).catch((err) => {
            logger.error('useRecipePreferences.toggleBookmark', '클라우드 즐겨찾기 동기화 실패', err);
          });
        }
        if (showToast) {
          showToast(isExisting ? '🤍 즐겨찾기에서 제거되었습니다.' : '⭐ 즐겨찾기에 추가되었습니다!', 'success');
        }
        return next;
      });
    },
    [user, showToast]
  );

  /**
   * 레시피 사용자 메모 저장
   */
  const updateRecipeNote = useCallback(
    (recipeId: number, note: string): void => {
      logger.info('useRecipePreferences.updateRecipeNote', `메모 저장: ID ${recipeId}`);
      setUserNotes((prev) => {
        const next = { ...prev, [recipeId]: note };
        saveRecipeNote(recipeId, note);
        if (user) {
          saveRecipeNoteToCloud(user.uid, recipeId, note, next).catch((err) => {
            logger.error('useRecipePreferences.updateRecipeNote', '클라우드 메모 동기화 실패', err);
          });
        }
        return next;
      });
    },
    [user]
  );

  /**
   * 최근 본 레시피 추가
   */
  const addRecentRecipe = useCallback((recipeId: number): void => {
    logger.info('useRecipePreferences.addRecentRecipe', `최근 본 레시피 추가: ID ${recipeId}`);
    const next = addRecentRecipeId(recipeId);
    setRecentRecipeIds(next);
  }, []);

  /**
   * 로그아웃 시 로컬 스토리지 데이터로 복원
   */
  const restoreLocalPreferences = useCallback((): void => {
    logger.info('useRecipePreferences.restoreLocalPreferences', '로컬 스토리지 개인 설정 복원');
    const localBookmarks = getSavedBookmarks();
    const localNotes = getSavedRecipeNotes();
    setBookmarkedIds(localBookmarks);
    setUserNotes(localNotes);
  }, []);

  return {
    bookmarkedIds,
    userNotes,
    recentRecipeIds,
    setBookmarkedIds,
    setUserNotes,
    setRecentRecipeIds,
    toggleBookmark,
    updateRecipeNote,
    addRecentRecipe,
    restoreLocalPreferences,
  };
}
