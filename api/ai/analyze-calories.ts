/**
 * @file api/ai/analyze-calories.ts
 * @description Vercel Serverless Function - AI 기반 레시피 칼로리(kcal) 분석 API.
 * 레시피 재료와 분량을 과학적/영양학적으로 분석하여 1인분 기준 및 총 예상 칼로리를 계산합니다.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { analyzeRecipeCalories } from '../../lib/geminiService.js';

/**
 * Vercel Serverless Function 핸들러
 * POST /api/ai/analyze-calories
 * @param req VercelRequest 요청 객체
 * @param res VercelResponse 응답 객체
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
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

    const { recipeId, name, category, ingredients, baseServings } = (body || {}) as {
      recipeId: number;
      name: string;
      category?: string;
      ingredients: string;
      baseServings?: number;
    };

    if (!name || !ingredients || !ingredients.trim()) {
      res.status(400).json({
        success: false,
        error: '요리 이름과 재료 정보가 필요합니다.',
      });
      return;
    }

    const result = await analyzeRecipeCalories({
      recipeId: Number(recipeId) || 0,
      name,
      category,
      ingredients,
      baseServings: Number(baseServings) >= 1 ? Number(baseServings) : 1,
    });

    if (!result.success) {
      res.status(500).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('[analyze-calories] fatal runtime error', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      error: '칼로리 분석 실행 중 오류가 발생했습니다.',
      errorCode: 'AI_ANALYZE_CALORIES_RUNTIME_ERROR',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
