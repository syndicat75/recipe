/**
 * @file src/components/cooking/VoiceAssistantHelpModal.tsx
 * @description 주방 핸즈프리 음성 비서 도움말 및 환경설정 모달.
 * 사용 가능한 한국어 음성명령 예시 목록과 단계 자동 읽기, 타이머 음성 알림, 음성 속도 설정을 제공합니다.
 */

import React from 'react';
import {
  X,
  Mic,
  Volume2,
  Timer,
  ChefHat,
  Sparkles,
  HelpCircle,
  Settings,
  Check,
  Flame,
  List,
} from 'lucide-react';
import { VoiceAssistantSettings } from '../../hooks/useCookingVoiceAssistant';
import { logger } from '../../utils/logger';

interface VoiceAssistantHelpModalProps {
  /** 모달 열림 여부 */
  isOpen: boolean;
  /** 모달 닫기 핸들러 */
  onClose: () => void;
  /** 음성 비서 설정값 */
  settings: VoiceAssistantSettings;
  /** 음성 비서 설정 변경 핸들러 */
  onUpdateSettings: (newSettings: Partial<VoiceAssistantSettings>) => void;
  /** 음성인식 지원 여부 */
  isSupported: boolean;
}

/**
 * 음성 비서 도움말 및 설정 모달 컴포넌트
 */
