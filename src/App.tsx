/**
 * @file src/App.tsx
 * @description 내 입맛 레시피 메인 애플리케이션 컴포넌트. 레시피 CRUD, 백업/복원, 즐겨찾기, 장보기, 타이머, 집중 조리모드, 최근 본 레시피 및 확인 모달 조율
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Database, Sparkles } from 'lucide-react';
import { FilterCategory, Recipe, ShoppingItem, SortOption, ToastMessage } from './types/recipe';
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
} from './utils/storage';
import { logger } from './utils/logger';

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

/**
 * 최상위 App 컴포넌트
 */
export default function App(): React.JSX.Element {
  // 1. Core Data State
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<number[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [userNotes, setUserNotes] = useState<Record<number, string>>({});
  const [recentRecipeIds, setRecentRecipeIds] = useState<number[]>([]);

  // 2. View & Routing State
  const [currentView, setCurrentView] = useState<'home' | 'ai-chef'>('home');
  const [aiChefRecipe, setAiChefRecipe] = useState<Recipe | null>(null);

  // 3. Filtering, Searching & Sorting State
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('전체');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOption, setSortOption] = useState<SortOption>('default');

  // 4. Modals & Widgets State
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [cookingModeRecipe, setCookingModeRecipe] = useState<Recipe | null>(null);
  const [cookingMultiplier, setCookingMultiplier] = useState<number>(1);
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [recipeToEdit, setRecipeToEdit] = useState<Recipe | null>(null);
  const [isShoppingModalOpen, setIsShoppingModalOpen] = useState<boolean>(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isTimerOpen, setIsTimerOpen] = useState<boolean>(false);

  // 4. PWA & Offline State
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // 5. Confirm Dialog State
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

  // 6. Toast System State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  /**
   * 전역 토스트 알림 메시지를 표시합니다.
   * @param message 알림 문구
   */
  const showToast = useCallback((message: string): void => {
    logger.info('App.showToast', `토스트 생성: "${message}"`);
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, message }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  /**
   * 토스트 개별 닫기
   * @param id 토스트 ID
   */
  const handleDismissToast = useCallback((id: string): void => {
    logger.debug('App.handleDismissToast', `토스트 수동 닫기: ${id}`);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // URL Hash 기반 라우팅 동기화 (/ai-chef, #/ai-chef)
  useEffect(() => {
    const handleHashChange = (): void => {
      const hash = window.location.hash;
      logger.info('App.handleHashChange', `해시 변경 감지: ${hash}`);
      if (hash.includes('ai-chef')) {
        setCurrentView('ai-chef');
      } else {
        setCurrentView('home');
      }
    };

    // 초기 로드 시 확인
    if (window.location.hash.includes('ai-chef') || window.location.pathname === '/ai-chef') {
      setCurrentView('ai-chef');
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  /**
   * 뷰 전환 핸들러
   * @param view 타겟 뷰
   */
  const handleNavigateView = useCallback((view: 'home' | 'ai-chef'): void => {
    logger.info('App.handleNavigateView', `뷰 전환: ${view}`);
    setCurrentView(view);
    if (view === 'ai-chef') {
      window.location.hash = '#/ai-chef';
    } else {
      window.location.hash = '';
    }
  }, []);

  // PWA 설치 프롬프트 및 온/오프라인 이벤트 리스너 등록
  useEffect(() => {
    const handleOnline = (): void => {
      logger.info('App.network', '온라인 상태 복구');
      setIsOffline(false);
      showToast('🟢 네트워크가 연결되었습니다.');
    };
    const handleOffline = (): void => {
      logger.warn('App.network', '오프라인 상태 감지');
      setIsOffline(true);
      showToast('⚠️ 오프라인 상태입니다. 저장된 레시피를 오프라인으로 이용할 수 있습니다.');
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
      showToast('💡 이미 설치되었거나 브라우저 메뉴의 "홈 화면에 추가"를 이용해주세요.');
      return;
    }
    logger.info('App.handleInstallPwa', 'PWA 설치 프롬프트 표시');
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    logger.info('App.handleInstallPwa', `PWA 설치 결과: ${outcome}`);
    if (outcome === 'accepted') {
      showToast('🎉 앱이 성공적으로 설치되었습니다!');
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

  // 카테고리별 개수 맵 계산
  const categoryCounts = useMemo((): Record<string, number> => {
    logger.debug('App.useMemo(categoryCounts)', '카테고리별 레시피 개수 계산');
    const counts: Record<string, number> = {};
    CATEGORY_LIST.forEach((cat) => {
      counts[cat] = recipes.filter((r) => r.category === cat).length;
    });
    return counts;
  }, [recipes]);

  // 검색 및 필터링, 정렬 적용된 레시피 목록 계산
  const filteredAndSortedRecipes = useMemo((): Recipe[] => {
    logger.info('App.useMemo(filteredAndSortedRecipes)', '레시피 필터링 및 정렬 실행', {
      category: activeCategory,
      query: searchQuery,
      sort: sortOption,
    });

    const q = searchQuery.trim().toLowerCase();

    const filtered = recipes.filter((r) => {
      // 1. 카테고리 필터
      if (activeCategory === '즐겨찾기') {
        if (!bookmarkedIds.includes(r.id)) return false;
      } else if (activeCategory !== '전체') {
        if (r.category !== activeCategory) return false;
      }

      // 2. 검색어 필터 (음식명, 재료, 조리법, 메모 통합 검색)
      if (q) {
        const note = userNotes[r.id] || '';
        const fullText = `${r.name} ${r.ingredients} ${r.method || ''} ${note}`.toLowerCase();
        if (!fullText.includes(q)) return false;
      }

      return true;
    });

    // 3. 정렬 적용
    return [...filtered].sort((a, b) => {
      if (sortOption === 'nameAsc') {
        return a.name.localeCompare(b.name, 'ko');
      }
      if (sortOption === 'nameDesc') {
        return b.name.localeCompare(a.name, 'ko');
      }
      if (sortOption === 'latest') {
        return (b.createdAt || 0) - (a.createdAt || 0);
      }
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
      if (sortOption === 'ingredientsAsc') {
        return a.ingredientCount - b.ingredientCount;
      }
      if (sortOption === 'ingredientsDesc') {
        return b.ingredientCount - a.ingredientCount;
      }
      return 0; // 기본 순서
    });
  }, [recipes, activeCategory, searchQuery, bookmarkedIds, sortOption, userNotes]);

  /**
   * 북마크 토글 이벤트 핸들러
   * @param recipeId 레시피 ID
   */
  const handleToggleBookmark = useCallback((recipeId: number): void => {
    logger.info('App.handleToggleBookmark', `즐겨찾기 토글: ID ${recipeId}`);
    setBookmarkedIds((prev) => {
      const isExisting = prev.includes(recipeId);
      const next = isExisting ? prev.filter((id) => id !== recipeId) : [...prev, recipeId];
      saveBookmarks(next);
      showToast(isExisting ? '🤍 즐겨찾기에서 제거되었습니다.' : '⭐ 즐겨찾기에 추가되었습니다!');
      return next;
    });
  }, [showToast]);

  /**
   * 레시피 상세 모달 열기 핸들러 (최근 본 목록에 자동 추가)
   * @param recipe 대상 레시피
   */
  const handleOpenDetail = useCallback((recipe: Recipe): void => {
    logger.info('App.handleOpenDetail', `상세 모달 열기: ${recipe.name} (ID: ${recipe.id})`);
    setSelectedRecipe(recipe);
    const nextRecent = addRecentRecipeId(recipe.id);
    setRecentRecipeIds(nextRecent);
  }, []);

  /**
   * 신규 레시피 등록 또는 기존 레시피 수정 저장 핸들러
   * @param recipe 저장할 레시피 데이터
   * @param isBookmarked 북마크 여부
   * @param userNote 사용자 메모
   */
  const handleSaveRecipe = useCallback(
    (recipe: Recipe, isBookmarked: boolean, userNote: string): void => {
      logger.info('App.handleSaveRecipe', `레시피 저장 반영: ${recipe.name}`);

      setRecipes((prev) => {
        const isExisting = prev.some((r) => r.id === recipe.id);
        const next = isExisting
          ? prev.map((r) => (r.id === recipe.id ? recipe : r))
          : [recipe, ...prev];
        saveAllRecipes(next);
        return next;
      });

      // 북마크 상태 동기화
      setBookmarkedIds((prev) => {
        const isCurrentBookmarked = prev.includes(recipe.id);
        if (isBookmarked && !isCurrentBookmarked) {
          const next = [...prev, recipe.id];
          saveBookmarks(next);
          return next;
        } else if (!isBookmarked && isCurrentBookmarked) {
          const next = prev.filter((id) => id !== recipe.id);
          saveBookmarks(next);
          return next;
        }
        return prev;
      });

      // 메모 저장 동기화
      if (userNote.trim()) {
        setUserNotes((prev) => {
          const next = { ...prev, [recipe.id]: userNote.trim() };
          saveRecipeNote(recipe.id, userNote.trim());
          return next;
        });
      }

      // 현재 열려있는 상세 모달이 있다면 갱신
      if (selectedRecipe && selectedRecipe.id === recipe.id) {
        setSelectedRecipe(recipe);
      }
    },
    [selectedRecipe]
  );

  /**
   * 외부 AI 레시피 가져오기 성공 후 등록 핸들러
   * @param recipe AI 분석된 레시피 데이터
   */
  const handleImportRecipeSuccess = useCallback(
    (recipe: Recipe): void => {
      logger.info('App.handleImportRecipeSuccess', `가져온 레시피 추가: ${recipe.name}`);
      handleSaveRecipe(recipe, false, '');
      showToast(`🎉 '${recipe.name}' 레시피가 성공적으로 등록되었습니다!`);
    },
    [handleSaveRecipe, showToast]
  );

  /**
   * 레시피 삭제 요청 핸들러 (확인 모달 팝업)
   * @param recipeId 삭제 대상 레시피 ID
   */
  const handleDeleteRecipeRequest = useCallback(
    (recipeId: number): void => {
      const target = recipes.find((r) => r.id === recipeId);
      if (!target) return;

      logger.info('App.handleDeleteRecipeRequest', `레시피 삭제 요청 확인: ${target.name}`);

      setConfirmDialog({
        isOpen: true,
        title: '레시피 삭제',
        message: `'${target.name}' 레시피를 정말 삭제하시겠습니까? 삭제된 레시피는 복구할 수 없습니다.`,
        confirmText: '삭제하기',
        isDestructive: true,
        onConfirm: () => {
          logger.info('App.onConfirmDelete', `레시피 삭제 실행: ${target.name}`);
          setRecipes((prev) => {
            const next = prev.filter((r) => r.id !== recipeId);
            saveAllRecipes(next);
            return next;
          });

          // 북마크 및 최근 본 목록에서 정리
          setBookmarkedIds((prev) => {
            const next = prev.filter((id) => id !== recipeId);
            saveBookmarks(next);
            return next;
          });
          setRecentRecipeIds((prev) => prev.filter((id) => id !== recipeId));

          if (selectedRecipe && selectedRecipe.id === recipeId) {
            setSelectedRecipe(null);
          }
          if (recipeToEdit && recipeToEdit.id === recipeId) {
            setIsFormModalOpen(false);
            setRecipeToEdit(null);
          }

          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          showToast(`🗑️ '${target.name}' 레시피가 삭제되었습니다.`);
        },
      });
    },
    [recipes, selectedRecipe, recipeToEdit, showToast]
  );

  /**
   * 장보기 단일 아이템 추가 핸들러
   * @param text 아이템 텍스트
   * @param sourceName 출처 레시피명
   */
  const handleAddShoppingItem = useCallback((text: string, sourceName?: string): void => {
    logger.info('App.handleAddShoppingItem', `장보기 단일 추가: "${text}" (${sourceName})`);
    const newItem: ShoppingItem = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      text,
      sourceRecipeName: sourceName,
      completed: false,
      createdAt: Date.now(),
    };
    setShoppingList((prev) => {
      const next = [newItem, ...prev];
      saveShoppingList(next);
      return next;
    });
  }, []);

  /**
   * 장보기 목록에 여러 재료 일괄 추가 핸들러
   * @param items 재료 문자열 배열
   * @param recipeName 출처 레시피명
   */
  const handleAddAllShoppingItems = useCallback((items: string[], recipeName?: string): void => {
    logger.info('App.handleAddAllShoppingItems', `장보기 일괄 추가: ${items.length}개 (${recipeName})`);
    const newItems: ShoppingItem[] = items.map((text) => ({
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      text,
      sourceRecipeName: recipeName,
      completed: false,
      createdAt: Date.now(),
    }));

    setShoppingList((prev) => {
      const next = [...newItems, ...prev];
      saveShoppingList(next);
      return next;
    });
  }, []);

  /**
   * 장보기 아이템 완료 체크 토글 핸들러
   * @param id 아이템 ID
   */
  const handleToggleShoppingComplete = useCallback((id: string): void => {
    logger.info('App.handleToggleShoppingComplete', `장보기 체크 토글: ID ${id}`);
    setShoppingList((prev) => {
      const next = prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      );
      saveShoppingList(next);
      return next;
    });
  }, []);

  /**
   * 장보기 단일 아이템 삭제 핸들러
   * @param id 아이템 ID
   */
  const handleDeleteShoppingItem = useCallback((id: string): void => {
    logger.info('App.handleDeleteShoppingItem', `장보기 아이템 삭제: ID ${id}`);
    setShoppingList((prev) => {
      const next = prev.filter((item) => item.id !== id);
      saveShoppingList(next);
      return next;
    });
  }, []);

  /**
   * 완료된 장보기 항목 일괄 삭제 핸들러
   */
  const handleClearCompletedShopping = useCallback((): void => {
    logger.info('App.handleClearCompletedShopping', '완료된 장보기 항목 일괄 정리');
    setShoppingList((prev) => {
      const next = prev.filter((item) => !item.completed);
      saveShoppingList(next);
      return next;
    });
    showToast('🧹 완료된 장보기 항목이 정리되었습니다.');
  }, [showToast]);

  /**
   * 장보기 목록 전체 비우기 핸들러
   */
  const handleClearAllShopping = useCallback((): void => {
    logger.info('App.handleClearAllShopping', '장보기 목록 전체 비우기');
    setShoppingList([]);
    saveShoppingList([]);
    showToast('🗑️ 장보기 목록이 비워졌습니다.');
  }, [showToast]);

  /**
   * 레시피 사용자 메모 저장 핸들러
   * @param recipeId 레시피 ID
   * @param note 메모 텍스트
   */
  const handleSaveRecipeNote = useCallback((recipeId: number, note: string): void => {
    logger.info('App.handleSaveRecipeNote', `레시피(${recipeId}) 메모 저장`);
    setUserNotes((prev) => {
      const next = { ...prev, [recipeId]: note };
      saveRecipeNote(recipeId, note);
      return next;
    });
  }, []);

  /**
   * 조리 모드(Focus Mode) 시작 핸들러
   * @param recipe 대상 레시피
   * @param multiplier 인분 배율
   */
  const handleStartCookingMode = useCallback((recipe: Recipe, multiplier: number): void => {
    logger.info('App.handleStartCookingMode', `조리 모드 전환: ${recipe.name} (x${multiplier})`);
    setSelectedRecipe(null); // 상세 모달 닫기
    setCookingModeRecipe(recipe);
    setCookingMultiplier(multiplier);
  }, []);

  /**
   * 필터 및 검색어 초기화 핸들러
   */
  const handleResetFilters = useCallback((): void => {
    logger.info('App.handleResetFilters', '필터 및 검색어 전체 초기화');
    setActiveCategory('전체');
    setSearchQuery('');
    setSortOption('default');
  }, []);

  /**
   * 레시피 섹션으로 스크롤 이동
   */
  const scrollToRecipes = useCallback((): void => {
    logger.info('App.scrollToRecipes', '레시피 섹션으로 스크롤');
    const el = document.getElementById('recipes');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
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
      setBookmarkedIds(restored.bookmarks);
      setUserNotes(restored.userNotes);
      setShoppingList(restored.shoppingList);
      setRecentRecipeIds(restored.recentIds);
    },
    []
  );

  return (
    <div className="min-h-screen bg-[#fffaf3] text-stone-800 antialiased selection:bg-orange-500 selection:text-white">
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
        onOpenBackupRestore={() => setIsBackupModalOpen(true)}
        onToggleTimer={() => setIsTimerOpen((prev) => !prev)}
        isTimerOpen={isTimerOpen}
        canInstallPwa={!!deferredPrompt}
        onInstallPwa={handleInstallPwa}
        isOffline={isOffline}
      />

      <main>
        {currentView === 'ai-chef' ? (
          /* ✨ AI 요리사 Q&A 전용 화면 (Route: /ai-chef, #/ai-chef) */
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
        ) : (
          /* 기본 홈 & 레시피 뷰 */
          <>
            {/* Hero Section */}
            <HeroSection
              totalRecipeCount={recipes.length}
              categoryCount={CATEGORY_LIST.length}
              bookmarkCount={bookmarkedIds.length}
              onSelectCategory={setActiveCategory}
              onScrollToRecipes={scrollToRecipes}
            />

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
                      scrollToRecipes();
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
              onResetFilters={handleResetFilters}
              onOpenAddRecipe={() => {
                setRecipeToEdit(null);
                setIsFormModalOpen(true);
              }}
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
      </main>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-2.5">
        {/* Floating AI Chef Quick Button (when in home view) */}
        {currentView === 'home' && (
          <button
            type="button"
            onClick={() => {
              logger.info('App', '플로팅 AI 요리사 클릭');
              setAiChefRecipe(null);
              handleNavigateView('ai-chef');
            }}
            className="flex items-center gap-2 rounded-full border border-orange-200 bg-white/95 px-4 py-2.5 font-soft text-xs font-bold text-orange-800 shadow-lg backdrop-blur-sm transition-all hover:scale-105 hover:bg-orange-50 active:scale-95"
            title="AI 요리사에게 질문하기"
          >
            <Sparkles className="h-4 w-4 text-orange-500" />
            <span>✨ AI 요리사</span>
          </button>
        )}

        {/* Floating Add Recipe Button (+ 레시피 추가) */}
        <button
          type="button"
          onClick={() => {
            logger.info('App', '플로팅 레시피 추가 버튼 클릭');
            setRecipeToEdit(null);
            setIsFormModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3.5 font-soft text-sm font-black text-white shadow-xl shadow-orange-500/30 transition-all hover:scale-105 hover:from-orange-600 hover:to-amber-600 active:scale-95"
          aria-label="새 레시피 등록하기"
        >
          <Plus className="h-5 w-5" />
          <span>레시피 추가</span>
        </button>
      </div>

      {/* Footer */}
      <Footer />

      {/* Recipe Detail Modal */}
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
          showToast={showToast}
        />
      )}

      {/* Focus Cooking Mode Modal */}
      {cookingModeRecipe && (
        <CookingModeModal
          recipe={cookingModeRecipe}
          portionMultiplier={cookingMultiplier}
          onClose={() => setCookingModeRecipe(null)}
          showToast={showToast}
        />
      )}

      {/* Recipe Form Modal (Create & Edit) */}
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

      {/* External AI Recipe Import Modal */}
      <ImportRecipeModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportRecipeSuccess}
        showToast={showToast}
      />

      {/* Shopping List Modal */}
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

      {/* Backup and Restore Modal */}
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

      {/* Kitchen Timer Widget */}
      <TimerWidget
        isOpen={isTimerOpen}
        onClose={() => setIsTimerOpen(false)}
        showToast={showToast}
      />

      {/* Global Confirm Modal */}
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        isDestructive={confirmDialog.isDestructive}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
