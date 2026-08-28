/**
 * @file src/hooks/useRecipeMigration.ts
 * @description 관리자 및 일반 사용자 클라우드 데이터 마이그레이션 모달 및 로직 관리 훅.
 * 사용자 확인 후 실행되며 자동 데이터 변경을 방지합니다.
 */

import { useState, useCallback, useEffect } from 'react';
import { FirebaseAuthUser, MigrationModalState, SyncStatus } from '../types/firebase';
import { Recipe } from '../types/recipe';
import { loadAllRecipes, getSavedShoppingList } from '../utils/storage';
import {
  fetchPublicRecipeCount,
  checkPublicMigrationNeeded,
  migrateAllRecipesToPublicDb,
  syncAllShoppingItemsToCloud,
  fetchCloudSummary,
  restoreDefaultSeedRecipesToPublic,
} from '../services/firestoreSync';
import { logger } from '../utils/logger';

export interface UseRecipeMigrationOptions {
  /** 현재 로그인한 사용자 */
  user: FirebaseAuthUser | null;
  /** 관리자 여부 */
  isAdmin: boolean;
  /** 현재 메모리 레시피 목록 */
  recipes: Recipe[];
  /** Google 로그인 시작 핸들러 */
  onLogin: () => void;
  /** 동기화 상태 변경자 */
  setSyncStatus: React.Dispatch<React.SetStateAction<SyncStatus>>;
  /** 토스트 알림 함수 */
  showToast: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  /** 확인 모달 열기 함수 */
  openConfirmDialog: (config: {
    title: string;
    message: string;
    confirmText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }) => void;
}

export interface UseRecipeMigrationReturn {
  /** 마이그레이션 모달 상태 */
  migrationModal: MigrationModalState;
  /** 마이그레이션 모달 상태 변경자 */
  setMigrationModal: React.Dispatch<React.SetStateAction<MigrationModalState>>;
  /** 로컬 데이터를 클라우드로 업로드 */
  handleUploadLocalToCloud: () => Promise<void>;
  /** 로컬 데이터와 클라우드 데이터 병합 */
  handleMergeLocalAndCloud: () => Promise<void>;
  /** 클라우드 데이터만 사용 */
  handleUseCloudOnly: () => void;
  /** 수동 클라우드 동기화 모달 열기 */
  handleManualOpenCloudSyncModal: () => Promise<void>;
  /** 기본 시드 레시피 복구 핸들러 */
  handleRestoreDefaultRecipes: () => Promise<void>;
}

/**
 * 클라우드 마이그레이션 관리 훅
 */
