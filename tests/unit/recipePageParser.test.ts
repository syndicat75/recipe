/**
 * @file tests/unit/recipePageParser.test.ts
 * @description JSON-LD 레시피 파서, 추적 파라미터 정제 및 AI 모델 설정 에러 분류 유닛 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  stripTrackingParams,
  extractJsonLdRecipe,
  isSufficientJsonLdRecipe,
  normalizeJsonLdToRecipe,
  formatPartialJsonLdPromptText,
} from '../../lib/recipePageParser';
import {
  AI_MODELS,
  isQuotaError,
  isModelNotFoundError,
  parseRetryDelay,
  formatModelChainError,
} from '../../lib/ai/modelConfig';

describe('recipePageParser & JSON-LD Direct Mode', () => {
  describe('stripTrackingParams', () => {
    it('UTM, fbclid 등 추적 파라미터를 정확히 제거하고 원본 쿼리를 보존한다', () => {
      const url = 'https://www.10000recipe.com/recipe/12345?utm_source=facebook&recipe_no=12345&fbclid=abcdef#step1';
      const cleaned = stripTrackingParams(url);
      expect(cleaned).toContain('https://www.10000recipe.com/recipe/12345');
      expect(cleaned).toContain('recipe_no=12345');
      expect(cleaned).not.toContain('utm_source');
      expect(cleaned).not.toContain('fbclid');
    });

    it('잘못된 URL 입력 시 원본 문자열을 안전하게 반환한다', () => {
      expect(stripTrackingParams('not-a-valid-url')).toBe('not-a-valid-url');
    });
  });

  describe('extractJsonLdRecipe & isSufficientJsonLdRecipe', () => {
    it('HTML 내 schema.org/Recipe JSON-LD를 정확히 추출한다', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "초간단 김치찌개",
            "recipeIngredient": [
              "돼지고기 200g",
              "신김치 1/4포기",
              "두부 반모",
              "대파 1대"
            ],
            "recipeInstructions": [
              {
                "@type": "HowToStep",
                "text": "냄비에 돼지고기와 김치를 넣고 볶습니다."
              },
              {
                "@type": "HowToStep",
                "text": "물을 붓고 15분간 끓인 뒤 두부와 파를 넣습니다."
              }
            ],
            "recipeYield": "2인분",
            "totalTime": "PT20M"
          }
          </script>
        </head>
        <body><div>웹페이지 본문</div></body>
        </html>
      `;

      const recipe = extractJsonLdRecipe(html);
      expect(recipe).not.toBeNull();
      expect(recipe?.name).toBe('초간단 김치찌개');
      expect(recipe?.ingredients).toHaveLength(4);
      expect(recipe?.instructions).toHaveLength(2);
      expect(recipe?.servings).toBe(2);
      expect(recipe?.cookingTimeMinutes).toBe(20);

      const isSufficient = isSufficientJsonLdRecipe(recipe);
      expect(isSufficient).toBe(true);
    });

    it('제목만 있고 재료/조리법이 비어있는 불충분한 JSON-LD는 false를 반환한다', () => {
      const incompleteRecipe = {
        name: '미완성 레시피',
        ingredients: [],
        instructions: [],
      };
      expect(isSufficientJsonLdRecipe(incompleteRecipe)).toBe(false);
    });
  });

  describe('normalizeJsonLdToRecipe', () => {
    it('JSON-LD 데이터를 완벽한 Recipe 형태로 정규화한다', () => {
      const jsonLd = {
        name: '소고기 미역국',
        category: '국·찌개',
        ingredients: ['소고기 150g', '불린 미역 2줌', '참기름 1큰술', '국간장 2큰술'],
        instructions: ['참기름에 소고기와 미역을 볶습니다.', '물을 넣고 푹 끓여 간을 맞춥니다.'],
        servings: 4,
        cookingTimeMinutes: 30,
      };

      const normalized = normalizeJsonLdToRecipe(jsonLd, ['국·찌개', '반찬', '기타']);
      expect(normalized.name).toBe('소고기 미역국');
      expect(normalized.category).toBe('국·찌개');
      expect(normalized.baseServings).toBe(4);
      expect(normalized.cookingTimeMinutes).toBe(30);
      expect(normalized.ingredients).toContain('소고기 150g');
      expect(normalized.ingredients).toContain('국간장 2큰술');
      expect(normalized.method).toContain('1. 참기름에 소고기와 미역을 볶습니다.');
      expect(normalized.method).toContain('2. 물을 넣고 푹 끓여 간을 맞춥니다.');
    });
  });

  describe('formatPartialJsonLdPromptText', () => {
    it('부분 JSON-LD와 HTML 텍스트를 구조화된 프롬프트로 병합한다', () => {
      const prompt = formatPartialJsonLdPromptText(
        { name: '떡볶이', ingredients: ['떡 300g', '고추장 2스푼'] },
        '추가 조리 설명 텍스트',
        'https://example.com/recipe/tteokbokki'
      );
      expect(prompt).toContain('확정된 웹페이지 구조화 정보');
      expect(prompt).toContain('떡 300g');
      expect(prompt).toContain('웹페이지 HTML 본문 내용');
    });
  });
});

describe('modelConfig AI 쿼터 및 오류 분석', () => {
  it('기본 모델과 Fallback 체인에서 폐기된 모델(2.5-flash-lite)이 제외되어 있다', () => {
    expect(AI_MODELS.primary).toBe('gemini-3.7-flash');
    expect(AI_MODELS.fallback).not.toContain('gemini-2.5-flash-lite');
    expect(AI_MODELS.fallback).toContain('gemini-2.5-flash');
    expect(AI_MODELS.fallback).toContain('gemini-3.5-flash-lite');
  });

  it('429 및 RESOURCE_EXHAUSTED 쿼터 오류를 정확히 감지한다', () => {
    const quotaError1 = new Error('429 RESOURCE_EXHAUSTED: quota exceeded for model');
    const quotaError2 = new Error('RESOURCE_EXHAUSTED: Quota exceeded for quota metric');
    const normalError = new Error('503 Service Unavailable');

    expect(isQuotaError(quotaError1)).toBe(true);
    expect(isQuotaError(quotaError2)).toBe(true);
    expect(isQuotaError(normalError)).toBe(false);
  });

  it('404 모델 미지원 오류를 정확히 감지한다', () => {
    const notFoundErr = new Error('404 NOT_FOUND: models/gemini-2.5-flash-lite is not found');
    expect(isModelNotFoundError(notFoundErr)).toBe(true);
  });

  it('Retry-After 시간을 정확히 파싱한다', () => {
    const err = new Error('Quota exceeded. Please retry after 15s');
    expect(parseRetryDelay(err)).toBe('약 15초');
  });

  it('모든 모델이 쿼터 초과 시 AI_QUOTA_EXHAUSTED로 구조화한다', () => {
    const failures = [
      {
        model: 'gemini-3.7-flash',
        message: '429 RESOURCE_EXHAUSTED',
        isQuota: true,
        isNotFound: false,
        timestamp: Date.now(),
      },
      {
        model: 'gemini-2.5-flash',
        message: '429 RESOURCE_EXHAUSTED',
        isQuota: true,
        isNotFound: false,
        timestamp: Date.now(),
      },
    ];

    const result = formatModelChainError(failures, '기본 에러');
    expect(result.errorCode).toBe('AI_QUOTA_EXHAUSTED');
    expect(result.error).toContain('할당량');
  });
});
