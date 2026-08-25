/**
 * @file src/components/CookingModeModal.tsx
 * @description 주방에서 스마트폰을 거치하고 편리하게 요리할 수 있는 스마트 집중 조리 모드(Focus Cooking Mode).
 * Screen Wake Lock(화면 꺼짐 방지), Web Speech API 기반 한국어 음성 읽기(TTS) 및 음성 명령(STT),
 * Date.now() 기반 정확한 카운트다운 멀티 타이머, 조리 단계별 시간 자동 감지 버튼,
 * 진행 상태 자동 저장 및 복원, 완료 알림음(Web Audio API)을 제공합니다.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  List,
  Sun,
  CheckCircle2,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Bell,
  Check,
  Plus,
  Trash2,
  ChefHat,
} from 'lucide-react';
import { Recipe, ActiveTimerItem } from '../types/recipe';
import { getScaledIngredientsList } from '../utils/scaler';
import { logger } from '../utils/logger';
import {
  loadCookingProgress,
  saveCookingProgress,
  clearCookingProgress,
} from '../utils/storage';

interface CookingModeModalProps {
  /** 조리 중인 레시피 데이터 */
  recipe: Recipe | null;
  /** 적용된 분량 배율 */
  portionMultiplier: number;
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 토스트 표시 함수 */
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

/**
 * 텍스트에서 시간(분, 초) 패턴을 추출합니다.
 * @param text 조리 단계 텍스트
 * @returns 감지된 분 또는 초 정보 목록
 */
function extractCookingTimes(text: string): Array<{ label: string; seconds: number }> {
  const results: Array<{ label: string; seconds: number }> = [];
  if (!text) return results;

  // 1. "X분 ~ Y분" 또는 "X~Y분"
  const rangeMinMatch = text.match(/(\d+)\s*~\s*(\d+)\s*분/);
  if (rangeMinMatch) {
    const min1 = parseInt(rangeMinMatch[1], 10);
    const min2 = parseInt(rangeMinMatch[2], 10);
    results.push({ label: `${min1}분 타이머`, seconds: min1 * 60 });
    results.push({ label: `${min2}분 타이머`, seconds: min2 * 60 });
  }

  // 2. 단일 "X분"
  const singleMinMatches = text.matchAll(/(\d+)\s*분/g);
  for (const m of singleMinMatches) {
    const mins = parseInt(m[1], 10);
    if (!results.some((r) => r.seconds === mins * 60)) {
      results.push({ label: `${mins}분 타이머`, seconds: mins * 60 });
    }
  }

  // 3. 단일 "X초"
  const singleSecMatches = text.matchAll(/(\d+)\s*초/g);
  for (const m of singleSecMatches) {
    const secs = parseInt(m[1], 10);
    if (!results.some((r) => r.seconds === secs)) {
      results.push({ label: `${secs}초 타이머`, seconds: secs });
    }
  }

  return results;
}

/**
 * Web Audio API를 활용해 타이머 종료 비프음을 재생합니다.
 */
