/**
 * @file src/utils/logger.ts
 * @description 애플리케이션의 모든 함수 호출 및 상태 변화를 추적하고 구조화된 콘솔 로그를 출력하는 유틸리티
 */

/**
 * 로그 레벨 타입
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/**
 * 로거 유틸리티 클래스
 */
class AppLogger {
  private isDevelopment = true;

  /**
   * 포맷팅된 시간 문자열을 반환합니다.
   * @returns 현재 시분초 문자열
   */
  private getTimestamp(): string {
    const now = new Date();
    return now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
  }

  /**
   * 디버그 레벨 로그를 출력합니다.
   * @param context 함수 또는 모듈명
   * @param message 상세 메시지
   * @param data 추가 데이터 객체 (선택)
   */
  public debug(context: string, message: string, data?: unknown): void {
    if (!this.isDevelopment) return;
    console.debug(
      `%c[${this.getTimestamp()}] [DEBUG] [${context}]`,
      'color: #8b5cf6; font-weight: bold;',
      message,
      data !== undefined ? data : ''
    );
  }

  /**
   * 정보 레벨 로그를 출력합니다.
   * @param context 함수 또는 모듈명
   * @param message 상세 메시지
   * @param data 추가 데이터 객체 (선택)
   */
  public info(context: string, message: string, data?: unknown): void {
    console.log(
      `%c[${this.getTimestamp()}] [INFO] [${context}]`,
      'color: #f97316; font-weight: bold;',
      message,
      data !== undefined ? data : ''
    );
  }

  /**
   * 경고 레벨 로그를 출력합니다.
   * @param context 함수 또는 모듈명
   * @param message 상세 메시지
   * @param data 추가 데이터 객체 (선택)
   */
  public warn(context: string, message: string, data?: unknown): void {
    console.warn(
      `%c[${this.getTimestamp()}] [WARN] [${context}]`,
      'color: #eab308; font-weight: bold;',
      message,
      data !== undefined ? data : ''
    );
  }

  /**
   * 에러 레벨 로그를 출력합니다.
   * @param context 함수 또는 모듈명
   * @param message 상세 메시지
   * @param error 에러 객체 또는 추가 데이터
   */
  public error(context: string, message: string, error?: unknown): void {
    console.error(
      `%c[${this.getTimestamp()}] [ERROR] [${context}]`,
      'color: #ef4444; font-weight: bold;',
      message,
      error !== undefined ? error : ''
    );
  }
}

/**
 * 전역 싱글톤 로거 인스턴스
 */
export const logger = new AppLogger();
