/**
 * @file src/utils/aiApiHelper.ts
 * @description AI API 호출 전용 안전 클라이언트 헬퍼.
 * Vercel Serverless 및 Express 환경에서 HTML fallback, 빈 응답, 페이로드 용량 초과 및
 * non-JSON 파싱 오류를 사전에 감지하고 사용자 친화적인 메시지를 제공합니다.
 */

import { logger } from './logger';

/**
 * AI API 기본 성공/실패 응답 구조 인터페이스
 */
export interface AiApiResponse<T = unknown> {
  success: boolean;
  error?: string;
  details?: string;
  data?: T;
  recipe?: T;
  answer?: string;
  recommendedRecipeId?: number | null;
  reason?: string;
  meta?: {
    sourceType?: 'jsonld' | 'html' | 'text' | 'image';
    fetchDurationMs?: number;
    parseDurationMs?: number;
    aiDurationMs?: number;
    totalDurationMs?: number;
    modelUsed?: string;
    retryCount?: number;
    fallbackUsed?: boolean;
    requestId?: string;
  };
}

/**
 * AI API 안전 호출 함수
 * @param endpoint API 엔드포인트 URL (예: /api/ai/import-recipe-image)
 * @param payload 요청 본문 객체
 * @param maxPayloadMb 허용 최대 페이로드 용량 (MB 단위, 기본 4.0MB)
 * @param timeoutMs 클라이언트 요청 제한시간 (밀리초, 기본 35000ms)
 * @returns 안전하게 파싱된 AI API 응답 객체
 */
export async function callAiApi<T = unknown>(
  endpoint: string,
  payload: Record<string, unknown>,
  maxPayloadMb: number = 4.0,
  timeoutMs: number = 35000
): Promise<AiApiResponse<T>> {
  logger.info('aiApiHelper.callAiApi', `AI API 호출 시작: ${endpoint} (timeout: ${timeoutMs}ms)`);

  // 1. 요청 페이로드 크기 검증 (Vercel Serverless Function 4.5MB 제한 대비)
  const jsonString = JSON.stringify(payload);
  const payloadSizeMb = new Blob([jsonString]).size / 1024 / 1024;

  if (payloadSizeMb > maxPayloadMb) {
    logger.warn('aiApiHelper.callAiApi', `요청 페이로드 용량 초과: ${payloadSizeMb.toFixed(2)}MB > ${maxPayloadMb}MB`);
    throw new Error('사진 용량이 너무 큽니다. 더 작은 사진을 선택해주세요.');
  }

  // 2. Fetch 실행 (지정된 타임아웃 제한시간 적용)
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: jsonString,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (netErr) {
    logger.error('aiApiHelper.callAiApi', `네트워크/타임아웃 오류: ${endpoint}`, netErr);
    if (netErr instanceof Error && (netErr.name === 'TimeoutError' || netErr.name === 'AbortError')) {
      throw new Error('AI 분석 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
    }
    throw new Error('인터넷 연결 상태를 확인하거나 잠시 후 다시 시도해주세요.');
  }

  // 3. raw text 먼저 추출하여 빈 응답 방어
  const rawText = await response.text();

  if (!rawText.trim()) {
    logger.error('aiApiHelper.callAiApi', `빈 응답 수신 (HTTP ${response.status})`);
    throw new Error(`AI 서버에서 빈 응답을 받았습니다. (HTTP ${response.status})`);
  }

  // 4. Content-Type 검사
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    console.error(
      'AI API returned non-JSON response\nstatus:',
      response.status,
      '\ncontent-type:',
      contentType,
      '\nendpoint:',
      endpoint,
      '\nresponse preview:',
      rawText.slice(0, 500)
    );
    throw new Error('AI 서버 응답 형식이 올바르지 않습니다.');
  }

  // 5. JSON 파싱 방어
  let data: AiApiResponse<T>;
  try {
    data = JSON.parse(rawText) as AiApiResponse<T>;
  } catch (parseErr) {
    console.error(
      'Invalid AI API JSON response:',
      response.status,
      contentType,
      rawText.slice(0, 500),
      parseErr
    );
    throw new Error('AI 서버 응답 형식이 올바르지 않습니다.');
  }

  // 6. 성공 여부 확인 및 콘솔 디버깅 로깅
  if (!response.ok || !data.success) {
    console.error(
      'AI API server error:',
      response.status,
      data.error,
      data.details
    );
    logger.error('aiApiHelper.callAiApi', `API 실패 응답 (${response.status}): ${data.error || '알 수 없는 오류'}`);

    throw new Error(
      data.error || `요청 처리에 실패했습니다. (HTTP ${response.status})`
    );
  }

  logger.info('aiApiHelper.callAiApi', `AI API 호출 성공: ${endpoint}`);
  return data;
}