function playTimerAlarmSound(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const playBeep = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    playBeep(880, now, 0.15);
    playBeep(880, now + 0.2, 0.15);
    playBeep(1174, now + 0.4, 0.35);
  } catch (e) {
    logger.warn('CookingModeModal.playTimerAlarmSound', '오디오 재생 실패', e);
  }
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
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [showIngredientsSidebar, setShowIngredientsSidebar] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isWakeLockActive, setIsWakeLockActive] = useState<boolean>(false);

  // 멀티 타이머 상태 (종료 예정 targetTimestamp 기반)
  const [activeTimers, setActiveTimers] = useState<ActiveTimerItem[]>([]);
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());

  // 음성 읽기(TTS) 상태
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // 음성 명령(STT) 상태
  const [isListening, setIsListening] = useState<boolean>(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wakeLockRef = useRef<any>(null);

  // 조리 단계 목록 파싱
  const steps = useMemo(() => {
    if (!recipe || !recipe.method || recipe.method === '-') {
      return ['재료를 준비하고 순서에 맞추어 조리합니다.'];
    }
    return recipe.method
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [recipe]);

  const totalSteps = steps.length;
  const scaledIngredients = useMemo(() => {
    if (!recipe) return [];
    return getScaledIngredientsList(recipe.ingredients, portionMultiplier);
  }, [recipe, portionMultiplier]);

  /**
   * 타이머 1초 주기 tick 갱신
   */
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 500);
    return () => clearInterval(timerInterval);
  }, []);

  /**
   * 타이머 만료 감지 및 알람 처리
   */
  useEffect(() => {
    activeTimers.forEach((timer) => {
      if (!timer.isPaused && timer.targetTimestamp <= nowTimestamp && timer.targetTimestamp > 0) {
        logger.info('CookingModeModal.timer', `타이머 만료: ${timer.label}`);
        playTimerAlarmSound();
        if ('vibrate' in navigator) {
          navigator.vibrate([300, 200, 300, 200, 500]);
        }
        showToast(`⏰ [${timer.label}] 시간이 완료되었습니다!`, 'success');

        // 알림 후 타이머 제거
        setActiveTimers((prev) => prev.filter((t) => t.id !== timer.id));
      }
    });
  }, [nowTimestamp, activeTimers, showToast]);

  /**
   * 진행 상태 복원 및 Screen Wake Lock 활성화
   */
  useEffect(() => {
    if (recipe) {
      logger.info('CookingModeModal.useEffect', `조리 모드 시작: ${recipe.name}`);

      // 저장된 진행 상황 복원 시도
      const savedProgress = loadCookingProgress(recipe.id);
      if (savedProgress && savedProgress.currentStepIndex < totalSteps) {
        setCurrentStepIndex(savedProgress.currentStepIndex);
        setCompletedSteps(savedProgress.completedStepIndices || []);
        logger.info('CookingModeModal', `진행상태 복원: ${savedProgress.currentStepIndex + 1}단계`);
      } else {
        setCurrentStepIndex(0);
        setCompletedSteps([]);
      }

      setIsCompleted(false);

      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      // Screen Wake Lock API 요청
      const requestWakeLock = async () => {
        try {
          if ('wakeLock' in navigator) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
            setIsWakeLockActive(true);
            logger.info('CookingModeModal', 'Screen Wake Lock 획득 성공 (화면 켜짐 유지)');
          }
        } catch (err) {
          logger.warn('CookingModeModal', 'Screen Wake Lock 요청 실패 또는 미지원', err);
          setIsWakeLockActive(false);
        }
      };

      requestWakeLock();

      return () => {
        document.body.style.overflow = originalOverflow;
        if (wakeLockRef.current) {
          wakeLockRef.current.release().catch(() => {});
          wakeLockRef.current = null;
        }
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
      };
    }
  }, [recipe, totalSteps]);

  /**
   * 진행 상태 영속화
   */
  useEffect(() => {
    if (recipe && !isCompleted) {
      saveCookingProgress({
        recipeId: recipe.id,
        currentStepIndex,
        completedStepIndices: completedSteps,
        lastUpdated: Date.now(),
      });
    }
  }, [recipe, currentStepIndex, completedSteps, isCompleted]);

  /**
   * 현재 단계 음성 읽기 (TTS)
   */
  const handleSpeakCurrentStep = useCallback(() => {
    if (!('speechSynthesis' in window)) {
      showToast('이 브라우저는 음성 읽기를 지원하지 않습니다.', 'info');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const currentText = steps[currentStepIndex];
    if (!currentText) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      `${currentStepIndex + 1}단계. ${currentText}`
    );
    utterance.lang = 'ko-KR';
    utterance.rate = 0.95;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [steps, currentStepIndex, isSpeaking, showToast]);

  /**
   * 다음 단계 이동
   */
  const handleNextStep = useCallback(() => {
    logger.info('CookingModeModal.handleNextStep', `다음 단계: 현재 ${currentStepIndex + 1}/${totalSteps}`);
    // 완료 목록에 현재 단계 추가
    if (!completedSteps.includes(currentStepIndex)) {
      setCompletedSteps((prev) => [...prev, currentStepIndex]);
    }

    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      setIsCompleted(true);
      if (recipe) clearCookingProgress(recipe.id);
      showToast('🎉 요리가 완료되었습니다! 맛있게 드세요!', 'success');
    }
  }, [currentStepIndex, totalSteps, completedSteps, recipe, showToast]);

  /**
   * 이전 단계 이동
   */
  const handlePrevStep = useCallback(() => {
    logger.info('CookingModeModal.handlePrevStep', `이전 단계: 현재 ${currentStepIndex + 1}/${totalSteps}`);
    if (isCompleted) {
      setIsCompleted(false);
      return;
    }
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [isCompleted, currentStepIndex]);

  /**
   * 새 타이머 추가 및 시작
   * @param label 타이머 명칭
   * @param seconds 총 초 수
   */
  const handleStartTimer = (label: string, seconds: number): void => {
    logger.info('CookingModeModal.handleStartTimer', `타이머 시작: ${label} (${seconds}초)`);
    const newTimer: ActiveTimerItem = {
      id: `timer_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      label: label,
      totalSeconds: seconds,
      targetTimestamp: Date.now() + seconds * 1000,
      isPaused: false,
    };
    setActiveTimers((prev) => [...prev, newTimer]);
    showToast(`⏱️ [${label}] 타이머가 시작되었습니다.`, 'info');
  };

  /**
   * 타이머 삭제
   */
  const handleDeleteTimer = (timerId: string): void => {
    setActiveTimers((prev) => prev.filter((t) => t.id !== timerId));
  };

  /**
   * 음성 인식(STT) 명령 청취 토글
   */
  const toggleVoiceCommands = (): void => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      showToast('이 브라우저는 음성 인식 명령을 지원하지 않습니다.', 'info');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      showToast('음성 명령 청취가 꺼졌습니다.', 'info');
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.lang = 'ko-KR';
      recognition.continuous = true;
      recognition.interimResults = false;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const lastResultIndex = event.results.length - 1;
        const transcript = event.results[lastResultIndex][0].transcript.trim().toLowerCase();
        logger.info('CookingModeModal.voiceCommand', `음성 인식: "${transcript}"`);

        if (transcript.includes('다음') || transcript.includes('넥스트') || transcript.includes('넘어가')) {
          handleNextStep();
          showToast('🗣️ 음성인식: 다음 단계로 이동합니다.', 'info');
        } else if (transcript.includes('이전') || transcript.includes('뒤로')) {
          handlePrevStep();
          showToast('🗣️ 음성인식: 이전 단계로 이동합니다.', 'info');
        } else if (transcript.includes('읽어') || transcript.includes('다시') || transcript.includes('설명')) {
          handleSpeakCurrentStep();
        } else if (transcript.includes('완료') || transcript.includes('종료') || transcript.includes('다했어')) {
          setIsCompleted(true);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        if (isListening && recognitionRef.current) {
          try {
            recognition.start();
          } catch {
            setIsListening(false);
          }
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
      showToast('🎤 음성 명령 시작 ("다음", "이전", "읽어줘")', 'success');
    } catch (e) {
      logger.error('CookingModeModal.toggleVoiceCommands', '음성인식 시작 실패', e);
      setIsListening(false);
    }
  };

  if (!recipe) return null;

  const currentStepText = steps[currentStepIndex] || '';
  const detectedTimes = extractCookingTimes(currentStepText);

  return (
    <div
      id="cooking-mode-modal"
      className="fixed inset-0 z-50 flex flex-col bg-stone-950 text-stone-100 animate-fade-in select-none"
      role="dialog"
      aria-modal="true"
    >
      {/* Top Bar */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-stone-800/80 bg-stone-900/90 px-4 sm:px-8 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{recipe.icon || '🍳'}</span>
          <div>
            <h1 className="font-soft text-base font-black text-white sm:text-lg">
              {recipe.name}
            </h1>
            <div className="flex items-center gap-2 text-xs text-stone-400">
              <span>{recipe.category}</span>
              <span>·</span>
              <span className="text-orange-400 font-bold">
                {portionMultiplier}배 ({Math.round((recipe.baseServings || 2) * portionMultiplier)}인분)
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* TTS Button */}
          <button
            type="button"
            onClick={handleSpeakCurrentStep}
            className={`flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-bold transition-all ${
              isSpeaking
                ? 'bg-amber-500 text-stone-950 font-black animate-pulse'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
            }`}
            title="한국어 음성으로 읽기"
          >
            {isSpeaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            <span className="hidden sm:inline">{isSpeaking ? '중지' : '음성 읽기'}</span>
          </button>

          {/* Voice Command STT Button */}
          <button
            type="button"
            onClick={toggleVoiceCommands}
            className={`flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-bold transition-all ${
              isListening
                ? 'bg-emerald-500 text-stone-950 font-black ring-2 ring-emerald-400'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
            }`}
            title="핸즈프리 음성 명령"
          >
            {isListening ? <Mic className="h-4 w-4 animate-bounce" /> : <MicOff className="h-4 w-4" />}
            <span className="hidden sm:inline">{isListening ? '음성인식 켜짐' : '음성명령'}</span>
          </button>

          {/* Ingredients Sidebar Toggle */}
          <button
            type="button"
            onClick={() => setShowIngredientsSidebar(!showIngredientsSidebar)}
            className={`flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-bold transition-all ${
              showIngredientsSidebar
                ? 'bg-orange-500 text-white font-black'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
            }`}
          >
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">재료 보기</span>
          </button>

          {/* WakeLock Badge */}
          {isWakeLockActive && (
            <div
              className="hidden md:flex items-center gap-1 rounded-2xl bg-amber-500/20 px-2.5 py-1.5 text-[11px] font-bold text-amber-400 border border-amber-500/30"
              title="요리 중 화면이 자동으로 꺼지지 않습니다"
            >
              <Sun className="h-3.5 w-3.5" />
              <span>화면 유지</span>
            </div>
          )}

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-stone-800 p-2 text-stone-400 hover:bg-stone-700 hover:text-white active:scale-95 transition-all ml-1"
            aria-label="조리 모드 나가기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Step Focus Canvas */}
        <main className="flex flex-1 flex-col items-center justify-between p-6 sm:p-12 overflow-y-auto">
          {!isCompleted ? (
            <div className="flex flex-col items-center text-center max-w-3xl w-full my-auto space-y-8">
              {/* Progress Indicator */}
              <div className="flex flex-col items-center space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/20 px-4 py-1.5 border border-orange-500/40">
                  <ChefHat className="h-4 w-4 text-orange-400" />
                  <span className="font-soft text-sm sm:text-base font-black text-orange-300">
                    {currentStepIndex + 1} / {totalSteps} 단계
                  </span>
                </div>

                {/* Step Dots */}
                <div className="flex items-center gap-1.5 pt-1">
                  {steps.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentStepIndex(idx)}
                      className={`h-2.5 rounded-full transition-all ${
                        idx === currentStepIndex
                          ? 'w-8 bg-orange-500'
                          : completedSteps.includes(idx)
                          ? 'w-2.5 bg-emerald-500'
                          : 'w-2.5 bg-stone-700 hover:bg-stone-500'
                      }`}
                      title={`${idx + 1}단계로 이동`}
                    />
                  ))}
                </div>
              </div>

              {/* Step Instruction Card (Big Font for Kitchen Stand) */}
              <div className="rounded-3xl border border-stone-800 bg-stone-900/80 p-8 sm:p-12 shadow-2xl backdrop-blur-md w-full">
                <p className="font-soft text-2xl font-bold leading-relaxed text-stone-100 sm:text-3xl lg:text-4xl text-balance">
                  {currentStepText}
                </p>
              </div>

              {/* Auto Detected Time Buttons (One Click Timer) */}
              {detectedTimes.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  <span className="text-xs font-bold text-stone-400">💡 단계 내 시간 감지:</span>
                  {detectedTimes.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleStartTimer(item.label, item.seconds)}
                      className="flex items-center gap-1.5 rounded-2xl bg-amber-500/20 px-4 py-2 text-xs font-bold text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 active:scale-95 transition-all shadow-sm"
                    >
                      <Timer className="h-4 w-4 text-amber-400" />
                      <span>{item.label} 시작</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Active Timers Floating Box */}
              {activeTimers.length > 0 && (
                <div className="w-full rounded-2xl border border-amber-500/40 bg-amber-950/40 p-4 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-400">
                    <Bell className="h-4 w-4 animate-bounce" />
                    <span>진행 중인 주방 타이머 ({activeTimers.length}개)</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {activeTimers.map((t) => {
                      const remainingSeconds = Math.max(
                        0,
                        Math.ceil((t.targetTimestamp - nowTimestamp) / 1000)
                      );
                      const m = Math.floor(remainingSeconds / 60);
                      const s = remainingSeconds % 60;
                      const timeDisplay = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

                      return (
                        <div
                          key={t.id}
                          className="flex items-center justify-between rounded-xl bg-stone-900/90 px-3 py-2 border border-stone-800"
                        >
                          <div className="flex items-center gap-2">
                            <Timer className="h-4 w-4 text-amber-400 animate-spin" />
                            <span className="text-xs font-bold text-stone-200">{t.label}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-base font-black text-amber-300">
                              {timeDisplay}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteTimer(t.id)}
                              className="text-stone-500 hover:text-rose-400"
                              title="삭제"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* 요리 완료 화면 */
            <div className="flex flex-col items-center justify-center text-center my-auto space-y-6 animate-scale-up">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-xl">
                <CheckCircle2 className="h-12 w-12" />
              </div>

              <div className="space-y-2">
                <h2 className="font-soft text-3xl font-black text-white sm:text-4xl">
                  🎉 요리가 완성되었습니다!
                </h2>
                <p className="text-sm font-medium text-stone-400 sm:text-base">
                  정성껏 만든 '{recipe.name}' 요리를 따뜻할 때 맛있게 드세요.
                </p>
              </div>

              {recipe.tip && (
                <div className="max-w-md rounded-2xl border border-stone-800 bg-stone-900/80 p-4 text-xs text-stone-300">
                  <span className="font-bold text-orange-400">💡 셰프의 마무리 팁: </span>
                  {recipe.tip}
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl bg-orange-500 px-8 py-3.5 font-soft text-sm font-bold text-white shadow-xl shadow-orange-500/30 hover:bg-orange-600 active:scale-95 transition-all"
              >
                요리 완료하고 닫기
              </button>
            </div>
          )}
        </main>

        {/* Ingredients Sliding Sidebar */}
        {showIngredientsSidebar && (
          <aside className="w-80 border-l border-stone-800 bg-stone-900 p-6 overflow-y-auto space-y-4 animate-slide-left z-20">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <h3 className="font-soft text-base font-bold text-white">
                필요 재료 ({portionMultiplier}배)
              </h3>
              <button
                type="button"
                onClick={() => setShowIngredientsSidebar(false)}
                className="rounded-lg p-1 text-stone-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ul className="space-y-2 text-xs">
              {scaledIngredients.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between rounded-xl bg-stone-800/60 px-3 py-2 text-stone-200"
                >
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>

      {/* Bottom Sticky Navigation Controls */}
      {!isCompleted && (
        <footer className="flex h-20 shrink-0 items-center justify-between border-t border-stone-800 bg-stone-900/90 px-6 sm:px-12 backdrop-blur-md">
          <button
            type="button"
            onClick={handlePrevStep}
            disabled={currentStepIndex === 0}
            className="flex items-center gap-2 rounded-2xl bg-stone-800 px-5 py-3 font-soft text-sm font-bold text-stone-200 hover:bg-stone-700 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all"
          >
            <ChevronLeft className="h-5 w-5" />
            <span>이전 단계</span>
          </button>

          {/* Quick Step Checklist Toggle */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-stone-400">
            <span>완료 단계: {completedSteps.length} / {totalSteps}</span>
          </div>

          <button
            type="button"
            onClick={handleNextStep}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 font-soft text-sm font-black text-white shadow-lg shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600 active:scale-95 transition-all"
          >
            <span>{currentStepIndex === totalSteps - 1 ? '요리 완료' : '다음 단계'}</span>
            <ChevronRight className="h-5 w-5" />
          </button>
        </footer>
      )}
    </div>
  );
};
