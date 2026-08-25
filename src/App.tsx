/**
 * @file src/App.tsx
 * @description 내 입맛 레시피 메인 애플리케이션 컴포넌트.
 * 기존 핵심 기능(레시피 CRUD, 검색, 필터링, 정렬, 즐겨찾기, 장보기 목록, AI 요리사, 백업/복원, PWA/오프라인)과 함께
 * 신규 6대 기능(오늘 뭐 먹지?, 주간 식단표, 조리단계 타이머+음성 요리모드, 인분 자동 변환, 사진으로 레시피 가져오기, 가족 공유 공간)을 완벽히 조율합니다.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Database, Sparkles, Calendar, Dice5, Users } from 'lucide-react';
import {
  FilterCategory,
  Recipe,
  ShoppingItem,
  SortOption,
  ToastMessage,
  FamilySpace,
  FamilyUserProfile,
  WeeklyMealPlan,
  MealPlanEntry,
} from './types/recipe';
import { CATEGORY_LIST } from './config/appConfig';
import {
  loadAllRecipes,
  saveAllRecipes,
  getSavedBookmarks,
  saveBookmarks,
  getSavedShoppingList,
  saveShoppingList,
  getSavedRecipeNotes,
  saveRecipeNote,
  getRecentRecipeIds,
  addRecentRecipeId,
  loadFamilyProfile,
  saveFamilyProfile,
  loadFamilySpaces,
  saveFamilySpaces,
  loadWeeklyMealPlan,
  saveWeeklyMealPlan,
} from './utils/storage';
import { logger } from './utils/logger';
import { useFirebaseAuth } from './hooks/useFirebaseAuth';
import { isUserAdmin } from './utils/admin';
import {
  subscribeToPublicRecipes,
  fetchPublicRecipeCount,
  savePublicRecipe,
  deletePublicRecipe,
  publishAllRecipesToPublic,
  subscribeToUserSettings,
  subscribeToUserShopping,
  saveBookmarksToCloud,
  saveRecipeNoteToCloud,
  saveShoppingItemToCloud,
  deleteShoppingItemFromCloud,
  syncAllShoppingItemsToCloud,
  fetchCloudSummary,
  migrateLocalDataToCloud,
  mergeRecipeLists,
} from './services/firestoreSync';
import { MigrationModalState } from './types/firebase';

// Sub Components
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { RecentRecipes } from './components/RecentRecipes';
import { SearchBar } from './components/SearchBar';
import { CategoryFilter } from './components/CategoryFilter';
import { RecipeList } from './components/RecipeList';
import { RecipeDetailModal } from './components/RecipeDetailModal';
import { CookingModeModal } from './components/CookingModeModal';
import { RecipeFormModal } from './components/RecipeFormModal';
import { ShoppingListModal } from './components/ShoppingListModal';
import { BackupRestoreModal } from './components/BackupRestoreModal';
import { ImportRecipeModal } from './components/ImportRecipeModal';
import { ConfirmModal } from './components/ConfirmModal';
import { TimerWidget } from './components/TimerWidget';
import { AboutSection } from './components/AboutSection';
import { Footer } from './components/Footer';
import { Toast } from './components/Toast';
import { AiChefView } from './components/AiChefView';
import { TodayMenuModal } from './components/TodayMenuModal';
import { WeeklyMealPlanView } from './components/WeeklyMealPlanView';
import { FamilyShareModal } from './components/FamilyShareModal';
import { CloudMigrationModal } from './components/CloudMigrationModal';
import { ErrorBoundary } from './components/ErrorBoundary';

type AppViewMode = 'home' | 'ai-chef' | 'meal-plan';

/**
 * 최상위 App 컴포넌트
 */
