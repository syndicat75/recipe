/**
 * @file src/hooks/useClickOutside.ts
 * @description 지정한 DOM 요소 외부 클릭 감지 및 콜백 호출 훅.
 */

import { useEffect, RefObject } from 'react';

/**
 * 특정 엘리먼트 외부 클릭 감지 훅
 * @param ref 감지할 대상 DOM 요소의 React Ref
 * @param handler 외부 클릭 발생 시 실행할 콜백 함수
 * @param enabled 훅 활성화 여부 (기본값 true)
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  handler: (event: MouseEvent | TouchEvent) => void,
  enabled: boolean = true
): void {
  useEffect(() => {
    if (!enabled) return;

    const listener = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (!ref.current || ref.current.contains(target)) {
        return;
      }
      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler, enabled]);
}
