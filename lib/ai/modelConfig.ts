/**
 * @file lib/ai/modelConfig.ts
 * @description Gemini AI 모델 설정 및 다단계 Fallback 체인 중앙 집중 관리 모듈.
 * 모델명, 우선순위 체인, 쿼터(429/RESOURCE_EXHAUSTED) 감지, 미지원 모델(404) 감지 및
 * 사용자 친화적인 에러 포맷팅을 중앙에서 통합 관리합니다.
 */

/**
 * Gemini 모델 중앙 설정 객체
 */
export const AI_MODELS = {
  /** 기본 최우선 고성능 모델 */
  primary: 'gemini-3.7-flash',
  /**
   * 고속 Fallback 체인 후보 모델 목록
   * - gemini-2.5-flash: 고속 및 안정성 보장
   * - gemini-3.5-flash-lite: 최신 경량/고효율 대체 모델
   * (주의: 폐기된 gemini-2.5-flash-lite는 404 NOT_FOUND를 반환하므로 완전히 제거됨)
   */
  fallback: ['gemini-2.5-flash', 'gemini-3.5-flash-lite'] as const,
};

/**
 * 개별 모델 실행 실패 기록 인터페이스
 */
export interface ModelFailureRecord {
  model: string;
  code?: number | string;
  message: string;
  isQuota: boolean;
  isNotFound: boolean;
  retryDelay?: string;
  timestamp: number;
}

/**
 * 에러 객체 또는 메시지에서 429 / RESOURCE_EXHAUSTED / Quota 초과 여부를 감지합니다.
 * @param error 발생한 에러 객체 또는 문자열
 * @returns 쿼터 초과 여부 (boolean)
 */
export function isQuotaError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('429') ||
    message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('quota') ||
    message.includes('Quota exceeded') ||
    message.includes('rate-limits') ||
    message.includes('rate limit')
  );
}

/**
 * 에러 객체 또는 메시지에서 404 / NOT_FOUND / 모델 사용 불가 여부를 감지합니다.
 * @param error 발생한 에러 객체 또는 문자열
 * @returns 모델 미지원 여부 (boolean)
 */
export function isModelNotFoundError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('404') ||
    message.includes('NOT_FOUND') ||
    message.includes('is not found') ||
    message.includes('no longer available') ||
    message.includes('not supported')
  );
}

/**
 * Gemini 429/Quota 에러 메시지에서 권장 재시도 대기시간(retryDelay)을 파싱합니다.
 * (예: "retryDelay: 55s", "Please retry after 60s" 등)
 * @param error 에러 객체 또는 문자열
 * @returns 안내용 대기시간 문자열 (예: "약 1분", "약 55초") 또는 undefined
 */
export function parseRetryDelay(error: unknown): string | undefined {
  if (!error) return undefined;
  const msg = error instanceof Error ? error.message : String(error);

  // 1. "retryDelay: 55s" 또는 "retryDelay: 55.2s" 패턴
  const matchSec = msg.match(/retryDelay[:=]\s*(\d+(?:\.\d+)?)\s*s/i) ||
    msg.match(/retry after\s*(\d+)\s*(?:seconds|s)/i);

  if (matchSec && matchSec[1]) {
    const seconds = Math.round(parseFloat(matchSec[1]));
    if (seconds > 0) {
      if (seconds >= 60) {
        const mins = Math.ceil(seconds / 60);
        return `약 ${mins}분`;
      }
      return `약 ${seconds}초`;
    }
  }

  // 2. "retryDelay: 2m" 분 단위 패턴
  const matchMin = msg.match(/retryDelay[:=]\s*(\d+)\s*m/i) ||
    msg.match(/retry after\s*(\d+)\s*minutes?/i);
  if (matchMin && matchMin[1]) {
    const mins = parseInt(matchMin[1], 10);
    return `약 ${mins}분`;
  }

  return undefined;
}

/**
 * 모델 체인 전체 실패 기록을 분석하여 사용자에게 가장 정확하고 친절한 에러 메시지를 생성합니다.
 * 핵심 원칙: Fallback 모델 중 하나라도 429/Quota 초과가 있었다면, 이후 모델의 404 등에 가려지지 않고 Quota 메시지를 최우선 표출합니다.
 * @param failures 모델별 실패 기록 배열
 * @param defaultMessage 기본 fallback 에러 메시지
 * @returns 정제된 사용자 에러 안내 객체
 */
export function formatModelChainError(
  failures: ModelFailureRecord[],
  defaultMessage: string
): { error: string; details?: string; errorCode: string } {
  // 1. Quota 초과 이력이 하나라도 있는지 검사
  const quotaFailure = failures.find((f) => f.isQuota);
  if (quotaFailure) {
    const delayInfo = quotaFailure.retryDelay ? `${quotaFailure.retryDelay} 후 다시 시도하시거나, ` : '잠시 후 다시 시도하시거나, ';
    return {
      error: `AI 서비스 일일 이용량(할당량)이 일시적으로 초과되었습니다. ${delayInfo}레시피 텍스트를 복사하여 "텍스트 가져오기" 또는 직접 등록을 이용해주세요.`,
      details: failures.map((f) => `[${f.model}] ${f.message}`).join(' | '),
      errorCode: 'AI_QUOTA_EXHAUSTED',
    };
  }

  // 2. 인증/API 키 오류 검사
  const authFailure = failures.find((f) => f.message.includes('API_KEY') || f.message.includes('401') || f.message.includes('403'));
  if (authFailure) {
    return {
      error: 'AI 서버 인증에 실패했습니다. 관리자에게 문의해주세요.',
      details: authFailure.message,
      errorCode: 'AI_AUTH_ERROR',
    };
  }

  // 3. 서버 과부하 / 503 오류 검사
  const overloadFailure = failures.find((f) => f.message.includes('503') || f.message.includes('UNAVAILABLE') || f.message.includes('overloaded'));
  if (overloadFailure) {
    return {
      error: '현재 AI 서버 이용량이 많아 일시적으로 지연되었습니다. 잠시 후 다시 시도해주세요.',
      details: failures.map((f) => `[${f.model}] ${f.message}`).join(' | '),
      errorCode: 'AI_SERVER_OVERLOAD',
    };
  }

  // 4. 일반 실패
  return {
    error: defaultMessage,
    details: failures.map((f) => `[${f.model}] ${f.message}`).join(' | '),
    errorCode: 'AI_ALL_MODELS_FAILED',
  };
}
