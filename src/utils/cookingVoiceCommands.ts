/**
 * @file src/utils/cookingVoiceCommands.ts
 * @description 주방 핸즈프리 음성 비서를 위한 클라이언트 로컬 자연어 음성 명령 파서.
 * 외부 LLM(Gemini) 호출 없이 100% 브라우저 로컬에서 즉각적(0ms 지연)으로 발화를 파싱하여
 * 주방 소음 및 네트워크 장애 환경에서도 빠르고 안전하게 동작합니다.
 */

import { parseKoreanDuration } from './koreanDurationParser';
import { logger } from './logger';

/**
 * 음성 명령 의도(Intent) 유니온 타입
 */
export type CookingVoiceIntent =
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'READ_STEP' }
  | { type: 'STEP_STATUS' }
  | { type: 'FIRST_STEP' }
  | { type: 'READ_INGREDIENTS' }
  | {
      type: 'QUERY_INGREDIENT';
      /** 질문 대상 정규화된 재료명 (예: "양파", "간장", "대파") */
      ingredient: string;
    }
  | {
      type: 'START_TIMER';
      /** 초 단위 설정 시간 */
      seconds: number;
      /** 타이머 라벨 (선택) */
      label?: string;
    }
  | { type: 'START_STEP_TIMER' }
  | { type: 'TIMER_STATUS' }
  | {
      type: 'PAUSE_TIMER';
      /** 특정 타이머 라벨 (선택) */
      targetLabel?: string;
    }
  | {
      type: 'RESUME_TIMER';
      /** 특정 타이머 라벨 (선택) */
      targetLabel?: string;
    }
  | {
      type: 'CANCEL_TIMER';
      /** 특정 타이머 라벨 (선택) */
      targetLabel?: string;
    }
  | { type: 'CANCEL_ALL_TIMERS' }
  | { type: 'LIST_TIMERS' }
  | { type: 'SHOW_INGREDIENTS' }
  | { type: 'HIDE_INGREDIENTS' }
  | { type: 'HELP' }
  | { type: 'STOP_LISTENING' }
  | { type: 'REQUEST_COMPLETE' }
  | { type: 'CONFIRM_COMPLETE' }
  | {
      type: 'UNKNOWN';
      /** 해석되지 않은 원본 발화 */
      raw: string;
    };

/**
 * 텍스트에서 특수문자, 문장부호 및 앞뒤 공백을 정규화합니다.
 * @param text 원본 텍스트
 * @returns 정규화된 문자열
 */
