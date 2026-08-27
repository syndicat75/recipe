/**
 * @file src/components/PwaInstallModal.tsx
 * @description 모바일/브라우저별(iOS Safari, Samsung Internet, 기타) PWA 앱 설치 상세 안내 모달
 */

import React, { useState } from 'react';
import {
  X,
  Share,
  PlusSquare,
  Smartphone,
  CheckCircle2,
  HelpCircle,
  Compass,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { PwaEnvironmentInfo } from '../utils/pwaHelper';

interface PwaInstallModalProps {
  /** 모달 열림 여부 */
  isOpen: boolean;
  /** 닫기 핸들러 */
  onClose: () => void;
  /** PWA 환경 정보 */
  pwaEnv: PwaEnvironmentInfo;
}

export const PwaInstallModal: React.FC<PwaInstallModalProps> = ({
  isOpen,
  onClose,
  pwaEnv,
}) => {
  // 기본 탭 결정: iOS면 ios, 삼성브라우저면 samsung, 그 외면 other
  const initialTab = pwaEnv.isIOS
    ? 'ios'
    : pwaEnv.isSamsungBrowser
    ? 'samsung'
    : 'other';

  const [activeTab, setActiveTab] = useState<'samsung' | 'ios' | 'other'>(initialTab);

  if (!isOpen) return null;

  return (
    <div
      id="pwa-install-modal-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/60 p-0 sm:p-4 backdrop-blur-xs animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="pwa-install-modal-content"
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[#fffaf3] border border-orange-200/80 shadow-2xl overflow-hidden animate-slide-up sm:animate-scale-up"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-4 text-white">
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
              onClick={onClose}
              className="rounded-full p-1.5 text-white/80 hover:bg-white/20 transition"
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Browser Tab Selector */}
          <div className="mt-3 flex rounded-xl bg-black/10 p-1 text-xs font-bold">
            <button
              type="button"
              id="pwa-tab-samsung"
              onClick={() => setActiveTab('samsung')}
              className={`flex-1 rounded-lg py-1.5 text-center transition ${
                activeTab === 'samsung'
                  ? 'bg-white text-orange-600 shadow-xs'
                  : 'text-orange-100 hover:text-white'
              }`}
            >
              삼성 인터넷
            </button>
            <button
              type="button"
              id="pwa-tab-ios"
              onClick={() => setActiveTab('ios')}
              className={`flex-1 rounded-lg py-1.5 text-center transition ${
                activeTab === 'ios'
                  ? 'bg-white text-orange-600 shadow-xs'
                  : 'text-orange-100 hover:text-white'
              }`}
            >
              아이폰 / iPad
            </button>
            <button
              type="button"
              id="pwa-tab-other"
              onClick={() => setActiveTab('other')}
              className={`flex-1 rounded-lg py-1.5 text-center transition ${
                activeTab === 'other'
                  ? 'bg-white text-orange-600 shadow-xs'
                  : 'text-orange-100 hover:text-white'
              }`}
            >
              기타 브라우저
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* App Preview Card */}
          <div className="flex items-center gap-3 rounded-2xl bg-white p-3.5 border border-orange-100 shadow-2xs">
            <div className="relative">
              <img
                src="/icons/icon-192.png"
                alt="내 입맛 레시피"
                className="h-12 w-12 rounded-2xl shadow-xs border border-orange-200"
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

          {/* Tab 1: Samsung Internet Guide */}
          {activeTab === 'samsung' && (
            <div className="space-y-3 animate-fade-in" id="pwa-guide-samsung">
              <div className="rounded-2xl bg-orange-50/80 p-4 border border-orange-200/70">
                <h4 className="font-soft text-xs font-black text-orange-950 flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4 text-orange-600" />
                  <span>삼성 인터넷 브라우저 설치 방법</span>
                </h4>
                <p className="mt-1 text-[11px] text-orange-900/80 leading-relaxed">
                  삼성 인터넷 메뉴(<strong>☰</strong> 또는 <strong>⋮</strong>)를 누른 뒤 아래 항목을 선택해주세요.
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-3 rounded-xl bg-white p-3 border border-stone-200/70 shadow-2xs">
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-orange-100 font-black text-orange-700 text-xs">
                    1
                  </div>
                  <div>
                    <div className="font-bold text-stone-800">
                      하단 또는 상단 우측 메뉴 버튼(☰ 또는 ⋮) 클릭
                    </div>
                    <div className="text-[11px] text-stone-500">
                      삼성 인터넷 화면의 더보기/메뉴를 누릅니다.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-white p-3 border border-stone-200/70 shadow-2xs">
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-orange-100 font-black text-orange-700 text-xs">
                    2
                  </div>
                  <div>
                    <div className="font-bold text-stone-800">
                      <span className="text-orange-600">‘페이지 추가’</span> 또는 <span className="text-orange-600">‘앱 화면에 추가 / 홈 화면에 추가’</span> 선택
                    </div>
                    <div className="text-[11px] text-stone-500">
                      버전에 따라 '현재 페이지 추가' → '홈 화면'으로 나타납니다.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-white p-3 border border-stone-200/70 shadow-2xs">
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 font-black text-emerald-700 text-xs">
                    3
                  </div>
                  <div>
                    <div className="font-bold text-stone-800">
                      ‘추가’를 누르면 홈 화면에 앱 아이콘이 생성됩니다
                    </div>
                    <div className="text-[11px] text-stone-500">
                      이제 바탕화면에서 터치 한 번으로 주소창 없이 실행됩니다.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: iOS Safari Guide */}
          {activeTab === 'ios' && (
            <div className="space-y-3 animate-fade-in" id="pwa-guide-ios">
              <div className="rounded-2xl bg-orange-50/80 p-4 border border-orange-200/70">
                <h4 className="font-soft text-xs font-black text-orange-950 flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4 text-orange-600" />
                  <span>iPhone / iPad (Safari) 설치 방법</span>
                </h4>
                <p className="mt-1 text-[11px] text-orange-900/80 leading-relaxed">
                  Safari 브라우저의 공유 메뉴를 통해 홈 화면에 간편하게 추가할 수 있습니다.
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-3 rounded-xl bg-white p-3 border border-stone-200/70 shadow-2xs">
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-orange-100 font-black text-orange-700 text-xs">
                    1
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-stone-800 flex items-center gap-1.5">
                      <span>Safari 하단 중앙의 <strong>공유 버튼</strong>(</span>
                      <Share className="h-4 w-4 text-sky-600 inline" />
                      <span>)을 터치합니다.</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-white p-3 border border-stone-200/70 shadow-2xs">
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-orange-100 font-black text-orange-700 text-xs">
                    2
                  </div>
                  <div>
                    <div className="font-bold text-stone-800 flex items-center gap-1.5">
                      <span>아래로 스크롤하여 <strong className="text-orange-600">‘홈 화면에 추가’</strong>(</span>
                      <PlusSquare className="h-4 w-4 text-stone-700 inline" />
                      <span>)를 선택합니다.</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-white p-3 border border-stone-200/70 shadow-2xs">
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 font-black text-emerald-700 text-xs">
                    3
                  </div>
                  <div>
                    <div className="font-bold text-stone-800">
                      우측 상단의 <strong>‘추가’</strong> 버튼을 누릅니다.
                    </div>
                    <div className="text-[11px] text-stone-500">
                      홈 화면에 '내입맛레시피' 앱 아이콘이 바로 생성됩니다.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Other Mobile Browsers Fallback Guide */}
          {activeTab === 'other' && (
            <div className="space-y-3 animate-fade-in" id="pwa-guide-other">
              <div className="rounded-2xl bg-amber-50/90 p-4 border border-amber-200/80">
                <h4 className="font-soft text-xs font-black text-amber-950 flex items-center gap-1.5">
                  <HelpCircle className="h-4 w-4 text-amber-600" />
                  <span>수동 홈 화면 추가 안내</span>
                </h4>
                <p className="mt-1 text-[11px] text-amber-900/80 leading-relaxed">
                  현재 사용 중인 브라우저에서는 자동 설치 팝업을 지원하지 않을 수 있습니다. 브라우저 메뉴를 통해 홈 화면에 추가해주세요.
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-3 rounded-xl bg-white p-3 border border-stone-200/70 shadow-2xs">
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-orange-100 font-black text-orange-700 text-xs">
                    1
                  </div>
                  <div>
                    <div className="font-bold text-stone-800">
                      브라우저 우측 상단/하단의 더보기 메뉴(⋮ 또는 ☰)를 누릅니다.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-white p-3 border border-stone-200/70 shadow-2xs">
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-orange-100 font-black text-orange-700 text-xs">
                    2
                  </div>
                  <div>
                    <div className="font-bold text-stone-800">
                      <span className="text-orange-600">‘홈 화면에 추가’</span> 또는 <span className="text-orange-600">‘앱 설치’</span> 메뉴를 선택합니다.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-white p-3 border border-stone-200/70 shadow-2xs">
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 font-black text-emerald-700 text-xs">
                    3
                  </div>
                  <div>
                    <div className="font-bold text-stone-800">
                      안내 팝업에서 ‘설치/추가’를 누르면 완료됩니다.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Benefits summary badge */}
          <div className="rounded-xl bg-orange-100/50 p-3 text-[11px] text-stone-700 flex items-center gap-2 border border-orange-200/50">
            <Sparkles className="h-4 w-4 text-orange-500 shrink-0" />
            <span>설치 후에는 인터넷이 불안정해도 저장된 레시피와 식단을 바로 열람할 수 있습니다.</span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-stone-50 px-5 py-3.5 border-t border-stone-100 flex items-center justify-end">
          <button
            type="button"
            id="pwa-modal-confirm-btn"
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl bg-orange-500 px-6 py-2.5 text-xs font-black text-white shadow-md hover:bg-orange-600 active:scale-95 transition"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};
