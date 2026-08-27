# 내 입맛 레시피 (My Favorite Recipes) - 시스템 설계서 및 아키텍처 문서 (Design.md)

## 1. 개요 (Overview)
**내 입맛 레시피**는 사용자가 일상에서 자주 요리하는 황금비율 요리법을 체계적으로 관리하고, 주방에서 바로 요리하며 스마트하게 활용할 수 있도록 설계된 개인 맞춤형 레시피 북 풀스택 웹 애플리케이션(PWA)입니다.

기존의 고품질 디자인, 26개 시드 레시피, 검색, 카테고리, 즐겨찾기, 레시피 CRUD, 장보기 목록, AI 요리사, PWA 오프라인 지원을 완벽히 유지하면서 다음 **6대 핵심 기능**이 추가 확장되었습니다:
1. 🎲 **오늘 뭐 먹지? (랜덤 룰렛 & Gemini 3.7 Flash AI 맞춤 추천)**
2. 📅 **주간 식단표 (월~일 끼니별 계획 & 인분별 장보기 목록 자동 변환)**
3. 🍳 **스마트 집중 조리 모드 (Screen Wake Lock, Web Speech API 음성 읽기/명령, Date.now() 기반 정확한 멀티 타이머, 시간 자동 감지)**
4. 👥 **인분 수 자동 변환 (스텝퍼/퀵 칩, 정밀 분수·수량 스케일링 엔진, 원래 양 복원)**
5. 📷 **사진으로 레시피 가져오기 (Canvas 클라이언트 압축, Gemini 멀티모달 OCR, 불확실 항목 안내, 원본 사진 보관)**
6. 👨‍👩‍👧 **가족 공유 공간 (초대 코드 생성/참여, 구성원 관리, 레시피 일괄/개별 공유, 식단·장보기 동기화)**

---

## 2. 시스템 아키텍처 (System Architecture)

### 2.1 풀스택 구성 (Express + Vercel Serverless Functions + React 19 Vite)
- **공통 AI 비즈니스 서비스 (`lib/geminiService.ts`)**:
  - Google Gen AI `@google/genai` (Gemini 3.7 Flash) SDK 연동.
  - Vercel Serverless Function 런타임 표준에 맞춰 `process.env.GEMINI_API_KEY`를 `getGeminiClient()` 함수 내에서 지연(Lazy) 초기화하여 모듈 로딩 시점의 환경 변수 미인식 크래시 원천 방지.
  - `dotenv`를 라이브러리 내부에서 호출하지 않아 서버리스 런타임 호환성 극대화.
  - 모든 예외 경로에서 100% 표준 JSON 응답 및 방어적 파싱 보장 (`safeParseGeminiJson`).
  - 음식 완성 사진 등 레시피 텍스트가 없는 이미지 판독 시 `isRecipeFound` 플래그 및 안내 메시지 처리.
- **Vercel Serverless Functions (`api/`)**:
  - `POST /api/ai/import-recipe-image`: 요리책·메모 사진 기반 멀티모달 OCR 레시피 추출 (`api/ai/import-recipe-image.ts`)
  - `POST /api/ai/import-recipe`: 웹 URL 또는 텍스트 기반 레시피 구조화 추출 (`api/ai/import-recipe.ts`)
  - `POST /api/ai/ask-recipe`: 레시피 컨텍스트 기반 AI 요리 상담 (`api/ai/ask-recipe.ts`)
  - `POST /api/ai/recommend-menu`: 자연어 기분/상황 기반 내 레시피 풀 매칭 추천 (`api/ai/recommend-menu.ts`)
  - `GET /api/ai/diagnostic`: Gemini SDK 및 환경변수 설정 진단 엔드포인트 (`api/ai/diagnostic.ts` - 공통 geminiService 의존성 없이 독립 구동)
  - `GET /api/health`: 서비스 상태 진단 (`api/health.ts` - Gemini 모듈 미참조로 독립 진단 가능)
  - **정적 Import 및 안정적 번들링**: 모든 `api/ai/*.ts`에서 `../../lib/geminiService`를 상단에서 정적으로 `import`하여 Vercel 배포 시 의존성이 완벽하게 번들링되도록 보장.
  - `vercel.json`의 `/((?!api/.*).*)` 규칙을 통해 `/api/*` 요청이 SPA `index.html`로 폴백되지 않고 실제 서버리스 함수로 라우팅됨.
