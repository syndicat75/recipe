/**
 * @file tests/setup.ts
 * @description Vitest 테스트 전역 설정 및 Jest DOM 매처 등록
 */

import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Window matchMedia Mock
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
