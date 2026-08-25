/**
 * @file src/components/BackupRestoreModal.tsx
 * @description 레시피 데이터의 JSON 파일 백업 다운로드 및 백업 파일 복원(병합/전체교체) 대화상자 컴포넌트
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Download,
  Upload,
  Database,
  FileJson,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Layers,
} from 'lucide-react';
import { Recipe, ShoppingItem } from '../types/recipe';
import { exportBackupJson, restoreBackupData } from '../utils/storage';
import { logger } from '../utils/logger';

interface BackupRestoreModalProps {
  /** 모달 열림 여부 */
  isOpen: boolean;
  /** 현재 레시피 목록 */
  allRecipes: Recipe[];
  /** 현재 즐겨찾기 ID 목록 */
  bookmarks: number[];
  /** 현재 메모 객체 */
  userNotes: Record<number, string>;
  /** 현재 장보기 목록 */
  shoppingList: ShoppingItem[];
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 복원 완료 시 전역 상태 갱신 콜백 */
  onRestoreComplete: (restored: {
    recipes: Recipe[];
    bookmarks: number[];
    userNotes: Record<number, string>;
    shoppingList: ShoppingItem[];
    recentIds: number[];
  }) => void;
  /** 토스트 메시지 표시 함수 */
  showToast: (msg: string) => void;
}

/**
 * 데이터 백업 및 복원 모달 컴포넌트
 */
