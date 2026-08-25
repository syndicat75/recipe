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
  version: '1.2.0',
  storageKeys: {
    /** 통합 레시피 목록 키 */
    allRecipes: 'my_recipe_all_recipes_v2',
    /** 이전 버전 호환용 커스텀 레시피 키 */
    customRecipesLegacy: 'my_recipe_custom_recipes_v1',
    bookmarks: 'my_recipe_bookmarks_v1',
    shoppingList: 'my_recipe_shopping_list_v1',
    recipeNotes: 'my_recipe_user_notes_v1',
    recentRecipes: 'my_recipe_recent_viewed_v1',
    theme: 'my_recipe_theme_preference_v1',
  },
  ai: {
    model: 'gemini-3.7-flash',
    importEndpoint: '/api/ai/import-recipe',
    askEndpoint: '/api/ai/ask-recipe',
    quickQuestions: [
      { id: 'substitute', label: '🥬 대체 재료', prompt: '대체할 수 있는 다른 재료나 양념이 있나요?' },
      { id: 'tastier', label: '👨‍🍳 더 맛있게', prompt: '더 맛있고 감칠맛 나게 만드는 셰프의 특급 비법 꿀팁을 알려주세요.' },
      { id: 'less_spicy', label: '🌶️ 덜 맵게', prompt: '너무 맵지 않고 부드럽게 먹을 수 있는 조절 팁을 알려주세요.' },
      { id: 'too_salty', label: '🧂 너무 짤 때', prompt: '음식이 너무 짜졌는데 원래 맛을 해치지 않고 살리는 응급 복구법을 알려주세요.' },
      { id: 'quick_cook', label: '⏱️ 빠르게 만들기', prompt: '조리 시간을 단축하거나 더 간편하게 만드는 요령을 알려주세요.' },
      { id: 'leftover', label: '🍱 남은 재료 활용', prompt: '남은 재료나 남은 요리를 활용할 수 있는 아이디어나 보관법을 알려주세요.' },
    ],
    exampleQuestions: [
      '대체 재료는?',
      '더 맛있게 만드는 방법은?',
      '너무 짜졌는데 어떻게 하지?',
      '너무 매운데 어떻게 살리지?',
      '남은 재료로 뭘 만들까?',
      '2인분을 4인분으로 바꾸려면?',
      '돼지고기 대신 소고기를 사용해도 될까?',
    ],
    presetQuestions: [
      { id: 'substitute', label: '🔄 대체 재료 추천', prompt: '이 레시피에서 다른 재료로 대체할 수 있는 것들이 있나요? 알레르기나 냉장고 파먹기용 대체법을 알려주세요.' },
      { id: 'secret_tip', label: '🍯 셰프의 특급 비법', prompt: '이 요리를 식당처럼 훨씬 맛있고 감칠맛 나게 만드는 셰프의 한 끗 비법 팁을 알려주세요.' },
      { id: 'side_dish', label: '🥗 어울리는 곁들임/반찬', prompt: '이 요리와 함께 상차림하면 궁합이 좋은 국/찌개나 사이드 반찬을 추천해주세요.' },
      { id: 'kid_friendly', label: '👶 덜 맵게/아이 맞춤 조리법', prompt: '아이들이나 매운 것을 못 먹는 사람이 먹기 좋게 간이나 맵기를 조절하는 팁을 알려주세요.' },
      { id: 'quick_cook', label: '⚡ 조리 시간 단축 꿀팁', prompt: '바쁜 날 더 빠르게 만들 수 있는 시간 단축 팁이나 전자레인지/에어프라이어 활용법이 있나요?' },
      { id: 'storage', label: '🧊 보관 및 데우기 방법', prompt: '남은 음식을 가장 맛있게 보관하고 다시 데워먹는 최적의 방법을 알려주세요.' },
    ],
  },
  maxRecentRecipes: 5,
  defaultPortionMultiplier: 1,
  availablePortionMultipliers: [0.5, 1, 1.5, 2, 3, 4],
  defaultTimerMinutes: 3,
  timerPresets: [1, 3, 5, 7, 10, 15, 20],
  defaultEmojis: ['🍳', '🥘', '🥗', '🥣', '🍽️', '🍛', '🍚', '🥪', '🍜', '🥩', '🦐', '🍝', '🥟', '🍲', '🍢', '🍣'],
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
  '기타',
];
