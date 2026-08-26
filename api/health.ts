/**
 * @file api/health.ts
 * @description Vercel Serverless Function - 서버 헬스체크 API
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel Serverless Function 헬스체크 핸들러
 * GET /api/health
 */
export default function handler(req: VercelRequest, res: VercelResponse): void {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'production',
  });
}
