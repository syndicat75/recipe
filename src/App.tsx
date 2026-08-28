/**
 * @file src/App.tsx
 * @description 내 입맛 레시피 메인 애플리케이션 컴포넌트.
 * 모듈화된 커스텀 훅(usePublicRecipes, useRecipePreferences, useShoppingList, useMealPlan,
 * useRecipeFilter, useRecipeMigration, useFamilySync, useFirebaseAuth, usePwaInstall,
 * useNetworkStatus, useAppNavigation, useToast)을 조율하여 레시피 CRUD, 주간 식단표,
 * AI 요리사, 가족 공유, PWA/오프라인 환경을 제공합니다.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Plus, Database, Sparkles, Calendar, Dice5, Users } from 'lucide-react';
import { Recipe, SaveRecipeResult } from './types/recipe';
import { CATEGORY_LIST } from './config/appConfig';
import { logger } from './utils/logger';
import { isUserAdmin } from './utils/admin';
import { publishAllRecipesToPublic } from './services/firestoreSync';

// Custom Hooks
import { useToast } from './hooks/useToast';
import { useAppNavigation } from './hooks/useAppNavigation';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { usePwaInstall } from './hooks/usePwaInstall';
import { useFirebaseAuth } from './hooks/useFirebaseAuth';
import { useFamilySync } from './hooks/useFamilySync';
import { usePublicRecipes } from './hooks/usePublicRecipes';
import { useRecipePreferences } from './hooks/useRecipePreferences';
import { useShoppingList } from './hooks/useShoppingList';
import { useMealPlan } from './hooks/useMealPlan';
import { useRecipeFilter } from './hooks/useRecipeFilter';
import { useRecipeMigration } from './hooks/useRecipeMigration';

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
import { PwaInstallModal } from './components/PwaInstallModal';
import { AdminCalorieModal } from './components/AdminCalorieModal';
import { ErrorBoundary } from './components/ErrorBoundary';

/**
 * 최상위 App 컴포넌트
 */
