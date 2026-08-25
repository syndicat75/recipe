/**
 * @file src/components/FamilyShareModal.tsx
 * @description 👨‍👩‍👧 가족 공유 공간 모달 컴포넌트.
 * 가족 공간 생성, 6자리 초대 코드/링크 복사, 가족 참여, 구성원 관리,
 * 레시피 일괄/개별 가족 공유 및 가족 전용 식단/장보기 동기화를 지원합니다.
 */

import React, { useState } from 'react';
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
} from 'lucide-react';
import { FamilySpace, FamilyUserProfile, Recipe } from '../types/recipe';
import { logger } from '../utils/logger';

interface FamilyShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: FamilyUserProfile;
  currentFamilySpace: FamilySpace | null;
  allFamilySpaces: FamilySpace[];
  userRecipes: Recipe[];
  onCreateFamilySpace: (name: string, shareExistingRecipes: boolean) => void;
  onJoinFamilySpace: (inviteCode: string, shareExistingRecipes: boolean) => void;
  onLeaveFamilySpace: (familyId: string) => void;
  onUpdateUserProfileName: (newName: string) => void;
  onShareAllMyRecipes: () => void;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

type TabType = 'status' | 'create' | 'join';

/**
 * 가족 공유 공간 관리 모달 컴포넌트
 */
