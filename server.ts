/**
 * @file server.ts
 * @description Express 및 Vite 통합 풀스택 서버.
 * Gemini API를 활용한 외부 레시피 분석, 사진 OCR, Q&A 및 추천 엔드포인트 제공.
 * 핵심 비즈니스 로직은 lib/geminiService.ts를 공유합니다.
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import {
  importRecipeFromTextOrUrl,
  importRecipeFromImage,
  askChefAboutRecipe,
  recommendMenuFromCandidates,
  analyzeRecipeCalories,
  getGeminiClient,
} from './lib/geminiService';

// 환경 변수 로드 (로컬 개발 환경)
dotenv.config();

/**
 * Express 애플리케이션 및 개발/프로덕션 서버 초기화
 */
async function startServer(): Promise<void> {
  const app = express();
  const PORT = 3000;

  // JSON 바디 파서 미들웨어 (최대 10MB)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  /**
   * 헬스 체크 엔드포인트
   */
  app.get('/api/health', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  /**
   * AI 진단 엔드포인트 (로컬 개발 서버용)
   */
  app.get('/api/ai/diagnostic', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    const apiKey = process.env.GEMINI_API_KEY;
    const isApiKeyConfigured = Boolean(apiKey && apiKey.trim().length > 0);
    let geminiModuleLoaded = false;
    let clientInitializationSuccess = false;
    let errorDetail: string | undefined;

    try {
      if (isApiKeyConfigured) {
        const client = getGeminiClient();
        if (client) {
          clientInitializationSuccess = true;
        }
      }
      geminiModuleLoaded = true;
    } catch (sdkError) {
      console.error('Gemini SDK diagnostic error in server.ts:', sdkError);
      errorDetail = sdkError instanceof Error ? sdkError.message : String(sdkError);
    }

    res.status(200).json({
      success: true,
      environment: 'express-local',
      geminiApiKeyConfigured: isApiKeyConfigured,
      geminiModuleLoaded,
      clientInitializationSuccess,
      model: 'gemini-3.7-flash',
      timestamp: new Date().toISOString(),
      ...(errorDetail ? { details: errorDetail } : {}),
    });
  });

  /**
   * 외부 레시피 파싱 및 추출 엔드포인트 (URL / 텍스트)
   */
  app.post('/api/ai/import-recipe', async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const { url, text, requestId } = req.body as {
        url?: string;
        text?: string;
        requestId?: string;
      };
      if (!url && !text) {
        res.status(400).json({ success: false, error: 'URL 또는 텍스트 중 하나를 입력해주세요.' });
        return;
      }

      const result = await importRecipeFromTextOrUrl({ url, text, requestId });
      if (!result.success) {
        res.status(500).json(result);
        return;
      }
      res.status(200).json(result);
    } catch (error) {
      console.error('Error in /api/ai/import-recipe:', error);
      res.status(500).json({
        success: false,
        error: '레시피 분석 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * AI 레시피 및 일반 요리 질의응답 엔드포인트
   */
  app.post('/api/ai/ask-recipe', async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const { recipe, question, chatHistory } = req.body;
      if (!question || !question.trim()) {
        res.status(400).json({ success: false, error: '질문 내용을 입력해주세요.' });
        return;
      }

      const result = await askChefAboutRecipe({ recipe, question, chatHistory });
      if (!result.success) {
        res.status(500).json(result);
        return;
      }
      res.status(200).json(result);
    } catch (error) {
      console.error('Error in /api/ai/ask-recipe:', error);
      res.status(500).json({
        success: false,
        error: 'AI 답변 생성 중 문제가 발생했습니다.',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * 사진/이미지(요리책, 포장지, 손글씨 메모, 캡처 등)에서 레시피 추출 엔드포인트
   */
  app.post('/api/ai/import-recipe-image', async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const { imageBase64, mimeType, requestId } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        requestId?: string;
      };

      if (!imageBase64 || !imageBase64.trim()) {
        res.status(400).json({ success: false, error: '이미지 데이터(Base64)가 필요합니다.' });
        return;
      }

      const result = await importRecipeFromImage({ imageBase64, mimeType, requestId });
      if (!result.success) {
        res.status(500).json(result);
        return;
      }
      res.status(200).json(result);
    } catch (error) {
      console.error('Error in /api/ai/import-recipe-image:', error);
      res.status(500).json({
        success: false,
        error: '사진에서 레시피를 분석하는 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * 오늘 뭐 먹지 - AI 자연어 추천 엔드포인트
   */
  app.post('/api/ai/recommend-menu', async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const { userPrompt, candidateRecipes } = req.body;
      if (!userPrompt || !userPrompt.trim()) {
        res.status(400).json({ success: false, error: '추천 요청 내용을 입력해주세요.' });
        return;
      }
      if (!candidateRecipes || candidateRecipes.length === 0) {
        res.status(400).json({ success: false, error: '후보 레시피 목록이 비어있습니다.' });
        return;
      }

      const result = await recommendMenuFromCandidates({ userPrompt, candidateRecipes });
      if (!result.success) {
        res.status(500).json(result);
        return;
      }
      res.status(200).json(result);
    } catch (error) {
      console.error('Error in /api/ai/recommend-menu:', error);
      res.status(500).json({
        success: false,
        error: 'AI 메뉴 추천 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * 레시피 칼로리(kcal) 분석 엔드포인트
   */
  app.post('/api/ai/analyze-calories', async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const { recipeId, name, category, ingredients, baseServings } = req.body;
      if (!name || !ingredients || !ingredients.trim()) {
        res.status(400).json({ success: false, error: '요리 이름과 재료 정보가 필요합니다.' });
        return;
      }

      const result = await analyzeRecipeCalories({
        recipeId: Number(recipeId) || 0,
        name,
        category,
        ingredients,
        baseServings: Number(baseServings) >= 1 ? Number(baseServings) : 1,
      });

      if (!result.success) {
        res.status(500).json(result);
        return;
      }
      res.status(200).json(result);
    } catch (error) {
      console.error('Error in /api/ai/analyze-calories:', error);
      res.status(500).json({
        success: false,
        error: '레시피 칼로리 분석 중 오류가 발생했습니다.',
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
