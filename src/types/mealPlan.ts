/**
 * @file src/types/mealPlan.ts
 * @description 📅 AI 주간 식단 생성 및 관리 전용 인터페이스 및 타입 정의.
 * AI 식단 생성 설정, 후보 레시피 페이로드, 추천 결과 스키마 및 식단 생성 옵션을 포함합니다.
 */

import { MealSlotType } from './recipe';

/**
 * AI 주간 식단 생성 요청 설정 인터페이스
 */
export interface AiMealPlanRequestConfig {
  /** 식단 구성 모드 ('single': 하루 1메뉴, 'detail': 아침/점심/저녁) */
  mode: 'single' | 'detail';
  /** 생성 대상 날짜 목록 (YYYY-MM-DD 형식) */
  dates: string[];
  /** 기본 식사 인원 (1~20) */
  servings: number;
  /** 중복 메뉴 최소화 여부 (기본 true) */
  noDuplicates: boolean;
  /** 최근 식단(7~14일) 사용 메뉴 가급적 제외 여부 (기본 true) */
  excludeRecent: boolean;
  /** 다양한 카테고리 조합 여부 (기본 true) */
  diverseCategories: boolean;
  /** 즐겨찾기 레시피 가중치 우선 여부 (기본 false) */
  prioritizeBookmarks: boolean;
  /** 1인분 기준 최대 칼로리 제한 (null이면 제한 없음) */
  maxCaloriesPerServing: number | null;
  /** 칼로리 정보가 있는 레시피 우선 적용 여부 */
  strictCalories: boolean;
  /** 최대 조리 시간 제한 (분 단위, null이면 제한 없음) */
  maxCookingTimeMinutes: number | null;
  /** 사용자의 자연어 추가 요청 사항 (예: '평일은 간단하게, 주말은 고기요리') */
  customPrompt: string;
  /** 기존 주간 식단 처리 방식 ('emptyOnly': 빈 날짜/슬롯만 채우기, 'replaceWeek': 이번 주 전체 새 식단으로 교체) */
  fillMode: 'emptyOnly' | 'replaceWeek';
}

/**
 * AI 서버로 전달되는 경량 후보 레시피 인터페이스 (이미지 배제)
 */
export interface AiMealPlanCandidateRecipe {
  /** 레시피 고유 ID */
  id: number;
  /** 요리 이름 */
  name: string;
  /** 카테고리 */
  category: string;
  /** 조리 시간 (분 단위, 없을 경우 null) */
  cookingTimeMinutes: number | null;
  /** 1인분 예상 칼로리 (kcal, 없을 경우 null) */
  caloriesPerServing: number | null;
  /** 기준 인분 수 */
  baseServings: number;
  /** 사용자의 즐겨찾기 등록 여부 */
  isBookmarked: boolean;
  /** 주요 재료 목록 요약 문자열 */
  ingredients: string;
}

/**
 * AI가 생성한 단일 식단 계획 항목
 */
export interface AiGeneratedPlanItem {
  /** 날짜 (YYYY-MM-DD) */
  date: string;
  /** 식사 슬롯 */
  slot: MealSlotType;
  /** 매칭된 실제 레시피 ID */
  recipeId: number;
}

/**
 * AI 주간 식단 생성 응답 인터페이스
 */
export interface AiMealPlanResponseData {
  /** 생성된 요일별 식단 목록 */
  plan: AiGeneratedPlanItem[];
  /** AI 식단 구성 이유 및 요약 설명 */
  summary: string;
}

/**
 * 미리보기 화면에서 편집 가능한 식단 슬롯 인터페이스
 */
export interface AiMealPlanPreviewSlot {
  /** 식단 날짜 (YYYY-MM-DD) */
  date: string;
  /** 요일명 ('월', '화', ...) */
  dayName: string;
  /** 식사 슬롯 */
  slot: MealSlotType;
  /** 선택된 레시피 ID */
  recipeId: number;
  /** 해당 슬롯 인분 수 */
  servings: number;
  /** 기존 식단에서 유지된 항목 여부 */
  isPreservedFromExisting?: boolean;
}
