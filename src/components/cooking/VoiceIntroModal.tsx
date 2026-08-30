/**
 * @file src/components/cooking/VoiceIntroModal.tsx
 * @description 최초 조리모드 진입 시 표시되는 핸즈프리 음성 비서 안내 모달.
 */

import React from 'react';
import { Mic, Sparkles, ChefHat, Volume2, Timer, Check } from 'lucide-react';
import { logger } from '../../utils/logger';

interface VoiceIntroModalProps {
  /** 모달 열림 여부 */
  isOpen: boolean;
  /** 확인 및 시작 핸들러 */
  onConfirm: () => void;
}

/**
 * 핸즈프리 음성비서 최초 온보딩 모달
 */
export const VoiceIntroModal: React.FC<VoiceIntroModalProps> = ({
  isOpen,
  onConfirm,
}) => {
  if (!isOpen) return null;

  logger.info('VoiceIntroModal', '음성 비서 온보딩 안내 모달 렌더링');

  return (
    <div
      id="voice-intro-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex w-full max-w-md flex-col rounded-3xl border border-stone-800 bg-stone-900 text-stone-100 p-6 sm:p-8 shadow-2xl space-y-6 text-center animate-scale-up">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-xl shadow-orange-500/20">
          <Mic className="h-8 w-8 animate-bounce" />
        </div>

        <div className="space-y-2">
          <h2 className="font-soft text-xl sm:text-2xl font-black text-white">
            🎤 핸즈프리 조리 음성비서
          </h2>
          <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
            요리 중 화면을 터치하지 않고도<br />
            목소리만으로 다음 단계 이동 및 타이머를 조작할 수 있습니다.
          </p>
        </div>

        <div className="rounded-2xl border border-stone-800 bg-stone-950/60 p-4 text-left space-y-2 text-xs">
          <div className="font-bold text-orange-400">💡 대표 음성명령 예시:</div>
          <div className="space-y-1.5 text-stone-300">
            <p>• <span className="font-bold text-white">"다음"</span> ➔ 다음 조리 단계로 이동</p>
            <p>• <span className="font-bold text-white">"재료 읽어줘"</span> ➔ 현재 인분 기준 재료 안내</p>
            <p>• <span className="font-bold text-white">"양파 얼마나 필요해?"</span> ➔ 특정 재료 분량 확인</p>
            <p>• <span className="font-bold text-white">"5분 타이머"</span> ➔ 주방 타이머 시작</p>
            <p>• <span className="font-bold text-white">"타이머 얼마나 남았어?"</span> ➔ 남은 시간 확인</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onConfirm}
          className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 font-soft text-sm font-black text-white shadow-xl shadow-orange-500/25 hover:from-orange-600 hover:to-amber-600 active:scale-95 transition-all"
        >
          이해했습니다! 요리 시작하기
        </button>
      </div>
    </div>
  );
};
