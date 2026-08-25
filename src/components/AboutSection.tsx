/**
 * @file src/components/AboutSection.tsx
 * @description 웹앱 주요 기능 소개 및 활용 팁 안내 섹션 컴포넌트
 */

import React from 'react';
import { Search, Scale, Timer, ShoppingBag, Sparkles, Smartphone, Download, HelpCircle } from 'lucide-react';
import { logger } from '../utils/logger';

interface AboutSectionProps {
  /** AI 요리사 화면으로 이동 핸들러 */
  onNavigateToAiChef?: () => void;
  /** 장보기 모달 열기 핸들러 */
  onOpenShoppingList?: () => void;
  /** 외부 레시피 가져오기 모달 열기 핸들러 */
  onOpenImportRecipe?: () => void;
  /** PWA 설치 핸들러 */
  onInstallPwa?: () => void;
  /** PWA 설치 가능 여부 */
  canInstallPwa?: boolean;
}

/**
 * 서비스 기능 안내 섹션 컴포넌트
 */
export const AboutSection: React.FC<AboutSectionProps> = ({
  onNavigateToAiChef,
  onOpenShoppingList,
  onOpenImportRecipe,
  onInstallPwa,
  canInstallPwa,
}) => {
  logger.debug('AboutSection', '이용안내 섹션 렌더링');

  return (
    <section id="about" className="scroll-mt-24 border-y border-orange-100 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-orange-500">
            Features & Smart Tools
          </p>
          <h2 className="mt-2 font-soft text-2xl font-black text-stone-900 sm:text-3xl">
            요리가 쉬워지는 스마트 레시피 북
          </h2>
          <p className="mt-2 text-sm text-stone-500">
            주방에서 바로 요리하며 스마트하게 쓸 수 있는 편리한 기능들을 경험해보세요.
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: 장보기 목록 */}
          <div
            onClick={onOpenShoppingList}
            className="group flex flex-col justify-between rounded-[1.75rem] border border-orange-100 bg-[#fffaf3] p-6 transition duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-950/5 cursor-pointer"
          >
            <div>
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-500 text-white shadow-sm transition group-hover:scale-110">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-soft text-lg font-black text-stone-900">
                🛒 스마트 장보기 목록
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-stone-600">
                레시피에서 필요한 재료를 장보기 바구니에 담아 마트에서 체크하고 전체 복사로 가족에게 공유할 수 있습니다.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-orange-200/40 text-xs font-bold text-orange-600 group-hover:text-orange-700">
              장보기 목록 열기 →
            </div>
          </div>

          {/* Card 2: 외부 레시피 AI 가져오기 */}
          <div
            onClick={onOpenImportRecipe}
            className="group flex flex-col justify-between rounded-[1.75rem] border border-orange-100 bg-[#fffaf3] p-6 transition duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-950/5 cursor-pointer"
          >
            <div>
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500 text-white shadow-sm transition group-hover:scale-110">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-soft text-lg font-black text-stone-900">
                📥 외부 레시피 AI 가져오기
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-stone-600">
                블로그 URL이나 요리 텍스트를 붙여넣으면 Gemini AI가 재료와 조리순서로 자동 정리해 내 요리책에 저장합니다.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-orange-200/40 text-xs font-bold text-amber-600 group-hover:text-amber-700">
              레시피 가져오기 →
            </div>
          </div>

          {/* Card 3: AI 요리사 Q&A (Requirement 3: 전체 클릭 가능한 기능 진입점) */}
          <div
            onClick={() => {
              logger.info('AboutSection', 'AI 요리사 카드 클릭 -> AI 화면 이동');
              if (onNavigateToAiChef) onNavigateToAiChef();
            }}
            className="group flex flex-col justify-between rounded-[1.75rem] border-2 border-orange-300/80 bg-gradient-to-b from-[#fffaf3] to-orange-50/60 p-6 transition duration-300 hover:-translate-y-1.5 hover:border-orange-400 hover:shadow-xl hover:shadow-orange-500/10 cursor-pointer relative overflow-hidden"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-tr from-rose-500 to-orange-500 text-white shadow-sm transition group-hover:scale-110">
                  <HelpCircle className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-[10px] font-black text-orange-800">
                  실시간 질문
                </span>
              </div>
              <h3 className="mt-5 font-soft text-lg font-black text-stone-900">
                ✨ AI 요리사 Q&A
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-stone-600">
                "대체 재료는?", "더 맛있게 만드는 셰프 비법은?" 등 레시피에 관해 무엇이든 물어보고 메모로 저장하세요.
              </p>
            </div>

            {/* 명확한 액션 버튼 */}
            <div className="mt-5 pt-3 border-t border-orange-200/60">
              <button
                type="button"
                className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-2 px-3 text-xs font-bold text-white shadow-xs transition group-hover:from-orange-600 group-hover:to-amber-600"
              >
                <span>AI 요리사에게 물어보기 →</span>
              </button>
            </div>
          </div>

          {/* Card 4: PWA 오프라인 사용 */}
          <div
            onClick={canInstallPwa && onInstallPwa ? onInstallPwa : undefined}
            className={`group flex flex-col justify-between rounded-[1.75rem] border border-orange-100 bg-[#fffaf3] p-6 transition duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-950/5 ${
              canInstallPwa && onInstallPwa ? 'cursor-pointer' : ''
            }`}
          >
            <div>
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500 text-white shadow-sm transition group-hover:scale-110">
                <Download className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-soft text-lg font-black text-stone-900">
                📱 PWA & 오프라인 사용
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-stone-600">
                홈 화면에 앱으로 바로 설치하고, 인터넷 연결이 불안정한 환경에서도 저장된 레시피와 장보기 목록을 안심하고 사용하세요.
              </p>
            </div>
            {canInstallPwa && onInstallPwa && (
              <div className="mt-4 pt-3 border-t border-emerald-200/40 text-xs font-bold text-emerald-600 group-hover:text-emerald-700">
                홈 화면에 설치하기 →
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
