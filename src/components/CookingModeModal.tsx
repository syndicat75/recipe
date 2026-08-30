/**
 * @file src/components/CookingModeModal.tsx
 * @description 주방에서 스마트폰을 거치하고 손을 거의 대지 않고 요리할 수 있는 스마트 핸즈프리 집중 조리 모드(Focus Cooking Mode).
 * Screen Wake Lock(화면 꺼짐 방지), Web Speech API 기반 양방향 한국어 음성 비서(STT/TTS 음향 루프 차단 및 디바운스),
 * Date.now() 기반 정확한 카운트다운 멀티 타이머(음성 및 UI 동기화), 인분 맞춤 재료 음성 질의응답,
 * 진행 상태 자동 저장 및 복원, 2단계 요리 완료 안전 확인 절차를 제공합니다.
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
  HelpCircle,
  Settings,
} from 'lucide-react';
import { Recipe, ActiveTimerItem } from '../types/recipe';
import { getScaledIngredientsList } from '../utils/scaler';
import { logger } from '../utils/logger';
import {
  loadCookingProgress,
  saveCookingProgress,
  clearCookingProgress,
} from '../utils/storage';
import {
  useCookingVoiceAssistant,
} from '../hooks/useCookingVoiceAssistant';
import { CookingVoiceIntent } from '../utils/cookingVoiceCommands';
import { formatSecondsToKoreanSpeech } from '../utils/koreanDurationParser';
import { VoiceAssistantHelpModal } from './cooking/VoiceAssistantHelpModal';
import { VoiceIntroModal } from './cooking/VoiceIntroModal';
import { VoiceStatusBadge } from './cooking/VoiceStatusBadge';

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
 * 조리 단계 문장에서 시간(분, 초) 패턴을 추출합니다.
 * @param text 조리 단계 텍스트
 * @returns 감지된 분 또는 초 정보 목록
 */
