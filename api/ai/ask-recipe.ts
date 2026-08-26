/**
 * @file api/ai/ask-recipe.ts
 * @description Vercel Serverless Function - AI 요리사 레시피 Q&A 상담 API.
 * api/_lib/geminiService의 정적 import를 사용하여 Vercel 번들러가 의존성을 안정적으로 패키징합니다.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { askChefAboutRecipe } from '../_lib/geminiService';

/**
 * Vercel Serverless Function 핸들러
 * POST /api/ai/ask-recipe
 * @param req VercelRequest 요청 객체
 * @param res VercelResponse 응답 객체
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // 항상 JSON 응답 헤더 설정
  res.setHeader('Content-Type', 'application/json');

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

    const { recipe, question, chatHistory } = (body || {}) as {
      recipe?: {
        name: string;
        category?: string;
        ingredients?: string;
        method?: string;
        userNotes?: string;
        cookingTimeMinutes?: number;
        difficulty?: string;
      } | null;
      question: string;
      chatHistory?: Array<{ role: 'user' | 'model'; text: string }>;
    };

    if (!question || !question.trim()) {
      res.status(400).json({
        success: false,
        error: '질문 내용을 입력해주세요.',
      });
      return;
    }

    const result = await askChefAboutRecipe({ recipe, question, chatHistory });

    if (!result.success) {
      res.status(500).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('AI function runtime error in /api/ai/ask-recipe:', error);
    res.status(500).json({
      success: false,
      error: 'AI 서버 실행 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
