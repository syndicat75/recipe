/**
 * @file src/utils/firestoreSanitizer.ts
 * @description Cloud Firestore 쓰기 작업 시 'Unsupported field value: undefined' 오류를 방지하기 위해
 * 객체 내 모든 깊이(deep)의 undefined 필드를 재귀적으로 안전하게 정제(sanitize)하고,
 * Firestore 에러를 사용자 친화적인 한국어 안내 메시지로 변환하는 공통 유틸리티
 */

import { logger } from './logger';

/**
 * 객체 및 배열 내의 모든 undefined 필드를 재귀적으로 안전하게 제거합니다.
 * Firestore setDoc / updateDoc / batch.set 시 undefined 필드로 인한 런타임 오류를 차단합니다.
 *
 * - 배열: 내부 요소를 재귀 정제 후 undefined 요소 필터링
 * - 객체: 값이 undefined인 키를 제외한 정제된 새 객체 생성
 * - 기본형 / null / Date 등: 원본 값 그대로 반환
 *
 * @template T
 * @param value 정제할 대상 값 (객체, 배열, 원시값 등)
 * @returns undefined가 재귀적으로 제거된 안전한 값
 */
export function removeUndefinedDeep<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => removeUndefinedDeep(item))
      .filter((item) => item !== undefined) as unknown as T;
  }

  // Date 객체는 그대로 보존
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};

    Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
      if (val === undefined) {
        return;
      }

      const cleaned = removeUndefinedDeep(val);
      if (cleaned !== undefined) {
        result[key] = cleaned;
      }
    });

    return result as T;
  }

  return value;
}

/**
 * Firestore 작업 중 발생한 에러를 분석하여 사용자 친화적인 한국어 안내 메시지로 변환합니다.
 * Firestore 내부 기술 에러(예: raw stack trace 등)를 숨기고 상황별 명확한 조치 안내를 제공합니다.
 *
 * @param err 발생한 원본 에러 객체
 * @param defaultMessage 기본 대체 안내 메시지
 * @returns 사용자에게 노출할 안전하고 친절한 한국어 안내 메시지
 */
export function formatFirestoreError(
  err: unknown,
  defaultMessage: string = '레시피 저장 중 오류가 발생했습니다.'
): string {
  logger.debug('firestoreSanitizer.formatFirestoreError', 'Firestore 에러 메시지 분석 시작', { err });

  if (!err) {
    return defaultMessage;
  }

  const errorObj = err as { code?: string; message?: string };
  const code = (errorObj.code || '').toLowerCase();
  const message = (errorObj.message || '').toLowerCase();

  // 1. 권한 오류 (permission-denied)
  if (
    code.includes('permission-denied') ||
    code.includes('permission_denied') ||
    message.includes('missing or insufficient permissions') ||
    message.includes('permission-denied') ||
    message.includes('permission_denied')
  ) {
    return '저장 권한이 없습니다.';
  }

  // 2. 네트워크 또는 연결 오류 (unavailable)
  if (
    code.includes('unavailable') ||
    code.includes('network') ||
    message.includes('unavailable') ||
    message.includes('network') ||
    message.includes('offline') ||
    message.includes('failed to get document')
  ) {
    return '네트워크 또는 Firestore 연결 문제입니다.';
  }

  // 3. 잘못된 인자 또는 데이터 형식 오류 (invalid-argument)
  if (
    code.includes('invalid-argument') ||
    code.includes('invalid_argument') ||
    message.includes('invalid-argument') ||
    message.includes('invalid data') ||
    message.includes('unsupported field value')
  ) {
    return '레시피 데이터 형식에 문제가 있습니다.';
  }

  // 4. 인증 필요 (unauthenticated)
  if (
    code.includes('unauthenticated') ||
    code.includes('auth/') ||
    message.includes('unauthenticated') ||
    message.includes('로그인')
  ) {
    return '로그인이 필요합니다.';
  }

  return defaultMessage;
}
