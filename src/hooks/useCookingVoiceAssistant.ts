/**
 * @file src/hooks/useCookingVoiceAssistant.ts
 * @description 주방 핸즈프리 음성 비서 훅.
 * Web Speech API(SpeechRecognition, SpeechSynthesis)를 래핑하여
 * TTS 음성 출력 중 마이크 자동 차단(자기 음성 오인식 방지), STT 종료 시 안전한 자동 재시작(stale closure 방지),
 * 연속 동일 발화 디바운스(800~1200ms), 2단계 확인 플로우 및 오프라인 음성 명령 파싱을 제공합니다.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { APP_CONFIG } from '../config/appConfig';
import { CookingVoiceIntent, parseCookingVoiceCommand } from '../utils/cookingVoiceCommands';
import { logger } from '../utils/logger';

/**
 * 음성 비서 환경 설정 인터페이스
 */
export interface VoiceAssistantSettings {
  /** 다음 단계 이동 시 조리문장 자동 음성 읽기 여부 (기본 true) */
  autoReadNextStep: boolean;
  /** 타이머 완료 시 TTS 음성 안내 여부 (기본 true) */
  voiceTimerAlert: boolean;
  /** 음성 읽기 속도 (0.85: 느리게, 0.95: 보통, 1.1: 빠르게) */
  speechRate: number;
}

const DEFAULT_SETTINGS: VoiceAssistantSettings = {
  autoReadNextStep: true,
  voiceTimerAlert: true,
  speechRate: 0.95,
};

export interface UseCookingVoiceAssistantProps {
  /** 음성 명령 파싱 후 비즈니스 로직 실행 핸들러 */
  onCommand: (intent: CookingVoiceIntent) => void;
  /** 토스트 메시지 출력 함수 */
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export interface UseCookingVoiceAssistantReturn {
  /** Web Speech API STT 지원 여부 */
  isSupported: boolean;
  /** Web Speech API TTS 지원 여부 */
  isTtsSupported: boolean;
  /** 음성인식 활성화 상태 */
  isListening: boolean;
  /** 음성합성 재생 중 상태 */
  isSpeaking: boolean;
  /** 가장 최근에 인식된 사용자 발화 텍스트 */
  lastHeardTranscript: string;
  /** 최근 실행 결과 피드백 배지 데이터 */
  lastExecutionFeedback: { text: string; success: boolean; timestamp: number } | null;
  /** 확인 대기 중인 위험 액션 (예: 'COMPLETE') */
  pendingConfirmation: 'COMPLETE' | 'CANCEL_ALL_TIMERS' | null;
  /** 음성비서 설정값 */
  settings: VoiceAssistantSettings;
  /** 도움말 모달 열림 여부 */
  showHelpModal: boolean;
  setShowHelpModal: (show: boolean) => void;
  /** 최초 가이드 모달 열림 여부 */
  showIntroModal: boolean;
  setShowIntroModal: (show: boolean) => void;
  /** 최초 가이드 확인 완료 처리 */
  markIntroSeen: () => void;
  /** 음성 합성(TTS) 실행 */
  speak: (text: string, onComplete?: () => void) => void;
  /** 음성 합성 중지 */
  stopSpeaking: () => void;
  /** 음성 인식 시작 */
  startListening: () => void;
  /** 음성 인식 중지 */
  stopListening: () => void;
  /** 음성 인식 토글 */
  toggleListening: () => void;
  /** UI 실행 피드백 등록 (2~3초간 노출) */
  setExecutionFeedback: (text: string, success?: boolean) => void;
  /** 확인 요구 시작 (5~8초 타임아웃) */
  requestConfirmation: (type: 'COMPLETE' | 'CANCEL_ALL_TIMERS', promptText: string) => void;
  /** 확인 요구 취소 */
  clearConfirmation: () => void;
  /** 설정 변경 */
  updateSettings: (newSettings: Partial<VoiceAssistantSettings>) => void;
}

/**
 * 로컬스토리지에서 음성비서 설정을 로드합니다.
 */
function loadVoiceSettings(): VoiceAssistantSettings {
  logger.info('useCookingVoiceAssistant.loadVoiceSettings', '음성 비서 설정 로드 시도');
  try {
    const raw = localStorage.getItem(APP_CONFIG.storageKeys.voiceAssistantSettings);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        autoReadNextStep: typeof parsed.autoReadNextStep === 'boolean' ? parsed.autoReadNextStep : true,
        voiceTimerAlert: typeof parsed.voiceTimerAlert === 'boolean' ? parsed.voiceTimerAlert : true,
        speechRate: typeof parsed.speechRate === 'number' ? parsed.speechRate : 0.95,
      };
    }
  } catch (e) {
    logger.warn('useCookingVoiceAssistant.loadVoiceSettings', '설정 파싱 실패, 기본값 사용', e);
  }
  return DEFAULT_SETTINGS;
}

