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
  /** 기준 인분 수 (선택, 기본 2인분 등으로 설정 가능) */
  baseServings?: number;
  /** 가족 공간에 공유 여부 (선택, 기본 false) */
  sharedWithFamily?: boolean;
  /** 원본 촬영/참고 사진 (선택) */
  sourceImageUrl?: string;
  /** 사용자 생성 또는 커스텀 수정 레시피 여부 */
  isCustom?: boolean;
  /** 즐겨찾기 등록 여부 (기본 false) */
  isBookmarked?: boolean;
  /** 사용자 메모 */
  userNotes?: string;
  /** 요리 꿀팁/팁 (선택) */
  tip?: string;
  /** 동기화 스코프 ('public': Firestore 공개 레시피, 'private': Firestore 개인 계정 전용 레시피, 'local': 비로그인 기기 전용) */
  syncScope?: 'public' | 'private' | 'local';
  /** 생성 일시 타임스탬프 */
  createdAt?: number;
  /** 등록/수정 일시 타임스탬프 또는 ISO 문자열 */
  updatedAt?: number | string;
}

/**
 * 레시피 저장 작업 결과 인터페이스
 */
export interface SaveRecipeResult {
  /** 저장 성공 여부 */
  success: boolean;
  /** 저장된 스코프 ('public', 'private', 'local') */
  scope?: 'public' | 'private' | 'local';
  /** 실패 또는 경고 메시지 */
  error?: string;
}

/**
 * 식단 식사 시간 슬롯 타입
 */
export type MealSlotType = 'breakfast' | 'lunch' | 'dinner' | 'single';

/**
 * 단일 식단 항목 인터페이스
 */
export interface MealPlanEntry {
  /** 식단 항목 고유 ID */
  id: string;
  /** 날짜 문자열 (YYYY-MM-DD) */
  date: string;
  /** 식사 슬롯 ('breakfast' | 'lunch' | 'dinner' | 'single') */
  slot: MealSlotType;
  /** 참조하는 레시피 고유 ID */
  recipeId: number;
  /** 사용자 지정 보조 제목 또는 메모 (선택) */
  customTitle?: string;
  /** 인분 수 설정 (선택, 기본 2) */
  servings?: number;
  /** 생성 일시 타임스탬프 */
  createdAt: number;
  /** 수정 일시 타임스탬프 */
  updatedAt?: number;
}

/**
 * 날짜별 식단 항목 맵 (키: YYYY-MM-DD)
 */
export type WeeklyMealPlan = Record<string, MealPlanEntry[]>;

/**
 * 요리 진행 상황 저장 인터페이스
 */
export interface CookingProgressState {
  /** 레시피 ID */
  recipeId: number;
  /** 현재 진행 중인 단계 인덱스 */
  currentStepIndex: number;
  /** 완료된 단계 인덱스 목록 */
  completedStepIndices: number[];
  /** 마지막 업데이트 일시 */
  lastUpdated: number;
}

/**
 * 활성 타이머 인터페이스 (종료 예정 시각 기반)
 */
export interface ActiveTimerItem {
  /** 타이머 고유 ID */
  id: string;
  /** 타이머 이름/라벨 (예: "된장찌개 끓이기") */
  label: string;
  /** 타이머 총 설정 초 */
  totalSeconds: number;
  /** 종료 예정 절대 타임스탬프 (Date.now() + 남은밀리초) */
  targetTimestamp: number;
  /** 일시정지 여부 */
  isPaused?: boolean;
  /** 일시정지 시점의 남은 초 */
  remainingSecondsOnPause?: number;
}

/**
 * 가족 구성원 인터페이스
 */
export interface FamilyMember {
  /** 사용자 ID */
  id: string;
  /** 사용자 닉네임 */
  name: string;
  /** 역할 ('owner' | 'member') */
  role: 'owner' | 'member';
  /** 프로필 이모지 */
  avatar?: string;
  /** 참여 일시 */
  joinedAt: number;
}

/**
 * 가족 공간 데이터 인터페이스
 */
export interface FamilySpace {
  /** 가족 공간 고유 ID */
  familyId: string;
  /** 가족 공간 이름 */
  name: string;
  /** 6자리 초대 코드 (예: FAM-8X2K9L) */
  inviteCode: string;
  /** 방장 사용자 ID */
  ownerId: string;
  /** 참여 구성원 목록 */
  members: FamilyMember[];
  /** 생성 일시 */
  createdAt: number;
  /** 최종 동기화/수정 일시 */
  updatedAt: number;
}

/**
 * 사용자 가족 계정 프로필
 */
export interface FamilyUserProfile {
  /** 고유 사용자 ID */
  id: string;
  /** 사용자 닉네임 */
  name: string;
  /** 현재 참여 중인 가족 공간 ID (없으면 null) */
  currentFamilyId: string | null;
  /** 프로필 이모지 */
  avatar?: string;
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
  type?: 'success' | 'info' | 'warning' | 'error';
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
