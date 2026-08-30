/**
 * @file lib/geminiService.ts
 * @description Gemini 모델을 활용한 레시피 AI 서비스 핵심 비즈니스 로직.
 * gemini-3.7-flash를 기본 모델로 사용하며, 모델 과부하(503/UNAVAILABLE) 발생 시
 * Exponential Backoff + Jitter 재시도 및 gemini-3.6-flash 자동 Fallback을 지원합니다.
 * Vercel Serverless Functions(api/ai/*) 및 로컬 Express 서버(server.ts)에서 공통으로 사용됩니다.
 */

import { GoogleGenAI, Type } from '@google/genai';
import { fetchAndParseRecipePage } from './recipePageParser.js';

type GenerateContentParameters = Parameters<GoogleGenAI['models']['generateContent']>[0];
type GenerateContentResult = Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>;

export interface GenerateFallbackOptions {
  retryMode?: 'standard' | 'fast';
  startedAt?: number;
  maxServerBudgetMs?: number;
  requestId?: string;
}

export interface ModelExecutionMeta {
  modelUsed: string;
  retryCount: number;
  fallbackUsed: boolean;
  aiDurationMs: number;
}

/**
 * Gemini 클라이언트 인스턴스 지연(Lazy) 생성 함수
 * Top-level에서 생성하지 않고 API 호출 시점에 생성하여 불필요한 초기화 에러를 방지합니다.
 * @returns GoogleGenAI 인스턴스
 */
export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error('GEMINI_API_KEY_NOT_CONFIGURED');
  }

  return new GoogleGenAI({
    apiKey: apiKey.trim(),
  });
}

/**
 * Gemini 모델 과부하(503/UNAVAILABLE) 및 쿼터 소진(RESOURCE_EXHAUSTED/429)에 대응하는
 * 고속 다단계 Fallback 체인 (Primary: gemini-3.7-flash -> Fallback 1: gemini-flash-latest -> Fallback 2: gemini-3.1-flash-lite)
 * - 쿼터 초과나 429 감지 시 동일 모델에 대한 무의미한 지연 대기를 즉시 중단하고 다음 모델로 전환합니다.
 * - retryMode가 'fast'인 경우 전체 10초 예산 내에서 신속하게 결과를 확보하여 클라이언트 타임아웃을 원천 차단합니다.
 */
