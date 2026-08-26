/**
 * @file api/ai/diagnostic.ts
 * @description Vercel Serverless Function - AI 모듈 로딩 및 환경변수 설정 진단 엔드포인트.
 * GEMINI_API_KEY 설정 여부와 @google/genai SDK 로딩 가능 여부를 안전하게 검사합니다.
 * geminiService나 다른 모듈에 의존하지 않는 완전 독립 함수입니다.
 * 보안을 위해 API Key 실제 문자열은 절대 반환하거나 콘솔에 출력하지 않습니다.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * AI 진단 핸들러
 * GET /api/ai/diagnostic
 * @param req VercelRequest 요청 객체
 * @param res VercelResponse 응답 객체
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const hasKey = Boolean(process.env.GEMINI_API_KEY?.trim());

  let sdkLoaded = false;
  let clientCreated = false;
  let details = '';

  try {
    const sdk = await import('@google/genai');
    sdkLoaded = true;

    if (hasKey) {
      const client = new sdk.GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY!.trim(),
      });
      clientCreated = Boolean(client);
    }
  } catch (error) {
    details =
      error instanceof Error
        ? error.stack || error.message
        : String(error);
  }

  res.status(200).json({
    success: true,
    vercel: Boolean(process.env.VERCEL),
    nodeVersion: process.version,
    geminiApiKeyConfigured: hasKey,
    sdkLoaded,
    clientCreated,
    details: details || undefined,
  });
}
