/**
 * @file src/components/AiChefView.tsx
 * @description AI 요리사 전용 독립 뷰 및 레시피 연동 Q&A 대화형 화면 컴포넌트.
 * 일반 요리 질문 및 특정 레시피 컨텍스트 기반 질문을 지원하며, 퀵 질문 버튼, 메모 저장 확인 모달, 오류 처리 및 마크다운 스타일 렌더링 지원
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  BookmarkPlus,
  Copy,
  Check,
  ChefHat,
  RotateCcw,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  X,
  AlertCircle,
  WifiOff,
  BookOpen,
} from 'lucide-react';
import { APP_CONFIG, CATEGORY_CONFIG } from '../config/appConfig';
import { Recipe } from '../types/recipe';
import { logger } from '../utils/logger';
import { callAiApi } from '../utils/aiApiHelper';

interface AiChefViewProps {
  /** 현재 컨텍스트로 전달된 레시피 (선택 사항) */
  activeRecipe: Recipe | null;
  /** 전체 레시피 목록 (다른 레시피 선택용) */
  allRecipes: Recipe[];
  /** 사용자의 레시피별 메모 */
  userNotes: Record<number, string>;
  /** 레시피 컨텍스트 변경/해제 핸들러 */
  onSelectActiveRecipe: (recipe: Recipe | null) => void;
  /** 홈(레시피 목록)으로 돌아가기 핸들러 */
  onBackToHome: () => void;
  /** 레시피 메모 저장 핸들러 */
  onSaveRecipeNote: (recipeId: number, note: string) => void;
  /** 토스트 메시지 표시 함수 */
  showToast: (msg: string) => void;
  /** 확인 모달 열기 함수 */
  onOpenConfirm: (config: {
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  }) => void;
  /** 오프라인 여부 */
  isOffline?: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  isError?: boolean;
  relatedRecipeName?: string;
  relatedRecipeId?: number;
}

/**
 * AI 요리사 전용 화면 컴포넌트
 */