export default function App(): React.JSX.Element {
  // 0. Firebase Authentication & Cloud Sync
  const {
    user,
    isLoading: isAuthLoading,
    isLoggingIn,
    syncStatus,
    setSyncStatus,
    loginWithGoogle,
    logout,
    isOnline,
  } = useFirebaseAuth();

  // 관리자 여부 판별 (VITE_ADMIN_UID와 현재 로그인 UID 비교)
  const isAdmin = useMemo(() => isUserAdmin(user?.uid), [user?.uid]);

  // 1. Core Data State
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<number[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [userNotes, setUserNotes] = useState<Record<number, string>>({});
  const [recentRecipeIds, setRecentRecipeIds] = useState<number[]>([]);
  const [weeklyMealPlan, setWeeklyMealPlan] = useState<WeeklyMealPlan>(() => loadWeeklyMealPlan());

  // Cloud Data Migration Modal State
  const [migrationModal, setMigrationModal] = useState<MigrationModalState>({
    isOpen: false,
    mode: 'initial',
    localRecipeCount: 0,
    cloudRecipeCount: 0,
    isMigrating: false,
  });

  // 2. Family Sharing State
  const [userProfile, setUserProfile] = useState<FamilyUserProfile>(loadFamilyProfile());
  const [allFamilySpacesList, setAllFamilySpacesList] = useState<FamilySpace[]>(loadFamilySpaces());

  const activeFamilySpace = useMemo(() => {
    if (!userProfile.currentFamilyId) return null;
    return allFamilySpacesList.find((s) => s.familyId === userProfile.currentFamilyId) || null;
  }, [userProfile.currentFamilyId, allFamilySpacesList]);

  // 3. View & Routing State
  const [currentView, setCurrentView] = useState<AppViewMode>('home');
  const [aiChefRecipe, setAiChefRecipe] = useState<Recipe | null>(null);

  // 4. Filtering, Searching & Sorting State
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('전체');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOption, setSortOption] = useState<SortOption>('default');

  // 5. Modals & Widgets State
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [cookingModeRecipe, setCookingModeRecipe] = useState<Recipe | null>(null);
  const [cookingMultiplier, setCookingMultiplier] = useState<number>(1);
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [recipeToEdit, setRecipeToEdit] = useState<Recipe | null>(null);
  const [isShoppingModalOpen, setIsShoppingModalOpen] = useState<boolean>(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isTimerOpen, setIsTimerOpen] = useState<boolean>(false);
  const [isTodayMenuModalOpen, setIsTodayMenuModalOpen] = useState<boolean>(false);
  const [isFamilyShareModalOpen, setIsFamilyShareModalOpen] = useState<boolean>(false);

  // 6. PWA & Offline State
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // 7. Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '확인',
    isDestructive: false,
    onConfirm: () => {},
  });

  // 8. Toast System State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  /**
   * 전역 토스트 알림 메시지를 표시합니다.
   */
  const showToast = useCallback((message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info'): void => {
    logger.info('App.showToast', `토스트 생성: "${message}" (${type})`);
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  /**
   * 토스트 수동 닫기
   */
  const handleDismissToast = useCallback((id: string): void => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // URL Hash 기반 라우팅 동기화 (/ai-chef, /meal-plan)
  useEffect(() => {
    const handleHashChange = (): void => {
      const hash = window.location.hash;
      logger.info('App.handleHashChange', `해시 변경 감지: ${hash}`);
      if (hash.includes('ai-chef')) {
        setCurrentView('ai-chef');
      } else if (hash.includes('meal-plan')) {
        setCurrentView('meal-plan');
      } else {
        setCurrentView('home');
      }
    };

    if (window.location.hash.includes('ai-chef')) {
      setCurrentView('ai-chef');
    } else if (window.location.hash.includes('meal-plan')) {
      setCurrentView('meal-plan');
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  /**
   * 뷰 전환 핸들러
   */
  const handleNavigateView = useCallback((view: AppViewMode): void => {
    logger.info('App.handleNavigateView', `뷰 전환: ${view}`);
    setCurrentView(view);
    if (view === 'ai-chef') {
      window.location.hash = '#/ai-chef';
    } else if (view === 'meal-plan') {
      window.location.hash = '#/meal-plan';
    } else {
      window.location.hash = '';
    }
  }, []);

  // PWA 설치 프롬프트 및 온/오프라인 이벤트 리스너 등록
  useEffect(() => {
    const handleOnline = (): void => {
      logger.info('App.network', '온라인 상태 복구');
      setIsOffline(false);
      showToast('🟢 네트워크가 연결되었습니다.', 'success');
    };
    const handleOffline = (): void => {
      logger.warn('App.network', '오프라인 상태 감지');
      setIsOffline(true);
      showToast('⚠️ 오프라인 상태입니다. 저장된 레시피를 계속 이용할 수 있습니다.', 'info');
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleBeforeInstall = (e: any): void => {
      e.preventDefault();
      logger.info('App.pwa', 'PWA 설치 프롬프트 수신');
      setDeferredPrompt(e);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, [showToast]);

  /**
   * PWA 설치 핸들러
   */
  const handleInstallPwa = useCallback(async (): Promise<void> => {
    if (!deferredPrompt) {
      showToast('💡 이미 설치되었거나 브라우저 메뉴의 "홈 화면에 추가"를 이용해주세요.', 'info');
      return;
    }
    logger.info('App.handleInstallPwa', 'PWA 설치 프롬프트 표시');
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    logger.info('App.handleInstallPwa', `PWA 설치 결과: ${outcome}`);
    if (outcome === 'accepted') {
      showToast('🎉 앱이 성공적으로 설치되었습니다!', 'success');
    }
    setDeferredPrompt(null);
  }, [deferredPrompt, showToast]);

  // 로컬스토리지 데이터 초기 로드
  useEffect(() => {
    logger.info('App.useEffect', '앱 데이터 초기 로드 시작');
    const loadedRecipes = loadAllRecipes();
    const loadedBookmarks = getSavedBookmarks();
    const loadedShopping = getSavedShoppingList();
    const loadedNotes = getSavedRecipeNotes();
    const loadedRecent = getRecentRecipeIds();

    setRecipes(loadedRecipes);
    setBookmarkedIds(loadedBookmarks);
    setShoppingList(loadedShopping);
    setUserNotes(loadedNotes);
    setRecentRecipeIds(loadedRecent);
  }, []);

  // 1. 공개 레시피 컬렉션 실시간 구독 (/recipes) - 모든 방문자(비로그인/로그인)에게 실시간 반영
  useEffect(() => {
    logger.info('App.publicSync', '공개 레시피(/recipes) 실시간 리스너 등록');
    const unsub = subscribeToPublicRecipes(
      (publicRecipes) => {
        logger.info('App.publicSync', `공개 레시피 수신: ${publicRecipes.length}개`);
        if (publicRecipes.length > 0) {
          setRecipes(publicRecipes);
          saveAllRecipes(publicRecipes);
        }
      },
      (err) => {
        logger.warn('App.publicSync', '공개 레시피 구독 에러 (로컬 캐시 레시피 유지)', err);
      }
    );
    return () => {
      unsub();
    };
  }, []);

  // 2. 로그인 사용자 개인 데이터(북마크, 메모, 장보기) 및 관리자 배포 검사
  useEffect(() => {
    if (!user) {
      logger.info('App.authSync', '게스트/로그아웃 상태: 로컬 데이터 모드 유지');
      return;
    }

    logger.info('App.authSync', `로그인 사용자 동기화 연결: ${user.email} (UID: ${user.uid}, 관리자: ${isAdmin})`);
    setSyncStatus('syncing');

    // 관리자 로그인 시 클라우드 공개 레시피가 0개이면 로컬 레시피 최초 게시 제안
    if (isAdmin) {
      const migrationStorageKey = `my_recipe_admin_migrated_${user.uid}`;
      const isAlreadyMigrated = localStorage.getItem(migrationStorageKey) === 'true';

      fetchPublicRecipeCount()
        .then((pubCount) => {
          logger.info('App.authSync', `공개 레시피 통계: ${pubCount}개`);
          const currentLocal = loadAllRecipes();
          if (!isAlreadyMigrated && pubCount === 0 && currentLocal.length > 0) {
            setMigrationModal({
              isOpen: true,
              mode: 'initial',
              localRecipeCount: currentLocal.length,
              cloudRecipeCount: 0,
              isMigrating: false,
            });
          }
        })
        .catch((err) => {
          logger.error('App.authSync', '공개 레시피 개수 조회 실패', err);
        });
    }

    // 사용자 개인 설정(즐겨찾기, 메모) 리스너
    const unsubSettings = subscribeToUserSettings(
      user.uid,
      ({ bookmarks, notes }) => {
        logger.info('App.authSync', `실시간 개인 설정 수신: 북마크 ${bookmarks.length}개, 메모 ${Object.keys(notes).length}개`);
        setBookmarkedIds(bookmarks);
        saveBookmarks(bookmarks);
        setUserNotes(notes);
      },
      (err) => {
        logger.error('App.authSync', '설정 구독 에러', err);
      }
    );

    // 사용자 개인 장보기 목록 리스너
    const unsubShopping = subscribeToUserShopping(
      user.uid,
      (cloudShopping) => {
        logger.info('App.authSync', `실시간 장보기 수신: ${cloudShopping.length}개`);
        setShoppingList(cloudShopping);
        saveShoppingList(cloudShopping);
        setSyncStatus('synced');
      },
      (err) => {
        logger.error('App.authSync', '장보기 구독 에러', err);
        setSyncStatus('error');
      }
    );

    return () => {
      logger.info('App.authSync', '사용자 개인 데이터 리스너 해제');
      unsubSettings();
      unsubShopping();
    };
  }, [user, isAdmin, setSyncStatus]);

  // 카테고리별 개수 맵 계산
  const categoryCounts = useMemo((): Record<string, number> => {
    const counts: Record<string, number> = {};
    CATEGORY_LIST.forEach((cat) => {
      counts[cat] = recipes.filter((r) => r.category === cat).length;
    });
    return counts;
  }, [recipes]);

  // 검색 및 필터링, 정렬 적용된 레시피 목록 계산
  const filteredAndSortedRecipes = useMemo((): Recipe[] => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = recipes.filter((r) => {
      // 1. 카테고리 필터
      if (activeCategory === '즐겨찾기') {
        if (!bookmarkedIds.includes(r.id)) return false;
      } else if (activeCategory !== '전체') {
        if (r.category !== activeCategory) return false;
      }

      // 2. 검색어 필터
      if (q) {
        const note = userNotes[r.id] || '';
        const fullText = `${r.name} ${r.ingredients} ${r.method || ''} ${note}`.toLowerCase();
        if (!fullText.includes(q)) return false;
      }

      return true;
    });

    // 3. 정렬 적용
    return [...filtered].sort((a, b) => {
      if (sortOption === 'nameAsc') return a.name.localeCompare(b.name, 'ko');
      if (sortOption === 'nameDesc') return b.name.localeCompare(a.name, 'ko');
      if (sortOption === 'latest') return (b.createdAt || 0) - (a.createdAt || 0);
      if (sortOption === 'updated') {
        const timeA = typeof a.updatedAt === 'number' ? a.updatedAt : new Date(a.updatedAt || 0).getTime();
        const timeB = typeof b.updatedAt === 'number' ? b.updatedAt : new Date(b.updatedAt || 0).getTime();
        return timeB - timeA;
      }
      if (sortOption === 'favorite') {
        const aFav = bookmarkedIds.includes(a.id) ? 1 : 0;
        const bFav = bookmarkedIds.includes(b.id) ? 1 : 0;
        return bFav - aFav;
      }
      if (sortOption === 'ingredientsAsc') return a.ingredientCount - b.ingredientCount;
      if (sortOption === 'ingredientsDesc') return b.ingredientCount - a.ingredientCount;
      return 0;
    });
  }, [recipes, activeCategory, searchQuery, bookmarkedIds, sortOption, userNotes]);

  /**
   * 북마크 토글 이벤트 핸들러
   */
  const handleToggleBookmark = useCallback((recipeId: number): void => {
    logger.info('App.handleToggleBookmark', `즐겨찾기 토글: ID ${recipeId}`);
    setBookmarkedIds((prev) => {
      const isExisting = prev.includes(recipeId);
      const next = isExisting ? prev.filter((id) => id !== recipeId) : [...prev, recipeId];
      saveBookmarks(next);
      if (user) {
        saveBookmarksToCloud(user.uid, next).catch((err) => {
          logger.error('App.handleToggleBookmark', '클라우드 즐겨찾기 동기화 실패', err);
        });
      }
      showToast(isExisting ? '🤍 즐겨찾기에서 제거되었습니다.' : '⭐ 즐겨찾기에 추가되었습니다!', 'success');
      return next;
    });
  }, [user, showToast]);

  /**
   * 레시피 상세 모달 열기 핸들러
   */
  const handleOpenDetail = useCallback((recipe: Recipe): void => {
    logger.info('App.handleOpenDetail', `상세 모달 열기: ${recipe.name} (ID: ${recipe.id})`);
    setSelectedRecipe(recipe);
    const nextRecent = addRecentRecipeId(recipe.id);
    setRecentRecipeIds(nextRecent);
  }, []);

  /**
   * 레시피 등록 또는 수정 저장 핸들러 (관리자 전용)
   */
  const handleSaveRecipe = useCallback(
    (recipeData: Recipe, isBookmarked: boolean, userNote: string): void => {
      logger.info('App.handleSaveRecipe', `레시피 저장: ${recipeData.name} (ID: ${recipeData.id}, 관리자: ${isAdmin})`);

      if (!isAdmin) {
        showToast('🔒 레시피 추가 및 수정은 관리자만 가능합니다.', 'warning');
        return;
      }

      setRecipes((prev) => {
        const existingIdx = prev.findIndex((r) => r.id === recipeData.id);
        let next: Recipe[];
        if (existingIdx >= 0) {
          next = [...prev];
          next[existingIdx] = recipeData;
        } else {
          next = [recipeData, ...prev];
        }
        saveAllRecipes(next);
        return next;
      });

      // 북마크 상태 반영
      let nextBookmarks: number[] = bookmarkedIds;
      setBookmarkedIds((prev) => {
        const has = prev.includes(recipeData.id);
        let next = prev;
        if (isBookmarked && !has) {
          next = [...prev, recipeData.id];
        } else if (!isBookmarked && has) {
          next = prev.filter((id) => id !== recipeData.id);
        }
        saveBookmarks(next);
        nextBookmarks = next;
        return next;
      });

      // 사용자 메모 저장
      let nextNotes: Record<number, string> = userNotes;
      if (userNote !== undefined) {
        setUserNotes((prev) => {
          const next = { ...prev, [recipeData.id]: userNote };
          saveRecipeNote(recipeData.id, userNote);
          nextNotes = next;
          return next;
        });
      }

      // 관리자: 공개 컬렉션 (/recipes) 실시간 동기화
      savePublicRecipe(recipeData).catch((err) => {
        logger.error('App.handleSaveRecipe', '공개 레시피 클라우드 저장 실패', err);
        showToast('클라우드 동기화 중 일시적 오류가 발생했습니다. 로컬 저장은 완료되었습니다.', 'warning');
      });

      if (user) {
        saveBookmarksToCloud(user.uid, nextBookmarks).catch((err) => {
          logger.error('App.handleSaveRecipe', '클라우드 북마크 동기화 실패', err);
        });

        if (userNote !== undefined) {
          saveRecipeNoteToCloud(user.uid, recipeData.id, userNote, nextNotes).catch((err) => {
            logger.error('App.handleSaveRecipe', '클라우드 메모 동기화 실패', err);
          });
        }
      }

      showToast(`'${recipeData.name}' 레시피가 성공적으로 저장되었습니다!`, 'success');
    },
    [isAdmin, user, bookmarkedIds, userNotes, showToast]
  );

  /**
   * 레시피 가족 공유 상태 개별 토글
   */
  const handleToggleFamilyShareRecipe = useCallback((recipe: Recipe): void => {
    const nextShared = !recipe.sharedWithFamily;
    logger.info('App.handleToggleFamilyShareRecipe', `가족 공유 상태 변경: ${recipe.name} -> ${nextShared}`);

    setRecipes((prev) => {
      const next = prev.map((r) => (r.id === recipe.id ? { ...r, sharedWithFamily: nextShared } : r));
      saveAllRecipes(next);
      return next;
    });

    if (selectedRecipe && selectedRecipe.id === recipe.id) {
      setSelectedRecipe((prev) => (prev ? { ...prev, sharedWithFamily: nextShared } : null));
    }

    if (isAdmin) {
      savePublicRecipe({ ...recipe, sharedWithFamily: nextShared }).catch((err) => {
        logger.error('App.handleToggleFamilyShareRecipe', '클라우드 공유 상태 동기화 실패', err);
      });
    }

    showToast(
      nextShared
        ? `👨‍👩‍👧 '${recipe.name}'이(가) 가족 공간에 공유되었습니다.`
        : `🔒 '${recipe.name}'이(가) 나만 보기로 전환되었습니다.`,
      'success'
    );
  }, [isAdmin, selectedRecipe, showToast]);

  /**
   * 내 레시피 전체 일괄 가족 공유
   */
  const handleShareAllMyRecipes = useCallback((): void => {
    logger.info('App.handleShareAllMyRecipes', '내 모든 레시피 일괄 가족 공유');
    setRecipes((prev) => {
      const next = prev.map((r) => ({ ...r, sharedWithFamily: true }));
      saveAllRecipes(next);
      if (isAdmin) {
        publishAllRecipesToPublic(next).catch((err) => {
          logger.error('App.handleShareAllMyRecipes', '클라우드 일괄 공유 저장 실패', err);
        });
      }
      return next;
    });
    showToast('👨‍👩‍👧 모든 레시피가 가족 공간에 공유되었습니다!', 'success');
  }, [isAdmin, showToast]);

  /**
   * 주간 식단표 저장 핸들러
   */
  const handleSaveWeeklyMealPlan = useCallback((plan: WeeklyMealPlan): void => {
    logger.info('App.handleSaveWeeklyMealPlan', `주간 식단표 저장: ${Object.keys(plan).length}일 등록`);
    setWeeklyMealPlan(plan);
    saveWeeklyMealPlan(plan);
  }, []);

  /**
   * 오늘 뭐 먹지 -> 주간 식단에 메뉴 추가 핸들러
   */
  const handleAddRecipeToMealPlan = useCallback(
    (recipe: Recipe, targetDate?: string): void => {
      const date = targetDate || new Date().toISOString().split('T')[0];
      logger.info('App.handleAddRecipeToMealPlan', `식단 추가: ${recipe.name} (${date})`);
      const existingEntries = weeklyMealPlan[date] || [];
      const now = Date.now();
      const newEntry: MealPlanEntry = {
        id: `meal_${now}_${Math.random().toString(36).substring(2, 6)}`,
        date,
        slot: 'single',
        recipeId: recipe.id,
        servings: recipe.baseServings || 2,
        createdAt: now,
        updatedAt: now,
      };

      const withoutExistingSingle = existingEntries.filter((entry) => entry.slot !== 'single');
      const nextPlan: WeeklyMealPlan = {
        ...weeklyMealPlan,
        [date]: [...withoutExistingSingle, newEntry],
      };

      handleSaveWeeklyMealPlan(nextPlan);
      showToast(`'${recipe.name}' 요리가 ${date} 식단에 추가되었습니다!`, 'success');
    },
    [weeklyMealPlan, handleSaveWeeklyMealPlan, showToast]
  );

  /**
   * 레시피 삭제 요청 (관리자 전용)
   */
  const handleDeleteRecipeRequest = useCallback(
    (recipeId: number): void => {
      const target = recipes.find((r) => r.id === recipeId);
      if (!target) return;

      if (!isAdmin) {
        showToast('🔒 레시피 삭제는 관리자만 가능합니다.', 'warning');
        return;
      }

      setConfirmDialog({
        isOpen: true,
        title: '레시피 삭제',
        message: `'${target.name}' 레시피를 정말 삭제하시겠습니까? 삭제된 레시피는 공개 목록에서 영구히 제거됩니다.`,
        confirmText: '삭제',
        isDestructive: true,
        onConfirm: () => {
          logger.info('App.handleDeleteRecipe', `관리자 레시피 삭제 확정: ID ${recipeId}`);
          setRecipes((prev) => {
            const next = prev.filter((r) => r.id !== recipeId);
            saveAllRecipes(next);
            return next;
          });
          setBookmarkedIds((prev) => {
            const next = prev.filter((id) => id !== recipeId);
            saveBookmarks(next);
            if (user) {
              saveBookmarksToCloud(user.uid, next).catch(() => {});
            }
            return next;
          });

          deletePublicRecipe(recipeId).catch((err) => {
            logger.error('App.handleDeleteRecipe', '공개 레시피 삭제 실패', err);
          });

          setSelectedRecipe(null);
          setRecipeToEdit(null);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          showToast(`'${target.name}' 레시피가 삭제되었습니다.`, 'info');
        },
      });
    },
    [isAdmin, user, recipes, showToast]
  );

  /**
   * 장보기 단일 아이템 추가
   */
  const handleAddShoppingItem = useCallback(
    (text: string, sourceName?: string): void => {
      if (!text.trim()) return;
      logger.info('App.handleAddShoppingItem', `장보기 추가: ${text}`);
      const newItem: ShoppingItem = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        text: text.trim(),
        completed: false,
        sourceRecipeName: sourceName,
        createdAt: Date.now(),
      };
      setShoppingList((prev) => {
        const next = [newItem, ...prev];
        saveShoppingList(next);
        return next;
      });

      if (user) {
        saveShoppingItemToCloud(user.uid, newItem).catch((err) => {
          logger.error('App.handleAddShoppingItem', '클라우드 장보기 저장 에러', err);
        });
      }
    },
    [user]
  );

  /**
   * 장보기 여러 아이템 일괄 추가
   */
  const handleAddAllShoppingItems = useCallback(
    (items: string[], sourceName?: string): void => {
      if (!items || items.length === 0) return;
      logger.info('App.handleAddAllShoppingItems', `장보기 일괄 추가: ${items.length}개`);
      const newItems: ShoppingItem[] = items
        .map((text) => text.trim())
        .filter(Boolean)
        .map((text, idx) => ({
          id: `${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
          text: text,
          completed: false,
          sourceRecipeName: sourceName,
          createdAt: Date.now() + idx,
        }));

      setShoppingList((prev) => {
        const next = [...newItems, ...prev];
        saveShoppingList(next);
        return next;
      });

      if (user) {
        Promise.all(newItems.map((item) => saveShoppingItemToCloud(user.uid, item))).catch((err) => {
          logger.error('App.handleAddAllShoppingItems', '클라우드 일괄 장보기 저장 에러', err);
        });
      }
    },
    [user]
  );

  /**
   * 장보기 완료 토글
   */
  const handleToggleShoppingComplete = useCallback(
    (id: string): void => {
      setShoppingList((prev) => {
        const target = prev.find((item) => item.id === id);
        const next = prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item));
        saveShoppingList(next);
        if (user && target) {
          saveShoppingItemToCloud(user.uid, { ...target, completed: !target.completed }).catch((err) => {
            logger.error('App.handleToggleShoppingComplete', '클라우드 장보기 수정 에러', err);
          });
        }
        return next;
      });
    },
    [user]
  );

  /**
   * 장보기 단일 삭제
   */
  const handleDeleteShoppingItem = useCallback(
    (id: string): void => {
      setShoppingList((prev) => {
        const next = prev.filter((item) => item.id !== id);
        saveShoppingList(next);
        if (user) {
          deleteShoppingItemFromCloud(user.uid, id).catch((err) => {
            logger.error('App.handleDeleteShoppingItem', '클라우드 장보기 삭제 에러', err);
          });
        }
        return next;
      });
    },
    [user]
  );

  /**
   * 완료된 장보기 항목 정리
   */
  const handleClearCompletedShopping = useCallback((): void => {
    setShoppingList((prev) => {
      const next = prev.filter((item) => !item.completed);
      saveShoppingList(next);
      if (user) {
        syncAllShoppingItemsToCloud(user.uid, next).catch((err) => {
          logger.error('App.handleClearCompletedShopping', '클라우드 장보기 정리 에러', err);
        });
      }
      return next;
    });
    showToast('🧹 완료된 장보기 항목이 정리되었습니다.', 'info');
  }, [user, showToast]);

  /**
   * 장보기 목록 전체 비우기
   */
  const handleClearAllShopping = useCallback((): void => {
    setShoppingList([]);
    saveShoppingList([]);
    if (user) {
      syncAllShoppingItemsToCloud(user.uid, []).catch((err) => {
        logger.error('App.handleClearAllShopping', '클라우드 장보기 전체 비우기 에러', err);
      });
    }
    showToast('🗑️ 장보기 목록이 비워졌습니다.', 'info');
  }, [user, showToast]);

  /**
   * 레시피 사용자 메모 저장
   */
  const handleSaveRecipeNote = useCallback(
    (recipeId: number, note: string): void => {
      setUserNotes((prev) => {
        const next = { ...prev, [recipeId]: note };
        saveRecipeNote(recipeId, note);
        if (user) {
          saveRecipeNoteToCloud(user.uid, recipeId, note, next).catch((err) => {
            logger.error('App.handleSaveRecipeNote', '클라우드 메모 동기화 실패', err);
          });
        }
        return next;
      });
    },
    [user]
  );

  /**
   * 클라우드 마이그레이션: 로컬 데이터 업로드
   */
  const handleUploadLocalToCloud = useCallback(async () => {
    if (!user) return;
    setMigrationModal((prev) => ({ ...prev, isMigrating: true }));
    try {
      const currentLocal = loadAllRecipes();
      const currentBookmarks = getSavedBookmarks();
      const currentNotes = getSavedRecipeNotes();
      const currentShopping = getSavedShoppingList();

      await migrateLocalDataToCloud(
        user.uid,
        currentLocal,
        currentBookmarks,
        currentNotes,
        currentShopping
      );

      if (isAdmin) {
        await publishAllRecipesToPublic(currentLocal);
      }

      localStorage.setItem(`my_recipe_migrated_${user.uid}`, 'true');
      localStorage.setItem(`my_recipe_admin_migrated_${user.uid}`, 'true');
      setMigrationModal((prev) => ({ ...prev, isOpen: false, isMigrating: false }));
      showToast(`🎉 ${currentLocal.length}개 레시피가 클라우드로 안전하게 업로드되었습니다!`, 'success');
      setSyncStatus('synced');
    } catch (err) {
      logger.error('App.handleUploadLocalToCloud', '클라우드 업로드 실패', err);
      showToast('클라우드 업로드 중 오류가 발생했습니다. 다시 시도해 주세요.', 'error');
      setMigrationModal((prev) => ({ ...prev, isMigrating: false }));
    }
  }, [user, isAdmin, showToast, setSyncStatus]);

  /**
   * 클라우드 마이그레이션: 로컬과 클라우드 병합
   */
  const handleMergeLocalAndCloud = useCallback(async () => {
    if (!user) return;
    setMigrationModal((prev) => ({ ...prev, isMigrating: true }));
    try {
      const currentLocal = loadAllRecipes();
      const currentBookmarks = getSavedBookmarks();
      const currentNotes = getSavedRecipeNotes();
      const currentShopping = getSavedShoppingList();

      const merged = mergeRecipeLists(currentLocal, recipes);
      await migrateLocalDataToCloud(
        user.uid,
        merged,
        currentBookmarks,
        currentNotes,
        currentShopping
      );

      if (isAdmin) {
        await publishAllRecipesToPublic(merged);
      }

      setRecipes(merged);
      saveAllRecipes(merged);
      localStorage.setItem(`my_recipe_migrated_${user.uid}`, 'true');
      localStorage.setItem(`my_recipe_admin_migrated_${user.uid}`, 'true');
      setMigrationModal((prev) => ({ ...prev, isOpen: false, isMigrating: false }));
      showToast(`🎉 기기간 ${merged.length}개의 레시피가 성공적으로 병합되었습니다!`, 'success');
      setSyncStatus('synced');
    } catch (err) {
      logger.error('App.handleMergeLocalAndCloud', '병합 실패', err);
      showToast('레시피 병합 중 오류가 발생했습니다.', 'error');
      setMigrationModal((prev) => ({ ...prev, isMigrating: false }));
    }
  }, [user, isAdmin, recipes, showToast, setSyncStatus]);

  /**
   * 클라우드 마이그레이션: 클라우드 데이터 우선 사용
   */
  const handleUseCloudOnly = useCallback(() => {
    if (!user) return;
    localStorage.setItem(`my_recipe_migrated_${user.uid}`, 'true');
    setMigrationModal((prev) => ({ ...prev, isOpen: false, isMigrating: false }));
    showToast('☁️ 클라우드에 저장된 레시피를 사용합니다.', 'info');
  }, [user, showToast]);

  /**
   * Google 로그인 시작 핸들러
   */
  const handleGoogleLogin = useCallback(async () => {
    logger.info('App.handleGoogleLogin', '사용자 Google 로그인 버튼 클릭');
    const result = await loginWithGoogle((errorMessage: string) => {
      showToast(errorMessage, 'warning');
    });
    if (result) {
      showToast(`👋 ${result.displayName || result.email}님, 환영합니다!`, 'success');
    }
  }, [loginWithGoogle, showToast]);

  /**
   * 클라우드 동기화 수동 관리 모달 열기
   */
  const handleManualOpenCloudSyncModal = useCallback(async () => {
    if (!user) {
      handleGoogleLogin();
      return;
    }
    const currentLocal = loadAllRecipes();
    try {
      const summary = await fetchCloudSummary(user.uid);
      setMigrationModal({
        isOpen: true,
        mode: summary.recipeCount > 0 ? 'conflict' : 'initial',
        localRecipeCount: currentLocal.length,
        cloudRecipeCount: summary.recipeCount,
        isMigrating: false,
      });
    } catch {
      setMigrationModal({
        isOpen: true,
        mode: 'initial',
        localRecipeCount: currentLocal.length,
        cloudRecipeCount: recipes.length,
        isMigrating: false,
      });
    }
  }, [user, recipes, loginWithGoogle]);

  /**
   * 조리 모드(Focus Mode) 시작
   */
  const handleStartCookingMode = useCallback((recipe: Recipe, multiplier: number): void => {
    logger.info('App.handleStartCookingMode', `조리 모드 전환: ${recipe.name} (x${multiplier})`);
    setSelectedRecipe(null);
    setCookingModeRecipe(recipe);
    setCookingMultiplier(multiplier);
  }, []);

  /**
   * 새 가족 공간 생성
   */
  const handleCreateFamilySpace = useCallback(
    (name: string, shareExisting: boolean): void => {
      const code = `FAM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const familyId = `fam_${Date.now()}`;
      const newSpace: FamilySpace = {
        familyId,
        name,
        inviteCode: code,
        ownerId: userProfile.id,
        members: [
          {
            id: userProfile.id,
            name: userProfile.name,
            role: 'owner',
            avatar: userProfile.avatar,
            joinedAt: Date.now(),
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const allSpaces = [...allFamilySpacesList, newSpace];
      setAllFamilySpacesList(allSpaces);
      saveFamilySpaces(allSpaces);

      const updatedProfile: FamilyUserProfile = {
        ...userProfile,
        currentFamilyId: familyId,
      };
      setUserProfile(updatedProfile);
      saveFamilyProfile(updatedProfile);

      if (shareExisting) {
        handleShareAllMyRecipes();
      }
    },
    [userProfile, allFamilySpacesList, handleShareAllMyRecipes]
  );

  /**
   * 초대 코드로 가족 공간 참여
   */
  const handleJoinFamilySpace = useCallback(
    (inviteCode: string, shareExisting: boolean): void => {
      const matched = allFamilySpacesList.find((s) => s.inviteCode === inviteCode);
      const targetSpace: FamilySpace = matched || {
        familyId: `fam_${inviteCode}`,
        name: '우리 가족의 식탁',
        inviteCode,
        ownerId: 'owner_user',
        members: [
          { id: 'owner_user', name: '가족 대표', role: 'owner', avatar: '👩‍🍳', joinedAt: Date.now() - 86400000 },
          { id: userProfile.id, name: userProfile.name, role: 'member', avatar: userProfile.avatar, joinedAt: Date.now() },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      if (!targetSpace.members.some((m) => m.id === userProfile.id)) {
        targetSpace.members.push({
          id: userProfile.id,
          name: userProfile.name,
          role: 'member',
          avatar: userProfile.avatar,
          joinedAt: Date.now(),
        });
      }

      const updatedSpaces = allFamilySpacesList.some((s) => s.familyId === targetSpace.familyId)
        ? allFamilySpacesList.map((s) => (s.familyId === targetSpace.familyId ? targetSpace : s))
        : [...allFamilySpacesList, targetSpace];

      setAllFamilySpacesList(updatedSpaces);
      saveFamilySpaces(updatedSpaces);

      const updatedProfile: FamilyUserProfile = {
        ...userProfile,
        currentFamilyId: targetSpace.familyId,
      };
      setUserProfile(updatedProfile);
      saveFamilyProfile(updatedProfile);

      if (shareExisting) {
        handleShareAllMyRecipes();
      }

      showToast(`'${targetSpace.name}' 가족 공간에 참여했습니다!`, 'success');
    },
    [allFamilySpacesList, userProfile, handleShareAllMyRecipes, showToast]
  );

  /**
   * 가족 공간 나가기
   */
  const handleLeaveFamilySpace = useCallback(
    (familyId: string): void => {
      const updatedProfile: FamilyUserProfile = {
        ...userProfile,
        currentFamilyId: null,
      };
      setUserProfile(updatedProfile);
      saveFamilyProfile(updatedProfile);

      const nextSpaces = allFamilySpacesList.filter((s) => s.familyId !== familyId);
      setAllFamilySpacesList(nextSpaces);
      saveFamilySpaces(nextSpaces);
      showToast('가족 공간에서 나왔습니다.', 'info');
    },
    [userProfile, allFamilySpacesList, showToast]
  );

  /**
   * 프로필 닉네임 변경
   */
  const handleUpdateUserProfileName = useCallback((newName: string): void => {
    setUserProfile((prev) => {
      const next = { ...prev, name: newName };
      saveFamilyProfile(next);
      return next;
    });
  }, []);

  /**
   * 백업 복원 완료 핸들러
   */
  const handleRestoreComplete = useCallback(
    (restored: {
      recipes: Recipe[];
      bookmarks: number[];
      userNotes: Record<number, string>;
      shoppingList: ShoppingItem[];
      recentIds: number[];
    }) => {
      logger.info('App.handleRestoreComplete', '백업 복원 상태 적용');
      setRecipes(restored.recipes);
      saveAllRecipes(restored.recipes);
      setBookmarkedIds(restored.bookmarks);
      saveBookmarks(restored.bookmarks);
      setUserNotes(restored.userNotes);
      setShoppingList(restored.shoppingList);
      saveShoppingList(restored.shoppingList);
      setRecentRecipeIds(restored.recentIds);

      if (isAdmin) {
        publishAllRecipesToPublic(restored.recipes).catch((err) => {
          logger.error('App.handleRestoreComplete', '복원된 레시피 공개 컬렉션 동기화 실패', err);
        });
      }
    },
    [isAdmin]
  );

  return (
    <div className="min-h-screen bg-[#fffaf3] text-stone-800 antialiased selection:bg-orange-500 selection:text-white flex flex-col">
      {/* Toast Notification Container */}
      <Toast toasts={toasts} onDismiss={handleDismissToast} />

      {/* Top Header */}
      <Header
        currentCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        currentView={currentView}
        onNavigateView={handleNavigateView}
        bookmarkCount={bookmarkedIds.length}
        shoppingCount={shoppingList.length}
        onOpenShoppingList={() => setIsShoppingModalOpen(true)}
        onOpenAddRecipe={() => {
          setRecipeToEdit(null);
          setIsFormModalOpen(true);
        }}
        onOpenImportRecipe={() => setIsImportModalOpen(true)}
        onOpenTodayMenu={() => setIsTodayMenuModalOpen(true)}
        onOpenFamilyShare={() => setIsFamilyShareModalOpen(true)}
        currentFamilyName={activeFamilySpace ? activeFamilySpace.name : null}
        onOpenBackupRestore={() => setIsBackupModalOpen(true)}
        onToggleTimer={() => setIsTimerOpen((prev) => !prev)}
        isTimerOpen={isTimerOpen}
        canInstallPwa={!!deferredPrompt}
        onInstallPwa={handleInstallPwa}
        isOffline={!isOnline || isOffline}
        user={user}
        isAdmin={isAdmin}
        syncStatus={syncStatus}
        isLoggingIn={isLoggingIn}
        onLogin={handleGoogleLogin}
        onLogout={() => {
          logout();
          showToast('로그아웃되었습니다. 로컬 모드로 전환됩니다.', 'info');
        }}
        onOpenCloudSyncModal={handleManualOpenCloudSyncModal}
      />

      <main className="flex-1">
        <ErrorBoundary>
          {currentView === 'ai-chef' ? (
            /* ✨ AI 요리사 Q&A 화면 */
            <AiChefView
              activeRecipe={aiChefRecipe}
              allRecipes={recipes}
              userNotes={userNotes}
              onSelectActiveRecipe={setAiChefRecipe}
              onBackToHome={() => handleNavigateView('home')}
              onSaveRecipeNote={handleSaveRecipeNote}
              showToast={showToast}
              onOpenConfirm={({ title, message, confirmText, onConfirm }) =>
                setConfirmDialog({
                  isOpen: true,
                  title,
                  message,
                  confirmText: confirmText || '확인',
                  isDestructive: false,
                  onConfirm: () => {
                    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                    onConfirm();
                  },
                })
              }
              isOffline={isOffline}
            />
          ) : currentView === 'meal-plan' ? (
            /* 📅 주간 식단표 화면 */
            <WeeklyMealPlanView
              mealPlan={weeklyMealPlan}
              allRecipes={recipes}
              onSaveMealPlan={handleSaveWeeklyMealPlan}
              onOpenRecipeDetail={handleOpenDetail}
              onOpenTodayMenuModal={() => setIsTodayMenuModalOpen(true)}
              onAddShoppingItems={handleAddAllShoppingItems}
              onBackToHome={() => handleNavigateView('home')}
              showToast={showToast}
              onOpenConfirm={({ title, message, confirmText, isDestructive, onConfirm }) => {
                setConfirmDialog({
                  isOpen: true,
                  title,
                  message,
                  confirmText: confirmText || '확인',
                  isDestructive: Boolean(isDestructive),
                  onConfirm: () => {
                    setConfirmDialog((prev) => ({
                      ...prev,
                      isOpen: false,
                    }));
                    onConfirm();
                  },
                });
              }}
            />
          ) : (
            /* 기본 홈 & 레시피 뷰 */
            <>
              {/* Hero Section */}
              <HeroSection
                totalRecipeCount={recipes.length}
                categoryCount={CATEGORY_LIST.length}
                bookmarkCount={bookmarkedIds.length}
                onSelectCategory={setActiveCategory}
                onScrollToRecipes={() => {
                  const el = document.getElementById('recipes');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
              />

              {/* Quick Action Bar for New Features */}
              <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => setIsTodayMenuModalOpen(true)}
                    className="flex items-center gap-3 rounded-2xl border border-orange-200/80 bg-gradient-to-r from-orange-50 to-amber-50/60 p-3.5 text-left shadow-xs transition hover:scale-[1.02] hover:shadow-sm"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white shadow-sm">
                      <Dice5 className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-soft text-xs font-black text-stone-900">오늘 뭐 먹지?</h4>
                      <p className="text-[10px] text-stone-500">랜덤 룰렛 & AI 추천</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNavigateView('meal-plan')}
                    className="flex items-center gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50/60 p-3.5 text-left shadow-xs transition hover:scale-[1.02] hover:shadow-sm"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-soft text-xs font-black text-stone-900">주간 식단표</h4>
                      <p className="text-[10px] text-stone-500">식단 계획 & 장보기</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(true)}
                    className="flex items-center gap-3 rounded-2xl border border-rose-200/80 bg-gradient-to-r from-rose-50 to-orange-50/60 p-3.5 text-left shadow-xs transition hover:scale-[1.02] hover:shadow-sm"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500 text-white shadow-sm">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-soft text-xs font-black text-stone-900">사진 인식 가져오기</h4>
                      <p className="text-[10px] text-stone-500">요리책·메모 사진 OCR</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsFamilyShareModalOpen(true)}
                    className="flex items-center gap-3 rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50 to-teal-50/60 p-3.5 text-left shadow-xs transition hover:scale-[1.02] hover:shadow-sm"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-soft text-xs font-black text-stone-900">
                        {activeFamilySpace ? activeFamilySpace.name : '가족 공유 공간'}
                      </h4>
                      <p className="text-[10px] text-stone-500">레시피·식단 함께 보기</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Recently Viewed Recipes Bar */}
              <RecentRecipes
                allRecipes={recipes}
                recentIds={recentRecipeIds}
                onOpenDetail={handleOpenDetail}
              />

              {/* Recipe Finder Container */}
              <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-500">
                      Recipe Finder
                    </p>
                    <h2 className="mt-1 font-soft text-2xl font-black tracking-tight text-stone-900 sm:text-3xl">
                      원하는 레시피를 바로 찾아보세요
                    </h2>
                  </div>

                  {/* Search Input */}
                  <div className="w-full lg:max-w-md">
                    <SearchBar
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                      onSelectTag={(tag) => {
                        setSearchQuery(tag);
                        const el = document.getElementById('recipes');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                    />
                  </div>
                </div>

                {/* Category Filter Tabs */}
                <CategoryFilter
                  activeCategory={activeCategory}
                  onCategoryChange={setActiveCategory}
                  categoryCounts={categoryCounts}
                  totalCount={recipes.length}
                  bookmarkCount={bookmarkedIds.length}
                />
              </div>

              {/* Recipe Grid & List */}
              <RecipeList
                recipes={filteredAndSortedRecipes}
                activeCategory={activeCategory}
                searchQuery={searchQuery}
                bookmarkedIds={bookmarkedIds}
                sortOption={sortOption}
                onSortChange={setSortOption}
                onToggleBookmark={handleToggleBookmark}
                onOpenDetail={handleOpenDetail}
                onResetFilters={() => {
                  setActiveCategory('전체');
                  setSearchQuery('');
                  setSortOption('default');
                }}
                onOpenAddRecipe={
                  isAdmin
                    ? () => {
                        setRecipeToEdit(null);
                        setIsFormModalOpen(true);
                      }
                    : undefined
                }
              />

              {/* Features & Guide Section */}
              <AboutSection
                onNavigateToAiChef={() => {
                  setAiChefRecipe(null);
                  handleNavigateView('ai-chef');
                }}
                onOpenShoppingList={() => setIsShoppingModalOpen(true)}
                onOpenImportRecipe={() => setIsImportModalOpen(true)}
                onInstallPwa={handleInstallPwa}
                canInstallPwa={!!deferredPrompt}
              />
            </>
          )}
        </ErrorBoundary>
      </main>

      {/* Floating Action Buttons (관리자 전용) */}
      {isAdmin && (
        <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-2.5">
          {/* Floating Add Recipe Button */}
          <button
            type="button"
            onClick={() => {
              logger.info('App', '플로팅 레시피 추가 버튼 클릭');
              setRecipeToEdit(null);
              setIsFormModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3.5 font-soft text-sm font-black text-white shadow-xl shadow-orange-500/30 transition-all hover:scale-105 hover:from-orange-600 hover:to-amber-600 active:scale-95"
            aria-label="새 레시피 등록하기"
            title="새 레시피 등록 (관리자)"
          >
            <Plus className="h-5 w-5" />
            <span>레시피 추가</span>
          </button>
        </div>
      )}

      {/* Footer */}
      <Footer />

      {/* 1. Recipe Detail Modal */}
      {selectedRecipe && (
        <RecipeDetailModal
          recipe={selectedRecipe}
          isBookmarked={bookmarkedIds.includes(selectedRecipe.id)}
          userNote={userNotes[selectedRecipe.id] || ''}
          onClose={() => setSelectedRecipe(null)}
          onToggleBookmark={handleToggleBookmark}
          onAddShoppingItem={handleAddShoppingItem}
          onAddAllShoppingItems={handleAddAllShoppingItems}
          onOpenCookingMode={handleStartCookingMode}
          onOpenAiModal={(recipe) => {
            logger.info('App', `레시피 상세에서 AI 요리사 질문 모드 진입: ${recipe.name}`);
            setSelectedRecipe(null);
            setAiChefRecipe(recipe);
            handleNavigateView('ai-chef');
          }}
          onOpenEditRecipe={(recipe) => {
            setSelectedRecipe(null);
            setRecipeToEdit(recipe);
            setIsFormModalOpen(true);
          }}
          onDeleteRecipe={handleDeleteRecipeRequest}
          onSaveNote={handleSaveRecipeNote}
          onToggleFamilyShare={handleToggleFamilyShareRecipe}
          isAdmin={isAdmin}
          showToast={showToast}
        />
      )}

      {/* 2. Focus Cooking Mode Modal */}
      {cookingModeRecipe && (
        <CookingModeModal
          recipe={cookingModeRecipe}
          portionMultiplier={cookingMultiplier}
          onClose={() => setCookingModeRecipe(null)}
          showToast={showToast}
        />
      )}

      {/* 3. Recipe Form Modal (Create & Edit) */}
      <RecipeFormModal
        isOpen={isFormModalOpen}
        recipeToEdit={recipeToEdit}
        initialBookmarked={recipeToEdit ? bookmarkedIds.includes(recipeToEdit.id) : false}
        initialUserNote={recipeToEdit ? userNotes[recipeToEdit.id] || '' : ''}
        onClose={() => {
          setIsFormModalOpen(false);
          setRecipeToEdit(null);
        }}
        onSaveRecipe={handleSaveRecipe}
        onDeleteRecipe={handleDeleteRecipeRequest}
        showToast={showToast}
      />

      {/* 4. External AI Recipe Import Modal (URL/Text/Image OCR) */}
      <ImportRecipeModal
        isOpen={isImportModalOpen}
        existingRecipes={recipes}
        onClose={() => setIsImportModalOpen(false)}
        onSaveRecipe={handleSaveRecipe}
        showToast={showToast}
      />

      {/* 5. 🎲 Today Menu Modal (Random Roulette & AI Recommender) */}
      <TodayMenuModal
        isOpen={isTodayMenuModalOpen}
        allRecipes={recipes}
        bookmarkedIds={bookmarkedIds}
        onClose={() => setIsTodayMenuModalOpen(false)}
        onOpenRecipeDetail={handleOpenDetail}
        onAddToMealPlan={handleAddRecipeToMealPlan}
        showToast={showToast}
      />

      {/* 6. 👨‍👩‍👧 Family Share Modal */}
      <FamilyShareModal
        isOpen={isFamilyShareModalOpen}
        onClose={() => setIsFamilyShareModalOpen(false)}
        userProfile={userProfile}
        currentFamilySpace={activeFamilySpace}
        allFamilySpaces={allFamilySpacesList}
        userRecipes={recipes}
        onCreateFamilySpace={handleCreateFamilySpace}
        onJoinFamilySpace={handleJoinFamilySpace}
        onLeaveFamilySpace={handleLeaveFamilySpace}
        onUpdateUserProfileName={handleUpdateUserProfileName}
        onShareAllMyRecipes={handleShareAllMyRecipes}
        showToast={showToast}
      />

      {/* 7. Shopping List Modal */}
      <ShoppingListModal
        isOpen={isShoppingModalOpen}
        items={shoppingList}
        onClose={() => setIsShoppingModalOpen(false)}
        onToggleComplete={handleToggleShoppingComplete}
        onDeleteItem={handleDeleteShoppingItem}
        onAddItem={handleAddShoppingItem}
        onClearCompleted={handleClearCompletedShopping}
        onClearAll={handleClearAllShopping}
        showToast={showToast}
      />

      {/* 8. Backup and Restore Modal */}
      <BackupRestoreModal
        isOpen={isBackupModalOpen}
        allRecipes={recipes}
        bookmarks={bookmarkedIds}
        userNotes={userNotes}
        shoppingList={shoppingList}
        onClose={() => setIsBackupModalOpen(false)}
        onRestoreComplete={handleRestoreComplete}
        showToast={showToast}
      />

      {/* 9. Kitchen Timer Widget */}
      <TimerWidget
        isOpen={isTimerOpen}
        onClose={() => setIsTimerOpen(false)}
        showToast={showToast}
      />

      {/* 10. Global Confirm Modal */}
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        isDestructive={confirmDialog.isDestructive}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* 11. Cloud Data Migration Modal */}
      <CloudMigrationModal
        isOpen={migrationModal.isOpen}
        mode={migrationModal.mode}
        localCount={migrationModal.localRecipeCount}
        cloudCount={migrationModal.cloudRecipeCount}
        isMigrating={migrationModal.isMigrating}
        onClose={() => setMigrationModal((prev) => ({ ...prev, isOpen: false }))}
        onUploadLocal={handleUploadLocalToCloud}
        onMerge={handleMergeLocalAndCloud}
        onUseCloud={handleUseCloudOnly}
      />
    </div>
  );
}
