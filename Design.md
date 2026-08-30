# 내 입맛 레시피 (My Favorite Recipes) - 시스템 설계서 및 아키텍처 문서 (Design.md)

## 1. 개요 (Overview)
**내 입맛 레시피**는 사용자가 일상에서 자주 요리하는 황금비율 요리법을 체계적으로 관리하고, 주방에서 바로 요리하며 스마트하게 활용할 수 있도록 설계된 개인 맞춤형 레시피 북 풀스택 웹 애플리케이션(PWA)입니다.

기존의 고품질 디자인, 26개 시드 레시피, 검색, 카테고리, 즐겨찾기, 레시피 CRUD, 장보기 목록, AI 요리사, PWA 오프라인 지원을 완벽히 유지하면서 다음 **8대 핵심 기능 및 5대 아키텍처 안정성 개선**이 적용되었습니다:
1. 🎲 **오늘 뭐 먹지? (랜덤 룰렛 & Gemini 3.7 Flash AI 맞춤 추천)**
2. 📅 **주간 식단표 (월~일 끼니별 계획 & 인분별 장보기 목록 자동 변환, Firestore 실시간 동기화)**
3. 🍳 **스마트 집중 조리 모드 (Screen Wake Lock, Web Speech API 음성 읽기/명령, Date.now() 기반 정확한 멀티 타이머, 시간 자동 감지)**
4. 👥 **인분 수 자동 변환 (스텝퍼/퀵 칩, 정밀 분수·수량 스케일링 엔진, 원래 양 복원)**
5. 📷 **사진으로 레시피 가져오기 (Canvas 클라이언트 압축, Gemini 멀티모달 OCR, 불확실 항목 안내, Firebase Storage 영속 저장)**
6. 👨‍👩‍👧 **가족 공유 공간 (초대 코드 생성/참여 보안 검증, 정원 제한, 구성원 관리, 레시피 일괄/개별 공유, 식단·장보기 동기화)**
7. 🔥 **1인분 기준 예상 영양정보 분석 & 필터링 시스템 (Gemini 3.7 Flash AI 1인분 영양 분석, 열량·단백질·탄수화물·지방·나트륨·식이섬유, 채소 비중, 맞춤 영양 필터 및 다차원 정렬)**
8. ✨ **AI 자동 주간 식단표 만들기 (Gemini 3.7 Flash 기반 맞춤 일주일 식단 구성, 중복·최근 식단 배제, 칼로리·시간 제약, 미리보기 및 개별 교체, 오프라인 Fallback 지원)**
9. 🎤 **핸즈프리 조리 음성비서 (주방 완전 무터치 제어, 로컬 자연어 파서, TTS/STT 음향 루프 차단, 멀티타이머 음성 동기화, 인분 맞춤 재료 질의응답, 2단계 완료 안전 확인)**
10. ⚡ **JSON-LD Direct Mode & 고신뢰 웹페이지 레시피 파이프라인 (불필요한 Gemini AI 호출 0회 생략, 쿼터 소모 0, 폐기 모델 제거 및 정밀 오류 분류)**

### 아키텍처 안정성 및 엔지니어링 개선 (Stability & Robustness)
- ⚡ **JSON-LD Direct Mode & 웹페이지 파서 (`lib/recipePageParser.ts`, `lib/ai/modelConfig.ts`, `lib/geminiService.ts`)**:
  - **JSON-LD 성공 시 Gemini 호출 전면 생략 (Direct Mode)**: 만개의레시피, 블로그 등 웹페이지에서 `schema.org/Recipe` 유효 데이터(제목, 재료, 조리순서) 추출 시 Gemini AI를 호출하지 않고 로컬에서 즉시 `Recipe` 형태로 변환하여 0ms AI 지연시간과 쿼터 소모 0을 달성.
  - **Gemini Quota 소모 대폭 절감**: 구조화 데이터가 충분한 대부분의 레시피 URL에서 AI 호출을 우회하여 429 RESOURCE_EXHAUSTED를 원천 차단.
  - **폐기된 Fallback 모델 제거 & 최신 모델 체인화**: 404를 유발하던 `gemini-2.5-flash-lite`를 제거하고, `gemini-3.7-flash` (Primary) ➔ `gemini-2.5-flash` (Fallback 1) ➔ `gemini-3.5-flash-lite` (Fallback 2)로 체계화.
  - **Quota / Model Error 정밀 분류 및 즉각 전환**: 429 Quota 에러 발생 시 무의미한 동일 모델 재시도를 생략하고 다음 모델로 즉시 Fallback 전환하며, 모든 모델 실패 시 상세 진단 및 대체 방안을 안내.
  - **추적 파라미터 자동 정제 & SSRF 방어**: `stripTrackingParams`를 통해 불필요한 UTM/마케팅 파라미터를 제거하고 사설망 IP 접근을 차단.
