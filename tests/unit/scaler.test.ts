/**
 * @file tests/unit/scaler.test.ts
 * @description 인분 배율 및 재료 분량 수학적 스케일링 유틸리티 단위 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  calculateServingsMultiplier,
  formatQuantityNumber,
  scaleSingleQuantity,
  scaleIngredientLine,
  getScaledIngredientsList,
} from '../../src/utils/scaler';

describe('Scaler Utility Unit Tests', () => {
  it('인분 배율(calculateServingsMultiplier)이 정확하게 계산되어야 함', () => {
    // 1인분 기준 -> 3인분 선택 => multiplier = 3
    expect(calculateServingsMultiplier(1, 3)).toBe(3);
    // 2인분 기준 -> 4인분 선택 => multiplier = 2
    expect(calculateServingsMultiplier(2, 4)).toBe(2);
    // 4인분 기준 -> 2인분 선택 => multiplier = 0.5
    expect(calculateServingsMultiplier(4, 2)).toBe(0.5);
    // 0이거나 유효하지 않은 기준인분인 경우 최소 1로 보정
    expect(calculateServingsMultiplier(0, 2)).toBe(2);
  });

  it('수량 포맷(formatQuantityNumber)이 정수와 소수를 깔끔하게 표기해야 함', () => {
    expect(formatQuantityNumber(2)).toBe('2');
    expect(formatQuantityNumber(0.5)).toBe('1/2');
    expect(formatQuantityNumber(1.3333)).toBe('1 1/3');
    expect(formatQuantityNumber(2.5)).toBe('2.5');
  });

  it('단일 수량 스케일링(scaleSingleQuantity)이 배율에 따라 정확히 계산되어야 함', () => {
    expect(scaleSingleQuantity(100, 2)).toBe('200');
    expect(scaleSingleQuantity(1, 0.5)).toBe('1/2');
  });

  it('재료 한 줄 스케일링(scaleIngredientLine)이 단위 및 수량을 보존하면서 변환해야 함', () => {
    // 200g * 2 => 400g
    const scaled1 = scaleIngredientLine('돼지고기 200g', 2);
    expect(scaled1).toContain('400');
    expect(scaled1).toContain('g');

    // 1큰술 * 3 => 3큰술
    const scaled2 = scaleIngredientLine('간장 1큰술', 3);
    expect(scaled2).toContain('3');
    expect(scaled2).toContain('큰술');

    // 수량이 없는 경우 원본 유지
    const scaled3 = scaleIngredientLine('후추 약간', 2);
    expect(scaled3).toBe('후추 약간');
  });

  it('다중 줄 재료 스케일링(getScaledIngredientsList)이 전체 목록을 정상 변환해야 함', () => {
    const rawIngredients = '김치 150g\n돼지고기 100g\n대파 1/2대\n물 400ml';
    const scaled = getScaledIngredientsList(rawIngredients, 2);
    expect(scaled.length).toBe(4);
    expect(scaled[0]).toContain('300');
    expect(scaled[1]).toContain('200');
  });
});
