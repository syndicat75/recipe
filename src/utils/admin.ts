/**
 * @file src/utils/admin.ts
 * @description 레시피 관리자(Admin) 권한 판별 유틸리티
 * 환경변수 VITE_ADMIN_UID에 지정된 Firebase UID와 일치하는 사용자에게만 레시피 추가/수정/삭제/가져오기/복원 관리 권한을 부여합니다.
 */

import { logger } from './logger';

/**
 * 환경변수로부터 관리자 Firebase UID 조회
 */
export const ADMIN_UID: string = (import.meta.env.VITE_ADMIN_UID || '').trim();

/**
 * 주어진 사용자 UID가 관리자인지 여부를 판별합니다.
 * @param uid 검사할 Firebase 사용자 UID
 * @returns 관리자 여부 (boolean)
 */
export function isUserAdmin(uid?: string | null): boolean {
  if (!uid) return false;
  if (!ADMIN_UID) {
    // VITE_ADMIN_UID가 미설정된 경우 안전을 위해 관리자 권한을 비활성화하고 경고 로그 출력
    logger.warn(
      'admin.isUserAdmin',
      'VITE_ADMIN_UID 환경변수가 설정되지 않았습니다. 관리자 기능이 비활성화됩니다.'
    );
    return false;
  }
  const isMatch = uid === ADMIN_UID;
  logger.info('admin.isUserAdmin', `UID [${uid}] 관리자 권한 검사: ${isMatch ? '관리자 승인' : '일반 방문자'}`);
  return isMatch;
}
