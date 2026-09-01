/**
 * @file src/components/BackupRestoreModal.tsx
 * @description 레시피 데이터의 Excel(.xlsx) 및 JSON 백업 다운로드 및 복원 대화상자 컴포넌트.
 * 
 * - Excel (.xlsx) 시트 구조 (Sheet 1: 레시피, Sheet 2: 재료, Sheet 3: _metadata)
 * - 파일 형식 검증 및 오류 메시지 ('이 파일은 레시피 앱에서 생성한 정상적인 백업 파일이 아닙니다.')
 * - 복원 전 미리보기 (총 레시피, 총 재료, 신규/중복 통계)
 * - 3가지 중복 처리 정책 (기존 데이터 유지 / Excel 데이터로 덮어쓰기 / 새로운 레시피로 추가)
 * - 안전 경고 배너 및 '위 내용을 확인했습니다' 필수 확인 체크박스
 * - 복원 중 개별 오류 격리 및 결과 요약 리포트 (성공/건너뜀/실패 건수 및 사유)
 * - 모바일 반응형 완벽 대응 및 기존 JSON 백업 보존
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Download,
  Upload,
  Database,
  FileSpreadsheet,
  FileJson,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Layers,
  FileCheck,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { Recipe, ShoppingItem } from '../types/recipe';
import { exportBackupJson, restoreBackupData } from '../utils/storage';
import {
  exportRecipesToExcel,
  parseAndValidateExcelBackup,
  executeExcelRestore,
  DuplicateStrategy,
  ExcelRestorePreview,
  ExcelRestoreResult,
} from '../utils/excelBackup';
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
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

type TabType = 'excel' | 'json';

/**
 * 데이터 백업 및 복원 통합 모달 컴포넌트
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
  // 탭 상태 (기본: Excel 권장)
  const [activeTab, setActiveTab] = useState<TabType>('excel');

  // Excel 내보내기 옵션
  const [exportFilter, setExportFilter] = useState<'all' | 'bookmarks' | 'customOnly'>('all');

  // Excel 복원 상태
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelPreview, setExcelPreview] = useState<ExcelRestorePreview | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('skip');
  const [isConfirmedSafety, setIsConfirmedSafety] = useState<boolean>(false);
  const [showDuplicateDetails, setShowDuplicateDetails] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [restoreResult, setRestoreResult] = useState<ExcelRestoreResult | null>(null);
  const [excelErrorMsg, setExcelErrorMsg] = useState<string>('');

  // JSON 복원 상태 (레거시 지원)
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [jsonContent, setJsonContent] = useState<string>('');
  const [jsonPreview, setJsonPreview] = useState<{
    recipeCount: number;
    exportedAt?: string;
    version?: string;
  } | null>(null);
  const [jsonRestoreMode, setJsonRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [isJsonConfirming, setIsJsonConfirming] = useState<boolean>(false);
  const [jsonErrorMsg, setJsonErrorMsg] = useState<string>('');

  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const jsonInputRef = useRef<HTMLInputElement | null>(null);

  // 모달 열림 시 상태 초기화 및 바디 스크롤 제어
  useEffect(() => {
    if (isOpen) {
      logger.info('BackupRestoreModal', '백업/복원 모달 열림');
      setExcelFile(null);
      setExcelPreview(null);
      setDuplicateStrategy('skip');
      setIsConfirmedSafety(false);
      setShowDuplicateDetails(false);
      setIsRestoring(false);
      setRestoreResult(null);
      setExcelErrorMsg('');

      setJsonFile(null);
      setJsonContent('');
      setJsonPreview(null);
      setIsJsonConfirming(false);
      setJsonErrorMsg('');

      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // 내보낼 레시피 목록 필터링
  const filteredRecipesForExport = useMemo(() => {
    if (exportFilter === 'bookmarks') {
      const bookmarkSet = new Set(bookmarks);
      return allRecipes.filter((r) => bookmarkSet.has(r.id));
    }
    if (exportFilter === 'customOnly') {
      return allRecipes.filter((r) => r.isCustom || r.syncScope === 'private' || r.syncScope === 'local');
    }
    return allRecipes;
  }, [allRecipes, bookmarks, exportFilter]);

  if (!isOpen) return null;

  /**
   * Excel 백업 파일 다운로드 실행
   */
  const handleExcelExport = (): void => {
    logger.info('BackupRestoreModal.handleExcelExport', `Excel 백업 다운로드: ${filteredRecipesForExport.length}개`);
    if (filteredRecipesForExport.length === 0) {
      showToast('⚠️ 선택된 조건에 해당하는 레시피가 없습니다.', 'warning');
      return;
    }

    try {
      const fileName = exportRecipesToExcel(filteredRecipesForExport, {
        bookmarkedIds: bookmarks,
        userNotes: userNotes,
      });
      showToast(`📊 '${fileName}' 파일이 성공적으로 다운로드되었습니다!`, 'success');
    } catch (err: any) {
      logger.error('BackupRestoreModal.handleExcelExport', 'Excel 내보내기 오류', err);
      showToast(err?.message || 'Excel 백업 파일 생성 중 오류가 발생했습니다.', 'error');
    }
  };

  /**
   * Excel 복원 파일 업로드 및 유효성 검사/미리보기 파싱
   */
  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    logger.info('BackupRestoreModal.handleExcelFileChange', `Excel 파일 선택: ${file.name}`);
    setExcelFile(file);
    setExcelErrorMsg('');
    setExcelPreview(null);
    setRestoreResult(null);
    setIsConfirmedSafety(false);

    try {
      const preview = await parseAndValidateExcelBackup(file, allRecipes);
      setExcelPreview(preview);
    } catch (err: any) {
      logger.error('BackupRestoreModal.handleExcelFileChange', 'Excel 파싱 오류', err);
      const msg = err?.message || '이 파일은 레시피 앱에서 생성한 정상적인 백업 파일이 아닙니다.';
      setExcelErrorMsg(msg);
      showToast(msg, 'error');
    }
  };

  /**
   * Excel 복원 실행
   */
  const handleExecuteExcelRestore = (): void => {
    if (!excelPreview || !excelPreview.parsedRecipes || excelPreview.parsedRecipes.length === 0) {
      showToast('⚠️ 복원할 레시피 데이터가 없습니다.', 'warning');
      return;
    }

    if (!isConfirmedSafety) {
      showToast('⚠️ 복원 전 주의사항 확인 체크박스에 체크해주세요.', 'warning');
      return;
    }

    setIsRestoring(true);
    logger.info('BackupRestoreModal.handleExecuteExcelRestore', `Excel 복원 시작 (전략: ${duplicateStrategy})`);

    try {
      const result = executeExcelRestore(excelPreview.parsedRecipes, allRecipes, duplicateStrategy);
      setRestoreResult(result);

      // 즐겨찾기 ID 목록 갱신
      const newBookmarks = new Set(bookmarks);
      result.restoredRecipes.forEach((r) => {
        if (r.isBookmarked) {
          newBookmarks.add(r.id);
        }
      });

      // 메모 객체 갱신
      const newNotes: Record<number, string> = { ...userNotes };
      result.restoredRecipes.forEach((r) => {
        if (r.userNotes) {
          newNotes[r.id] = r.userNotes;
        }
      });

      onRestoreComplete({
        recipes: result.restoredRecipes,
        bookmarks: Array.from(newBookmarks),
        userNotes: newNotes,
        shoppingList: shoppingList,
        recentIds: result.restoredRecipes.slice(-10).map((r) => r.id),
      });

      showToast(`🎉 레시피 복원 완료: ${result.success}개 반영 성공!`, 'success');
    } catch (err: any) {
      logger.error('BackupRestoreModal.handleExecuteExcelRestore', 'Excel 복원 실패', err);
      showToast(err?.message || '레시피 복원 중 문제가 발생했습니다.', 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  /**
   * JSON 백업 파일 다운로드
   */
  const handleJsonExport = (): void => {
    logger.info('BackupRestoreModal.handleJsonExport', 'JSON 백업 다운로드 시작');
    try {
      exportBackupJson(allRecipes, bookmarks, userNotes, shoppingList);
      showToast('💾 레시피 JSON 백업 파일이 다운로드되었습니다.', 'success');
    } catch (err) {
      logger.error('BackupRestoreModal.handleJsonExport', 'JSON 백업 실패', err);
      showToast('⚠️ 백업 파일 생성 중 오류가 발생했습니다.', 'error');
    }
  };

  /**
   * JSON 파일 선택 핸들러
   */
  const handleJsonFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;

    logger.info('BackupRestoreModal.handleJsonFileChange', `JSON 복원 파일 선택: ${file.name}`);
    setJsonFile(file);
    setJsonErrorMsg('');

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        setJsonContent(text);
        const parsed = JSON.parse(text);
        if (parsed && Array.isArray(parsed.recipes)) {
          setJsonPreview({
            recipeCount: parsed.recipes.length,
            exportedAt: parsed.exportedAt,
            version: parsed.version,
          });
        } else {
          setJsonErrorMsg('유효한 레시피 백업 JSON 파일이 아닙니다.');
        }
      } catch (err) {
        logger.error('BackupRestoreModal', 'JSON 파싱 실패', err);
        setJsonErrorMsg('JSON 형식이 올바르지 않습니다.');
      }
    };
    reader.onerror = () => {
      setJsonErrorMsg('파일을 읽는 중 문제가 발생했습니다.');
    };
    reader.readAsText(file);
  };

  /**
   * JSON 복원 실행 핸들러
   */
  const handleExecuteJsonRestore = (): void => {
    if (!jsonContent) {
      showToast('⚠️ 먼저 복원할 백업 파일을 선택해주세요.', 'warning');
      return;
    }

    try {
      const result = restoreBackupData(
        jsonContent,
        jsonRestoreMode,
        allRecipes,
        bookmarks,
        userNotes,
        shoppingList
      );
      onRestoreComplete(result);
      showToast(
        jsonRestoreMode === 'merge'
          ? `🎉 ${result.recipes.length}개의 레시피 데이터가 안전하게 병합되었습니다!`
          : `🎉 ${result.recipes.length}개의 레시피 데이터로 전체 교체되었습니다!`,
        'success'
      );
      onClose();
    } catch (err: any) {
      logger.error('BackupRestoreModal.handleExecuteJsonRestore', 'JSON 복원 실패', err);
      const msg = err instanceof Error ? err.message : '복원에 실패했습니다.';
      setJsonErrorMsg(msg);
      showToast(`⚠️ ${msg}`, 'error');
    }
  };

  return (
    <div
      id="backup-restore-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-3 sm:p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backupModalTitle"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-scroll max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 sm:p-7 shadow-2xl">
        {/* 모달 상단 헤더 */}
        <div className="flex items-center justify-between border-b border-orange-100 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/20">
              <FileSpreadsheet className="h-6 w-6" />
            </span>
            <div>
              <h2 id="backupModalTitle" className="font-soft text-xl font-black text-stone-900 flex items-center gap-2">
                <span>레시피 데이터 백업 및 복원</span>
              </h2>
              <p className="text-xs font-semibold text-stone-500 mt-0.5">
                소중한 레시피 데이터를 Excel(.xlsx)로 보관하고 언제든 복원하세요.
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

        {/* 탭 네비게이션: Excel (권장) vs JSON */}
        <div className="mt-5 flex rounded-2xl bg-stone-100 p-1">
          <button
            type="button"
            id="tab-excel-backup"
            onClick={() => setActiveTab('excel')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition ${
              activeTab === 'excel'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Excel (.xlsx) 백업 / 복원</span>
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[10px] font-extrabold text-emerald-800">
              추천
            </span>
          </button>

          <button
            type="button"
            id="tab-json-backup"
            onClick={() => setActiveTab('json')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition ${
              activeTab === 'json'
                ? 'bg-white text-orange-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <FileJson className="h-4 w-4 text-orange-600" />
            <span>JSON 백업 / 복원</span>
          </button>
        </div>

        {/* ----------------- 1. EXCEL TAB ----------------- */}
        {activeTab === 'excel' && (
          <div className="mt-5 space-y-6">
            {/* 1-1. Excel 다운로드 카드 */}
            <div className="rounded-2xl border border-emerald-100 bg-[#f4fcf7] p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Download className="h-4 w-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-soft text-base font-black text-emerald-950">
                    📥 레시피 Excel 백업 다운로드 (.xlsx)
                  </h3>
                  <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                    등록된 레시피를 <strong>'레시피'</strong> 및 <strong>'재료'</strong> 시트로 분리 구성된 표준 Excel 파일로 다운로드합니다.
                  </p>

                  {/* 백업 대상 선택 필터 */}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setExportFilter('all')}
                      className={`rounded-lg px-3 py-1.5 font-bold transition border ${
                        exportFilter === 'all'
                          ? 'border-emerald-500 bg-emerald-600 text-white'
                          : 'border-emerald-200 bg-white text-stone-700 hover:bg-emerald-50'
                      }`}
                    >
                      전체 레시피 ({allRecipes.length}개)
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportFilter('bookmarks')}
                      className={`rounded-lg px-3 py-1.5 font-bold transition border ${
                        exportFilter === 'bookmarks'
                          ? 'border-emerald-500 bg-emerald-600 text-white'
                          : 'border-emerald-200 bg-white text-stone-700 hover:bg-emerald-50'
                      }`}
                    >
                      ⭐ 즐겨찾기만 ({bookmarks.length}개)
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportFilter('customOnly')}
                      className={`rounded-lg px-3 py-1.5 font-bold transition border ${
                        exportFilter === 'customOnly'
                          ? 'border-emerald-500 bg-emerald-600 text-white'
                          : 'border-emerald-200 bg-white text-stone-700 hover:bg-emerald-50'
                      }`}
                    >
                      ✍️ 직접 등록한 레시피만
                    </button>
                  </div>

                  {/* 백업 버튼 */}
                  <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <button
                      type="button"
                      id="btn-excel-export"
                      onClick={handleExcelExport}
                      className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 active:scale-95"
                    >
                      <Download className="h-4 w-4" />
                      <span>레시피 Excel 백업 다운로드</span>
                    </button>

                    <span className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                      <span>파일명: recipe-backup-YYYY-MM-DD.xlsx</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 1-2. Excel 복원 카드 */}
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
              <div className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-700">
                  <Upload className="h-4 w-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-soft text-base font-black text-stone-900">
                    📤 Excel 백업 파일 복원 (.xlsx)
                  </h3>
                  <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                    이전에 저장한 레시피 백업 Excel 파일을 업로드하여 데이터를 안전하게 복원합니다.
                  </p>

                  <input
                    type="file"
                    ref={excelInputRef}
                    accept=".xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    onChange={handleExcelFileChange}
                    className="hidden"
                  />

                  {/* 파일 선택 버튼 & 파일명 표시 */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      id="btn-select-excel-file"
                      onClick={() => excelInputRef.current?.click()}
                      className="flex items-center gap-2 rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-100 active:scale-95 transition"
                    >
                      <Upload className="h-4 w-4 text-emerald-600" />
                      <span>Excel 파일 선택 (.xlsx)</span>
                    </button>

                    {excelFile && (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg truncate max-w-[280px]">
                        <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="truncate">{excelFile.name}</span>
                      </span>
                    )}
                  </div>

                  {/* 오류 메시지 */}
                  {excelErrorMsg && (
                    <div className="mt-3.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-bold text-red-700 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                      <span>{excelErrorMsg}</span>
                    </div>
                  )}

                  {/* 복원 미리보기 및 중복 처리 설정 */}
                  {excelPreview && !restoreResult && (
                    <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50/60 p-4 space-y-4 animate-fade-in">
                      {/* 통계 요약 카드 */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-extrabold text-stone-800 flex items-center gap-1.5">
                            <FileCheck className="h-4 w-4 text-emerald-600" />
                            <span>백업 파일 검증 완료 (버전: v{excelPreview.version})</span>
                          </span>
                          {excelPreview.createdAt && (
                            <span className="text-[10px] text-stone-500">
                              생성일: {new Date(excelPreview.createdAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                          <div className="rounded-xl bg-white p-2.5 border border-stone-200 shadow-2xs">
                            <div className="text-[10px] font-bold text-stone-500">총 레시피</div>
                            <div className="text-base font-black text-stone-900">{excelPreview.totalRecipes}개</div>
                          </div>
                          <div className="rounded-xl bg-white p-2.5 border border-stone-200 shadow-2xs">
                            <div className="text-[10px] font-bold text-stone-500">총 재료</div>
                            <div className="text-base font-black text-stone-900">{excelPreview.totalIngredients}개</div>
                          </div>
                          <div className="rounded-xl bg-white p-2.5 border border-emerald-200 bg-emerald-50/30 shadow-2xs">
                            <div className="text-[10px] font-bold text-emerald-700">신규 레시피</div>
                            <div className="text-base font-black text-emerald-700">{excelPreview.newRecipeCount}개</div>
                          </div>
                          <div className="rounded-xl bg-white p-2.5 border border-amber-200 bg-amber-50/30 shadow-2xs">
                            <div className="text-[10px] font-bold text-amber-700">기존과 중복</div>
                            <div className="text-base font-black text-amber-700">{excelPreview.duplicateRecipeCount}개</div>
                          </div>
                        </div>
                      </div>

                      {/* 중복 레시피 상세 목록 토글 */}
                      {excelPreview.duplicateRecipeCount > 0 && (
                        <div>
                          <button
                            type="button"
                            onClick={() => setShowDuplicateDetails((prev) => !prev)}
                            className="flex items-center gap-1 text-[11px] font-bold text-amber-800 hover:underline"
                          >
                            <span>중복된 레시피 목록 ({excelPreview.duplicateRecipeCount}개)</span>
                            {showDuplicateDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>
                          {showDuplicateDetails && (
                            <div className="mt-1.5 max-h-24 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50/60 p-2 text-[11px] text-amber-900">
                              <ul className="list-disc list-inside space-y-0.5">
                                {excelPreview.duplicateRecipeNames.map((name, i) => (
                                  <li key={i} className="truncate">{name}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 중복 데이터 처리 옵션 라디오 */}
                      <div>
                        <label className="block text-xs font-black text-stone-800 mb-2">
                          🔄 중복 레시피 처리 방식:
                        </label>
                        <div className="space-y-2">
                          <label
                            className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition ${
                              duplicateStrategy === 'skip'
                                ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-400'
                                : 'border-stone-200 bg-white hover:bg-stone-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="dupStrategy"
                              value="skip"
                              checked={duplicateStrategy === 'skip'}
                              onChange={() => setDuplicateStrategy('skip')}
                              className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                            />
                            <div>
                              <div className="text-xs font-extrabold text-stone-900">
                                1. 기존 데이터 유지 (건너뛰기 - 추천)
                              </div>
                              <div className="text-[11px] text-stone-500">
                                기존에 저장된 레시피는 건드리지 않고, 파일 속 새로운 레시피만 추가합니다.
                              </div>
                            </div>
                          </label>

                          <label
                            className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition ${
                              duplicateStrategy === 'overwrite'
                                ? 'border-orange-500 bg-orange-50/70 ring-2 ring-orange-400'
                                : 'border-stone-200 bg-white hover:bg-stone-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="dupStrategy"
                              value="overwrite"
                              checked={duplicateStrategy === 'overwrite'}
                              onChange={() => setDuplicateStrategy('overwrite')}
                              className="mt-0.5 text-orange-600 focus:ring-orange-500"
                            />
                            <div>
                              <div className="text-xs font-extrabold text-stone-900">
                                2. Excel 데이터로 덮어쓰기
                              </div>
                              <div className="text-[11px] text-stone-500">
                                중복된 레시피는 Excel 파일의 최신 내용으로 갱신합니다.
                              </div>
                            </div>
                          </label>

                          <label
                            className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition ${
                              duplicateStrategy === 'createNew'
                                ? 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-400'
                                : 'border-stone-200 bg-white hover:bg-stone-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="dupStrategy"
                              value="createNew"
                              checked={duplicateStrategy === 'createNew'}
                              onChange={() => setDuplicateStrategy('createNew')}
                              className="mt-0.5 text-blue-600 focus:ring-blue-500"
                            />
                            <div>
                              <div className="text-xs font-extrabold text-stone-900">
                                3. 새로운 레시피로 추가 (새 ID 발급)
                              </div>
                              <div className="text-[11px] text-stone-500">
                                중복 여부와 상관없이 모든 레시피를 새로운 별도 레시피로 추가합니다.
                              </div>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* 필수 안전 경고 배너 및 체크박스 */}
                      <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3.5 space-y-2.5">
                        <div className="flex items-start gap-2 text-xs font-bold text-amber-900">
                          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                          <span>
                            Excel 데이터를 복원하면 현재 저장된 레시피와 중복되거나 일부 데이터가 변경될 수 있습니다.
                          </span>
                        </div>

                        <label className="flex items-center gap-2 pt-1 border-t border-amber-200/80 cursor-pointer">
                          <input
                            type="checkbox"
                            id="chk-safety-confirm"
                            checked={isConfirmedSafety}
                            onChange={(e) => setIsConfirmedSafety(e.target.checked)}
                            className="h-4 w-4 rounded border-amber-400 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-xs font-black text-amber-950 select-none">
                            위 내용을 확인했습니다.
                          </span>
                        </label>
                      </div>

                      {/* 복원 실행 및 취소 버튼 */}
                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setExcelPreview(null);
                            setExcelFile(null);
                          }}
                          className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50"
                        >
                          복원 취소
                        </button>

                        <button
                          type="button"
                          id="btn-execute-excel-restore"
                          disabled={!isConfirmedSafety || isRestoring}
                          onClick={handleExecuteExcelRestore}
                          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black text-white shadow-md transition ${
                            !isConfirmedSafety || isRestoring
                              ? 'bg-stone-300 cursor-not-allowed text-stone-500'
                              : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-emerald-600/25'
                          }`}
                        >
                          {isRestoring ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              <span>복원 처리 중...</span>
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4" />
                              <span>복원 진행하기</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 복원 결과 리포트 카드 */}
                  {restoreResult && (
                    <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-3 animate-scale-up">
                      <div className="flex items-center gap-2 text-emerald-900 font-black text-sm">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        <span>레시피 복원이 성공적으로 완료되었습니다!</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-xl bg-white p-2.5 border border-emerald-200">
                          <div className="text-[10px] text-stone-500 font-bold">반영 성공</div>
                          <div className="text-base font-black text-emerald-700">{restoreResult.success}개</div>
                        </div>
                        <div className="rounded-xl bg-white p-2.5 border border-stone-200">
                          <div className="text-[10px] text-stone-500 font-bold">건너뜀</div>
                          <div className="text-base font-black text-stone-700">{restoreResult.skipped}개</div>
                        </div>
                        <div className="rounded-xl bg-white p-2.5 border border-stone-200">
                          <div className="text-[10px] text-stone-500 font-bold">실패</div>
                          <div className="text-base font-black text-red-600">{restoreResult.failed}개</div>
                        </div>
                      </div>

                      {restoreResult.failedItems.length > 0 && (
                        <div className="rounded-xl bg-red-50 p-3 border border-red-200 text-xs text-red-900">
                          <div className="font-bold mb-1">일부 레시피 처리 실패 항목:</div>
                          <ul className="list-disc list-inside space-y-0.5">
                            {restoreResult.failedItems.map((item, idx) => (
                              <li key={idx}>
                                {item.name}: {item.reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={onClose}
                          className="rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-black text-white hover:bg-emerald-800 shadow-sm transition"
                        >
                          완료 및 닫기
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ----------------- 2. JSON TAB ----------------- */}
        {activeTab === 'json' && (
          <div className="mt-5 space-y-6">
            {/* JSON Export */}
            <div className="rounded-2xl border border-orange-100 bg-[#fffaf3] p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-700">
                  <Download className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-soft text-base font-black text-stone-900">
                    📥 레시피 전체 백업 (JSON 다운로드)
                  </h3>
                  <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                    현재 등록된 <strong>{allRecipes.length}개의 레시피</strong>, 즐겨찾기, 메모, 장보기 목록을
                    단일 JSON 파일로 안전하게 다운로드합니다.
                  </p>
                  <button
                    type="button"
                    onClick={handleJsonExport}
                    className="mt-4 flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-orange-600 active:scale-95"
                  >
                    <Download className="h-4 w-4" />
                    <span>내 레시피 JSON 파일 다운로드</span>
                  </button>
                </div>
              </div>
            </div>

            {/* JSON Restore */}
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
              <div className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-stone-100 text-stone-700">
                  <Upload className="h-4 w-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-soft text-base font-black text-stone-900">
                    📤 JSON 백업 파일 복원하기
                  </h3>
                  <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                    이전에 다운로드한 레시피 백업 JSON 파일을 선택하여 복원합니다.
                  </p>

                  <input
                    type="file"
                    ref={jsonInputRef}
                    accept=".json,application/json"
                    onChange={handleJsonFileChange}
                    className="hidden"
                  />

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => jsonInputRef.current?.click()}
                      className="flex items-center gap-1.5 rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-100 transition"
                    >
                      <Upload className="h-4 w-4 text-orange-600" />
                      <span>JSON 파일 선택</span>
                    </button>
                    {jsonFile && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-stone-600 truncate max-w-[250px]">
                        <FileJson className="h-4 w-4 text-orange-500 shrink-0" />
                        <span className="truncate">{jsonFile.name}</span>
                      </span>
                    )}
                  </div>

                  {jsonPreview && (
                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-xs text-emerald-900">
                      <div className="flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>유효한 백업 파일 확인됨: {jsonPreview.recipeCount}개 레시피</span>
                      </div>
                      {jsonPreview.exportedAt && (
                        <p className="mt-1 text-[11px] text-emerald-700">
                          백업 일시: {new Date(jsonPreview.exportedAt).toLocaleString('ko-KR')}
                        </p>
                      )}
                    </div>
                  )}

                  {jsonErrorMsg && (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
                      {jsonErrorMsg}
                    </div>
                  )}

                  {jsonPreview && (
                    <div className="mt-5 border-t border-stone-100 pt-4">
                      <label className="block text-xs font-bold text-stone-700 mb-2">복원 방식 선택:</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setJsonRestoreMode('merge')}
                          className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                            jsonRestoreMode === 'merge'
                              ? 'border-orange-500 bg-orange-50/80 ring-2 ring-orange-400'
                              : 'border-stone-200 hover:bg-stone-50'
                          }`}
                        >
                          <span className="flex items-center gap-1 font-bold text-xs text-stone-900">
                            <Layers className="h-3.5 w-3.5 text-orange-600" />
                            <span>기존 데이터와 병합</span>
                          </span>
                          <span className="mt-1 text-[10px] text-stone-500">
                            기존 레시피를 유지하며 백업 레시피를 추가합니다.
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setJsonRestoreMode('replace')}
                          className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                            jsonRestoreMode === 'replace'
                              ? 'border-red-500 bg-red-50/80 ring-2 ring-red-400'
                              : 'border-stone-200 hover:bg-stone-50'
                          }`}
                        >
                          <span className="flex items-center gap-1 font-bold text-xs text-red-700">
                            <RefreshCw className="h-3.5 w-3.5 text-red-600" />
                            <span>전체 교체 (덮어쓰기)</span>
                          </span>
                          <span className="mt-1 text-[10px] text-stone-500">
                            현재 데이터를 지우고 파일 상태로 되돌립니다.
                          </span>
                        </button>
                      </div>

                      {!isJsonConfirming ? (
                        <button
                          type="button"
                          onClick={() => setIsJsonConfirming(true)}
                          className="mt-4 w-full rounded-xl bg-stone-900 py-3 text-xs font-black text-white shadow-md transition hover:bg-stone-800"
                        >
                          {jsonRestoreMode === 'merge' ? '데이터 병합 복원하기' : '데이터 전체 교체 복원하기'}
                        </button>
                      ) : (
                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                          <div className="flex items-start gap-2 text-xs font-bold text-amber-900">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                            <span>
                              {jsonRestoreMode === 'merge'
                                ? '백업 파일의 레시피를 현재 목록에 추가/갱신하시겠습니까?'
                                : '⚠️ 주의: 현재 저장된 레시피가 완전히 교체됩니다. 계속하시겠습니까?'}
                            </span>
                          </div>
                          <div className="mt-3 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setIsJsonConfirming(false)}
                              className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-stone-600 border border-stone-200 hover:bg-stone-50"
                            >
                              취소
                            </button>
                            <button
                              type="button"
                              onClick={handleExecuteJsonRestore}
                              className={`rounded-lg px-4 py-1.5 text-xs font-black text-white ${
                                jsonRestoreMode === 'replace'
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
          </div>
        )}

        {/* 하단 안내 풋터 */}
        <div className="mt-6 border-t border-stone-100 pt-3 flex items-center justify-between text-[11px] text-stone-400">
          <span className="flex items-center gap-1">
            <Info className="h-3.5 w-3.5" />
            <span>중요한 레시피는 정기적으로 백업하는 것을 권장합니다.</span>
          </span>
          <span>내 입맛 레시피 백업 v{1}</span>
        </div>
      </div>
    </div>
  );
};
