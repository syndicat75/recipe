# 내 입맛 레시피 (My Favorite Recipes) - 시스템 설계서 및 아키텍처 문서 (Design.md)

## 1. 개요 (Overview)
**내 입맛 레시피**는 사용자가 일상에서 자주 요리하는 황금비율 요리법을 체계적으로 관리하고, 주방에서 바로 요리하며 스마트하게 활용할 수 있도록 설계된 개인 레시피 북 풀스택 웹 애플리케이션(PWA)입니다.

---

## 2. 시스템 아키텍처 (System Architecture)

### 2.1 풀스택 구성 (Full-Stack Express + React Vite)
- **Backend (`server.ts`)**:
  - Express 웹 서버와 Gemini AI `@google/genai` SDK를 통합.
  - API 키를 브라우저에 노출하지 않고 서버 측 보안 환경변수(`process.env.GEMINI_API_KEY`)로 안전하게 보호.
  - 개발 환경에서는 Vite 미들웨어(`middlewareMode: true`)로 실시간 개발 환경을 제공하며, 프로덕션 환경에서는 `dist/` 정적 자산 서빙 및 SPA 라우팅을 지원.
- **Frontend (`src/`)**:
  - React 19 + TypeScript + Tailwind CSS 기반의 반응형 모바일 최적화 SPA.
  - PWA 지원 (Service Worker + Manifest).

### 2.2 파일 및 디렉토리 구조
```
├── server.ts                  # Express 백엔드 서버 & Gemini AI 엔드포인트 프록시
├── public/
│   ├── manifest.webmanifest   # PWA 설정 및 테마/아이콘 매니페스트
│   ├── sw.js                  # PWA 오프라인 캐싱 Service Worker
│   └── favicon.svg            # 앱 파비콘
├── src/
│   ├── types/
│   │   └── recipe.ts          # 레시피, 장보기, 백업, 정렬 등 전역 인터페이스 정의
│   ├── config/
│   │   └── appConfig.ts       # 카테고리, 모델명, AI 엔드포인트, 퀵/프리셋 질문, 스토리지 키 설정
│   ├── data/
│   │   └── initialRecipes.ts  # 기본 제공 26개 시드 레시피 불변 데이터셋
│   ├── utils/
│   │   ├── logger.ts          # 함수별 구조화된 디버그/인포 로거
│   │   ├── scaler.ts          # 인분 수 수학적 분량 자동 계산 유틸리티
│   │   └── storage.ts         # LocalStorage 영속화, 시딩, 마이그레이션, 백업/복원
│   └── components/
│       ├── Header.tsx         # 상단 반응형 네비게이션 & 빠른 도구 바 (AI 요리사 메뉴, 온/오프라인, 설치)
│       ├── AiChefView.tsx     # ✨ AI 요리사 Q&A 전용 화면 (일반/레시피 컨텍스트 듀얼 모드, 빠른 질문, 메모 저장)
│       ├── HeroSection.tsx    # 통계 요약 및 퀵 카테고리 픽
│       ├── RecentRecipes.tsx  # 최근 본 레시피 가로 스크롤 캐러셀 (최대 5개)
│       ├── SearchBar.tsx      # 음식명, 재료명, 조리법 통합 검색 및 추천 태그
│       ├── CategoryFilter.tsx # 카테고리별 동적 카운트 뱃지 및 즐겨찾기 탭
│       ├── RecipeList.tsx     # 레시피 카드 그리드 및 다차원 정렬 시스템
│       ├── RecipeCard.tsx     # 4:3 비율 사진/이모지 지원 레시피 카드
│       ├── RecipeDetailModal.tsx # 재료 체크, 단계 체크, 인분 조절, AI 비법 질문 진입로
│       ├── RecipeAiModal.tsx  # 레시피 전용 Gemini AI 실시간 질의응답 모달
│       ├── ImportRecipeModal.tsx # URL/텍스트 기반 Gemini AI 레시피 자동 추출 및 등록
│       ├── RecipeFormModal.tsx# 레시피 등록 및 수정 통합 폼 (사진/이모지/메모)
│       ├── CookingModeModal.tsx # Screen Wake Lock API 지원 집중 조리 모드
│       ├── ShoppingListModal.tsx # 장보기 체크리스트, 품목 추가, 일괄 정리 및 텍스트 공유
│       ├── BackupRestoreModal.tsx # JSON 백업 다운로드 및 병합/교체 복원
│       ├── ConfirmModal.tsx   # 삭제/덮어쓰기/메모저장 전 안전 확인 대화상자
│       ├── TimerWidget.tsx    # 프리셋 키친 타이머 위젯
│       ├── AboutSection.tsx   # 앱 스마트 기능 소개 및 AI 요리사 클릭 진입로
│       ├── Footer.tsx         # 하단 푸터 정보
│       └── Toast.tsx          # 글로벌 피드백 토스트 시스템
```

