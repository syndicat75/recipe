/**
 * @file src/utils/storage.ts
 * @description 로컬스토리지에 사용자 레시피, 즐겨찾기, 장보기 목록, 메모 데이터를 영속화하고 조회하는 저장소 유틸리티
 */

import { APP_CONFIG } from '../config/appConfig';
import { Recipe, ShoppingItem } from '../types/recipe';
import { logger } from './logger';

/**
 * 로컬스토리지에서 즐겨찾기한 레시피 ID 목록을 가져옵니다.
 * @returns 즐겨찾기된 레시피 ID 배열
 */
export function getSavedBookmarks(): number[] {
  logger.info('storage.getSavedBookmarks', '즐겨찾기 목록 로드 시도');
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
  logger.info('storage.saveBookmarks', '즐겨찾기 목록 저장', ids);
  try {
    localStorage.setItem(APP_CONFIG.storageKeys.bookmarks, JSON.stringify(ids));
  } catch (error) {
    logger.error('storage.saveBookmarks', '즐겨찾기 저장 실패', error);
  }
}

/**
 * 사용자가 직접 등록한 커스텀 레시피 목록을 로컬스토리지에서 가져옵니다.
 * @returns 커스텀 레시피 배열
 */
export function getSavedCustomRecipes(): Recipe[] {
  logger.info('storage.getSavedCustomRecipes', '커스텀 레시피 로드 시도');
  try {
    const raw = localStorage.getItem(APP_CONFIG.storageKeys.customRecipes);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    logger.error('storage.getSavedCustomRecipes', '커스텀 레시피 파싱 실패', error);
    return [];
  }
}

/**
 * 커스텀 레시피 목록을 로컬스토리지에 저장합니다.
 * @param recipes 저장할 커스텀 레시피 배열
 */
export function saveCustomRecipes(recipes: Recipe[]): void {
  logger.info('storage.saveCustomRecipes', '커스텀 레시피 저장', { count: recipes.length });
  try {
    localStorage.setItem(APP_CONFIG.storageKeys.customRecipes, JSON.stringify(recipes));
  } catch (error) {
    logger.error('storage.saveCustomRecipes', '커스텀 레시피 저장 실패', error);
  }
}

/**
 * 장보기 목록을 로컬스토리지에서 가져옵니다.
 * @returns 장보기 아이템 목록 배열
 */
export function getSavedShoppingList(): ShoppingItem[] {
  logger.info('storage.getSavedShoppingList', '장보기 목록 로드 시도');
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
  logger.info('storage.saveShoppingList', '장보기 목록 저장', { count: items.length });
  try {
    localStorage.setItem(APP_CONFIG.storageKeys.shoppingList, JSON.stringify(items));
  } catch (error) {
    logger.error('storage.saveShoppingList', '장보기 목록 저장 실패', error);
  }
}

/**
 * 특정 레시피에 대한 사용자 메모 맵을 가져옵니다.
 * @returns 레시피 ID를 키로 하는 메모 객체
 */
export function getSavedRecipeNotes(): Record<number, string> {
  logger.info('storage.getSavedRecipeNotes', '레시피 메모 목록 로드');
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
 * 특정 레시피에 대한 사용자 메모를 저장합니다.
 * @param recipeId 레시피 고유 ID
 * @param note 저장할 메모 텍스트
 */
export function saveRecipeNote(recipeId: number, note: string): void {
  logger.info('storage.saveRecipeNote', `레시피(${recipeId}) 메모 저장`, { noteLength: note.length });
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
