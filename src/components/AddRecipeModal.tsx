/**
 * @file src/components/AddRecipeModal.tsx
 * @description 사용자가 자신만의 레시피를 직접 등록하거나 편집할 수 있는 모달 폼 컴포넌트
 */

import React, { useState } from 'react';
import { X, Plus, Sparkles, ChefHat } from 'lucide-react';
import { CATEGORY_LIST } from '../config/appConfig';
import { Recipe, RecipeCategory } from '../types/recipe';
import { logger } from '../utils/logger';

interface AddRecipeModalProps {
  /** 모달 열림 여부 */
  isOpen: boolean;
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 레시피 저장 핸들러 */
  onSaveRecipe: (recipe: Recipe) => void;
  /** 토스트 메시지 표시 함수 */
  showToast: (msg: string) => void;
}

const EMOJI_OPTIONS = ['🥘', '🍳', '🥗', '🥣', '🍽️', '🍛', '🍚', '🥪', '🍜', '🥩', '🦐', '🍝'];

/**
 * 사용자 레시피 추가 모달 폼
 */
export const AddRecipeModal: React.FC<AddRecipeModalProps> = ({
  isOpen,
  onClose,
  onSaveRecipe,
  showToast,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<RecipeCategory>('반찬');
  const [icon, setIcon] = useState('🍳');
  const [ingredients, setIngredients] = useState('');
  const [method, setMethod] = useState('');
  const [cookingTime, setCookingTime] = useState<number>(15);
  const [difficulty, setDifficulty] = useState<'쉬움' | '보통' | '어려움'>('쉬움');

  if (!isOpen) return null;

  /**
   * 폼 제출 및 레시피 생성 핸들러
   * @param e 폼 이벤트
   */
  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    logger.info('AddRecipeModal.handleSubmit', `새 레시피 등록 시도: "${name}"`);

    if (!name.trim()) {
      showToast('⚠️ 음식명을 입력해주세요.');
      return;
    }
    if (!ingredients.trim()) {
      showToast('⚠️ 재료를 최소 1개 이상 입력해주세요.');
      return;
    }

    const ingLines = ingredients.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    const stepLines = method.split(/\n+/).map((s) => s.trim()).filter(Boolean);

    const newRecipe: Recipe = {
      id: Date.now(),
      name: name.trim(),
      category,
      icon,
      ingredients: ingredients.trim(),
      method: method.trim() || '-',
      ingredientCount: ingLines.length,
      stepCount: stepLines.length,
      cookingTimeMinutes: Number(cookingTime) || 15,
      difficulty,
      isCustom: true,
      updatedAt: new Date().toISOString(),
    };

    onSaveRecipe(newRecipe);
    showToast(`🎉 '${newRecipe.name}' 레시피가 성공적으로 등록되었습니다!`);
    
    // 폼 초기화 후 닫기
    setName('');
    setIngredients('');
    setMethod('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="addRecipeTitle"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-scroll max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-center justify-between border-b border-orange-100 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-orange-500 text-xl text-white shadow-sm">
              ✨
            </span>
            <div>
              <h2 id="addRecipeTitle" className="font-soft text-xl font-black text-stone-900 sm:text-2xl">
                나만의 레시피 등록
              </h2>
              <p className="text-xs font-semibold text-stone-500">
                자주 해먹는 나만의 황금비율 요리를 기록해보세요.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-red-100 hover:text-red-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Recipe Name & Category */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-stone-700">음식명 *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 초간단 참치마요김밥"
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

          {/* Emoji Icon Picker */}
          <div>
            <label className="block text-xs font-bold text-stone-700">대표 이모지</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setIcon(em)}
                  className={`grid h-10 w-10 place-items-center rounded-xl text-xl transition ${
                    icon === em
                      ? 'bg-orange-500 text-white shadow-md scale-110'
                      : 'bg-stone-50 hover:bg-orange-100'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* Cooking Time & Difficulty */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700">소요 시간 (분)</label>
              <input
                type="number"
                min={1}
                max={300}
                value={cookingTime}
                onChange={(e) => setCookingTime(Number(e.target.value))}
                className="mt-1.5 w-full rounded-xl border border-orange-200 bg-[#fffdfa] px-3.5 py-2.5 text-sm text-stone-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700">난이도</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as '쉬움' | '보통' | '어려움')}
                className="mt-1.5 w-full rounded-xl border border-orange-200 bg-[#fffdfa] px-3.5 py-2.5 text-sm text-stone-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              >
                <option value="쉬움">쉬움</option>
                <option value="보통">보통</option>
                <option value="어려움">어려움</option>
              </select>
            </div>
          </div>

          {/* Ingredients Input */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-stone-700">재료 목록 (줄바꿈 구분) *</label>
              <span className="text-[11px] text-stone-400">한 줄에 하나씩 입력</span>
            </div>
            <textarea
              required
              rows={4}
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              placeholder="예:&#10;두부 1/2모&#10;진간장 2큰술&#10;고춧가루 1큰술&#10;대파 1/2대"
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
              placeholder="예:&#10;팬에 기름을 두르고 파를 볶아 파기름을 냅니다.&#10;양념과 물을 붓고 끓입니다.&#10;두부를 넣고 졸여 완성합니다."
              className="mt-1.5 w-full rounded-xl border border-orange-200 bg-[#fffdfa] p-3 text-xs leading-relaxed text-stone-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-orange-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-5 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-100"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-2.5 text-xs font-extrabold text-white shadow-md transition hover:from-orange-600 hover:to-amber-600"
            >
              <Plus className="h-4 w-4" />
              <span>레시피 저장하기</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