- 🎙️ **핸즈프리 조리 음성비서 (`src/hooks/useCookingVoiceAssistant.ts`, `src/utils/cookingVoiceCommands.ts`)**:
  - **100% 클라이언트 로컬 명령 파서**: 외부 AI API(Gemini) 호출 없이 브라우저 내에서 0ms 지연으로 실시간 처리하여 네트워크 장애/비용/Quota 제약 없는 주방 최적화.
  - **TTS ➔ STT 자기 음성 오인식 방지 메커니즘**: 음성 합성(TTS) 재생 시 STT 마이크를 선제적으로 일시 차단(abort)하고, 발화 완료 후 잔향 대기(250ms) 후 안전하게 청취를 재개하는 `isSpeakingRef` / `shouldListenRef` 구조.
  - **Stale Closure 방지 및 재시작 안정화**: `recognition.onend` 및 `recognition.onerror`에서 React state 클로저 대신 `useRef` 기반 생명주기 관리.
  - **연속 중복 발화 디바운스 (800~1200ms)**: Web Speech API의 동일 결과 중복 송출 필터링.
  - **2단계 안전 확인 절차**: 실수로 인한 요리 진행상황 삭제를 방지하기 위해 "요리 완료" 시 "완료해" 확인 후 7초 타임아웃 적용.
  - **멀티타이머 완전 일체화**: 화면 UI와 음성명령이 단일 `activeTimers` 상태를 공유하여 생성/조회/정지/재개/취소 상호 연동.
- 🖼️ **Firebase Storage 레시피 이미지 분리 (`src/services/imageStorage.ts`)**: Base64 데이터 대신 Firebase Storage 전용 영속 스토리지 업로드 및 HTTPS URL 발급을 통해 Firestore 문서 크기 최적화 및 네트워크 부하 경감.
- 🔄 **개인 주간 식단 Firestore 동기화 (`src/services/mealPlanFirestore.ts`)**: `/users/{uid}/mealPlanEntries` 컬렉션을 통한 다기기 실시간 동기화 및 로컬-클라우드 무손실 스마트 병합.
- 🧪 **자동화 테스트 환경 구축 (Vitest & Playwright)**: 핵심 비즈니스 로직(인분 스케일링, Firestore 데이터 정제, 레시피 병합, 식단 생성기, 이미지 변환) 단위 테스트 100% 통과 및 E2E 브라우저 테스트 스위트.
- 🧩 **모듈화 및 관심사 분리**: 단일 거대 파일 방지, 유틸리티/서비스별 명확한 책임 분리(`scaler.ts`, `recipeMerger.ts`, `mealPlanGenerator.ts`, `imageStorage.ts`, `mealPlanFirestore.ts`).
- 🛡️ **가족 공간 보안 강화**: 초대 코드 유효기간 및 상태 검증, 최대 정원(20명) 제한, Firestore 보안 규칙과의 일치된 권한 모델.

---

## 2. 시스템 아키텍처 (System Architecture)

### 2.1 풀스택 구성 (Express + Vercel Serverless Functions + React 19 Vite)
- **공통 AI 비즈니스 서비스 (`lib/geminiService.ts`)**:
  - Google Gen AI `@google/genai` (Gemini 3.7 Flash) SDK 연동.
  - Vercel Serverless Function 런타임 표준에 맞춰 `process.env.GEMINI_API_KEY`를 `getGeminiClient()` 함수 내에서 지연(Lazy) 초기화하여 모듈 로딩 시점의 환경 변수 미인식 크래시 원천 방지.
  - 모든 예외 경로에서 100% 표준 JSON 응답 및 방어적 파싱 보장 (`safeParseGeminiJson`).
- **Vercel Serverless Functions (`api/`)**:
  - `POST /api/ai/import-recipe-image`: 요리책·메모 사진 기반 멀티모달 OCR 레시피 추출
  - `POST /api/ai/import-recipe`: 웹 URL 또는 텍스트 기반 레시피 구조화 추출
  - `POST /api/ai/ask-recipe`: 레시피 컨텍스트 기반 AI 요리 상담
  - `POST /api/ai/recommend-menu`: 자연어 기분/상황 기반 내 레시피 풀 매칭 추천
  - `POST /api/ai/generate-meal-plan`: 맞춤 조건 및 후보 레시피 기반 AI 주간 식단표 자동 생성
  - `POST /api/ai/analyze-calories`: 레시피 재료 기반 1인분 및 총 예상 칼로리(kcal) 분석
  - `GET /api/ai/diagnostic`: Gemini SDK 및 환경변수 설정 진단 엔드포인트
  - `GET /api/health`: 서비스 상태 진단
  - **정적 Import 및 안정적 번들링**: 모든 `api/ai/*.ts`에서 `../../lib/geminiService.js`를 상단에서 정적으로 `import`하여 Vercel 배포 시 의존성이 완벽하게 번들링되도록 보장.
