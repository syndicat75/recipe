/**
 * @file src/components/FamilyShareModal.tsx
 * @description Cloud Firestore 기반 👨‍👩‍👧 가족 공유 공간 관리 모달 컴포넌트
 * 
 * 주요 기능:
 * 1. Google 로그인 필수 안내 (비로그인 사용자 대상 친절한 로그인 유도)
 * 2. 신규 가족 공간 개설 (암호학적 고유 초대 코드 생성)
 * 3. 초대 코드 및 공유 링크를 통한 실시간 가족 공간 참여
 * 4. Firestore 실시간 구성원 목록, 공유 레시피, 식단, 장보기 통계 표시
 * 5. 우리 가족 공유 레시피 목록 뷰어 및 공유 관리
 * 6. 프로필 닉네임/아바타 Firestore 동기화
 * 7. 방장 권한 위임(Ownership Transfer), 가족 나가기, 가족 공간 안전 삭제
 */

import React, { useState, useMemo } from 'react';
import { User } from 'firebase/auth';
import {
  X,
  Users,
  UserPlus,
  Copy,
  Check,
  Crown,
  Share2,
  LogOut,
  Sparkles,
  ShieldCheck,
  Lock,
  Plus,
  ArrowRight,
  Heart,
  Utensils,
  Calendar,
  ShoppingCart,
  Trash2,
  AlertTriangle,
  Loader2,
  UserCheck,
} from 'lucide-react';
import {
  FamilySpaceDoc,
  FamilyMemberDoc,
  UserFamilyProfileDoc,
  FamilyMealPlanEntryDoc,
  FamilyShoppingItemDoc,
} from '../types/family';
import { Recipe } from '../types/recipe';
import { FirebaseAuthUser } from '../types/firebase';
import { logger } from '../utils/logger';

interface FamilyShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: FirebaseAuthUser | User | null;
  onLogin: () => void;
  familyProfile: UserFamilyProfileDoc | null;
  activeFamily: FamilySpaceDoc | null;
  members: FamilyMemberDoc[];
  sharedRecipeIds: Set<number>;
  familyMealPlanEntries: FamilyMealPlanEntryDoc[];
  familyShoppingItems: FamilyShoppingItemDoc[];
  allRecipes: Recipe[];
  isFamilyOwner: boolean;
  isSyncing: boolean;
  syncError: string | null;
  isCreating: boolean;
  isJoining: boolean;
  isLeaving: boolean;
  onCreateFamily: (name: string, creatorAvatar?: string) => Promise<FamilySpaceDoc>;
  onJoinFamily: (inviteCode: string, userAvatar?: string) => Promise<{ familyId: string; familyName: string }>;
  onLeaveFamily: () => Promise<void>;
  onUnshareRecipe: (recipeId: number) => Promise<void>;
  onTransferOwnership: (newOwnerUid: string) => Promise<void>;
  onDeleteFamilySpace: () => Promise<void>;
  onUpdateProfile: (name: string, avatar: string) => Promise<void>;
  onSelectRecipe: (recipe: Recipe) => void;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

type TabType = 'status' | 'recipes' | 'create' | 'join';

const AVATAR_OPTIONS = ['👨‍🍳', '👩‍🍳', '👑', '🥑', '🍳', '🥗', '🍲', '🍓', '🥕', '🍕', '🍰', '🐶'];

/**
 * 가족 공유 공간 관리 모달 컴포넌트
 */
