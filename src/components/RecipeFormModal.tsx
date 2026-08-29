/**
 * @file src/components/RecipeFormModal.tsx
 * @description 레시피 신규 등록 및 기존 레시피 수정/삭제를 지원하는 통합 폼 모달 컴포넌트
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Minus,
  Save,
  Trash2,
  Image as ImageIcon,
  Sparkles,
  Bookmark,
  Upload,
  Link2,
  Loader2,
} from 'lucide-react';
import { APP_CONFIG, CATEGORY_LIST } from '../config/appConfig';
import { Recipe, RecipeCategory, SaveRecipeResult } from '../types/recipe';
import { logger } from '../utils/logger';

interface RecipeFormModalProps {
  /** 모달 열림 여부 */
  isOpen: boolean;
  /** 수정할 기존 레시피 (null 또는 undefined면 신규 추가 모드) */
  recipeToEdit?: Recipe | null;
  /** 북마크 여부 (신규 추가 시 초기 상태) */
  initialBookmarked?: boolean;
  /** 기존 사용자 메모 */
  initialUserNote?: string;
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 저장 핸들러 (SaveRecipeResult 반환) */
  onSaveRecipe: (
    recipe: Recipe,
    isBookmarked: boolean,
    userNote: string
  ) => Promise<SaveRecipeResult> | SaveRecipeResult | void;
  /** 삭제 핸들러 (수정 모드일 때 사용) */
  onDeleteRecipe?: (recipeId: number) => void;
  /** 토스트 메시지 표시 함수 */
  showToast: (msg: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  /** 관리자 여부 */
  isAdmin?: boolean;
}

/**
 * 레시피 추가/수정 통합 모달 폼 컴포넌트
 */
