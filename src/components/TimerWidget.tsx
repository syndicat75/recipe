/**
 * @file src/components/TimerWidget.tsx
 * @description 주방 조리용 플로팅 키친 타이머 위젯 컴포넌트, 사전 설정 프리셋, 시작/일시정지, Web Audio API 알람 차임벨 지원
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Timer as TimerIcon,
  Play,
  Pause,
  RotateCcw,
  X,
  Volume2,
  Minimize2,
  Maximize2,
  Bell,
} from 'lucide-react';
import { APP_CONFIG } from '../config/appConfig';
import { logger } from '../utils/logger';

interface TimerWidgetProps {
  /** 위젯 열림 여부 */
  isOpen: boolean;
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 토스트 표시 함수 */
  showToast: (msg: string) => void;
}

/**
 * 플로팅 키친 타이머 위젯 컴포넌트
 */
export const TimerWidget: React.FC<TimerWidgetProps> = ({ isOpen, onClose, showToast }) => {
  const [minutes, setMinutes] = useState<number>(3);
  const [secondsLeft, setSecondsLeft] = useState<number>(180);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isAlarming, setIsAlarming] = useState<boolean>(false);

  const audioCtxRef = useRef<AudioContext | null>(null);

  /**
   * Web Audio API를 활용한 부드러운 알람음 재생
   */
  const playChimeSound = (): void => {
    logger.info('TimerWidget.playChimeSound', '타이머 종료 알람음 재생');
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const now = ctx.currentTime;
      const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 (화음)
      
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.15);
        gain.gain.setValueAtTime(0.3, now + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.8);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.15);
        osc.stop(now + idx * 0.15 + 0.9);
      });
    } catch (err) {
      logger.error('TimerWidget.playChimeSound', '오디오 재생 실패', err);
    }
  };

  // 타이머 카운트다운 인터벌
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isRunning && secondsLeft > 0) {
      timer = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            setIsAlarming(true);
            playChimeSound();
            showToast('⏰ 요리 타이머가 종료되었습니다!');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRunning, secondsLeft, showToast]);

  if (!isOpen) return null;

  /**
   * 타이머 시간 프리셋 선택
   * @param min 설정할 분
   */
  const handleSelectPreset = (min: number): void => {
    logger.info('TimerWidget.handleSelectPreset', `프리셋 선택: ${min}분`);
    setMinutes(min);
    setSecondsLeft(min * 60);
    setIsRunning(false);
    setIsAlarming(false);
  };

  /**
   * 시작 / 일시정지 토글
   */
  const handleTogglePlay = (): void => {
    logger.info('TimerWidget.handleTogglePlay', `타이머 토글: ${!isRunning}`);
    if (secondsLeft === 0) {
      setSecondsLeft(minutes * 60);
    }
    setIsRunning((prev) => !prev);
    setIsAlarming(false);
  };

  /**
   * 초기화
   */
  const handleReset = (): void => {
    logger.info('TimerWidget.handleReset', '타이머 리셋');
    setIsRunning(false);
    setIsAlarming(false);
    setSecondsLeft(minutes * 60);
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <div className="fixed bottom-6 left-6 z-40">
      <div
        className={`overflow-hidden rounded-3xl border border-orange-200 bg-white/95 shadow-2xl backdrop-blur-xl transition-all duration-300 ${
          isAlarming ? 'ring-4 ring-orange-500 animate-pulse' : ''
        } ${isMinimized ? 'w-56 p-3' : 'w-80 p-5'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-orange-500 text-white shadow-sm">
              <TimerIcon className="h-4 w-4" />
            </span>
            <div>
              <h4 className="font-soft text-xs font-black text-stone-900">키친 타이머</h4>
              {isRunning && <span className="text-[10px] text-orange-600 font-bold">진행 중...</span>}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsMinimized((prev) => !prev)}
              className="p-1 text-stone-400 hover:text-stone-700"
              title={isMinimized ? '확대' : '축소'}
            >
              {isMinimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-stone-400 hover:text-red-500"
              title="타이머 닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Digital Clock Display */}
        <div className="my-3 text-center">
          <div
            className={`font-mono font-black tracking-tight ${
              isMinimized ? 'text-3xl' : 'text-5xl'
            } ${secondsLeft === 0 ? 'text-orange-600' : 'text-stone-900'}`}
          >
            {timeFormatted}
          </div>
          {isAlarming && (
            <div className="mt-1 flex items-center justify-center gap-1 text-xs font-extrabold text-orange-600 animate-bounce">
              <Bell className="h-3.5 w-3.5" />
              <span>조리 완료!</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={handleTogglePlay}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-2 text-xs font-black text-white shadow-md hover:from-orange-600 hover:to-amber-600"
          >
            {isRunning ? (
              <>
                <Pause className="h-3.5 w-3.5" />
                <span>일시정지</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>{secondsLeft === 0 ? '재시작' : '시작'}</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-xl border border-stone-200 bg-stone-50 p-2 text-stone-600 hover:bg-stone-100"
            title="초기화"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        {/* Quick Presets (Only when expanded) */}
        {!isMinimized && (
          <div className="mt-4 border-t border-orange-100 pt-3">
            <p className="text-[11px] font-bold text-stone-400 mb-2">자주 쓰는 시간</p>
            <div className="flex flex-wrap gap-1.5">
              {APP_CONFIG.timerPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    minutes === preset && !isRunning
                      ? 'bg-orange-500 text-white'
                      : 'bg-stone-100 text-stone-700 hover:bg-orange-100 hover:text-orange-700'
                  }`}
                >
                  {preset}분
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