export const FamilyShareModal: React.FC<FamilyShareModalProps> = ({
  isOpen,
  onClose,
  user,
  onLogin,
  familyProfile,
  activeFamily,
  members,
  sharedRecipeIds,
  familyMealPlanEntries,
  familyShoppingItems,
  allRecipes,
  isFamilyOwner,
  isSyncing,
  syncError,
  isCreating,
  isJoining,
  isLeaving,
  onCreateFamily,
  onJoinFamily,
  onLeaveFamily,
  onUnshareRecipe,
  onTransferOwnership,
  onDeleteFamilySpace,
  onUpdateProfile,
  onSelectRecipe,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(activeFamily ? 'status' : 'create');
  const [newSpaceName, setNewSpaceName] = useState<string>('우리집 맛있는 부엌');
  const [selectedAvatar, setSelectedAvatar] = useState<string>(familyProfile?.avatar || '👨‍🍳');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [isCopiedCode, setIsCopiedCode] = useState<boolean>(false);
  const [isEditingNick, setIsEditingNick] = useState<boolean>(false);
  const [nicknameInput, setNicknameInput] = useState<string>(familyProfile?.name || user?.displayName || '가족 구성원');
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [selectedNewOwnerUid, setSelectedNewOwnerUid] = useState<string>('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<boolean>(false);

  // 가족 공간에 공유된 실제 레시피 객체 목록 결합
  const sharedRecipesList = useMemo(() => {
    return allRecipes.filter((r) => sharedRecipeIds.has(r.id));
  }, [allRecipes, sharedRecipeIds]);

  if (!isOpen) return null;

  // 1. 비로그인 사용자 가드 화면
  if (!user) {
    return (
      <div
        id="family-share-modal-login-guard"
        className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm animate-fade-in"
        role="dialog"
        aria-modal="true"
      >
        <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-stone-900/10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-orange-100 text-orange-600 mb-4 shadow-inner">
            <Lock className="h-8 w-8" />
          </div>
          <h2 className="font-soft text-lg font-black text-stone-900 mb-2">
            가족 공유 기능을 사용하려면 Google 로그인이 필요합니다
          </h2>
          <p className="text-xs text-stone-600 leading-relaxed mb-6">
            가족과 식단과 장보기 목록을 안전하게 실시간 공유하기 위해<br />
            로그인 후 이용해주세요.
          </p>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => {
                onLogin();
                onClose();
              }}
              className="flex items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3 font-soft text-xs font-bold text-white shadow-md shadow-orange-500/20 hover:bg-orange-600 active:scale-95 transition-all"
            >
              <Users className="h-4 w-4" />
              <span>Google 로그인으로 시작하기</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-stone-200 py-2.5 font-soft text-xs font-bold text-stone-600 hover:bg-stone-50 active:scale-95 transition-all"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    );
  }

  /**
   * 새 가족 공간 생성 제출
   */
  const handleCreateSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!newSpaceName.trim()) {
      showToast('가족 공간 이름을 입력해주세요.', 'info');
      return;
    }
    try {
      logger.info('FamilyShareModal.handleCreateSubmit', `가족 공간 생성 시작: ${newSpaceName}`);
      const space = await onCreateFamily(newSpaceName.trim(), selectedAvatar);
      showToast(`🎉 '${space.name}' 가족 공간이 개설되었습니다!`, 'success');
      setActiveTab('status');
    } catch (err: any) {
      logger.error('FamilyShareModal.handleCreateSubmit', '가족 공간 생성 실패', err);
      showToast(err.message || '가족 공간 생성에 실패했습니다.', 'error');
    }
  };

  /**
   * 초대 코드로 참여 제출
   */
  const handleJoinSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) {
      showToast('초대 코드를 입력해주세요.', 'info');
      return;
    }
    try {
      logger.info('FamilyShareModal.handleJoinSubmit', `초대 코드 참여 시작: ${code}`);
      const res = await onJoinFamily(code, selectedAvatar);
      showToast(`🎉 '${res.familyName}' 가족 공간에 참여했습니다!`, 'success');
      setJoinCodeInput('');
      setActiveTab('status');
    } catch (err: any) {
      logger.error('FamilyShareModal.handleJoinSubmit', '가족 공간 참여 실패', err);
      showToast(err.message || '가족 공간 참여에 실패했습니다.', 'error');
    }
  };

  /**
   * 초대 코드 및 링크 클립보드 복사
   */
  const handleCopyInviteLink = async (): Promise<void> => {
    if (!activeFamily) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://recipe-mu-ten.vercel.app';
    const inviteUrl = `${origin}/?familyInvite=${activeFamily.inviteCode}`;
    const text = `[내 입맛 레시피 가족 초대]\n\n'${activeFamily.name}'에 초대합니다.\n\n초대 링크:\n${inviteUrl}\n\n초대 코드:\n${activeFamily.inviteCode}`;

    try {
      await navigator.clipboard.writeText(text);
      setIsCopiedCode(true);
      showToast('초대 링크와 코드가 클립보드에 복사되었습니다!', 'success');
      setTimeout(() => setIsCopiedCode(false), 2500);
    } catch {
      showToast('초대 복사에 실패했습니다.', 'error');
    }
  };

  /**
   * 프로필 닉네임/아바타 저장
   */
  const handleSaveProfile = async (): Promise<void> => {
    if (!nicknameInput.trim()) return;
    try {
      await onUpdateProfile(nicknameInput.trim(), selectedAvatar);
      setIsEditingNick(false);
      showToast('가족 프로필이 저장되었습니다.', 'success');
    } catch (err: any) {
      showToast('프로필 저장에 실패했습니다.', 'error');
    }
  };

  /**
   * 방장 권한 위임 실행
   */
  const handleExecuteTransferOwnership = async (): Promise<void> => {
    if (!selectedNewOwnerUid) {
      showToast('대표 권한을 넘길 구성원을 선택해주세요.', 'info');
      return;
    }
    try {
      await onTransferOwnership(selectedNewOwnerUid);
      setIsTransferModalOpen(false);
      showToast('가족 대표 권한이 성공적으로 위임되었습니다.', 'success');
    } catch (err: any) {
      showToast(err.message || '권한 위임에 실패했습니다.', 'error');
    }
  };

  /**
   * 가족 공간 삭제 실행 (soft-delete)
   */
  const handleExecuteDeleteFamily = async (): Promise<void> => {
    try {
      await onDeleteFamilySpace();
      setIsDeleteConfirmOpen(false);
      showToast('가족 공간이 안전하게 삭제되었습니다.', 'info');
      setActiveTab('create');
    } catch (err: any) {
      showToast(err.message || '가족 공간 삭제에 실패했습니다.', 'error');
    }
  };

  // 다른 구성원 목록 (권한 위임 대상)
  const otherMembers = members.filter((m) => m.id !== user.uid);

  return (
    <div
      id="family-share-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-stone-900/10">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-500 to-orange-400 text-white shadow-md shadow-rose-500/20">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-soft text-lg font-black text-stone-900">
                  👨‍👩‍👧 가족 공유 공간
                </h2>
                {isSyncing && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    동기화 중
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500">
                가족과 함께 레시피, 주간 식단표, 장보기 목록을 실시간으로 공유하세요
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Tab Navigation */}
        <div className="flex border-b border-stone-100 bg-stone-50/60 px-6 pt-2">
          {activeFamily && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('status')}
                className={`border-b-2 px-4 py-2.5 font-soft text-xs font-bold transition-all ${
                  activeTab === 'status'
                    ? 'border-orange-500 text-orange-700'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                우리 가족 공간
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('recipes')}
                className={`border-b-2 px-4 py-2.5 font-soft text-xs font-bold transition-all ${
                  activeTab === 'recipes'
                    ? 'border-orange-500 text-orange-700'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                공유 레시피 ({sharedRecipeIds.size})
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`border-b-2 px-4 py-2.5 font-soft text-xs font-bold transition-all ${
              activeTab === 'create'
                ? 'border-orange-500 text-orange-700'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            새 가족 만들기
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('join')}
            className={`border-b-2 px-4 py-2.5 font-soft text-xs font-bold transition-all ${
              activeTab === 'join'
                ? 'border-orange-500 text-orange-700'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            초대 코드로 참여
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {syncError && (
            <div className="flex items-center gap-2 rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>{syncError}</span>
            </div>
          )}

          {/* User Profile Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-orange-50/50 border border-orange-100 p-3.5">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">{familyProfile?.avatar || selectedAvatar}</span>
              <div>
                <span className="text-[10px] font-bold text-stone-400">내 가족 프로필</span>
                {isEditingNick ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <input
                      type="text"
                      value={nicknameInput}
                      onChange={(e) => setNicknameInput(e.target.value)}
                      className="rounded-lg border border-orange-300 bg-white px-2 py-0.5 text-xs font-bold text-stone-800 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      className="rounded-lg bg-orange-500 px-2.5 py-0.5 text-xs font-bold text-white hover:bg-orange-600"
                    >
                      저장
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingNick(false)}
                      className="text-xs text-stone-400 hover:text-stone-600"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-soft text-xs sm:text-sm font-black text-stone-900">
                      {familyProfile?.name || user.displayName || user.email?.split('@')[0]}
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setNicknameInput(familyProfile?.name || user.displayName || '가족 구성원');
                        setIsEditingNick(true);
                      }}
                      className="text-[10px] text-orange-600 hover:underline font-bold"
                    >
                      변경
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-stone-500">아바타:</span>
              <div className="flex items-center gap-1">
                {AVATAR_OPTIONS.slice(0, 6).map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => {
                      setSelectedAvatar(av);
                      onUpdateProfile(familyProfile?.name || user.displayName || '가족 구성원', av);
                    }}
                    className={`rounded-lg p-1 text-sm hover:bg-white transition ${
                      (familyProfile?.avatar || selectedAvatar) === av ? 'bg-white shadow-xs ring-1 ring-orange-300 scale-110' : ''
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tab 1: 현재 참여 중인 가족 공간 상태 */}
          {activeTab === 'status' && activeFamily && (
            <div className="space-y-5">
              {/* Space Header Card */}
              <div className="rounded-3xl border border-rose-200 bg-gradient-to-br from-rose-50/70 via-orange-50/50 to-amber-50/40 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-black text-rose-700 mb-1">
                      <Heart className="h-3 w-3 fill-rose-500 text-rose-500" />
                      실시간 동기화 공간
                    </div>
                    <h3 className="font-soft text-xl font-black text-stone-900">
                      {activeFamily.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* 나가기 버튼 */}
                    <button
                      type="button"
                      onClick={async () => {
                        if (isFamilyOwner && otherMembers.length > 0) {
                          setIsTransferModalOpen(true);
                          return;
                        }
                        if (window.confirm(`'${activeFamily.name}' 가족 공간에서 나가시겠습니까?`)) {
                          try {
                            await onLeaveFamily();
                            showToast('가족 공간에서 나왔습니다.', 'info');
                            setActiveTab('create');
                          } catch (err: any) {
                            showToast(err.message || '가족 공간 나가기 실패', 'error');
                          }
                        }
                      }}
                      disabled={isLeaving}
                      className="flex items-center gap-1 rounded-xl bg-white border border-stone-200 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:border-rose-200 active:scale-95 transition-all disabled:opacity-50"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>{isLeaving ? '처리 중...' : '나가기'}</span>
                    </button>

                    {/* 방장 전용 삭제 메뉴 */}
                    {isFamilyOwner && (
                      <button
                        type="button"
                        onClick={() => setIsDeleteConfirmOpen(true)}
                        className="rounded-xl p-1.5 text-stone-400 hover:bg-rose-100 hover:text-rose-700 transition"
                        title="가족 공간 삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 4대 메트릭 카드 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                  <div className="rounded-2xl bg-white/80 border border-stone-100 p-3 text-center shadow-xs">
                    <span className="text-[10px] font-bold text-stone-400 flex items-center justify-center gap-1">
                      <Users className="h-3 w-3" /> 구성원
                    </span>
                    <p className="font-soft text-lg font-black text-stone-900 mt-0.5">{members.length}명</p>
                  </div>
                  <div className="rounded-2xl bg-white/80 border border-stone-100 p-3 text-center shadow-xs">
                    <span className="text-[10px] font-bold text-stone-400 flex items-center justify-center gap-1">
                      <Utensils className="h-3 w-3" /> 공유 레시피
                    </span>
                    <p className="font-soft text-lg font-black text-orange-600 mt-0.5">{sharedRecipeIds.size}개</p>
                  </div>
                  <div className="rounded-2xl bg-white/80 border border-stone-100 p-3 text-center shadow-xs">
                    <span className="text-[10px] font-bold text-stone-400 flex items-center justify-center gap-1">
                      <Calendar className="h-3 w-3" /> 이번 주 식단
                    </span>
                    <p className="font-soft text-lg font-black text-emerald-600 mt-0.5">{familyMealPlanEntries.length}개</p>
                  </div>
                  <div className="rounded-2xl bg-white/80 border border-stone-100 p-3 text-center shadow-xs">
                    <span className="text-[10px] font-bold text-stone-400 flex items-center justify-center gap-1">
                      <ShoppingCart className="h-3 w-3" /> 장보기
                    </span>
                    <p className="font-soft text-lg font-black text-sky-600 mt-0.5">{familyShoppingItems.length}개</p>
                  </div>
                </div>

                {/* Invite Code & Link Box */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl bg-white p-4 border border-rose-100 shadow-xs">
                  <div>
                    <span className="text-[10px] font-bold text-stone-400">초대 코드 및 링크</span>
                    <p className="font-mono text-base font-black text-orange-600 tracking-wider">
                      {activeFamily.inviteCode}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyInviteLink}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 font-soft text-xs font-bold text-white shadow-sm hover:bg-orange-600 active:scale-95 transition-all"
                  >
                    {isCopiedCode ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{isCopiedCode ? '초대 링크 복사됨' : '초대 링크 & 코드 복사'}</span>
                  </button>
                </div>
              </div>

              {/* Members List */}
              <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-soft text-xs font-bold text-stone-700">
                    실시간 가족 구성원 ({members.length}명)
                  </h4>
                  {isFamilyOwner && otherMembers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsTransferModalOpen(true)}
                      className="text-[11px] font-bold text-orange-600 hover:underline flex items-center gap-1"
                    >
                      <Crown className="h-3 w-3" />
                      <span>대표 권한 위임</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {members.map((member) => {
                    const isMe = member.id === user.uid;
                    return (
                      <div
                        key={member.id}
                        className={`flex items-center justify-between rounded-xl p-2.5 transition ${
                          isMe ? 'bg-orange-50/70 border border-orange-100' : 'bg-stone-50/80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl">{member.avatar || '👤'}</span>
                          <div>
                            <p className="font-soft text-xs font-bold text-stone-900 flex items-center gap-1.5">
                              {member.name}
                              {isMe && (
                                <span className="rounded bg-orange-200/80 px-1.5 py-0.2 text-[9px] font-black text-orange-800">
                                  나
                                </span>
                              )}
                            </p>
                            <span className="text-[10px] text-stone-400">
                              {member.role === 'owner' ? '👑 가족 대표 (Owner)' : '가족 구성원'}
                            </span>
                          </div>
                        </div>

                        {member.role === 'owner' && (
                          <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">
                            대표
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: 가족 공유 레시피 목록 */}
          {activeTab === 'recipes' && activeFamily && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-soft text-xs font-bold text-stone-800">
                  우리 가족이 공유한 레시피 ({sharedRecipesList.length}개)
                </h4>
                <p className="text-[11px] text-stone-500">
                  레시피 상세창에서 언제든 가족 공유를 켜고 끌 수 있습니다.
                </p>
              </div>

              {sharedRecipesList.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-stone-200 p-8 text-center text-stone-400">
                  <Utensils className="h-8 w-8 mx-auto mb-2 text-stone-300" />
                  <p className="text-xs font-bold text-stone-600">아직 가족과 공유한 레시피가 없습니다.</p>
                  <p className="text-[11px] text-stone-400 mt-1">
                    레시피 카드 또는 상세 화면에서 [👨‍👩‍👧 가족에게 공유] 버튼을 눌러보세요.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {sharedRecipesList.map((recipe) => (
                    <div
                      key={recipe.id}
                      className="flex items-center justify-between rounded-2xl border border-stone-100 bg-white p-3 shadow-xs hover:border-orange-200 transition"
                    >
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => {
                          onSelectRecipe(recipe);
                          onClose();
                        }}
                      >
                        <span className="inline-block rounded bg-orange-50 px-1.5 py-0.5 text-[9px] font-bold text-orange-700 mb-0.5">
                          {recipe.category}
                        </span>
                        <h5 className="font-soft text-xs font-bold text-stone-900 truncate">
                          {recipe.name}
                        </h5>
                      </div>

                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await onUnshareRecipe(recipe.id);
                            showToast(`'${recipe.name}' 레시피 공유가 해제되었습니다.`, 'info');
                          } catch (err: any) {
                            showToast(err.message || '공유 해제 실패', 'error');
                          }
                        }}
                        className="rounded-xl p-1.5 text-stone-400 hover:bg-stone-100 hover:text-rose-600 transition"
                        title="가족 공유 해제"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: 가족 공간 새로 만들기 */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="rounded-2xl border border-stone-100 bg-stone-50/60 p-4 space-y-3">
                <label className="block text-xs font-bold text-stone-800">
                  새 가족 공간 이름
                </label>
                <input
                  type="text"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  placeholder="예: 우리집 맛있는 부엌, 행복한 밥상"
                  className="w-full rounded-xl border border-stone-200 bg-white p-3 text-xs font-bold text-stone-900 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="rounded-2xl bg-orange-50/60 p-3.5 border border-orange-100 space-y-2">
                <span className="text-[11px] font-bold text-orange-900 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-orange-600" />
                  실시간 다기기 동기화 안내
                </span>
                <p className="text-[11px] text-stone-600 leading-relaxed">
                  가족 공간 생성 시 암호학적으로 안전한 고유 초대 코드가 발급되며, 가족 구성원은 모바일 및 PC 어디서든 초대 코드로 즉시 참여할 수 있습니다.
                </p>
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 p-3.5 font-soft text-xs font-black text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-rose-600 active:scale-95 transition-all disabled:opacity-50"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>가족 공간 생성 중...</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    <span>새 가족 공간 개설하기</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Tab 4: 초대 코드로 참여 */}
          {activeTab === 'join' && (
            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div className="rounded-2xl border border-stone-100 bg-stone-50/60 p-4 space-y-3">
                <label className="block text-xs font-bold text-stone-800">
                  가족에게 받은 초대 코드
                </label>
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="예: FAM-8X2K9L"
                  className="w-full rounded-xl border border-stone-200 bg-white p-3 font-mono text-sm font-bold tracking-wider text-stone-900 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="rounded-2xl bg-stone-50 p-3.5 border border-stone-100 text-[11px] text-stone-600 space-y-1">
                <p className="font-bold text-stone-700">📌 초대 코드가 있으신가요?</p>
                <p>가족 대표로부터 전달받은 영문/숫자 6자리 초대 코드를 입력하면 즉시 실시간 동기화 공간에 참여됩니다.</p>
              </div>

              <button
                type="submit"
                disabled={isJoining}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 p-3.5 font-soft text-xs font-black text-white shadow-md shadow-orange-500/20 hover:bg-orange-600 active:scale-95 transition-all disabled:opacity-50"
              >
                {isJoining ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>가족 공간 참여 중...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    <span>가족 공간 참여하기</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* 대표 권한 위임 확인 모달 */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="font-soft text-sm font-black text-stone-900 flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" />
              <span>가족 대표 권한 넘기기</span>
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              가족 대표 권한을 넘길 구성원을 선택해주세요. 권한 위임 후 가족 공간을 나갈 수 있습니다.
            </p>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {otherMembers.map((m) => (
                <label
                  key={m.id}
                  className={`flex items-center justify-between rounded-xl p-2.5 border cursor-pointer transition ${
                    selectedNewOwnerUid === m.id
                      ? 'border-orange-500 bg-orange-50/50'
                      : 'border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{m.avatar || '👤'}</span>
                    <span className="text-xs font-bold text-stone-800">{m.name}</span>
                  </div>
                  <input
                    type="radio"
                    name="newOwner"
                    checked={selectedNewOwnerUid === m.id}
                    onChange={() => setSelectedNewOwnerUid(m.id)}
                    className="h-4 w-4 text-orange-600"
                  />
                </label>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleExecuteTransferOwnership}
                className="flex-1 rounded-xl bg-orange-500 py-2.5 text-xs font-bold text-white hover:bg-orange-600"
              >
                대표 권한 위임
              </button>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="rounded-xl border border-stone-200 px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 가족 공간 삭제 확인 모달 */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <AlertTriangle className="h-5 w-5" />
              <span>가족 공간 삭제 확인</span>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              정말로 <strong>'{activeFamily?.name}'</strong> 가족 공간을 삭제하시겠습니까?<br />
              삭제 시 초대 코드가 비활성화되며 모든 구성원이 공간을 이용할 수 없게 됩니다.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleExecuteDeleteFamily}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-700"
              >
                가족 공간 삭제
              </button>
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="rounded-xl border border-stone-200 px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
