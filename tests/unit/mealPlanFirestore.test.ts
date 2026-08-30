/**
 * @file tests/unit/mealPlanFirestore.test.ts
 * @description 개인 식단표 클라우드-로컬 병합 단위 테스트
 */

import { describe, it, expect } from 'vitest';
import { mergeMealPlans } from '../../src/services/mealPlanFirestore';
import { WeeklyMealPlan } from '../../src/types/recipe';

describe('Meal Plan Firestore Merge Unit Tests', () => {
  it('mergeMealPlans가 로컬과 클라우드 엔트리를 무손실로 병합해야 함', () => {
    const localPlan: WeeklyMealPlan = {
      '2026-09-01': [
        {
          id: 'entry-1',
          date: '2026-09-01',
          slot: 'single',
          recipeId: 101,
          servings: 2,
          createdAt: 1000,
          updatedAt: 2000,
        },
      ],
      '2026-09-02': [
        {
          id: 'entry-2',
          date: '2026-09-02',
          slot: 'lunch',
          recipeId: 102,
          servings: 1,
          createdAt: 1000,
        },
      ],
    };

    const cloudPlan: WeeklyMealPlan = {
      '2026-09-01': [
        {
          id: 'entry-1',
          date: '2026-09-01',
          slot: 'single',
          recipeId: 101,
          servings: 4, // 로컬보다 이전 버전 (updatedAt: 1500)
          createdAt: 1000,
          updatedAt: 1500,
        },
      ],
      '2026-09-03': [
        {
          id: 'entry-3',
          date: '2026-09-03',
          slot: 'dinner',
          recipeId: 103,
          servings: 3,
          createdAt: 1000,
        },
      ],
    };

    const merged = mergeMealPlans(localPlan, cloudPlan);

    // 총 3개 날짜가 존재해야 함
    expect(Object.keys(merged).length).toBe(3);
    // entry-1은 로컬의 2인분(updatedAt: 2000)이 채택되어야 함
    expect(merged['2026-09-01'][0].servings).toBe(2);
    // entry-2(로컬만)와 entry-3(클라우드만) 모두 보존되어야 함
    expect(merged['2026-09-02'][0].recipeId).toBe(102);
    expect(merged['2026-09-03'][0].recipeId).toBe(103);
  });
});
