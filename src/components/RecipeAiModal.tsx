/**
 * @file src/components/RecipeAiModal.tsx
 * @description 레시피 AI 맞춤형 Q&A 모달 컴포넌트. 현재 열람 중인 레시피의 맥락을 기반으로 셰프 AI에게 대체 재료, 비법 팁, 어울리는 반찬 등을 질문하고 답변을 메모로 저장 지원
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Sparkles,
  Send,
  Loader2,
  BookmarkPlus,
  Copy,
  Check,
  ChefHat,
  MessageCircle,
  HelpCircle,
} from 'lucide-react';
import { APP_CONFIG, CATEGORY_CONFIG } from '../config/appConfig';
import { Recipe } from '../types/recipe';
import { logger } from '../utils/logger';

interface RecipeAiModalProps {
  /** 대상 레시피 (null이면 미표시) */
  recipe: Recipe | null;
  /** 사용자 기존 메모 */
  userNote?: string;
  /** 모달 닫기 핸들러 */
  onClose: () => void;
  /** 레시피 메모 저장 핸들러 */
  onSaveNote: (recipeId: number, note: string) => void;
  /** 토스트 메시지 표시 함수 */
  showToast: (msg: string) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

/**
 * 레시피 AI 질의응답 모달 컴포넌트
 */
