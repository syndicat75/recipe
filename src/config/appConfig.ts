/**
 * @file src/config/appConfig.ts
 * @description 애플리케이션 전역 설정값, 카테고리 메타데이터, 로컬스토리지 키 및 기본값 정의
 */

import { RecipeCategory } from '../types/recipe';

/**
 * 애플리케이션 기본 정보 설정
 */
export const APP_CONFIG = {
  appName: '내 입맛 레시피',
  appSubTitle: 'MY FAVORITE RECIPES',
  appDescription: '내가 좋아하는 음식 레시피를 한눈에 찾아보고 계량 조절, 타이머, 조리모드, 장보기 목록을 활용하는 개인 레시피 북',
  version: '1.0.0',
  storageKeys: {
    customRecipes: 'my_recipe_custom_recipes_v1',
    bookmarks: 'my_recipe_bookmarks_v1',
    shoppingList: 'my_recipe_shopping_list_v1',
    recipeNotes: 'my_recipe_user_notes_v1',
    theme: 'my_recipe_theme_preference_v1',
  },
  defaultPortionMultiplier: 1,
  availablePortionMultipliers: [0.5, 1, 1.5, 2, 3, 4],
  defaultTimerMinutes: 3,
  timerPresets: [1, 3, 5, 7, 10, 15, 20],
} as const;

/**
 * 카테고리별 메타데이터 (이모지, 색상 테마, 설명)
 */
export const CATEGORY_CONFIG: Record<
  RecipeCategory,
  { label: string; icon: string; bgClass: string; textClass: string; badgeClass: string }
> = {
  '반찬': {
    label: '반찬',
    icon: '🥗',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-700',
    badgeClass: 'bg-emerald-100 text-emerald-800',
  },
  '소스·양념': {
    label: '소스·양념',
    icon: '🥣',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
    badgeClass: 'bg-amber-100 text-amber-800',
  },
  '국·찌개': {
    label: '국·찌개',
    icon: '🥘',
    bgClass: 'bg-rose-50',
    textClass: 'text-rose-700',
    badgeClass: 'bg-rose-100 text-rose-800',
  },
  '중식·양식': {
    label: '중식·양식',
    icon: '🍽️',
    bgClass: 'bg-orange-50',
    textClass: 'text-orange-700',
    badgeClass: 'bg-orange-100 text-orange-800',
  },
  '밥·한그릇': {
    label: '밥·한그릇',
    icon: '🍛',
    bgClass: 'bg-yellow-50',
    textClass: 'text-yellow-700',
    badgeClass: 'bg-yellow-100 text-yellow-800',
  },
  '계란요리': {
    label: '계란요리',
    icon: '🍳',
    bgClass: 'bg-lime-50',
    textClass: 'text-lime-700',
    badgeClass: 'bg-lime-100 text-lime-800',
  },
  '기타': {
    label: '기타',
    icon: '🍴',
    bgClass: 'bg-stone-50',
    textClass: 'text-stone-700',
    badgeClass: 'bg-stone-100 text-stone-800',
  },
};

/**
 * 카테고리 전체 목록 배열
 */
export const CATEGORY_LIST: RecipeCategory[] = [
  '반찬',
  '소스·양념',
  '국·찌개',
  '중식·양식',
  '밥·한그릇',
  '계란요리',
];