export function useRecipeMigration({
  user,
  isAdmin,
  recipes,
  onLogin,
  setSyncStatus,
  showToast,
  openConfirmDialog,
}: UseRecipeMigrationOptions): UseRecipeMigrationReturn {
  const [migrationModal, setMigrationModal] = useState<MigrationModalState>({
    isOpen: false,
    mode: 'initial',
    localRecipeCount: 0,
    cloudRecipeCount: 0,
    isMigrating: false,
  });

  // 관리자 로그인 시: 아직 공개 DB 마이그레이션을 실행하지 않았고 실제 이전 대상 데이터가 존재할 때만 제안
  useEffect(() => {
    if (!user || !isAdmin) return;

    const adminMigrationKey = `my_recipe_admin_public_migrated_${user.uid}`;
    const isAdminMigrated = localStorage.getItem(adminMigrationKey) === 'true';

    if (!isAdminMigrated) {
      const currentLocal = loadAllRecipes();
      checkPublicMigrationNeeded(user.uid, currentLocal)
        .then(({ needed, privateCount, localLegacyCount }) => {
          logger.info(
            'useRecipeMigration',
            `관리자 마이그레이션 검사: needed=${needed}, 개인=${privateCount}개, 미이전 로컬=${localLegacyCount}개`
          );
          if (needed) {
            fetchPublicRecipeCount().then((pubCount) => {
              setMigrationModal({
                isOpen: true,
                mode: 'admin_public',
                localRecipeCount: privateCount + localLegacyCount,
                cloudRecipeCount: pubCount,
                isMigrating: false,
              });
            });
          }
        })
        .catch((err) => {
          logger.error('useRecipeMigration', '공개 레시피 마이그레이션 필요 여부 검사 실패', err);
        });
    }
  }, [user, isAdmin]);

  /**
   * 클라우드 마이그레이션: 로컬 데이터 업로드
   */
  const handleUploadLocalToCloud = useCallback(async () => {
    if (!user) return;
    setMigrationModal((prev) => ({ ...prev, isMigrating: true }));
    try {
      if (isAdmin || migrationModal.mode === 'admin_public') {
        logger.info('useRecipeMigration.handleUploadLocalToCloud', '관리자 공개 DB 마이그레이션 실행');
        const currentLocal = loadAllRecipes();
        const result = await migrateAllRecipesToPublicDb(user.uid, currentLocal);

        localStorage.setItem(`my_recipe_admin_public_migrated_${user.uid}`, 'true');
        setMigrationModal((prev) => ({ ...prev, isOpen: false, isMigrating: false }));
        showToast(
          `🎉 총 ${result.totalMerged}개의 레시피가 공개 DB(/recipes)로 성공적으로 이전되었습니다!`,
          'success'
        );
        setSyncStatus('synced');
        return;
      }

      // 일반 사용자 개인 설정(장보기 등) 백업
      const currentShopping = getSavedShoppingList();
      await syncAllShoppingItemsToCloud(user.uid, currentShopping);

      localStorage.setItem(`my_recipe_migrated_${user.uid}`, 'true');
      setMigrationModal((prev) => ({ ...prev, isOpen: false, isMigrating: false }));
      showToast('🎉 개인 설정이 클라우드로 동기화되었습니다!', 'success');
      setSyncStatus('synced');
    } catch (err) {
      logger.error('useRecipeMigration.handleUploadLocalToCloud', '마이그레이션 실패', err);
      showToast('마이그레이션 중 오류가 발생했습니다. 다시 시도해 주세요.', 'error');
      setMigrationModal((prev) => ({ ...prev, isMigrating: false }));
    }
  }, [user, isAdmin, migrationModal.mode, showToast, setSyncStatus]);

  /**
   * 클라우드 마이그레이션: 로컬과 클라우드 병합
   */
  const handleMergeLocalAndCloud = useCallback(async () => {
    if (!user) return;
    setMigrationModal((prev) => ({ ...prev, isMigrating: true }));
    try {
      if (isAdmin || migrationModal.mode === 'admin_public') {
        const currentLocal = loadAllRecipes();
        const result = await migrateAllRecipesToPublicDb(user.uid, currentLocal);
        localStorage.setItem(`my_recipe_admin_public_migrated_${user.uid}`, 'true');
        setMigrationModal((prev) => ({ ...prev, isOpen: false, isMigrating: false }));
        showToast(
          `🎉 총 ${result.totalMerged}개의 레시피가 공개 DB(/recipes)로 성공적으로 병합되었습니다!`,
          'success'
        );
        setSyncStatus('synced');
        return;
      }
      setMigrationModal((prev) => ({ ...prev, isOpen: false, isMigrating: false }));
    } catch (err) {
      logger.error('useRecipeMigration.handleMergeLocalAndCloud', '병합 실패', err);
      showToast('레시피 병합 중 오류가 발생했습니다.', 'error');
      setMigrationModal((prev) => ({ ...prev, isMigrating: false }));
    }
  }, [user, isAdmin, migrationModal.mode, showToast, setSyncStatus]);

  /**
   * 클라우드 마이그레이션: 클라우드 데이터 우선 사용
   */
  const handleUseCloudOnly = useCallback(() => {
    if (!user) return;
    localStorage.setItem(`my_recipe_migrated_${user.uid}`, 'true');
    setMigrationModal((prev) => ({ ...prev, isOpen: false, isMigrating: false }));
    showToast('☁️ 클라우드에 저장된 레시피를 사용합니다.', 'info');
  }, [user, showToast]);

  /**
   * 클라우드 동기화 수동 관리 모달 열기
   */
  const handleManualOpenCloudSyncModal = useCallback(async () => {
    if (!user) {
      onLogin();
      return;
    }
    const currentLocal = loadAllRecipes();
    if (isAdmin) {
      const pubCount = await fetchPublicRecipeCount();
      const check = await checkPublicMigrationNeeded(user.uid, currentLocal);
      setMigrationModal({
        isOpen: true,
        mode: 'admin_public',
        localRecipeCount: check.privateCount + check.localLegacyCount,
        cloudRecipeCount: pubCount,
        isMigrating: false,
      });
      return;
    }
    try {
      const summary = await fetchCloudSummary(user.uid);
      setMigrationModal({
        isOpen: true,
        mode: summary.recipeCount > 0 ? 'conflict' : 'initial',
        localRecipeCount: currentLocal.length,
        cloudRecipeCount: summary.recipeCount,
        isMigrating: false,
      });
    } catch {
      setMigrationModal({
        isOpen: true,
        mode: 'initial',
        localRecipeCount: currentLocal.length,
        cloudRecipeCount: recipes.length,
        isMigrating: false,
      });
    }
  }, [user, isAdmin, onLogin, recipes.length]);

  /**
   * 관리자 전용: 기본 시드 레시피 명시적 복원 핸들러
   */
  const handleRestoreDefaultRecipes = useCallback(async () => {
    if (!isAdmin || !user) return;
    openConfirmDialog({
      title: '기본 레시피 복구',
      message:
        '공개 DB에서 누락된 기본 시드 레시피를 복원하시겠습니까? 이미 등록되어 있는 레시피는 영향을 받지 않고 그대로 보존됩니다.',
      confirmText: '기본 레시피 복구',
      isDestructive: false,
      onConfirm: async () => {
        try {
          const result = await restoreDefaultSeedRecipesToPublic(user.uid);
          showToast(
            `🎉 기본 레시피 ${result.restoredCount}개가 복원되었습니다. (총 ${result.totalCount}개)`,
            'success'
          );
        } catch (err) {
          logger.error('useRecipeMigration.handleRestoreDefaultRecipes', '기본 레시피 복원 실패', err);
          showToast('기본 레시피 복원 중 오류가 발생했습니다.', 'error');
        }
      },
    });
  }, [isAdmin, user, openConfirmDialog, showToast]);

  return {
    migrationModal,
    setMigrationModal,
    handleUploadLocalToCloud,
    handleMergeLocalAndCloud,
    handleUseCloudOnly,
    handleManualOpenCloudSyncModal,
    handleRestoreDefaultRecipes,
  };
}
