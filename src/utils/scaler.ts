/**
 * @file src/utils/scaler.ts
 * @description 재료 텍스트 파싱 및 인분 수(배율)에 따른 수량 자동 계산 스케일러 유틸리티
 * 원본 레시피를 보존하며 분수, 소수점, 단위 기반의 정확한 배율 계산과 비수량 표현 예외를 안전하게 처리합니다.
 */

import { logger } from './logger';

/**
 * 변환 대상에서 제외해야 하는 모호한 수량 및 텍스트 표현 목록
 */
const UNQUANTIFIED_EXCLUSIONS = [
  '약간',
  '적당량',
  '한 줌',
  '두 줌',
  '취향껏',
  '조금',
  '반드시 간을 보고',
  '필요시',
  '기호에 따라',
  '선택',
];

/**
 * 분수 문자열을 숫자로 변환합니다 (예: "1/2" -> 0.5, "1/3" -> 0.333, "1/4" -> 0.25, "1 1/2" -> 1.5)
 * @param fracStr 분수 문자열
 * @returns 변환된 실수 값
 */
function parseFraction(fracStr: string): number | null {
  logger.debug('scaler.parseFraction', `분수 변환 시작: ${fracStr}`);
  const trimmed = fracStr.trim();

  // 대분수 형태 (예: "1 1/2", "2 1/3")
  const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseFloat(mixedMatch[1]);
    const num = parseFloat(mixedMatch[2]);
    const den = parseFloat(mixedMatch[3]);
    if (den !== 0) {
      const result = whole + num / den;
      logger.debug('scaler.parseFraction', `대분수 변환 성공: ${fracStr} -> ${result}`);
      return result;
    }
  }

  // 진분수/가분수 형태 (예: "1/2", "1/3")
  const match = trimmed.match(/^(\d+)\/(\d+)$/);
  if (match) {
    const num = parseFloat(match[1]);
    const den = parseFloat(match[2]);
    if (den !== 0) {
      const result = num / den;
      logger.debug('scaler.parseFraction', `분수 변환 성공: ${fracStr} -> ${result}`);
      return result;
    }
  }
  return null;
}

/**
 * 숫자를 깔끔한 분수 또는 소수점 문자열로 포맷팅합니다.
 * @param value 숫자 값
 * @returns 가독성 높은 수량 문자열 (예: 0.5 -> "1/2", 1.5 -> "1.5" 또는 "1 1/2")
 */
/**
 * 숫자를 깔끔한 분수 또는 소수점 문자열로 포맷팅합니다.
 * @param value 숫자 값
 * @returns 가독성 높은 수량 문자열 (예: 0.5 -> "1/2", 1.5 -> "1.5" 또는 "1 1/2")
 */
export function formatQuantityNumber(value: number): string {
  return formatNumberNicely(value);
}

/**
 * 단일 수량에 배율을 적용하여 포맷팅된 문자열을 반환합니다.
 * @param quantity 원본 수량
 * @param multiplier 인분 배율
 * @returns 스케일링된 수량 문자열
 */
export function scaleSingleQuantity(quantity: number, multiplier: number): string {
  if (isNaN(quantity)) return '0';
  return formatNumberNicely(quantity * multiplier);
}

function formatNumberNicely(value: number): string {
  logger.debug('scaler.formatNumberNicely', `숫자 포맷팅: ${value}`);
  if (Math.abs(value - 0.5) < 0.01) return '1/2';
  if (Math.abs(value - 0.25) < 0.01) return '1/4';
  if (Math.abs(value - 0.75) < 0.01) return '3/4';
  if (Math.abs(value - 0.33) < 0.02) return '1/3';
  if (Math.abs(value - 0.66) < 0.02) return '2/3';
  if (Math.abs(value - 1.5) < 0.01) return '1.5';
  if (Math.abs(value - 2.5) < 0.01) return '2.5';
  if (Math.abs(value - 1.33) < 0.02) return '1 1/3';
  if (Math.abs(value - 1.25) < 0.01) return '1 1/4';

  // 정수인 경우
  if (Number.isInteger(value)) {
    return value.toString();
  }

  // 소수점 1자리 혹은 2자리
  return parseFloat(value.toFixed(2)).toString();
}

/**
 * 단일 재료 라인에 대해 배율(multiplier)을 적용하여 변경된 텍스트를 반환합니다.
 * @param line 원본 재료 문자열 (예: "된장 2큰술", "물 150ml", "두부 1/2모", "소금 약간")
 * @param multiplier 인분 배율 (예: 0.5, 1, 1.5, 2, 4)
 * @returns 수량이 조정된 재료 문자열
 */
