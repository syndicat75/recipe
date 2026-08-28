/**
 * @file src/components/ImportRecipeModal.tsx
 * @description 외부 레시피 가져오기 모달 컴포넌트. 웹페이지 URL, 레시피 텍스트 붙여넣기 및
 * 📷 사진(요리책, 손글씨 메모, 포장지, 캡처)을 통한 Gemini AI 구조화 추출, 클라이언트 이미지 압축,
 * 추출 결과 검토 및 불확실 항목(⚠️) 확인, 원본 사진 보관 옵션 및 저장을 지원합니다.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  X,
  Link2,
  FileText,
  Camera,
  Sparkles,
  Loader2,
  Check,
  AlertCircle,
  Save,
  ArrowRight,
  Clock,
  Flame,
  ChefHat,
  Users,
  Upload,
  Image as ImageIcon,
  RotateCcw,
} from 'lucide-react';
import { APP_CONFIG, CATEGORY_CONFIG, CATEGORY_LIST } from '../config/appConfig';
import { Recipe, RecipeCategory, SaveRecipeResult } from '../types/recipe';
import { logger } from '../utils/logger';
import { callAiApi } from '../utils/aiApiHelper';

interface ImportRecipeModalProps {
  /** 모달 열림 여부 */
  isOpen: boolean;
  /** 현재 등록된 전체 레시피 목록 (중복 체크용) */
  existingRecipes: Recipe[];
  /** 모달 닫기 핸들러 */
  onClose: () => void;
  /** 레시피 저장 핸들러 */
  onSaveRecipe: (
    recipe: Recipe,
    isBookmarked: boolean,
    userNote: string
  ) => Promise<SaveRecipeResult> | SaveRecipeResult | void;
  /** 직접 레시피 등록 모달 열기 핸들러 (AI 분석 실패 또는 직접 입력 전환 시) */
  onOpenDirectRegister?: (prefill?: {
    name?: string;
    ingredients?: string;
    method?: string;
    imageUrl?: string;
  }) => void;
  /** 토스트 메시지 표시 함수 */
  showToast: (msg: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  /** 관리자 여부 */
  isAdmin?: boolean;
}

type ImportTab = 'url' | 'text' | 'image';

/**
 * 브라우저 캔버스를 활용해 이미지 파일을 적정 해상도(최대 1400px)와 JPEG 압축 품질(0.80)로 리사이징하여 Base64로 변환합니다.
 * OCR 텍스트 가독성을 최상으로 유지하면서 Vercel Serverless 요청 페이로드를 안전한 크기(~200KB-800KB)로 최적화합니다.
 * @param file 이미지 파일
 * @param maxWidth 최대 가로/세로 픽셀 (기본 1400)
 * @param quality JPEG 품질 (0.1 ~ 1.0, 기본 0.80)
 * @returns Base64 Data URL 문자열
 */