async function generateWithFallback(
  ai: GoogleGenAI,
  request: Omit<GenerateContentParameters, 'model'> & { model?: string },
  options: GenerateFallbackOptions = {}
): Promise<GenerateContentResult & { executionMeta?: ModelExecutionMeta }> {
  const primaryModel = 'gemini-3.7-flash';
  const fallbackModels = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
  const retryMode = options.retryMode || 'standard';
  const startedAt = options.startedAt || Date.now();
  const callStart = Date.now();
  const reqTag = options.requestId ? `[${options.requestId}] ` : '';

  const isFast = retryMode === 'fast';
  // fast 모드(레시피 추출)에서는 1회만 시도 후 실패 시 즉시 fallback
  const maxAttempts = isFast ? 1 : 2;
  const delays = [600];

  let retryCount = 0;
  let lastError: unknown = null;

  // 1. Primary 모델 시도 (gemini-3.7-flash)
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await ai.models.generateContent({
        ...request,
        model: primaryModel,
      });

      return Object.assign(res, {
        executionMeta: {
          modelUsed: primaryModel,
          retryCount: attempt,
          fallbackUsed: false,
          aiDurationMs: Date.now() - callStart,
        },
      });
    } catch (error) {
      lastError = error;
      retryCount = attempt + 1;
      const message = error instanceof Error ? error.message : String(error);

      // 400, 401, 403, 404 등 클라이언트/인증 오류는 즉시 throw
      const isClientOrAuthError =
        message.includes('400') ||
        message.includes('401') ||
        message.includes('403') ||
        message.includes('404') ||
        message.includes('API_KEY_INVALID');
      if (isClientOrAuthError) {
        throw error;
      }

      // 할당량 초과(RESOURCE_EXHAUSTED / 429)는 동일 모델 재시도 없이 즉시 Fallback으로 스위칭
      const isQuotaOrRateLimit =
        message.includes('RESOURCE_EXHAUSTED') ||
        message.includes('429') ||
        message.includes('quota') ||
        message.includes('Quota exceeded');
      if (isQuotaOrRateLimit) {
        console.warn(`${reqTag}Gemini 3.7 Flash 할당량 초과 감지 - 동일 모델 재시도 생략 후 즉시 Fallback 체인 가동`);
        break;
      }

      const elapsed = Date.now() - startedAt;
      if (isFast && elapsed > 8000) {
        console.warn(`${reqTag}Gemini 3.7 Fast Mode - 경과 시간(${elapsed}ms) 초과로 즉시 Fallback 전환`);
        break;
      }

      if (attempt < maxAttempts - 1) {
        const delay = (delays[attempt] || 600) + Math.floor(Math.random() * 200);
        console.warn(`${reqTag}Gemini 3.7 Flash 일시 과부하 - ${delay}ms 후 재시도 (${attempt + 1}/${maxAttempts - 1})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // 2. 다단계 Fallback 체인 순차 실행
  for (const fallbackModel of fallbackModels) {
    console.info(`${reqTag}Falling back to ${fallbackModel}`);
    try {
      const fallbackRes = await ai.models.generateContent({
        ...request,
        model: fallbackModel,
      });

      return Object.assign(fallbackRes, {
        executionMeta: {
          modelUsed: fallbackModel,
          retryCount,
          fallbackUsed: true,
          aiDurationMs: Date.now() - callStart,
        },
      });
    } catch (fallbackError) {
      lastError = fallbackError;
      console.warn(`${reqTag}Fallback to ${fallbackModel} failed:`, fallbackError);
      // 다음 fallback 모델로 계속 진행
    }
  }

  throw lastError || new Error('모든 AI 모델 호출에 실패했습니다.');
}

/**
 * 원본 HTML에서 스크립트와 스타일을 제거하고 본문 텍스트만 정제합니다.
 * @param html 원본 HTML 문자열
 * @returns 정제된 텍스트 문자열
 */
function cleanHtmlText(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
}

/**
 * Gemini raw JSON 텍스트 응답을 안전하게 파싱합니다.
 * @param rawText AI 모델이 반환한 텍스트
 * @returns 파싱된 객체
 */
function safeParseGeminiJson<T>(rawText: string | undefined): T {
  if (!rawText || !rawText.trim()) {
    throw new Error('AI 모델에서 빈 응답이 반환되었습니다.');
  }

  try {
    return JSON.parse(rawText) as T;
  } catch (error) {
    console.error('Gemini JSON parsing error. Raw response preview:', rawText.slice(0, 500), error);
    throw new Error('Gemini 응답 JSON을 해석하지 못했습니다.');
  }
}

/**
 * 오류 발생 시 사용자 친화적인 에러 메시지 객체를 반환합니다.
 * 503/과부하/429/RESOURCE_EXHAUSTED 오류는 사용자에게 친절하고 명확한 안내를 제공합니다.
 */
function formatAiServiceError(
  error: unknown,
  defaultMessage: string
): { error: string; details?: string } {
  if (error instanceof Error && error.message === 'GEMINI_API_KEY_NOT_CONFIGURED') {
    return {
      error: 'AI 서버 설정이 완료되지 않았습니다. GEMINI_API_KEY를 확인해주세요.',
    };
  }

  const errString = error instanceof Error ? error.message : String(error);

  // 할당량(Quota) 초과 시 명확하고 친절한 안내
  const isQuotaExceeded =
    errString.includes('RESOURCE_EXHAUSTED') ||
    errString.includes('quota') ||
    errString.includes('Quota exceeded') ||
    errString.includes('rate-limits');

  if (isQuotaExceeded) {
    return {
      error:
        'AI 서비스 일일 이용량(할당량)이 일시적으로 초과되었습니다. 잠시 후 다시 시도하시거나, 레시피 텍스트를 복사하여 "텍스트 가져오기" 또는 직접 등록을 이용해주세요.',
      details: errString,
    };
  }

  const isOverloadedOrRateLimited =
    errString.includes('503') ||
    errString.includes('UNAVAILABLE') ||
    errString.includes('high demand') ||
    errString.includes('overloaded') ||
    errString.includes('429');

  if (isOverloadedOrRateLimited) {
    return {
      error: '현재 AI 서버 이용량이 많아 일시적으로 지연되었습니다. 잠시 후 다시 시도해주세요.',
      details: errString,
    };
  }

  return {
    error: defaultMessage,
    details: errString,
  };
}

/**
 * 1. URL 또는 텍스트 기반 레시피 구조화 추출
 * schema.org/Recipe JSON-LD를 최우선 탐색하여 광고/댓글/메뉴를 배제한 최소 데이터만 Gemini에 전달합니다.
 * JSON-LD 부재 시에만 정제된 HTML 본문을 전달합니다.
 * @param params url, text, requestId
 * @returns 정제된 레시피 데이터 및 성능 진단 메타
 */
export async function importRecipeFromTextOrUrl(params: {
  url?: string;
  text?: string;
  requestId?: string;
  availableCategories?: string[];
}): Promise<{
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  details?: string;
  meta?: {
    sourceType: 'jsonld' | 'html' | 'text';
    fetchDurationMs: number;
    parseDurationMs: number;
    aiDurationMs: number;
    totalDurationMs: number;
    modelUsed: string;
    retryCount: number;
    fallbackUsed: boolean;
    requestId: string;
  };
}> {
  const startedAt = Date.now();
  const reqId =
    params.requestId ||
    (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `req_${Date.now()}`);

  try {
    const { url, text, availableCategories = [] } = params;
    if (!url && !text) {
      return {
        success: false,
        error: 'URL 또는 텍스트 중 하나를 입력해주세요.',
      };
    }

    const validCategoryList =
      Array.isArray(availableCategories) && availableCategories.length > 0
        ? Array.from(new Set([...availableCategories, '기타']))
        : ['반찬', '소스·양념', '국·찌개', '중식·양식', '밥·한그릇', '계란요리', '기타'];
    const categoryOptionsText = validCategoryList.map((c) => `'${c}'`).join(', ');

    const ai = getGeminiClient();
    let sourceType: 'jsonld' | 'html' | 'text' = 'text';
    let fetchDurationMs = 0;
    let parseDurationMs = 0;
    let sourceContent = '';
    let hintServings: number | undefined;

    // 1. URL 제공된 경우: 5초 타임아웃 웹페이지 조회 및 JSON-LD 우선 파싱
    if (url && url.trim()) {
      const parseResult = await fetchAndParseRecipePage(url.trim(), 5000);
      fetchDurationMs = parseResult.fetchDurationMs;
      parseDurationMs = parseResult.parseDurationMs;

      if (parseResult.success) {
        sourceType = parseResult.sourceType as 'jsonld' | 'html';
        sourceContent = parseResult.extractedText;
        if (parseResult.jsonLdRecipe?.servings) {
          hintServings = parseResult.jsonLdRecipe.servings;
        }
        console.info(
          `[recipe-import][${reqId}] URL fetch: ${fetchDurationMs}ms (${sourceType}), parse: ${parseDurationMs}ms`
        );
      } else {
        console.warn(
          `[recipe-import][${reqId}] URL fetch 실패 (${fetchDurationMs}ms): ${parseResult.errorMessage}`
        );

        // URL 조회가 막혔거나 실패한 경우, 사용자가 입력한 추가 텍스트가 있으면 텍스트로 전환
        if (text && text.trim()) {
          sourceType = 'text';
          sourceContent = `[사용자 입력 텍스트]:\n${text.trim()}`;
        } else {
          // 본문을 읽지 못했는데 임의로 레시피를 지어내지 않고 정직하게 텍스트 붙여넣기 안내 반환
          return {
            success: false,
            error:
              parseResult.errorMessage ||
              '해당 사이트에서 레시피 본문을 읽지 못했습니다. 레시피 내용을 복사해서 "텍스트 가져오기"에 붙여넣어 주세요.',
          };
        }
      }
    }

    // 2. 텍스트 병합 처리
    if (text && text.trim() && sourceType !== 'text') {
      sourceContent += (sourceContent ? '\n\n' : '') + `[사용자 추가 텍스트/메모]:\n${text.trim()}`;
    } else if (text && text.trim() && !sourceContent) {
      sourceType = 'text';
      sourceContent = `[사용자 입력 텍스트]:\n${text.trim()}`;
    }

    // 3. Gemini 구조화 추출 프롬프트 (군더더기 없는 JSON 전용)
    const prompt = `당신은 대한민국 최고의 요리 연구가이자 레시피 정리 전문가입니다.
제공된 요리 레시피 원본 내용 또는 구조화 데이터를 분석하여 사용자가 바로 요리할 수 있도록 군더더기 없는 JSON 형식으로 정제해주세요.

[분석할 원본 내용]:
${sourceContent}

[작성 규칙 - 엄격 준수]:
1. name: 한국어 표준 음식명 (예: 김치찌개, 소고기 미역국, 계란말이 등)
2. category: 반드시 다음 카테고리 중 하나만 선택: ${categoryOptionsText} (가장 잘 어울리는 항목이 없으면 반드시 '기타' 선택)
3. icon: 해당 요리와 가장 잘 어울리는 대표 단일 이모지 (예: 🍳, 🥘, 🥗, 🥣, 🍽️, 🍛, 🍚, 🥪, 🍜, 🥩 등)
4. baseServings: 기준 인분 수 (원문이나 구조화 데이터에 명시된 인분을 최우선으로 추출하세요. 1인분이면 반드시 1, 2인분이면 2, 4인분이면 4. 원문에 1인분이 적혀 있으면 절대로 2로 바꾸지 마세요. 원문에 인분 정보가 전혀 없을 때만 기본값 1을 지정하세요)
5. ingredients: 재료 및 분량을 줄바꿈(\\n)으로 구분된 하나의 문자열로 작성
6. method: 조리 순서를 1단계부터 알기 쉽게 번호와 줄바꿈(\\n)으로 구분된 하나의 문자열로 작성
7. cookingTimeMinutes: 예상 조리시간(분 단위 정수, 1~180)
8. difficulty: '쉬움', '보통', '어려움' 중 하나
9. tips: 이 요리를 더 맛있게 만들 수 있는 핵심 비법이나 주의점 (1~2문장)`;

    const response = await generateWithFallback(
      ai,
      {
        contents: prompt,
        config: {
          systemInstruction: 'You are an expert Korean chef and culinary data parser. Output pure JSON without markdown explanation.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: '요리 이름' },
              category: {
                type: Type.STRING,
                description: '카테고리 (반찬, 소스·양념, 국·찌개, 중식·양식, 밥·한그릇, 계란요리, 기타 중 하나)',
              },
              icon: { type: Type.STRING, description: '대표 이모지' },
              baseServings: { type: Type.INTEGER, description: '기준 인분 수 (원문 명시 인분 최우선, 없으면 1)' },
              ingredients: { type: Type.STRING, description: '줄바꿈으로 구분된 재료 목록' },
              method: { type: Type.STRING, description: '줄바꿈으로 구분된 조리 순서' },
              cookingTimeMinutes: { type: Type.INTEGER, description: '예상 조리시간 (분)' },
              difficulty: { type: Type.STRING, description: '난이도 (쉬움, 보통, 어려움)' },
              tips: { type: Type.STRING, description: '조리 꿀팁 및 조언' },
            },
            required: ['name', 'category', 'icon', 'ingredients', 'method', 'cookingTimeMinutes', 'difficulty'],
          },
        },
      },
      {
        retryMode: 'fast',
        startedAt,
        requestId: reqId,
      }
    );

    const parsedJson = safeParseGeminiJson<Record<string, unknown>>(response.text);

    // category 검증: 허용된 카테고리에 없으면 '기타'로 안전 fallback
    let finalCategory = typeof parsedJson.category === 'string' ? parsedJson.category.trim() : '기타';
    if (!validCategoryList.includes(finalCategory)) {
      console.warn(`[recipe-import][${reqId}] 인식된 카테고리 "${finalCategory}"가 허용 목록에 없어 "기타"로 대체`);
      finalCategory = '기타';
    }

    // baseServings 검증: JSON-LD 명시값 또는 Gemini 추출값 우선, 없으면 1
    const rawServings = parsedJson.baseServings;
    const finalServings =
      typeof rawServings === 'number' && rawServings >= 1
        ? Math.round(rawServings)
        : hintServings && hintServings >= 1
          ? hintServings
          : 1;

    const aiDurationMs = response.executionMeta?.aiDurationMs || 0;
    const totalDurationMs = Date.now() - startedAt;
    const modelUsed = response.executionMeta?.modelUsed || 'gemini-3.7-flash';
    const retryCount = response.executionMeta?.retryCount || 0;
    const fallbackUsed = response.executionMeta?.fallbackUsed || false;

    console.info(
      `[recipe-import][${reqId}] Gemini ${modelUsed}: ${aiDurationMs}ms (retry: ${retryCount}, fallback: ${fallbackUsed}), Total: ${totalDurationMs}ms`
    );

    return {
      success: true,
      data: {
        ...parsedJson,
        category: finalCategory,
        baseServings: finalServings,
      },
      meta: {
        sourceType,
        fetchDurationMs,
        parseDurationMs,
        aiDurationMs,
        totalDurationMs,
        modelUsed,
        retryCount,
        fallbackUsed,
        requestId: reqId,
      },
    };
  } catch (error) {
    const totalDurationMs = Date.now() - startedAt;
    console.error(`[recipe-import][${reqId}] Error after ${totalDurationMs}ms:`, error);
    const errObj = formatAiServiceError(
      error,
      '레시피 분석 중 오류가 발생했습니다. 직접 입력하거나 텍스트를 조금 더 자세히 입력해주세요.'
    );
    return {
      success: false,
      ...errObj,
    };
  }
}

/**
 * 2. 사진(요리책, 손글씨 메모, 포장지, 캡처) 기반 멀티모달 OCR 레시피 추출
 * @param params imageBase64, mimeType, requestId
 * @returns 추출된 구조화 레시피 데이터 및 메타
 */
export async function importRecipeFromImage(params: {
  imageBase64?: string;
  mimeType?: string;
  requestId?: string;
  availableCategories?: string[];
}): Promise<{
  success: boolean;
  recipe?: Record<string, unknown>;
  error?: string;
  details?: string;
  meta?: {
    sourceType: 'image';
    aiDurationMs: number;
    totalDurationMs: number;
    modelUsed: string;
    retryCount: number;
    fallbackUsed: boolean;
    requestId: string;
  };
}> {
  const startedAt = Date.now();
  const reqId =
    params.requestId ||
    (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `req_${Date.now()}`);

  try {
    const { imageBase64, mimeType = 'image/jpeg', availableCategories = [] } = params;

    if (!imageBase64 || !imageBase64.trim()) {
      return {
        success: false,
        error: '이미지 데이터가 필요합니다.',
      };
    }

    const validCategoryList =
      Array.isArray(availableCategories) && availableCategories.length > 0
        ? Array.from(new Set([...availableCategories, '기타']))
        : ['반찬', '소스·양념', '국·찌개', '중식·양식', '밥·한그릇', '계란요리', '기타'];
    const categoryOptionsText = validCategoryList.map((c) => `'${c}'`).join(', ');

    const ai = getGeminiClient();

    // Base64 프리픽스(data:image/jpeg;base64,) 제거
    const cleanedBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').trim();

    const prompt = `당신은 이미지 속의 요리 레시피 텍스트를 정확하게 판독하는 한국어 OCR 및 레시피 구조화 전문가입니다.
첨부된 사진(요리책 페이지, 손글씨 요리 메모, 제품 포장지 조리법, 캡처본 등)을 분석하여 레시피 정보만 정확히 추출해 JSON으로 반환하세요.

[절대적인 추출 원칙 - 엄격 준수]
1. 사진에 실제로 적혀 있는 정보만 읽어서 기록하세요. 절대로 새로운 레시피를 지어내거나 임의로 재료/수량을 창작하지 마세요.
2. 사진에 실제 레시피(재료나 조리법) 텍스트가 전혀 없고 단순 완성 음식 사진이거나 무관한 이미지인 경우, isRecipeFound를 false로 하고 errorMessage에 "사진에서 재료나 조리방법이 적힌 레시피 정보를 확인할 수 없습니다."를 반환하세요.
3. 사진에 '간장'이라고만 적혀 있으면 '간장'으로만 추출하세요. 임의로 '간장 1큰술'로 추측해서 채우지 마세요.
4. 글씨가 흐리거나 잘 보이지 않는 부분은 글자 뒤에 '(확인 필요)' 또는 '?'를 붙이고, lowConfidenceFields 배열에 해당 필드명(예: 'ingredients', 'cookingTimeMinutes' 등)을 추가하세요.
5. 카테고리는 다음 항목 중 가장 적절한 1개를 선택하세요: ${categoryOptionsText} (어울리는 항목이 없으면 반드시 '기타' 선택)
6. 기준 인분 정보가 사진에 명시되어 있다면 baseServings(숫자)로 추출하고, 없으면 1로 지정하세요.
7. 재료(ingredients)는 줄바꿈(\\n)으로 구분된 하나의 문자열로 작성하세요. (예: "돼지고기 150g\\n신김치 1/4포기\\n두부 1/2모")
8. 조리법(method)은 각 단계를 번호와 줄바꿈(\\n)으로 구분하여 작성하세요.`;

    const response = await generateWithFallback(
      ai,
      {
        contents: [
          {
            text: prompt,
          },
          {
            inlineData: {
              mimeType: mimeType,
              data: cleanedBase64,
            },
          },
        ],
        config: {
          systemInstruction: 'You are an expert Korean OCR and recipe data parser. Output pure JSON without markdown explanation.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isRecipeFound: {
                type: Type.BOOLEAN,
                description: '사진 내 레시피(재료 또는 조리법) 텍스트 식별 여부',
              },
              errorMessage: {
                type: Type.STRING,
                description: '레시피 미식별 시 안내 메시지',
              },
              name: { type: Type.STRING, description: '요리 이름' },
              category: {
                type: Type.STRING,
                description: '카테고리 (반찬, 소스·양념, 국·찌개, 중식·양식, 밥·한그릇, 계란요리, 기타)',
              },
              icon: { type: Type.STRING, description: '가장 잘 어울리는 음식 단일 이모지 (예: 🥘, 🍛)' },
              baseServings: { type: Type.INTEGER, description: '사진에 적힌 기준 인분 수 (명시 없으면 1)' },
              ingredients: { type: Type.STRING, description: '재료 목록 (줄바꿈 구분)' },
              method: { type: Type.STRING, description: '조리 순서 (번호와 줄바꿈 구분)' },
              cookingTimeMinutes: { type: Type.INTEGER, description: '조리 시간 (분)' },
              difficulty: {
                type: Type.STRING,
                enum: ['쉬움', '보통', '어려움'],
                description: '난이도',
              },
              tip: { type: Type.STRING, description: '사진에 적힌 조리 팁 또는 보조 메모' },
              lowConfidenceFields: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '글씨가 흐리거나 판독이 불확실했던 필드명 목록',
              },
            },
            required: ['name', 'category', 'icon', 'ingredients', 'method'],
          },
        },
      },
      {
        retryMode: 'fast',
        startedAt,
        requestId: reqId,
      }
    );

    interface ImageRecipeResult {
      isRecipeFound?: boolean;
      errorMessage?: string;
      name?: string;
      category?: string;
      icon?: string;
      baseServings?: number;
      ingredients?: string;
      method?: string;
      cookingTimeMinutes?: number;
      difficulty?: string;
      tip?: string;
      lowConfidenceFields?: string[];
    }

    const parsedData = safeParseGeminiJson<ImageRecipeResult>(response.text);

    if (
      parsedData.isRecipeFound === false ||
      (!parsedData.name && !parsedData.ingredients && !parsedData.method)
    ) {
      return {
        success: false,
        error: parsedData.errorMessage || '사진에서 재료나 조리방법이 적힌 레시피 정보를 확인할 수 없습니다.',
      };
    }

    const aiDurationMs = response.executionMeta?.aiDurationMs || 0;
    const totalDurationMs = Date.now() - startedAt;
    const modelUsed = response.executionMeta?.modelUsed || 'gemini-3.7-flash';
    const retryCount = response.executionMeta?.retryCount || 0;
    const fallbackUsed = response.executionMeta?.fallbackUsed || false;

    console.info(
      `[recipe-import-image][${reqId}] Gemini ${modelUsed}: ${aiDurationMs}ms (retry: ${retryCount}, fallback: ${fallbackUsed}), Total: ${totalDurationMs}ms`
    );

    const rawCategory = typeof parsedData.category === 'string' ? parsedData.category.trim() : '기타';
    const finalCategory = validCategoryList.includes(rawCategory) ? rawCategory : '기타';

    return {
      success: true,
      recipe: {
        name: parsedData.name || '가져온 레시피',
        category: finalCategory,
        icon: parsedData.icon || '🍳',
        baseServings:
          typeof parsedData.baseServings === 'number' && parsedData.baseServings >= 1
            ? Math.round(parsedData.baseServings)
            : Number(parsedData.baseServings) >= 1
              ? Math.round(Number(parsedData.baseServings))
              : 1,
        ingredients: parsedData.ingredients || '',
        method: parsedData.method || '-',
        cookingTimeMinutes: Number(parsedData.cookingTimeMinutes) || 15,
        difficulty: parsedData.difficulty || '쉬움',
        tip: parsedData.tip || '',
        lowConfidenceFields: Array.isArray(parsedData.lowConfidenceFields) ? parsedData.lowConfidenceFields : [],
      },
      meta: {
        sourceType: 'image',
        aiDurationMs,
        totalDurationMs,
        modelUsed,
        retryCount,
        fallbackUsed,
        requestId: reqId,
      },
    };
  } catch (error) {
    const totalDurationMs = Date.now() - startedAt;
    console.error(`[recipe-import-image][${reqId}] Error after ${totalDurationMs}ms:`, error);
    const errObj = formatAiServiceError(
      error,
      '사진에서 레시피를 분석하는 중 오류가 발생했습니다. 사진이 선명한지 확인 후 다시 시도해주세요.'
    );
    return {
      success: false,
      ...errObj,
    };
  }
}

/**
 * 3. AI 요리사 레시피 맞춤 Q&A 상담
 * @param params 레시피 컨텍스트, 질문, 대화 히스토리
 * @returns AI 답변
 */
export async function askChefAboutRecipe(params: {
  recipe?: {
    name: string;
    category?: string;
    ingredients?: string;
    method?: string;
    userNotes?: string;
    cookingTimeMinutes?: number;
    difficulty?: string;
  } | null;
  question: string;
  chatHistory?: Array<{ role: 'user' | 'model'; text: string }>;
}): Promise<{
  success: boolean;
  answer?: string;
  error?: string;
  details?: string;
}> {
  try {
    const { recipe, question, chatHistory } = params;

    if (!question || !question.trim()) {
      return {
        success: false,
        error: '질문 내용을 입력해주세요.',
      };
    }

    const ai = getGeminiClient();

    let contextPrompt = '';
    if (recipe && recipe.name) {
      contextPrompt = `[현재 사용자가 보고 있는 레시피 정보]
- 요리명: ${recipe.name}
- 카테고리: ${recipe.category || '기타'}
- 예상시간: ${recipe.cookingTimeMinutes ? `${recipe.cookingTimeMinutes}분` : '정보 없음'} / 난이도: ${recipe.difficulty || '보통'}
- 재료 목록:
${recipe.ingredients || '(등록된 재료 없음)'}
- 조리 순서:
${recipe.method || '(등록된 조리 순서 없음)'}
${recipe.userNotes ? `- 사용자의 나만의 메모: ${recipe.userNotes}` : ''}

[사용자의 상황]: 사용자는 위의 '${recipe.name}' 요리를 하거나 준비 중이며, 이 레시피와 관련된 질문을 하고 있습니다.`;
    } else {
      contextPrompt = `[모드]: 일반 요리 및 레시피 상담 모드 (특정 레시피가 지정되지 않은 일반 질문)`;
    }

    let conversationPrompt = `${contextPrompt}\n\n`;

    if (chatHistory && chatHistory.length > 0) {
      conversationPrompt += `[이전 대화 내역]\n`;
      chatHistory.forEach((c) => {
        conversationPrompt += `${c.role === 'user' ? '사용자' : 'AI 요리사'}: ${c.text}\n`;
      });
      conversationPrompt += `\n`;
    }

    conversationPrompt += `[사용자의 새 질문]: ${question.trim()}

[답변 가이드라인]:
1. 20년 경력의 친절하고 전문적인 홈쿡 마스터 셰프 입장에서 한국어로 명확하고 실용적인 조언을 해주세요.
2. 대체 재료, 계량 조절, 불 조절, 간 맞추기(짜거나 매울 때 등), 보관법, 요리 추천 등 사용자의 질문에 직접적인 해결책을 제시하세요.
3. 요리하면서 모바일 화면으로 빠르게 읽기 편하도록 핵심 포인트를 2~4개 문단 또는 글머리 기호로 정리해주세요. 불필요하게 장황한 서론이나 사설은 생략하세요.
4. 특정 레시피 질문인 경우, 해당 레시피의 재료와 조리법 맥락을 최대한 존중하여 조언해주세요.`;

    const response = await generateWithFallback(ai, {
      contents: conversationPrompt,
      config: {
        systemInstruction:
          '당신은 대한민국 최고의 친절하고 실용적인 20년 경력의 한식 및 홈쿡 마스터 셰프입니다. 사용자가 질문한 요리 고민(대체 재료, 망친 요리 복구, 간 맞추기, 남은 재료 활용, 맛있는 비법 등)을 즉시 해결할 수 있는 명쾌하고 쉬운 답변을 마크다운 형식으로 제공하세요.',
        temperature: 0.7,
      },
    });

    return {
      success: true,
      answer: response.text || '답변을 생성할 수 없습니다.',
    };
  } catch (error) {
    console.error('Error asking AI about recipe:', error);
    const errObj = formatAiServiceError(
      error,
      'AI 답변 생성 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
    );
    return {
      success: false,
      ...errObj,
    };
  }
}

/**
 * 4. 오늘 뭐 먹지? AI 자연어 맞춤 추천
 * @param params 사용자 프롬프트 및 후보 레시피 목록
 * @returns 추천 레시피 ID 및 추천 사유
 */
export async function recommendMenuFromCandidates(params: {
  userPrompt: string;
  candidateRecipes: Array<{ id: number; name: string; category: string; ingredients: string }>;
}): Promise<{
  success: boolean;
  recommendedRecipeId?: number | null;
  reason?: string;
  error?: string;
  details?: string;
}> {
  try {
    const { userPrompt, candidateRecipes } = params;

    if (!userPrompt || !userPrompt.trim()) {
      return {
        success: false,
        error: '추천 요청 내용을 입력해주세요.',
      };
    }

    if (!candidateRecipes || candidateRecipes.length === 0) {
      return {
        success: false,
        error: '후보 레시피 목록이 비어있습니다.',
      };
    }

    const ai = getGeminiClient();

    const prompt = `사용자가 오늘 먹을 메뉴를 고르지 못해 도움을 요청했습니다.
사용자의 요청 사항을 분석하여 [사용자의 저장된 레시피 목록] 중에서 가장 잘 어울리는 메뉴 1개를 골라 추천 이유와 함께 제시하세요.

[사용자 요청/기분/재료]: "${userPrompt.trim()}"

[사용자의 저장된 레시피 목록]:
${candidateRecipes.map((r) => `- [ID: ${r.id}] ${r.name} (${r.category}) / 주요재료: ${r.ingredients.substring(0, 80)}...`).join('\n')}

[규칙]:
1. 반드시 위의 [사용자의 저장된 레시피 목록]에 실제로 존재하는 레시피의 ID 1개만 골라야 합니다. 없는 요리를 지어내지 마세요.
2. 만약 사용자의 요청(예: "파스타")과 맞는 요리가 저장된 레시피에 전혀 없다면 recommendedRecipeId를 null로 하고 reason에 "현재 저장된 레시피에는 정확히 맞는 음식이 없지만, 가장 가까운 메뉴로 OOO을 추천합니다" 식으로 안내하세요.
3. 친절하고 입맛 돋우는 셰프 톤으로 2~3줄의 간결한 추천 이유(reason)를 작성하세요.`;

    const response = await generateWithFallback(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendedRecipeId: { type: Type.INTEGER, description: '추천할 레시피 ID (맞는 게 없으면 null)' },
            reason: { type: Type.STRING, description: '친절하고 입맛 돋우는 추천 이유 2~3문장' },
          },
          required: ['reason'],
        },
      },
    });

    interface RecommendResult {
      recommendedRecipeId?: number | null;
      reason?: string;
    }

    const parsed = safeParseGeminiJson<RecommendResult>(response.text);

    return {
      success: true,
      recommendedRecipeId: parsed.recommendedRecipeId ?? null,
      reason: parsed.reason || '오늘 식사로 딱 맞는 메뉴를 골랐습니다!',
    };
  } catch (error) {
    console.error('Error recommending menu:', error);
    const errObj = formatAiServiceError(
      error,
      'AI 메뉴 추천 중 오류가 발생했습니다.'
    );
    return {
      success: false,
      ...errObj,
    };
  }
}

/**
 * 5. 레시피 재료 기반 예상 칼로리(kcal) 분석
 * @param params recipeId, name, category, ingredients, baseServings
 * @returns 1인분 기준 및 총 예상 칼로리, 신뢰도
 */
export async function analyzeRecipeCalories(params: {
  recipeId: number;
  name: string;
  category?: string;
  ingredients: string;
  baseServings?: number;
}): Promise<{
  success: boolean;
  data?: {
    recipeId: number;
    caloriesPerServing: number;
    totalCalories: number;
    caloriesAnalyzedServings: number;
    caloriesConfidence: 'high' | 'medium' | 'low';
    calorieBreakdown?: string;
  };
  error?: string;
  details?: string;
}> {
  try {
    const { recipeId, name, category = '기타', ingredients, baseServings } = params;

    if (!name || !ingredients || !ingredients.trim()) {
      return {
        success: false,
        error: '요리 이름과 재료 정보가 필요합니다.',
      };
    }

    const ai = getGeminiClient();
    const servings =
      typeof baseServings === 'number' && baseServings >= 1
        ? Math.round(baseServings)
        : Number(baseServings) >= 1
          ? Math.round(Number(baseServings))
          : 1;

    const prompt = `당신은 한식 및 일반 가정식의 영양과 열량을 과학적이고 현실적으로 분석하는 전문 영양사입니다.
제공된 레시피 이름과 재료 목록, 기준 인분 수를 분석하여 현실적인 예상 칼로리(kcal)를 산출해주세요.

[요리 정보]
- 요리명: ${name}
- 카테고리: ${category}
- 기준 인분: ${servings}인분
- 재료 목록:
${ingredients.trim()}

[산출 및 계산 원칙 - 엄격 준수]
1. 제시된 모든 식재료(주재료, 부재료, 양념류, 기름/식용유 등)의 분량을 표준 영양 성분표를 바탕으로 합산하여 전체 레시피의 총 예상 칼로리(totalCalories)를 정수(kcal)로 계산하세요.
2. 1인분 기준 예상 칼로리(caloriesPerServing) = Math.round(totalCalories / ${servings}) 로 계산하세요.
3. 칼로리는 일반적인 한식/가정식 한 끼 또는 반찬 기준(반찬: 50~250kcal, 찌개/국: 150~450kcal, 밥/한그릇: 450~850kcal, 양식/중식: 500~950kcal 등)에 부합하는 현실적인 값이어야 합니다.
4. 재료 분량(g, 큰술, 모, 개 등)이 명확하면 confidence를 'high', 대략적인 수량만 있으면 'medium', 분량이 거의 적혀있지 않고 이름만 있으면 'low'로 지정하세요.
5. calorieBreakdown에는 주요 열량 기여 재료 2~3가지를 간략히 요약하세요 (예: "돼지고기 약 250kcal, 두부 약 90kcal").`;

    const response = await generateWithFallback(ai, {
      contents: prompt,
      config: {
        systemInstruction: 'You are an expert culinary nutritionist analyzing recipe calories in Korean.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            caloriesPerServing: {
              type: Type.INTEGER,
              description: '1인분 기준 예상 칼로리 (kcal 정수)',
            },
            totalCalories: {
              type: Type.INTEGER,
              description: '레시피 전체 총 예상 칼로리 (kcal 정수)',
            },
            caloriesConfidence: {
              type: Type.STRING,
              enum: ['high', 'medium', 'low'],
              description: '분석 신뢰도',
            },
            calorieBreakdown: {
              type: Type.STRING,
              description: '주요 열량 원천 재료 요약',
            },
          },
          required: ['caloriesPerServing', 'totalCalories', 'caloriesConfidence'],
        },
      },
    });

    interface RawCalorieResponse {
      caloriesPerServing?: number;
      totalCalories?: number;
      caloriesConfidence?: 'high' | 'medium' | 'low';
      calorieBreakdown?: string;
    }

    const parsed = safeParseGeminiJson<RawCalorieResponse>(response.text);

    let calPerServing = Number(parsed.caloriesPerServing);
    let totalCal = Number(parsed.totalCalories);

    if (!calPerServing || isNaN(calPerServing) || calPerServing <= 0) {
      if (totalCal && totalCal > 0) {
        calPerServing = Math.round(totalCal / servings);
      } else {
        calPerServing = 350; // fallback reasonable average
      }
    }

    if (!totalCal || isNaN(totalCal) || totalCal <= 0) {
      totalCal = calPerServing * servings;
    }

    return {
      success: true,
      data: {
        recipeId,
        caloriesPerServing: Math.round(calPerServing),
        totalCalories: Math.round(totalCal),
        caloriesAnalyzedServings: servings,
        caloriesConfidence: parsed.caloriesConfidence || 'medium',
        calorieBreakdown: parsed.calorieBreakdown || undefined,
      },
    };
  } catch (error) {
    console.error('Error analyzing recipe calories:', error);
    const errObj = formatAiServiceError(
      error,
      '레시피 칼로리 분석 중 오류가 발생했습니다.'
    );
    return {
      success: false,
      ...errObj,
    };
  }
}

