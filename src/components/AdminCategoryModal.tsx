/**
 * @file src/components/AdminCategoryModal.tsx
 * @description 관리자 전용 레시피 카테고리 관리 모달 (추가/수정/순서변경/삭제 안전장치/활성비활성)
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  Plus,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  Check,
  AlertCircle,
  Loader2,
  FolderKanban,
  Eye,
  EyeOff,
  MoveRight,
} from 'lucide-react';
import { RecipeCategoryDoc, Recipe } from '../types/recipe';
import { FALLBACK_CATEGORY } from '../config/appConfig';
import { normalizeCategoryName } from '../services/categoryService';
import { logger } from '../utils/logger';

interface AdminCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: RecipeCategoryDoc[];
  recipes: Recipe[];
  onAddCategory: (input: { name: string; icon?: string }) => Promise<RecipeCategoryDoc>;
  onUpdateCategory: (
    id: string,
    updates: { name?: string; icon?: string; isActive?: boolean },
    oldCat: RecipeCategoryDoc
  ) => Promise<{ updatedCategory: RecipeCategoryDoc; affectedRecipesCount: number }>;
  onDeleteCategory: (
    id: string,
    catToDelete: RecipeCategoryDoc,
    targetCategoryName?: string
  ) => Promise<{ migratedCount: number }>;
  onReorderCategories: (orderedIds: string[]) => Promise<void>;
  onToggleActive: (id: string, currentActive: boolean) => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

// 자주 쓰이는 추천 카테고리 이모지 프리셋
const PRESET_ICONS = ['🥗', '🥣', '🥘', '🍽️', '🍛', '🍳', '🍜', '🥩', '🍕', '🍰', '☕', '🍗', '🥪', '🍱', '🍤', '🍴'];

export const AdminCategoryModal: React.FC<AdminCategoryModalProps> = ({
  isOpen,
  onClose,
  categories,
  recipes,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onReorderCategories,
  onToggleActive,
  showToast,
}) => {
  // 모달 내부 상태
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('🥗');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 수정 대상
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');

  // 삭제 확인 다이얼로그 상태
  const [deletingCat, setDeletingCat] = useState<RecipeCategoryDoc | null>(null);
  const [targetMigrationCategory, setTargetMigrationCategory] = useState<string>(FALLBACK_CATEGORY);

  // 각 카테고리별 연결된 레시피 수 계산 (메모이제이션)
  const recipeCountMap = useMemo(() => {
    const map = new Map<string, number>();
    recipes.forEach((r) => {
      const cat = r.category?.trim() || FALLBACK_CATEGORY;
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return map;
  }, [recipes]);

  if (!isOpen) return null;

  // 1. 새 카테고리 추가 핸들러
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      showToast('카테고리 이름을 입력해주세요.', 'error');
      return;
    }

    const normalized = normalizeCategoryName(trimmed);
    if (categories.some((c) => normalizeCategoryName(c.name) === normalized)) {
      showToast('이미 존재하는 카테고리입니다.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      await onAddCategory({
        name: trimmed,
        icon: newIcon.trim() || undefined,
      });
      showToast(`'${trimmed}' 카테고리가 추가되었습니다.`, 'success');
      setNewName('');
      setNewIcon('🥗');
      setIsAdding(false);
    } catch (err: unknown) {
      logger.error('AdminCategoryModal.handleCreateCategory', '카테고리 추가 실패', err);
      showToast(err instanceof Error ? err.message : '카테고리 추가 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. 수정 모드 시작
  const startEdit = (cat: RecipeCategoryDoc) => {
    setEditingCatId(cat.id);
    setEditName(cat.name);
    setEditIcon(cat.icon || '🍴');
  };

  // 3. 수정 저장 핸들러
  const handleSaveEdit = async (cat: RecipeCategoryDoc) => {
    const trimmed = editName.trim();
    if (!trimmed) {
      showToast('카테고리 이름을 비워둘 수 없습니다.', 'error');
      return;
    }

    const normalized = normalizeCategoryName(trimmed);
    const isDup = categories.some(
      (c) => c.id !== cat.id && normalizeCategoryName(c.name) === normalized
    );
    if (isDup) {
      showToast('이미 존재하는 카테고리 이름입니다.', 'error');
      return;
    }

    const isNameChanged = trimmed !== cat.name;
    const connectedCount = recipeCountMap.get(cat.name) || 0;

    if (isNameChanged && connectedCount > 0) {
      const confirmed = window.confirm(
        `이 카테고리를 사용 중인 레시피 ${connectedCount}개가 함께 "${trimmed}"(으)로 변경됩니다.\n계속하시겠습니까?`
      );
      if (!confirmed) return;
    }

    try {
      setIsSubmitting(true);
      const res = await onUpdateCategory(
        cat.id,
        {
          name: trimmed,
          icon: editIcon.trim() || undefined,
        },
        cat
      );

      if (res.affectedRecipesCount > 0) {
        showToast(
          `카테고리명 및 연결된 레시피 ${res.affectedRecipesCount}개가 성공적으로 변경되었습니다.`,
          'success'
        );
      } else {
        showToast('카테고리가 수정되었습니다.', 'success');
      }
      setEditingCatId(null);
    } catch (err: unknown) {
      logger.error('AdminCategoryModal.handleSaveEdit', '카테고리 수정 실패', err);
      showToast(err instanceof Error ? err.message : '카테고리 수정에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. 순서 이동 핸들러 (위/아래)
  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const newOrderList = [...categories];
    const [moved] = newOrderList.splice(index, 1);
    newOrderList.splice(targetIndex, 0, moved);

    const orderedIds = newOrderList.map((c) => c.id);
    try {
      await onReorderCategories(orderedIds);
    } catch (err) {
      logger.error('AdminCategoryModal.handleMove', '순서 변경 오류', err);
      showToast('순서 변경 중 오류가 발생했습니다.', 'error');
    }
  };

  // 5. 삭제 확인 창 열기
  const openDeleteDialog = (cat: RecipeCategoryDoc) => {
    if (cat.id === 'etc' || cat.name === FALLBACK_CATEGORY) {
      showToast(`'${FALLBACK_CATEGORY}' 카테고리는 기본 카테고리이므로 삭제할 수 없습니다.`, 'info');
      return;
    }
    setDeletingCat(cat);
    // 이동할 다른 기본 후보 선택
    const available = categories.find((c) => c.id !== cat.id && c.name === FALLBACK_CATEGORY);
    setTargetMigrationCategory(available ? available.name : FALLBACK_CATEGORY);
  };

  // 6. 삭제 실행 핸들러
  const handleConfirmDelete = async () => {
    if (!deletingCat) return;

    const connectedCount = recipeCountMap.get(deletingCat.name) || 0;

    try {
      setIsSubmitting(true);
      const res = await onDeleteCategory(
        deletingCat.id,
        deletingCat,
        connectedCount > 0 ? targetMigrationCategory : undefined
      );

      if (res.migratedCount > 0) {
        showToast(
          `'${deletingCat.name}' 카테고리가 삭제되었으며, 레시피 ${res.migratedCount}개가 '${targetMigrationCategory}'(으)로 이동되었습니다.`,
          'success'
        );
      } else {
        showToast(`'${deletingCat.name}' 카테고리가 삭제되었습니다.`, 'success');
      }
      setDeletingCat(null);
    } catch (err: unknown) {
      logger.error('AdminCategoryModal.handleConfirmDelete', '삭제 실패', err);
      showToast(err instanceof Error ? err.message : '카테고리 삭제에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-fade-in">
      <div
        className="relative w-full max-w-xl max-h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-stone-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-orange-100 text-orange-600">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">레시피 카테고리 관리</h2>
              <p className="text-xs text-stone-500">
                카테고리를 추가, 수정, 정렬하고 활성화 상태를 변경합니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full transition"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 바디 컨텐츠 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* 새 카테고리 추가 버튼 or 입력 폼 */}
          {!isAdding ? (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="w-full py-3 px-4 rounded-2xl border-2 border-dashed border-orange-200 bg-orange-50/40 text-orange-700 hover:bg-orange-50 font-bold text-xs flex items-center justify-center gap-2 transition active:scale-98"
            >
              <Plus className="h-4 w-4" />
              <span>새 카테고리 추가</span>
            </button>
          ) : (
            <form
              onSubmit={handleCreateCategory}
              className="rounded-2xl border border-orange-200 bg-orange-50/50 p-4 space-y-3.5 animate-fade-in"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-orange-950">새 카테고리 등록</span>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-stone-400 hover:text-stone-600 text-xs"
                >
                  취소
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">아이콘</label>
                  <input
                    type="text"
                    value={newIcon}
                    onChange={(e) => setNewIcon(e.target.value)}
                    maxLength={4}
                    className="w-full text-center text-lg rounded-xl border border-stone-200 bg-white py-2 shadow-xs focus:border-orange-500 focus:outline-none"
                    placeholder="🥗"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">카테고리 이름</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    maxLength={20}
                    placeholder="예: 면·국수, 고기요리, 샐러드"
                    className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs text-stone-900 shadow-xs focus:border-orange-500 focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>

              {/* 프리셋 이모지 선택 */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-stone-500 mr-1">추천:</span>
                {PRESET_ICONS.slice(0, 10).map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setNewIcon(emoji)}
                    className={`h-7 w-7 rounded-lg text-sm flex items-center justify-center transition ${
                      newIcon === emoji
                        ? 'bg-orange-500 text-white shadow-xs scale-110'
                        : 'bg-white hover:bg-stone-100 border border-stone-200'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-orange-200/60">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newName.trim()}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white shadow-xs transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  <span>추가</span>
                </button>
              </div>
            </form>
          )}

          {/* 카테고리 리스트 */}
          <div className="space-y-2">
            {categories.map((cat, idx) => {
              const isEditing = editingCatId === cat.id;
              const connectedRecipes = recipeCountMap.get(cat.name) || 0;
              const isProtected = cat.id === 'etc' || cat.name === FALLBACK_CATEGORY;

              if (isEditing) {
                return (
                  <div
                    key={cat.id}
                    className="p-3.5 rounded-2xl border-2 border-orange-400 bg-white shadow-xs space-y-3 animate-fade-in"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editIcon}
                        onChange={(e) => setEditIcon(e.target.value)}
                        maxLength={4}
                        className="w-12 text-center text-base rounded-xl border border-stone-200 py-1.5 focus:border-orange-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        maxLength={20}
                        className="flex-1 text-xs font-bold text-stone-900 rounded-xl border border-stone-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                      {PRESET_ICONS.slice(0, 8).map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setEditIcon(emoji)}
                          className="h-6 w-6 text-xs rounded bg-stone-50 hover:bg-stone-200 flex items-center justify-center"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-xs">
                      <span className="text-[11px] text-stone-500">
                        연결된 레시피: <strong>{connectedRecipes}개</strong>
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingCatId(null)}
                          className="px-2.5 py-1 rounded-lg text-stone-500 hover:bg-stone-100"
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(cat)}
                          disabled={isSubmitting}
                          className="px-3 py-1 rounded-lg font-bold bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>저장</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={cat.id}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition ${
                    cat.isActive
                      ? 'border-stone-200 bg-white hover:border-stone-300'
                      : 'border-stone-100 bg-stone-50/70 opacity-60'
                  }`}
                >
                  {/* 왼쪽: 순서 조정 + 아이콘 + 이름 + 카운트 */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* 순서 변경 버튼 */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => handleMove(idx, 'up')}
                        disabled={idx === 0 || isSubmitting}
                        className="p-1 text-stone-400 hover:text-orange-600 hover:bg-stone-100 rounded disabled:opacity-20 transition"
                        title="위로 이동"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(idx, 'down')}
                        disabled={idx === categories.length - 1 || isSubmitting}
                        className="p-1 text-stone-400 hover:text-orange-600 hover:bg-stone-100 rounded disabled:opacity-20 transition"
                        title="아래로 이동"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>

                    <span className="text-xl shrink-0">{cat.icon || '🍴'}</span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-stone-900 truncate">{cat.name}</span>
                        {isProtected && (
                          <span className="text-[10px] bg-stone-100 text-stone-500 font-bold px-1.5 py-0.2 rounded-md">
                            기본
                          </span>
                        )}
                        {!cat.isActive && (
                          <span className="text-[10px] bg-rose-50 text-rose-600 font-bold px-1.5 py-0.2 rounded-md">
                            숨김
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-stone-400">
                        레시피 {connectedRecipes}개
                      </span>
                    </div>
                  </div>

                  {/* 오른쪽 조작 버튼들 */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* 활성/비활성 토글 */}
                    <button
                      type="button"
                      onClick={() => onToggleActive(cat.id, cat.isActive)}
                      className={`p-1.5 rounded-xl transition ${
                        cat.isActive
                          ? 'text-stone-500 hover:text-stone-800 hover:bg-stone-100'
                          : 'text-stone-400 hover:text-stone-600 bg-stone-200/60'
                      }`}
                      title={cat.isActive ? '카테고리 숨기기 (비활성화)' : '카테고리 보이기 (활성화)'}
                    >
                      {cat.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>

                    {/* 수정 버튼 */}
                    <button
                      type="button"
                      onClick={() => startEdit(cat)}
                      className="p-1.5 text-stone-500 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition"
                      title="이름/아이콘 수정"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>

                    {/* 삭제 버튼 */}
                    <button
                      type="button"
                      onClick={() => openDeleteDialog(cat)}
                      disabled={isProtected || isSubmitting}
                      className={`p-1.5 rounded-xl transition ${
                        isProtected
                          ? 'text-stone-200 cursor-not-allowed'
                          : 'text-stone-400 hover:text-rose-600 hover:bg-rose-50'
                      }`}
                      title={isProtected ? '기본 카테고리는 삭제할 수 없습니다.' : '카테고리 삭제'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 푸터 */}
        <div className="px-6 py-3.5 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
          <span>전체 카테고리: {categories.length}개</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-stone-200 hover:bg-stone-300 font-bold text-stone-800 transition"
          >
            닫기
          </button>
        </div>
      </div>

      {/* 카테고리 삭제 안전장치 확인 팝업 */}
      {deletingCat && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-2xl bg-rose-100">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">카테고리 삭제 확인</h3>
                <p className="text-xs text-stone-500">'{deletingCat.name}' 카테고리를 삭제하시겠습니까?</p>
              </div>
            </div>

            {/* 연결된 레시피가 있는 경우 마이그레이션 대상 선택 요구 */}
            {(recipeCountMap.get(deletingCat.name) || 0) > 0 ? (
              <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-950">
                <p className="font-semibold leading-relaxed">
                  ⚠️ 현재 <strong>'{deletingCat.name}'</strong> 카테고리를 사용하는 레시피가{' '}
                  <strong>{recipeCountMap.get(deletingCat.name)}개</strong> 있습니다.
                </p>
                <p className="text-amber-800 text-[11px]">
                  삭제 전에 해당 레시피들을 안전하게 다른 카테고리로 먼저 이동해야 합니다.
                </p>

                <div className="pt-2">
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">이동할 대상 카테고리:</label>
                  <select
                    value={targetMigrationCategory}
                    onChange={(e) => setTargetMigrationCategory(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-bold text-stone-900 shadow-xs focus:border-orange-500 focus:outline-none"
                  >
                    {categories
                      .filter((c) => c.id !== deletingCat.id)
                      .map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.icon || '🍴'} {c.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-stone-600 pt-1">
                  <span className="font-medium">{deletingCat.name}</span>
                  <MoveRight className="h-3 w-3 text-stone-400" />
                  <span className="font-bold text-orange-600">{targetMigrationCategory}</span>
                  <span>(일괄 이동 후 삭제)</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-stone-600">
                이 카테고리에 연결된 레시피가 없습니다. 삭제하면 카테고리 목록에서 즉시 제거됩니다.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCat(null)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                <span>{(recipeCountMap.get(deletingCat.name) || 0) > 0 ? '이동 후 삭제' : '삭제'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
