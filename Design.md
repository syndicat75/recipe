# 내 입맛 레시피 (My Favorite Recipes) - 시스템 설계서 및 아키텍처 문서 (Design.md)

## 1. 개요 (Overview)
**내 입맛 레시피**는 사용자가 일상에서 자주 요리하는 황금비율 요리법을 체계적으로 관리하고, 주방에서 바로 요리하며 스마트하게 활용할 수 있도록 설계된 개인 레시피 북 웹 애플리케이션입니다.

---

## 2. 핵심 기능 및 컴포넌트 아키텍처 (Architecture)

### 2.1 파일 및 디렉토리 구조
```
src/
├── types/
│   └── recipe.ts            # 레시피, 장보기, 백업, 정렬 등 전역 인터페이스 정의
├── config/
│   └── appConfig.ts         # 카테고리 메타데이터, 스토리지 키, 기본값 설정
├── data/
│   └── initialRecipes.ts    # 기본 제공 26개 시드 레시피 불변 데이터셋
├── utils/
│   ├── logger.ts            # 함수별 구조화된 디버그/인포 로거
│   ├── scaler.ts            # 인분 수 수학적 분량 자동 계산 유틸리티
│   └── storage.ts           # LocalStorage 영속화, 시딩, 마이그레이션, 백업/복원
└── components/
    ├── Header.tsx           # 상단 반응형 네비게이션 & 빠른 도구 바
    ├── HeroSection.tsx      # 통계 요약 및 퀵 카테고리 픽
    ├── RecentRecipes.tsx    # 최근 본 레시피 가로 스크롤 캐러셀 (최대 5개)
    ├── SearchBar.tsx        # 음식명, 재료명, 조리법 통합 검색 및 추천 태그
    ├── CategoryFilter.tsx   # 카테고리별 동적 카운트 뱃지 및 즐겨찾기 탭
    ├── RecipeList.tsx       # 레시피 카드 그리드 및 다차원 정렬 시스템
    ├── RecipeCard.tsx       # 4:3 비율 사진/이모지 지원 레시피 카드
    ├── RecipeDetailModal.tsx# 재료 체크박스, 단계 체크, 인분 조절, 고정 헤더
    ├── RecipeFormModal.tsx  # 레시피 등록 및 수정 통합 폼 (사진/이모지/메모)
    ├── CookingModeModal.tsx # Screen Wake Lock API 지원 집중 조리 모드
    ├── ShoppingListModal.tsx# 장보기 체크리스트 및 텍스트 공유
    ├── BackupRestoreModal.tsx # JSON 백업 다운로드 및 병합/교체 복원
    ├── ConfirmModal.tsx     # 삭제/덮어쓰기 전 안전 확인 대화상자
    ├── TimerWidget.tsx      # 프리셋 키친 타이머 위젯
    ├── AboutSection.tsx     # 앱 활용 팁 및 가이드
    ├── Footer.tsx           # 하단 푸터 정보
    └── Toast.tsx            # 글로벌 피드백 토스트 시스템
```

---

## 3. 데이터 흐름 및 영속성 설계 (Data Flow & Persistence)

1. **시딩 및 마이그레이션**:
   - 앱 최초 실행 시 `storage.loadAllRecipes()`가 `INITIAL_RECIPES` 26개를 로컬스토리지에 안전하게 시드합니다.
   - 이미 사용자가 추가하거나 수정한 데이터가 있으면 기존 데이터를 유지하며 데이터 중복이 발생하지 않습니다.

2. **레시피 CRUD (Create, Read, Update, Delete)**:
   - **Create**: 상단 헤더 버튼 또는 우측 하단 플로팅 `+ 레시피 추가` 버튼으로 신규 레시피 등록.
   - **Read**: 메인 그리드 및 최근 본 레시피에서 클릭 시 상세 모달 오픈 (최근 본 목록에 자동 추가).
   - **Update**: 상세 모달 상단 `✏ 수정` 버튼으로 기존 정보 로드 후 수정 저장.
   - **Delete**: 상세 모달 및 수정 폼에서 `🗑️ 삭제` 버튼 클릭 시 `ConfirmModal`로 확인 후 안전하게 삭제.

3. **백업 및 복원 (Backup & Restore)**:
   - `exportBackupJson`: 모든 레시피, 즐겨찾기, 메모, 장보기 목록을 포함한 `my-recipes-YYYY-MM-DD.json` 파일 생성 및 다운로드.
   - `restoreBackupData`: JSON 파일 업로드 시 유효성 검사 후, `기존 데이터와 병합(Merge)` 또는 `전체 교체(Replace)` 모드를 선택하여 복원.

4. **주방 요리 편의성 (Kitchen Usability)**:
   - **Screen Wake Lock API**: 집중 조리 모드 진입 시 화면 꺼짐 방지 자동 활성화, 모달 종료 시 해제.
   - **재료 & 조리 단계 체크**: 모달 내에서 조리 진행 상태를 클릭하여 체크 및 관리.
   - **인분 스케일링**: 0.5배 ~ 4배까지 수치 및 분수(1/2, 2/3 등) 자동 비례 계산.

---

## 4. UI/UX 디자인 원칙
- **Color Palette**: 따뜻하고 편안한 웜 크림(`#fffaf3`), 주황색(`orange-500`), 호박색(`amber-500`), 스톤 뉴트럴 계열 유지.
- **모바일 반응형 & 터치 타겟**: 최소 44px 터치 영역 확보, 360px 모바일 화면에서도 가로 스크롤 없이 유려한 레이아웃 제공.
- **모달 스크롤 락**: 모달 활성화 시 `document.body.style.overflow = 'hidden'`을 적용하여 배경 스크롤 방지.
- **안정적인 상태 피드백**: 모든 CRUD, 북마크, 복원, 장보기 액션마다 글로벌 토스트 알림 제공.
