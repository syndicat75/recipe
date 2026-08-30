/**
 * @file tests/unit/koreanDurationParser.test.ts
 * @description 한국어 자연어 조리 시간 파서 단위 테스트
 */

import { describe, it, expect } from 'vitest';
import { parseKoreanDuration, formatSecondsToKoreanSpeech } from '../../src/utils/koreanDurationParser';

describe('Korean Duration Parser Unit Tests', () => {
  it('"5분 타이머"를 300초로 정확히 파싱해야 함', () => {
    const res = parseKoreanDuration('5분 타이머');
    expect(res).not.toBeNull();
    expect(res?.seconds).toBe(300);
    expect(res?.displayLabel).toBe('5분');
  });

  it('"30초 타이머"를 30초로 정확히 파싱해야 함', () => {
    const res = parseKoreanDuration('30초 타이머');
    expect(res).not.toBeNull();
    expect(res?.seconds).toBe(30);
    expect(res?.displayLabel).toBe('30초');
  });

  it('"1분 30초 타이머"를 90초로 정확히 파싱해야 함', () => {
    const res = parseKoreanDuration('1분 30초 타이머');
    expect(res).not.toBeNull();
    expect(res?.seconds).toBe(90);
    expect(res?.displayLabel).toBe('1분 30초');
  });

  it('"계란 7분 타이머"에서 라벨 "계란"과 420초를 추출해야 함', () => {
    const res = parseKoreanDuration('계란 7분 타이머');
    expect(res).not.toBeNull();
    expect(res?.seconds).toBe(420);
    expect(res?.label).toBe('계란');
    expect(res?.displayLabel).toBe('7분');
  });

  it('"1시간 10분"을 4200초로 정확히 파싱해야 함', () => {
    const res = parseKoreanDuration('1시간 10분 타이머 시작');
    expect(res).not.toBeNull();
    expect(res?.seconds).toBe(4200);
    expect(res?.displayLabel).toBe('1시간 10분');
  });

  it('"라면 3분 반"을 210초 및 라벨 "라면"으로 파싱해야 함', () => {
    const res = parseKoreanDuration('라면 3분 반');
    expect(res).not.toBeNull();
    expect(res?.seconds).toBe(210);
    expect(res?.label).toBe('라면');
  });

  it('비정상적이거나 유효하지 않은 텍스트에 대해 null을 반환해야 함', () => {
    expect(parseKoreanDuration('')).toBeNull();
    expect(parseKoreanDuration('양파 얼마나 필요해')).toBeNull();
    expect(parseKoreanDuration('0분 타이머')).toBeNull();
  });

  it('formatSecondsToKoreanSpeech가 초를 자연스러운 한국어로 변환해야 함', () => {
    expect(formatSecondsToKoreanSpeech(200)).toBe('3분 20초');
    expect(formatSecondsToKoreanSpeech(3600)).toBe('1시간');
    expect(formatSecondsToKoreanSpeech(3665)).toBe('1시간 1분 5초');
    expect(formatSecondsToKoreanSpeech(45)).toBe('45초');
  });
});