export const VoiceAssistantHelpModal: React.FC<VoiceAssistantHelpModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  isSupported,
}) => {
  if (!isOpen) return null;

  logger.info('VoiceAssistantHelpModal', '도움말 모달 렌더링');

  const commandGroups = [
    {
      title: '조리 단계 제어',
      icon: <ChefHat className="h-4 w-4 text-orange-400" />,
      items: [
        { cmd: '"다음"', desc: '다음 조리 단계로 이동' },
        { cmd: '"이전" / "뒤로"', desc: '이전 조리 단계로 이동' },
        { cmd: '"다시 읽어줘" / "설명해줘"', desc: '현재 단계 음성 읽기' },
        { cmd: '"지금 몇 단계야?"', desc: '현재 진행 단계 및 총 단계 안내' },
        { cmd: '"처음으로"', desc: '첫 단계로 되돌아가기' },
      ],
    },
    {
      title: '재료 및 분량 질문',
      icon: <List className="h-4 w-4 text-emerald-400" />,
      items: [
        { cmd: '"재료 읽어줘"', desc: '현재 인분 기준 전체 재료 목록 음성 안내' },
        { cmd: '"양파 얼마나 필요해?"', desc: '특정 재료의 현재 인분 맞춤 분량 안내' },
        { cmd: '"간장 얼마나 넣어?"', desc: '양념/재료의 계산된 용량 확인' },
        { cmd: '"대파 몇 개야?" / "계란 몇 개야?"', desc: '개수 및 단위 보존 답변' },
      ],
    },
    {
      title: '주방 타이머 제어',
      icon: <Timer className="h-4 w-4 text-amber-400" />,
      items: [
        { cmd: '"5분 타이머"', desc: '5분 타이머 생성 및 시작' },
        { cmd: '"계란 7분 타이머"', desc: '이름(라벨)이 지정된 타이머 시작' },
        { cmd: '"타이머 얼마나 남았어?"', desc: '진행 중인 모든 타이머의 남은 시간 안내' },
        { cmd: '"타이머 멈춰" / "일시정지"', desc: '타이머 일시 정지' },
        { cmd: '"타이머 계속" / "재개"', desc: '정지된 타이머 재시작' },
        { cmd: '"타이머 취소" / "삭제"', desc: '타이머 삭제' },
      ],
    },
    {
      title: '화면 조작 및 요리 완료',
      icon: <Flame className="h-4 w-4 text-rose-400" />,
      items: [
        { cmd: '"재료 보여줘" / "재료 닫아줘"', desc: '우측 재료 사이드바 열기/닫기' },
        { cmd: '"요리 완료" ➔ "완료해"', desc: '안전한 2단계 확인 후 요리 완료 처리' },
        { cmd: '"마이크 꺼" / "듣기 그만"', desc: '음성명령 청취 종료' },
      ],
    },
  ];

  return (
    <div
      id="voice-assistant-help-modal"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-3xl border border-stone-800 bg-stone-900 text-stone-100 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 px-6 py-4 bg-stone-950/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
              <Mic className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-soft text-base font-bold text-white">핸즈프리 음성명령 안내</h2>
              <p className="text-xs text-stone-400">손에 양념이 묻어도 목소리로 편하게 요리하세요</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-stone-400 hover:bg-stone-800 hover:text-white transition-all"
            aria-label="도움말 닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!isSupported && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-950/30 p-4 text-xs text-amber-300">
              ⚠️ 현재 브라우저에서는 음성 인식(SpeechRecognition)이 지원되지 않거나 마이크 권한이 차단되어 있습니다. 화면 버튼으로 조리모드를 정상 이용하실 수 있습니다.
            </div>
          )}

          {/* Settings Section */}
          <div className="rounded-2xl border border-stone-800 bg-stone-950/50 p-4 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-stone-300 border-b border-stone-800 pb-2">
              <Settings className="h-4 w-4 text-orange-400" />
              <span>음성비서 환경설정</span>
            </div>

            <div className="space-y-3 text-xs">
              {/* Option 1: Auto read on step change */}
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-stone-300 group-hover:text-white transition-colors">
                  단계 이동 시 조리문장 자동 읽기
                </span>
                <input
                  type="checkbox"
                  checked={settings.autoReadNextStep}
                  onChange={(e) => onUpdateSettings({ autoReadNextStep: e.target.checked })}
                  className="h-4 w-4 rounded accent-orange-500 cursor-pointer"
                />
              </label>

              {/* Option 2: Voice alert on timer finish */}
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-stone-300 group-hover:text-white transition-colors">
                  타이머 완료 시 음성(TTS)으로 알려주기
                </span>
                <input
                  type="checkbox"
                  checked={settings.voiceTimerAlert}
                  onChange={(e) => onUpdateSettings({ voiceTimerAlert: e.target.checked })}
                  className="h-4 w-4 rounded accent-orange-500 cursor-pointer"
                />
              </label>

              {/* Option 3: Speech Rate */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-stone-300">음성 읽기 속도</span>
                <div className="flex items-center gap-1 bg-stone-800 p-1 rounded-xl">
                  {[
                    { label: '느리게', rate: 0.85 },
                    { label: '보통', rate: 0.95 },
                    { label: '빠르게', rate: 1.1 },
                  ].map((opt) => (
                    <button
                      key={opt.rate}
                      type="button"
                      onClick={() => onUpdateSettings({ speechRate: opt.rate })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        Math.abs(settings.speechRate - opt.rate) < 0.05
                          ? 'bg-orange-500 text-white shadow-sm'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Commands List */}
          <div className="space-y-4">
            <div className="text-xs font-bold text-stone-400 uppercase tracking-wider">
              이렇게 말해보세요 🗣️
            </div>

            {commandGroups.map((group, gIdx) => (
              <div key={gIdx} className="rounded-2xl border border-stone-800 bg-stone-950/30 p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-stone-200">
                  {group.icon}
                  <span>{group.title}</span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {group.items.map((item, iIdx) => (
                    <div
                      key={iIdx}
                      className="flex items-center justify-between rounded-xl bg-stone-800/50 px-3 py-2 text-xs"
                    >
                      <span className="font-bold text-orange-300">{item.cmd}</span>
                      <span className="text-stone-400">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-stone-800 px-6 py-4 bg-stone-950/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl bg-orange-500 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-500/20 hover:bg-orange-600 active:scale-95 transition-all"
          >
            확인 및 닫기
          </button>
        </div>
      </div>
    </div>
  );
};