- **클라이언트 AI 호출 안전 계층 (`src/utils/aiApiHelper.ts`)**:
  - `callAiApi<T>`: 페이로드 용량 사전 검증(최대 4.0MB), `response.text()` 선행 수신, `Content-Type: application/json` 검증, 방어적 JSON 파싱 및 오류 상세 로깅.

### 2.2 디렉토리 및 파일 구조
```
├── lib/
│   └── geminiService.ts            # Gemini 3.7 Flash 핵심 AI 공통 로직 (Lazy Client Init)
├── api/                            # Vercel Serverless Functions
│   ├── ai/
│   │   ├── diagnostic.ts           # 독립형 AI 환경변수 및 SDK 로딩 진단 함수
│   │   ├── import-recipe-image.ts  # 사진 OCR 분석 서버리스 함수
│   │   ├── import-recipe.ts        # URL/텍스트 분석 서버리스 함수
│   │   ├── ask-recipe.ts           # AI 요리사 Q&A 서버리스 함수
│   │   ├── recommend-menu.ts       # AI 오늘뭐먹지 추천 서버리스 함수
│   │   ├── generate-meal-plan.ts   # AI 주간 식단표 자동 생성 서버리스 함수
│   │   └── analyze-calories.ts     # AI 칼로리 분석 서버리스 함수
│   └── health.ts                   # 헬스체크 서버리스 함수
├── server.ts                       # 로컬 Express 개발 및 번들 서버
├── tests/                          # 자동화 테스트 스위트
│   ├── setup.ts                    # Vitest 글로벌 jsdom 및 환경 셋업
│   ├── unit/                       # 유닛 테스트
│   │   ├── scaler.test.ts          # 인분 스케일링 & 분수 파싱 테스트
│   │   ├── firestoreSanitizer.test.ts # Firestore undefined 정제 테스트
│   │   ├── recipeMerger.test.ts    # 레시피 3-Tier 병합 테스트
│   │   ├── mealPlanGenerator.test.ts # 주간 식단 생성 & 칼로리 계산 테스트
│   │   ├── imageStorage.test.ts    # 이미지 Base64/Blob 스토리지 변환 테스트
│   │   ├── mealPlanFirestore.test.ts # 식단 클라우드-로컬 무손실 병합 테스트
│   │   ├── koreanDurationParser.test.ts # 한국어 자연어 조리시간/타이머 파싱 테스트
│   │   └── cookingVoiceCommands.test.ts # 주방 핸즈프리 음성명령 파서 테스트
│   └── e2e/                        # Playwright E2E 브라우저 테스트
│       └── recipe-flow.spec.ts     # 핵심 유저 플로우 엔드투엔드 테스트
├── public/
│   ├── manifest.webmanifest        # PWA 매니페스트 (테마/아이콘/오프라인)
│   ├── sw.js                       # PWA 오프라인 Service Worker (Cache v2.1)
│   └── favicon.svg                 # 앱 파비콘
├── src/
│   ├── types/
│   │   ├── recipe.ts               # 레시피, 식단표, 타이머 타입 정의
│   │   ├── mealPlan.ts             # AI 주간 식단 생성 설정 및 미리보기 슬롯 타입 정의
│   │   ├── family.ts               # Firestore 실시간 가족 공유 스키마 및 문서 타입 정의
│   │   ├── firebase.ts             # Firebase Auth 및 사용자 동기화 상태 타입 정의
│   │   └── navigation.ts           # 해시 라우팅 및 뷰 모드 타입 정의
│   ├── config/
│   │   ├── appConfig.ts            # 카테고리, 모델명, AI 엔드포인트, 스토리지 키, 음성비서 설정
│   │   └── firebaseConfig.ts       # Firebase SDK 설정
│   ├── lib/
│   │   └── firebase.ts             # Firebase App, Auth, Firestore, Storage 싱글톤 인스턴스
│   ├── data/
│   │   └── initialRecipes.ts       # 기본 26개 시드 레시피 데이터셋
│   ├── services/
│   │   ├── familySync.ts           # Cloud Firestore 가족 공유 실시간 동기화 서비스
│   │   ├── firestoreSync.ts        # 개인 사용자 설정 클라우드 동기화 서비스
│   │   ├── imageStorage.ts         # Firebase Storage 이미지 업로드 및 URL 관리 서비스
│   │   └── mealPlanFirestore.ts    # 개인 주간 식단표 Cloud Firestore 동기화 서비스
│   ├── hooks/
│   │   ├── useCookingVoiceAssistant.ts # 🎤 주방 핸즈프리 음성비서 (STT/TTS 루프방지, 재시작, 디바운스)
│   │   ├── useFirebaseAuth.ts      # Firebase Google Authentication 훅
│   │   ├── useFamilySync.ts        # Cloud Firestore 실시간 가족 공간 동기화 훅
│   │   ├── usePublicRecipes.ts     # /recipes 단일 진실 공급원 실시간 구독 및 관리자 CRUD 훅
│   │   ├── useRecipePreferences.ts # 즐겨찾기, 사용자 메모, 최근 본 레시피 상태 훅
│   │   ├── useShoppingList.ts      # 장보기 목록 CRUD 및 클라우드 동기화 훅
│   │   ├── useMealPlan.ts          # 개인 주간 식단표 관리 및 클라우드 실시간 동기화 훅
│   │   ├── useRecipeFilter.ts      # 실시간 검색어, 카테고리 필터링, 정렬 로직 훅
│   │   ├── useRecipeMigration.ts   # 클라우드 마이그레이션 모달 및 시드 복구 훅
│   │   ├── useRecipeCategories.ts  # 동적 카테고리 Firestore 구독 훅
│   │   ├── useAppNavigation.ts     # URL Hash 기반 뷰 라우팅 동기화 훅
│   │   ├── useNetworkStatus.ts     # 온라인/오프라인 상태 감지 훅
│   │   ├── usePwaInstall.ts        # PWA 설치 프롬프트 및 안내 모달 훅
│   │   └── useToast.ts             # 중복 방지 전역 토스트 알림 훅
│   ├── utils/
│   │   ├── admin.ts                # 관리자 UID/이메일 판별 유틸
│   │   ├── aiApiHelper.ts          # 안전한 AI API 호출 및 JSON 파싱 헬퍼
│   │   ├── cookingVoiceCommands.ts # 🎤 100% 클라이언트 로컬 음성명령 파서 (0ms 지연)
│   │   ├── firestoreSanitizer.ts   # Firestore undefined 필드 재귀적 제거 및 에러 포맷팅 유틸
│   │   ├── koreanDurationParser.ts # ⏱️ 한국어 자연어 조리시간/초/라벨 파서
│   │   ├── logger.ts               # 구조화된 디버그/인포 로거
│   │   ├── mealPlanGenerator.ts    # 최근 식단 이력 조회, 칼로리 통계 및 스마트 오프라인 자동 채우기 유틸
│   │   ├── recipeMerger.ts         # 3-Tier 레시피 안전 병합 엔진
│   │   ├── pwaHelper.ts            # PWA 브라우저 환경 및 standalone 감지 헬퍼
│   │   ├── scaler.ts               # 인분 수 수학적 분량/분수 정밀 계산 엔진
│   │   └── storage.ts              # LocalStorage 영속화 및 마이그레이션 모듈
│   └── components/
│       ├── Header.tsx              # 상단 네비게이션 헤더
│       ├── TodayMenuModal.tsx      # 🎲 오늘 뭐 먹지? (룰렛 & AI 추천 모달)
│       ├── WeeklyMealPlanView.tsx  # 📅 주간 식단표 뷰 (끼니별 계획 & 장보기 추출)
│       ├── AiMealPlanModal.tsx     # ✨ AI 주간 식단표 자동 생성 및 미리보기 모달
│       ├── CookingModeModal.tsx    # 🍳 집중 조리 모드 (핸즈프리 음성비서, 멀티타이머, Wake Lock)
│       ├── cooking/
│       │   ├── VoiceAssistantHelpModal.tsx # 🎤 음성명령 도움말 & 설정 모달
│       │   ├── VoiceIntroModal.tsx         # 🎤 최초 조리모드 온보딩 안내 모달
│       │   └── VoiceStatusBadge.tsx        # 🎤 음성 상태, 최근 발화 및 실행 피드백 뱃지
│       ├── RecipeDetailModal.tsx   # 👥 인분 조절, 재료/단계 체크, 장보기, 가족공유
│       ├── ImportRecipeModal.tsx   # 📷 사진 OCR / URL / 텍스트 레시피 가져오기
│       ├── FamilyShareModal.tsx    # 👨‍👩‍👧 가족 공유 공간 관리 모달
│       ├── AiChefView.tsx          # ✨ AI 요리사 Q&A 전용 화면
│       ├── RecipeList.tsx          # 레시피 카드 그리드 및 다차원 정렬
│       ├── RecipeCard.tsx          # 레시피 카드 컴포넌트
│       ├── RecipeFormModal.tsx     # 레시피 등록 및 수정 폼 (Storage 이미지 연동)
│       ├── ShoppingListModal.tsx   # 장보기 체크리스트 및 텍스트 공유
│       ├── BackupRestoreModal.tsx  # JSON 백업 및 복원 모달
│       ├── AdminCalorieModal.tsx   # 관리자 AI 칼로리 일괄 분석 모달
│       ├── AdminCategoryModal.tsx  # 관리자 카테고리 편집 모달
│       └── ErrorBoundary.tsx       # 리액트 렌더링 예외 경계 컴포넌트
```