- **로컬/독립 백엔드 (`server.ts`)**:
  - 개발 모드(`npm run dev`)에서 `dotenv.config()`를 선행 실행하고 동일한 `lib/geminiService.ts`를 공유하여 로컬과 Vercel Production 간 100% 일치된 로직 구동.
- **클라이언트 AI 호출 안전 계층 (`src/utils/aiApiHelper.ts`)**:
  - `callAiApi<T>`: 페이로드 용량 사전 검증(최대 4.0MB), `response.text()` 선행 수신, `Content-Type: application/json` 검증, 방어적 JSON 파싱 및 오류 발생 시 `console.error`에 `status, error, details` 상세 출력.

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
│   │   └── recommend-menu.ts       # AI 오늘뭐먹지 추천 서버리스 함수
│   └── health.ts                   # 헬스체크 서버리스 함수
├── server.ts                       # 로컬 Express 개발 및 번들 서버
├── public/
│   ├── manifest.webmanifest        # PWA 매니페스트 (테마/아이콘/오프라인)
│   ├── sw.js                       # PWA 오프라인 Service Worker (Cache v2.1)
│   └── favicon.svg                 # 앱 파비콘
├── src/
│   ├── types/
│   │   ├── recipe.ts               # 레시피, 식단표, 타이머, 가족 공간 등 타입 정의
│   │   └── firebase.ts             # Firebase Auth 및 사용자 타입 정의
│   ├── config/
│   │   └── appConfig.ts            # 카테고리, 모델명, AI 엔드포인트, 스토리지 키
│   ├── data/
│   │   └── initialRecipes.ts       # 기본 26개 시드 레시피 데이터셋
│   ├── utils/
│   │   ├── aiApiHelper.ts          # 안전한 AI API 호출 및 JSON 파싱 헬퍼
│   │   ├── logger.ts               # 구조화된 디버그/인포 로거
│   │   ├── scaler.ts               # 인분 수 수학적 분량/분수 정밀 계산 엔진
│   │   └── storage.ts              # LocalStorage 영속화 및 마이그레이션 모듈
│   └── components/
│       ├── Header.tsx              # 상단 네비게이션, 오늘뭐먹지, 주간식단, 가족공간 바
│       ├── TodayMenuModal.tsx      # 🎲 오늘 뭐 먹지? (룰렛 & AI 추천 모달)
│       ├── WeeklyMealPlanView.tsx  # 📅 주간 식단표 뷰 (끼니별 계획 & 장보기 추출)
│       ├── CookingModeModal.tsx    # 🍳 집중 조리 모드 (타이머, 음성 TTS/STT, Wake Lock)
│       ├── RecipeDetailModal.tsx   # 👥 인분 조절, 재료/단계 체크, 장보기, 가족공유
│       ├── ImportRecipeModal.tsx   # 📷 사진 OCR / URL / 텍스트 레시피 가져오기
│       ├── FamilyShareModal.tsx    # 👨‍👩‍👧 가족 공유 공간 관리 모달
│       ├── AiChefView.tsx          # ✨ AI 요리사 Q&A 전용 화면
│       ├── HeroSection.tsx         # 통계 요약 및 퀵 카테고리 픽
│       ├── RecentRecipes.tsx       # 최근 본 레시피 캐러셀
│       ├── SearchBar.tsx           # 통합 검색 및 추천 태그
│       ├── CategoryFilter.tsx      # 카테고리별 동적 카운트 뱃지
│       ├── RecipeList.tsx          # 레시피 카드 그리드 및 다차원 정렬
│       ├── RecipeCard.tsx          # 레시피 카드 컴포넌트
│       ├── RecipeFormModal.tsx     # 레시피 등록 및 수정 폼
│       ├── ShoppingListModal.tsx   # 장보기 체크리스트 및 텍스트 공유
│       ├── BackupRestoreModal.tsx  # JSON 백업 및 복원 모달
│       ├── ConfirmModal.tsx        # 안전 확인 대화상자
│       ├── TimerWidget.tsx         # 주방 타이머 플로팅 위젯
│       ├── AboutSection.tsx        # 스마트 기능 소개
│       ├── Footer.tsx              # 푸터 정보
│       └── Toast.tsx               # 글로벌 피드백 토스트
```

---

## 3. 6대 신규 기능 상세 설계

### 3.1 🎲 오늘 뭐 먹지? (`TodayMenuModal.tsx`)
- **랜덤 룰렛 모드**:
  - 카테고리 필터(전체, 찌개, 볶음 등) 및 조리시간 필터(전체, 15분 이내, 30분 이내) 지원.
  - 역동적인 회전 애니메이션과 셔플 효과를 거쳐 레시피 당첨.
  - [다시 돌리기], [레시피 보기], [🍳 바로 요리 시작] 제공.
- **AI 맞춤 추천 모드**:
  - Gemini 3.7 Flash 기반 엔드포인트 (`/api/ai/recommend-menu`).
  - 사용자가 자연어(예: "비 오는 날 어울리는 얼큰한 국물 요리", "퇴근 후 10분 만에 끝내는 초간단 요리") 입력 또는 퀵 상황 칩(🌧️ 비 오는 날, 🏃 초간단, 🥗 가벼운 야식 등) 선택.
  - 내 레시피 북에서 가장 적합한 메뉴 1~2개를 선정하고 친절한 추천 이유 제시.
  - 최근 추천 이력 캐싱을 통해 중복 추천 방지.

### 3.2 📅 주간 식단표 (`WeeklyMealPlanView.tsx`)
- **주간 뷰 그리드**:
  - 이번 주, 지난 주, 다음 주 주차 간 간편 이동.
  - 월요일부터 일요일까지 7일 × 3끼(아침, 점심, 저녁) 식단 관리.
- **레시피 배치 및 메모**:
  - 내 레시피 북에서 손쉽게 메뉴 선택 및 인분 수(기본 2인분) 설정.
  - 레시피 외 자유 메모(예: "회사 회식", "가족 외식") 지원.
- **장보기 목록 원클릭 생성**:
  - 일주일 치 계획된 레시피들의 재료를 인분 배율에 맞추어 자동 합산 및 장보기 목록으로 일괄 변환.
- **주간 식단 텍스트 공유**:
  - 카카오톡이나 가족 메신저로 전송하기 좋은 서식화된 주간 식단표 텍스트 클립보드 복사.

### 3.3 🍳 조리단계 타이머 + 음성 요리모드 (`CookingModeModal.tsx`)
- **스마트폰 주방 거치형 UI**:
  - 시인성이 뛰어난 초대형 글꼴, 현재 단계 표시 (`3 / 7 단계`), 프로그레스 인디케이터.
- **Screen Wake Lock API**:
  - 요리 중 손에 물이나 양념이 묻어 화면을 터치하지 않아도 꺼지지 않도록 화면 켜짐 유지.
- **시간 자동 감지 원클릭 타이머**:
  - 조리 설명 텍스트에서 분/초("5분간 끓입니다", "30초간 볶습니다")를 정규식으로 자동 추출하여 [⏱️ 5분 타이머 시작] 버튼 원클릭 제공.
  - `Date.now() + duration` 절대 타임스탬프 기반으로 백그라운드 탭에서도 시간 오차 없음.
  - 멀티 타이머 지원 및 만료 시 Web Audio API 고주파 비프음 + 모바일 진동(`navigator.vibrate`) 알람.
- **Web Speech API 음성 지원**:
  - **TTS (음성 읽기)**: 한국어 발음(`ko-KR`)으로 현재 단계 설명을 명확하게 낭독.
  - **STT (음성 명령)**: 핸즈프리 음성인식 활성화 시 "다음", "이전", "다시 읽어줘", "완료" 등의 음성 명령으로 손대지 않고 조리 진행.
- **진행 상태 자동 저장 & 복원**:
  - 실수로 모달을 닫거나 새로고침해도 진행 중이던 단계와 체크 상태가 즉시 복원됨.

### 3.4 👥 인분 자동 변환 (`scaler.ts` & `RecipeDetailModal.tsx`)
- **정밀 스케일링 엔진**:
  - 정수(2), 소수(1.5), 단순 분수(1/2), 대분수(1 1/2) 완벽 파싱 및 연산.
  - 비수량 표현("약간", "적당량", "취향껏", "약간의 소금")은 텍스트를 손상시키지 않고 안전하게 보존.
  - 1인분 단위 스텝퍼(`[-] 3인분 [+]`) 및 빠른 프리셋 칩(1인분, 2인분, 3인분, 4인분, 6인분).
  - 원래 기준 인분 안내 및 `[원래 양으로]` 원클릭 복원 버튼.
  - 장보기 목록 담기 시 현재 조절된 인분 기준으로 정확한 수량 추가.

### 3.5 📷 사진으로 레시피 가져오기 (`ImportRecipeModal.tsx`)
- **클라이언트 이미지 압축**:
  - 브라우저 Canvas를 통해 최대 1600px, 85% JPEG 품질로 고속 압축하여 모바일 데이터 및 API 속도 최적화.
- **Gemini 3.7 Flash 멀티모달 OCR**:
  - 손글씨 요리 메모, 요리책 페이지, 조리식품 포장지 뒷면, 스크린샷에서 이름, 인분, 시간, 난이도, 재료 목록, 조리 순서를 구조화 추출.
- **불확실 항목 검토 배너**:
  - 사진이 흐릿하여 판독 신뢰도가 낮은 항목(`lowConfidenceFields`)은 ⚠️ 노란색 강조 안내를 표시하여 저장 전 사용자 확인 유도.
  - 원본 사진 보관 옵션 선택 시 레시피 상세에서 촬영한 원본 사진을 언제든 다시 열람 가능.

### 3.6 👨‍👩‍👧 가족 공유 공간 (`FamilyShareModal.tsx`)
- **가족 공간 생성 및 초대**:
  - "우리집 맛있는 부엌" 등 공간 이름 지정 후 6자리 초대 코드(`FAM-XXXXXX`) 자동 생성.
  - 초대 링크/코드 클립보드 원클릭 복사.
- **가족 참여 & 레시피 공유**:
  - 코드로 가족 공간 참여 시 "내 기존 레시피 공유하기" 옵션 제공.
  - 개별 레시피 단위로 `🔒 나만 보기` vs `👨‍👩‍👧 가족 공간에 공유` 토글 지원.
  - 가족 공간 참여 중인 경우 상단 헤더에 가족 공간 이름 배지 표시.

---

## 4. 데이터 영속성, 클라우드 동기화 및 보안 (Data Persistence & Cloud Sync)

### 4.1 3단계 저장 아키텍처 (3-Tier Storage Architecture)
기존의 단일/이원 저장 구조로 인한 데이터 덮어쓰기 손실 및 기기간 동기화 불일치를 원천 해결하기 위해, 다음과 같은 **엄격한 3단계 저장 및 동기화 모델**을 구축하였습니다:

| 구분 (Scope) | 저장 위치 | 대상 사용자 | 권한 및 특징 |
| :--- | :--- | :--- | :--- |
| **`public`** (공개) | Firestore `/recipes` | 모든 방문자 | 관리자(`isAdmin`)만 등록/수정/삭제 가능. 모든 사용자에게 실시간 동기화. |
| **`private`** (개인) | Firestore `/users/{uid}/recipes` | 로그인 사용자 | 로그인한 본인만 읽기/쓰기 가능 (`request.auth.uid == userId`). 본인의 모든 기기에서 실시간 동기화. |
| **`local`** (기기 전용) | 브라우저 `localStorage` | 비로그인 게스트 | 현재 기기에만 안전하게 보관. 로그인 후 클라우드 마이그레이션을 통해 `private`로 원클릭 승격 가능. |

#### 4.1.1 3단계 실시간 스냅샷 병합 원칙 (`recipeMerger.ts`)
화면에 렌더링되는 전체 레시피 목록은 `mergeThreeTiers(publicList, privateList, localList)` 함수를 통해 통합됩니다:
1. **절대 덮어쓰기 금지**: Firestore 공개 레시피 스냅샷 수신 시 로컬/개인 레시피를 절대 replace하지 않고 3-tier 병합 실행.
2. **우선순위 계층**:
   - `private` 레시피는 동일 ID의 `public` 레시피보다 우선.
   - `local` 레시피는 동일 ID의 `public` 레시피보다 우선.
   - `private`와 `local` 충돌 시 `updatedAt`이 최신인 레시피 우선.
3. **로그아웃 격리**: 사용자가 로그아웃하면 `users/{uid}/recipes` 리스너를 해제하고, `private` 레시피를 화면 및 로컬스토리지에서 즉시 제거하여 타 사용자 정보 노출을 차단하며 `public` 및 `local` 레시피만 보존.

#### 4.1.2 저장 및 삭제 흐름 정책
1. **저장 정책 (`handleSaveRecipe`)**:
   - 관리자(`isAdmin`): `/recipes` (public) 저장
   - 로그인 일반 사용자(`user`): `/users/{uid}/recipes` (private) 저장
   - 비로그인 게스트: `localStorage` (local) 저장
   - **클라우드 선행 저장 원칙**: Firestore 대상일 경우 클라우드에 성공적으로 기록되기 전까지 성공 Toast 및 상태 변경을 유보하여 데이터 일관성 보장. 비관리자의 `public` 레시피 수정/삭제 시도는 차단.
2. **삭제 정책 (`handleDeleteRecipeRequest`)**:
   - `public`: 관리자만 `deletePublicRecipe()` 호출
   - `private`: 본인만 `deletePrivateRecipe(user.uid, id)` 호출
   - `local`: 기기 `localStorage`에서만 삭제
3. **마이그레이션 정책 (`migrateLocalDataToCloud`)**:
   - 일반 사용자의 로컬 레시피는 반드시 `users/{uid}/recipes`로만 배치(batch) 업로드하여 `private`로 전환.
   - 대용량 데이터 시 Firestore 500개 쓰기 제한을 방어하기 위해 400개 단위 청크 배치 분할 적용.

### 4.2 Firebase Authentication & Cloud Firestore
- **Firebase 전용 Named App 격리 (`firebase.ts`)**:
  - `FIREBASE_APP_NAME = 'my-recipe-client'`를 사용하여 기본 `[DEFAULT]` 인스턴스와 격리된 `my-recipe-1569b` 공식 설정을 단일 Source of Truth로 유지.
  - 앱 시작 시 실제 `firebaseApp.options` 및 Identity Toolkit API 기반 Authorized Domains 진단 로깅 자동 실행.
- **Google 간편 로그인 (`useFirebaseAuth.ts`)**:
  - **PC 및 모바일/PWA 공통**: 버튼 클릭 시 `signInWithPopup` 직접 호출로 일관된 인증 플로우 보장.
  - 리다이렉트 프록시 부재로 인한 모바일 인증 복귀 실패 문제를 원천 차단하고, `onAuthStateChanged` 단일 소스로 `user` 상태와 헤더를 즉시 동기화.
  - 로그인 성공 시 `[Firebase.auth] popup completed` 진단 로그 (UID, 마스킹 이메일, `auth.currentUser`) 출력.
  - 로그인 중복 클릭 방지(`isLoggingIn` 상태 및 버튼 disabled), `finally`에서 로딩 상태 완벽 복구, 에러 코드별 명확한 한국어 Toast 안내.
  - 로그인 성공 시 사용자 프로필(사진, 이름, 이메일) 헤더 반영 및 클라우드 동기화 자동 시작.
- **Firestore 다중 탭 및 오프라인 영속성 (`firebase.ts`)**:
  - `persistentLocalCache` + `persistentMultipleTabManager`를 적용하여 네트워크가 끊겨도 로컬 캐시에서 즉시 동작하고 재연결 시 자동 동기화.
- **PWA Service Worker (`public/sw.js`)**:
  - `my-recipe-cache-v2.1` 적용.
  - Navigation 및 HTML 문서는 **Network First**로 최신 배포본을 즉시 반영하며 오프라인 시 캐시 폴백.
  - 구버전 캐시 자동 정리 (`activate` 단계).
- **보안 규칙 (`firestore.rules`)**:
  - `/recipes/{recipeId}`: 읽기는 모든 사용자 허용, 쓰기는 관리자(`isAdmin()`)만 허용.
  - `/users/{userId}/{document=**}`: `request.auth != null && request.auth.uid == userId`인 본인만 접근 허용.
  - `/admins/{adminId}`: 관리자만 접근 허용.

### 4.3 로컬스토리지 영속화 (Local Fallback)
1. `my_recipes_data`: 레시피 목록 (초기 26개 시드 보존)
2. `my_recipes_bookmarks`: 즐겨찾기 ID 목록
3. `my_recipes_shopping_list`: 장보기 목록
4. `my_recipes_notes`: 사용자 레시피별 꿀팁 메모
5. `my_recipes_weekly_meal_plan`: 주간 식단표
6. `my_recipes_family_profile` & `my_recipes_family_spaces`: 가족 공간 데이터

### 4.3 서버 사이드 AI 보안
- `GEMINI_API_KEY`는 오직 Node/Express 백엔드에서만 처리하며 클라이언트에 노출하지 않음.

### 4.4 완전한 백업/복원
- 전체 데이터를 JSON으로 내보내고 다른 기기에서 병합/복원 가능.

---

## 5. UI/UX 디자인 가이드라인
- **색상 체계**: 따뜻한 크림 배경(`#fffaf3`), 주황(`orange-500`), 호박색(`amber-500`), 에메랄드(`emerald-600`), 로즈(`rose-500`).
- **타이포그래피**: `Pretendard`, `font-soft`, 고대비 텍스트, 가독성 높은 행간(1.6).
- **인터랙션**: 모달 활성화 시 바디 스크롤 락, 모든 주요 동작에 비동기 피드백 토스트 제공.
