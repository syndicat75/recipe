/**
 * @file src/components/CookingModeModal.tsx
 * @description 주방에서 요리 중 한 단계씩 크게 보며 따라 할 수 있는 집중 조리 모드(Focus Cooking Mode) 뷰 컴포넌트
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  List,
} from 'lucide-react';
import { Recipe } from '../types/recipe';
import { getScaledIngredientsList } from '../utils/scaler';
import { logger } from '../utils/logger';

interface CookingModeModalProps {
  /** 조리 중인 레시피 데이터 (null이면 미표시) */
  recipe: Recipe | null;
  /** 적용된 분량 배율 */
  portionMultiplier: number;
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 토스트 표시 함수 */
  showToast: (msg: string) => void;
}

/**
 * 단계별 집중 조리 모드 모달 컴포넌트
 */
export const CookingModeModal: React.FC<CookingModeModalProps> = ({
  recipe,
  portionMultiplier,
  onClose,
  showToast,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [showIngredientsSidebar, setShowIngredientsSidebar] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Step Stopwatch/Timer state
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  // 초기화
  useEffect(() => {
    if (recipe) {
      logger.info('CookingModeModal.useEffect', `조리 모드 시작: ${recipe.name}`);
      setCurrentStepIndex(0);
      setIsCompleted(false);
      setTimerSeconds(0);
      setIsTimerRunning(false);
    }
  }, [recipe]);

  // 타이머 인터벌 관리
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  if (!recipe) return null;

  const rawSteps = recipe.method
    ? recipe.method
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const steps = rawSteps.length > 0 ? rawSteps : ['재료를 준비하고 순서에 맞추어 조리합니다.'];
  const totalSteps = steps.length;
  const scaledIngredients = getScaledIngredientsList(recipe.ingredients, portionMultiplier);

  /**
   * 다음 조리 단계로 이동
   */
  const handleNextStep = (): void => {
    logger.info('CookingModeModal.handleNextStep', `다음 단계: 현재 ${currentStepIndex + 1}/${totalSteps}`);
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      setIsCompleted(true);
      showToast('🎉 요리가 완료되었습니다! 맛있게 드세요!');
    }
  };

  /**
   * 이전 조리 단계로 이동
   */
  const handlePrevStep = (): void => {
    logger.info('CookingModeModal.handlePrevStep', `이전 단계: 현재 ${currentStepIndex + 1}/${totalSteps}`);
    if (isCompleted) {
      setIsCompleted(false);
      return;
    }
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  /**
   * 스톱워치 시간 포맷팅 (MM:SS)
   * @param sec 초 단위 시간
   * @returns 포맷팅된 시분 문자열
   */
  const formatTime = (sec: number): string => {
    const mins = Math.floor(sec / 60);
    const remainingSecs = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-stone-900 text-white"
      role="dialog"
      aria-modal="true"
    >
      {/* Top Bar */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-stone-800 bg-stone-950 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{recipe.icon}</span>
          <div>
            <h2 className="font-soft text-base font-black text-white sm:text-lg">
              {recipe.name} <span className="text-xs text-orange-400 font-bold">({portionMultiplier}배 분량)</span>
            </h2>
            <p className="text-[11px] font-semibold text-stone-400">집중 조리 모드</p>
          </div>
        </div>

        {/* Top Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Ingredients Toggle */}
          <button
            type="button"
            onClick={() => {
              logger.info('CookingModeModal', '재료 사이드바 토글');
              setShowIngredientsSidebar((prev) => !prev);
            }}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
              showIngredientsSidebar
                ? 'border-orange-500 bg-orange-500/20 text-orange-400'
                : 'border-stone-700 bg-stone-800 text-stone-300 hover:bg-stone-700'
            }`}
          >
            <List className="h-4 w-4" />
            <span>재료 보기</span>
          </button>

          {/* Close Cooking Mode */}
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl bg-stone-800 text-stone-400 transition hover:bg-stone-700 hover:text-white"
            aria-label="조리 모드 나가기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Step Card Screen */}
        <div className="flex flex-1 flex-col justify-between p-6 sm:p-12 overflow-y-auto">
          {/* Progress Bar */}
          <div className="mx-auto w-full max-w-3xl">
            <div className="flex items-center justify-between text-xs font-bold text-stone-400 mb-2">
              <span>진행 상황</span>
              <span className="text-orange-400 font-extrabold">
                {isCompleted ? '완료' : `${currentStepIndex + 1} / ${totalSteps} 단계`}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-800">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-300"
                style={{
                  width: `${isCompleted ? 100 : ((currentStepIndex + 1) / totalSteps) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Step Text Container */}
          <div className="mx-auto my-auto max-w-3xl py-8 text-center">
            {isCompleted ? (
              <div className="flex flex-col items-center animate-fade-in">
                <div className="grid h-24 w-24 place-items-center rounded-full bg-orange-500/20 text-orange-400 ring-8 ring-orange-500/10">
                  <Sparkles className="h-12 w-12" />
                </div>
                <h3 className="mt-6 font-soft text-3xl font-black text-white sm:text-4xl">
                  요리가 완성되었습니다!
                </h3>
                <p className="mt-3 text-base text-stone-300">
                  총 소요 시간: <strong className="text-orange-400">{formatTime(timerSeconds)}</strong>
                </p>
                <div className="mt-8 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCompleted(false);
                      setCurrentStepIndex(0);
                    }}
                    className="flex items-center gap-2 rounded-2xl bg-stone-800 px-6 py-3 text-sm font-bold text-stone-300 transition hover:bg-stone-700"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>처음부터 다시보기</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-2xl bg-orange-500 px-8 py-3 text-sm font-extrabold text-white shadow-lg transition hover:bg-orange-600"
                  >
                    완료하고 나가기
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <span className="inline-block rounded-full bg-orange-500/20 px-4 py-1.5 font-mono text-sm font-black text-orange-400 ring-1 ring-orange-500/30">
                  STEP {currentStepIndex + 1}
                </span>
                <p className="mt-6 font-soft text-2xl font-bold leading-relaxed text-stone-100 sm:text-3xl lg:text-4xl whitespace-pre-line">
                  {steps[currentStepIndex]}
                </p>
              </div>
            )}
          </div>

          {/* Bottom Cooking Controls (Stopwatch & Next/Prev) */}
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-between gap-4 border-t border-stone-800 pt-6 sm:flex-row">
            {/* Built-in Cooking Timer */}
            <div className="flex items-center gap-3 rounded-2xl bg-stone-800/80 px-4 py-2 ring-1 ring-stone-700">
              <Timer className="h-4 w-4 text-orange-400" />
              <span className="font-mono text-base font-bold text-stone-200">
                {formatTime(timerSeconds)}
              </span>
              <button
                type="button"
                onClick={() => {
                  logger.info('CookingModeModal', `스톱워치 토글: ${!isTimerRunning}`);
                  setIsTimerRunning((prev) => !prev);
                }}
                className="grid h-7 w-7 place-items-center rounded-lg bg-orange-500 text-white hover:bg-orange-600"
                title={isTimerRunning ? '일시정지' : '시작'}
              >
                {isTimerRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  logger.info('CookingModeModal', '스톱워치 초기화');
                  setTimerSeconds(0);
                  setIsTimerRunning(false);
                }}
                className="grid h-7 w-7 place-items-center rounded-lg bg-stone-700 text-stone-300 hover:bg-stone-600"
                title="초기화"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handlePrevStep}
                disabled={currentStepIndex === 0 && !isCompleted}
                className="flex items-center gap-1.5 rounded-2xl border border-stone-700 bg-stone-800 px-5 py-3 text-sm font-bold text-stone-300 transition hover:bg-stone-700 disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>이전 단계</span>
              </button>

              {!isCompleted && (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-7 py-3 text-sm font-extrabold text-white shadow-lg transition hover:from-orange-600 hover:to-amber-600"
                >
                  <span>
                    {currentStepIndex === totalSteps - 1 ? '요리 완료' : '다음 단계'}
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Slide-in Ingredients Drawer */}
        {showIngredientsSidebar && (
          <div className="w-80 border-l border-stone-800 bg-stone-950 p-6 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h4 className="font-soft text-sm font-black text-orange-400">
                🛒 필요 재료 ({scaledIngredients.length})
              </h4>
              <button
                type="button"
                onClick={() => setShowIngredientsSidebar(false)}
                className="text-stone-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="mt-4 space-y-2.5">
              {scaledIngredients.map((ing, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2.5 rounded-xl bg-stone-900/90 p-2.5 text-xs leading-relaxed text-stone-300"
                >
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                  <span>{ing}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
