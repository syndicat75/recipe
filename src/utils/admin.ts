/**
 * @file src/utils/admin.ts
 * @description 레시피 관리자(Admin) 권한 판별 유틸리티
 * 환경변수 VITE_ADMIN_UID에 지정된 Firebase UID와 일치하는 사용자에게만 레시피 추가/수정/삭제/가져오기/복원 관리 권한을 부여합니다.
 */

import { logger } from './logger';

/**
 * 환경변수로부터 관리자 Firebase UID 및 이메일 조회
 */
export const ADMIN_UID: string = (import.meta.env.VITE_ADMIN_UID || '').trim();
export const ADMIN_EMAIL: string = (import.meta.env.VITE_ADMIN_EMAIL || 'syndicat@eugenes.co.kr').trim();

/**
 * 주어진 사용자 UID 및 이메일이 관리자인지 여부를 판별합니다.
 * @param uid 검사할 Firebase 사용자 UID
 * @param email 검사할 Firebase 사용자 이메일 (선택)
 * @returns 관리자 여부 (boolean)
 */
export function isUserAdmin(uid?: string | null, email?: string | null): boolean {
  if (!uid && !email) return false;

  const isUidMatch = Boolean(ADMIN_UID && uid && uid === ADMIN_UID);
  const isEmailMatch = Boolean(
    ADMIN_EMAIL &&
    email &&
    email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase()
  );

  const isMatch = isUidMatch || isEmailMatch;
  logger.info(
    'admin.isUserAdmin',
    `UID [${uid || 'N/A'}], Email [${email || 'N/A'}] 관리자 권한 검사: ${isMatch ? '관리자 승인' : '일반 사용자'}`
  );
  return isMatch;
}
