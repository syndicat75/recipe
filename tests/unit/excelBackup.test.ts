/**
 * @file tests/unit/excelBackup.test.ts
 * @description Excel 백업 및 복원 유틸리티 기능 단위 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  parseIngredientLineToParts,
  formatIngredientLineFromParts,
  executeExcelRestore,
} from '../../src/utils/excelBackup';
import { Recipe } from '../../src/types/recipe';

const mockRecipes: Recipe[] = [
  {
    id: 1,
    name: '돼지고기 김치찌개',
    category: '찌개',
    ingredients: '돼지고기 200g (찌개용)\n신김치 300g\n대파 1대\n다진마늘 1/2큰술\n고춧가루 1큰술\n물 500ml\n소금 약간',
    method: '1. 냄비에 돼지고기와 김치를 넣고 볶는다.\n2. 물을 붓고 끓인다.\n3. 대파와 양념을 넣고 10분간 더 끓인다.',
    ingredientCount: 7,
    stepCount: 3,
    icon: '🍲',
    cookingTimeMinutes: 25,
    difficulty: '쉬움',
    baseServings: 2,
    caloriesPerServing: 350,
    isBookmarked: true,
    userNotes: '묵은지로 끓이면 더 깊은 맛이 납니다.',
    tip: '들기름에 김치를 먼저 볶아보세요.',
    isCustom: true,
    syncScope: 'public',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: 2,
    name: '계란말이',
    category: '반찬',
    ingredients: '계란 4개\n당근 30g (잘게 다짐)\n대파 1/2대\n소금 1/2작은술',
    method: '1. 계란을 풀고 채소를 섞는다.\n2. 팬에 기름을 두르고 얇게 부친 후 만다.',
    ingredientCount: 4,
    stepCount: 2,
    icon: '🍳',
    cookingTimeMinutes: 15,
    difficulty: '보통',
    baseServings: 2,
    caloriesPerServing: 180,
    isBookmarked: false,
    isCustom: true,
    syncScope: 'private',
    createdAt: 1700001000000,
    updatedAt: 1700001000000,
  },
];

describe('excelBackup Utility', () => {
  describe('parseIngredientLineToParts', () => {
    it('수량, 단위, 메모가 포함된 재료 라인을 정확하게 분리해야 한다', () => {
      const parsed = parseIngredientLineToParts('돼지고기 200g (찌개용)');
      expect(parsed.name).toBe('돼지고기');
      expect(parsed.quantity).toBe('200');
      expect(parsed.unit).toBe('g');
      expect(parsed.notes).toBe('찌개용');
    });

    it('분수 수량(1/2큰술)을 정확하게 파싱해야 한다', () => {
      const parsed = parseIngredientLineToParts('다진마늘 1/2큰술');
      expect(parsed.name).toBe('다진마늘');
      expect(parsed.quantity).toBe('1/2');
      expect(parsed.unit).toBe('큰술');
    });

    it('비수량 표현(소금 약간)을 정확하게 파싱해야 한다', () => {
      const parsed = parseIngredientLineToParts('소금 약간');
      expect(parsed.name).toBe('소금');
      expect(parsed.quantity).toBe('');
      expect(parsed.unit).toBe('약간');
    });

    it('범위 수량(1~2큰술)을 정확하게 파싱해야 한다', () => {
      const parsed = parseIngredientLineToParts('설탕 1~2큰술');
      expect(parsed.name).toBe('설탕');
      expect(parsed.quantity).toBe('1~2');
      expect(parsed.unit).toBe('큰술');
    });
  });

  describe('formatIngredientLineFromParts', () => {
    it('파싱된 객체를 다시 한 줄 문자열로 복원해야 한다', () => {
      const line = formatIngredientLineFromParts({
        name: '돼지고기',
        quantity: '200',
        unit: 'g',
        notes: '찌개용',
      });
      expect(line).toBe('돼지고기 200g (찌개용)');
    });
  });

  describe('executeExcelRestore Duplicate Strategies', () => {
    const existing: Recipe[] = [mockRecipes[0]];
    const incoming: Recipe[] = [
      {
        ...mockRecipes[0],
        name: '돼지고기 김치찌개',
        method: '새로운 조리법',
      },
      mockRecipes[1],
    ];

    it('skip 전략: 중복 레시피는 건너뛰고 신규 레시피만 추가해야 한다', () => {
      const result = executeExcelRestore(incoming, existing, 'skip');
      expect(result.success).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.restoredRecipes.length).toBe(2);
      expect(result.restoredRecipes.find((r) => r.id === 1)?.method).toBe(mockRecipes[0].method);
    });

    it('overwrite 전략: 중복 레시피는 덮어쓰고 신규 레시피도 추가해야 한다', () => {
      const result = executeExcelRestore(incoming, existing, 'overwrite');
      expect(result.success).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.restoredRecipes.length).toBe(2);
      expect(result.restoredRecipes.find((r) => r.id === 1)?.method).toBe('새로운 조리법');
    });

    it('createNew 전략: 모든 레시피에 신규 ID를 부여하여 추가해야 한다', () => {
      const result = executeExcelRestore(incoming, existing, 'createNew');
      expect(result.success).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.restoredRecipes.length).toBe(3); // 기존 1개 + 새로 2개
    });
  });
});