---

## 3. 핵심 아키텍처 및 보안 원칙

### 3.1 Firebase Storage 이미지 아키텍처 (`src/services/imageStorage.ts`)
- 레시피 이미지 등록 시 Base64 문자열 대신 Firebase Storage(`recipe-images/{uid}/{timestamp}_{random}.jpg`)에 업로드하여 다운로드 가능한 HTTPS URL 발급.
- Firestore 문서 크기를 1MB 한도 내에서 극도로 경량화하여 데이터베이스 읽기/쓰기 성능 향상 및 비용 절감.
- 네트워크 단절이나 스토리지 미설정 시에도 Fallback 처리되어 사용자 작업이 차단되지 않음.
- 기존 Base64 레시피와 100% 하위 호환되며 일괄 마이그레이션 헬퍼(`batchMigrateRecipeImagesToStorage`) 제공.

### 3.2 개인 주간 식단 Cloud Firestore 실시간 동기화 (`src/services/mealPlanFirestore.ts`)
- 로그인한 사용자의 주간 식단표를 `/users/{uid}/mealPlanEntries` 컬렉션에 실시간 동기화.
- 다기기(PC, 태블릿, 모바일) 간 식단 변경사항이 `onSnapshot`을 통해 즉시 동기화.
- 로컬 스토리지와 클라우드 식단 간 무손실 스마트 병합(`mergeMealPlans`)을 통해 로그인 시 기존 기기 식단 데이터 유실 방지.

