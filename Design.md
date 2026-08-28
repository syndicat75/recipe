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
│   │   ├── recipe.ts               # 레시피, 식단표, 타이머 타입 정의
│   │   ├── family.ts               # Firestore 실시간 가족 공유 스키마 및 문서 타입 정의
│   │   ├── firebase.ts             # Firebase Auth 및 사용자 동기화 상태 타입 정의
│   │   └── navigation.ts           # 해시 라우팅 및 뷰 모드 타입 정의
│   ├── config/
│   │   ├── appConfig.ts            # 카테고리, 모델명, AI 엔드포인트, 스토리지 키
│   │   └── firebaseConfig.ts       # Firebase SDK 초기화 및 싱글톤 인스턴스
│   ├── data/
│   │   └── initialRecipes.ts       # 기본 26개 시드 레시피 데이터셋
│   ├── services/
│   │   ├── familySync.ts           # Cloud Firestore 가족 공유 실시간 동기화 서비스
│   │   └── firestoreSync.ts        # 개인 사용자 설정 클라우드 동기화 서비스
│   ├── hooks/
│   │   ├── useFirebaseAuth.ts      # Firebase Google Authentication 훅
│   │   ├── useFamilySync.ts        # Cloud Firestore 실시간 가족 공간 동기화 훅
│   │   ├── usePublicRecipes.ts     # /recipes 단일 진실 공급원 실시간 구독 및 관리자 CRUD 훅
│   │   ├── useRecipePreferences.ts # 즐겨찾기, 사용자 메모, 최근 본 레시피 상태 훅
│   │   ├── useShoppingList.ts      # 장보기 목록 CRUD 및 클라우드 동기화 훅
│   │   ├── useMealPlan.ts          # 개인 주간 식단표 관리 및 레시피 추가 훅
│   │   ├── useRecipeFilter.ts      # 실시간 검색어, 카테고리 필터링, 정렬 로직 훅
│   │   ├── useRecipeMigration.ts   # 클라우드 마이그레이션 모달 및 시드 복구 훅
│   │   ├── useAppNavigation.ts     # URL Hash 기반 뷰 라우팅 동기화 훅
│   │   ├── useNetworkStatus.ts     # 온라인/오프라인 상태 감지 훅
│   │   ├── usePwaInstall.ts        # PWA 설치 프롬프트 및 안내 모달 훅
│   │   └── useToast.ts             # 중복 방지 전역 토스트 알림 훅
│   ├── utils/
│   │   ├── admin.ts                # 관리자 UID/이메일 판별 유틸
│   │   ├── aiApiHelper.ts          # 안전한 AI API 호출 및 JSON 파싱 헬퍼
│   │   ├── firestoreSanitizer.ts   # Firestore undefined 필드 재귀적 제거 및 에러 포맷팅 유틸
│   │   ├── logger.ts               # 구조화된 디버그/인포 로거
│   │   ├── pwaHelper.ts            # PWA 브라우저 환경 및 standalone 감지 헬퍼
│   │   ├── scaler.ts               # 인분 수 수학적 분량/분수 정밀 계산 엔진
│   │   └── storage.ts              # LocalStorage 영속화 및 마이그레이션 모듈
│   └── components/
│       ├── Header.tsx              # 상단 네비게이션 헤더 (4대 영역 서브컴포넌트 조립 레이아웃)
│       ├── header/
│       │   ├── HeaderBrand.tsx     # 브랜드 로고 및 앱 타이틀 (줄바꿈 방지 및 해상도별 부제 제어)
│       │   ├── SyncStatusBadge.tsx # 실시간 클라우드 동기화 상태 뱃지
│       │   ├── DesktopNavigation.tsx # 데스크톱 중앙 핵심 네비게이션 메뉴바 (홈, 오늘뭐먹지, 주간식단, AI, 즐겨찾기, 가족)
│       │   ├── ToolsMenu.tsx       # 통합 편의 도구 드롭다운 (앱 설치, 타이머, 백업/복원, 시드 복구)
│       │   ├── UserAuthMenu.tsx    # Google 로그인 및 사용자 프로필 드롭다운 (이메일, 관리자 뱃지, 동기화 상태, 로그아웃)
│       │   └── MobileNavMenu.tsx   # 모바일 반응형 4대 섹션 네비게이션 드로어
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
│       ├── Toast.tsx               # 글로벌 피드백 토스트
│       ├── CloudMigrationModal.tsx # 클라우드 데이터 마이그레이션 모달
│       ├── PwaInstallModal.tsx     # PWA 직접 설치 및 브라우저별 가이드 모달
│       └── ErrorBoundary.tsx       # 리액트 렌더링 예외 경계 컴포넌트
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

