/**
 * @file tests/unit/cookingVoiceCommands.test.ts
 * @description 주방 핸즈프리 음성명령 파서 단위 테스트
 */

import { describe, it, expect } from 'vitest';
import { parseCookingVoiceCommand } from '../../src/utils/cookingVoiceCommands';

describe('Cooking Voice Commands Parser Unit Tests', () => {
  it('"다음", "다음 단계", "넘어가" 발화를 NEXT_STEP으로 해석해야 함', () => {
    expect(parseCookingVoiceCommand('다음').type).toBe('NEXT_STEP');
    expect(parseCookingVoiceCommand('다음 단계').type).toBe('NEXT_STEP');
    expect(parseCookingVoiceCommand('다음 단계로 넘어가').type).toBe('NEXT_STEP');
    expect(parseCookingVoiceCommand('넥스트').type).toBe('NEXT_STEP');
  });

  it('"이전", "이전 단계", "뒤로" 발화를 PREV_STEP으로 해석해야 함', () => {
    expect(parseCookingVoiceCommand('이전').type).toBe('PREV_STEP');
    expect(parseCookingVoiceCommand('이전 단계').type).toBe('PREV_STEP');
    expect(parseCookingVoiceCommand('뒤로').type).toBe('PREV_STEP');
    expect(parseCookingVoiceCommand('뒤로가').type).toBe('PREV_STEP');
  });

  it('"다시 읽어줘", "현재 단계 읽어줘", "설명해줘" 발화를 READ_STEP으로 해석해야 함', () => {
    expect(parseCookingVoiceCommand('다시 읽어줘').type).toBe('READ_STEP');
    expect(parseCookingVoiceCommand('현재 단계 읽어줘').type).toBe('READ_STEP');
    expect(parseCookingVoiceCommand('설명해줘').type).toBe('READ_STEP');
    expect(parseCookingVoiceCommand('읽어줘').type).toBe('READ_STEP');
  });

  it('"지금 몇 단계야?", "몇 번째 단계야?" 발화를 STEP_STATUS로 해석해야 함', () => {
    expect(parseCookingVoiceCommand('지금 몇 단계야?').type).toBe('STEP_STATUS');
    expect(parseCookingVoiceCommand('몇 번째 단계야').type).toBe('STEP_STATUS');
  });

  it('"재료 읽어줘", "재료 알려줘" 발화를 READ_INGREDIENTS로 해석해야 함', () => {
    expect(parseCookingVoiceCommand('재료 읽어줘').type).toBe('READ_INGREDIENTS');
    expect(parseCookingVoiceCommand('재료 알려줘').type).toBe('READ_INGREDIENTS');
    expect(parseCookingVoiceCommand('재료 뭐야').type).toBe('READ_INGREDIENTS');
    expect(parseCookingVoiceCommand('재료').type).toBe('READ_INGREDIENTS');
  });

  it('특정 재료 질문 발화를 QUERY_INGREDIENT와 정제된 재료명으로 해석해야 함', () => {
    const cmd1 = parseCookingVoiceCommand('양파 얼마나 필요해?');
    expect(cmd1.type).toBe('QUERY_INGREDIENT');
    if (cmd1.type === 'QUERY_INGREDIENT') {
      expect(cmd1.ingredient).toBe('양파');
    }

    const cmd2 = parseCookingVoiceCommand('계란 몇 개야?');
    expect(cmd2.type).toBe('QUERY_INGREDIENT');
    if (cmd2.type === 'QUERY_INGREDIENT') {
      expect(cmd2.ingredient).toBe('계란');
    }

    const cmd3 = parseCookingVoiceCommand('간장 얼마나 넣어?');
    expect(cmd3.type).toBe('QUERY_INGREDIENT');
    if (cmd3.type === 'QUERY_INGREDIENT') {
      expect(cmd3.ingredient).toBe('간장');
    }

    const cmd4 = parseCookingVoiceCommand('고춧가루 양 알려줘');
    expect(cmd4.type).toBe('QUERY_INGREDIENT');
    if (cmd4.type === 'QUERY_INGREDIENT') {
      expect(cmd4.ingredient).toBe('고춧가루');
    }

    const cmd5 = parseCookingVoiceCommand('대파 얼마나?');
    expect(cmd5.type).toBe('QUERY_INGREDIENT');
    if (cmd5.type === 'QUERY_INGREDIENT') {
      expect(cmd5.ingredient).toBe('대파');
    }
  });

  it('타이머 생성 발화를 START_TIMER와 올바른 초/라벨로 해석해야 함', () => {
    const cmd1 = parseCookingVoiceCommand('5분 타이머');
    expect(cmd1.type).toBe('START_TIMER');
    if (cmd1.type === 'START_TIMER') {
      expect(cmd1.seconds).toBe(300);
    }

    const cmd2 = parseCookingVoiceCommand('1분 30초 타이머');
    expect(cmd2.type).toBe('START_TIMER');
    if (cmd2.type === 'START_TIMER') {
      expect(cmd2.seconds).toBe(90);
    }

    const cmd3 = parseCookingVoiceCommand('계란 7분 타이머');
    expect(cmd3.type).toBe('START_TIMER');
    if (cmd3.type === 'START_TIMER') {
      expect(cmd3.seconds).toBe(420);
      expect(cmd3.label).toBe('계란');
    }
  });

  it('"타이머 얼마나 남았어?" 발화를 TIMER_STATUS로 해석해야 함', () => {
    expect(parseCookingVoiceCommand('타이머 얼마나 남았어?').type).toBe('TIMER_STATUS');
    expect(parseCookingVoiceCommand('남은 시간 알려줘').type).toBe('TIMER_STATUS');
  });

  it('"타이머 멈춰", "타이머 일시정지" 발화를 PAUSE_TIMER로 해석해야 함', () => {
    expect(parseCookingVoiceCommand('타이머 멈춰').type).toBe('PAUSE_TIMER');
    expect(parseCookingVoiceCommand('타이머 일시정지').type).toBe('PAUSE_TIMER');
    const cmd = parseCookingVoiceCommand('계란 타이머 멈춰');
    expect(cmd.type).toBe('PAUSE_TIMER');
    if (cmd.type === 'PAUSE_TIMER') {
      expect(cmd.targetLabel).toBe('계란');
    }
  });

  it('"타이머 계속", "타이머 다시 시작" 발화를 RESUME_TIMER로 해석해야 함', () => {
    expect(parseCookingVoiceCommand('타이머 계속').type).toBe('RESUME_TIMER');
    expect(parseCookingVoiceCommand('타이머 다시 시작').type).toBe('RESUME_TIMER');
  });

  it('"재료 보여줘", "재료 닫아줘" 발화를 UI 제어 인텐트로 해석해야 함', () => {
    expect(parseCookingVoiceCommand('재료 보여줘').type).toBe('SHOW_INGREDIENTS');
    expect(parseCookingVoiceCommand('재료 닫아줘').type).toBe('HIDE_INGREDIENTS');
  });

  it('"마이크 꺼", "듣기 그만" 발화를 STOP_LISTENING으로 해석해야 함', () => {
    expect(parseCookingVoiceCommand('마이크 꺼').type).toBe('STOP_LISTENING');
    expect(parseCookingVoiceCommand('듣기 그만').type).toBe('STOP_LISTENING');
    expect(parseCookingVoiceCommand('음성명령 종료').type).toBe('STOP_LISTENING');
  });

  it('"요리 완료" 발화를 REQUEST_COMPLETE로, "완료해" 발화를 CONFIRM_COMPLETE로 해석해야 함', () => {
    expect(parseCookingVoiceCommand('요리 완료').type).toBe('REQUEST_COMPLETE');
    expect(parseCookingVoiceCommand('다 했어').type).toBe('REQUEST_COMPLETE');
    expect(parseCookingVoiceCommand('조리 끝').type).toBe('REQUEST_COMPLETE');
    expect(parseCookingVoiceCommand('완료해').type).toBe('CONFIRM_COMPLETE');
    expect(parseCookingVoiceCommand('완료할래').type).toBe('CONFIRM_COMPLETE');
  });
});