/**
 * 주방 핸즈프리 음성 비서 훅
 */
export function useCookingVoiceAssistant({
  onCommand,
  showToast,
}: UseCookingVoiceAssistantProps): UseCookingVoiceAssistantReturn {
  const [settings, setSettings] = useState<VoiceAssistantSettings>(() => loadVoiceSettings());
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [lastHeardTranscript, setLastHeardTranscript] = useState<string>('');
  const [lastExecutionFeedback, setLastExecutionFeedback] = useState<{
    text: string;
    success: boolean;
    timestamp: number;
  } | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<
    'COMPLETE' | 'CANCEL_ALL_TIMERS' | null
  >(null);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showIntroModal, setShowIntroModal] = useState<boolean>(false);

  // 브라우저 API 지원 여부
  const isSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  const isTtsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Stale Closure 방지 및 상호 간섭 차단을 위한 내부 Refs
  const shouldListenRef = useRef<boolean>(false);
  const isSpeakingRef = useRef<boolean>(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const lastCommandRef = useRef<string>('');
  const lastCommandAtRef = useRef<number>(0);
  const confirmTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resumeListeningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  /**
   * 설정 변경 및 로컬스토리지 저장
   */
  const updateSettings = useCallback((newSettings: Partial<VoiceAssistantSettings>): void => {
    logger.info('useCookingVoiceAssistant.updateSettings', '음성 비서 설정 갱신', newSettings);
    setSettings((prev) => {
      const next = { ...prev, ...newSettings };
      try {
        localStorage.setItem(APP_CONFIG.storageKeys.voiceAssistantSettings, JSON.stringify(next));
      } catch (e) {
        logger.error('useCookingVoiceAssistant.updateSettings', '설정 저장 실패', e);
      }
      return next;
    });
  }, []);

  /**
   * 최초 가이드 확인 여부 체크
   */
  useEffect(() => {
    try {
      const seen = localStorage.getItem(APP_CONFIG.storageKeys.voiceAssistantIntroSeen);
      if (!seen && isSupported) {
        setShowIntroModal(true);
      }
    } catch {
      // ignore
    }
  }, [isSupported]);

  /**
   * 최초 가이드 확인 완료 마킹
   */
  const markIntroSeen = useCallback((): void => {
    logger.info('useCookingVoiceAssistant.markIntroSeen', '최초 가이드 확인 완료 마킹');
    try {
      localStorage.setItem(APP_CONFIG.storageKeys.voiceAssistantIntroSeen, 'true');
    } catch {
      // ignore
    }
    setShowIntroModal(false);
  }, []);

  /**
   * 실행 피드백 등록 (2~3초간 노출 후 자동 제거)
   */
  const setExecutionFeedback = useCallback((text: string, success: boolean = true): void => {
    logger.info('useCookingVoiceAssistant.setExecutionFeedback', `실행 피드백: "${text}" (${success})`);
    setLastExecutionFeedback({
      text,
      success,
      timestamp: Date.now(),
    });
  }, []);

  // 피드백 3초 후 자동 클리어
  useEffect(() => {
    if (lastExecutionFeedback) {
      const timer = setTimeout(() => {
        setLastExecutionFeedback(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [lastExecutionFeedback]);

  /**
   * 확인 대기 타이머 클리어
   */
  const clearConfirmation = useCallback((): void => {
    logger.info('useCookingVoiceAssistant.clearConfirmation', '확인 대기 상태 해제');
    if (confirmTimeoutRef.current) {
      clearTimeout(confirmTimeoutRef.current);
      confirmTimeoutRef.current = null;
    }
    setPendingConfirmation(null);
  }, []);

  /**
   * TTS 음성 읽기 중지
   */
  const stopSpeaking = useCallback((): void => {
    logger.info('useCookingVoiceAssistant.stopSpeaking', '음성 출력 중지');
    if (isTtsSupported) {
      window.speechSynthesis.cancel();
    }
    isSpeakingRef.current = false;
    setIsSpeaking(false);
  }, [isTtsSupported]);

  /**
   * TTS 음성 읽기 실행 (STT 자기 음성 오인식 방지 메커니즘 포함)
   */
  const speak = useCallback(
    (text: string, onComplete?: () => void): void => {
      logger.info('useCookingVoiceAssistant.speak', `음성 출력 요청: "${text}"`);
      if (!isTtsSupported || !text) {
        if (onComplete) onComplete();
        return;
      }

      // 1. 기존 발화 및 재개 타이머 취소
      window.speechSynthesis.cancel();
      if (resumeListeningTimeoutRef.current) {
        clearTimeout(resumeListeningTimeoutRef.current);
        resumeListeningTimeoutRef.current = null;
      }

      // 2. TTS 발화 시작 전 마이크를 즉시 일시정지하여 자기 음성 청취 방지
      isSpeakingRef.current = true;
      setIsSpeaking(true);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore abort error
        }
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = settings.speechRate || 0.95;

      const finishSpeaking = () => {
        logger.debug('useCookingVoiceAssistant.speak', '음성 출력 종료');
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        if (onComplete) {
          onComplete();
        }

        // 3. 발화 종료 후 250ms 음향 잔향 대기 후 사용자가 음성명령을 켜둔 상태라면 자동 재개
        if (shouldListenRef.current) {
          resumeListeningTimeoutRef.current = setTimeout(() => {
            if (shouldListenRef.current && !isSpeakingRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
                logger.info('useCookingVoiceAssistant.speak', 'TTS 종료 후 마이크 청취 안전 재개');
              } catch {
                // already active
              }
            }
          }, 250);
        }
      };

      utterance.onend = finishSpeaking;
      utterance.onerror = (e) => {
        logger.warn('useCookingVoiceAssistant.speak', 'TTS 에러 발생', e);
        finishSpeaking();
      };

      window.speechSynthesis.speak(utterance);
    },
    [isTtsSupported, settings.speechRate]
  );

  /**
   * 위험 액션 확인 요구 시작 (7초 타임아웃)
   */
  const requestConfirmation = useCallback(
    (type: 'COMPLETE' | 'CANCEL_ALL_TIMERS', promptText: string): void => {
      logger.info('useCookingVoiceAssistant.requestConfirmation', `확인 절차 개시: ${type}`);
      clearConfirmation();
      setPendingConfirmation(type);

      speak(promptText);

      // 7초 동안 확인 명령이 없으면 자동 취소
      confirmTimeoutRef.current = setTimeout(() => {
        logger.info('useCookingVoiceAssistant.requestConfirmation', `확인 시간 초과 (7초 경과): ${type}`);
        setPendingConfirmation(null);
        setExecutionFeedback('확인 시간 초과로 취소되었습니다.', false);
      }, 7000);
    },
    [clearConfirmation, speak, setExecutionFeedback]
  );

  /**
   * 음성 인식 청취 중지
   */
  const stopListening = useCallback((): void => {
    logger.info('useCookingVoiceAssistant.stopListening', '음성 인식 청취 중지');
    shouldListenRef.current = false;
    setIsListening(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
  }, []);

  /**
   * 음성 인식 청취 시작
   */
  const startListening = useCallback((): void => {
    logger.info('useCookingVoiceAssistant.startListening', '음성 인식 청취 시작 요청');
    if (!isSupported) {
      showToast('이 브라우저는 음성 명령을 지원하지 않습니다. 화면 버튼으로 이용하실 수 있습니다.', 'info');
      return;
    }

    shouldListenRef.current = true;
    setIsListening(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return;

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognitionClass();
      recognition.lang = 'ko-KR';
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        // TTS 출력 중 발생한 잔여 결과는 무시
        if (isSpeakingRef.current) {
          logger.debug('useCookingVoiceAssistant.onresult', 'TTS 발화 중 수신된 인식 결과 무시');
          return;
        }

        const lastResultIndex = event.results.length - 1;
        const rawTranscript = event.results[lastResultIndex][0].transcript.trim();
        logger.info('useCookingVoiceAssistant.onresult', `음성 수신: "${rawTranscript}"`);

        setLastHeardTranscript(rawTranscript);

        // 800~1200ms 이내의 동일 명령 연속 중복 유입 방지
        const now = Date.now();
        if (
          rawTranscript === lastCommandRef.current &&
          now - lastCommandAtRef.current < 1000
        ) {
          logger.debug('useCookingVoiceAssistant.onresult', `중복 발화 디바운스 필터링: "${rawTranscript}"`);
          return;
        }
        lastCommandRef.current = rawTranscript;
        lastCommandAtRef.current = now;

        // 클라이언트 로컬 명령 파서 실행
        const intent = parseCookingVoiceCommand(rawTranscript);
        logger.info('useCookingVoiceAssistant.onresult', `파싱된 인텐트: ${intent.type}`, intent);

        onCommandRef.current(intent);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        const error = event.error;
        logger.warn('useCookingVoiceAssistant.onerror', `음성인식 오류: ${error}`);

        if (error === 'no-speech') {
          // 단순 침묵: 청취 상태를 유지하며 onend에서 자동 재시작
          return;
        }

        if (error === 'aborted') {
          // 의도적인 중단(TTS 발화 등): 에러 메시지 생략
          return;
        }

        if (error === 'not-allowed') {
          shouldListenRef.current = false;
          setIsListening(false);
          showToast('음성명령을 사용하려면 브라우저 사이트 설정에서 마이크를 허용해주세요.', 'error');
          return;
        }

        if (error === 'service-not-allowed' || error === 'audio-capture') {
          shouldListenRef.current = false;
          setIsListening(false);
          showToast('마이크를 사용할 수 없거나 브라우저에서 차단되었습니다.', 'error');
          return;
        }

        if (error === 'network') {
          logger.warn('useCookingVoiceAssistant.onerror', '음성인식 네트워크 연결 일시 오류');
          // 네트워크 에러는 잠깐 끊길 수 있으므로 onend에서 재시도 허용
        }
      };

      recognition.onend = () => {
        logger.debug('useCookingVoiceAssistant.onend', '음성인식 세션 종료 이벤트 수신');
        // 사용자가 여전히 청취를 켜둔 상태이고 TTS가 말하고 있지 않다면 자동 재시작 (stale closure 방지)
        if (shouldListenRef.current && !isSpeakingRef.current) {
          try {
            recognition.start();
            logger.debug('useCookingVoiceAssistant.onend', '음성인식 세션 자동 재시작 성공');
          } catch {
            // already started or invalid state
          }
        }
      };

      recognitionRef.current = recognition;
    }

    try {
      recognitionRef.current.start();
      showToast('🎤 핸즈프리 음성명령이 켜졌습니다. ("다음", "5분 타이머" 등)', 'success');
    } catch {
      // already active
    }
  }, [isSupported, showToast]);

  /**
   * 음성 인식 토글
   */
  const toggleListening = useCallback((): void => {
    logger.info('useCookingVoiceAssistant.toggleListening', `음성인식 토글: 현재 ${isListening}`);
    if (isListening) {
      stopListening();
      showToast('음성명령 청취가 꺼졌습니다.', 'info');
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening, showToast]);

  // 언마운트 시 클린업
  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      isSpeakingRef.current = false;
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current);
      }
      if (resumeListeningTimeoutRef.current) {
        clearTimeout(resumeListeningTimeoutRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    isSupported,
    isTtsSupported,
    isListening,
    isSpeaking,
    lastHeardTranscript,
    lastExecutionFeedback,
    pendingConfirmation,
    settings,
    showHelpModal,
    setShowHelpModal,
    showIntroModal,
    setShowIntroModal,
    markIntroSeen,
    speak,
    stopSpeaking,
    startListening,
    stopListening,
    toggleListening,
    setExecutionFeedback,
    requestConfirmation,
    clearConfirmation,
    updateSettings,
  };
}