---

## 3. 핵심 신규 기능 명세 (Feature Specifications)

### 3.1 ✨ AI 요리사 Q&A 전용 화면 및 정식 메뉴 (`/ai-chef`)
- **엔드포인트**: `POST /api/ai/ask-recipe`
- **접근성 및 네비게이션**:
  1. **PC 상단 Header**: `✨ AI 요리사` 정식 메뉴 버튼으로 언제든 1클릭 진입.
  2. **모바일 햄버거 메뉴**: 모바일 환경에서도 최상단 전폭 `✨ AI 요리사 (Q&A)` 버튼 제공.
  3. **메인 홈 소개 카드 (`AboutSection`)**: 단순 설명이 아닌 전체 클릭 가능한 진입 카드 (`AI 요리사에게 물어보기 →` 액션 버튼 포함).
  4. **레시피 상세 모달 (`RecipeDetailModal`)**: 상단 헤더 툴바 및 본문 하단에 `✨ AI에게 물어보기` 버튼 배치 (현재 레시피의 음식명, 카테고리, 재료, 조리법, 사용자 메모를 컨텍스트로 자동 전달).
  5. **플로팅 퀵 버튼**: 홈 화면 우하단에서 원클릭 진입 가능.
  6. **SPA 라우팅**: `/ai-chef` 및 `#/ai-chef` 해시 라우팅 지원, 브라우저 뒤로가기/홈으로 버튼 완벽 지원.
- **주요 기능 & UI**:
  - **듀얼 질문 모드**: 특정 레시피 컨텍스트 모드 (`🥘 김치찌개에 대해 질문 중`) 및 일반 요리 질문 모드 (`🌟 일반 요리 질문 모드`) 간 유연한 전환 및 레시피 선택 드롭다운.
  - **예시 질문 가이드**: `대체 재료는?`, `더 맛있게 만드는 방법은?`, `너무 짜졌는데 어떻게 하지?`, `너무 매운데 어떻게 살리지?`, `남은 재료로 뭘 만들까?`, `2인분을 4인분으로 바꾸려면?`, `돼지고기 대신 소고기를 사용해도 될까?`.
  - **빠른 질문 칩**: `🥬 대체 재료`, `👨‍🍳 더 맛있게`, `🌶️ 덜 맵게`, `🧂 너무 짤 때`, `⏱️ 빠르게 만들기`, `🍱 남은 재료 활용`.
  - **키보드 편의성**: `Enter`로 전송, `Shift + Enter`로 줄바꿈.
  - **안전한 메모 저장**: AI 답변을 원본 레시피를 덮어쓰지 않고, 확인 팝업(`이 내용을 내 요리 메모에 추가하시겠습니까?`)을 거쳐 `나만의 요리 메모`에 안전하게 추가.
  - **오프라인/오류 복원력**: 오프라인 상태 감지 알림 및 네트워크 오류 시 [다시 시도] 버튼 제공. Gemini API 키 연결 상태와 관계없이 UI는 항상 안정적으로 렌더링.

