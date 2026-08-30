/**
 * @file tests/unit/imageStorage.test.ts
 * @description 이미지 스토리지 Base64 감지 및 Blob 변환 단위 테스트
 */

import { describe, it, expect } from 'vitest';
import { isBase64Image, base64ToBlob } from '../../src/services/imageStorage';

describe('Image Storage Service Unit Tests', () => {
  it('isBase64Image가 Base64 데이터 URL을 올바르게 감지해야 함', () => {
    expect(isBase64Image('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...')).toBe(true);
    expect(isBase64Image('data:image/png;base64,iVBORw0KGgoAAA...')).toBe(true);
    expect(isBase64Image('https://images.unsplash.com/photo-1546069901')).toBe(false);
    expect(isBase64Image('/assets/default-dish.jpg')).toBe(false);
    expect(isBase64Image('')).toBe(false);
    expect(isBase64Image(undefined)).toBe(false);
  });

  it('base64ToBlob이 Base64 문자열을 정상 Blob으로 변환해야 함', () => {
    // 1x1 transparent PNG Base64
    const validPngBase64 =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const { blob, mimeType } = base64ToBlob(validPngBase64);
    expect(mimeType).toBe('image/png');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('잘못된 Base64 포맷 입력 시 에러를 발생시켜야 함', () => {
    expect(() => base64ToBlob('invalid-string')).toThrow('유효하지 않은 Base64 이미지 포맷');
  });
});
