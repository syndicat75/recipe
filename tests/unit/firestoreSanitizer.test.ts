/**
 * @file tests/unit/firestoreSanitizer.test.ts
 * @description Firestore undefined 필드 재귀적 제거 및 에러 포맷팅 유틸리티 단위 테스트
 */

import { describe, it, expect } from 'vitest';
import { removeUndefinedDeep, formatFirestoreError } from '../../src/utils/firestoreSanitizer';

describe('Firestore Sanitizer Unit Tests', () => {
  it('removeUndefinedDeep이 최상위 및 중첩 객체의 undefined 필드를 완벽히 제거해야 함', () => {
    const rawData = {
      name: '된장찌개',
      calories: undefined,
      tags: ['한식', undefined, '국물'],
      author: {
        id: 'user-123',
        avatar: undefined,
        profile: {
          bio: undefined,
          verified: true,
        },
      },
    };

    const sanitized = removeUndefinedDeep(rawData) as any;

    expect(sanitized.name).toBe('된장찌개');
    expect('calories' in sanitized).toBe(false);
    expect(sanitized.tags).toEqual(['한식', '국물']);
    expect(sanitized.author.id).toBe('user-123');
    expect('avatar' in sanitized.author).toBe(false);
    expect('bio' in sanitized.author.profile).toBe(false);
    expect(sanitized.author.profile.verified).toBe(true);
  });

  it('formatFirestoreError가 사용자 친화적인 한국어 메시지를 반환해야 함', () => {
    const permErr = { code: 'permission-denied', message: 'Missing or insufficient permissions.' };
    expect(formatFirestoreError(permErr)).toContain('권한');

    const unauthErr = { code: 'unauthenticated', message: 'User not logged in' };
    expect(formatFirestoreError(unauthErr)).toContain('로그인');

    const networkErr = { code: 'unavailable', message: 'Failed to get document because client is offline' };
    expect(formatFirestoreError(networkErr)).toContain('네트워크');
  });
});
