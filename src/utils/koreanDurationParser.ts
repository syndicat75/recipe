/**
 * @file src/utils/koreanDurationParser.ts
 * @description 한국어 자연어 문장에서 조리 시간 및 타이머 초(seconds)와 라벨(label)을 정밀 파싱하는 유틸리티.
 * "5분", "10분", "30초", "1분 30초", "1시간", "1시간 10분", "계란 7분", "라면 3분 30초" 등의 표현을 지원하며,
 * 비정상적인 값(0초, 음수, 24시간 초과)을 안전하게 배제합니다.
 */

import { logger } from './logger';

export interface ParsedDurationResult {
  /** 총 시간(초 단위) */
  seconds: number;
  /** 타이머 라벨/명칭 (예: "계란", "라면", "파스타" 등, 없으면 기본값 생성에 활용) */
  label?: string;
  /** 파싱 성공 여부 */
  isValid: boolean;
  /** 정규화된 읽기용 문자열 (예: "5분", "1분 30초", "1시간 10분") */
  displayLabel: string;
}

/**
 * 한국어 한글 숫자 단어를 아라비아 숫자로 매핑하기 위한 사전
 */
const KOREAN_NUMBER_MAP: Record<string, number> = {
  '반': 0.5,
  '반분': 0.5,
  '일': 1,
  '한': 1,
  '하나': 1,
  '이': 2,
  '두': 2,
  '둘': 2,
  '삼': 3,
  '세': 3,
  '셋': 3,
  '사': 4,
  '네': 4,
  '넷': 4,
  '오': 5,
  '다섯': 5,
  '육': 6,
  '여섯': 6,
  '칠': 7,
  '일곱': 7,
  '팔': 8,
  '여덟': 8,
  '구': 9,
  '아홉': 9,
  '십': 10,
  '열': 10,
  '십오': 15,
  '열다섯': 15,
  '이십': 20,
  '스물': 20,
  '삼십': 30,
  '서른': 30,
  '사십': 40,
  '마흔': 40,
  '오십': 50,
  '쉰': 50,
};

/**
 * 숫자 또는 한국어 수사 문자열을 정수 숫자로 변환합니다.
 * @param str 숫자 또는 한글 숫자 문자열 (예: "5", "오", "반", "10")
 * @returns 변환된 숫자, 매칭 실패 시 null
 */
export function parseKoreanNumber(str: string): number | null {
  logger.debug('koreanDurationParser.parseKoreanNumber', `수사 파싱: "${str}"`);
  if (!str) return null;
  const trimmed = str.trim();

  // 1. 아라비아 숫자 형태
  const num = Number(trimmed);
  if (!isNaN(num)) {
    return num;
  }

  // 2. 한글 수사 맵핑
  if (KOREAN_NUMBER_MAP[trimmed] !== undefined) {
    return KOREAN_NUMBER_MAP[trimmed];
  }

  // 3. 복합 한글 수사 처리 (예: "스물다섯" -> 25, "이십오" -> 25, "삼십오" -> 35)
  if (trimmed.startsWith('이십') && trimmed.length > 2) {
    const single = KOREAN_NUMBER_MAP[trimmed.substring(2)];
    if (single !== undefined) return 20 + single;
  }
  if (trimmed.startsWith('삼십') && trimmed.length > 2) {
    const single = KOREAN_NUMBER_MAP[trimmed.substring(2)];
    if (single !== undefined) return 30 + single;
  }
  if (trimmed.startsWith('사십') && trimmed.length > 2) {
    const single = KOREAN_NUMBER_MAP[trimmed.substring(2)];
    if (single !== undefined) return 40 + single;
  }
  if (trimmed.startsWith('오십') && trimmed.length > 2) {
    const single = KOREAN_NUMBER_MAP[trimmed.substring(2)];
    if (single !== undefined) return 50 + single;
  }
  if (trimmed.startsWith('십') && trimmed.length > 1) {
    const single = KOREAN_NUMBER_MAP[trimmed.substring(1)];
    if (single !== undefined) return 10 + single;
  }

  return null;
}

/**
 * 한국어 자연어 문장에서 시간(시/분/초)을 추출하여 총 초 및 라벨을 반환합니다.
 *
 * 지원 예시:
 * - "5분 타이머" -> 300초
 * - "30초 타이머" -> 30초
 * - "1분 30초 타이머 시작" -> 90초
 * - "1시간 10분 타이머" -> 4200초
 * - "계란 7분 타이머" -> label: "계란", 420초
 * - "라면 3분 반" -> label: "라면", 210초
 *
 * @param text 사용자의 발화 텍스트
 * @returns 파싱 결과 객체 또는 유효하지 않은 경우 null
 */
