/**
 * @file src/components/AboutSection.tsx
 * @description 웹앱 주요 기능 소개 및 활용 팁 안내 섹션 컴포넌트
 */

import React from 'react';
import { Search, Scale, Timer, ShoppingBag, Heart, Smartphone } from 'lucide-react';
import { logger } from '../utils/logger';

/**
 * 서비스 기능 안내 섹션 컴포넌트
 */
export const AboutSection: React.FC = () => {
  logger.debug('AboutSection', '이용안내 섹션 렌더링');

  return (
    <section id="about" className="scroll-mt-24 border-y border-orange-100 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-orange-500">
            Features & Guide
          </p>
          <h2 className="mt-2 font-soft text-2xl font-black text-stone-900 sm:text-3xl">
            요리가 쉬워지는 편리한 기능들
          </h2>
          <p className="mt-2 text-sm text-stone-500">
            주방에서 바로 요리하며 쓸 수 있는 스마트한 기능들을 경험해보세요.
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Card 1 */}
          <div className="group rounded-[1.75rem] border border-orange-100 bg-[#fffaf3] p-6 transition duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-950/5">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-500 text-white shadow-sm transition group-hover:scale-110">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="mt-5 font-soft text-lg font-black text-stone-900">
              초고속 통합 검색
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-stone-600">
              음식명뿐만 아니라 '두부', '참치', '진간장' 등 냉장고 속 재료 키워드로 빠르게 레시피를 찾을 수 있습니다.
            </p>
          </div>

          {/* Card 2 */}
          <div className="group rounded-[1.75rem] border border-orange-100 bg-[#fffaf3] p-6 transition duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-950/5">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500 text-white shadow-sm transition group-hover:scale-110">
              <Scale className="h-6 w-6" />
            </div>
            <h3 className="mt-5 font-soft text-lg font-black text-stone-900">
              인분 수 자동 계량 조절
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-stone-600">
              0.5배부터 4배까지 클릭 한 번으로 모든 양념과 주재료의 용량이 수학적으로 자동 계산됩니다.
            </p>
          </div>

          {/* Card 3 */}
          <div className="group rounded-[1.75rem] border border-orange-100 bg-[#fffaf3] p-6 transition duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-950/5">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-500 text-white shadow-sm transition group-hover:scale-110">
              <Timer className="h-6 w-6" />
            </div>
            <h3 className="mt-5 font-soft text-lg font-black text-stone-900">
              집중 조리 모드 & 타이머
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-stone-600">
              스마트폰을 거치해두고 큰 글씨로 1단계씩 확인하며 내장된 스톱워치/키친 타이머로 완벽한 조리시간을 맞춥니다.
            </p>
          </div>

          {/* Card 4 */}
          <div className="group rounded-[1.75rem] border border-orange-100 bg-[#fffaf3] p-6 transition duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-950/5">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500 text-white shadow-sm transition group-hover:scale-110">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <h3 className="mt-5 font-soft text-lg font-black text-stone-900">
              원클릭 장보기 목록
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-stone-600">
              레시피에서 필요한 재료를 장보기 바구니에 바로 담아 마트에서 체크하며 장을 보고 텍스트로 공유할 수 있습니다.
            </p>
          </div>

          {/* Card 5 */}
          <div className="group rounded-[1.75rem] border border-orange-100 bg-[#fffaf3] p-6 transition duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-950/5">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-500 text-white shadow-sm transition group-hover:scale-110">
              <Heart className="h-6 w-6" />
            </div>
            <h3 className="mt-5 font-soft text-lg font-black text-stone-900">
              즐겨찾기 & 나만의 메모
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-stone-600">
              자주 해먹는 메뉴를 찜하고 "우리 집 입맛엔 설탕 반 스푼 덜 넣기" 같은 나만의 꿀팁 메모를 영구 보관합니다.
            </p>
          </div>

          {/* Card 6 */}
          <div className="group rounded-[1.75rem] border border-orange-100 bg-[#fffaf3] p-6 transition duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-950/5">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-lime-600 text-white shadow-sm transition group-hover:scale-110">
              <Smartphone className="h-6 w-6" />
            </div>
            <h3 className="mt-5 font-soft text-lg font-black text-stone-900">
              완전 반응형 모바일 최적화
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-stone-600">
              PC, 태블릿, 스마트폰 등 어떤 화면 크기에서도 깔끔하고 쾌적하게 요리 레시피를 열람할 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
