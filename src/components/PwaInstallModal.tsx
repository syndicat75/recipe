/**
 * @file src/components/PwaInstallModal.tsx
 * @description 플랫폼 및 브라우저별(Android Chrome, Samsung Internet, iOS Safari, 기타) PWA 앱 설치 안내 모달 컴포넌트
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Share,
  PlusSquare,
  Smartphone,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  Compass,
} from 'lucide-react';
import { PwaEnvironmentInfo } from '../utils/pwaHelper';
import { logger } from '../utils/logger';

interface PwaInstallModalProps {
  /** 모달 열림 여부 */
  isOpen: boolean;
  /** 닫기 핸들러 */
  onClose: () => void;
  /** PWA 환경 정보 */
  pwaEnv: PwaEnvironmentInfo;
}

type TabType = 'chrome' | 'samsung' | 'ios' | 'other';

/**
 * PWA 설치 안내 모달 컴포넌트
 * Android Chrome, Samsung Internet, iOS Safari, 기타 브라우저별 최적화된 설치 가이드를 제공합니다.
 * @param props PwaInstallModalProps
 * @returns React.FC
 */
export const PwaInstallModal: React.FC<PwaInstallModalProps> = ({
  isOpen,
  onClose,
  pwaEnv,
}) => {
  /**
   * 브라우저 환경에 따라 초기 활성화 탭을 계산합니다.
   * @param env PwaEnvironmentInfo
   * @returns TabType
   */
  const getInitialTab = (env: PwaEnvironmentInfo): TabType => {
    logger.debug('PwaInstallModal.getInitialTab', '초기 탭 계산 시작', env);
    if (env.isIOS) return 'ios';
    if (env.isSamsungBrowser) return 'samsung';
    if (env.isAndroid || env.isChrome) return 'chrome';
    return 'other';
  };

  const [activeTab, setActiveTab] = useState<TabType>(() => getInitialTab(pwaEnv));

  // 환경 정보가 바뀌거나 모달이 열릴 때 기본 탭 재동기화
  useEffect(() => {
    if (isOpen) {
      const tab = getInitialTab(pwaEnv);
      logger.info('PwaInstallModal.useEffect', `모달 열림: 기본 탭 '${tab}' 설정`);
      setActiveTab(tab);
    }
  }, [isOpen, pwaEnv]);

  /**
   * 탭 전환 핸들러
   * @param tab 변경할 탭 ID
   */
  const handleTabChange = (tab: TabType): void => {
    logger.info('PwaInstallModal.handleTabChange', `탭 전환: ${activeTab} -> ${tab}`);
    setActiveTab(tab);
  };

  /**
   * 모달 닫기 핸들러
   */
  const handleClose = (): void => {
    logger.info('PwaInstallModal.handleClose', 'PWA 설치 안내 모달 닫기');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      id="pwa-install-modal-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/60 p-0 sm:p-4 backdrop-blur-xs animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        id="pwa-install-modal-content"
        className="w-full max-w-md max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[#fffaf3] border border-orange-200/80 shadow-2xl overflow-hidden animate-slide-up sm:animate-scale-up"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-4 text-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/20 text-lg shadow-inner">
                📲
              </div>
              <div>
                <h3 className="font-soft text-base font-black tracking-tight">
                  내 입맛 레시피 앱 설치
                </h3>
                <p className="text-[11px] text-orange-100 font-medium">
                  홈 화면에 추가하여 앱처럼 편리하게 이용하세요
                </p>
              </div>
            </div>
            <button
              type="button"
              id="pwa-modal-close-btn"
              onClick={handleClose}
              className="rounded-full p-1.5 text-white/80 hover:bg-white/20 active:scale-95 transition"
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Browser Tab Selector (가로 스크롤 가능하게 처리하여 좁은 화면에서도 탭이 잘리지 않음) */}
          <div className="mt-3 flex overflow-x-auto no-scrollbar gap-1 rounded-xl bg-black/10 p-1 text-[11px] font-bold">
            <button
              type="button"
              id="pwa-tab-chrome"
              onClick={() => handleTabChange('chrome')}
              className={`flex-1 min-w-[76px] rounded-lg py-1.5 px-2 text-center whitespace-nowrap transition ${
                activeTab === 'chrome'
                  ? 'bg-white text-orange-600 shadow-xs font-black'
                  : 'text-orange-100 hover:text-white'
              }`}
            >
              Chrome
            </button>
            <button
              type="button"
              id="pwa-tab-samsung"
              onClick={() => handleTabChange('samsung')}
              className={`flex-1 min-w-[76px] rounded-lg py-1.5 px-2 text-center whitespace-nowrap transition ${
                activeTab === 'samsung'
                  ? 'bg-white text-orange-600 shadow-xs font-black'
                  : 'text-orange-100 hover:text-white'
              }`}
            >
              삼성 인터넷
            </button>
            <button
              type="button"
              id="pwa-tab-ios"
              onClick={() => handleTabChange('ios')}
              className={`flex-1 min-w-[84px] rounded-lg py-1.5 px-2 text-center whitespace-nowrap transition ${
                activeTab === 'ios'
                  ? 'bg-white text-orange-600 shadow-xs font-black'
                  : 'text-orange-100 hover:text-white'
              }`}
            >
              iPhone/Safari
            </button>
            <button
              type="button"
              id="pwa-tab-other"
              onClick={() => handleTabChange('other')}
              className={`flex-1 min-w-[76px] rounded-lg py-1.5 px-2 text-center whitespace-nowrap transition ${
                activeTab === 'other'
                  ? 'bg-white text-orange-600 shadow-xs font-black'
                  : 'text-orange-100 hover:text-white'
              }`}
            >
              기타 브라우저
            </button>
          </div>
        </div>

        {/* Modal Body (스크롤 가능) */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 text-stone-800">
          {/* App Preview Card */}
          <div className="flex items-center gap-3 rounded-2xl bg-white p-3.5 border border-orange-100 shadow-2xs">
            <div className="relative shrink-0">
              <img
                src="/icons/icon-192.png"
                alt="내 입맛 레시피"
                className="h-12 w-12 rounded-2xl shadow-xs border border-orange-200 object-cover"
              />
              <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-orange-500 text-[10px] text-white font-bold">
                ✓
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-soft text-sm font-black text-stone-900 truncate">
                내 입맛 레시피
              </div>
              <div className="text-[11px] text-stone-500 truncate">
                오프라인 캐시 • 전체화면 실행 • 빠른 로딩
              </div>
            </div>
          </div>

          {/* Tab 1: Android Chrome Guide */}
          {activeTab === 'chrome' && (
            <div className="space-y-3 animate-fade-in" id="pwa-guide-chrome">
              <div className="rounded-2xl bg-orange-50/80 p-3.5 border border-orange-200/70">
                <h4 className="font-soft text-xs font-black text-orange-950 flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4 text-orange-600" />
                  <span>Android Chrome 설치 안내</span>
                </h4>
                <p className="mt-1 text-[11px] text-orange-900/80 leading-relaxed">
                  자동 설치창이 나타나지 않은 경우, Chrome 브라우저 메뉴를 통해 바로 설치할 수 있습니다.
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-3 rounded-xl bg-white p-3 border border-stone-200/70 shadow-2xs">
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-orange-100 font-black text-orange-700 text-xs">
                    1
                  </div>
                  <div>
                    <div className="font-bold text-stone-800">
                      Chrome 우측 상단의 메뉴(<strong>⋮</strong>)를 누르세요.
                    </div>
                    <div className="text-[11px] text-stone-500 mt-0.5">
                      주소창 오른쪽 세로 점 3개 아이콘을 터치합니다.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-white p-3 border border-stone-200/70 shadow-2xs">
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-orange-100 font-black text-orange-700 text-xs">
                    2
                  </div>
                  <div>
                    <div className="font-bold text-stone-800">
                      <span className="text-orange-600">‘홈 화면에 추가’</span> 또는 <span className="text-orange-600">‘앱 설치’</span>를 선택해주세요.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-white p-3 border border-stone-200/70 shadow-2xs">
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 font-black text-emerald-700 text-xs">
                    3
                  </div>
                  <div>
                    <div className="font-bold text-stone-800">
                      설치 확인 팝업에서 <strong>‘설치’</strong>를 누르면 완료됩니다.
                    </div>
                    <div className="text-[11px] text-stone-500 mt-0.5">
                      홈 화면과 앱 서랍에 내 입맛 레시피 앱이 추가됩니다.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Samsung Internet Guide */}
          {activeTab === 'samsung' && (
            <div className="space-y-3 animate-fade-in" id="pwa-guide-samsung">
              <div className="rounded-2xl bg-orange-50/80 p-3.5 border border-orange-200/70">
                <h4 className="font-soft text-xs font-black text-orange-950 flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4 text-orange-600" />
                  <span>삼성 인터넷 앱 설치 안내</span>
                </h4>
                <p className="mt-1 text-[11px] text-orange-900/80 leading-relaxed">
                  삼성 인터넷에서는 브라우저 메뉴를 통해 홈 화면에 바로 앱을 추가할 수 있습니다.
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-3 rounded-xl bg-white p-3 border border-stone-200/70 shadow-2xs">
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-orange-100 font-black text-orange-700 text-xs">
                    1
                  </div>
                  <div>
                    <div className="font-bold text-stone-800">
                      브라우저 우측 하단 <strong>☰ 메뉴</strong> 터치
                    </div>
                    <div className="text-[11px] text-stone-500 mt-0.5">
                      삼성 인터넷 오른쪽 아래의 삼선(☰) 메뉴 버튼을 누릅니다.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-white p-3 border border-stone-200/70 shadow-2xs">
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-orange-100 font-black text-orange-700 text-xs">
                    2
                  </div>
                  <div>
                    <div className="font-bold text-stone-800">
                      <span className="text-orange-600">‘현재 페이지 추가’</span> 또는 <span className="text-orange-600">‘앱 추가’</span> 선택
                    </div>
                    <div className="text-[11px] text-stone-500 mt-0.5">
                      메뉴 목록에서 페이지 추가 또는 앱 추가를 선택합니다.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-white p-3 border border-stone-200/70 shadow-2xs">
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 font-black text-emerald-700 text-xs">
                    3
                  </div>
                  <div>
                    <div className="font-bold text-stone-800">
                      <span className="text-emerald-700">‘홈 화면’</span>을 선택해 추가
                    </div>
                    <div className="text-[11px] text-stone-500 mt-0.5">
                      홈 화면에 내 입맛 레시피 아이콘이 생성됩니다.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: iOS Safari Guide */}
          {activeTab === 'ios' && (
            <div className="space-y-3 animate-fade-in" id="pwa-guide-ios">
              <div className="rounded-2xl bg-orange-50/80 p-3.5 border border-orange-200/70">
                <h4 className="font-soft text-xs font-black text-orange-950 flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4 text-orange-600" />
                  <span>📱 iPhone에 앱 설치</span>
                </h4>
                <p className="mt-1 text-[11px] text-orange-900/80 leading-relaxed">
                  Safari의 공유 메뉴를 통해 일반 앱과 동일하게 사용할 수 있습니다.
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-3 rounded-xl bg-white p-3 border border-stone-200/70 shadow-2xs">
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-orange-100 font-black text-orange-700 text-xs">
                    1
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-stone-800 flex items-center gap-1.5">
                      <span>Safari 하단 공유 버튼(</span>
                      <Share className="h-4 w-4 text-sky-600 inline" />
                      <span><strong>□↑</strong>) 터치</span>
                    </div>
                    <div className="text-[11px] text-stone-500 mt-0.5">
                      Safari 브라우저 하단 바 중앙에 있는 공유 아이콘을 누릅니다.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-white p-3 border border-stone-200/70 shadow-2xs">
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-orange-100 font-black text-orange-700 text-xs">
                    2
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-stone-800 flex items-center gap-1.5">
                      <span>→ <strong className="text-orange-600">‘홈 화면에 추가’</strong> 선택</span>
                    </div>
                    <div className="text-[11px] text-stone-500 mt-0.5">
                      공유 시트 메뉴를 아래로 스크롤하여 ‘홈 화면에 추가’를 선택합니다.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-white p-3 border border-stone-200/70 shadow-2xs">
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 font-black text-emerald-700 text-xs">
                    3
                  </div>
                  <div>
                    <div className="font-bold text-stone-800">
                      우측 상단 <strong>‘추가’</strong> 터치
                    </div>
                    <div className="text-[11px] text-stone-500 mt-0.5">
                      이제 홈 화면에서 일반 앱처럼 바로 실행할 수 있습니다.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Other Mobile Browsers Fallback Guide */}
          {activeTab === 'other' && (
            <div className="space-y-3 animate-fade-in" id="pwa-guide-other">
              <div className="rounded-2xl bg-amber-50/90 p-3.5 border border-amber-200/80">
                <h4 className="font-soft text-xs font-black text-amber-950 flex items-center gap-1.5">
                  <HelpCircle className="h-4 w-4 text-amber-600" />
                  <span>기타 브라우저 앱 설치 안내</span>
                </h4>
                <p className="mt-1 text-[11px] text-amber-900/90 leading-relaxed font-semibold">
                  이 브라우저에서는 자동 설치창을 표시할 수 없습니다.
                </p>
              </div>

              <div className="rounded-xl bg-white p-3.5 border border-stone-200/70 shadow-2xs space-y-2 text-xs">
                <div className="font-bold text-stone-800">
                  브라우저 메뉴에서 아래 항목을 선택해주세요:
                </div>
                <div className="space-y-1.5 pl-2 text-stone-700 font-medium">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-orange-500 shrink-0" />
                    <span><strong>‘홈 화면에 추가’</strong></span>
                  </div>
                  <div className="text-stone-400 text-[10px] pl-6 font-normal">또는</div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-orange-500 shrink-0" />
                    <span><strong>‘앱 설치’</strong></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Benefits summary badge */}
          <div className="rounded-xl bg-orange-100/50 p-2.5 text-[11px] text-stone-700 flex items-center gap-2 border border-orange-200/50">
            <Sparkles className="h-4 w-4 text-orange-500 shrink-0" />
            <span>설치 후에는 인터넷이 끊겨도 저장된 레시피와 식단을 바로 열람할 수 있습니다.</span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-stone-50 px-5 py-3 border-t border-stone-100 flex items-center justify-end shrink-0">
          <button
            type="button"
            id="pwa-modal-confirm-btn"
            onClick={handleClose}
            className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-2.5 text-xs font-black text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600 active:scale-95 transition"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};