export function parseKoreanDuration(text: string): ParsedDurationResult | null {
  logger.info('koreanDurationParser.parseKoreanDuration', `시간 파싱 시작: "${text}"`);
  if (!text || typeof text !== 'string') return null;

  const normalized = text.trim();

  // "타이머", "시작", "맞춰줘", "해줘", "설정" 등 불필요한 서술어 분리 전 복사
  let workingText = normalized;

  // 1. 라벨 추출 (타이머 앞부분에 붙은 요리명/재료명)
  // 예: "계란 7분 타이머", "된장찌개 15분", "라면 3분 30초"
  let extractedLabel: string | undefined = undefined;

  const timerWordIdx = workingText.search(/\d+|[일이삼사오육칠팔구십한두세네다섯여섯일곱여덟아홉열스물서른마흔쉰]+/);
  if (timerWordIdx > 0) {
    const candidateLabel = workingText.substring(0, timerWordIdx).trim();
    // 의미 없는 수식어 제외
    const cleanedLabel = candidateLabel
      .replace(/^(지금|이번|여기|조리|단계|요리|타이머|새로운|새|추가)\s*/g, '')
      .replace(/(타이머|알람|시간)$/g, '')
      .trim();
    if (cleanedLabel.length > 0 && cleanedLabel.length <= 15) {
      extractedLabel = cleanedLabel;
    }
  }

  let totalSeconds = 0;
  let matchedAny = false;

  // 2. 시간 (Hour) 매칭
  // e.g. "1시간", "2시간", "한시간", "두시간", "1.5시간"
  const hourRegex = /(\d+(?:\.\d+)?|[일이삼사오육칠팔구십한두세네다섯]+)\s*시간/;
  const hourMatch = workingText.match(hourRegex);
  if (hourMatch) {
    const val = parseKoreanNumber(hourMatch[1]);
    if (val !== null && val > 0) {
      totalSeconds += Math.round(val * 3600);
      matchedAny = true;
      workingText = workingText.replace(hourMatch[0], ' ');
    }
  }

  // 3. 분 (Minute) 매칭
  // e.g. "5분", "10분", "3분 30초", "3분 반", "삼분", "오분"
  const minRegex = /(\d+(?:\.\d+)?|[일이삼사오육칠팔구십한두세네다섯여섯일곱여덟아홉열스물서른마흔쉰]+)\s*분(?:\s*(반))?/;
  const minMatch = workingText.match(minRegex);
  if (minMatch) {
    const val = parseKoreanNumber(minMatch[1]);
    if (val !== null && val > 0) {
      let minSec = val * 60;
      if (minMatch[2] === '반') {
        minSec += 30;
      }
      totalSeconds += Math.round(minSec);
      matchedAny = true;
      workingText = workingText.replace(minMatch[0], ' ');
    }
  }

  // 4. 초 (Second) 매칭
  // e.g. "30초", "45초", "십초", "삼십초"
  const secRegex = /(\d+|[일이삼사오육칠팔구십한두세네다섯여섯일곱여덟아홉열스물서른마흔쉰]+)\s*초/;
  const secMatch = workingText.match(secRegex);
  if (secMatch) {
    const val = parseKoreanNumber(secMatch[1]);
    if (val !== null && val > 0) {
      totalSeconds += Math.round(val);
      matchedAny = true;
      workingText = workingText.replace(secMatch[0], ' ');
    }
  }

  if (!matchedAny || totalSeconds <= 0) {
    logger.debug('koreanDurationParser.parseKoreanDuration', `시간 매칭 실패: "${text}"`);
    return null;
  }

  // 비정상적인 범위 검사: 0초 이하이거나 24시간(86,400초) 초과 시 무효 처리
  const MAX_SECONDS = 86400; // 24 hours
  if (totalSeconds > MAX_SECONDS) {
    logger.warn('koreanDurationParser.parseKoreanDuration', `과도하게 긴 시간 초과 (${totalSeconds}초 > 24시간)`);
    return null;
  }

  // 정규화된 한국어 읽기 라벨 포맷팅
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  const parts: string[] = [];
  if (h > 0) parts.push(`${h}시간`);
  if (m > 0) parts.push(`${m}분`);
  if (s > 0) parts.push(`${s}초`);
  const displayLabel = parts.join(' ') || `${totalSeconds}초`;

  const result: ParsedDurationResult = {
    seconds: totalSeconds,
    ...(extractedLabel ? { label: extractedLabel } : {}),
    isValid: true,
    displayLabel,
  };

  logger.info('koreanDurationParser.parseKoreanDuration', `시간 파싱 성공: ${totalSeconds}초 (${displayLabel})`, result);
  return result;
}

/**
 * 초 단위 숫자를 한국어 음성 출력에 적합한 자연스러운 텍스트로 변환합니다.
 * @param seconds 초 수
 * @returns "3분 20초", "50초", "1시간 5분" 등
 */
export function formatSecondsToKoreanSpeech(seconds: number): string {
  logger.debug('koreanDurationParser.formatSecondsToKoreanSpeech', `초 음성 텍스트 변환: ${seconds}초`);
  if (seconds <= 0) return '0초';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const speechParts: string[] = [];
  if (h > 0) speechParts.push(`${h}시간`);
  if (m > 0) speechParts.push(`${m}분`);
  if (s > 0) speechParts.push(`${s}초`);

  return speechParts.join(' ') || '0초';
}
