# 📖 내 입맛 레시피 (My Favorite Recipes) - 시스템 아키텍처 및 설계 문서 (Design.md)

## 1. 프로젝트 개요 (Overview)
**내 입맛 레시피**는 엑셀 및 개인 메모장에 흩어져 있던 자주 해먹는 요리 레시피 26종을 현대적인 React + TypeScript + Tailwind CSS 웹 애플리케이션으로 구축한 개인 맞춤형 레시피 북입니다.

---

## 2. 전체 디렉토리 및 파일 구조 (File Structure)

```text
/
├── Design.md                       # 전체 앱 구조 및 설계 문서 (본 파일)
├── metadata.json                   # AI Studio 메타데이터 및 권한 설정
├── package.json                    # 프로젝트 의존성 및 스크립트 설정
├── tsconfig.json                   # TypeScript 컴파일러 설정
├── vite.config.ts                  # Vite 번들러 및 Tailwind 플러그인 설정
├── index.html                      # HTML 엔트리포인트 (한글 웹폰트 포함)
└── src/
    ├── main.tsx                    # React Root 마운트 진입점
    ├── App.tsx                     # 최상위 오케스트레이터 및 전역 상태 관리
    ├── index.css                   # Tailwind v4 레이어 및 커스텀 유틸리티
    ├── types/
    │   └── recipe.ts               # 레시피, 장보기, 필터, 토스트 등 공통 TypeScript 인터페이스
    ├── config/
    │   └── appConfig.ts            # 앱 상수, 카테고리 메타데이터, 스토리지 키, 타이머 프리셋 집중 설정
    ├── data/
    │   └── initialRecipes.ts       # 26종 기본 레시피 원본 데이터셋
    ├── utils/
    │   ├── logger.ts               # 모든 함수 호출 및 상태 변화 추적용 구조화 로거
    │   ├── scaler.ts               # 인분 수(배율)에 따른 재료 용량 및 분수 수학적 계산 유틸리티
    │   └── storage.ts              # 로컬스토리지 영속화(즐겨찾기, 커스텀 레시피, 장보기, 메모)
    └── components/
        ├── Header.tsx              # 상단 네비게이션, 바로가기 버튼, 모바일 반응형 메뉴
        ├── HeroSection.tsx         # 메인 소개, 통계 요약 카드, 퀵 카테고리 칩
        ├── SearchBar.tsx           # 실시간 검색 입력창, 추천 재료 키워드 칩
        ├── CategoryFilter.tsx      # 카테고리 및 즐겨찾기 필터 탭
        ├── RecipeCard.tsx          # 개별 레시피 카드, 재료 프리뷰, 북마크 토글
        ├── RecipeList.tsx          # 레시피 그리드 레이아웃, 정렬 선택기, 검색 결과 없음 뷰
        ├── RecipeDetailModal.tsx   # 상세 레시피 모달 (배율 조절, 체크리스트, 메모, 복사/인쇄)
        ├── CookingModeModal.tsx    # 주방 전용 집중 조리 모드 (큰 글씨, 스텝별 진행, 스톱워치)
        ├── AddRecipeModal.tsx      # 나만의 신규 레시피 등록 폼 모달
        ├── ShoppingListModal.tsx   # 장보기 체크리스트 및 텍스트 내보내기 모달
        ├── TimerWidget.tsx         # Web Audio API 차임벨 내장 플로팅 키친 타이머
        ├── AboutSection.tsx        # 주요 기능 및 활용 가이드 소개
        ├── Footer.tsx              # 하단 정보 및 최상단 스크롤(TOP) 플로팅 버튼
        └── Toast.tsx               # 전역 토스트 알림 컴포넌트
```

---

## 3. 핵심 컴포넌트 계층 구조 (Component Hierarchy)

