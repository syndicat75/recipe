/**
 * @file src/components/AiMealPlanModal.tsx
 * @description 📅 AI 주간 식단표 자동 생성 및 미리보기 모달 컴포넌트.
 * 조건 설정(인원, 중복/최근 제외, 칼로리/시간 제약, 자연어 추가 요청), AI 생성 단계별 UX,
 * 생성된 식단 미리보기, 개별 메뉴 교체, 주간 칼로리 합산 및 최종 식단 적용을 지원합니다.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles,
  X,
  RotateCcw,
  Calendar,
  Clock,
  Flame,
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Dice5,
  ArrowRight,
  Bookmark,
  Shuffle,
  Info,
} from 'lucide-react';
import { Recipe, MealPlanEntry, MealSlotType } from '../types/recipe';
import {
  AiMealPlanRequestConfig,
  AiMealPlanPreviewSlot,
  AiMealPlanResponseData,
} from '../types/mealPlan';
import { APP_CONFIG } from '../config/appConfig';
import { callAiApi, AiApiResponse } from '../utils/aiApiHelper';
import {
  prepareAiCandidateRecipes,
  getRecentMealRecipeIds,
  fallbackGenerateMealPlan,
  buildPreviewSlots,
  calculateWeeklyPlanCalories,
  convertPreviewSlotsToMealPlan,
} from '../utils/mealPlanGenerator';
import { logger } from '../utils/logger';

interface AiMealPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  allRecipes: Recipe[];
  mealPlan: Record<string, MealPlanEntry[]>;
  currentWeekDates: Date[];
  currentViewMode: 'single' | 'detail';
  bookmarkedRecipeIds?: number[];
  onApplyMealPlan: (updatedPlan: Record<string, MealPlanEntry[]>) => void;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'];

const PROMPT_SUGGESTION_CHIPS = [
  '평일은 20분 내 간단 요리, 주말은 특별하게',
  '매운 음식은 주 2회 이하로 구성해줘',
  '금요일 저녁은 면·국수 요리로 배치해줘',
  '단백질이 풍부한 고기·계란 위주 식단',
  '기름지지 않고 담백하고 소화 잘되는 메뉴',
];

const LOADING_MESSAGES = [
  '✨ 내 레시피를 살펴보고 있어요...',
  '🍽️ 메뉴 조합과 영양 균형을 맞추고 있어요...',
  '📅 요일별 식단을 보기 쉽게 정리하고 있어요...',
  '👨‍🍳 맛있는 일주일 식단을 완성하고 있어요...',
];

const SLOT_LABELS: Record<MealSlotType, { label: string; icon: string }> = {
  single: { label: '오늘의 메뉴', icon: '🍽️' },
  breakfast: { label: '아침', icon: '🌅' },
  lunch: { label: '점심', icon: '☀️' },
  dinner: { label: '저녁', icon: '🌙' },
};

/**
 * AI 주간 식단표 생성 모달
 */