export const RecipeAiModal: React.FC<RecipeAiModalProps> = ({
  recipe,
  userNote = '',
  onClose,
  onSaveNote,
  showToast,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // 모달 열림 시 초기 환영 메시지 설정
  useEffect(() => {
    if (recipe) {
      logger.info('RecipeAiModal.useEffect', `AI 질문 모달 열림: ${recipe.name}`);
      setMessages([
        {
          id: 'welcome',
          role: 'model',
          text: `안녕하세요! 👨‍🍳 **'${recipe.name}'** 레시피에 대해 무엇이든 물어보세요.\n\n대체할 수 있는 재료, 불 조절 요령, 더 맛있게 만드는 셰프의 팁 등을 친절히 알려드립니다! 아래 추천 질문을 누르거나 직접 궁금한 점을 입력해보세요.`,
          timestamp: Date.now(),
        },
      ]);
      setInputValue('');
      setIsLoading(false);
    }
  }, [recipe]);

  // 새 메시지 시 스크롤 자동 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!recipe) return null;

  const categoryMeta = CATEGORY_CONFIG[recipe.category] || CATEGORY_CONFIG['기타'];

  /**
   * 질문 전송 핸들러
   * @param questionText 질문 내용
   */
  const handleSendQuestion = async (questionText: string): Promise<void> => {
    const q = questionText.trim();
    if (!q || isLoading) return;

    logger.info('RecipeAiModal.handleSendQuestion', `AI 질문 전송: "${q}" (레시피: ${recipe.name})`);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: q,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      // 이전 대화 히스토리 구성
      const history = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({
          role: m.role,
          text: m.text,
        }));

      const response = await fetch(APP_CONFIG.ai.askEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipe: {
            name: recipe.name,
            category: recipe.category,
            ingredients: recipe.ingredients,
            method: recipe.method,
            userNotes: userNote || recipe.userNotes,
            cookingTimeMinutes: recipe.cookingTimeMinutes,
            difficulty: recipe.difficulty,
          },
          question: q,
          chatHistory: history,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '답변을 불러오지 못했습니다.');
      }

      const modelMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: data.answer || '답변을 생성할 수 없습니다.',
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, modelMsg]);
      logger.info('RecipeAiModal.handleSendQuestion', 'AI 답변 수신 성공');
    } catch (err) {
      logger.error('RecipeAiModal.handleSendQuestion', '질문 실패', err);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: '⚠️ 죄송합니다. 일시적인 네트워크 오류로 답변을 불러오지 못했습니다. 잠시 후 다시 질문해주세요.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * AI 답변을 레시피 메모에 저장
   * @param answerText AI 답변 텍스트
   */
  const handleSaveToRecipeNote = (answerText: string): void => {
    logger.info('RecipeAiModal.handleSaveToRecipeNote', `메모로 팁 저장: 레시피 ID ${recipe.id}`);
    const currentNote = userNote.trim();
    const newNote = currentNote
      ? `${currentNote}\n\n[AI 셰프 꿀팁]\n${answerText}`
      : `[AI 셰프 꿀팁]\n${answerText}`;

    onSaveNote(recipe.id, newNote);
    showToast('📝 AI 조언이 레시피 메모에 추가되었습니다!');
  };

  /**
   * 답변 클립보드 복사
   * @param id 메시지 ID
   * @param text 텍스트
   */
  const handleCopyText = (id: string, text: string): void => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      showToast('📋 내용이 클립보드에 복사되었습니다.');
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="aiModalTitle"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-scroll flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-2xl sm:max-h-[88vh] sm:rounded-[2rem]">
        {/* Sticky Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-orange-100 bg-[#fffaf3] px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`rounded-md px-1.5 py-0.2 text-[10px] font-black ${categoryMeta.badgeClass}`}>
                  {recipe.category}
                </span>
                <h2 id="aiModalTitle" className="font-soft text-base font-black text-stone-900 sm:text-lg">
                  {recipe.name} AI 요리사
                </h2>
              </div>
              <p className="text-[11px] font-semibold text-stone-500">
                레시피 맞춤 꿀팁 · 대체 재료 · 곁들임 추천
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-stone-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Chat Message List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 sm:p-6">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-600 text-sm shadow-xs">
                    🍳
                  </span>
                )}

                <div
                  className={`relative max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm'
                      : 'bg-stone-50 border border-stone-200/80 text-stone-800'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {/* AI Message Tools (Copy & Save to Note) */}
                  {!isUser && msg.id !== 'welcome' && (
                    <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-stone-200/60 pt-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => handleCopyText(msg.id, msg.text)}
                        className="flex items-center gap-1 rounded-lg bg-white px-2 py-1 font-bold text-stone-600 shadow-2xs hover:bg-stone-100"
                      >
                        {copiedId === msg.id ? (
                          <Check className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        <span>{copiedId === msg.id ? '복사됨' : '복사'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSaveToRecipeNote(msg.text)}
                        className="flex items-center gap-1 rounded-lg bg-amber-100 px-2 py-1 font-bold text-amber-800 shadow-2xs hover:bg-amber-200"
                        title="이 팁을 내 레시피 메모에 저장합니다"
                      >
                        <BookmarkPlus className="h-3 w-3 text-amber-700" />
                        <span>메모에 팁 추가</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs font-bold text-stone-400">
              <span className="grid h-7 w-7 place-items-center rounded-xl bg-orange-100 text-orange-600">
                🍳
              </span>
              <div className="flex items-center gap-1.5 rounded-2xl bg-stone-50 border border-stone-200 px-3.5 py-2.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-500" />
                <span>AI 셰프가 답변을 작성하고 있습니다...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Preset Question Chips */}
        <div className="shrink-0 border-t border-orange-100/80 bg-[#fffdfa] px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-1 text-[11px] font-bold text-stone-400 mb-1.5">
            <HelpCircle className="h-3.5 w-3.5" />
            <span>추천 질문 바로 물어보기:</span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {APP_CONFIG.ai.presetQuestions.map((pq) => (
              <button
                key={pq.id}
                type="button"
                disabled={isLoading}
                onClick={() => handleSendQuestion(pq.prompt)}
                className="rounded-xl border border-orange-200/90 bg-white px-2.5 py-1 text-[11px] font-bold text-stone-700 shadow-2xs transition hover:bg-orange-50 hover:text-orange-700 active:scale-95 disabled:opacity-50"
              >
                {pq.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="shrink-0 border-t border-orange-100 bg-[#fffaf3] p-3 sm:p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendQuestion(inputValue);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputValue}
              disabled={isLoading}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="예: 돼지고기 대신 닭가슴살 써도 되나요? 간장 대신 참치액 넣을 땐?"
              className="flex-1 rounded-xl border border-orange-200 bg-white px-3.5 py-2.5 text-xs text-stone-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-40"
              aria-label="질문 전송"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