export const FamilyShareModal: React.FC<FamilyShareModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  currentFamilySpace,
  allFamilySpaces,
  userRecipes,
  onCreateFamilySpace,
  onJoinFamilySpace,
  onLeaveFamilySpace,
  onUpdateUserProfileName,
  onShareAllMyRecipes,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(currentFamilySpace ? 'status' : 'create');
  const [newSpaceName, setNewSpaceName] = useState<string>('우리집 맛있는 부엌');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [shareExistingOption, setShareExistingOption] = useState<boolean>(true);
  const [isCopiedCode, setIsCopiedCode] = useState<boolean>(false);
  const [isEditingNick, setIsEditingNick] = useState<boolean>(false);
  const [nicknameInput, setNicknameInput] = useState<string>(userProfile.name);

  if (!isOpen) return null;

  /**
   * 새 가족 공간 생성 제출
   */
  const handleCreateSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!newSpaceName.trim()) {
      showToast('가족 공간 이름을 입력해주세요.', 'info');
      return;
    }
    logger.info('FamilyShareModal.handleCreateSubmit', `가족 공간 생성: ${newSpaceName}`);
    onCreateFamilySpace(newSpaceName.trim(), shareExistingOption);
    showToast(`'${newSpaceName}' 가족 공간이 개설되었습니다!`, 'success');
    setActiveTab('status');
  };

  /**
   * 초대 코드로 참여 제출
   */
  const handleJoinSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) {
      showToast('6자리 초대 코드를 입력해주세요.', 'info');
      return;
    }
    logger.info('FamilyShareModal.handleJoinSubmit', `초대 코드 참여: ${code}`);
    onJoinFamilySpace(code, shareExistingOption);
    setJoinCodeInput('');
  };

  /**
   * 초대 코드 클립보드 복사
   */
  const handleCopyInviteCode = async (): Promise<void> => {
    if (!currentFamilySpace) return;
    const text = `[내 입맛 레시피 - 가족 공간 초대]\n'${currentFamilySpace.name}' 가족 공간에 초대합니다!\n초대 코드: ${currentFamilySpace.inviteCode}\n앱에서 코드를 입력하고 함께 식단과 장보기를 나눠보세요.`;
    try {
      await navigator.clipboard.writeText(text);
      setIsCopiedCode(true);
      showToast('초대 코드와 안내 문구가 복사되었습니다.', 'success');
      setTimeout(() => setIsCopiedCode(false), 2500);
    } catch {
      showToast('코드 복사에 실패했습니다.', 'error');
    }
  };

  /**
   * 닉네임 수정 저장
   */
  const handleSaveNickname = (): void => {
    if (!nicknameInput.trim()) return;
    onUpdateUserProfileName(nicknameInput.trim());
    setIsEditingNick(false);
    showToast('프로필 닉네임이 변경되었습니다.', 'success');
  };

  return (
    <div
      id="family-share-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-stone-900/10">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-500 to-orange-400 text-white shadow-md shadow-rose-500/20">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-soft text-lg font-black text-stone-900">
                👨‍👩‍👧 가족 공유 공간
              </h2>
              <p className="text-xs text-stone-500">
                가족과 함께 레시피, 주간 식단표, 장보기 목록을 실시간으로 공유하세요
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Tab Navigation */}
        <div className="flex border-b border-stone-100 bg-stone-50/60 px-6 pt-2">
          {currentFamilySpace && (
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
            가족 공간 만들기
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
          {/* User Profile Bar */}
          <div className="flex items-center justify-between rounded-2xl bg-orange-50/50 border border-orange-100 p-3.5">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">{userProfile.avatar || '👨‍🍳'}</span>
              <div>
                <span className="text-[10px] font-bold text-stone-400">내 프로필</span>
                {isEditingNick ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <input
                      type="text"
                      value={nicknameInput}
                      onChange={(e) => setNicknameInput(e.target.value)}
                      className="rounded-lg border border-orange-300 bg-white px-2 py-0.5 text-xs font-bold text-stone-800"
                    />
                    <button
                      type="button"
                      onClick={handleSaveNickname}
                      className="rounded-lg bg-orange-500 px-2 py-0.5 text-xs font-bold text-white"
                    >
                      저장
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-soft text-xs sm:text-sm font-black text-stone-900">
                      {userProfile.name}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsEditingNick(true)}
                      className="text-[10px] text-stone-400 hover:text-orange-600 underline"
                    >
                      변경
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="text-right text-[11px] text-stone-500">
              공유 중인 내 레시피: <span className="font-bold text-orange-600">{userRecipes.filter((r) => r.sharedWithFamily).length}개</span>
            </div>
          </div>

          {/* Tab 1: 현재 참여 중인 가족 공간 상태 */}
          {activeTab === 'status' && currentFamilySpace && (
            <div className="space-y-5">
              {/* Space Header Card */}
              <div className="rounded-3xl border border-rose-200 bg-gradient-to-br from-rose-50/70 via-orange-50/50 to-amber-50/40 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-black text-rose-700 mb-1">
                      <Heart className="h-3 w-3 fill-rose-500 text-rose-500" />
                      참여 중
                    </div>
                    <h3 className="font-soft text-xl font-black text-stone-900">
                      {currentFamilySpace.name}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => onLeaveFamilySpace(currentFamilySpace.familyId)}
                    className="flex items-center gap-1 rounded-xl bg-white border border-stone-200 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:border-rose-200 active:scale-95 transition-all"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>나가기</span>
                  </button>
                </div>

                {/* Invite Code Box */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-2xl bg-white p-4 border border-rose-100 shadow-xs">
                  <div>
                    <span className="text-[10px] font-bold text-stone-400">초대 코드</span>
                    <p className="font-mono text-base font-black text-orange-600 tracking-wider">
                      {currentFamilySpace.inviteCode}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyInviteCode}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 font-soft text-xs font-bold text-white shadow-sm hover:bg-orange-600 active:scale-95 transition-all"
                  >
                    {isCopiedCode ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{isCopiedCode ? '복사 완료' : '초대 코드 복사'}</span>
                  </button>
                </div>
              </div>

              {/* Members List */}
              <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-xs space-y-3">
                <h4 className="font-soft text-xs font-bold text-stone-700">
                  가족 구성원 ({currentFamilySpace.members.length}명)
                </h4>

                <div className="space-y-2">
                  {currentFamilySpace.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-xl bg-stone-50/80 p-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{member.avatar || '👤'}</span>
                        <div>
                          <p className="font-soft text-xs font-bold text-stone-900">
                            {member.name} {member.id === userProfile.id ? '(나)' : ''}
                          </p>
                          <span className="text-[10px] text-stone-400">
                            {member.role === 'owner' ? '👑 방장' : '구성원'}
                          </span>
                        </div>
                      </div>

                      {member.role === 'owner' && (
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">
                          방장
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Recipe Bulk Share Action */}
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-soft text-xs font-bold text-emerald-950">
                    내 레시피 전체를 가족과 공유하기
                  </h4>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    내가 저장한 모든 레시피를 가족 공간에 한 번에 공개합니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onShareAllMyRecipes}
                  className="rounded-xl bg-emerald-600 px-3.5 py-2 font-soft text-xs font-bold text-white hover:bg-emerald-700 active:scale-95 shadow-xs"
                >
                  전체 공유
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: 가족 공간 새로 만들기 */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="rounded-2xl border border-stone-100 bg-stone-50/60 p-4 space-y-3">
                <label className="block text-xs font-bold text-stone-800">
                  가족 공간 이름
                </label>
                <input
                  type="text"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  placeholder="예: 우리집 맛있는 부엌, 행복한 밥상"
                  className="w-full rounded-xl border border-stone-200 bg-white p-3 text-xs font-bold text-stone-900 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2.5 rounded-2xl bg-orange-50/60 p-3.5 border border-orange-100">
                <input
                  type="checkbox"
                  id="share-existing-create-chk"
                  checked={shareExistingOption}
                  onChange={(e) => setShareExistingOption(e.target.checked)}
                  className="h-4 w-4 rounded text-orange-600 focus:ring-orange-500"
                />
                <label htmlFor="share-existing-create-chk" className="text-xs font-medium text-stone-700">
                  내가 가진 기존 레시피들도 가족 공간에 함께 공유하기
                </label>
              </div>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 p-3.5 font-soft text-xs font-black text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-rose-600 active:scale-95 transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>새 가족 공간 개설하기</span>
              </button>
            </form>
          )}

          {/* Tab 3: 초대 코드로 참여 */}
          {activeTab === 'join' && (
            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div className="rounded-2xl border border-stone-100 bg-stone-50/60 p-4 space-y-3">
                <label className="block text-xs font-bold text-stone-800">
                  가족에게 받은 6자리 초대 코드
                </label>
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="예: FAM-8X2K9L 또는 6자리 코드"
                  className="w-full rounded-xl border border-stone-200 bg-white p-3 font-mono text-sm font-bold tracking-wider text-stone-900 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2.5 rounded-2xl bg-orange-50/60 p-3.5 border border-orange-100">
                <input
                  type="checkbox"
                  id="share-existing-join-chk"
                  checked={shareExistingOption}
                  onChange={(e) => setShareExistingOption(e.target.checked)}
                  className="h-4 w-4 rounded text-orange-600 focus:ring-orange-500"
                />
                <label htmlFor="share-existing-join-chk" className="text-xs font-medium text-stone-700">
                  참여하면서 내 레시피도 가족 공간에 함께 공유하기
                </label>
              </div>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 p-3.5 font-soft text-xs font-black text-white shadow-md shadow-orange-500/20 hover:bg-orange-600 active:scale-95 transition-all"
              >
                <UserPlus className="h-4 w-4" />
                <span>가족 공간 참여하기</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
