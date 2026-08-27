/**
 * @file src/components/CloudMigrationModal.tsx
 * @description 로컬 저장 레시피 및 데이터를 Firebase Cloud Firestore로 안전하게 마이그레이션하거나 병합하는 모달
 */

import React from 'react';
import { Cloud, CloudUpload, GitMerge, X, Database, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { MigrationMode } from '../types/firebase';
import { logger } from '../utils/logger';

interface CloudMigrationModalProps {
  /** 모달 열림 여부 */
  isOpen: boolean;
  /** 닫기 / 나중에 핸들러 */
  onClose: () => void;
  /** 마이그레이션 모드 ('initial' | 'conflict') */
  mode: MigrationMode;
  /** 로컬 기기 레시피 개수 */
  localCount: number;
  /** 클라우드에 이미 저장된 레시피 개수 */
  cloudCount: number;
  /** 마이그레이션 진행 중 여부 */
  isMigrating: boolean;
  /** 클라우드로 로컬 데이터 업로드 실행 핸들러 */
  onUploadLocal: () => void;
  /** 클라우드 데이터 우선 사용 핸들러 */
  onUseCloud: () => void;
  /** 로컬과 클라우드 데이터 병합 핸들러 */
  onMerge: () => void;
}

/**
 * 클라우드 데이터 마이그레이션 안내 및 선택 모달
 */
export const CloudMigrationModal: React.FC<CloudMigrationModalProps> = ({
  isOpen,
  onClose,
  mode,
  localCount,
  cloudCount,
  isMigrating,
  onUploadLocal,
  onUseCloud,
  onMerge,
}) => {
  if (!isOpen) return null;

  logger.info('CloudMigrationModal', `마이그레이션 모달 표시 (모드: ${mode}, 로컬: ${localCount}, 클라우드: ${cloudCount})`);

  return (
    <div
      id="cloud-migration-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-xs animate-fade-in"
    >
      <div
        id="cloud-migration-modal-container"
        className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl border border-orange-100 animate-scale-up"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/20 backdrop-blur-xs">
                <Cloud className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight">클라우드 레시피 동기화 안내</h3>
                <p className="text-xs text-orange-100 mt-0.5">
                  {mode === 'initial'
                    ? '기기 속 레시피를 안전하게 클라우드로 백업하세요'
                    : '기기와 클라우드 데이터 동기화 방법을 선택하세요'}
                </p>
              </div>
            </div>
            {!isMigrating && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-white/80 hover:bg-white/20 hover:text-white transition"
                aria-label="닫기"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5">
          {mode === 'initial' ? (
            /* Case 1: 최초 로그인 (로컬에만 데이터 존재, 클라우드는 0개) */
            <div className="space-y-4">
              <div className="rounded-2xl bg-orange-50/80 p-4 border border-orange-100 text-stone-800">
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5">📱</span>
                  <div>
                    <p className="font-bold text-sm text-stone-900">
                      이 기기에 저장된 레시피 <span className="text-orange-600 font-black">{localCount}개</span>가 있습니다.
                    </p>
                    <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                      클라우드에 동기화하시겠습니까? 내 계정 전용 클라우드(개인 보관함)에 안전하게 저장되어 스마트폰과 PC 등 모든 기기에서 동일하게 확인하고 편집할 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-stone-50 p-3.5 border border-stone-200/80 text-xs text-stone-600 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-stone-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>기존 레시피는 절대 삭제되지 않습니다</span>
                </div>
                <p className="pl-6 text-[11px] text-stone-500">
                  동기화 완료 후에도 오프라인 상태에서 언제든지 열람할 수 있습니다.
                </p>
              </div>
            </div>
          ) : (
            /* Case 2: 충돌/둘 다 존재 (로컬과 클라우드 모두 데이터 있음) */
            <div className="space-y-4">
              <p className="text-xs text-stone-600 leading-relaxed">
                현재 기기와 클라우드 양쪽에 모두 레시피가 저장되어 있습니다. 어떤 방식으로 동기화할지 선택해 주세요.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-center">
                  <span className="text-xs font-bold text-stone-500">현재 기기 (로컬)</span>
                  <div className="text-2xl font-black text-stone-900 mt-1">{localCount}개</div>
                </div>
                <div className="rounded-2xl border border-orange-200 bg-orange-50/70 p-4 text-center">
                  <span className="text-xs font-bold text-orange-600">클라우드 (Firestore)</span>
                  <div className="text-2xl font-black text-orange-600 mt-1">{cloudCount}개</div>
                </div>
              </div>

              <p className="text-[11px] text-stone-500 leading-relaxed">
                * <strong>스마트 병합</strong>을 선택하시면 중복되지 않는 레시피를 모두 합치고, 동일한 레시피는 최근 수정한 버전으로 안전하게 보존합니다.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 space-y-2.5">
            {mode === 'initial' ? (
              <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={onUploadLocal}
                  disabled={isMigrating}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 px-4 text-sm font-black text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600 transition disabled:opacity-50"
                >
                  {isMigrating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>클라우드로 업로드 중...</span>
                    </>
                  ) : (
                    <>
                      <CloudUpload className="h-4 w-4" />
                      <span>☁️ Firebase로 가져오기</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isMigrating}
                  className="rounded-2xl border border-stone-200 bg-white py-3.5 px-5 text-sm font-bold text-stone-600 hover:bg-stone-50 transition disabled:opacity-50"
                >
                  나중에
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={onMerge}
                  disabled={isMigrating}
                  className="w-full flex items-center justify-between rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 p-3.5 text-left text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600 transition disabled:opacity-50"
                >
                  <div className="flex items-center gap-2.5">
                    <GitMerge className="h-5 w-5" />
                    <div>
                      <div className="text-sm font-black">로컬 데이터를 클라우드와 병합 (추천)</div>
                      <div className="text-[11px] text-orange-100">양쪽의 레시피를 모두 보존하고 동기화합니다</div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={onUseCloud}
                  disabled={isMigrating}
                  className="w-full flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-3.5 text-left text-stone-700 hover:bg-stone-50 transition disabled:opacity-50"
                >
                  <div className="flex items-center gap-2.5">
                    <Cloud className="h-5 w-5 text-orange-500" />
                    <div>
                      <div className="text-sm font-bold">클라우드 데이터 사용</div>
                      <div className="text-[11px] text-stone-500">Firestore에 저장된 {cloudCount}개 레시피를 로드합니다</div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-stone-400" />
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isMigrating}
                    className="text-xs font-semibold text-stone-500 hover:text-stone-700 py-1"
                  >
                    나중에 선택하기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