### 3.3 단일 진실 공급원 아키텍처 (Single Source of Truth - Firestore `/recipes`)
- 공개 레시피는 Firestore `/recipes`를 단일 진실 공급원으로 운용.
- 비로그인 방문자 및 일반 로그인 사용자에게 동일한 공식 레시피 목록 실시간 제공.
- 관리자(`isAdmin`)만 등록/수정/삭제 권한 보유.

### 3.4 가족 공유 공간 보안 강화 (`src/services/familySync.ts` & `firestore.rules`)
- 초대 코드 생성 시 6자리 영문 대문자+숫자의 암호학적 난수(`generateSecureInviteCode`) 사용.
- 초대 코드 참여 시 활성 상태(`active: true`), 만료 시간(`expiresAt`), 최대 정원(20명) 엄격 검증.
- `firestore.rules`에서 가족 구성원(`isFamilyMember`) 및 대표(`isFamilyOwner`) 권한 철저 검증.

---

## 4. 자동화 테스트 스위트 (Automated Testing)

### 4.1 단위 테스트 (Vitest)
- 실행 명령어: `npm run test`
- 테스트 대상 모듈:
  - `scaler.test.ts`: 인분 스케일링, 분수/소수 변환, 단위 보존 연산.
  - `firestoreSanitizer.test.ts`: 재귀적 `undefined` 필드 제거 및 Firestore 에러 메시지 현지화.
  - `recipeMerger.test.ts`: 로컬, 개인, 공개 3-Tier 레시피 목록 병합 및 타임스탬프 충돌 해결.
  - `mealPlanGenerator.test.ts`: 오프라인 휴리스틱 식단 생성, 최근 식단 배제, 칼로리 통계 연산.
  - `imageStorage.test.ts`: Base64 판별, Blob 변환 및 MIME 타입 무결성 검증.
  - `mealPlanFirestore.test.ts`: 다기기 식단표 엔트리 ID 기반 무손실 병합.

### 4.2 E2E 브라우저 테스트 (Playwright)
- 실행 명령어: `npm run test:e2e`
- 홈 화면 렌더링, 레시피 검색, 카테고리 필터링, 조리 모드 진입 등 핵심 사용자 플로우 자동 검증.