export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  allRecipes,
  bookmarks,
  userNotes,
  shoppingList,
  onClose,
  onRestoreComplete,
  showToast,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [parsedPreview, setParsedPreview] = useState<{
    recipeCount: number;
    exportedAt?: string;
    version?: string;
  } | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 모달 열림 시 바디 스크롤 락 및 상태 리셋
  useEffect(() => {
    if (isOpen) {
      logger.info('BackupRestoreModal', '백업/복원 모달 열림');
      setSelectedFile(null);
      setFileContent('');
      setParsedPreview(null);
      setIsConfirming(false);
      setErrorMsg('');
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  /**
   * 백업 JSON 파일 다운로드 실행
   */
  const handleExport = (): void => {
    logger.info('BackupRestoreModal.handleExport', '데이터 백업 다운로드 시작');
    try {
      exportBackupJson(allRecipes, bookmarks, userNotes, shoppingList);
      showToast('💾 레시피 백업 파일이 다운로드되었습니다.');
    } catch (err) {
      logger.error('BackupRestoreModal.handleExport', '백업 실패', err);
      showToast('⚠️ 백업 파일 생성 중 오류가 발생했습니다.');
    }
  };

  /**
   * 복원 파일 선택 핸들러
   * @param e 파일 변경 이벤트
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;

    logger.info('BackupRestoreModal.handleFileChange', `복원 파일 선택: ${file.name}`);
    setSelectedFile(file);
    setErrorMsg('');

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        setFileContent(text);
        const parsed = JSON.parse(text);
        if (parsed && Array.isArray(parsed.recipes)) {
          setParsedPreview({
            recipeCount: parsed.recipes.length,
            exportedAt: parsed.exportedAt,
            version: parsed.version,
          });
        } else {
          setErrorMsg('유효한 레시피 백업 JSON 파일이 아닙니다.');
        }
      } catch (err) {
        logger.error('BackupRestoreModal', '파일 파싱 실패', err);
        setErrorMsg('JSON 형식이 올바르지 않습니다.');
      }
    };
    reader.onerror = () => {
      setErrorMsg('파일을 읽는 중 문제가 발생했습니다.');
    };
    reader.readAsText(file);
  };

  /**
   * 복원 실행 핸들러
   */
  const handleExecuteRestore = (): void => {
    if (!fileContent) {
      showToast('⚠️ 먼저 복원할 백업 파일을 선택해주세요.');
      return;
    }

    logger.info('BackupRestoreModal.handleExecuteRestore', `복원 실행 (모드: ${restoreMode})`);
    try {
      const result = restoreBackupData(
        fileContent,
        restoreMode,
        allRecipes,
        bookmarks,
        userNotes,
        shoppingList
      );
      onRestoreComplete(result);
      showToast(
        restoreMode === 'merge'
          ? `🎉 ${result.recipes.length}개의 레시피 데이터가 안전하게 병합되었습니다!`
          : `🎉 ${result.recipes.length}개의 레시피 데이터로 전체 교체되었습니다!`
      );
      onClose();
    } catch (err) {
      logger.error('BackupRestoreModal.handleExecuteRestore', '복원 실패', err);
      const msg = err instanceof Error ? err.message : '복원에 실패했습니다.';
      setErrorMsg(msg);
      showToast(`⚠️ ${msg}`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backupModalTitle"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-scroll max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-7">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-orange-100 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-orange-500 text-white shadow-sm">
              <Database className="h-5 w-5" />
            </span>
            <div>
              <h2 id="backupModalTitle" className="font-soft text-xl font-black text-stone-900">
                데이터 백업 및 복원
              </h2>
              <p className="text-xs font-semibold text-stone-500">
                나만의 소중한 레시피 데이터를 안전하게 보관하세요.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-red-100 hover:text-red-600"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Section 1: Backup Export */}
        <div className="mt-6 rounded-2xl border border-orange-100 bg-[#fffaf3] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-soft text-base font-black text-stone-900">
                📥 레시피 전체 백업 (JSON 다운로드)
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-stone-600">
                현재 등록된 <strong>{allRecipes.length}개의 레시피</strong>, 즐겨찾기, 메모, 장보기 목록을
                단일 JSON 파일로 안전하게 다운로드합니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="mt-4 flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-orange-600"
          >
            <Download className="h-4 w-4" />
            <span>내 레시피 백업 파일 다운로드</span>
          </button>
        </div>

        {/* Section 2: Restore Import */}
        <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h3 className="font-soft text-base font-black text-stone-900">
            📤 백업 파일 복원하기
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-stone-600">
            이전에 다운로드한 레시피 백업 JSON 파일을 선택하여 복원합니다.
          </p>

          <input
            type="file"
            ref={fileInputRef}
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-100"
            >
              <Upload className="h-4 w-4 text-orange-600" />
              <span>JSON 파일 선택</span>
            </button>
            {selectedFile && (
              <span className="flex items-center gap-1 text-xs font-semibold text-stone-600">
                <FileJson className="h-4 w-4 text-orange-500" />
                <span className="truncate max-w-[200px]">{selectedFile.name}</span>
              </span>
            )}
          </div>

          {/* File Verification Preview */}
          {parsedPreview && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-xs text-emerald-900">
              <div className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>유효한 백업 파일이 확인되었습니다: {parsedPreview.recipeCount}개 레시피</span>
              </div>
              {parsedPreview.exportedAt && (
                <p className="mt-1 text-[11px] text-emerald-700">
                  백업 일시: {new Date(parsedPreview.exportedAt).toLocaleString('ko-KR')}
                </p>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
              {errorMsg}
            </div>
          )}

          {/* Mode Selection if file ready */}
          {parsedPreview && (
            <div className="mt-5 border-t border-stone-100 pt-4">
              <label className="block text-xs font-bold text-stone-700 mb-2">복원 방식 선택:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRestoreMode('merge')}
                  className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                    restoreMode === 'merge'
                      ? 'border-orange-500 bg-orange-50/80 ring-2 ring-orange-400'
                      : 'border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <span className="flex items-center gap-1 font-bold text-xs text-stone-900">
                    <Layers className="h-3.5 w-3.5 text-orange-600" />
                    <span>기존 데이터와 병합 (추천)</span>
                  </span>
                  <span className="mt-1 text-[10px] text-stone-500">
                    기존 레시피를 유지하며 백업 파일의 레시피를 합칩니다.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRestoreMode('replace')}
                  className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                    restoreMode === 'replace'
                      ? 'border-red-500 bg-red-50/80 ring-2 ring-red-400'
                      : 'border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <span className="flex items-center gap-1 font-bold text-xs text-red-700">
                    <RefreshCw className="h-3.5 w-3.5 text-red-600" />
                    <span>전체 교체 (덮어쓰기)</span>
                  </span>
                  <span className="mt-1 text-[10px] text-stone-500">
                    현재 데이터를 지우고 백업 파일의 상태로 되돌립니다.
                  </span>
                </button>
              </div>

              {/* Restore Confirmation Button */}
              {!isConfirming ? (
                <button
                  type="button"
                  onClick={() => setIsConfirming(true)}
                  className="mt-4 w-full rounded-xl bg-stone-900 py-3 text-xs font-black text-white shadow-md transition hover:bg-stone-800"
                >
                  {restoreMode === 'merge' ? '데이터 병합 복원하기' : '데이터 전체 교체 복원하기'}
                </button>
              ) : (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-2 text-xs font-bold text-amber-900">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <span>
                      {restoreMode === 'merge'
                        ? '백업 파일의 레시피를 현재 목록에 추가/갱신하시겠습니까?'
                        : '⚠️ 주의: 현재 저장된 레시피가 백업 파일 내용으로 완전히 교체됩니다. 계속하시겠습니까?'}
                    </span>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsConfirming(false)}
                      className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-stone-600 border border-stone-200 hover:bg-stone-50"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleExecuteRestore}
                      className={`rounded-lg px-4 py-1.5 text-xs font-black text-white ${
                        restoreMode === 'replace'
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-orange-600 hover:bg-orange-700'
                      }`}
                    >
                      예, 지금 복원합니다
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