export const AiChefView: React.FC<AiChefViewProps> = ({
  activeRecipe,
  allRecipes,
  userNotes,
  onSelectActiveRecipe,
  onBackToHome,
  onSaveRecipeNote,
  showToast,
  onOpenConfirm,
  isOffline = false,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastQuestion, setLastQuestion] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showExamples, setShowExamples] = useState<boolean>(true);
  const [isRecipePickerOpen, setIsRecipePickerOpen] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // 레시피 변경 시 환영 메시지 재설정 또는 초기화
  useEffect(() => {
    logger.info('AiChefView', `AI 요리사 뷰 진입 (컨텍스트 레시피: ${activeRecipe ? activeRecipe.name : '일반 모드'})`);

    const welcomeText = activeRecipe
      ? `안녕하세요! 👨‍🍳 **'${activeRecipe.name}'** 요리에 대해 무엇이든 물어보세요.\n\n대체 재료, 불 조절, 간 맞추기, 더 맛있게 만드는 셰프의 비법 등을 레시피에 맞게 알려드립니다.`
      : `안녕하세요! 👨‍🍳 **내 입맛 AI 요리사**입니다.\n\n"계란과 스팸으로 뭘 만들까?", "너무 짠 국 어떻게 살리지?", "대체 재료는?" 등 요리하다 궁금한 점을 무엇이든 편하게 물어보세요!`;

    setMessages([
      {
        id: 'welcome',
        role: 'model',
        text: welcomeText,
        timestamp: Date.now(),
        relatedRecipeName: activeRecipe?.name,
        relatedRecipeId: activeRecipe?.id,
      },
    ]);
    setInputValue('');
  }, [activeRecipe?.id]);

  // 대화 목록 스크롤 맨 아래로 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  /**
   * 질문 전송 핸들러
   * @param questionText 질문 내용
   */
  const handleSendQuestion = async (questionText: string): Promise<void> => {
    const q = questionText.trim();
    if (!q || isLoading) return;

    if (isOffline) {
      showToast('⚠️ AI 요리사는 인터넷 연결이 필요합니다.');
      return;
    }

    logger.info('AiChefView.handleSendQuestion', `질문 전송: "${q}" (레시피: ${activeRecipe?.name || '일반'})`);
    setLastQuestion(q);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: q,
      timestamp: Date.now(),
      relatedRecipeName: activeRecipe?.name,
      relatedRecipeId: activeRecipe?.id,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      // 대화 히스토리 구성 (최근 6개)
      const chatHistory = messages
        .filter((m) => m.id !== 'welcome' && !m.isError)
        .slice(-6)
        .map((m) => ({
          role: m.role,
          text: m.text,
        }));

      const bodyPayload = {
        recipe: activeRecipe
          ? {
              name: activeRecipe.name,
              category: activeRecipe.category,
              ingredients: activeRecipe.ingredients,
              method: activeRecipe.method,
              userNotes: userNotes[activeRecipe.id] || activeRecipe.userNotes || '',
              cookingTimeMinutes: activeRecipe.cookingTimeMinutes,
              difficulty: activeRecipe.difficulty,
            }
          : null,
        question: q,
        chatHistory,
      };

      const data = await callAiApi<{ answer?: string }>(APP_CONFIG.ai.askEndpoint, bodyPayload);

      const modelMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: data.answer || '답변을 생성할 수 없습니다.',
        timestamp: Date.now(),
        relatedRecipeName: activeRecipe?.name,
        relatedRecipeId: activeRecipe?.id,
      };

      setMessages((prev) => [...prev, modelMsg]);
      logger.info('AiChefView.handleSendQuestion', 'AI 답변 수신 완료');
    } catch (err) {
      logger.error('AiChefView.handleSendQuestion', '답변 생성 실패', err);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: `⚠️ ${err instanceof Error ? err.message : 'AI 답변을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'}`,
        timestamp: Date.now(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 재시도 핸들러
   */
  const handleRetry = (): void => {
    if (lastQuestion) {
      logger.info('AiChefView.handleRetry', `질문 재시도: "${lastQuestion}"`);
      handleSendQuestion(lastQuestion);
    }
  };

  /**
   * 퀵 질문 버튼 클릭 핸들러
   * @param prompt 퀵 질문 텍스트
   */
  const handleQuickQuestionClick = (prompt: string): void => {
    logger.info('AiChefView.handleQuickQuestionClick', `퀵 질문 선택: "${prompt}"`);
    handleSendQuestion(prompt);
  };

  /**
   * 예시 질문 클릭 핸들러
   * @param exampleText 예시 질문 문구
   */
  const handleExampleClick = (exampleText: string): void => {
    setInputValue(exampleText);
    textareaRef.current?.focus();
  };

  /**
   * 키 입력 핸들러 (Enter 전송, Shift+Enter 줄바꿈)
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendQuestion(inputValue);
    }
  };

  /**
   * AI 답변을 레시피 메모로 저장 (확인 팝업 거친 후 저장)
   * @param answerText AI 답변 내용
   * @param recipeId 레시피 ID
   * @param recipeName 레시피 이름
   */
  const handleSaveToNoteWithConfirm = (
    answerText: string,
    recipeId: number,
    recipeName?: string
  ): void => {
    logger.info('AiChefView.handleSaveToNoteWithConfirm', `메모 저장 확인 요청: 레시피 ID ${recipeId}`);

    onOpenConfirm({
      title: '📌 요리 메모에 추가',
      message: `'${recipeName || '해당 레시피'}'의 나만의 조리 팁/메모에 이 AI 조언을 추가하시겠습니까?\n(기존 원본 레시피는 변경되지 않고 메모란에 보관됩니다.)`,
      confirmText: '메모에 추가',
      onConfirm: () => {
        const currentNote = (userNotes[recipeId] || '').trim();
        const formattedTip = `[AI 셰프 조언]\n${answerText.trim()}`;
        const newNote = currentNote ? `${currentNote}\n\n${formattedTip}` : formattedTip;

        onSaveRecipeNote(recipeId, newNote);
        showToast('요리 메모에 저장했습니다.');
      },
    });
  };

  /**
   * 답변 텍스트 클립보드 복사
   */
  const handleCopy = (id: string, text: string): void => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      showToast('📋 답변 내용이 복사되었습니다.');
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 sm:py-6">
      {/* Top Header & Breadcrumb */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-orange-100 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToHome}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 shadow-xs transition hover:bg-orange-50 hover:text-orange-700"
            title="홈으로 돌아가기"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>홈으로</span>
          </button>
          <div>
            <h1 className="flex items-center gap-2 font-soft text-xl font-black text-stone-900 sm:text-2xl">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 text-base text-white shadow-xs">
                ✨
              </span>
              <span>AI 요리사</span>
            </h1>
            <p className="text-xs text-stone-500">
              요리하다 궁금한 점을 무엇이든 물어보세요.
            </p>
          </div>
        </div>

        {/* Recipe Context Switcher / Selector */}
        <div className="relative">
          {activeRecipe ? (
            <div className="flex items-center gap-1.5 rounded-2xl border border-orange-200 bg-orange-50/90 px-3 py-1.5 text-xs font-bold text-orange-900 shadow-xs">
              <span className="text-base">{activeRecipe.icon || '🥘'}</span>
              <span className="max-w-[140px] truncate sm:max-w-[200px]">
                {activeRecipe.name}에 대해 질문 중
              </span>
              <button
                type="button"
                onClick={() => {
                  logger.info('AiChefView', '일반 질문 모드로 전환');
                  onSelectActiveRecipe(null);
                  showToast('일반 요리 질문 모드로 전환되었습니다.');
                }}
                className="ml-1 rounded-lg bg-white/80 p-1 text-stone-500 hover:bg-white hover:text-stone-900"
                title="일반 질문으로 전환"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="hidden rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-600 sm:inline-block">
                🌟 일반 요리 질문 모드
              </span>
              <button
                type="button"
                onClick={() => setIsRecipePickerOpen((prev) => !prev)}
                className="flex items-center gap-1 rounded-xl border border-orange-200 bg-white px-3 py-1.5 text-xs font-bold text-orange-700 shadow-xs hover:bg-orange-50"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>내 레시피 연결</span>
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Recipe Picker Dropdown */}
          {isRecipePickerOpen && (
            <div className="absolute right-0 top-11 z-30 w-64 rounded-2xl border border-orange-100 bg-white p-2 shadow-xl">
              <div className="px-2 py-1 text-[11px] font-bold text-stone-400">
                질문할 레시피를 선택하세요
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {allRecipes.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      onSelectActiveRecipe(r);
                      setIsRecipePickerOpen(false);
                      showToast(`'${r.name}' 레시피가 AI 질문 컨텍스트로 연결되었습니다.`);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-bold text-stone-700 transition hover:bg-orange-50"
                  >
                    <span>{r.icon || '🥘'}</span>
                    <span className="flex-1 truncate">{r.name}</span>
                    <span className="text-[10px] text-stone-400">{r.category}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Offline Alert Banner */}
      {isOffline && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-xs font-bold text-amber-900 shadow-xs">
          <WifiOff className="h-4 w-4 shrink-0 text-amber-600" />
          <span>현재 오프라인 상태입니다. AI 요리사는 인터넷 연결이 필요합니다.</span>
        </div>
      )}

      {/* Collapsible Example Prompts Box */}
      <div className="mb-4 rounded-2xl border border-orange-100/90 bg-[#fffaf3] p-3.5 sm:p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700">
            <HelpCircle className="h-4 w-4 text-orange-500" />
            <span>이런 질문을 해보세요</span>
          </div>
          <button
            type="button"
            onClick={() => setShowExamples((prev) => !prev)}
            className="flex items-center gap-1 text-[11px] font-semibold text-stone-500 hover:text-stone-700"
          >
            <span>{showExamples ? '접기' : '보기'}</span>
            {showExamples ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {showExamples && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {APP_CONFIG.ai.exampleQuestions.map((eg, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleExampleClick(eg)}
                className="rounded-xl border border-orange-200/70 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 shadow-2xs transition hover:border-orange-400 hover:bg-orange-50 hover:text-orange-900"
              >
                {eg}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chat Messages Container */}
      <div className="flex min-h-[380px] max-h-[55vh] flex-col overflow-y-auto rounded-3xl border border-orange-100 bg-white p-4 shadow-sm sm:max-h-[58vh] sm:p-6 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white shadow-xs">
                  <ChefHat className="h-5 w-5" />
                </div>
              )}

              <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[88%] sm:max-w-[80%]`}>
                {/* Speaker Label */}
                <div className="mb-1 text-[11px] font-bold text-stone-400">
                  {isUser ? '나' : '✨ AI 요리사'}
                  {msg.relatedRecipeName && (
                    <span className="ml-1.5 font-normal text-orange-600">
                      ({msg.relatedRecipeName})
                    </span>
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`rounded-2xl p-4 text-xs leading-relaxed sm:text-sm ${
                    isUser
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm rounded-tr-xs'
                      : msg.isError
                      ? 'border border-red-200 bg-red-50 text-red-800 rounded-tl-xs'
                      : 'border border-orange-100 bg-[#fffaf3] text-stone-800 shadow-xs rounded-tl-xs'
                  }`}
                >
                  <div className="whitespace-pre-wrap font-sans">
                    {msg.text}
                  </div>

                  {/* Actions for AI Message */}
                  {!isUser && !msg.isError && msg.id !== 'welcome' && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-orange-200/50 pt-2.5">
                      {/* Save to Note Button (only when related to a recipe) */}
                      {msg.relatedRecipeId && (
                        <button
                          type="button"
                          onClick={() =>
                            handleSaveToNoteWithConfirm(
                              msg.text,
                              msg.relatedRecipeId!,
                              msg.relatedRecipeName
                            )
                          }
                          className="flex items-center gap-1 rounded-lg bg-amber-100/80 px-2 py-1 text-[11px] font-bold text-amber-900 transition hover:bg-amber-200 active:scale-95"
                          title="이 조언을 해당 레시피의 나만의 메모에 추가합니다."
                        >
                          <BookmarkPlus className="h-3 w-3 text-amber-700" />
                          <span>📌 레시피 메모로 저장</span>
                        </button>
                      )}

                      {/* Copy Text Button */}
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className="flex items-center gap-1 rounded-lg bg-white/80 px-2 py-1 text-[11px] font-bold text-stone-600 transition hover:bg-white hover:text-stone-900"
                        title="답변 내용 복사"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span className="text-emerald-700">복사완료</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>복사</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Retry Button for Errors */}
                  {msg.isError && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRetry}
                        className="flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-xs font-bold text-white shadow-xs hover:bg-red-700 active:scale-95"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>다시 시도</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading Bubble */}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white shadow-xs animate-pulse">
              <ChefHat className="h-5 w-5" />
            </div>
            <div className="rounded-2xl rounded-tl-xs border border-orange-100 bg-[#fffaf3] p-4 text-xs font-bold text-orange-700 shadow-xs sm:text-sm flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-orange-600" />
              <span>✨ AI 요리사가 답변을 만들고 있습니다...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Question Chips Bar */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-extrabold text-stone-500 mr-1">
          빠른 질문:
        </span>
        {APP_CONFIG.ai.quickQuestions.map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={() => handleQuickQuestionClick(q.prompt)}
            disabled={isLoading || isOffline}
            className="rounded-xl border border-orange-200 bg-white px-2.5 py-1.5 text-xs font-bold text-stone-700 shadow-2xs transition hover:border-orange-400 hover:bg-orange-50 hover:text-orange-900 disabled:opacity-50 active:scale-95"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Chat Input Bar */}
      <div className="mt-3 rounded-3xl border border-orange-200 bg-white p-2 shadow-md focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100 transition">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendQuestion(inputValue);
          }}
          className="flex items-end gap-2"
        >
          <textarea
            ref={textareaRef}
            rows={2}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || isOffline}
            placeholder={
              isOffline
                ? '인터넷 연결이 필요합니다.'
                : activeRecipe
                ? `'${activeRecipe.name}'에 대해 궁금한 점을 입력하세요 (Enter: 전송 / Shift+Enter: 줄바꿈)`
                : '요리에 대해 궁금한 것을 물어보세요 (Enter: 전송 / Shift+Enter: 줄바꿈)'
            }
            className="flex-1 resize-none border-none bg-transparent p-2 text-xs sm:text-sm text-stone-800 outline-none placeholder:text-stone-400 disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading || isOffline}
            className="flex h-10 items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 text-xs font-black text-white shadow-sm transition hover:from-orange-600 hover:to-amber-600 disabled:opacity-40 disabled:hover:from-orange-500 active:scale-95 shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span>전송</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
