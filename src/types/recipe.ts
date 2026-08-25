/**
 * @file src/types/recipe.ts
 * @description 레시피 애플리케이션에서 사용하는 모든 데이터 모델과 인터페이스 정의
 */

/**
 * 레시피 카테고리 유니온 타입
 */
export type RecipeCategory = '반찬' | '소스·양념' | '국·찌개' | '중식·양식' | '밥·한그릇' | '계란요리' | '기타';

/**
 * 카테고리 필터 옵션 (전체 및 즐겨찾기 포함)
 */
export type FilterCategory = '전체' | '즐겨찾기' | RecipeCategory;

/**
 * 단일 레시피 데이터 인터페이스
 */
export interface Recipe {
  /** 레시피 고유 ID */
  id: number;
  /** 레시피 음식명 */
  name: string;
  /** 카테고리 */
  category: RecipeCategory;
  /** 원본 재료 문자열 (줄바꿈 구분) */
  ingredients: string;
  /** 원본 조리방법 문자열 (줄바꿈 구분) */
  method: string;
  /** 재료 가짓수 */
  ingredientCount: number;
  /** 조리 단계 수 */
  stepCount: number;
  /** 대표 아이콘 이모지 */
  icon: string;
  /** 대표 이미지 URL 또는 Base64 (선택) */
  imageUrl?: string;
  /** 예상 조리시간 (분) - 선택 */
  cookingTimeMinutes?: number;
  /** 난이도 - 선택 */
  difficulty?: '쉬움' | '보통' | '어려움';
  /** 사용자 생성 또는 커스텀 수정 레시피 여부 */
  isCustom?: boolean;
  /** 즐겨찾기 등록 여부 (기본 false) */
  isBookmarked?: boolean;
  /** 사용자 메모 */
  userNotes?: string;
  /** 생성 일시 타임스탬프 */
  createdAt?: number;
  /** 등록/수정 일시 타임스탬프 또는 ISO 문자열 */
  updatedAt?: number | string;
}

/**
 * 장보기 목록 아이템 인터페이스
 */
export interface ShoppingItem {
  /** 아이템 고유 ID */
  id: string;
  /** 재료명 및 수량 */
  text: string;
  /** 출처 레시피 이름 (선택) */
  sourceRecipeName?: string;
  /** 구매 완료 여부 */
  completed: boolean;
  /** 추가 일시 */
  createdAt: number;
}

/**
 * 토스트 알림 메시지 인터페이스
 */
export interface ToastMessage {
  /** 토스트 고유 ID */
  id: string;
  /** 표시할 메시지 */
  message: string;
  /** 알림 유형 */
  type?: 'success' | 'info' | 'warning';
}

/**
 * 레시피 정렬 기준
 */
export type SortOption =
  | 'default'
  | 'nameAsc'
  | 'nameDesc'
  | 'latest'
  | 'updated'
  | 'favorite'
  | 'ingredientsAsc'
  | 'ingredientsDesc';

/**
 * 백업 및 복원용 데이터 포맷 인터페이스
 */
export interface RecipeBackupData {
  /** 앱 식별자 */
  app: string;
  /** 데이터 스키마 버전 */
  version: string;
  /** 내보낸 일시 (ISO 문자열) */
  exportedAt: string;
  /** 전체 레시피 목록 */
  recipes: Recipe[];
  /** 즐겨찾기 ID 목록 */
  bookmarks: number[];
  /** 사용자 레시피 메모 */
  userNotes: Record<number, string>;
  /** 장보기 목록 */
  shoppingList: ShoppingItem[];
  /** 최근 본 레시피 ID 목록 */
  recentRecipeIds?: number[];
}
