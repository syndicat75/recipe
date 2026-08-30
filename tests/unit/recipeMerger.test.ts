/**
 * @file tests/unit/recipeMerger.test.ts
 * @description 로컬 및 클라우드 레시피 스마트 병합 유틸리티 단위 테스트
 */

import { describe, it, expect } from 'vitest';
import { mergeRecipeLists } from '../../src/utils/recipeMerger';
import { Recipe } from '../../src/types/recipe';

describe('Recipe Merger Unit Tests', () => {
  const sampleCloudRecipes: Recipe[] = [
    {
      id: 1,
      name: '된장찌개 (Cloud)',
      category: '국·찌개',
      ingredients: '된장 2스푼\n두부 반모',
      method: '끓인다',
      ingredientCount: 2,
      stepCount: 1,
      icon: '🍲',
      syncScope: 'public',
      createdAt: 1000,
      updatedAt: 2000,
    },
    {
      id: 2,
      name: '김치볶음밥',
      category: '밥·죽',
      ingredients: '밥 1공기\n김치 100g',
      method: '볶는다',
      ingredientCount: 2,
      stepCount: 1,
      icon: '🍳',
      syncScope: 'public',
      createdAt: 1000,
      updatedAt: 1000,
    },
  ];

  it('로컬에만 있는 신규 레시피가 정상적으로 병합되어야 함', () => {
    const localRecipes: Recipe[] = [
      {
        id: 3,
        name: '계란말이 (Local Only)',
        category: '반찬',
        ingredients: '계란 3개',
        method: '말아서 부친다',
        ingredientCount: 1,
        stepCount: 1,
        icon: '🥚',
        isCustom: true,
        createdAt: 3000,
        updatedAt: 3000,
      },
    ];

    const merged = mergeRecipeLists(localRecipes, sampleCloudRecipes);
    expect(merged.length).toBe(3);
    expect(merged.some((r) => r.id === 3)).toBe(true);
    expect(merged.find((r) => r.id === 3)?.name).toBe('계란말이 (Local Only)');
  });

  it('동일 ID 레시피 중 최신 updatedAt을 가진 레시피의 내용이 반영되어야 함', () => {
    const localRecipes: Recipe[] = [
      {
        id: 1,
        name: '된장찌개 (Local Newer)',
        category: '국·찌개',
        ingredients: '된장 3스푼\n두부 1모\n차돌박이',
        method: '맛있게 끓인다',
        ingredientCount: 3,
        stepCount: 1,
        icon: '🍲',
        createdAt: 1000,
        updatedAt: 5000, // Cloud(2000)보다 최신
      },
    ];

    const merged = mergeRecipeLists(localRecipes, sampleCloudRecipes);
    const mergedItem = merged.find((r) => r.id === 1);
    expect(mergedItem?.name).toBe('된장찌개 (Local Newer)');
    expect(mergedItem?.ingredients).toContain('차돌박이');
  });
});
