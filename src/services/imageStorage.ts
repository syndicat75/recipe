/**
 * @file src/services/imageStorage.ts
 * @description Firebase Storage 기반 레시피 이미지 업로드, Base64 변환 및 마이그레이션 서비스.
 * Firestore 문서 용량 최적화를 위해 Base64 이미지 대신 Firebase Storage 공개 다운로드 URL을 발급/보관하며,
 * 네트워크 단절이나 스토리지 미설정 시 안전한 Fallback을 제공합니다.
 */

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { Recipe } from '../types/recipe';
import { logger } from '../utils/logger';

/**
 * 주어진 문자열이 Base64 Data URL인지 확인합니다.
 * @param str 검사할 이미지 URL 또는 데이터 문자열
 * @returns Base64 여부 (boolean)
 */
export function isBase64Image(str?: string): boolean {
  if (!str || typeof str !== 'string') return false;
  return str.startsWith('data:image/');
}

/**
 * Base64 Data URL을 브라우저 Blob 객체로 변환합니다.
 * @param base64DataUrl "data:image/jpeg;base64,..." 형식 문자열
 * @returns Blob 및 감지된 MIME 타입
 */
export function base64ToBlob(base64DataUrl: string): { blob: Blob; mimeType: string } {
  logger.debug('imageStorage.base64ToBlob', 'Base64 -> Blob 변환 시작');
  const matches = base64DataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);

  if (!matches || matches.length < 3) {
    throw new Error('유효하지 않은 Base64 이미지 포맷입니다.');
  }

  const mimeType = matches[1];
  const base64Data = matches[2];
  const byteCharacters = atob(base64Data);
  const byteArrays: Uint8Array[] = [];

  const sliceSize = 1024;
  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    byteArrays.push(new Uint8Array(byteNumbers));
  }

  const blob = new Blob(byteArrays, { type: mimeType });
  logger.debug('imageStorage.base64ToBlob', `Blob 변환 완료: 크기 ${(blob.size / 1024).toFixed(1)}KB, 타입: ${mimeType}`);
  return { blob, mimeType };
}

/**
 * 업로드 옵션 인터페이스
 */
export interface UploadImageOptions {
  /** 업로더 사용자 UID (기본: 'public') */
  uid?: string;
  /** 연관 레시피 ID (선택) */
  recipeId?: number | string;
  /** 파일명 접두사 (선택) */
  fileNamePrefix?: string;
}

/**
 * 레시피 이미지를 Firebase Storage에 업로드하고 다운로드 가능한 HTTPS URL을 반환합니다.
 * File, Blob, 또는 Base64 문자열 입력을 모두 지원합니다.
 * 
 * @param imageInput File | Blob | Base64 문자열 | 원격 HTTPS URL
 * @param options 업로드 옵션
 * @returns Firebase Storage 다운로드 URL (또는 fallback 입력값)
 */
