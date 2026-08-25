/**
 * @file server.ts
 * @description Express 및 Vite 통합 풀스택 서버. Gemini API를 활용한 외부 레시피 분석 및 레시피 Q&A 엔드포인트 제공
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config();

/**
 * Gemini SDK 클라이언트 인스턴스
 * User-Agent 헤더를 'aistudio-build'로 설정
 */
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

/**
 * Express 애플리케이션 및 개발/프로덕션 서버 초기화
 */
async function startServer(): Promise<void> {
  const app = express();
  const PORT = 3000;

  // JSON 바디 파서 미들웨어
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  /**
   * 헬스 체크 엔드포인트
   */
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  /**
   * 외부 레시피 파싱 및 추출 엔드포인트
   * URL 또는 원본 텍스트를 전달받아 Gemini 3.7 Flash 모델로 구조화된 레시피 데이터(JSON)로 변환
   */
  app.post('/api/ai/import-recipe', async (req: Request, res: Response): Promise<void> => {
    try {
      const { url, text } = req.body as { url?: string; text?: string };

      if (!url && !text) {
        res.status(400).json({ error: 'URL 또는 텍스트 중 하나를 입력해주세요.' });
        return;
      }

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
            // HTML 태그 제거 및 텍스트 추출
            const cleanedText = html
              .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
              .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 15000); // 최대 15,000자

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
4. ingredients: 재료 및 분량을 줄바꿈(\\n)으로 구분된 하나의 문자열로 작성 (예: '돼지고기 200g\\n신김치 1/4포기\\n두부 1/2모\\n대파 1대\\n다진마늘 1큰술\\n고춧가루 1큰술\\n국간장 1큰술\\n물 500ml')
5. method: 조리 순서를 1단계부터 알기 쉽게 줄바꿈(\\n)으로 구분된 하나의 문자열로 작성 (예: '냄비에 참기름을 두르고 돼지고기와 김치를 볶습니다.\\n고기가 익으면 물 500ml를 붓고 센 불에서 끓입니다.\\n국간장, 고춧가루, 다진마늘을 넣고 중불에서 10분간 푹 끓입니다.\\n두부와 대파를 넣고 3분간 더 끓여 완성합니다.')
6. cookingTimeMinutes: 예상 조리시간(분 단위 정수, 1~180)
7. difficulty: '쉬움', '보통', '어려움' 중 하나
8. tips: 이 요리를 더 맛있게 만들 수 있는 비법이나 주의점 (1~2문장)`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
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

      const parsedJson = JSON.parse(response.text || '{}');
      res.json({ success: true, data: parsedJson });
    } catch (error) {
      console.error('Error parsing recipe with Gemini:', error);
      res.status(500).json({
        success: false,
        error: '레시피 분석 중 오류가 발생했습니다. 직접 입력하거나 텍스트를 조금 더 자세히 입력해주세요.',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * AI 레시피 및 일반 요리 질의응답 엔드포인트
   * 특정 레시피 맥락(있을 경우) 또는 일반 요리 질문을 기반으로 Gemini 3.7 Flash 모델이 맞춤형 셰프 조언을 제공
   */
  app.post('/api/ai/ask-recipe', async (req: Request, res: Response): Promise<void> => {
    try {
      const { recipe, question, chatHistory } = req.body as {
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
      };

      if (!question || !question.trim()) {
        res.status(400).json({ success: false, error: '질문 내용을 입력해주세요.' });
        return;
      }

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

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: conversationPrompt,
        config: {
          systemInstruction:
            '당신은 대한민국 최고의 친절하고 실용적인 20년 경력의 한식 및 홈쿡 마스터 셰프입니다. 사용자가 질문한 요리 고민(대체 재료, 망친 요리 복구, 간 맞추기, 남은 재료 활용, 맛있는 비법 등)을 즉시 해결할 수 있는 명쾌하고 쉬운 답변을 마크다운 형식으로 제공하세요.',
          temperature: 0.7,
        },
      });

      res.json({
        success: true,
        answer: response.text || '답변을 생성할 수 없습니다.',
      });
    } catch (error) {
      console.error('Error asking AI about recipe:', error);
      res.status(500).json({
        success: false,
        error: 'AI 답변 생성 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * 사진/이미지(요리책, 포장지, 손글씨 메모, 캡처 등)에서 레시피 추출 엔드포인트
   * 사진에 있는 정보를 있는 그대로 읽고 구조화 (상상이나 임의 창작 엄격히 금지)
   */
  app.post('/api/ai/import-recipe-image', async (req: Request, res: Response): Promise<void> => {
    try {
      const { imageBase64, mimeType = 'image/jpeg' } = req.body as {
        imageBase64?: string;
        mimeType?: string;
      };

      if (!imageBase64) {
        res.status(400).json({ error: '이미지 데이터(Base64)가 필요합니다.' });
        return;
      }

      // Base64 프리픽스(data:image/jpeg;base64,) 제거
      const cleanedBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

      const prompt = `당신은 이미지 속의 요리 레시피 텍스트를 정확하게 읽어내는 OCR 및 레시피 구조화 전문가입니다.
첨부된 사진(요리책 페이지, 손글씨 메모, 제품 포장지, 캡처본 등)을 꼼꼼히 분석하여 레시피 정보만 정확히 추출해 JSON으로 반환하세요.

[절대적인 추출 원칙 - 엄격 준수]
1. 사진에 실제로 적혀 있는 정보만 읽어서 기록하세요. 절대로 새로운 레시피를 창작하거나 임의로 수량을 개선하지 마세요.
2. 사진에 '간장'이라고만 적혀 있으면 '간장'으로만 추출하세요. 임의로 '간장 1큰술'로 추측해서 채우지 마세요.
3. 글씨가 흐리거나 잘 보이지 않는 부분은 글자 뒤에 '(확인 필요)' 또는 '?'를 붙이고, lowConfidenceFields 배열에 해당 필드명(예: 'ingredients', 'cookingTimeMinutes' 등)을 추가하세요.
4. 카테고리는 다음 중 가장 적절한 1개를 선택하세요: '반찬', '소스·양념', '국·찌개', '중식·양식', '밥·한그릇', '계란요리', '기타'
5. 기준 인분 정보가 사진에 명시되어 있다면 baseServings(숫자)로 추출하고, 없으면 2로 지정하세요.
6. 재료(ingredients)는 줄바꿈(\\n)으로 구분된 하나의 문자열로 작성하세요. (예: "돼지고기 150g\\n신김치 1/4포기\\n두부 1/2모")
7. 조리법(method)은 각 단계를 번호와 줄바꿈(\\n)으로 구분하여 작성하세요.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
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

      const rawJson = response.text;
      if (!rawJson) {
        throw new Error('AI 모델로부터 빈 응답을 받았습니다.');
      }

      const parsedData = JSON.parse(rawJson);

      res.json({
        success: true,
        recipe: parsedData,
      });
    } catch (error) {
      console.error('Error importing recipe from image:', error);
      res.status(500).json({
        success: false,
        error: '사진에서 레시피를 분석하는 중 오류가 발생했습니다. 사진이 선명한지 확인 후 다시 시도해주세요.',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * 오늘 뭐 먹지 - AI 자연어 추천 엔드포인트
   * 사용자의 기분/보유재료/상황을 바탕으로 사용자가 저장한 레시피 풀 중에서만 최적의 메뉴를 선별 추천
   */
  app.post('/api/ai/recommend-menu', async (req: Request, res: Response): Promise<void> => {
    try {
      const { userPrompt, candidateRecipes } = req.body as {
        userPrompt: string;
        candidateRecipes: Array<{ id: number; name: string; category: string; ingredients: string }>;
      };

      if (!userPrompt || !userPrompt.trim()) {
        res.status(400).json({ error: '추천 요청 내용을 입력해주세요.' });
        return;
      }

      if (!candidateRecipes || candidateRecipes.length === 0) {
        res.status(400).json({ error: '후보 레시피 목록이 비어있습니다.' });
        return;
      }

      const prompt = `사용자가 오늘 먹을 메뉴를 고르지 못해 도움을 요청했습니다.
사용자의 요청 사항을 분석하여 [사용자의 저장된 레시피 목록] 중에서 가장 잘 어울리는 메뉴 1개를 골라 추천 이유와 함께 제시하세요.

[사용자 요청/기분/재료]: "${userPrompt.trim()}"

[사용자의 저장된 레시피 목록]:
${candidateRecipes.map((r) => `- [ID: ${r.id}] ${r.name} (${r.category}) / 주요재료: ${r.ingredients.substring(0, 80)}...`).join('\n')}

[규칙]:
1. 반드시 위의 [사용자의 저장된 레시피 목록]에 실제로 존재하는 레시피의 ID 1개만 골라야 합니다. 없는 요리를 지어내지 마세요.
2. 만약 사용자의 요청(예: "파스타")과 맞는 요리가 저장된 레시피에 전혀 없다면 recommendedRecipeId를 null로 하고 reason에 "현재 저장된 레시피에는 정확히 맞는 음식이 없지만, 가장 가까운 메뉴로 OOO을 추천합니다" 식으로 안내하세요.
3. 친절하고 입맛 돋우는 셰프 톤으로 2~3줄의 간결한 추천 이유(reason)를 작성하세요.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
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

      const parsed = JSON.parse(response.text || '{}');
      res.json({
        success: true,
        recommendedRecipeId: parsed.recommendedRecipeId ?? null,
        reason: parsed.reason || '오늘 식사로 딱 맞는 메뉴를 골랐습니다!',
      });
    } catch (error) {
      console.error('Error recommending menu:', error);
      res.status(500).json({
        success: false,
        error: 'AI 메뉴 추천 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Vite 개발 미들웨어 또는 정적 파일 서빙 설정
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🍳 내 입맛 레시피 서버가 실행되었습니다: http://0.0.0.0:${PORT}`);
  });
}

startServer();