### 3.6 👨‍👩‍👧 가족 공유 공간 (`FamilyShareModal.tsx` & `useFamilySync.ts`)
- **Cloud Firestore 기반 다기기 실시간 동기화**:
  - 기존 `localStorage` 중심의 로컬 시뮬레이션을 전면 대체하여 Google 계정 로그인 기반의 실제 Firestore 다기기 실시간 공유 환경 구축.
  - 가족 A가 PC에서 공간 생성 후 초대 코드를 발송하면, 가족 B가 모바일에서 초대 링크(`?familyInvite=FAM-XXXXXX`) 또는 코드로 즉시 참여하여 동일한 공간을 공유.
- **가족 공간 스키마 & 서브 컬렉션 구조**:
  - `/families/{familyId}`: 가족 공간 메타 정보 (이름, 초대코드, 방장 UID, 생성/수정 일시)
  - `/families/{familyId}/members/{memberUid}`: 실시간 구성원 목록 (닉네임, 역할, 아바타 이모지, 참여일시)
  - `/families/{familyId}/recipes/{recipeId}`: 가족 공유 레시피 참조 키 (공유자 UID, 공유 일시 - 공개 `/recipes` 훼손 없이 안전 분리)
  - `/families/{familyId}/mealPlans/{entryId}`: 가족 주간 식단표 (날짜, 슬롯, 레시피 ID, 인분, 생성자)
  - `/families/{familyId}/shoppingList/{itemId}`: 실시간 가족 장보기 목록 (텍스트, 완료 여부, 등록자)
  - `/familyInvites/{inviteCode}`: 초대 코드 조회 및 중복 방지 인덱스 문서
  - `/users/{uid}/familyProfile/info`: 사용자별 참여 중인 `currentFamilyId` 및 프로필 정보
  - `/users/{uid}/familyMemberships/{familyId}`: 사용자가 가입된 가족 목록
- **레시피 공유 관리**:
  - 개별 레시피 단위로 `🔒 나만 보기` vs `👨‍👩‍👧 가족 공간에 공유` 실시간 토글 지원.
  - 레시피 카드에 `👨‍👩‍👧 가족 공유` 배지 실시간 표시.
  - 모달 내에서 우리 가족 공유 레시피 전체 모아보기 및 원클릭 상세 열람 지원.
- **방장 권한 관리 & 가족 나가기**:
  - 방장(Owner)은 다른 가족 구성원에게 방장 권한을 안전하게 위임(Ownership Transfer)하거나 공간 삭제 가능.
  - 일반 구성원은 언제든 가족 공간을 자유롭게 나갈 수 있으며, 나간 사용자의 레시피는 자동으로 정리됨.
- **자동 초대 링크 처리**:
  - `?familyInvite=FAM-XXXXXX` URL 파라미터 감지 시 Google 로그인 여부를 확인하여 로그인된 경우 즉시 가족 참여 실행, 비로그인 시 친절한 로그인 안내 후 자동 합류 처리.

---

## 4. 데이터 영속성, 클라우드 동기화 및 보안 (Data Persistence & Cloud Sync)