```text
[App.tsx (Root Controller)]
  │
  ├── [Toast.tsx] (전역 토스트 알림)
  │
  ├── [Header.tsx] (브랜드 로고, 네비게이션, 장보기/타이머/추가 퀵버튼)
  │
  ├── <main>
  │    ├── [HeroSection.tsx] (통계 카드, 퀵 카테고리 선택)
  │    ├── [SearchBar.tsx] (통합 검색 및 인기 재료 추천 칩)
  │    ├── [CategoryFilter.tsx] (카테고리 탭 및 북마크 탭)
  │    ├── [RecipeList.tsx]
  │    │     └── [RecipeCard.tsx] x N (레시피 카드 그리드)
  │    └── [AboutSection.tsx] (기능 소개 카드 6종)
  │
  ├── [Footer.tsx] (푸터 카피라이트 + Top 스크롤 버튼)
  │
  └── [Modals & Overlays]
       ├── [RecipeDetailModal.tsx] (인분 조절, 재료 체크, 조리법, 팁 메모)
       ├── [CookingModeModal.tsx] (전체화면 집중 조리 뷰 + 스톱워치)
       ├── [AddRecipeModal.tsx] (커스텀 레시피 등록)
       ├── [ShoppingListModal.tsx] (장보기 바구니 관리)
       └── [TimerWidget.tsx] (플로팅 키친 타이머 위젯)
```

---

## 4. 데이터 모델 설계 (Data Models)

### `Recipe` 인터페이스
```typescript
export interface Recipe {
  id: number;
  name: string;
  category: RecipeCategory;
  ingredients: string;
  method: string;
  ingredientCount: number;
  stepCount: number;
  icon: string;
  cookingTimeMinutes?: number;
  difficulty?: '쉬움' | '보통' | '어려움';
  isCustom?: boolean;
  userNotes?: string;
  updatedAt?: string;
}
```

### `ShoppingItem` 인터페이스
```typescript
export interface ShoppingItem {
  id: string;
  text: string;
  sourceRecipeName?: string;
  completed: boolean;
  createdAt: number;
}
```

---

## 5. 주요 기능 구현 상세 (Feature Breakdown)

1. **실시간 통합 검색 및 다중 필터링**:
   - 요리명 뿐만 아니라 세부 재료(예: "두부", "대파", "된장")까지 검색 가능
   - 6개 기본 카테고리 + '즐겨찾기' 전용 탭 지원
   - 가나다순, 역순, 재료 수 기준 정렬 기능 제공

2. **지능형 인분 수(배율) 계량 조절 (Portion Scaler)**:
   - `0.5x`, `1x`, `1.5x`, `2x`, `3x`, `4x` 클릭 시 정규식 기반 단위 및 분수 파싱
   - "된장 2큰술" -> 2x 시 "된장 4큰술", "물 150ml" -> "물 300ml"로 실시간 변환

3. **주방 전용 집중 조리 모드 (Focus Cooking Mode)**:
   - 큰 텍스트 뷰와 단계별(Step 1, 2, 3...) 진행 상태 바
   - 단계별 소요 시간 측정을 위한 스톱워치 내장
   - 요리 중 필요할 때 바로 펼쳐보는 '재료 사이드바'

4. **Web Audio API 기반 플로팅 키친 타이머**:
   - 1분, 3분, 5분, 7분, 10분, 15분, 20분 원클릭 프리셋
   - 별도의 오디오 파일 없이 Web Audio API 신시사이저를 이용한 맑은 화음 알람음 구현
   - 최소화/최대화 모드 지원

5. **스마트 장보기 목록 (Shopping List)**:
   - 레시피 모달에서 원클릭으로 필요한 모든 재료를 장보기 목록에 담기
   - 수동 재료 추가, 구매 완료 체크, 완료 항목 정리, 클립보드 원클릭 텍스트 복사(카카오톡/메모장 공유용)

6. **나만의 레시피 등록 및 메모 기능 (Persistence)**:
   - 사용자가 직접 좋아하는 레시피를 추가하여 기본 26종과 함께 관리
   - 각 레시피마다 나만의 간 맞추기 팁/주의사항 메모 저장 (`localStorage` 영속화)

---

## 6. 개발 및 코딩 컨벤션 준수 내역
- **파일 분리**: `App.tsx` 단일 집중을 배제하고 기능별 독립적인 컴포넌트, 유틸, 타입, 설정 파일로 세분화.
- **문서화**: 모든 함수에 JSDoc 주석(`@param`, `@returns`) 적용 및 모든 파일 상단에 기능 설명 헤더 주석 작성.
- **전역 로깅**: `logger.ts`를 통해 모든 함수 호출과 상태 변화 추적 로그 남김.
- **설정 집중화**: `src/config/appConfig.ts`에 모든 상수, 메타데이터, 스토리지 키 집중 관리.
