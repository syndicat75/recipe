/**
 * @file api/ai/diagnostic.ts
 * @description Vercel Serverless Function - AI 모듈 로딩 및 환경변수 설정 진단 엔드포인트.
 * GEMINI_API_KEY 설정 여부와 @google/genai SDK 로딩 가능 여부를 안전하게 검사합니다.
 * 보안을 위해 API Key 실제 문자열은 절대 반환하지 않습니다.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getGeminiClient } from '../_lib/geminiService';

/**
 * AI 진단 핸들러
 * GET /api/ai/diagnostic
 * @param req VercelRequest 요청 객체
 * @param res VercelResponse 응답 객체
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
    return;
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const isApiKeyConfigured = Boolean(apiKey && apiKey.trim().length > 0);

    let geminiModuleLoaded = false;
    let clientInitializationSuccess = false;
    let errorDetail: string | undefined;

    try {
      // getGeminiClient 호출 테스트
      if (isApiKeyConfigured) {
        const client = getGeminiClient();
        if (client) {
          clientInitializationSuccess = true;
        }
      }
      geminiModuleLoaded = true;
    } catch (sdkError) {
      console.error('Gemini SDK diagnostic error:', sdkError);
      errorDetail = sdkError instanceof Error ? sdkError.message : String(sdkError);
    }

    res.status(200).json({
      success: true,
      environment: process.env.VERCEL ? 'vercel' : 'node',
      geminiApiKeyConfigured: isApiKeyConfigured,
      geminiModuleLoaded,
      clientInitializationSuccess,
      model: 'gemini-3.7-flash',
      timestamp: new Date().toISOString(),
      ...(errorDetail ? { details: errorDetail } : {}),
    });
  } catch (error) {
    console.error('Diagnostic endpoint failed:', error);
    res.status(500).json({
      success: false,
      error: '진단 엔드포인트 실행 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
