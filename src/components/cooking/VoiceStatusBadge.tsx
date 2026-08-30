/**
 * @file src/components/cooking/VoiceStatusBadge.tsx
 * @description 핸즈프리 음성 인식 상태, 최근 들은 발화 텍스트 및 명령 실행 피드백을 직관적으로 보여주는 주방용 상태 뱃지 컴포넌트.
 */

import React from 'react';
import { Mic, CheckCircle2, AlertCircle, Volume2 } from 'lucide-react';
import { logger } from '../../utils/logger';

interface VoiceStatusBadgeProps {
  /** 음성인식 활성화 여부 */
  isListening: boolean;
  /** 음성합성(TTS) 말하는 중 여부 */
  isSpeaking: boolean;
  /** 가장 최근에 들은 사용자 발화 */
  lastHeardTranscript: string;
  /** 최근 명령 실행 결과 피드백 */
  lastExecutionFeedback: { text: string; success: boolean; timestamp: number } | null;
  /** 완료 확인 대기 상태 여부 */
  isPendingConfirmation?: boolean;
}

/**
 * 조리 화면 상단/플로팅 음성 상태 인디케이터
 */
export const VoiceStatusBadge: React.FC<VoiceStatusBadgeProps> = ({
  isListening,
  isSpeaking,
  lastHeardTranscript,
  lastExecutionFeedback,
  isPendingConfirmation,
}) => {
  if (!isListening && !isSpeaking && !lastExecutionFeedback && !isPendingConfirmation) {
    return null;
  }

  logger.debug('VoiceStatusBadge', '상태 뱃지 렌더링', {
    isListening,
    isSpeaking,
    lastHeardTranscript,
    lastExecutionFeedback,
  });

  return (
    <div className="flex flex-col items-center gap-1.5 transition-all animate-fade-in pointer-events-none">
      {/* 1. Confirmation Waiting Alert Banner */}
      {isPendingConfirmation && (
        <div className="flex items-center gap-2 rounded-2xl bg-rose-500/90 text-white px-4 py-2 text-xs font-black shadow-lg border border-rose-400 animate-pulse">
          <AlertCircle className="h-4 w-4" />
          <span>⚠️ 요리를 완료할까요? "완료해"라고 말씀해주세요.</span>
        </div>
      )}

      {/* 2. Heard Speech & Feedback Bubble */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {/* Listening / Speaking indicator */}
        {isSpeaking ? (
          <div className="flex items-center gap-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1 text-xs font-bold backdrop-blur-md animate-pulse">
            <Volume2 className="h-3.5 w-3.5" />
            <span>음성 안내 중...</span>
          </div>
        ) : isListening ? (
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-3 py-1 text-xs font-bold backdrop-blur-md">
            <Mic className="h-3.5 w-3.5 animate-bounce" />
            <span>듣는 중...</span>
          </div>
        ) : null}

        {/* Last Heard Transcript */}
        {lastHeardTranscript && (
          <div className="rounded-full bg-stone-900/90 text-stone-200 border border-stone-700 px-3 py-1 text-xs font-medium backdrop-blur-md shadow-sm">
            🎤 "{lastHeardTranscript}"
          </div>
        )}

        {/* Execution Feedback */}
        {lastExecutionFeedback && (
          <div
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold backdrop-blur-md shadow-sm border ${
              lastExecutionFeedback.success
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                : 'bg-rose-950/80 text-rose-300 border-rose-500/50'
            }`}
          >
            {lastExecutionFeedback.success ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
            )}
            <span>{lastExecutionFeedback.text}</span>
          </div>
        )}
      </div>
    </div>
  );
};