### 4.1 단일 진실 공급원 아키텍처 (Single Source of Truth - Firestore `/recipes`)
앱에 등록된 정식 레시피는 **로그인 여부(비로그인 외부 방문자, 일반 로그인 사용자, 관리자)와 관계없이 모든 사용자에게 동일하게 제공**되어야 합니다.
이를 위해 레시피의 단일 진실 공급원(Single Source of Truth)을 Firestore `/recipes`로 일원화하고, 엄격한 권한 분리 모델을 적용하였습니다:

| 사용자 구분 | 레시피 목록 조회 | 레시피 등록 / 수정 / 삭제 | 개인 설정 (북마크, 꿀팁 메모, 장보기) |
| :--- | :---: | :---: | :---: |
| **비로그인 외부 방문자** | ✅ 전체 공식 레시피 조회 | ❌ 등록/수정/삭제 불가 (버튼 미노출 및 차단) | 기기 `localStorage`에 영속화 |
| **일반 로그인 사용자** | ✅ 전체 공식 레시피 조회 | ❌ 등록/수정/삭제 불가 (관리자 전용 안내) | 계정 클라우드(`users/{uid}/*`) 실시간 동기화 |
| **관리자 (`isAdmin`)** | ✅ 전체 공식 레시피 조회 | ✅ `/recipes` 직접 등록 / 수정 / 삭제 가능 | 계정 클라우드 및 공개 DB 원클릭 마이그레이션 |

#### 4.1.1 실시간 동기화 및 데이터 일관성 원칙
1. **단일 진실 공급원 (`subscribeToPublicRecipes`)**:
   - 앱 구동 시 Firestore `/recipes` 컬렉션을 실시간 구독하여 모든 방문자에게 동일한 공식 레시피 목록을 공급합니다.
   - 네트워크 연결 전이나 오프라인 상태에서는 초기 시드 및 로컬 캐시(`my_recipes_data`)가 즉시 렌더링되고, 원격 스냅샷 수신 시 안전하게 병합(`mergeRecipeLists`)됩니다.
2. **로그아웃 시 레시피 영속성 유지**:
   - 로그아웃하더라도 공식 레시피 목록(`recipes`)은 절대 비우거나 지우지 않습니다.
   - 사용자 개인 설정(북마크, 꿀팁 메모, 장보기 목록)만 로컬스토리지 저장본으로 안전하게 전환 복구합니다.
3. **관리자 마이그레이션 도구 (`migrateAllRecipesToPublicDb`)**:
   - 관리자가 로컬 시드(27개 등)나 새 레시피를 Firestore `/recipes`에 일괄 배포할 수 있는 전용 마이그레이션 파이프라인을 지원합니다.
   - 기존 원격 문서를 절대 임의 삭제하지 않고, 400개 단위 청크 배치(`chunkArray`)로 안전하게 병합 추가합니다.

#### 4.1.2 저장 및 삭제 흐름 정책
1. **저장 정책 (`handleSaveRecipe`)**:
   - 관리자(`isAdmin`)만 등록 및 수정이 허용되며, 데이터는 항상 Firestore `/recipes`에 `syncScope: 'public'`으로 기록됩니다.
   - 비관리자의 수정 시도는 UI(버튼 비활성화) 및 로직 레벨에서 원천 차단됩니다.
2. **삭제 정책 (`handleDeleteRecipeRequest`)**:
   - 관리자(`isAdmin`)만 `deletePublicRecipe()`를 통해 공개 DB에서 안전하게 영구 삭제할 수 있습니다.
3. **개인화 데이터 격리**:
   - 사용자별 즐겨찾기, 레시피 메모, 장보기 목록은 `users/{uid}/settings/*` 및 `users/{uid}/shoppingList/*`에 독립적으로 격리 동기화됩니다.

