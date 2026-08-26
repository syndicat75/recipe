/**
 * @file api/ai/ask-recipe.ts
 * @description Vercel Serverless Function - AI 요리사 레시피 Q&A 상담 API
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { askChefAboutRecipe } from '../../server/geminiService';

/**
 * Vercel Serverless Function 핸들러
 * POST /api/ai/ask-recipe
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
    console.error('Unhandled error in /api/ai/ask-recipe:', error);
    res.status(500).json({
      success: false,
      error: 'AI 답변 생성 중 문제가 발생했습니다.',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