### 3.2 🛒 스마트 장보기 목록 (Shopping List)
- **개념**: 요리에 필요한 재료를 개별 또는 일괄로 장보기 바구니에 담아 마트에서 바로 확인.
- **주요 기능**:
  - 레시피 상세 모달에서 `전체 재료 담기` 또는 특정 재료 옆의 `🛒` 버튼 클릭 시 즉시 추가.
  - 마트에서 구매 완료 시 체크박스로 취소선 처리.
  - '완료 항목 일괄 삭제' 및 '전체 비우기' 지원.
  - `📋 장보기 목록 복사` 버튼으로 메신저/문자 전송용 포맷 텍스트 자동 복사.

### 3.3 📥 외부 레시피 AI 가져오기 (External Recipe AI Importer)
- **엔드포인트**: `POST /api/ai/import-recipe`
- **구현**:
  - 사용자가 요리 블로그/웹페이지 URL 또는 요리 텍스트를 입력.
  - URL의 경우 서버 측에서 HTML을 안전하게 페칭하여 본문 텍스트를 추출한 뒤, `gemini-3.7-flash` 모델을 통해 정형화된 Recipe JSON(`name`, `category`, `icon`, `ingredients`, `method`, `cookingTimeMinutes`, `difficulty` 등)으로 변환.
  - 추출된 레시피를 모달 폼에 자동 입력하거나 즉시 나만의 레시피로 저장.

### 3.4 📱 PWA 설치 및 오프라인 사용 (Progressive Web App - Cache v2.0)
- **매니페스트 (`manifest.webmanifest`)**: `standalone` 디스플레이 모드, 웜 크림/오렌지 테마 컬러, 반응형 아이콘 정의.
- **서비스 워커 (`sw.js`)**:
  - 핵심 정적 파일(HTML, JS, CSS, 폰트 등)을 사전 캐싱하여 오프라인에서도 웹앱이 정상 실행되도록 지원.
  - 구버전 캐시 자동 정리 및 `my-recipe-cache-v2.0` 지원.
- **UI 피드백**:
  - `beforeinstallprompt` 이벤트를 감지하여 상단 헤더에 `앱 설치` 버튼 제공.
  - `window.addEventListener('offline')`을 통해 오프라인 감지 시 상단 경고 바 및 안내 토스트 표시.

---

## 4. 데이터 영속성 및 보안 (Data Persistence & Security)

1. **로컬스토리지 영속화**:
   - 사용자가 작성한 모든 신규 레시피, 수정본, 삭제 내역, 북마크, 메모, 장보기 목록은 브라우저 `localStorage`에 즉시 반영.
   - 최초 26개 시드 레시피는 `loadAllRecipes` 호출 시 기존 사용자 데이터가 없을 때만 안전하게 초기화.

2. **서버 사이드 AI 보안**:
   - `GEMINI_API_KEY`는 오직 `server.ts`에서만 읽어 사용하며 브라우저 번들에 절대 노출되지 않음.
   - 키가 설정되지 않은 경우에도 데스크톱 서버가 안전하게 가드되고 사용자에게 친절한 설정 안내 메시지를 반환.

3. **백업 및 복원 (Backup & Restore)**:
   - `my-recipes-YYYY-MM-DD.json` 형태로 전체 데이터(레시피, 북마크, 메모, 장보기 목록)를 단일 파일로 백업/복원 가능.

---

## 5. UI/UX 디자인 원칙
- **Color Palette**: 웜 크림(`#fffaf3`), 주황색(`orange-500`), 호박색(`amber-500`), 스톤 뉴트럴 계열 유지.
- **모바일 반응형 & 터치 타겟**: 최소 44px 터치 영역 확보, 360px 모바일 화면에서도 가로 스크롤 없이 유려한 레이아웃 제공.
- **모달 스크롤 락**: 모달 활성화 시 `document.body.style.overflow = 'hidden'`을 적용하여 배경 스크롤 방지.
- **안정적인 상태 피드백**: 모든 CRUD, 북마크, 복원, 장보기, AI 질문 액션마다 글로벌 토스트 알림 제공.