export function scaleIngredientLine(line: string, multiplier: number): string {
  logger.info('scaler.scaleIngredientLine', `재료 스케일링: "${line}" (x${multiplier})`);
  if (multiplier === 1 || !line || typeof line !== 'string') {
    return line;
  }

  // 예외 표현이 포함되어 있고 명확한 수량이 없는 경우 원본 유지
  const hasExclusion = UNQUANTIFIED_EXCLUSIONS.some((term) => line.includes(term));
  const hasDigits = /\d/.test(line);
  if (hasExclusion && !hasDigits) {
    logger.debug('scaler.scaleIngredientLine', `비수량 표현 감지 -> 원본 보존: "${line}"`);
    return line;
  }

  // 1. 대분수 패턴 (예: "1 1/2큰술", "2 1/2개")
  const mixedMatch = line.match(/(\d+\s+\d+\/\d+)(\s*[\uAC00-\uD7A3a-zA-Z]|$)/);
  if (mixedMatch) {
    const mixedVal = parseFraction(mixedMatch[1]);
    if (mixedVal !== null) {
      const scaled = formatNumberNicely(mixedVal * multiplier);
      return line.replace(mixedMatch[1], scaled);
    }
  }

  // 2. "1~2큰술", "0.3~0.5큰술", "120~150g" 같은 범위 패턴
  const rangeMatch = line.match(/(\d+(?:\.\d+)?|\d+\/\d+)\s*~\s*(\d+(?:\.\d+)?|\d+\/\d+)/);
  if (rangeMatch) {
    const val1Str = rangeMatch[1];
    const val2Str = rangeMatch[2];
    const val1 = parseFraction(val1Str) ?? parseFloat(val1Str);
    const val2 = parseFraction(val2Str) ?? parseFloat(val2Str);
    if (!isNaN(val1) && !isNaN(val2)) {
      const scaled1 = formatNumberNicely(val1 * multiplier);
      const scaled2 = formatNumberNicely(val2 * multiplier);
      return line.replace(rangeMatch[0], `${scaled1}~${scaled2}`);
    }
  }

  // 3. "1/2", "1/3", "1/4" 같은 단독 분수 패턴 (예: "두부 1/2모")
  const fractionMatch = line.match(/(^|\s)(\d+\/\d+)(\s*[\uAC00-\uD7A3a-zA-Z]|$)/);
  if (fractionMatch) {
    const fracVal = parseFraction(fractionMatch[2]);
    if (fracVal !== null) {
      const scaled = formatNumberNicely(fracVal * multiplier);
      return line.replace(fractionMatch[2], scaled);
    }
  }

  // 4. 일반 숫자 패턴 (예: "돼지고기 150g", "물 200ml", "된장 2큰술", "계란 1개")
  const numberMatch = line.match(/(^|\s)(\d+(?:\.\d+)?)(\s*[\uAC00-\uD7A3a-zA-Z]|$)/);
  if (numberMatch) {
    const originalNum = parseFloat(numberMatch[2]);
    if (!isNaN(originalNum)) {
      const scaled = formatNumberNicely(originalNum * multiplier);
      return line.replace(numberMatch[2], scaled);
    }
  }

  return line;
}

/**
 * 전체 재료 텍스트를 줄바꿈 기준으로 분리하여 배율을 적용한 문자열 배열을 반환합니다.
 * @param ingredientsText 원본 전체 재료 텍스트
 * @param multiplier 인분 배율
 * @returns 스케일링된 각 재료 라인의 배열
 */
export function getScaledIngredientsList(ingredientsText: string, multiplier: number): string[] {
  logger.info('scaler.getScaledIngredientsList', `전체 재료 스케일링 리스트 요청 (x${multiplier})`);
  if (!ingredientsText) return [];
  return ingredientsText
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((line) => scaleIngredientLine(line, multiplier));
}

/**
 * 기준 인분 및 목표 인분을 받아 배율을 계산합니다.
 * @param baseServings 기준 인분 (기본 1)
 * @param targetServings 목표 인분 (기본 1)
 * @returns 배율 (예: 1인분 기준 2인분 선택 시 2.0)
 */
export function calculateServingsMultiplier(baseServings: number = 1, targetServings: number = 1): number {
  logger.debug('scaler.calculateServingsMultiplier', `인분 배율 계산: 기준 ${baseServings} -> 목표 ${targetServings}`);
  const validBase = Number(baseServings) >= 1 ? Number(baseServings) : 1;
  const validTarget = Number(targetServings) >= 1 ? Number(targetServings) : validBase;
  return validTarget / validBase;
}