export default function App(): React.JSX.Element {
  // 1. Toast Notification Hook
  const { toasts, showToast, dismissToast } = useToast();

  // 2. Navigation Hook (URL Hash 기반)
  const { currentView, navigateView } = useAppNavigation();

  // 3. Network Status Hook
  const { isOffline } = useNetworkStatus();

  // 4. PWA Installation Hook
  const {
    isInstalled,
    isStandalone,
    canInstall,
    isInstallModalOpen,
    setIsInstallModalOpen,
    installPwa,
    pwaEnv,
  } = usePwaInstall({
    showToast,
  });

  // 5. Firebase Authentication Hook
  const {
    user,
    isLoading: isAuthLoading,
    isLoggingIn,
    syncStatus,
    setSyncStatus,
    loginWithGoogle,
    logout,
  } = useFirebaseAuth();

  // 관리자 권한 판별
  const isAdmin = useMemo(() => isUserAdmin(user?.uid, user?.email), [user?.uid, user?.email]);

  // 6. Public Recipes Hook (Firestore /recipes 실시간 동기화 & 단일 진실 공급원)
  const {
    recipes,
    setRecipes,
    isLoadingRecipes,
    recipeSyncError,
    saveRecipe: savePublicRecipeData,
    deleteRecipe: deletePublicRecipeData,
  } = usePublicRecipes({
    isAdmin,
    showToast,
  });

  // 7. User Preferences Hook (즐겨찾기, 메모, 최근 본 레시피)
  const {
    bookmarkedIds,
    userNotes,
    recentRecipeIds,
    setBookmarkedIds,
    setUserNotes,
    setRecentRecipeIds,
    toggleBookmark,
    updateRecipeNote,
    addRecentRecipe,
    restoreLocalPreferences,
  } = useRecipePreferences({
    user,
    showToast,
  });

  // 8. Personal Shopping List Hook
  const {
    shoppingList,
    setShoppingList,
    addShoppingItem,
    addAllShoppingItems,
    toggleShoppingItem,
    deleteShoppingItem,
    clearCompletedShopping,
    clearAllShopping,
    restoreLocalShoppingList,
  } = useShoppingList({
    user,
    setSyncStatus,
    showToast,
  });

  // 9. Personal Meal Plan Hook
  const {
    weeklyMealPlan,
    setWeeklyMealPlan,
    savePlan: handleSaveWeeklyMealPlan,
    addRecipeToMealPlan: handleAddRecipeToMealPlan,
  } = useMealPlan({ showToast });

  // 10. Recipe Filtering, Search & Sorting Hook
  const {
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    sortOption,
    setSortOption,
    categoryCounts,
    filteredAndSortedRecipes,
  } = useRecipeFilter({
    recipes,
    bookmarkedIds,
    userNotes,
  });

  // 11. Family Sync Hook (Firestore 다기기 실시간 공유)
  const {
    familyProfile,
    activeFamily,
    members: familyMembers,
    sharedRecipeIds,
    familyMealPlanEntries,
    familyShoppingItems,
    isFamilyOwner,
    isSyncing: isFamilySyncing,
    syncError: familySyncError,
    isCreating: isFamilyCreating,
    isJoining: isFamilyJoining,
    isLeaving: isFamilyLeaving,
    createFamily,
    joinFamily,
    leaveFamily,
    unshareRecipe,
    toggleShareRecipe,
    addMealPlanEntry: addFamilyMealPlanEntry,
    deleteMealPlanEntry: deleteFamilyMealPlanEntry,
    addShoppingItem: addFamilyShoppingItem,
    toggleShoppingItem: toggleFamilyShoppingItem,
    deleteShoppingItem: deleteFamilyShoppingItem,
    transferOwnership: transferFamilyOwnership,
    deleteFamilySpace,
    updateProfile: updateFamilyUserProfile,
  } = useFamilySync(user);

  // 12. Modal & Active UI States
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
  const [isAdminCalorieModalOpen, setIsAdminCalorieModalOpen] = useState<boolean>(false);
  const [aiChefRecipe, setAiChefRecipe] = useState<Recipe | null>(null);

  // 13. Confirm Dialog State
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

  const openConfirmDialog = useCallback(
    (config: {
      title: string;
      message: string;
      confirmText?: string;
      isDestructive?: boolean;
      onConfirm: () => void;
    }) => {
      setConfirmDialog({
        isOpen: true,
        title: config.title,
        message: config.message,
        confirmText: config.confirmText || '확인',
        isDestructive: config.isDestructive || false,
        onConfirm: config.onConfirm,
      });
    },
    []
  );

  /**
   * Google 로그인 시작 핸들러
   */
  const handleGoogleLogin = useCallback(async () => {
    logger.info('App.handleGoogleLogin', '사용자 Google 로그인 버튼 클릭');
    const result = await loginWithGoogle(
      (errorMessage: string) => {
        showToast(errorMessage, 'warning');
      },
      (infoMessage: string) => {
        showToast(infoMessage, 'info');
      }
    );
    if (result) {
      showToast(`👋 ${result.displayName || result.email}님, 환영합니다!`, 'success');
    }
  }, [loginWithGoogle, showToast]);

  // 14. Recipe Cloud Migration Hook
  const {
    migrationModal,
    setMigrationModal,
    handleUploadLocalToCloud,
    handleMergeLocalAndCloud,
    handleUseCloudOnly,
    handleManualOpenCloudSyncModal,
    handleRestoreDefaultRecipes,
  } = useRecipeMigration({
    user,
    isAdmin,
    recipes,
    onLogin: handleGoogleLogin,
    setSyncStatus,
    showToast,
    openConfirmDialog,
  });

  // 🔗 가족 초대 링크(?familyInvite=FAM-XXXXXX) 감지 및 처리
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const inviteCode = searchParams.get('familyInvite');

      if (inviteCode && inviteCode.trim()) {
        const cleanCode = inviteCode.trim().toUpperCase();
        logger.info('App.inviteLink', `가족 초대 링크 감지: ${cleanCode}`);

        // URL 쿼리 파라미터 정리
        searchParams.delete('familyInvite');
        const newSearch = searchParams.toString() ? `?${searchParams.toString()}` : '';
        const newUrl = `${window.location.pathname}${newSearch}${window.location.hash}`;
        window.history.replaceState({}, document.title, newUrl);

        if (!user) {
          showToast('👨‍👩‍👧 가족 공간 초대를 받았습니다. Google 로그인 후 바로 참여해보세요!', 'info');
          setIsFamilyShareModalOpen(true);
        } else {
          if (activeFamily?.inviteCode === cleanCode) {
            showToast(`이미 '${activeFamily.name}' 가족 공간에 참여 중입니다.`, 'info');
          } else {
            showToast(`👨‍👩‍👧 초대 코드(${cleanCode})로 가족 공간에 참여합니다...`, 'info');
            joinFamily(cleanCode)
              .then((res) => {
                showToast(`🎉 '${res.familyName}' 가족 공간에 참여했습니다!`, 'success');
                setIsFamilyShareModalOpen(true);
              })
              .catch((err: any) => {
                logger.error('App.inviteLink', '초대 코드 참여 실패', err);
                showToast(err.message || '가족 공간 참여에 실패했습니다.', 'error');
                setIsFamilyShareModalOpen(true);
              });
          }
        }
      }
    } catch (e) {
      logger.error('App.inviteLink', '초대 파라미터 파싱 에러', e);
    }
  }, [user, activeFamily, joinFamily, showToast]);

  /**
   * 레시피 상세 모달 열기 핸들러
   */
  const handleOpenDetail = useCallback(
    (recipe: Recipe): void => {
      logger.info('App.handleOpenDetail', `상세 모달 열기: ${recipe.name} (ID: ${recipe.id})`);
      setSelectedRecipe(recipe);
      addRecentRecipe(recipe.id);
    },
    [addRecentRecipe]
  );

  /**
   * 레시피 등록 또는 수정 저장 핸들러
   */
  const handleSaveRecipe = useCallback(
    async (
      recipeData: Recipe,
      isBookmarked: boolean,
      userNote: string
    ): Promise<SaveRecipeResult> => {
      logger.info(
        'App.handleSaveRecipe',
        `레시피 저장 시도: ${recipeData.name} (ID: ${recipeData.id}, isAdmin: ${isAdmin})`
      );

      const result = await savePublicRecipeData(recipeData);
      if (!result.success) {
        return result;
      }

      // 북마크 상태 반영
      const has = bookmarkedIds.includes(recipeData.id);
      if ((isBookmarked && !has) || (!isBookmarked && has)) {
        toggleBookmark(recipeData.id);
      }

      // 사용자 메모 저장
      if (userNote !== undefined) {
        updateRecipeNote(recipeData.id, userNote);
      }

      return { success: true, scope: 'public' };
    },
    [isAdmin, savePublicRecipeData, bookmarkedIds, toggleBookmark, updateRecipeNote]
  );

  /**
   * 레시피 삭제 요청 (관리자 전용)
   */
  const handleDeleteRecipeRequest = useCallback(
    (recipeId: number): void => {
      const target = recipes.find((r) => r.id === recipeId);
      if (!target) return;

      if (!isAdmin) {
        showToast('🔒 관리자만 삭제할 수 있습니다.', 'warning');
        return;
      }

      openConfirmDialog({
        title: '레시피 삭제',
        message: `'${target.name}' 레시피를 정말 삭제하시겠습니까? 공개 DB(/recipes)에서 영구히 제거됩니다.`,
        confirmText: '삭제',
        isDestructive: true,
        onConfirm: async () => {
          logger.info('App.handleDeleteRecipe', `공개 레시피 삭제 확정: ID ${recipeId}`);
          const success = await deletePublicRecipeData(recipeId);
          if (success) {
            if (bookmarkedIds.includes(recipeId)) {
              toggleBookmark(recipeId);
            }
            setSelectedRecipe(null);
            setRecipeToEdit(null);
            setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
            showToast(`'${target.name}' 레시피가 삭제되었습니다.`, 'info');
          }
        },
      });
    },
    [recipes, isAdmin, openConfirmDialog, deletePublicRecipeData, bookmarkedIds, toggleBookmark, showToast]
  );

  /**
   * 로그아웃 핸들러
   */
  const handleLogout = useCallback(() => {
    logger.info('App.handleLogout', '사용자 로그아웃 수행');
    logout();
    restoreLocalPreferences();
    restoreLocalShoppingList();
    showToast('로그아웃되었습니다.', 'info');
  }, [logout, restoreLocalPreferences, restoreLocalShoppingList, showToast]);

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
   * 개별 레시피 가족 공유 토글 핸들러
   */
  const handleToggleFamilyShare = useCallback(
    async (recipe: Recipe): Promise<void> => {
      if (!user) {
        showToast('👨‍👩‍👧 가족 공유를 사용하려면 Google 로그인이 필요합니다.', 'info');
        setIsFamilyShareModalOpen(true);
        return;
      }
      if (!activeFamily) {
        showToast('가족 공간을 먼저 만들거나 초대 코드로 참여해주세요.', 'info');
        setIsFamilyShareModalOpen(true);
        return;
      }

      try {
        const isNowShared = await toggleShareRecipe(recipe.id);
        showToast(
          isNowShared
            ? `👨‍👩‍👧 '${recipe.name}' 레시피가 '${activeFamily.name}' 공간에 공유되었습니다!`
            : `'${recipe.name}' 레시피 공유가 해제되었습니다.`,
          'success'
        );
      } catch (err: any) {
        logger.error('App.handleToggleFamilyShare', '가족 레시피 공유 토글 실패', err);
        showToast(err.message || '가족 공유 처리에 실패했습니다.', 'error');
      }
    },
    [user, activeFamily, toggleShareRecipe, showToast]
  );

  /**
   * 내 모든 레시피 일괄 가족 공유
   */
  const handleShareAllMyRecipes = useCallback(async (): Promise<void> => {
    if (!user || !activeFamily) {
      showToast('참여 중인 가족 공간이 없습니다.', 'info');
      return;
    }
    try {
      showToast('가족 공간에 레시피를 일괄 공유하는 중...', 'info');
      for (const r of recipes) {
        if (!sharedRecipeIds.has(r.id)) {
          await toggleShareRecipe(r.id);
        }
      }
      showToast(`🎉 모든 레시피가 '${activeFamily.name}' 가족 공간에 공유되었습니다!`, 'success');
    } catch (err: any) {
      logger.error('App.handleShareAllMyRecipes', '전체 공유 실패', err);
      showToast('일부 레시피 공유에 실패했습니다.', 'error');
    }
  }, [user, activeFamily, recipes, sharedRecipeIds, toggleShareRecipe, showToast]);

  /**
   * 백업 복원 완료 핸들러
   */
  const handleRestoreComplete = useCallback(
    (restored: {
      recipes: Recipe[];
      bookmarks: number[];
      userNotes: Record<number, string>;
      shoppingList: any[];
      recentIds: number[];
    }) => {
      logger.info('App.handleRestoreComplete', '백업 복원 상태 적용');
      setRecipes(restored.recipes);
      setBookmarkedIds(restored.bookmarks);
      setUserNotes(restored.userNotes);
      setShoppingList(restored.shoppingList);
      setRecentRecipeIds(restored.recentIds);

      if (isAdmin) {
        publishAllRecipesToPublic(restored.recipes).catch((err) => {
          logger.error('App.handleRestoreComplete', '복원된 레시피 공개 컬렉션 동기화 실패', err);
        });
      }
    },
    [isAdmin, setRecipes, setBookmarkedIds, setUserNotes, setShoppingList, setRecentRecipeIds]
  );

  return (
    <div className="min-h-screen bg-[#fffaf3] text-stone-800 antialiased selection:bg-orange-500 selection:text-white flex flex-col">
      {/* Toast Notification Container */}
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Top Header */}
      <Header
        currentCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        currentView={currentView}
        onNavigateView={navigateView}
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
        currentFamilyName={activeFamily ? activeFamily.name : null}
        onOpenBackupRestore={() => setIsBackupModalOpen(true)}
        onToggleTimer={() => setIsTimerOpen((prev) => !prev)}
        isTimerOpen={isTimerOpen}
        canInstallPwa={canInstall}
        isInstalled={isInstalled}
        isStandalone={isStandalone}
        onInstallPwa={() => setIsInstallModalOpen(true)}
        isOffline={isOffline}
        user={user}
        isAdmin={isAdmin}
        syncStatus={syncStatus}
        isLoggingIn={isLoggingIn}
        onLogin={handleGoogleLogin}
        onLogout={handleLogout}
        onOpenCloudSyncModal={handleManualOpenCloudSyncModal}
        onRestoreDefaultRecipes={handleRestoreDefaultRecipes}
        onOpenAdminCalories={() => setIsAdminCalorieModalOpen(true)}
      />

      {/* Main Content Areas based on Routing */}
      {currentView === 'ai-chef' ? (
        <main className="flex-1">
          <ErrorBoundary>
            <AiChefView
              activeRecipe={aiChefRecipe}
              allRecipes={recipes}
              userNotes={userNotes}
              onSelectActiveRecipe={setAiChefRecipe}
              onBackToHome={() => {
                setAiChefRecipe(null);
                navigateView('home');
              }}
              onSaveRecipeNote={updateRecipeNote}
              showToast={showToast}
              onOpenConfirm={openConfirmDialog}
              isOffline={isOffline}
            />
          </ErrorBoundary>
        </main>
      ) : currentView === 'meal-plan' ? (
        <main className="flex-1">
          <ErrorBoundary>
            <WeeklyMealPlanView
              mealPlan={weeklyMealPlan}
              allRecipes={recipes}
              onSaveMealPlan={handleSaveWeeklyMealPlan}
              onOpenRecipeDetail={handleOpenDetail}
              onOpenTodayMenuModal={() => setIsTodayMenuModalOpen(true)}
              onAddShoppingItems={(items) => addAllShoppingItems(items, '주간 식단표')}
              onBackToHome={() => navigateView('home')}
              showToast={showToast}
              onOpenConfirm={openConfirmDialog}
            />
          </ErrorBoundary>
        </main>
      ) : (
        <main className="flex-1">
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

          {/* Recent Recipes Strip */}
          <RecentRecipes
            allRecipes={recipes}
            recentIds={recentRecipeIds}
            onOpenDetail={handleOpenDetail}
          />

          {/* Recipe Exploration Section */}
          <section id="recipes" className="py-10 sm:py-14">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              {/* Category Filter Pills */}
              <CategoryFilter
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
                categoryCounts={categoryCounts}
                totalCount={recipes.length}
                bookmarkCount={bookmarkedIds.length}
              />

              {/* Search and Sort Toolbar */}
              <div className="mt-8">
                <SearchBar
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  onSelectTag={(tag) => setSearchQuery(tag)}
                />
              </div>

              {/* Recipe Grid or Empty State */}
              <div className="mt-8">
                <RecipeList
                  recipes={filteredAndSortedRecipes}
                  activeCategory={activeCategory}
                  searchQuery={searchQuery}
                  bookmarkedIds={bookmarkedIds}
                  sharedRecipeIds={sharedRecipeIds}
                  sortOption={sortOption}
                  onSortChange={setSortOption}
                  onToggleBookmark={toggleBookmark}
                  onOpenDetail={handleOpenDetail}
                  onResetFilters={() => {
                    setActiveCategory('전체');
                    setSearchQuery('');
                  }}
                  onOpenAddRecipe={() => {
                    setRecipeToEdit(null);
                    setIsFormModalOpen(true);
                  }}
                  isAdmin={isAdmin}
                />
              </div>
            </div>
          </section>

          {/* About Section */}
          <AboutSection />
        </main>
      )}

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-3 pointer-events-none">
        {/* 주간 식단표 플로팅 바로가기 버튼 */}
        {currentView !== 'meal-plan' && (
          <button
            type="button"
            onClick={() => navigateView('meal-plan')}
            className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-xs font-black text-white shadow-xl shadow-amber-500/25 transition hover:bg-amber-600 hover:scale-105 active:scale-95"
            title="월~일 주간 식단표 열기"
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">주간 식단표</span>
          </button>
        )}

        {/* 오늘 뭐 먹지 플로팅 버튼 */}
        <button
          type="button"
          onClick={() => setIsTodayMenuModalOpen(true)}
          className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 text-xs font-black text-white shadow-xl shadow-orange-500/25 transition hover:from-orange-600 hover:to-amber-600 hover:scale-105 active:scale-95"
          title="랜덤 룰렛으로 메뉴 정하기"
        >
          <Dice5 className="h-4 w-4" />
          <span className="hidden sm:inline">오늘 뭐 먹지?</span>
        </button>

        {/* AI 요리사 플로팅 버튼 */}
        {currentView !== 'ai-chef' && (
          <button
            type="button"
            onClick={() => navigateView('ai-chef')}
            className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-stone-900 px-4 py-3 text-xs font-black text-white shadow-xl shadow-stone-900/25 transition hover:bg-black hover:scale-105 active:scale-95"
            title="AI 요리사에게 물어보기"
          >
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span className="hidden sm:inline">AI 요리사</span>
          </button>
        )}

        {/* 레시피 추가 플로팅 버튼 (관리자 전용) */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setRecipeToEdit(null);
              setIsFormModalOpen(true);
            }}
            className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white shadow-xl shadow-orange-500/30 transition hover:scale-105 active:scale-95"
            title="새 레시피 등록 (관리자 전용)"
            aria-label="새 레시피 등록"
          >
            <Plus className="h-7 w-7" />
          </button>
        )}
      </div>

      {/* Floating Kitchen Timer Widget */}
      <TimerWidget
        isOpen={isTimerOpen}
        onClose={() => setIsTimerOpen(false)}
        showToast={showToast}
      />

      {/* Recipe Detail Modal */}
      {selectedRecipe && (
        <RecipeDetailModal
          recipe={selectedRecipe}
          isBookmarked={bookmarkedIds.includes(selectedRecipe.id)}
          userNote={userNotes[selectedRecipe.id] || ''}
          isFamilyShared={sharedRecipeIds.has(selectedRecipe.id)}
          onToggleBookmark={toggleBookmark}
          onClose={() => setSelectedRecipe(null)}
          onAddShoppingItem={(text, source) => addShoppingItem(text, source)}
          onAddAllShoppingItems={(items, source) => addAllShoppingItems(items, source)}
          onOpenCookingMode={handleStartCookingMode}
          onOpenEditRecipe={(recipe) => {
            setSelectedRecipe(null);
            setRecipeToEdit(recipe);
            setIsFormModalOpen(true);
          }}
          onOpenAiModal={(recipe) => {
            setSelectedRecipe(null);
            setAiChefRecipe(recipe);
            navigateView('ai-chef');
          }}
          onDeleteRecipe={handleDeleteRecipeRequest}
          onSaveNote={updateRecipeNote}
          onToggleFamilyShare={handleToggleFamilyShare}
          isAdmin={isAdmin}
          showToast={showToast}
        />
      )}

      {/* Full-Screen Step-by-Step Cooking Mode Modal */}
      {cookingModeRecipe && (
        <CookingModeModal
          recipe={cookingModeRecipe}
          portionMultiplier={cookingMultiplier}
          onClose={() => setCookingModeRecipe(null)}
          showToast={showToast}
        />
      )}

      {/* Recipe Form Modal (Create / Edit) - 관리자 전용 */}
      {isFormModalOpen && (
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
          isAdmin={isAdmin}
        />
      )}

      {/* Shopping List Modal */}
      <ShoppingListModal
        isOpen={isShoppingModalOpen}
        items={shoppingList}
        onClose={() => setIsShoppingModalOpen(false)}
        onToggleComplete={toggleShoppingItem}
        onDeleteItem={deleteShoppingItem}
        onAddItem={(text) => addShoppingItem(text)}
        onClearCompleted={clearCompletedShopping}
        onClearAll={clearAllShopping}
        showToast={showToast}
      />

      {/* Backup and Restore Modal - 관리자 전용 */}
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

      {/* Calorie Batch Analysis & Management Modal - 관리자 전용 */}
      {isAdmin && (
        <AdminCalorieModal
          isOpen={isAdminCalorieModalOpen}
          recipes={recipes}
          onClose={() => setIsAdminCalorieModalOpen(false)}
          onSaveRecipe={handleSaveRecipe}
          showToast={showToast}
        />
      )}

      {/* AI Recipe Import Modal - 관리자 전용 */}
      <ImportRecipeModal
        isOpen={isImportModalOpen}
        existingRecipes={recipes}
        onClose={() => setIsImportModalOpen(false)}
        onSaveRecipe={handleSaveRecipe}
        onOpenDirectRegister={() => {
          setIsImportModalOpen(false);
          setRecipeToEdit(null);
          setIsFormModalOpen(true);
        }}
        showToast={showToast}
        isAdmin={isAdmin}
      />

      {/* Today Menu Recommendation & Roulette Modal */}
      <TodayMenuModal
        isOpen={isTodayMenuModalOpen}
        onClose={() => setIsTodayMenuModalOpen(false)}
        allRecipes={recipes}
        bookmarkedIds={bookmarkedIds}
        onOpenRecipeDetail={(recipe) => {
          setIsTodayMenuModalOpen(false);
          handleOpenDetail(recipe);
        }}
        onAddToMealPlan={(recipe, targetDate) => {
          handleAddRecipeToMealPlan(recipe, targetDate);
        }}
        showToast={showToast}
      />

      {/* Family Share Space Modal (Cloud Firestore) */}
      <FamilyShareModal
        isOpen={isFamilyShareModalOpen}
        onClose={() => setIsFamilyShareModalOpen(false)}
        user={user}
        onLogin={handleGoogleLogin}
        familyProfile={familyProfile}
        activeFamily={activeFamily}
        members={familyMembers}
        sharedRecipeIds={sharedRecipeIds}
        familyMealPlanEntries={familyMealPlanEntries}
        familyShoppingItems={familyShoppingItems}
        allRecipes={recipes}
        isFamilyOwner={isFamilyOwner}
        isSyncing={isFamilySyncing}
        syncError={familySyncError}
        isCreating={isFamilyCreating}
        isJoining={isFamilyJoining}
        isLeaving={isFamilyLeaving}
        onCreateFamily={createFamily}
        onJoinFamily={joinFamily}
        onLeaveFamily={leaveFamily}
        onUnshareRecipe={unshareRecipe}
        onTransferOwnership={transferFamilyOwnership}
        onDeleteFamilySpace={deleteFamilySpace}
        onUpdateProfile={updateFamilyUserProfile}
        onSelectRecipe={(recipe) => {
          setIsFamilyShareModalOpen(false);
          handleOpenDetail(recipe);
        }}
        showToast={showToast}
      />

      {/* Cloud Data Migration & Sync Modal */}
      <CloudMigrationModal
        isOpen={migrationModal.isOpen}
        onClose={() => setMigrationModal((prev) => ({ ...prev, isOpen: false }))}
        mode={migrationModal.mode}
        localCount={migrationModal.localRecipeCount}
        cloudCount={migrationModal.cloudRecipeCount}
        isMigrating={migrationModal.isMigrating}
        onUploadLocal={handleUploadLocalToCloud}
        onUseCloud={handleUseCloudOnly}
        onMerge={handleMergeLocalAndCloud}
      />

      {/* PWA Direct Installation & Help Modal */}
      <PwaInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        pwaEnv={pwaEnv}
      />

      {/* Reusable Confirm Dialog Modal */}
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        isDestructive={confirmDialog.isDestructive}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Footer */}
      <Footer />
    </div>
  );
}
