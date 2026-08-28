/**
 * @file src/types/navigation.ts
 * @description 내 입맛 레시피 애플리케이션의 화면 뷰 모드 및 네비게이션 공통 타입 정의.
 */

/**
 * 애플리케이션 메인 뷰 모드 타입
 * - home: 메인 레시피 목록 및 검색 화면
 * - ai-chef: AI 요리사 대화형 인터페이스
 * - meal-plan: 주간 식단표 및 영양 계획 화면
 */
export type AppViewMode = 'home' | 'ai-chef' | 'meal-plan';