export function normalizeTranscript(text: string): string {
  logger.debug('cookingVoiceCommands.normalizeTranscript', `발화 정규화: "${text}"`);
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[.,?!~`@#$%^&*()_+\-=[\]{};':"\\|<>/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 특정 재료 질문 문장에서 조사와 수식어를 제거하고 순수 재료명을 추출합니다.
 * @param rawIngredient 추출된 재료 후보 문자열
 * @returns 정제된 재료명
 */
export function cleanIngredientName(rawIngredient: string): string {
  logger.debug('cookingVoiceCommands.cleanIngredientName', `재료명 정제 시작: "${rawIngredient}"`);
  if (!rawIngredient) return '';

  let cleaned = rawIngredient.trim();

  // 불필요한 앞머리 수식어 제거
  cleaned = cleaned.replace(/^(그리고|그럼|그다음|이번|지금|이|그|저|해당|필요한|들어가는)\s*/g, '');

  // 한국어 조사 제거 (은, 는, 이, 가, 을, 를, 의, 도, 에, 로, 랑, 하고 등)
  cleaned = cleaned.replace(/(은|는|이|가|을|를|의|도|에|로|으로|이랑|랑|하고)$/g, '');

  return cleaned.trim();
}

/**
 * 사용자 음성 인식 결과 텍스트를 파싱하여 해당하는 요리 의도(CookingVoiceIntent)를 반환합니다.
 *
 * @param transcript 음성인식(STT) 결과 원본 문자열
 * @returns 판별된 요리 음성 의도 객체
 */
export function parseCookingVoiceCommand(transcript: string): CookingVoiceIntent {
  logger.info('cookingVoiceCommands.parseCookingVoiceCommand', `음성명령 파싱 시도: "${transcript}"`);
  if (!transcript || typeof transcript !== 'string') {
    return { type: 'UNKNOWN', raw: '' };
  }

  const raw = transcript.trim();
  const text = normalizeTranscript(raw);

  if (!text) {
    return { type: 'UNKNOWN', raw };
  }

  // 1. 요리 완료 확인 응답 ("완료해", "완료할래", "응 완료해" 등)
  if (
    /^(완료해|완료할래|완료하자|완료|확인|응\s*완료해?|네\s*완료해?|진짜\s*완료|완료\s*진행)$/.test(text) ||
    text === '완료해' ||
    text === '완료할래'
  ) {
    return { type: 'CONFIRM_COMPLETE' };
  }

  // 2. 요리 완료 요청 ("요리 완료", "다 했어", "조리 끝" 등)
  if (
    /(요리\s*완료|조리\s*완료|다\s*했어|다했어|조리\s*끝|요리\s*끝|요리\s*종료|조리\s*종료|요리\s*다했어|음식\s*완성|요리\s*완성)/.test(
      text
    )
  ) {
    return { type: 'REQUEST_COMPLETE' };
  }

  // 3. 음성명령 종료 / 마이크 끄기 ("마이크 꺼", "듣기 그만", "음성명령 종료")
  if (
    /(음성\s*명령\s*종료|듣기\s*그만|마이크\s*꺼|마이크\s*꺼줘|음성\s*인식\s*종료|음성\s*인식\s*꺼|음성\s*종료|듣기\s*중지|마이크\s*종료)/.test(
      text
    )
  ) {
    return { type: 'STOP_LISTENING' };
  }

  // 4. 음성명령 도움말 ("음성명령 도움말", "뭐라고 말하면 돼?", "도움말")
  if (
    /(도움말|음성\s*명령\s*도움말|뭐라고\s*말하면\s*돼|명령어\s*알려줘|어떻게\s*말해|사용법|도움|명령어|뭐라고\s*해)/.test(
      text
    )
  ) {
    return { type: 'HELP' };
  }

  // 5. 재료 화면 제어 (열기 / 닫기)
  if (
    /(재료\s*보여줘|재료\s*열어줘|재료창\s*열어줘|재료창\s*보여줘|재료\s*표시|재료\s*띄워줘|재료\s*사이드바)/.test(
      text
    )
  ) {
    return { type: 'SHOW_INGREDIENTS' };
  }
  if (
    /(재료\s*닫아줘|재료\s*숨겨줘|재료창\s*닫아줘|재료\s*닫기|재료\s*가려줘|재료창\s*숨겨줘)/.test(text)
  ) {
    return { type: 'HIDE_INGREDIENTS' };
  }

  // 6. 조리 단계 이동 (처음으로 / 이전 / 다음 / 상태 질문 / 다시 읽기)
  if (/(처음으로|첫\s*단계|첫단계|맨\s*처음|처음부터)/.test(text)) {
    return { type: 'FIRST_STEP' };
  }

  if (
    /(지금\s*몇\s*단계|몇\s*번째\s*단계|몇\s*단계야|현재\s*단계\s*몇|진행\s*상황\s*알려줘|어디까지\s*했어|몇\s*단계)/.test(
      text
    )
  ) {
    return { type: 'STEP_STATUS' };
  }

  // "다음", "다음 단계", "넘어가", "넥스트" 등
  if (
    /^(다음|다음\s*단계|다음단계|넘어가|넘어가줘|넥스트|다음으로|앞으로|다음스텝|다음\s*페이지)$/.test(text) ||
    /(다음\s*단계로?\s*넘어가|다음\s*단계\s*보여줘|다음으로\s*가줘)/.test(text)
  ) {
    return { type: 'NEXT_STEP' };
  }

  // "이전", "이전 단계", "뒤로" 등
  if (
    /^(이전|이전\s*단계|이전단계|뒤로|뒤로가|뒤로가줘|이전으로|빽|전단계|이전스텝|이전으로\s*가줘)$/.test(text) ||
    /(이전\s*단계로?\s*가줘|뒤로\s*돌아가)/.test(text)
  ) {
    return { type: 'PREV_STEP' };
  }

  // 7. 재료 관련 명령 (전체 재료 읽기 vs 특정 재료 질문)
  // 7-1. 전체 재료 읽기: "재료 읽어줘", "재료 알려줘", "재료 뭐야", "재료 목록", "재료"
  if (
    /^(재료|재료\s*읽어줘|재료\s*알려줘|재료\s*뭐야|재료\s*목록|전체\s*재료|필요한\s*재료|재료\s*확인|재료\s*뭐\s*있어)$/.test(
      text
    ) ||
    /(재료\s*목록\s*읽어줘|전체\s*재료\s*알려줘|모든\s*재료\s*알려줘)/.test(text)
  ) {
    return { type: 'READ_INGREDIENTS' };
  }

  // 7-2. 특정 재료 개별 질문: "양파 얼마나 필요해?", "계란 몇 개야?", "간장 얼마나 넣어?", "대파 얼마나?"
  const ingredientQueryMatch = text.match(
    /(.+?)\s*(?:얼마나\s*필요|얼마나\s*넣어|얼마나\s*들어가|얼마나\s*써|얼마나|몇\s*(?:개|스푼|큰술|작은술|g|그램|개나|대|봉지|줄|마리|쪽|장|단)|양\s*(?:알려줘|얼마|어떻게|어느정도)|얼마야|필요해|넣어야\s*돼|양\s*얼마)/
  );
  if (ingredientQueryMatch) {
    const rawIng = ingredientQueryMatch[1];
    const cleaned = cleanIngredientName(rawIng);
    // 일반적인 타이머나 단계 관련 단어가 아닐 경우 재료 질문으로 처리
    if (
      cleaned &&
      !/(타이머|시간|단계|조리|단계별|현재|지금)/.test(cleaned) &&
      cleaned.length >= 1 &&
      cleaned.length <= 15
    ) {
      return {
        type: 'QUERY_INGREDIENT',
        ingredient: cleaned,
      };
    }
  }

  // 8. 현재 단계 다시 읽기 / 설명해줘 ("다시 읽어줘", "현재 단계 읽어줘", "설명해줘", "읽어줘")
  if (
    /(다시\s*읽어줘|현재\s*단계\s*읽어줘|설명해줘|다시\s*말해줘|단계\s*읽어줘|내용\s*읽어줘|다시\s*읽어|한\s*번\s*더\s*읽어줘|지금\s*단계\s*읽어줘|이번\s*단계\s*읽어줘)/.test(
      text
    ) ||
    text === '읽어줘' ||
    text === '읽어'
  ) {
    return { type: 'READ_STEP' };
  }

  // 9. 타이머 관련 명령
  // 9-1. 현재 단계 자동 감지 시간 타이머 시작 ("이 단계 타이머 시작", "단계 타이머")
  if (
    /(이\s*단계\s*타이머|현재\s*단계\s*타이머|단계\s*타이머\s*시작|단계\s*타이머|이단계\s*타이머)/.test(
      text
    )
  ) {
    return { type: 'START_STEP_TIMER' };
  }

  // 9-2. 모든 타이머 취소 / 삭제
  if (
    /(모든\s*타이머\s*취소|모든\s*타이머\s*삭제|타이머\s*전부\s*취소|타이머\s*모두\s*취소|타이머\s*전체\s*삭제|타이머\s*다\s*꺼)/.test(
      text
    )
  ) {
    return { type: 'CANCEL_ALL_TIMERS' };
  }

  // 9-3. 타이머 목록 확인
  if (
    /(타이머\s*목록\s*알려줘|타이머\s*목록|타이머\s*뭐\s*있어|타이머\s*어떤\s*거\s*있어|진행\s*중인\s*타이머)/.test(
      text
    )
  ) {
    return { type: 'LIST_TIMERS' };
  }

  // 9-4. 타이머 남은 시간 질문 ("타이머 얼마나 남았어?", "타이머 몇 분 남았어?", "남은 시간 알려줘")
  if (
    /(타이머\s*얼마나\s*남았어|타이머\s*몇\s*분\s*남았어|남은\s*시간\s*알려줘|시간\s*얼마나\s*남았어|타이머\s*남은\s*시간|타이머\s*시간\s*몇\s*분|남은\s*시간)/.test(
      text
    )
  ) {
    return { type: 'TIMER_STATUS' };
  }

  // 9-5. 타이머 일시정지 / 멈춤 ("타이머 일시정지", "타이머 멈춰", "계란 타이머 멈춰")
  if (
    /(타이머\s*일시정지|타이머\s*멈춰|타이머\s*정지|타이머\s*잠깐\s*멈춰|타이머\s*스톱|일시정지)/.test(
      text
    ) ||
    /타이머\s*(멈춰|정지|일시정지)/.test(text)
  ) {
    const labelMatch = text.match(/(.+?)\s*타이머\s*(?:멈춰|정지|일시정지)/);
    const targetLabel = labelMatch ? labelMatch[1].trim() : undefined;
    return {
      type: 'PAUSE_TIMER',
      ...(targetLabel && targetLabel !== '모든' && targetLabel !== '전체' ? { targetLabel } : {}),
    };
  }

  // 9-6. 타이머 재개 / 계속 ("타이머 계속", "타이머 다시 시작", "타이머 재개")
  if (
    /(타이머\s*계속|타이머\s*다시\s*시작|타이머\s*재개|타이머\s*이어서)/.test(text) ||
    text === '계속' ||
    text === '다시 시작'
  ) {
    const labelMatch = text.match(/(.+?)\s*타이머\s*(?:계속|다시\s*시작|재개)/);
    const targetLabel = labelMatch ? labelMatch[1].trim() : undefined;
    return {
      type: 'RESUME_TIMER',
      ...(targetLabel ? { targetLabel } : {}),
    };
  }

  // 9-7. 단일 타이머 취소 / 삭제 ("타이머 취소", "타이머 삭제", "계란 타이머 취소")
  if (/(타이머\s*취소|타이머\s*삭제|타이머\s*꺼|타이머\s*꺼줘)/.test(text)) {
    const labelMatch = text.match(/(.+?)\s*타이머\s*(?:취소|삭제|꺼|꺼줘)/);
    const targetLabel = labelMatch ? labelMatch[1].trim() : undefined;
    return {
      type: 'CANCEL_TIMER',
      ...(targetLabel && targetLabel !== '모든' && targetLabel !== '전체' ? { targetLabel } : {}),
    };
  }

  // 9-8. 명시적 시간 타이머 생성 ("5분 타이머", "5분 타이머 시작", "30초 타이머", "계란 7분 타이머")
  const parsedDuration = parseKoreanDuration(text);
  if (parsedDuration && parsedDuration.isValid && parsedDuration.seconds > 0) {
    return {
      type: 'START_TIMER',
      seconds: parsedDuration.seconds,
      ...(parsedDuration.label ? { label: parsedDuration.label } : {}),
    };
  }

  // 해석 불가 발화
  logger.info('cookingVoiceCommands.parseCookingVoiceCommand', `해석되지 않은 발화: "${raw}"`);
  return {
    type: 'UNKNOWN',
    raw,
  };
}