export async function uploadRecipeImage(
  imageInput: File | Blob | string,
  options: UploadImageOptions = {}
): Promise<string> {
  logger.info('imageStorage.uploadRecipeImage', '레시피 이미지 업로드 요청');

  // 이미 일반 웹 URL(http://, https://)인 경우 그대로 반환
  if (typeof imageInput === 'string' && (imageInput.startsWith('http://') || imageInput.startsWith('https://'))) {
    logger.debug('imageStorage.uploadRecipeImage', '이미 원격 HTTPS URL입니다. 업로드 생략');
    return imageInput;
  }

  if (!storage) {
    logger.warn('imageStorage.uploadRecipeImage', 'Firebase Storage가 초기화되지 않았습니다. 원본 유지');
    return typeof imageInput === 'string' ? imageInput : '';
  }

  try {
    let blobToUpload: Blob;
    let contentType: string = 'image/jpeg';

    if (typeof imageInput === 'string') {
      if (!isBase64Image(imageInput)) {
        return imageInput;
      }
      const converted = base64ToBlob(imageInput);
      blobToUpload = converted.blob;
      contentType = converted.mimeType;
    } else if (imageInput instanceof File) {
      blobToUpload = imageInput;
      contentType = imageInput.type || 'image/jpeg';
    } else {
      blobToUpload = imageInput;
      contentType = imageInput.type || 'image/jpeg';
    }

    const uid = options.uid || 'public';
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const prefix = options.fileNamePrefix ? `${options.fileNamePrefix}_` : '';
    const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';

    const storagePath = `recipe-images/${uid}/${prefix}${timestamp}_${randomSuffix}.${extension}`;
    const storageRef = ref(storage, storagePath);

    logger.info('imageStorage.uploadRecipeImage', `Storage 업로드 진행: ${storagePath} (${(blobToUpload.size / 1024).toFixed(1)}KB)`);

    const uploadResult = await uploadBytes(storageRef, blobToUpload, {
      contentType,
      customMetadata: {
        uploadedAt: String(timestamp),
        uploaderUid: uid,
        recipeId: options.recipeId ? String(options.recipeId) : '',
      },
    });

    const downloadUrl = await getDownloadURL(uploadResult.ref);
    logger.info('imageStorage.uploadRecipeImage', `Storage 업로드 완료 -> 다운로드 URL 발급 성공`);
    return downloadUrl;
  } catch (error) {
    logger.error('imageStorage.uploadRecipeImage', 'Firebase Storage 업로드 실패. Fallback으로 원본 데이터 유지', error);
    // 업로드 실패 시 사용자 데이터 유실 방지를 위해 기존 Base64/문자열 반환
    return typeof imageInput === 'string' ? imageInput : '';
  }
}

/**
 * 기존 레시피 목록 중 Base64 이미지로 저장된 항목들을 Firebase Storage로 일괄 이전합니다 (관리자/사용자 명시적 마이그레이션)
 * 
 * @param recipes 전체 레시피 목록
 * @param options { uid, onProgress }
 * @returns { updatedRecipes, migratedCount }
 */
export async function batchMigrateRecipeImagesToStorage(
  recipes: Recipe[],
  options: {
    uid?: string;
    onProgress?: (current: number, total: number) => void;
  } = {}
): Promise<{ updatedRecipes: Recipe[]; migratedCount: number }> {
  logger.info('imageStorage.batchMigrateRecipeImagesToStorage', `Base64 이미지 스토리지 마이그레이션 시작 (대상: ${recipes.length}개)`);

  const base64Targets = recipes.filter((r) => isBase64Image(r.imageUrl));
  const total = base64Targets.length;
  let migratedCount = 0;

  if (total === 0) {
    return { updatedRecipes: recipes, migratedCount: 0 };
  }

  const updatedRecipes: Recipe[] = [];

  for (let i = 0; i < recipes.length; i++) {
    const r = recipes[i];
    if (isBase64Image(r.imageUrl)) {
      try {
        const storageUrl = await uploadRecipeImage(r.imageUrl!, {
          uid: options.uid,
          recipeId: r.id,
          fileNamePrefix: `recipe_${r.id}`,
        });

        if (storageUrl && storageUrl.startsWith('http')) {
          updatedRecipes.push({
            ...r,
            imageUrl: storageUrl,
            updatedAt: Date.now(),
          });
          migratedCount++;
        } else {
          updatedRecipes.push(r);
        }
      } catch (err) {
        logger.warn('imageStorage.batchMigrateRecipeImagesToStorage', `레시피 ID ${r.id} 이미지 업로드 실패, 건너뜀`, err);
        updatedRecipes.push(r);
      }

      if (options.onProgress) {
        options.onProgress(migratedCount, total);
      }
    } else {
      updatedRecipes.push(r);
    }
  }

  logger.info('imageStorage.batchMigrateRecipeImagesToStorage', `이미지 마이그레이션 완료: 총 ${migratedCount}개 변환`);
  return { updatedRecipes, migratedCount };
}