function compressImageFile(file: File, maxWidth: number = 1400, quality: number = 0.80): Promise<string> {
  logger.info('ImportRecipeModal.compressImageFile', `이미지 압축 시작: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 컨텍스트를 생성할 수 없습니다.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        logger.info('ImportRecipeModal.compressImageFile', `압축 완료: ${width}x${height}`);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('이미지 로딩에 실패했습니다.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('파일 읽기에 실패했습니다.'));
    reader.readAsDataURL(file);
  });
}

/**
 * 외부 레시피 AI 추출 및 가져오기 모달 컴포넌트
 */
export const ImportRecipeModal: React.FC<ImportRecipeModalProps> = ({
  isOpen,
  existingRecipes,
  onClose,
  onSaveRecipe,
  onOpenDirectRegister,
  showToast,
  isAdmin = false,
}) => {
  const [activeTab, setActiveTab] = useState<ImportTab>('url');
  const [urlInput, setUrlInput] = useState('');
  const [textInput, setTextInput] = useState('');

  // 이미지 탭 상태
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // AI 분석 결과 검토 상태 (Step 2)
  const [parsedRecipe, setParsedRecipe] = useState<{
    name: string;
    category: RecipeCategory;
    icon: string;
    baseServings: number;
    ingredients: string;
    method: string;
    cookingTimeMinutes: number;
    difficulty: '쉬움' | '보통' | '어려움';
    tips?: string;
    sourceImageUrl?: string;
    lowConfidenceFields?: string[];
  } | null>(null);

  const [saveSourceImageOption, setSaveSourceImageOption] = useState<boolean>(true);

  if (!isOpen) return null;

  /**
   * 이미지 파일 선택 및 압축 처리
   */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setIsCompressing(true);
    try {
      const compressedBase64 = await compressImageFile(file);
      setImagePreview(compressedBase64);
    } catch (err) {
      logger.error('ImportRecipeModal.handleFileChange', '이미지 압축 실패', err);
      setErrorMsg('이미지 파일을 처리할 수 없습니다. 다른 사진을 선택해주세요.');
    } finally {
      setIsCompressing(false);
    }
  };

  /**
   * AI 분석 요청 핸들러
   */
  const handleAnalyze = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setErrorMsg(null);

    const targetUrl = urlInput.trim();
    const targetText = textInput.trim();

    if (activeTab === 'url' && !targetUrl) {
      setErrorMsg('가져올 레시피 웹페이지 URL을 입력해주세요.');
      return;
    }
    if (activeTab === 'text' && !targetText) {
      setErrorMsg('레시피 내용이나 재료/조리법 텍스트를 입력해주세요.');
      return;
    }
    if (activeTab === 'image' && !imagePreview) {
      setErrorMsg('분석할 레시피 사진을 먼저 업로드하거나 촬영해주세요.');
      return;
    }

    logger.info('ImportRecipeModal.handleAnalyze', `AI 레시피 분석 시작 (탭: ${activeTab})`);
    setIsLoading(true);

    try {
      let endpoint: string = APP_CONFIG.ai.importEndpoint;
      let bodyData: Record<string, unknown> = {};

      if (activeTab === 'url') {
        bodyData = { url: targetUrl };
      } else if (activeTab === 'text') {
        bodyData = { text: targetText };
      } else if (activeTab === 'image') {
        endpoint = APP_CONFIG.ai.importImageEndpoint;
        bodyData = { imageBase64: imagePreview, mimeType: 'image/jpeg' };
      }

      interface RecipeAiResponsePayload {
        name?: string;
        category?: string;
        icon?: string;
        baseServings?: number;
        ingredients?: string;
        method?: string;
        cookingTimeMinutes?: number;
        difficulty?: '쉬움' | '보통' | '어려움';
        tip?: string;
        tips?: string;
        lowConfidenceFields?: string[];
      }

      const data = await callAiApi<RecipeAiResponsePayload>(endpoint, bodyData, 4.0);

      const resData = (activeTab === 'image' ? data.recipe : data.data) as RecipeAiResponsePayload | undefined;
      if (!resData) {
        throw new Error('레시피 데이터를 추출하지 못했습니다.');
      }

      logger.info('ImportRecipeModal.handleAnalyze', `AI 분석 성공: ${resData.name}`);

      // 유효 카테고리 매핑
      let cat: RecipeCategory = '기타';
      if (resData.category && (CATEGORY_LIST as readonly string[]).includes(resData.category)) {
        cat = resData.category as RecipeCategory;
      }

      setParsedRecipe({
        name: resData.name || '새로운 레시피',
        category: cat,
        icon: resData.icon || '🍳',
        baseServings: Number(resData.baseServings) || 2,
        ingredients: resData.ingredients || '',
        method: resData.method || '-',
        cookingTimeMinutes: Number(resData.cookingTimeMinutes) || 15,
        difficulty: resData.difficulty || '쉬움',
        tips: resData.tip || resData.tips || '',
        sourceImageUrl: activeTab === 'image' && imagePreview ? imagePreview : undefined,
        lowConfidenceFields: Array.isArray(resData.lowConfidenceFields) ? resData.lowConfidenceFields : [],
      });

      showToast('✨ AI가 레시피를 성공적으로 분석했습니다! 내용을 검토 후 저장해주세요.', 'success');
    } catch (err) {
      logger.error('ImportRecipeModal.handleAnalyze', '분석 실패', err);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : '레시피를 분석하는 중 문제가 발생했습니다. 사진이 흐릿하거나 잘렸는지 확인해주세요.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 최종 검토 후 레시피 저장 핸들러
   */
  const handleFinalSave = async (): Promise<void> => {
    if (!parsedRecipe || isSaving) return;

    logger.info('ImportRecipeModal.handleFinalSave', `가져온 레시피 저장: ${parsedRecipe.name}`);

    // 중복 확인
    const isDuplicate = existingRecipes.some(
      (r) => r.name.trim().toLowerCase() === parsedRecipe.name.trim().toLowerCase()
    );

    let finalName = parsedRecipe.name.trim();
    if (isDuplicate) {
      finalName = `${finalName} (가져옴)`;
    }

    const ingLines = parsedRecipe.ingredients
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const stepLines = parsedRecipe.method
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const targetScope = isAdmin ? 'public' : 'local';

    const newRecipe: Recipe = {
      id: Date.now(),
      name: finalName,
      category: parsedRecipe.category,
      icon: parsedRecipe.icon || '🥘',
      baseServings: parsedRecipe.baseServings || 2,
      ingredients: parsedRecipe.ingredients,
      ingredientCount: ingLines.length,
      method: parsedRecipe.method,
      stepCount: stepLines.length,
      ...(parsedRecipe.cookingTimeMinutes ? { cookingTimeMinutes: parsedRecipe.cookingTimeMinutes } : {}),
      ...(parsedRecipe.difficulty ? { difficulty: parsedRecipe.difficulty } : {}),
      ...(saveSourceImageOption && parsedRecipe.sourceImageUrl ? { sourceImageUrl: parsedRecipe.sourceImageUrl } : {}),
      isCustom: true,
      syncScope: targetScope,
      userNotes: parsedRecipe.tips || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setIsSaving(true);
    try {
      const result = await onSaveRecipe(newRecipe, false, parsedRecipe.tips || '');

      if (result && typeof result === 'object' && 'success' in result) {
        if (!result.success) {
          showToast(result.error || '레시피 저장에 실패했습니다.', 'error');
          setIsSaving(false);
          return;
        }

        if (result.scope === 'public') {
          showToast('☁️ 공개 레시피로 저장되었습니다.', 'success');
        } else if (result.scope === 'private') {
          showToast('☁️ 내 레시피가 클라우드에 저장되었습니다.\n다른 기기에서도 사용할 수 있습니다.', 'success');
        } else {
          showToast('📱 이 기기에 저장되었습니다.\nGoogle 로그인하면 다른 기기와 동기화할 수 있습니다.', 'info');
        }
      } else {
        showToast(`'${finalName}' 레시피가 추가되었습니다!`, 'success');
      }

      onClose();
    } catch (err) {
      logger.error('ImportRecipeModal.handleFinalSave', '저장 중 예외 발생', err);
      showToast('레시피 저장 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      id="import-recipe-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-stone-900/10">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-md shadow-orange-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-soft text-lg font-black text-stone-900">
                ✨ 레시피 가져오기 & 사진 인식
              </h2>
              <p className="text-xs text-stone-500">
                URL, 텍스트, 요리책/메모 사진에서 레시피를 자동으로 깔끔하게 정리합니다
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!parsedRecipe ? (
            /* Step 1: 입력 화면 (URL / 텍스트 / 사진) */
            <div className="space-y-5">
              {/* Tab Selector */}
              <div className="flex rounded-2xl bg-stone-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('url');
                    setErrorMsg(null);
                  }}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 font-soft text-xs font-bold transition-all ${
                    activeTab === 'url' ? 'bg-white text-orange-600 shadow-xs' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  <span>웹페이지 링크</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('text');
                    setErrorMsg(null);
                  }}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 font-soft text-xs font-bold transition-all ${
                    activeTab === 'text' ? 'bg-white text-orange-600 shadow-xs' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>텍스트 직접 입력</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('image');
                    setErrorMsg(null);
                  }}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 font-soft text-xs font-bold transition-all ${
                    activeTab === 'image' ? 'bg-white text-orange-600 shadow-xs' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Camera className="h-3.5 w-3.5 text-orange-500" />
                  <span>📷 사진으로 가져오기</span>
                </button>
              </div>

              <form onSubmit={handleAnalyze} className="space-y-4">
                {activeTab === 'url' && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-stone-700">
                      레시피 웹페이지 URL
                    </label>
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https:// 만개의레시피, 블로그, 요리 사이트 주소 붙여넣기"
                      className="w-full rounded-2xl border border-stone-200 bg-stone-50/60 p-3 text-xs text-stone-800 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 sm:text-sm"
                    />
                  </div>
                )}

                {activeTab === 'text' && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-stone-700">
                      레시피 텍스트
                    </label>
                    <textarea
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="유튜브 설명란, 인스타그램 캡션, 카카오톡으로 공유받은 레시피 내용을 자유롭게 붙여넣으세요."
                      rows={6}
                      className="w-full rounded-2xl border border-stone-200 bg-stone-50/60 p-3 text-xs text-stone-800 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 sm:text-sm"
                    />
                  </div>
                )}

                {activeTab === 'image' && (
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-stone-700">
                      요리책, 손글씨 메모, 제품 포장지, 캡처 사진
                    </label>

                    {/* Hidden Inputs */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <input
                      type="file"
                      ref={cameraInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                    />

                    {imagePreview ? (
                      <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-stone-50 p-2">
                        <img
                          src={imagePreview}
                          alt="업로드된 레시피 사진"
                          className="max-h-64 w-full rounded-xl object-contain bg-stone-900"
                        />
                        <button
                          type="button"
                          onClick={() => setImagePreview(null)}
                          className="absolute right-4 top-4 rounded-full bg-stone-900/80 p-1.5 text-white hover:bg-stone-900"
                          title="사진 제거"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          disabled={isCompressing}
                          className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-orange-200 bg-orange-50/40 p-6 text-center hover:bg-orange-50 transition-all"
                        >
                          <Camera className="h-8 w-8 text-orange-500 mb-2" />
                          <span className="font-soft text-xs font-bold text-orange-800">
                            카메라로 바로 촬영
                          </span>
                          <span className="text-[10px] text-stone-500 mt-0.5">
                            요리책 또는 메모 즉시 촬영
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isCompressing}
                          className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/50 p-6 text-center hover:bg-stone-100 transition-all"
                        >
                          <Upload className="h-8 w-8 text-stone-400 mb-2" />
                          <span className="font-soft text-xs font-bold text-stone-700">
                            사진 앨범 / 파일 선택
                          </span>
                          <span className="text-[10px] text-stone-500 mt-0.5">
                            JPEG, PNG, WEBP 등 지원
                          </span>
                        </button>
                      </div>
                    )}

                    {isCompressing && (
                      <p className="text-center text-xs text-orange-600 font-bold">
                        사진 최적화 압축 중...
                      </p>
                    )}
                  </div>
                )}

                {errorMsg && (
                  <div className="flex flex-col gap-2 rounded-2xl bg-rose-50 border border-rose-200/80 p-3.5 text-xs text-rose-800">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                      <span className="font-semibold">{errorMsg}</span>
                    </div>
                    {onOpenDirectRegister && (
                      <div className="mt-1 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenDirectRegister({
                              ingredients: activeTab === 'text' ? textInput : undefined,
                              imageUrl: activeTab === 'image' && imagePreview ? imagePreview : undefined,
                            });
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 font-bold text-orange-700 shadow-xs border border-orange-200 hover:bg-orange-50 active:scale-95 transition"
                        >
                          <span>✍️ 직접 레시피 등록으로 이동</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isLoading || isCompressing}
                    className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 font-soft text-xs font-black text-white shadow-lg shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600 active:scale-95 disabled:opacity-50 transition-all"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>AI 분석 중...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>AI로 레시피 정리하기</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Step 2: 분석 결과 검토 및 수정 화면 */
            <div className="space-y-5">
              <div className="flex items-center justify-between rounded-2xl bg-orange-50 p-3 text-xs text-orange-800 font-bold">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-orange-600" />
                  AI가 분석한 내용을 검토하고 필요시 수정해주세요.
                </span>
                <button
                  type="button"
                  onClick={() => setParsedRecipe(null)}
                  className="flex items-center gap-1 text-stone-500 hover:text-stone-800"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>다시 입력</span>
                </button>
              </div>

              {/* 불확실 항목(⚠️) 안내 배너 */}
              {parsedRecipe.lowConfidenceFields && parsedRecipe.lowConfidenceFields.length > 0 && (
                <div className="flex items-start gap-2 rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">⚠️ 글씨가 다소 흐려 확인이 필요한 항목이 있습니다: </span>
                    <span>{parsedRecipe.lowConfidenceFields.join(', ')} 부분을 꼼꼼히 확인해주세요.</span>
                  </div>
                </div>
              )}

              {/* Editable Fields */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="block text-xs font-bold text-stone-700">요리 이름</label>
                    <input
                      type="text"
                      value={parsedRecipe.name}
                      onChange={(e) => setParsedRecipe({ ...parsedRecipe, name: e.target.value })}
                      className="w-full rounded-xl border border-stone-200 bg-stone-50/60 p-2.5 text-xs font-bold text-stone-900 focus:border-orange-500 focus:bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-stone-700">카테고리</label>
                    <select
                      value={parsedRecipe.category}
                      onChange={(e) => setParsedRecipe({ ...parsedRecipe, category: e.target.value as RecipeCategory })}
                      className="w-full rounded-xl border border-stone-200 bg-stone-50/60 p-2.5 text-xs font-bold text-stone-900 focus:border-orange-500 focus:bg-white"
                    >
                      {CATEGORY_LIST.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-stone-700">기준 인분</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={parsedRecipe.baseServings}
                      onChange={(e) => setParsedRecipe({ ...parsedRecipe, baseServings: Number(e.target.value) || 2 })}
                      className="w-full rounded-xl border border-stone-200 bg-stone-50/60 p-2 text-xs text-stone-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-stone-700">조리 시간(분)</label>
                    <input
                      type="number"
                      min={1}
                      value={parsedRecipe.cookingTimeMinutes}
                      onChange={(e) => setParsedRecipe({ ...parsedRecipe, cookingTimeMinutes: Number(e.target.value) || 15 })}
                      className="w-full rounded-xl border border-stone-200 bg-stone-50/60 p-2 text-xs text-stone-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-stone-700">난이도</label>
                    <select
                      value={parsedRecipe.difficulty}
                      onChange={(e) => setParsedRecipe({ ...parsedRecipe, difficulty: e.target.value as '쉬움' | '보통' | '어려움' })}
                      className="w-full rounded-xl border border-stone-200 bg-stone-50/60 p-2 text-xs text-stone-900"
                    >
                      <option value="쉬움">쉬움</option>
                      <option value="보통">보통</option>
                      <option value="어려움">어려움</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-stone-700">
                    재료 목록 (줄바꿈 구분)
                  </label>
                  <textarea
                    value={parsedRecipe.ingredients}
                    onChange={(e) => setParsedRecipe({ ...parsedRecipe, ingredients: e.target.value })}
                    rows={4}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50/60 p-2.5 text-xs text-stone-800 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-stone-700">
                    조리 순서 (줄바꿈 구분)
                  </label>
                  <textarea
                    value={parsedRecipe.method}
                    onChange={(e) => setParsedRecipe({ ...parsedRecipe, method: e.target.value })}
                    rows={4}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50/60 p-2.5 text-xs text-stone-800"
                  />
                </div>

                {parsedRecipe.sourceImageUrl && (
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="save-source-img-chk"
                      checked={saveSourceImageOption}
                      onChange={(e) => setSaveSourceImageOption(e.target.checked)}
                      className="h-4 w-4 rounded text-orange-600 focus:ring-orange-500"
                    />
                    <label htmlFor="save-source-img-chk" className="text-xs font-bold text-stone-700">
                      촬영한 원본 레시피 사진도 함께 저장하기
                    </label>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setParsedRecipe(null)}
                  disabled={isSaving}
                  className="rounded-2xl px-4 py-2.5 font-soft text-xs font-bold text-stone-600 hover:bg-stone-100 disabled:opacity-50"
                >
                  이전으로
                </button>
                <button
                  type="button"
                  onClick={handleFinalSave}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 rounded-2xl bg-orange-500 px-6 py-2.5 font-soft text-xs font-bold text-white shadow-md hover:bg-orange-600 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>저장 중...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>{isAdmin ? '공개 레시피 북에 저장' : '내 레시피로 저장'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