function extractCookingTimes(text: string): Array<{ label: string; seconds: number }> {
  logger.debug('CookingModeModal.extractCookingTimes', `단계 내 시간 추출: "${text}"`);
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
  logger.info('CookingModeModal.playTimerAlarmSound', '타이머 알람 비프음 재생');
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

  // 멀티 타이머 상태 (종료 예정 targetTimestamp 기반, UI와 음성명령이 100% 동일한 상태 공유)
  const [activeTimers, setActiveTimers] = useState<ActiveTimerItem[]>([]);
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());

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

  // 현재 인분에 맞춤 계산된 재료 목록
  const scaledIngredients = useMemo(() => {
    if (!recipe) return [];
    return getScaledIngredientsList(recipe.ingredients, portionMultiplier);
  }, [recipe, portionMultiplier]);

  /**
   * 타이머 0.5초 주기 tick 갱신
   */
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 500);
    return () => clearInterval(timerInterval);
  }, []);

  /**
   * 새 타이머 추가 및 시작
   * @param label 타이머 명칭
   * @param seconds 총 초 수
   */
  const handleStartTimer = useCallback((label: string, seconds: number): void => {
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
  }, [showToast]);

  /**
   * 타이머 삭제
   */
  const handleDeleteTimer = useCallback((timerId: string): void => {
    logger.info('CookingModeModal.handleDeleteTimer', `타이머 삭제: ${timerId}`);
    setActiveTimers((prev) => prev.filter((t) => t.id !== timerId));
  }, []);

  /**
   * 타이머 일시정지
   */
  const handlePauseTimer = useCallback((timerId: string): void => {
    logger.info('CookingModeModal.handlePauseTimer', `타이머 일시정지: ${timerId}`);
    setActiveTimers((prev) =>
      prev.map((t) => {
        if (t.id === timerId && !t.isPaused) {
          const remaining = Math.max(0, Math.ceil((t.targetTimestamp - Date.now()) / 1000));
          return {
            ...t,
            isPaused: true,
            remainingSecondsOnPause: remaining,
          };
        }
        return t;
      })
    );
  }, []);

  /**
   * 타이머 재개
   */
  const handleResumeTimer = useCallback((timerId: string): void => {
    logger.info('CookingModeModal.handleResumeTimer', `타이머 재개: ${timerId}`);
    setActiveTimers((prev) =>
      prev.map((t) => {
        if (t.id === timerId && t.isPaused) {
          const rem = t.remainingSecondsOnPause || t.totalSeconds;
          return {
            ...t,
            isPaused: false,
            targetTimestamp: Date.now() + rem * 1000,
          };
        }
        return t;
      })
    );
  }, []);

  /**
   * 요리 완료 통합 처리 (버튼 및 음성명령 공통)
   */
  const handleCompleteCooking = useCallback((withVoiceCongrats: boolean = false): void => {
    logger.info('CookingModeModal.handleCompleteCooking', '요리 완료 통합 처리 실행');
    setIsCompleted(true);
    if (recipe) {
      clearCookingProgress(recipe.id);
    }
    showToast('🎉 요리가 완료되었습니다! 맛있게 드세요!', 'success');
  }, [recipe, showToast]);

  /**
   * 다음 단계 이동
   */
  const handleNextStep = useCallback(
    (onStepMoved?: (nextIdx: number, stepText: string) => void) => {
      logger.info('CookingModeModal.handleNextStep', `다음 단계: 현재 ${currentStepIndex + 1}/${totalSteps}`);
      if (!completedSteps.includes(currentStepIndex)) {
        setCompletedSteps((prev) => [...prev, currentStepIndex]);
      }

      if (currentStepIndex < totalSteps - 1) {
        const nextIdx = currentStepIndex + 1;
        setCurrentStepIndex(nextIdx);
        if (onStepMoved) {
          onStepMoved(nextIdx, steps[nextIdx]);
        }
      } else {
        handleCompleteCooking(true);
      }
    },
    [currentStepIndex, totalSteps, completedSteps, steps, handleCompleteCooking]
  );

  /**
   * 이전 단계 이동
   */
  const handlePrevStep = useCallback(
    (onStepMoved?: (prevIdx: number, stepText: string) => void) => {
      logger.info('CookingModeModal.handlePrevStep', `이전 단계: 현재 ${currentStepIndex + 1}/${totalSteps}`);
      if (isCompleted) {
        setIsCompleted(false);
        return;
      }
      if (currentStepIndex > 0) {
        const prevIdx = currentStepIndex - 1;
        setCurrentStepIndex(prevIdx);
        if (onStepMoved) {
          onStepMoved(prevIdx, steps[prevIdx]);
        }
      }
    },
    [isCompleted, currentStepIndex, steps]
  );

  // 음성 명령 실행 핸들러
  const handleVoiceIntent = useCallback(
    (intent: CookingVoiceIntent) => {
      logger.info('CookingModeModal.handleVoiceIntent', `음성 인텐트 수신: ${intent.type}`, intent);

      switch (intent.type) {
        case 'NEXT_STEP': {
          handleNextStep((nextIdx, stepText) => {
            voiceAssistant.setExecutionFeedback('✓ 다음 단계로 이동');
            if (voiceAssistant.settings.autoReadNextStep) {
              voiceAssistant.speak(`${nextIdx + 1}단계. ${stepText}`);
            }
          });
          break;
        }

        case 'PREV_STEP': {
          handlePrevStep((prevIdx, stepText) => {
            voiceAssistant.setExecutionFeedback('✓ 이전 단계로 이동');
            if (voiceAssistant.settings.autoReadNextStep) {
              voiceAssistant.speak(`${prevIdx + 1}단계. ${stepText}`);
            }
          });
          break;
        }

        case 'READ_STEP': {
          const text = steps[currentStepIndex];
          voiceAssistant.setExecutionFeedback('✓ 현재 단계 읽기');
          voiceAssistant.speak(`${currentStepIndex + 1}단계. ${text}`);
          break;
        }

        case 'STEP_STATUS': {
          voiceAssistant.setExecutionFeedback('✓ 진행 단계 안내');
          voiceAssistant.speak(`총 ${totalSteps}단계 중 현재 ${currentStepIndex + 1}단계입니다.`);
          break;
        }

        case 'FIRST_STEP': {
          setCurrentStepIndex(0);
          voiceAssistant.setExecutionFeedback('✓ 첫 단계로 이동');
          if (voiceAssistant.settings.autoReadNextStep) {
            voiceAssistant.speak(`1단계. ${steps[0]}`);
          }
          break;
        }

        case 'READ_INGREDIENTS': {
          voiceAssistant.setExecutionFeedback('✓ 전체 재료 읽기');
          const maxIngredientsToRead = 8;
          const readList = scaledIngredients.slice(0, maxIngredientsToRead).join(', ');
          const extraText =
            scaledIngredients.length > maxIngredientsToRead
              ? ` 외 ${scaledIngredients.length - maxIngredientsToRead}가지 재료가 있습니다.`
              : '';
          voiceAssistant.speak(
            `현재 ${portionMultiplier}배 기준 재료입니다. ${readList}${extraText}`
          );
          break;
        }

        case 'QUERY_INGREDIENT': {
          const query = intent.ingredient.toLowerCase();
          logger.info('CookingModeModal.handleVoiceIntent', `특정 재료 조회: "${query}"`);

          // scaledIngredients에서 일치하는 재료 찾기
          const matched = scaledIngredients.find((item) =>
            item.toLowerCase().includes(query)
          );

          if (matched) {
            voiceAssistant.setExecutionFeedback(`✓ ${matched}`);
            voiceAssistant.speak(`${matched}이 필요합니다.`);
          } else {
            voiceAssistant.setExecutionFeedback(`'${intent.ingredient}' 재료 없음`, false);
            voiceAssistant.speak(`현재 레시피에서 '${intent.ingredient}' 재료를 찾지 못했습니다.`);
          }
          break;
        }

        case 'START_TIMER': {
          const label = intent.label || `${formatSecondsToKoreanSpeech(intent.seconds)} 타이머`;
          handleStartTimer(label, intent.seconds);
          voiceAssistant.setExecutionFeedback(`✓ ${label} 시작`);
          voiceAssistant.speak(`${label}를 시작합니다.`);
          break;
        }

        case 'START_STEP_TIMER': {
          const currentText = steps[currentStepIndex] || '';
          const detected = extractCookingTimes(currentText);
          if (detected.length === 1) {
            handleStartTimer(detected[0].label, detected[0].seconds);
            voiceAssistant.setExecutionFeedback(`✓ ${detected[0].label} 시작`);
            voiceAssistant.speak(`${detected[0].label}를 시작합니다.`);
          } else if (detected.length > 1) {
            const labels = detected.map((d) => d.label).join('와 ');
            voiceAssistant.setExecutionFeedback('타이머 시간 선택 안내');
            voiceAssistant.speak(`현재 단계에 ${labels}가 있습니다. 몇 분 타이머를 시작할까요?`);
          } else {
            voiceAssistant.setExecutionFeedback('단계 내 감지된 시간 없음', false);
            voiceAssistant.speak('현재 단계에서 감지된 조리 시간이 없습니다. 필요하신 시간을 말씀해주세요.');
          }
          break;
        }

        case 'TIMER_STATUS': {
          if (activeTimers.length === 0) {
            voiceAssistant.setExecutionFeedback('진행 중인 타이머 없음');
            voiceAssistant.speak('현재 진행 중인 타이머가 없습니다.');
          } else if (activeTimers.length === 1) {
            const t = activeTimers[0];
            const remaining = Math.max(0, Math.ceil((t.targetTimestamp - Date.now()) / 1000));
            const formatted = formatSecondsToKoreanSpeech(remaining);
            voiceAssistant.setExecutionFeedback(`✓ 남은 시간: ${formatted}`);
            voiceAssistant.speak(`${t.label}가 ${formatted} 남았습니다.`);
          } else {
            const listStr = activeTimers
              .map((t) => {
                const rem = Math.max(0, Math.ceil((t.targetTimestamp - Date.now()) / 1000));
                return `${t.label} ${formatSecondsToKoreanSpeech(rem)}`;
              })
              .join(', ');
            voiceAssistant.setExecutionFeedback(`✓ 타이머 ${activeTimers.length}개 상태 안내`);
            voiceAssistant.speak(`${listStr} 남았습니다.`);
          }
          break;
        }

        case 'PAUSE_TIMER': {
          if (activeTimers.length === 0) {
            voiceAssistant.setExecutionFeedback('정지할 타이머 없음', false);
            voiceAssistant.speak('정지할 타이머가 없습니다.');
          } else if (intent.targetLabel) {
            const target = activeTimers.find((t) =>
              t.label.includes(intent.targetLabel!)
            );
            if (target) {
              handlePauseTimer(target.id);
              voiceAssistant.setExecutionFeedback(`✓ ${target.label} 일시정지`);
              voiceAssistant.speak(`${target.label}를 일시정지했습니다.`);
            } else {
              voiceAssistant.setExecutionFeedback(`'${intent.targetLabel}' 타이머 없음`, false);
              voiceAssistant.speak(`'${intent.targetLabel}' 타이머를 찾을 수 없습니다.`);
            }
          } else if (activeTimers.length === 1) {
            handlePauseTimer(activeTimers[0].id);
            voiceAssistant.setExecutionFeedback(`✓ ${activeTimers[0].label} 일시정지`);
            voiceAssistant.speak(`${activeTimers[0].label}를 일시정지했습니다.`);
          } else {
            voiceAssistant.setExecutionFeedback('어떤 타이머를 멈출지 말씀해주세요');
            voiceAssistant.speak(
              `현재 타이머가 ${activeTimers.length}개 있습니다. 어떤 타이머를 멈출까요?`
            );
          }
          break;
        }

        case 'RESUME_TIMER': {
          const paused = activeTimers.filter((t) => t.isPaused);
          if (paused.length === 0) {
            voiceAssistant.setExecutionFeedback('정지된 타이머 없음');
            voiceAssistant.speak('일시정지된 타이머가 없습니다.');
          } else if (intent.targetLabel) {
            const target = paused.find((t) => t.label.includes(intent.targetLabel!));
            if (target) {
              handleResumeTimer(target.id);
              voiceAssistant.setExecutionFeedback(`✓ ${target.label} 재개`);
              voiceAssistant.speak(`${target.label}를 다시 시작합니다.`);
            } else {
              voiceAssistant.setExecutionFeedback(`'${intent.targetLabel}' 타이머 없음`, false);
              voiceAssistant.speak(`'${intent.targetLabel}' 정지된 타이머를 찾을 수 없습니다.`);
            }
          } else {
            paused.forEach((t) => handleResumeTimer(t.id));
            voiceAssistant.setExecutionFeedback('✓ 타이머 재개');
            voiceAssistant.speak('타이머를 다시 시작합니다.');
          }
          break;
        }

        case 'CANCEL_TIMER': {
          if (activeTimers.length === 0) {
            voiceAssistant.setExecutionFeedback('취소할 타이머 없음', false);
            voiceAssistant.speak('취소할 타이머가 없습니다.');
          } else if (intent.targetLabel) {
            const target = activeTimers.find((t) =>
              t.label.includes(intent.targetLabel!)
            );
            if (target) {
              handleDeleteTimer(target.id);
              voiceAssistant.setExecutionFeedback(`✓ ${target.label} 취소`);
              voiceAssistant.speak(`${target.label}를 취소했습니다.`);
            } else {
              voiceAssistant.setExecutionFeedback(`'${intent.targetLabel}' 타이머 없음`, false);
              voiceAssistant.speak(`'${intent.targetLabel}' 타이머를 찾을 수 없습니다.`);
            }
          } else if (activeTimers.length === 1) {
            handleDeleteTimer(activeTimers[0].id);
            voiceAssistant.setExecutionFeedback(`✓ ${activeTimers[0].label} 취소`);
            voiceAssistant.speak(`${activeTimers[0].label}를 취소했습니다.`);
          } else {
            voiceAssistant.setExecutionFeedback('어떤 타이머를 취소할지 말씀해주세요');
            voiceAssistant.speak('취소할 타이머 이름을 말씀해주세요.');
          }
          break;
        }

        case 'CANCEL_ALL_TIMERS': {
          setActiveTimers([]);
          voiceAssistant.setExecutionFeedback('✓ 모든 타이머 취소');
          voiceAssistant.speak('모든 타이머를 취소했습니다.');
          break;
        }

        case 'LIST_TIMERS': {
          if (activeTimers.length === 0) {
            voiceAssistant.setExecutionFeedback('진행 중인 타이머 없음');
            voiceAssistant.speak('진행 중인 타이머가 없습니다.');
          } else {
            const labels = activeTimers.map((t) => t.label).join(', ');
            voiceAssistant.setExecutionFeedback(`✓ 타이머 목록 (${activeTimers.length}개)`);
            voiceAssistant.speak(`현재 ${activeTimers.length}개의 타이머가 있습니다: ${labels}`);
          }
          break;
        }

        case 'SHOW_INGREDIENTS': {
          setShowIngredientsSidebar(true);
          voiceAssistant.setExecutionFeedback('✓ 재료 목록 열기');
          voiceAssistant.speak('재료 목록을 열었습니다.');
          break;
        }

        case 'HIDE_INGREDIENTS': {
          setShowIngredientsSidebar(false);
          voiceAssistant.setExecutionFeedback('✓ 재료 목록 닫기');
          voiceAssistant.speak('재료 목록을 닫았습니다.');
          break;
        }

        case 'HELP': {
          voiceAssistant.setShowHelpModal(true);
          voiceAssistant.setExecutionFeedback('✓ 도움말 창 열림');
          voiceAssistant.speak('도움말을 열었습니다. 다음, 재료 읽어줘, 5분 타이머 등으로 말씀해보세요.');
          break;
        }

        case 'STOP_LISTENING': {
          voiceAssistant.stopListening();
          voiceAssistant.setExecutionFeedback('✓ 음성명령 종료');
          voiceAssistant.speak('음성 인식을 종료합니다.');
          break;
        }

        case 'REQUEST_COMPLETE': {
          voiceAssistant.requestConfirmation(
            'COMPLETE',
            '요리를 완료할까요? 완료하려면 완료해라고 말씀해주세요.'
          );
          break;
        }

        case 'CONFIRM_COMPLETE': {
          if (voiceAssistant.pendingConfirmation === 'COMPLETE') {
            voiceAssistant.clearConfirmation();
            handleCompleteCooking(true);
            voiceAssistant.setExecutionFeedback('✓ 요리 완료');
            voiceAssistant.speak('요리가 완료되었습니다. 맛있게 드세요!');
          } else {
            voiceAssistant.setExecutionFeedback('확인 대기 중이 아닙니다', false);
          }
          break;
        }

        case 'UNKNOWN':
        default: {
          logger.info('CookingModeModal.handleVoiceIntent', `알 수 없는 명령: "${intent.raw}"`);
          voiceAssistant.setExecutionFeedback(`인식되지 않음: "${intent.raw}"`, false);
          break;
        }
      }
    },
    [
      steps,
      currentStepIndex,
      totalSteps,
      scaledIngredients,
      portionMultiplier,
      activeTimers,
      handleNextStep,
      handlePrevStep,
      handleStartTimer,
      handlePauseTimer,
      handleResumeTimer,
      handleDeleteTimer,
      handleCompleteCooking,
    ]
  );

  // 음성 비서 훅 인스턴스
  const voiceAssistant = useCookingVoiceAssistant({
    onCommand: handleVoiceIntent,
    showToast,
  });

  /**
   * 타이머 만료 감지 및 알람/진동/음성 안내 처리
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

        // 옵션: 타이머 완료 시 음성 안내
        if (voiceAssistant.settings.voiceTimerAlert) {
          voiceAssistant.speak(`${timer.label} 시간이 완료되었습니다.`);
        }

        // 만료된 타이머 제거
        setActiveTimers((prev) => prev.filter((t) => t.id !== timer.id));
      }
    });
  }, [nowTimestamp, activeTimers, showToast, voiceAssistant]);

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
   * 현재 단계 음성 읽기 버튼 토글
   */
  const handleToggleSpeakStep = useCallback(() => {
    logger.info('CookingModeModal.handleToggleSpeakStep', `음성 읽기 버튼 클릭: isSpeaking=${voiceAssistant.isSpeaking}`);
    if (voiceAssistant.isSpeaking) {
      voiceAssistant.stopSpeaking();
    } else {
      const currentText = steps[currentStepIndex];
      if (currentText) {
        voiceAssistant.speak(`${currentStepIndex + 1}단계. ${currentText}`);
      }
    }
  }, [voiceAssistant, steps, currentStepIndex]);

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
                {portionMultiplier}배 (
                {Math.round(
                  (typeof recipe.baseServings === 'number' && recipe.baseServings >= 1
                    ? recipe.baseServings
                    : 1) * portionMultiplier
                )}
                인분)
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* TTS Button */}
          <button
            type="button"
            id="cooking-tts-toggle-btn"
            onClick={handleToggleSpeakStep}
            className={`flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-bold transition-all ${
              voiceAssistant.isSpeaking
                ? 'bg-amber-500 text-stone-950 font-black animate-pulse'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
            }`}
            title="한국어 음성으로 읽기"
            aria-label="현재 단계 음성으로 읽기"
          >
            {voiceAssistant.isSpeaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            <span className="hidden sm:inline">{voiceAssistant.isSpeaking ? '중지' : '음성 읽기'}</span>
          </button>

          {/* Voice Command STT Button */}
          <button
            type="button"
            id="cooking-voice-toggle-btn"
            onClick={voiceAssistant.toggleListening}
            className={`flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-bold transition-all ${
              voiceAssistant.isListening
                ? 'bg-emerald-500 text-stone-950 font-black ring-2 ring-emerald-400'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
            }`}
            title="핸즈프리 음성 명령 시작/종료"
            aria-label="핸즈프리 음성 명령"
          >
            {voiceAssistant.isListening ? (
              <Mic className="h-4 w-4 animate-bounce" />
            ) : (
              <MicOff className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {voiceAssistant.isListening ? '음성인식 켜짐' : '음성명령'}
            </span>
          </button>

          {/* Help & Settings Modal Button */}
          <button
            type="button"
            id="cooking-voice-help-btn"
            onClick={() => voiceAssistant.setShowHelpModal(true)}
            className="flex items-center gap-1 rounded-2xl bg-stone-800 px-2.5 py-2 text-xs font-bold text-stone-300 hover:bg-stone-700 transition-all"
            title="음성명령 도움말 및 설정"
            aria-label="음성명령 도움말"
          >
            <HelpCircle className="h-4 w-4 text-orange-400" />
          </button>

          {/* Ingredients Sidebar Toggle */}
          <button
            type="button"
            id="cooking-ingredients-sidebar-btn"
            onClick={() => setShowIngredientsSidebar(!showIngredientsSidebar)}
            className={`flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-bold transition-all ${
              showIngredientsSidebar
                ? 'bg-orange-500 text-white font-black'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
            }`}
            aria-label="재료 사이드바 열기"
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
            id="cooking-close-btn"
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
        <main className="flex flex-1 flex-col items-center justify-between p-6 sm:p-12 overflow-y-auto relative">
          {/* Floating Voice Status Indicator */}
          <div className="absolute top-4 left-0 right-0 flex justify-center z-10">
            <VoiceStatusBadge
              isListening={voiceAssistant.isListening}
              isSpeaking={voiceAssistant.isSpeaking}
              lastHeardTranscript={voiceAssistant.lastHeardTranscript}
              lastExecutionFeedback={voiceAssistant.lastExecutionFeedback}
              isPendingConfirmation={voiceAssistant.pendingConfirmation === 'COMPLETE'}
            />
          </div>

          {!isCompleted ? (
            <div className="flex flex-col items-center text-center max-w-3xl w-full my-auto space-y-8 pt-6">
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
                      onClick={() => {
                        setCurrentStepIndex(idx);
                        if (voiceAssistant.settings.autoReadNextStep) {
                          voiceAssistant.speak(`${idx + 1}단계. ${steps[idx]}`);
                        }
                      }}
                      className={`h-2.5 rounded-full transition-all ${
                        idx === currentStepIndex
                          ? 'w-8 bg-orange-500'
                          : completedSteps.includes(idx)
                          ? 'w-2.5 bg-emerald-500'
                          : 'w-2.5 bg-stone-700 hover:bg-stone-500'
                      }`}
                      title={`${idx + 1}단계로 이동`}
                      aria-label={`${idx + 1}단계`}
                    />
                  ))}
                </div>
              </div>

              {/* Step Instruction Card (Kitchen Eye Friendly Large Display) */}
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

              {/* Active Timers Floating Box (Synced with Voice Commands) */}
              {activeTimers.length > 0 && (
                <div className="w-full rounded-2xl border border-amber-500/40 bg-amber-950/40 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-amber-400">
                    <div className="flex items-center gap-1.5">
                      <Bell className="h-4 w-4 animate-bounce" />
                      <span>진행 중인 주방 타이머 ({activeTimers.length}개)</span>
                    </div>
                    <span className="text-[11px] text-amber-400/80 font-normal">
                      🗣️ "타이머 멈춰", "타이머 얼마 남았어?"
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {activeTimers.map((t) => {
                      const remainingSeconds = t.isPaused
                        ? t.remainingSecondsOnPause || 0
                        : Math.max(0, Math.ceil((t.targetTimestamp - nowTimestamp) / 1000));
                      const m = Math.floor(remainingSeconds / 60);
                      const s = remainingSeconds % 60;
                      const timeDisplay = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

                      return (
                        <div
                          key={t.id}
                          className={`flex items-center justify-between rounded-xl px-3 py-2 border transition-all ${
                            t.isPaused
                              ? 'bg-stone-900/60 border-stone-700 opacity-80'
                              : 'bg-stone-900/90 border-stone-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Timer
                              className={`h-4 w-4 ${
                                t.isPaused ? 'text-stone-400' : 'text-amber-400 animate-spin'
                              }`}
                            />
                            <div className="flex flex-col text-left">
                              <span className="text-xs font-bold text-stone-200">{t.label}</span>
                              {t.isPaused && (
                                <span className="text-[10px] text-amber-400 font-bold">일시정지됨</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-base font-black text-amber-300">
                              {timeDisplay}
                            </span>
                            {/* Pause / Resume Button */}
                            <button
                              type="button"
                              onClick={() =>
                                t.isPaused ? handleResumeTimer(t.id) : handlePauseTimer(t.id)
                              }
                              className="rounded-lg bg-stone-800 p-1.5 text-stone-300 hover:text-white hover:bg-stone-700"
                              title={t.isPaused ? '재개' : '일시정지'}
                            >
                              {t.isPaused ? (
                                <Play className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Pause className="h-3.5 w-3.5 text-amber-400" />
                              )}
                            </button>
                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteTimer(t.id)}
                              className="rounded-lg bg-stone-800 p-1.5 text-stone-400 hover:text-rose-400 hover:bg-stone-700"
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
                id="cooking-complete-close-btn"
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
                aria-label="재료 사이드바 닫기"
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
            id="cooking-prev-step-btn"
            onClick={() =>
              handlePrevStep((prevIdx, stepText) => {
                if (voiceAssistant.settings.autoReadNextStep) {
                  voiceAssistant.speak(`${prevIdx + 1}단계. ${stepText}`);
                }
              })
            }
            disabled={currentStepIndex === 0}
            className="flex items-center gap-2 rounded-2xl bg-stone-800 px-5 py-3 font-soft text-sm font-bold text-stone-200 hover:bg-stone-700 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all"
            aria-label="이전 단계로 이동"
          >
            <ChevronLeft className="h-5 w-5" />
            <span>이전 단계</span>
          </button>

          {/* Quick Step Checklist Status & Hands-free hint */}
          <div className="hidden sm:flex flex-col items-center text-xs text-stone-400">
            <span>완료 단계: {completedSteps.length} / {totalSteps}</span>
            <span className="text-[11px] text-stone-500">
              🗣️ "다음", "재료 읽어줘", "5분 타이머"
            </span>
          </div>

          <button
            type="button"
            id="cooking-next-step-btn"
            onClick={() =>
              handleNextStep((nextIdx, stepText) => {
                if (voiceAssistant.settings.autoReadNextStep) {
                  voiceAssistant.speak(`${nextIdx + 1}단계. ${stepText}`);
                }
              })
            }
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 font-soft text-sm font-black text-white shadow-lg shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600 active:scale-95 transition-all"
            aria-label={currentStepIndex === totalSteps - 1 ? '요리 완료' : '다음 단계로 이동'}
          >
            <span>{currentStepIndex === totalSteps - 1 ? '요리 완료' : '다음 단계'}</span>
            <ChevronRight className="h-5 w-5" />
          </button>
        </footer>
      )}

      {/* Voice Assistant Help Modal */}
      <VoiceAssistantHelpModal
        isOpen={voiceAssistant.showHelpModal}
        onClose={() => voiceAssistant.setShowHelpModal(false)}
        settings={voiceAssistant.settings}
        onUpdateSettings={voiceAssistant.updateSettings}
        isSupported={voiceAssistant.isSupported}
      />

      {/* First-time Kitchen Voice Onboarding Modal */}
      <VoiceIntroModal
        isOpen={voiceAssistant.showIntroModal}
        onConfirm={voiceAssistant.markIntroSeen}
      />
    </div>
  );
};
