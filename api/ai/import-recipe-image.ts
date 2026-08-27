/**
 * @file api/ai/import-recipe-image.ts
 * @description Vercel Serverless Function - 사진(요리책, 손글씨 메모, 포장지, 캡처) 기반 멀티모달 OCR 레시피 추출 API.
 * handler 내부 dynamic import를 적용하여 공통 모듈 로딩 오류 발생 시에도 JSON 형태로 안전하게 반환합니다.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

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
    const { importRecipeFromImage } = await import('../../lib/geminiService.js');

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

    const { imageBase64, mimeType } = (body || {}) as {
      imageBase64?: string;
      mimeType?: string;
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
    });

    if (!result.success) {
      res.status(500).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('[import-recipe-image] module/runtime error:', error);

    res.status(500).json({
      success: false,
      error: 'AI 서버 실행 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.stack || error.message : String(error),
    });
  }
}
