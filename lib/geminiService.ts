/**
 * @file lib/geminiService.ts
 * @description Gemini 모델을 활용한 레시피 AI 서비스 핵심 비즈니스 로직.
 * gemini-3.7-flash를 기본 모델로 사용하며, 모델 과부하(503/UNAVAILABLE) 발생 시
 * Exponential Backoff + Jitter 재시도 및 gemini-3.6-flash 자동 Fallback을 지원합니다.
 * Vercel Serverless Functions(api/ai/*) 및 로컬 Express 서버(server.ts)에서 공통으로 사용됩니다.
 */

import { GoogleGenAI, Type } from '@google/genai';

type GenerateContentParameters = Parameters<GoogleGenAI['models']['generateContent']>[0];
type GenerateContentResult = Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>;

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
 * Gemini 3.7 Flash 모델 과부하(503/UNAVAILABLE/High demand/429) 발생 시
 * 지수 백오프(Exponential Backoff + Jitter)로 재시도하고,
 * 지속 실패 시 gemini-3.6-flash로 자동 Fallback하는 공통 호출 함수.
 */
async function generateWithFallback(
  ai: GoogleGenAI,
  request: Omit<GenerateContentParameters, 'model'> & { model?: string }
): Promise<GenerateContentResult> {
  const primaryModel = 'gemini-3.7-flash';
  const fallbackModel = 'gemini-3.6-flash';
  const delays = [1000, 2000];

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await ai.models.generateContent({
        ...request,
        model: primaryModel,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isRetryable =
        message.includes('503') ||
        message.includes('UNAVAILABLE') ||
        message.includes('high demand') ||
        message.includes('overloaded') ||
        message.includes('RESOURCE_EXHAUSTED') ||
        message.includes('429');

      // 400, 401, 403, 404 등 클라이언트/인증 오류는 재시도 없이 즉시 throw
      if (!isRetryable) {
        throw error;
      }

      if (attempt < 2) {
        console.warn(`Gemini 3.7 Flash overloaded - retry ${attempt + 1}`);
        const jitter = Math.floor(Math.random() * 400);
        await new Promise((resolve) => setTimeout(resolve, delays[attempt] + jitter));
      } else {
        console.warn(`Gemini 3.7 Flash overloaded - retry 2 failed. Falling back to Gemini 3.6 Flash`);
      }
    }
  }

  console.info(`Falling back to ${fallbackModel}`);
  try {
    return await ai.models.generateContent({
      ...request,
      model: fallbackModel,
    });
  } catch (fallbackError) {
    console.error(`Falling back to ${fallbackModel} failed:`, fallbackError);
    throw fallbackError;
  }
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
    .slice(0, 15000);
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
 * 503/과부하/429 오류는 사용자에게 친절한 안내를 제공하고 원시 에러는 details에만 보관합니다.
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
  const isOverloadedOrRateLimited =
    errString.includes('503') ||
    errString.includes('UNAVAILABLE') ||
    errString.includes('high demand') ||
    errString.includes('overloaded') ||
    errString.includes('RESOURCE_EXHAUSTED') ||
    errString.includes('429');

  if (isOverloadedOrRateLimited) {
    return {
      error: '현재 AI 서버 이용량이 많습니다. 잠시 후 다시 시도해주세요.',
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
 * @param params url 또는 text
 * @returns 정제된 레시피 데이터
 */
export async function importRecipeFromTextOrUrl(params: {
  url?: string;
  text?: string;
}): Promise<{
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  details?: string;
}> {
  try {
    const { url, text } = params;
    if (!url && !text) {
      return {
        success: false,
        error: 'URL 또는 텍스트 중 하나를 입력해주세요.',
      };
    }

    const ai = getGeminiClient();
    let sourceContent = '';

    if (url && url.trim()) {
      try {
        const fetchRes = await fetch(url.trim(), {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          signal: AbortSignal.timeout(10000),
        });

        if (fetchRes.ok) {
          const html = await fetchRes.text();
          const cleanedText = cleanHtmlText(html);
          sourceContent = `[웹페이지 URL: ${url}]\n${cleanedText}`;
        } else {
          sourceContent = `[URL: ${url}] (웹페이지 직접 조회 실패, URL 힌트 기반으로 추출)`;
        }
      } catch (fetchErr) {
        console.warn('URL Fetching failed, fallback to text prompt:', fetchErr);
        sourceContent = `[URL: ${url}] (웹페이지 접속이 제한되었습니다. 힌트 기반으로 유추해주세요.)`;
      }
    }

    if (text && text.trim()) {
      sourceContent += (sourceContent ? '\n\n' : '') + `[사용자 입력 텍스트]:\n${text.trim()}`;
    }

    const prompt = `당신은 대한민국 최고의 요리 연구가이자 레시피 정리 전문가입니다.
제공된 요리 레시피 원본 내용 또는 웹페이지 텍스트를 분석하여 사용자가 바로 요리할 수 있도록 깔끔하고 정확한 JSON 형식으로 정제해주세요.

[분석할 원본 내용]:
${sourceContent}

[작성 규칙]:
1. name: 한국어 표준 음식명 (예: 김치찌개, 소고기 미역국, 계란말이 등)
2. category: 반드시 다음 7개 중 하나만 선택: '반찬', '소스·양념', '국·찌개', '중식·양식', '밥·한그릇', '계란요리', '기타'
3. icon: 해당 요리와 가장 잘 어울리는 대표 단일 이모지 (예: 🍳, 🥘, 🥗, 🥣, 🍽️, 🍛, 🍚, 🥪, 🍜, 🥩 등)
4. baseServings: 기준 인분 수 (명시 없으면 2)
5. ingredients: 재료 및 분량을 줄바꿈(\\n)으로 구분된 하나의 문자열로 작성
6. method: 조리 순서를 1단계부터 알기 쉽게 번호와 줄바꿈(\\n)으로 구분된 하나의 문자열로 작성
7. cookingTimeMinutes: 예상 조리시간(분 단위 정수, 1~180)
8. difficulty: '쉬움', '보통', '어려움' 중 하나
9. tips: 이 요리를 더 맛있게 만들 수 있는 비법이나 주의점 (1~2문장)`;

    const response = await generateWithFallback(ai, {
      contents: prompt,
      config: {
        systemInstruction: 'You are an expert Korean chef and culinary data parser.',
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
            baseServings: { type: Type.INTEGER, description: '기준 인분 수 (기본 2)' },
            ingredients: { type: Type.STRING, description: '줄바꿈으로 구분된 재료 목록' },
            method: { type: Type.STRING, description: '줄바꿈으로 구분된 조리 순서' },
            cookingTimeMinutes: { type: Type.INTEGER, description: '예상 조리시간 (분)' },
            difficulty: { type: Type.STRING, description: '난이도 (쉬움, 보통, 어려움)' },
            tips: { type: Type.STRING, description: '조리 꿀팁 및 조언' },
          },
          required: ['name', 'category', 'icon', 'ingredients', 'method', 'cookingTimeMinutes', 'difficulty'],
        },
      },
    });

    const parsedJson = safeParseGeminiJson<Record<string, unknown>>(response.text);
    return {
      success: true,
      data: parsedJson,
    };
  } catch (error) {
    console.error('Error importing recipe from text/url:', error);
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
 * @param params imageBase64 및 mimeType
 * @returns 추출된 구조화 레시피 데이터
 */
export async function importRecipeFromImage(params: {
  imageBase64?: string;
  mimeType?: string;
}): Promise<{
  success: boolean;
  recipe?: Record<string, unknown>;
  error?: string;
  details?: string;
}> {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = params;

    if (!imageBase64 || !imageBase64.trim()) {
      return {
        success: false,
        error: '이미지 데이터가 필요합니다.',
      };
    }

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
5. 카테고리는 다음 7개 중 가장 적절한 1개를 선택하세요: '반찬', '소스·양념', '국·찌개', '중식·양식', '밥·한그릇', '계란요리', '기타'
6. 기준 인분 정보가 사진에 명시되어 있다면 baseServings(숫자)로 추출하고, 없으면 2로 지정하세요.
7. 재료(ingredients)는 줄바꿈(\\n)으로 구분된 하나의 문자열로 작성하세요. (예: "돼지고기 150g\\n신김치 1/4포기\\n두부 1/2모")
8. 조리법(method)은 각 단계를 번호와 줄바꿈(\\n)으로 구분하여 작성하세요.`;

    const response = await generateWithFallback(ai, {
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
            baseServings: { type: Type.INTEGER, description: '사진에 적힌 기준 인분 수 (명시 없으면 2)' },
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
    });

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

    return {
      success: true,
      recipe: {
        name: parsedData.name || '가져온 레시피',
        category: parsedData.category || '기타',
        icon: parsedData.icon || '🍳',
        baseServings: Number(parsedData.baseServings) || 2,
        ingredients: parsedData.ingredients || '',
        method: parsedData.method || '-',
        cookingTimeMinutes: Number(parsedData.cookingTimeMinutes) || 15,
        difficulty: parsedData.difficulty || '쉬움',
        tip: parsedData.tip || '',
        lowConfidenceFields: Array.isArray(parsedData.lowConfidenceFields) ? parsedData.lowConfidenceFields : [],
      },
    };
  } catch (error) {
    console.error('Error importing recipe from image:', error);
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
