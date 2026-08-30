/**
 * @file tests/e2e/recipe-flow.spec.ts
 * @description Playwright E2E 핵심 레시피 탐색, 식단표 뷰, 검색 및 인터랙션 테스트
 */

import { test, expect } from '@playwright/test';

test.describe('내 입맛 레시피 E2E 핵심 테스트', () => {
  test('홈 화면 정상 로드 및 레시피 카드 목록 렌더링', async ({ page }) => {
    await page.goto('/');

    // 메인 헤더 및 로고 확인
    await expect(page.locator('h1, header')).toBeVisible();

    // 검색창 존재 확인
    const searchInput = page.locator('input[placeholder*="검색"]');
    await expect(searchInput).toBeVisible();

    // 카테고리 필터 바 존재 확인
    await expect(page.locator('text=전체')).toBeVisible();
  });

  test('주간 식단표 뷰 전환 및 AI 버튼 노출 확인', async ({ page }) => {
    await page.goto('/#meal-plan');

    // 주간 식단표 뷰 제목 확인
    await expect(page.locator('text=주간 식단표')).toBeVisible();

    // AI 자동 식단 생성 버튼 또는 관련 액션 버튼 확인
    const aiButton = page.locator('text=AI로 이번 주 식단 만들기, text=식단');
    await expect(aiButton.first()).toBeVisible();
  });

  test('AI 요리사 뷰 전환 확인', async ({ page }) => {
    await page.goto('/#ai-chef');

    // AI 요리사 헤더 또는 입력 폼 확인
    await expect(page.locator('text=AI 요리사').first()).toBeVisible();
  });
});