export const AiMealPlanModal: React.FC<AiMealPlanModalProps> = ({
  isOpen,
  onClose,
  allRecipes,
  mealPlan,
  currentWeekDates,
  currentViewMode,
  bookmarkedRecipeIds = [],
  onApplyMealPlan,
  showToast,
}) => {
  // 모달 스텝 ('config' | 'preview')
  const [step, setStep] = useState<'config' | 'preview'>('config');

  // 상세 조건 아코디언 토글
  const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(false);

  // 로딩 상태 및 메시지 인덱스
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [loadingMessageIdx, setLoadingMessageIdx] = useState<number>(0);

  // 1. 설정 상태
  const [mode, setMode] = useState<'single' | 'detail'>(currentViewMode || 'single');
  const [selectedDayIndices, setSelectedDayIndices] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [servings, setServings] = useState<number>(2);
  const [fillMode, setFillMode] = useState<'emptyOnly' | 'replaceWeek'>('emptyOnly');

  // 옵션
  const [noDuplicates, setNoDuplicates] = useState<boolean>(true);
  const [excludeRecent, setExcludeRecent] = useState<boolean>(true);
  const [diverseCategories, setDiverseCategories] = useState<boolean>(true);
  const [prioritizeBookmarks, setPrioritizeBookmarks] = useState<boolean>(false);

  // 칼로리 & 조리시간
  const [calorieLimitOption, setCalorieLimitOption] = useState<'none' | 'limit'>('none');
  const [maxCaloriesInput, setMaxCaloriesInput] = useState<number>(700);
  const [strictCalories, setStrictCalories] = useState<boolean>(false);

  const [cookingTimeOption, setCookingTimeOption] = useState<'none' | '15' | '30' | '45' | 'custom'>('none');
  const [customCookingTimeInput, setCustomCookingTimeInput] = useState<number>(20);

  // 자연어 요청
  const [customPrompt, setCustomPrompt] = useState<string>('');

  // 2. 미리보기 상태
  const [previewSlots, setPreviewSlots] = useState<AiMealPlanPreviewSlot[]>([]);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [activeConfig, setActiveConfig] = useState<AiMealPlanRequestConfig | null>(null);

  // 개별 슬롯 수동 교체 모달 상태
  const [changingSlotKey, setChangingSlotKey] = useState<string | null>(null);

  // 최근 식단에 사용된 레시피 수 계산
  const recentRecipeIds = useMemo(() => {
    return getRecentMealRecipeIds(mealPlan, new Date(), 14);
  }, [mealPlan]);

  // 로딩 메시지 순환 타이머
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isGenerating) {
      timer = setInterval(() => {
        setLoadingMessageIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 2200);
    } else {
      setLoadingMessageIdx(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isGenerating]);

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      setStep('config');
      setMode(currentViewMode || 'single');
      setSelectedDayIndices([0, 1, 2, 3, 4, 5, 6]);
      setFillMode('emptyOnly');
      setIsGenerating(false);
      setChangingSlotKey(null);
    }
  }, [isOpen, currentViewMode]);

  /**
   * Date 객체를 'YYYY-MM-DD' 형식 문자열로 변환
   */
  const formatDateKey = useCallback((d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
  }, []);

  // 선택된 날짜 키 목록
  const targetDateKeys = useMemo(() => {
    return selectedDayIndices
      .sort((a, b) => a - b)
      .map((idx) => {
        const d = currentWeekDates[idx];
        return d ? formatDateKey(d) : '';
      })
      .filter(Boolean);
  }, [selectedDayIndices, currentWeekDates, formatDateKey]);

  /**
   * 요일 선택 토글 핸들러
   */
  const handleToggleDay = (idx: number): void => {
    logger.debug('AiMealPlanModal.handleToggleDay', `요일 토글: ${DAY_NAMES[idx]}`);
    if (selectedDayIndices.includes(idx)) {
      if (selectedDayIndices.length === 1) {
        showToast('최소 1개 이상의 요일을 선택해야 합니다.', 'info');
        return;
      }
      setSelectedDayIndices(selectedDayIndices.filter((i) => i !== idx));
    } else {
      setSelectedDayIndices([...selectedDayIndices, idx]);
    }
  };

  /**
   * 전체 요일 선택 / 해제
   */
  const handleSelectAllDays = (): void => {
    logger.info('AiMealPlanModal.handleSelectAllDays', '전체 요일 선택');
    setSelectedDayIndices([0, 1, 2, 3, 4, 5, 6]);
  };

  /**
   * 평일만 선택 (월~금)
   */
  const handleSelectWeekdaysOnly = (): void => {
    logger.info('AiMealPlanModal.handleSelectWeekdaysOnly', '평일만 선택');
    setSelectedDayIndices([0, 1, 2, 3, 4]);
  };

  /**
   * 조리시간 상한값 계산
   */
  const resolveMaxCookingTime = (): number | null => {
    if (cookingTimeOption === '15') return 15;
    if (cookingTimeOption === '30') return 30;
    if (cookingTimeOption === '45') return 45;
    if (cookingTimeOption === 'custom') return customCookingTimeInput > 0 ? customCookingTimeInput : null;
    return null;
  };

  /**
   * 칼로리 상한값 계산
   */
  const resolveMaxCalories = (): number | null => {
    if (calorieLimitOption === 'limit' && maxCaloriesInput > 0) {
      return maxCaloriesInput;
    }
    return null;
  };

  /**
   * AI 식단 생성 실행
   */
  const handleGenerateMealPlan = async (): Promise<void> => {
    logger.info('AiMealPlanModal.handleGenerateMealPlan', `AI 주간 식단 생성 요청 시작 (모드: ${mode})`);

    if (allRecipes.length === 0) {
      showToast('등록된 레시피가 없습니다. 먼저 레시피를 등록해주세요.', 'error');
      return;
    }

    if (targetDateKeys.length === 0) {
      showToast('식단을 생성할 요일을 최소 1개 이상 선택해주세요.', 'info');
      return;
    }

    const config: AiMealPlanRequestConfig = {
      mode,
      dates: targetDateKeys,
      servings,
      noDuplicates,
      excludeRecent,
      diverseCategories,
      prioritizeBookmarks,
      maxCaloriesPerServing: resolveMaxCalories(),
      strictCalories,
      maxCookingTimeMinutes: resolveMaxCookingTime(),
      customPrompt: customPrompt.trim(),
      fillMode,
    };

    setActiveConfig(config);
    setIsGenerating(true);

    try {
      // 1. 최소 정보만 포함된 Candidate 레시피 목록 준비 (이미지 Base64 배제)
      const candidateRecipes = prepareAiCandidateRecipes(allRecipes, bookmarkedRecipeIds);

      // 2. AI 엔드포인트 호출
      const endpoint = APP_CONFIG.ai.generateMealPlanEndpoint || '/api/ai/generate-meal-plan';
      const payload = {
        config,
        candidateRecipes,
        recentMealRecipeIds: excludeRecent ? recentRecipeIds : [],
        requestId: `meal-plan-client-${Date.now()}`,
      };

      const response: AiApiResponse<AiMealPlanResponseData> = await callAiApi(
        endpoint,
        payload,
        1.5,
        35000
      );

      if (response.success && response.data && Array.isArray(response.data.plan) && response.data.plan.length > 0) {
        // 서버 응답 수신 성공
        logger.info(
          'AiMealPlanModal.handleGenerateMealPlan',
          `AI 식단 생성 성공: ${response.data.plan.length}개 슬롯 제안`
        );

        // 클라이언트에서 2차 검증 및 미리보기 슬롯 구성
        const slots = buildPreviewSlots(config, response.data.plan, mealPlan, allRecipes);
        setPreviewSlots(slots);
        setAiSummary(response.data.summary || '일주일간의 맞춤 식단을 구성했습니다.');
        setStep('preview');
        showToast('AI 주간 식단이 추천되었습니다! 미리보기를 확인해주세요.', 'success');
      } else {
        // 실패 시 클라이언트 휴리스틱 fallback 자동 적용 여부 확인
        const errorMsg = response.error || 'AI 응답이 올바르지 않습니다.';
        logger.warn('AiMealPlanModal.handleGenerateMealPlan', `AI 생성 실패 (${errorMsg}) -> 오프라인 Fallback 실행`);

        const fallbackResult = fallbackGenerateMealPlan(config, allRecipes, recentRecipeIds, mealPlan);
        const slots = buildPreviewSlots(config, fallbackResult.plan, mealPlan, allRecipes);
        setPreviewSlots(slots);
        setAiSummary(`[스마트 자동 생성] ${fallbackResult.summary}`);
        setStep('preview');
        showToast('AI 서버 응답 지연으로 내 레시피 기반 스마트 자동 채우기가 적용되었습니다.', 'info');
      }
    } catch (error) {
      logger.error('AiMealPlanModal.handleGenerateMealPlan', '식단 생성 중 에러 발생', error);
      // 에러 발생 시에도 기존 식단은 100% 안전하게 보존되며 fallback 시도 가능
      const fallbackResult = fallbackGenerateMealPlan(config, allRecipes, recentRecipeIds, mealPlan);
      const slots = buildPreviewSlots(config, fallbackResult.plan, mealPlan, allRecipes);
      setPreviewSlots(slots);
      setAiSummary(`[스마트 자동 생성] ${fallbackResult.summary}`);
      setStep('preview');
      showToast('AI 식단 생성에 실패하여 스마트 자동 채우기가 적용되었습니다. 기존 식단은 변경되지 않았습니다.', 'info');
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * AI 없이 오프라인 스마트 자동 채우기 즉시 실행
   */
  const handleOfflineGenerate = (): void => {
    logger.info('AiMealPlanModal.handleOfflineGenerate', 'AI 미사용 스마트 자동 채우기 실행');

    if (allRecipes.length === 0) {
      showToast('등록된 레시피가 없습니다.', 'error');
      return;
    }

    const config: AiMealPlanRequestConfig = {
      mode,
      dates: targetDateKeys,
      servings,
      noDuplicates,
      excludeRecent,
      diverseCategories,
      prioritizeBookmarks,
      maxCaloriesPerServing: resolveMaxCalories(),
      strictCalories,
      maxCookingTimeMinutes: resolveMaxCookingTime(),
      customPrompt: customPrompt.trim(),
      fillMode,
    };

    setActiveConfig(config);
    const fallbackResult = fallbackGenerateMealPlan(config, allRecipes, recentRecipeIds, mealPlan);
    const slots = buildPreviewSlots(config, fallbackResult.plan, mealPlan, allRecipes);
    setPreviewSlots(slots);
    setAiSummary(`[스마트 자동 생성] ${fallbackResult.summary}`);
    setStep('preview');
    showToast('스마트 자동 식단이 생성되었습니다.', 'success');
  };

  /**
   * 미리보기에서 특정 슬롯의 메뉴를 다른 레시피로 랜덤 교체
   * @param slotKey 'date_slot'
   */
  const handleRandomShuffleSlot = (slotKey: string): void => {
    logger.info('AiMealPlanModal.handleRandomShuffleSlot', `슬롯 랜덤 교체: ${slotKey}`);

    const [date, slot] = slotKey.split('_') as [string, MealSlotType];
    const targetSlot = previewSlots.find((s) => s.date === date && s.slot === slot);
    if (!targetSlot) return;

    // 이미 식단에 사용 중인 ID 목록
    const usedIds = new Set(previewSlots.map((s) => s.recipeId));

    // 후보 레시피 중 다른 레시피 필터링
    let pool = allRecipes.filter((r) => r.id !== targetSlot.recipeId);
    if (pool.length === 0) {
      showToast('교체할 다른 레시피가 없습니다.', 'info');
      return;
    }

    // 가능하면 아직 이번 식단에 안 쓰인 레시피 우선
    const unusedPool = pool.filter((r) => !usedIds.has(r.id));
    const finalPool = unusedPool.length > 0 ? unusedPool : pool;

    const randomPick = finalPool[Math.floor(Math.random() * finalPool.length)];

    setPreviewSlots((prev) =>
      prev.map((s) => {
        if (s.date === date && s.slot === slot) {
          return {
            ...s,
            recipeId: randomPick.id,
            isPreservedFromExisting: false,
          };
        }
        return s;
      })
    );

    showToast(`'${randomPick.name}' 요리로 교체되었습니다.`, 'success');
  };

  /**
   * 미리보기에서 특정 슬롯의 인분 수 변경
   */
  const handleChangeSlotServings = (slotKey: string, delta: number): void => {
    const [date, slot] = slotKey.split('_') as [string, MealSlotType];
    setPreviewSlots((prev) =>
      prev.map((s) => {
        if (s.date === date && s.slot === slot) {
          const current = s.servings || 2;
          const next = Math.max(1, Math.min(20, current + delta));
          return { ...s, servings: next };
        }
        return s;
      })
    );
  };

  /**
   * 특정 슬롯 수동 레시피 선택 적용
   */
  const handleSelectManualRecipe = (slotKey: string, newRecipeId: number): void => {
    logger.info('AiMealPlanModal.handleSelectManualRecipe', `수동 레시피 선택 적용: ${slotKey} -> ID ${newRecipeId}`);
    const [date, slot] = slotKey.split('_') as [string, MealSlotType];

    setPreviewSlots((prev) =>
      prev.map((s) => {
        if (s.date === date && s.slot === slot) {
          return {
            ...s,
            recipeId: newRecipeId,
            isPreservedFromExisting: false,
          };
        }
        return s;
      })
    );
    setChangingSlotKey(null);
    const chosen = allRecipes.find((r) => r.id === newRecipeId);
    if (chosen) {
      showToast(`'${chosen.name}' 요리가 적용되었습니다.`, 'success');
    }
  };

  /**
   * 최종 식단 적용 버튼 클릭 핸들러
   */
  const handleApplyFinalPlan = (): void => {
    logger.info('AiMealPlanModal.handleApplyFinalPlan', `식단 최종 적용: ${previewSlots.length}개 슬롯`);

    if (previewSlots.length === 0) {
      showToast('적용할 식단 항목이 없습니다.', 'info');
      return;
    }

    const currentConfig = activeConfig || {
      mode,
      dates: targetDateKeys,
      servings,
      noDuplicates,
      excludeRecent,
      diverseCategories,
      prioritizeBookmarks,
      maxCaloriesPerServing: resolveMaxCalories(),
      strictCalories,
      maxCookingTimeMinutes: resolveMaxCookingTime(),
      customPrompt,
      fillMode,
    };

    const updatedMealPlan = convertPreviewSlotsToMealPlan(
      previewSlots,
      mealPlan,
      currentConfig.dates,
      currentConfig.fillMode
    );

    onApplyMealPlan(updatedMealPlan);
    showToast('✨ AI 주간 식단이 성공적으로 적용되었습니다!', 'success');
    onClose();
  };

  // 주간 칼로리 통계 계산
  const caloriesSummary = useMemo(() => {
    return calculateWeeklyPlanCalories(previewSlots, allRecipes);
  }, [previewSlots, allRecipes]);

  // 레시피 ID로 Recipe 객체 빠르게 조회용 Map
  const recipeMap = useMemo(() => {
    const map = new Map<number, Recipe>();
    allRecipes.forEach((r) => map.set(r.id, r));
    return map;
  }, [allRecipes]);

  if (!isOpen) return null;

  return (
    <div
      id="ai-meal-plan-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-xs transition-opacity duration-200 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div
        id="ai-meal-plan-modal-content"
        className="relative flex flex-col w-full max-w-2xl max-h-[92vh] rounded-3xl bg-white shadow-2xl ring-1 ring-stone-900/10 overflow-hidden my-auto"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-stone-100 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-yellow-500/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-md shadow-orange-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-soft text-lg font-black text-stone-900 sm:text-xl">
                  {step === 'config' ? '✨ AI 주간 식단 만들기' : '✨ AI 추천 식단 미리보기'}
                </h2>
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-800">
                  {step === 'config' ? '맞춤 설정' : '검토 및 적용'}
                </span>
              </div>
              <p className="text-xs font-medium text-stone-600">
                {step === 'config'
                  ? '내 레시피 중에서 최적의 일주일 메뉴를 AI가 균형 있게 맞춰드립니다.'
                  : '메뉴를 확인하고 필요시 개별 교체한 후 이번 주 식단에 적용하세요.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="flex h-9 w-9 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700 active:scale-95 disabled:opacity-50"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STEP 1: 설정 화면 */}
          {step === 'config' && (
            <div className="space-y-6">
              {/* 1. 식단 구성 모드 */}
              <div className="space-y-2">
                <label className="font-soft text-xs font-bold text-stone-700">식단 구성 모드</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMode('single')}
                    className={`flex items-center justify-center gap-2 rounded-2xl border p-3.5 text-xs font-bold transition-all ${
                      mode === 'single'
                        ? 'border-orange-500 bg-orange-50/80 text-orange-950 ring-2 ring-orange-500/20'
                        : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <span className="text-base">🍽️</span>
                    <div className="text-left">
                      <p className="font-soft font-bold">하루 1메뉴 (간단)</p>
                      <p className="text-[11px] font-normal text-stone-500">하루 대표 메뉴 1개씩 계획</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('detail')}
                    className={`flex items-center justify-center gap-2 rounded-2xl border p-3.5 text-xs font-bold transition-all ${
                      mode === 'detail'
                        ? 'border-orange-500 bg-orange-50/80 text-orange-950 ring-2 ring-orange-500/20'
                        : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <span className="text-base">🌅☀️🌙</span>
                    <div className="text-left">
                      <p className="font-soft font-bold">아침 / 점심 / 저녁</p>
                      <p className="text-[11px] font-normal text-stone-500">하루 3끼 상세 식단 계획</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. 만들 요일 선택 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-soft text-xs font-bold text-stone-700">식단 만들 요일</label>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={handleSelectAllDays}
                      className="text-orange-600 hover:underline font-medium"
                    >
                      전체 요일
                    </button>
                    <span className="text-stone-300">|</span>
                    <button
                      type="button"
                      onClick={handleSelectWeekdaysOnly}
                      className="text-stone-500 hover:underline font-medium"
                    >
                      평일만(월~금)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {DAY_NAMES.map((dayName, idx) => {
                    const isSelected = selectedDayIndices.includes(idx);
                    const d = currentWeekDates[idx];
                    const dateNum = d ? d.getDate() : '';

                    return (
                      <button
                        key={dayName}
                        type="button"
                        onClick={() => handleToggleDay(idx)}
                        className={`flex flex-col items-center justify-center py-2.5 rounded-2xl border text-xs font-bold transition-all active:scale-95 ${
                          isSelected
                            ? 'border-orange-500 bg-orange-500 text-white shadow-xs'
                            : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                        }`}
                      >
                        <span className="text-xs font-soft">{dayName}</span>
                        <span className={`text-[10px] font-normal mt-0.5 ${isSelected ? 'text-orange-100' : 'text-stone-400'}`}>
                          {dateNum ? `${dateNum}일` : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. 기본 인원 및 기존 식단 처리 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 기본 식사 인원 */}
                <div className="space-y-2">
                  <label className="font-soft text-xs font-bold text-stone-700">기본 식사 인원</label>
                  <div className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-2">
                    <span className="text-xs font-medium text-stone-600 pl-2">기준 인분</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setServings(Math.max(1, servings - 1))}
                        className="flex h-7 w-7 items-center justify-center rounded-xl bg-stone-100 font-bold text-stone-700 hover:bg-stone-200 active:scale-95"
                      >
                        -
                      </button>
                      <span className="font-soft text-sm font-black text-stone-900 w-8 text-center">
                        {servings}인
                      </span>
                      <button
                        type="button"
                        onClick={() => setServings(Math.min(20, servings + 1))}
                        className="flex h-7 w-7 items-center justify-center rounded-xl bg-stone-100 font-bold text-stone-700 hover:bg-stone-200 active:scale-95"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* 현재 식단 처리 방식 */}
                <div className="space-y-2">
                  <label className="font-soft text-xs font-bold text-stone-700">현재 식단 처리</label>
                  <div className="flex flex-col gap-1.5 rounded-2xl border border-stone-200 bg-stone-50/50 p-2 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="fillMode"
                        checked={fillMode === 'emptyOnly'}
                        onChange={() => setFillMode('emptyOnly')}
                        className="text-orange-500 focus:ring-orange-500"
                      />
                      <span className="font-bold text-stone-800">빈 날짜만 채우기 (권장)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="fillMode"
                        checked={fillMode === 'replaceWeek'}
                        onChange={() => setFillMode('replaceWeek')}
                        className="text-orange-500 focus:ring-orange-500"
                      />
                      <span className="text-stone-600">이번 주 전체를 새로 교체</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* 4. 추천 기본 조건 */}
              <div className="space-y-2">
                <label className="font-soft text-xs font-bold text-stone-700">메뉴 선택 기본 기준</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex items-center gap-2.5 rounded-2xl border border-stone-200 bg-white p-3 cursor-pointer hover:bg-stone-50 text-xs">
                    <input
                      type="checkbox"
                      checked={noDuplicates}
                      onChange={(e) => setNoDuplicates(e.target.checked)}
                      className="rounded text-orange-500 focus:ring-orange-500 h-4 w-4"
                    />
                    <span className="font-medium text-stone-800">같은 메뉴 중복 최소화</span>
                  </label>

                  <label className="flex items-center gap-2.5 rounded-2xl border border-stone-200 bg-white p-3 cursor-pointer hover:bg-stone-50 text-xs">
                    <input
                      type="checkbox"
                      checked={excludeRecent}
                      onChange={(e) => setExcludeRecent(e.target.checked)}
                      className="rounded text-orange-500 focus:ring-orange-500 h-4 w-4"
                    />
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-stone-800">최근 먹은 메뉴 제외</span>
                      {recentRecipeIds.length > 0 && (
                        <span className="rounded-full bg-stone-100 px-1.5 py-0.2 text-[10px] text-stone-500">
                          {recentRecipeIds.length}개
                        </span>
                      )}
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 rounded-2xl border border-stone-200 bg-white p-3 cursor-pointer hover:bg-stone-50 text-xs">
                    <input
                      type="checkbox"
                      checked={diverseCategories}
                      onChange={(e) => setDiverseCategories(e.target.checked)}
                      className="rounded text-orange-500 focus:ring-orange-500 h-4 w-4"
                    />
                    <span className="font-medium text-stone-800">다양한 카테고리로 구성</span>
                  </label>

                  <label className="flex items-center gap-2.5 rounded-2xl border border-stone-200 bg-white p-3 cursor-pointer hover:bg-stone-50 text-xs">
                    <input
                      type="checkbox"
                      checked={prioritizeBookmarks}
                      onChange={(e) => setPrioritizeBookmarks(e.target.checked)}
                      className="rounded text-orange-500 focus:ring-orange-500 h-4 w-4"
                    />
                    <span className="font-medium text-stone-800 flex items-center gap-1">
                      <span>⭐ 즐겨찾기 레시피 우선</span>
                    </span>
                  </label>
                </div>
              </div>

              {/* 5. 상세 조건 접기/펼치기 Accordion */}
              <div className="rounded-2xl border border-stone-200 bg-stone-50/50 p-4 space-y-4">
                <button
                  type="button"
                  onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                  className="flex w-full items-center justify-between text-xs font-bold text-stone-700"
                >
                  <span className="flex items-center gap-1.5 font-soft">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span>상세 조건 설정 (칼로리 / 조리시간)</span>
                  </span>
                  {showAdvancedOptions ? (
                    <ChevronUp className="h-4 w-4 text-stone-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-stone-400" />
                  )}
                </button>

                {showAdvancedOptions && (
                  <div className="space-y-4 pt-2 border-t border-stone-200/60 text-xs">
                    {/* 칼로리 조건 */}
                    <div className="space-y-2">
                      <label className="font-soft font-bold text-stone-700">1인분 예상 칼로리 제한</label>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="calOption"
                            checked={calorieLimitOption === 'none'}
                            onChange={() => setCalorieLimitOption('none')}
                            className="text-orange-500 focus:ring-orange-500"
                          />
                          <span>제한 없음</span>
                        </label>

                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="calOption"
                            checked={calorieLimitOption === 'limit'}
                            onChange={() => setCalorieLimitOption('limit')}
                            className="text-orange-500 focus:ring-orange-500"
                          />
                          <span>최대</span>
                          <input
                            type="number"
                            value={maxCaloriesInput}
                            onChange={(e) => setMaxCaloriesInput(Number(e.target.value))}
                            disabled={calorieLimitOption !== 'limit'}
                            className="w-20 rounded-xl border border-stone-200 bg-white px-2 py-1 text-center font-bold text-stone-800 disabled:opacity-50"
                            min="200"
                            max="2000"
                            step="50"
                          />
                          <span>kcal</span>
                        </label>
                      </div>

                      {calorieLimitOption === 'limit' && (
                        <label className="flex items-center gap-2 cursor-pointer mt-1 pl-1">
                          <input
                            type="checkbox"
                            checked={strictCalories}
                            onChange={(e) => setStrictCalories(e.target.checked)}
                            className="rounded text-orange-500 focus:ring-orange-500 h-3.5 w-3.5"
                          />
                          <span className="text-[11px] text-stone-600">
                            칼로리 정보가 등록된 레시피를 우선 적용
                          </span>
                        </label>
                      )}
                    </div>

                    {/* 조리시간 조건 */}
                    <div className="space-y-2 pt-2 border-t border-stone-200/40">
                      <label className="font-soft font-bold text-stone-700">조리시간 제한</label>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="cookOption"
                            checked={cookingTimeOption === 'none'}
                            onChange={() => setCookingTimeOption('none')}
                            className="text-orange-500 focus:ring-orange-500"
                          />
                          <span>제한 없음</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="cookOption"
                            checked={cookingTimeOption === '15'}
                            onChange={() => setCookingTimeOption('15')}
                            className="text-orange-500 focus:ring-orange-500"
                          />
                          <span>15분 이하</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="cookOption"
                            checked={cookingTimeOption === '30'}
                            onChange={() => setCookingTimeOption('30')}
                            className="text-orange-500 focus:ring-orange-500"
                          />
                          <span>30분 이하</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="cookOption"
                            checked={cookingTimeOption === '45'}
                            onChange={() => setCookingTimeOption('45')}
                            className="text-orange-500 focus:ring-orange-500"
                          />
                          <span>45분 이하</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 6. 자연어 추가 요청 */}
              <div className="space-y-2">
                <label className="font-soft text-xs font-bold text-stone-700">
                  자연어 추가 요청 (선택)
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="예: 매운 음식은 2번 이하로, 금요일은 면요리, 주말은 조금 특별하게 고기 요리로"
                  rows={2}
                  className="w-full rounded-2xl border border-stone-200 bg-white p-3 text-xs text-stone-800 placeholder-stone-400 focus:border-orange-500 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20"
                />

                {/* 제안 칩 */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {PROMPT_SUGGESTION_CHIPS.slice(0, 3).map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setCustomPrompt(chip)}
                      className="rounded-xl border border-stone-200 bg-white px-2.5 py-1 text-[11px] text-stone-600 hover:bg-stone-50 active:scale-95 transition-all text-left"
                    >
                      💡 {chip}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: 미리보기 화면 */}
          {step === 'preview' && (
            <div className="space-y-6">
              {/* AI 요약 설명 카드 */}
              {aiSummary && (
                <div className="rounded-2xl border border-orange-200/80 bg-orange-50/70 p-4 shadow-xs">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-soft text-xs font-bold text-orange-950">AI 추천 구성 안내</h4>
                      <p className="text-xs text-stone-700 mt-1 leading-relaxed">{aiSummary}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 주간 칼로리 요약 바 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl border border-stone-200 bg-white p-4 shadow-xs gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                    <Flame className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-soft text-xs font-bold text-stone-900">
                      예상 주간 총 칼로리 (1인 기준)
                    </p>
                    <p className="text-sm font-black text-orange-600 sm:text-base">
                      약 {caloriesSummary.totalCaloriesPerPerson.toLocaleString()} kcal
                    </p>
                  </div>
                </div>

                <div className="text-[11px] text-stone-500 sm:text-right">
                  <span>분석 완료 {caloriesSummary.analyzedCount}개 메뉴</span>
                  {caloriesSummary.uncalculatedCount > 0 && (
                    <span className="text-amber-700 ml-1.5 font-medium">
                      (미분석 {caloriesSummary.uncalculatedCount}개 제외)
                    </span>
                  )}
                </div>
              </div>

              {/* 요일별/슬롯별 식단 리스트 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-soft text-xs font-bold text-stone-700">구성된 식단 목록</h3>
                  <span className="text-[11px] text-stone-500">
                    🔄 버튼으로 특정 요일 메뉴를 개별 교체할 수 있습니다
                  </span>
                </div>

                <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-xs">
                  {previewSlots.map((slotItem) => {
                    const slotKey = `${slotItem.date}_${slotItem.slot}`;
                    const recipe = recipeMap.get(slotItem.recipeId);
                    const slotInfo = SLOT_LABELS[slotItem.slot] || SLOT_LABELS.single;
                    const dateObj = new Date(slotItem.date);
                    const dayNum = dateObj.getDate();
                    const monthNum = dateObj.getMonth() + 1;

                    return (
                      <div
                        key={slotKey}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 hover:bg-stone-50/80 transition-colors gap-3"
                      >
                        {/* Left: 날짜 및 슬롯 정보 */}
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-center justify-center min-w-[50px] rounded-xl bg-stone-100 py-1.5 px-2">
                            <span className="font-soft text-xs font-black text-stone-800">
                              {slotItem.dayName}요일
                            </span>
                            <span className="text-[10px] text-stone-500">
                              {monthNum}.{dayNum}
                            </span>
                          </div>

                          {mode === 'detail' && (
                            <span className="rounded-lg bg-orange-100 px-2 py-1 text-[11px] font-bold text-orange-800">
                              {slotInfo.icon} {slotInfo.label}
                            </span>
                          )}

                          {/* 요리 정보 */}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-base">{recipe?.icon || '🥘'}</span>
                              <span className="font-soft text-sm font-bold text-stone-900">
                                {recipe ? recipe.name : `레시피 ID: ${slotItem.recipeId}`}
                              </span>
                              {slotItem.isPreservedFromExisting && (
                                <span className="rounded-full bg-stone-200/80 px-1.5 py-0.2 text-[10px] font-bold text-stone-600">
                                  🔒 기존 유지
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-stone-500 mt-0.5">
                              <span className="rounded-md bg-stone-100 px-1.5 py-0.2 text-stone-600">
                                {recipe?.category || '기타'}
                              </span>
                              {recipe?.caloriesPerServing ? (
                                <span className="text-orange-600 font-medium">
                                  🔥 {recipe.caloriesPerServing} kcal
                                </span>
                              ) : null}
                              {recipe?.cookingTimeMinutes ? (
                                <span>⏱️ {recipe.cookingTimeMinutes}분</span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        {/* Right: 인분 조절 및 교체 버튼 */}
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {/* 인분 수 미세조정 */}
                          <div className="flex items-center rounded-xl border border-stone-200 bg-white px-2 py-1 text-xs">
                            <button
                              type="button"
                              onClick={() => handleChangeSlotServings(slotKey, -1)}
                              className="px-1 font-bold text-stone-500 hover:text-stone-900"
                            >
                              -
                            </button>
                            <span className="px-1.5 font-bold text-stone-800 text-[11px]">
                              {slotItem.servings || 2}인
                            </span>
                            <button
                              type="button"
                              onClick={() => handleChangeSlotServings(slotKey, 1)}
                              className="px-1 font-bold text-stone-500 hover:text-stone-900"
                            >
                              +
                            </button>
                          </div>

                          {/* 개별 랜덤 교체 */}
                          <button
                            type="button"
                            onClick={() => handleRandomShuffleSlot(slotKey)}
                            className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-bold text-stone-700 shadow-2xs hover:bg-stone-50 active:scale-95 transition-all"
                            title="다른 메뉴로 교체"
                          >
                            <Shuffle className="h-3.5 w-3.5 text-orange-500" />
                            <span>바꾸기</span>
                          </button>

                          {/* 직접 레시피 선택 토글 */}
                          <button
                            type="button"
                            onClick={() =>
                              setChangingSlotKey(changingSlotKey === slotKey ? null : slotKey)
                            }
                            className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white px-2 py-1.5 text-xs font-bold text-stone-500 hover:text-stone-900 active:scale-95"
                            title="레시피 목록에서 직접 선택"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* 직접 선택 팝다운 */}
                        {changingSlotKey === slotKey && (
                          <div className="w-full mt-2 rounded-2xl border border-orange-200 bg-orange-50/40 p-3 space-y-2">
                            <p className="font-soft text-xs font-bold text-stone-800">
                              직접 교체할 레시피 선택
                            </p>
                            <div className="max-h-40 overflow-y-auto divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
                              {allRecipes.map((r) => (
                                <button
                                  key={r.id}
                                  type="button"
                                  onClick={() => handleSelectManualRecipe(slotKey, r.id)}
                                  className={`flex w-full items-center justify-between p-2 text-left text-xs hover:bg-orange-50 transition-colors ${
                                    r.id === slotItem.recipeId ? 'bg-orange-100/70 font-bold' : ''
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span>{r.icon || '🥘'}</span>
                                    <span className="text-stone-900">{r.name}</span>
                                    <span className="text-[10px] text-stone-400">({r.category})</span>
                                  </div>
                                  {r.caloriesPerServing ? (
                                    <span className="text-[10px] text-orange-600">
                                      {r.caloriesPerServing}kcal
                                    </span>
                                  ) : null}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-stone-100 bg-stone-50 px-6 py-4">
          {/* STEP 1 액션 버튼 */}
          {step === 'config' && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleOfflineGenerate}
                disabled={isGenerating}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold text-stone-700 shadow-2xs hover:bg-stone-50 active:scale-95 disabled:opacity-50"
              >
                <Dice5 className="h-4 w-4 text-stone-500" />
                <span>🎲 AI 없이 자동 채우기</span>
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isGenerating}
                  className="flex-1 sm:flex-none rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-100 active:scale-95 disabled:opacity-50"
                >
                  취소
                </button>

                <button
                  type="button"
                  onClick={handleGenerateMealPlan}
                  disabled={isGenerating}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 font-soft text-xs font-bold text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600 active:scale-95 disabled:opacity-60 transition-all"
                >
                  {isGenerating ? (
                    <>
                      <Sparkles className="h-4 w-4 animate-spin" />
                      <span>{LOADING_MESSAGES[loadingMessageIdx]}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>✨ AI 식단 만들기</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 액션 버튼 */}
          {step === 'preview' && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep('config')}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50 active:scale-95"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>조건 변경 / 다시 만들기</span>
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 sm:flex-none rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-100 active:scale-95"
                >
                  취소
                </button>

                <button
                  type="button"
                  onClick={handleApplyFinalPlan}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 font-soft text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:from-emerald-700 hover:to-teal-700 active:scale-95 transition-all"
                >
                  <Check className="h-4 w-4" />
                  <span>이 식단 적용하기</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
