/**
 * @file api/ai/import-recipe-image.ts
 * @description Vercel Serverless Function - 사진(요리책, 손글씨 메모, 포장지, 캡처) 기반 멀티모달 OCR 레시피 추출 API.
 * Vercel Serverless 및 Node 22 ESM 환경에 맞춰 정적 import를 적용하고 상세 런타임 오류 진단 로깅을 제공합니다.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { importRecipeFromImage } from '../../lib/geminiService.js';

/**
 * Vercel Serverless Function 핸들러
 * POST /api/ai/import-recipe-image
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

    const { imageBase64, mimeType, requestId, availableCategories } = (body || {}) as {
      imageBase64?: string;
      mimeType?: string;
      requestId?: string;
      availableCategories?: string[];
    };

    if (!imageBase64 || !imageBase64.trim()) {
      res.status(400).json({
        success: false,
        error: '이미지 데이터가 필요합니다.',
      });
      return;
    }

    const result = await importRecipeFromImage({
      imageBase64,
      mimeType,
      requestId,
      availableCategories,
    });

    if (!result.success) {
      res.status(500).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('[import-recipe-image] fatal runtime error', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      error: 'AI 서버 실행 중 오류가 발생했습니다.',
      errorCode: 'AI_IMPORT_IMAGE_RUNTIME_ERROR',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