### 4.1 공개 레시피 단일 진실 공급원 (Single Source of Truth)
- **Firestore `/recipes` 우선 동기화**:
  - 앱 시작 시 Firestore `/recipes`의 실시간 스냅샷(`subscribeToPublicRecipes`)을 무조건 최종 상태로 수신하여 로컬 상태(`recipes`) 및 오프라인 캐시(`localStorage`)에 저장합니다.
  - 고정 개수(26/27개) 조건 검사나 임의 병합을 제거하여, 관리자가 공개 DB에서 레시피를 삭제하거나 추가했을 때 즉각적이고 정확하게 모든 기기/방문자 화면에 반영됩니다.
- **관리자 전용 기본 레시피 복구 기능**:
  - 관리자가 의도치 않게 삭제한 기본 레시피를 복구하고자 할 때, 헤더 사용자 메뉴의 `[기본 시드 레시피 복구]` 버튼을 통해 누락된 원본 시드 레시피만 골라 선택적으로 복원할 수 있습니다.

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

### 4.5 PWA 크로스 플랫폼 설치 아키텍처 (PC, Android, Samsung, iOS)
1. **PWA 실행 상태 정밀 감지 (`src/utils/pwaHelper.ts`)**:
   - `checkIsStandalone()`: `window.matchMedia('(display-mode: standalone)').matches` 및 iOS의 `navigator.standalone === true`를 종합 판별.
   - PWA Standalone 모드로 실행 중일 때는 불필요한 설치 버튼/메뉴를 자동으로 숨김.
2. **Android Chrome 지원**:
   - `beforeinstallprompt` 이벤트를 `deferredPrompt` 상태에 보관.
   - 설치 버튼 클릭 시 네이티브 `deferredPrompt.prompt()` 및 `deferredPrompt.userChoice` 실행.
   - 설치 성공 시 `🎉 내 입맛 레시피 앱이 설치되었습니다.` 토스트 안내 및 `isInstalled=true` 갱신.
   - `appinstalled` 이벤트를 리스닝하여 설치 즉시 상태 동기화.
3. **Samsung Internet 지원**:
   - `navigator.userAgent`에 `SamsungBrowser` 정규식 매칭을 통해 삼성 인터넷 감지.
   - `deferredPrompt`가 없더라도 설치가 실패하지 않고, 삼성 인터넷 전용 맞춤 안내 모달 제공 (`☰ 메뉴` → `현재 페이지 추가` / `앱 추가` → `홈 화면`).
4. **iPhone / iPad Safari 지원**:
   - `navigator.userAgent`에 `/iPhone|iPad|iPod/i` 매칭을 통해 iOS 감지.
   - 자동 프롬프트를 시도하지 않고, Safari 전용 설치 안내 모달 제공 (하단 공유 버튼 `□↑` → `홈 화면에 추가` → `추가`).
5. **기타 브라우저 Fallback & 모바일 햄버거 메뉴 항상 표시**:
   - `canInstallPwa` 조건을 `!isInstalled && !isStandalone`으로 설정하여 자동 프롬프트가 지원되지 않는 모바일 환경에서도 항상 모바일 햄버거 메뉴 및 AboutSection에 `📲 앱 설치` 메뉴 제공.
   - 이미 설치 완료 시 `✓ 앱 설치됨` 뱃지 표시.
   - 설치 안내 모달(`PwaInstallModal.tsx`)에서 브라우저 탭(Chrome, 삼성 인터넷, iPhone/Safari, 기타 브라우저)을 자유롭게 전환하며 단계별 안내 확인 가능.

---

## 5. UI/UX 디자인 가이드라인
- **색상 체계**: 따뜻한 크림 배경(`#fffaf3`), 주황(`orange-500`), 호박색(`amber-500`), 에메랄드(`emerald-600`), 로즈(`rose-500`).
- **타이포그래피**: `Pretendard`, `font-soft`, 고대비 텍스트, 가독성 높은 행간(1.6).
- **인터랙션**: 모달 활성화 시 바디 스크롤 락, 모든 주요 동작에 비동기 피드백 토스트 제공.
