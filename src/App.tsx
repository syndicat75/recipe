/**
 * @file src/App.tsx
 * @description 내 입맛 레시피 메인 애플리케이션 컴포넌트, 전역 상태 관리 및 서브 컴포넌트 조율
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FilterCategory, Recipe, ShoppingItem, SortOption, ToastMessage } from './types/recipe';
import { INITIAL_RECIPES } from './data/initialRecipes';
import { CATEGORY_LIST } from './config/appConfig';
import {
  getSavedBookmarks,
  saveBookmarks,
  getSavedCustomRecipes,
  saveCustomRecipes,
  getSavedShoppingList,
  saveShoppingList,
  getSavedRecipeNotes,
  saveRecipeNote,
} from './utils/storage';
import { logger } from './utils/logger';

// Sub Components
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { SearchBar } from './components/SearchBar';
import { CategoryFilter } from './components/CategoryFilter';
import { RecipeList } from './components/RecipeList';
import { RecipeDetailModal } from './components/RecipeDetailModal';
import { CookingModeModal } from './components/CookingModeModal';
import { AddRecipeModal } from './components/AddRecipeModal';
import { ShoppingListModal } from './components/ShoppingListModal';
import { TimerWidget } from './components/TimerWidget';
import { AboutSection } from './components/AboutSection';
import { Footer } from './components/Footer';
import { Toast } from './components/Toast';

/**
 * 최상위 App 컴포넌트
 */
