/**
 * @file api/ai/generate-meal-plan.ts
 * @description Vercel Serverless Function - AI 주간 식단표 자동 생성 API.
 * 사용자가 등록한 실제 후보 레시피 목록과 제약 조건을 기반으로 일주일치 맞춤 식단 및 요약을 JSON으로 생성합니다.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWeeklyMealPlan } from '../../lib/geminiService.js';

/**
 * Vercel Serverless Function 핸들러
 * POST /api/ai/generate-meal-plan
 * @param req VercelRequest 요청 객체
 * @param res VercelResponse 응답 객체
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // 항상 JSON 응답 헤더 설정
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
    return;
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        res.status(400).json({
          success: false,
          error: '올바른 JSON 요청 본문이 아닙니다.',
        });
        return;
      }
    }

    const { config, candidateRecipes, recentMealRecipeIds, requestId } = (body || {}) as {
      config?: {
        mode: 'single' | 'detail';
        dates: string[];
        servings?: number;
        noDuplicates?: boolean;
        excludeRecent?: boolean;
        diverseCategories?: boolean;
        prioritizeBookmarks?: boolean;
        maxCaloriesPerServing?: number | null;
        strictCalories?: boolean;
        maxCookingTimeMinutes?: number | null;
        customPrompt?: string;
      };
      candidateRecipes?: Array<{
        id: number;
        name: string;
        category: string;
        cookingTimeMinutes?: number | null;
        caloriesPerServing?: number | null;
        baseServings?: number;
        isBookmarked?: boolean;
        ingredients?: string;
      }>;
      recentMealRecipeIds?: number[];
      requestId?: string;
    };

    if (!config || !Array.isArray(config.dates) || config.dates.length === 0) {
      res.status(400).json({
        success: false,
        error: '식단을 생성할 날짜 목록(dates)이 필요합니다.',
      });
      return;
    }

    if (!candidateRecipes || candidateRecipes.length === 0) {
      res.status(400).json({
        success: false,
        error: '식단에 사용할 후보 레시피가 없습니다.',
      });
      return;
    }

    const result = await generateWeeklyMealPlan({
      config,
      candidateRecipes,
      recentMealRecipeIds,
      requestId,
    });

    if (!result.success) {
      res.status(500).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Error in /api/ai/generate-meal-plan:', error);
    res.status(500).json({
      success: false,
      error: 'AI 주간 식단 생성 중 서버 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
