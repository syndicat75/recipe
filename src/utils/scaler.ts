/**
 * @file src/utils/scaler.ts
 * @description 재료 텍스트 파싱 및 인분 수(배율)에 따른 수량 자동 계산 스케일러 유틸리티
 */

import { logger } from './logger';

/**
 * 분수 문자열을 숫자로 변환합니다 (예: "1/2" -> 0.5, "1/3" -> 0.333, "1/4" -> 0.25)
 * @param fracStr 분수 문자열
 * @returns 변환된 실수 값
 */
function parseFraction(fracStr: string): number | null {
  logger.debug('scaler.parseFraction', `분수 변환 시작: ${fracStr}`);
  const match = fracStr.match(/^(\d+)\/(\d+)$/);
  if (match) {
    const num = parseFloat(match[1]);
    const den = parseFloat(match[2]);
    if (den !== 0) {
      const result = num / den;
      logger.debug('scaler.parseFraction', `변환 성공: ${fracStr} -> ${result}`);
      return result;
    }
  }
  return null;
}

/**
 * 숫자를 깔끔한 분수 또는 소수점 문자열로 포맷팅합니다.
 * @param value 숫자 값
 * @returns 가독성 높은 수량 문자열 (예: "0.5" -> "1/2" 또는 "0.5")
 */
function formatNumberNicely(value: number): string {
  logger.debug('scaler.formatNumberNicely', `숫자 포맷팅: ${value}`);
  if (Math.abs(value - 0.5) < 0.01) return '1/2';
  if (Math.abs(value - 0.25) < 0.01) return '1/4';
  if (Math.abs(value - 0.75) < 0.01) return '3/4';
  if (Math.abs(value - 0.33) < 0.02) return '1/3';
  if (Math.abs(value - 0.66) < 0.02) return '2/3';
  if (Math.abs(value - 1.5) < 0.01) return '1.5';
  if (Math.abs(value - 2.5) < 0.01) return '2.5';
  
  // 정수인 경우
  if (Number.isInteger(value)) {
    return value.toString();
  }
  
  // 소수점 1자리 혹은 2자리
  return parseFloat(value.toFixed(2)).toString();
}

/**
 * 단일 재료 라인에 대해 배율(multiplier)을 적용하여 변경된 텍스트를 반환합니다.
 * @param line 원본 재료 문자열 (예: "된장 2큰술", "물 150ml", "두부 1/2모")
 * @param multiplier 인분 배율 (예: 0.5, 1, 2, 3)
 * @returns 수량이 조정된 재료 문자열
 */
export function scaleIngredientLine(line: string, multiplier: number): string {
  logger.info('scaler.scaleIngredientLine', `재료 스케일링: "${line}" (x${multiplier})`);
  if (multiplier === 1 || !line) {
    return line;
  }

  // 1. "1~2큰술", "0.3~0.5큰술", "120~150g" 같은 범위 패턴
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

  // 2. "1/2", "1/3", "1/4" 같은 단독 분수 패턴 (예: "두부 1/2모")
  const fractionMatch = line.match(/(^|\s)(\d+\/\d+)(\s*[\uAC00-\uD7A3a-zA-Z]|$)/);
  if (fractionMatch) {
    const fracVal = parseFraction(fractionMatch[2]);
    if (fracVal !== null) {
      const scaled = formatNumberNicely(fracVal * multiplier);
      return line.replace(fractionMatch[2], scaled);
    }
  }

  // 3. 일반 숫자 패턴 (예: "된장 2큰술", "물 150ml", "스팸 65g")
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