export default function App(): React.JSX.Element {
  // Recipes state (Initial + User Custom)
  const [customRecipes, setCustomRecipes] = useState<Recipe[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<number[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [userNotes, setUserNotes] = useState<Record<number, string>>({});

  // Filtering & Sorting
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('전체');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOption, setSortOption] = useState<SortOption>('default');

  // Modals & Widgets
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [cookingModeRecipe, setCookingModeRecipe] = useState<Recipe | null>(null);
  const [cookingMultiplier, setCookingMultiplier] = useState<number>(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isShoppingModalOpen, setIsShoppingModalOpen] = useState<boolean>(false);
  const [isTimerOpen, setIsTimerOpen] = useState<boolean>(false);

  // Toast System
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  /**
   * 토스트 알림 메시지를 표시합니다.
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

  // 로컬스토리지 데이터 초기 로드
  useEffect(() => {
    logger.info('App.useEffect', '앱 데이터 초기 로드 시작');
    const bookmarks = getSavedBookmarks();
    const customs = getSavedCustomRecipes();
    const shopping = getSavedShoppingList();
    const notes = getSavedRecipeNotes();

    setBookmarkedIds(bookmarks);
    setCustomRecipes(customs);
    setShoppingList(shopping);
    setUserNotes(notes);
  }, []);

  // 전체 레시피 목록 합성
  const allRecipes = useMemo((): Recipe[] => {
    logger.debug('App.useMemo(allRecipes)', '전체 레시피 목록 병합');
    return [...customRecipes, ...INITIAL_RECIPES];
  }, [customRecipes]);

  // 카테고리별 개수 맵 계산
  const categoryCounts = useMemo((): Record<string, number> => {
    logger.debug('App.useMemo(categoryCounts)', '카테고리별 레시피 개수 계산');
    const counts: Record<string, number> = {};
    CATEGORY_LIST.forEach((cat) => {
      counts[cat] = allRecipes.filter((r) => r.category === cat).length;
    });
    return counts;
  }, [allRecipes]);

  // 검색 및 필터링 적용된 레시피 목록 계산
  const filteredAndSortedRecipes = useMemo((): Recipe[] => {
    logger.info('App.useMemo(filteredAndSortedRecipes)', '레시피 필터링 및 정렬 실행', {
      category: activeCategory,
      query: searchQuery,
      sort: sortOption,
    });

    const q = searchQuery.trim().toLowerCase();

    const filtered = allRecipes.filter((r) => {
      // 1. 카테고리 필터
      if (activeCategory === '즐겨찾기') {
        if (!bookmarkedIds.includes(r.id)) return false;
      } else if (activeCategory !== '전체') {
        if (r.category !== activeCategory) return false;
      }

      // 2. 검색어 필터
      if (q) {
        const fullText = `${r.name} ${r.ingredients} ${r.method || ''}`.toLowerCase();
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
      if (sortOption === 'ingredientsAsc') {
        return a.ingredientCount - b.ingredientCount;
      }
      if (sortOption === 'ingredientsDesc') {
        return b.ingredientCount - a.ingredientCount;
      }
      return 0; // 기본 순서
    });
  }, [allRecipes, activeCategory, searchQuery, bookmarkedIds, sortOption]);

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
      showToast(isExisting ? '⭐ 즐겨찾기에서 제거되었습니다.' : '⭐ 즐겨찾기에 추가되었습니다!');
      return next;
    });
  }, [showToast]);

  /**
   * 커스텀 레시피 등록 핸들러
   * @param recipe 새 레시피 데이터
   */
  const handleSaveCustomRecipe = useCallback((recipe: Recipe): void => {
    logger.info('App.handleSaveCustomRecipe', `커스텀 레시피 저장: ${recipe.name}`);
    setCustomRecipes((prev) => {
      const next = [recipe, ...prev];
      saveCustomRecipes(next);
      return next;
    });
  }, []);

  /**
   * 장보기 목록에 여러 재료 일괄 추가 핸들러
   * @param items 재료 문자열 배열
   * @param recipeName 출처 레시피명
   */
  const handleAddToShoppingList = useCallback((items: string[], recipeName: string): void => {
    logger.info('App.handleAddToShoppingList', `장보기 재료 일괄 추가: ${items.length}개 (${recipeName})`);
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
   * 장보기 단일 수동 아이템 추가 핸들러
   * @param text 아이템 텍스트
   */
  const handleAddSingleShoppingItem = useCallback((text: string): void => {
    logger.info('App.handleAddSingleShoppingItem', `장보기 단일 추가: "${text}"`);
    const newItem: ShoppingItem = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      text,
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

  return (
    <div className="min-h-screen bg-[#fffaf3] text-stone-800">
      {/* Toast Notification Container */}
      <Toast toasts={toasts} onDismiss={handleDismissToast} />

      {/* Top Header */}
      <Header
        currentCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        bookmarkCount={bookmarkedIds.length}
        shoppingCount={shoppingList.length}
        onOpenShoppingList={() => setIsShoppingModalOpen(true)}
        onOpenAddRecipe={() => setIsAddModalOpen(true)}
        onToggleTimer={() => setIsTimerOpen((prev) => !prev)}
        isTimerOpen={isTimerOpen}
      />

      <main>
        {/* Hero Section */}
        <HeroSection
          totalRecipeCount={allRecipes.length}
          categoryCount={CATEGORY_LIST.length}
          bookmarkCount={bookmarkedIds.length}
          onSelectCategory={setActiveCategory}
          onScrollToRecipes={scrollToRecipes}
        />

        {/* Recipe Finder Container */}
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-500">
                Recipe Finder
              </p>
              <h2 className="mt-2 font-soft text-2xl font-black tracking-tight text-stone-900 sm:text-3xl">
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
            totalCount={allRecipes.length}
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
          onOpenDetail={(r) => setSelectedRecipe(r)}
          onResetFilters={handleResetFilters}
        />

        {/* Features & Guide Section */}
        <AboutSection />
      </main>

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
          onAddToShoppingList={handleAddToShoppingList}
          onStartCookingMode={handleStartCookingMode}
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

      {/* Add Recipe Modal */}
      <AddRecipeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSaveRecipe={handleSaveCustomRecipe}
        showToast={showToast}
      />

      {/* Shopping List Modal */}
      <ShoppingListModal
        isOpen={isShoppingModalOpen}
        items={shoppingList}
        onClose={() => setIsShoppingModalOpen(false)}
        onToggleComplete={handleToggleShoppingComplete}
        onDeleteItem={handleDeleteShoppingItem}
        onAddItem={handleAddSingleShoppingItem}
        onClearCompleted={handleClearCompletedShopping}
        onClearAll={handleClearAllShopping}
        showToast={showToast}
      />

      {/* Kitchen Timer Widget */}
      <TimerWidget
        isOpen={isTimerOpen}
        onClose={() => setIsTimerOpen(false)}
        showToast={showToast}
      />
    </div>
  );
}