export const RecipeFormModal: React.FC<RecipeFormModalProps> = ({
  isOpen,
  recipeToEdit,
  initialBookmarked = false,
  initialUserNote = '',
  onClose,
  onSaveRecipe,
  onDeleteRecipe,
  showToast,
  isAdmin = false,
}) => {
  const isEditMode = !!recipeToEdit;

  const [name, setName] = useState('');
  const [category, setCategory] = useState<RecipeCategory>('반찬');
  const [icon, setIcon] = useState('🍳');
  const [imageUrl, setImageUrl] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [method, setMethod] = useState('');
  const [cookingTime, setCookingTime] = useState<number>(15);
  const [difficulty, setDifficulty] = useState<'쉬움' | '보통' | '어려움'>('쉬움');
  const [baseServings, setBaseServings] = useState<number>(1);
  const [caloriesPerServing, setCaloriesPerServing] = useState<string>('');
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);
  const [userNote, setUserNote] = useState<string>('');
  const [imageTab, setImageTab] = useState<'emoji' | 'url' | 'upload'>('emoji');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 모달 상태 초기화 및 바디 스크롤 락
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      if (recipeToEdit) {
        logger.info('RecipeFormModal.useEffect', `수정 모드 초기화: ${recipeToEdit.name} (기존 기준: ${recipeToEdit.baseServings}인분)`);
        setName(recipeToEdit.name);
        setCategory(recipeToEdit.category);
        setIcon(recipeToEdit.icon || '🍳');
        setImageUrl(recipeToEdit.imageUrl || '');
        setIngredients(recipeToEdit.ingredients || '');
        setMethod(recipeToEdit.method === '-' ? '' : recipeToEdit.method || '');
        setCookingTime(recipeToEdit.cookingTimeMinutes || 15);
        setDifficulty(recipeToEdit.difficulty || '쉬움');
        setBaseServings(
          typeof recipeToEdit.baseServings === 'number' && recipeToEdit.baseServings >= 1
            ? Math.round(recipeToEdit.baseServings)
            : 1
        );
        setCaloriesPerServing(
          recipeToEdit.caloriesPerServing && recipeToEdit.caloriesPerServing > 0
            ? String(recipeToEdit.caloriesPerServing)
            : ''
        );
        setIsBookmarked(!!recipeToEdit.isBookmarked || initialBookmarked);
        setUserNote(initialUserNote || recipeToEdit.userNotes || '');
        setImageTab(recipeToEdit.imageUrl ? 'url' : 'emoji');
      } else {
        logger.info('RecipeFormModal.useEffect', '신규 등록 모드 초기화 (기본 1인분)');
        setName('');
        setCategory('반찬');
        setIcon('🍳');
        setImageUrl('');
        setIngredients('');
        setMethod('');
        setCookingTime(15);
        setDifficulty('쉬움');
        setBaseServings(1);
        setCaloriesPerServing('');
        setIsBookmarked(initialBookmarked);
        setUserNote('');
        setImageTab('emoji');
      }
      setIsSaving(false);

      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, recipeToEdit, initialBookmarked, initialUserNote]);

  if (!isOpen) return null;

  /**
   * 사진 파일 업로드 및 클라이언트 사이드 압축/Base64 변환 핸들러
   * @param e 파일 인풋 변경 이벤트
   */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;

    logger.info('RecipeFormModal.handleFileUpload', `이미지 파일 선택: ${file.name} (${file.size} bytes)`);

    if (file.size > 5 * 1024 * 1024) {
      showToast('⚠️ 원본 파일 크기는 5MB 이하로 올려주세요.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const img = new Image();
        img.onload = () => {
          // 최대 가로/세로 800px로 리사이징하여 로컬스토리지 용량(5MB 제한) 보호
          const maxDim = 800;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
            setImageUrl(compressedDataUrl);
            showToast('📷 사진이 최적화되어 첨부되었습니다.', 'info');
          } else {
            setImageUrl(reader.result as string);
            showToast('📷 사진이 첨부되었습니다.', 'info');
          }
        };
        img.onerror = () => {
          setImageUrl(reader.result as string);
          showToast('📷 사진이 첨부되었습니다.', 'info');
        };
        img.src = reader.result;
      }
    };
    reader.onerror = () => {
      logger.error('RecipeFormModal.handleFileUpload', '파일 읽기 실패');
      showToast('⚠️ 이미지 파일을 읽는 데 실패했습니다.', 'error');
    };
    reader.readAsDataURL(file);
  };

  /**
   * 폼 제출 및 레시피 저장 핸들러
   * @param e 폼 이벤트
   */
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (isSaving) return;

    logger.info('RecipeFormModal.handleSubmit', `레시피 저장 시도: "${name}" (수정여부: ${isEditMode})`);

    if (!name.trim()) {
      showToast('⚠️ 음식명을 입력해주세요.', 'warning');
      return;
    }
    if (!ingredients.trim()) {
      showToast('⚠️ 재료를 최소 1개 이상 입력해주세요.', 'warning');
      return;
    }

    const ingLines = ingredients
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const stepLines = method
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const targetId = isEditMode && recipeToEdit ? recipeToEdit.id : Date.now();
    const createdAt = isEditMode && recipeToEdit ? recipeToEdit.createdAt || Date.now() : Date.now();
    const targetScope: 'public' = 'public';

    const normalizedServings = Math.max(1, Math.min(20, Math.round(Number(baseServings) || 1)));

    const parsedCalories = caloriesPerServing.trim() ? Number(caloriesPerServing) : undefined;
    const validCalories = parsedCalories && !isNaN(parsedCalories) && parsedCalories > 0 ? Math.round(parsedCalories) : undefined;

    const recipeData: Recipe = {
      id: targetId,
      name: name.trim(),
      category,
      icon: icon || '🍳',
      ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}),
      ingredients: ingredients.trim(),
      method: method.trim() || '-',
      ingredientCount: ingLines.length,
      stepCount: stepLines.length,
      cookingTimeMinutes: Number(cookingTime) || 15,
      difficulty,
      baseServings: normalizedServings,
      ...(validCalories
        ? {
            caloriesPerServing: validCalories,
            totalCalories: Math.round(validCalories * normalizedServings),
            caloriesAnalyzedServings: normalizedServings,
          }
        : isEditMode && recipeToEdit?.caloriesPerServing
          ? {
              caloriesPerServing: recipeToEdit.caloriesPerServing,
              totalCalories: Math.round(recipeToEdit.caloriesPerServing * normalizedServings),
              caloriesAnalyzedServings: normalizedServings,
            }
          : {}),
      ...(isEditMode && recipeToEdit?.caloriesAnalyzedAt ? { caloriesAnalyzedAt: recipeToEdit.caloriesAnalyzedAt } : {}),
      ...(isEditMode && recipeToEdit?.caloriesConfidence ? { caloriesConfidence: recipeToEdit.caloriesConfidence } : {}),
      ...(isEditMode && recipeToEdit?.calorieBreakdown ? { calorieBreakdown: recipeToEdit.calorieBreakdown } : {}),
      isCustom: isEditMode ? recipeToEdit?.isCustom ?? true : true,
      isBookmarked,
      ...(userNote.trim() ? { userNotes: userNote.trim() } : {}),
      syncScope: targetScope,
      createdAt,
      updatedAt: Date.now(),
    };

    setIsSaving(true);
    try {
      const result = await onSaveRecipe(recipeData, isBookmarked, userNote.trim());

      if (result && typeof result === 'object' && 'success' in result) {
        if (!result.success) {
          showToast(result.error || '레시피 저장에 실패했습니다.', 'error');
          setIsSaving(false);
          return;
        }

        showToast(
          isEditMode
            ? `✨ '${recipeData.name}' 레시피가 수정되었습니다. (기준: ${normalizedServings}인분)`
            : `🎉 '${recipeData.name}' 레시피가 공개 DB에 등록되었습니다! (기준: ${normalizedServings}인분)`,
          'success'
        );
      } else {
        showToast(
          isEditMode
            ? `✨ '${recipeData.name}' 레시피가 수정되었습니다. (기준: ${normalizedServings}인분)`
            : `🎉 '${recipeData.name}' 레시피가 등록되었습니다! (기준: ${normalizedServings}인분)`,
          'success'
        );
      }

      onClose();
    } catch (err) {
      logger.error('RecipeFormModal.handleSubmit', '레시피 저장 오류', err);
      showToast('레시피 저장 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * 삭제 버튼 클릭 핸들러
   */
  const handleDeleteClick = (): void => {
    if (recipeToEdit && onDeleteRecipe) {
      logger.info('RecipeFormModal.handleDeleteClick', `레시피 삭제 요청: ID ${recipeToEdit.id}`);
      onDeleteRecipe(recipeToEdit.id);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recipeFormTitle"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-scroll max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl sm:max-h-[88vh] sm:rounded-[2rem] sm:p-7">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-orange-100 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-orange-500 text-xl text-white shadow-sm">
              {isEditMode ? '✏️' : '✨'}
            </span>
            <div>
              <h2 id="recipeFormTitle" className="font-soft text-xl font-black text-stone-900 sm:text-2xl">
                {isEditMode ? '레시피 수정하기' : '나만의 레시피 등록'}
              </h2>
              <p className="text-xs font-semibold text-stone-500">
                {isEditMode
                  ? '레시피 내용을 수정하고 저장하세요.'
                  : '자주 해먹는 나만의 황금비율 요리를 기록해보세요.'}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4 sm:space-y-5">
          {/* Recipe Name & Category */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-stone-700">음식명 *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 초간단 참치마요덮밥"
                className="mt-1.5 w-full rounded-xl border border-orange-200 bg-[#fffdfa] px-3.5 py-2.5 text-sm text-stone-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700">카테고리 *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as RecipeCategory)}
                className="mt-1.5 w-full rounded-xl border border-orange-200 bg-[#fffdfa] px-3.5 py-2.5 text-sm text-stone-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              >
                {CATEGORY_LIST.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Representative Visual: Emoji or Image */}
          <div className="rounded-2xl border border-orange-100 bg-[#fffaf3] p-3.5 sm:p-4">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-stone-700">대표 아이콘 및 사진</label>
              <div className="flex gap-1 rounded-lg bg-stone-200/60 p-0.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setImageTab('emoji')}
                  className={`rounded-md px-2 py-0.5 transition ${
                    imageTab === 'emoji' ? 'bg-white text-orange-700 shadow-sm' : 'text-stone-600'
                  }`}
                >
                  Emoji
                </button>
                <button
                  type="button"
                  onClick={() => setImageTab('url')}
                  className={`rounded-md px-2 py-0.5 transition ${
                    imageTab === 'url' ? 'bg-white text-orange-700 shadow-sm' : 'text-stone-600'
                  }`}
                >
                  URL 링크
                </button>
                <button
                  type="button"
                  onClick={() => setImageTab('upload')}
                  className={`rounded-md px-2 py-0.5 transition ${
                    imageTab === 'upload' ? 'bg-white text-orange-700 shadow-sm' : 'text-stone-600'
                  }`}
                >
                  사진 업로드
                </button>
              </div>
            </div>

            {/* Emoji Selection */}
            {imageTab === 'emoji' && (
              <div className="mt-3">
                <div className="flex flex-wrap gap-1.5">
                  {APP_CONFIG.defaultEmojis.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setIcon(em)}
                      className={`grid h-9 w-9 place-items-center rounded-xl text-lg transition ${
                        icon === em && !imageUrl
                          ? 'bg-orange-500 text-white shadow-md scale-110'
                          : 'bg-white hover:bg-orange-100'
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Image URL Input */}
            {imageTab === 'url' && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-stone-400" />
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/recipe.jpg (이미지 주소 붙여넣기)"
                    className="flex-1 rounded-xl border border-orange-200 bg-white px-3 py-2 text-xs text-stone-800 outline-none focus:border-orange-400"
                  />
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="text-xs font-bold text-red-500 hover:underline"
                    >
                      삭제
                    </button>
                  )}
                </div>
                {imageUrl && (
                  <div className="relative mt-2 h-28 w-40 overflow-hidden rounded-xl border border-orange-200">
                    <img
                      src={imageUrl}
                      alt="미리보기"
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={() => showToast('⚠️ 이미지를 불러올 수 없습니다. URL을 확인해주세요.')}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Image File Upload */}
            {imageTab === 'upload' && (
              <div className="mt-3 space-y-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-xl border border-orange-200 bg-white px-3 py-2 text-xs font-bold text-stone-700 shadow-sm hover:bg-orange-50"
                  >
                    <Upload className="h-3.5 w-3.5 text-orange-600" />
                    <span>내 기기에서 사진 선택 (최대 2MB)</span>
                  </button>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="text-xs font-bold text-red-500 hover:underline"
                    >
                      사진 지우기
                    </button>
                  )}
                </div>
                {imageUrl && (
                  <div className="relative mt-2 h-28 w-40 overflow-hidden rounded-xl border border-orange-200 shadow-sm">
                    <img
                      src={imageUrl}
                      alt="업로드 미리보기"
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Base Servings, Cooking Time, Difficulty, Calories & Bookmark Option */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {/* 기준 인분 */}
            <div>
              <label className="block text-xs font-bold text-stone-700">
                기준 인분 <span className="text-orange-500">*</span>
              </label>
              <div className="mt-1.5 flex items-center justify-between rounded-xl border border-orange-200 bg-[#fffdfa] px-2 py-1 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100">
                <button
                  type="button"
                  onClick={() => setBaseServings((prev) => Math.max(1, prev - 1))}
                  disabled={baseServings <= 1}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100 text-orange-700 transition hover:bg-orange-200 active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                  aria-label="기준 인분 1 감소"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <div className="flex items-center justify-center gap-0.5 font-bold text-stone-800 text-sm">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={baseServings}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (isNaN(val)) {
                        setBaseServings(1);
                      } else {
                        setBaseServings(Math.max(1, Math.min(20, val)));
                      }
                    }}
                    className="w-8 text-center font-black text-stone-900 bg-transparent outline-none"
                  />
                  <span className="text-xs font-medium text-stone-500">인분</span>
                </div>
                <button
                  type="button"
                  onClick={() => setBaseServings((prev) => Math.min(20, prev + 1))}
                  disabled={baseServings >= 20}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100 text-orange-700 transition hover:bg-orange-200 active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                  aria-label="기준 인분 1 증가"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* 소요 시간 */}
            <div>
              <label className="block text-xs font-bold text-stone-700">소요 시간 (분)</label>
              <input
                type="number"
                min={1}
                max={300}
                value={cookingTime}
                onChange={(e) => setCookingTime(Number(e.target.value))}
                className="mt-1.5 w-full rounded-xl border border-orange-200 bg-[#fffdfa] px-3.5 py-2 text-sm text-stone-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            {/* 난이도 */}
            <div>
              <label className="block text-xs font-bold text-stone-700">난이도</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as '쉬움' | '보통' | '어려움')}
                className="mt-1.5 w-full rounded-xl border border-orange-200 bg-[#fffdfa] px-3.5 py-2 text-sm text-stone-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              >
                <option value="쉬움">쉬움</option>
                <option value="보통">보통</option>
                <option value="어려움">어려움</option>
              </select>
            </div>

            {/* 1인분 칼로리 */}
            <div>
              <label className="block text-xs font-bold text-stone-700">1인분 칼로리 (kcal)</label>
              <input
                type="number"
                min={1}
                max={5000}
                placeholder="예: 420 (선택)"
                value={caloriesPerServing}
                onChange={(e) => setCaloriesPerServing(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-orange-200 bg-[#fffdfa] px-3.5 py-2 text-sm text-stone-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            {/* 즐겨찾기 */}
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-orange-200 bg-[#fffdfa] p-2.5 transition hover:bg-orange-50">
                <input
                  type="checkbox"
                  checked={isBookmarked}
                  onChange={(e) => setIsBookmarked(e.target.checked)}
                  className="h-4 w-4 rounded accent-orange-500"
                />
                <span className="flex items-center gap-1 text-xs font-bold text-stone-700">
                  <Bookmark className={`h-3.5 w-3.5 ${isBookmarked ? 'fill-amber-500 text-amber-500' : 'text-stone-400'}`} />
                  <span className="truncate">즐겨찾기</span>
                </span>
              </label>
            </div>
          </div>

          {/* Ingredients Input */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-stone-700">재료 목록 (줄바꿈 구분) *</label>
              <span className="text-[11px] text-stone-400">한 줄에 1개씩 입력</span>
            </div>
            <textarea
              required
              rows={4}
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              placeholder="예:&#10;두부 1/2모&#10;진간장 2큰술&#10;고춧가루 1큰술&#10;대파 1/2대&#10;참기름 0.5큰술"
              className="mt-1.5 w-full rounded-xl border border-orange-200 bg-[#fffdfa] p-3 text-xs leading-relaxed text-stone-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          {/* Cooking Method Input */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-stone-700">조리 순서 (줄바꿈 구분)</label>
              <span className="text-[11px] text-stone-400">한 줄에 1단계씩 입력</span>
            </div>
            <textarea
              rows={4}
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              placeholder="예:&#10;팬에 기름을 두르고 파를 볶아 파기름을 냅니다.&#10;양념과 물 100ml를 붓고 끓입니다.&#10;두부를 넣고 국물이 자작해질 때까지 3분간 졸여 완성합니다."
              className="mt-1.5 w-full rounded-xl border border-orange-200 bg-[#fffdfa] p-3 text-xs leading-relaxed text-stone-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          {/* Personal Note Input */}
          <div>
            <label className="block text-xs font-bold text-stone-700">내 요리 메모 (선택)</label>
            <textarea
              rows={2}
              value={userNote}
              onChange={(e) => setUserNote(e.target.value)}
              placeholder="예: 간이 약간 짤 수 있으니 물을 1스푼 추가할 것. 청양고추 1개 넣으면 훨씬 맛있음!"
              className="mt-1.5 w-full rounded-xl border border-amber-200 bg-amber-50/30 p-2.5 text-xs leading-relaxed text-stone-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
          </div>

          {/* Form Actions (Delete button if editing mode) */}
          <div className="flex items-center justify-between border-t border-orange-100 pt-4">
            {isEditMode && onDeleteRecipe ? (
              <button
                type="button"
                onClick={handleDeleteClick}
                className="flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>레시피 삭제</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="rounded-xl px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-100 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-xs font-black text-white shadow-md transition hover:from-orange-600 hover:to-amber-600 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>저장 중...</span>
                  </>
                ) : (
                  <>
                    {isEditMode ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    <span>{isEditMode ? '수정 내용 저장' : '레시피 등록'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
