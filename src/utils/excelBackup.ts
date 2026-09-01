/**
 * @file src/utils/excelBackup.ts
 * @description 레시피 데이터의 Excel(.xlsx) 파일 내보내기(백업) 및 가져오기(복원) 핵심 유틸리티
 * 
 * - SheetJS(xlsx) 기반으로 클라이언트 사이드에서 즉시 Excel 파일 생성 및 파싱
 * - Sheet 1: '레시피' (상세 메타데이터 및 조리방법 줄바꿈 유지)
 * - Sheet 2: '재료' (레시피 ID 매핑, 재료명, 수량, 단위, 메모 정밀 분리)
 * - Sheet 3: '_metadata' (숨김 시트, 앱 식별자 및 backupVersion: 1)
 * - 파일 검증, 미리보기 통계, 3가지 중복 처리 정책(건너뛰기/덮어쓰기/새 레시피 추가), 안전 확인 및 오류 복구 지원
 */

import * as XLSX from 'xlsx';
import { Recipe } from '../types/recipe';
import { logger } from './logger';

export const EXCEL_BACKUP_VERSION = 1;
export const EXCEL_BACKUP_APP_ID = 'recipe-mu-ten';
export const EXCEL_BACKUP_FORMAT = 'recipe-excel-backup';

/**
 * Excel '레시피' 시트 행 데이터 인터페이스
 */
export interface ExcelRecipeSheetRow {
  '레시피 ID': number | string;
  '레시피명': string;
  '카테고리': string;
  '설명': string;
  '인분': number | string;
  '조리시간': string;
  '난이도': string;
  '칼로리(kcal)': string;
  '조리방법': string;
  '팁 / 메모': string;
  '대표 이미지 URL': string;
  '원본 레시피 URL': string;
  '출처': string;
  '즐겨찾기 여부': string;
  '생성일': string;
  '수정일': string;
}

/**
 * Excel '재료' 시트 행 데이터 인터페이스
 */
export interface ExcelIngredientSheetRow {
  '레시피 ID': number | string;
  '레시피명': string;
  '재료 순서': number;
  '재료명': string;
  '수량': string;
  '단위': string;
  '재료 메모': string;
}

/**
 * 파싱된 재료 구성요소
 */
export interface ParsedIngredientPart {
  name: string;
  quantity: string;
  unit: string;
  notes: string;
}

/**
 * 복원 미리보기 통계
 */
export interface ExcelRestorePreview {
  totalRecipes: number;
  totalIngredients: number;
  newRecipeCount: number;
  duplicateRecipeCount: number;
  duplicateRecipeNames: string[];
  version: number;
  createdAt?: string;
  parsedRecipes: Recipe[];
}

/**
 * 중복 레시피 처리 전략
 */
export type DuplicateStrategy = 'skip' | 'overwrite' | 'createNew';

/**
 * 복원 결과 리포트
 */
export interface ExcelRestoreResult {
  total: number;
  success: number;
  skipped: number;
  failed: number;
  failedItems: Array<{ name: string; reason: string }>;
  restoredRecipes: Recipe[];
}

/**
 * 한국어 단위 목록 (긴 문자열부터 정렬)
 */
const KNOWN_UNITS = [
  '작은술',
  '티스푼',
  '큰술',
  '스푼',
  '포기',
  '봉지',
  '꼬집',
  '적당량',
  '약간',
  '공기',
  '그릇',
  '방울',
  '조각',
  '토막',
  '인분',
  '뿌리',
  '묶음',
  '마리',
  '줄기',
  '송이',
  '그램',
  '리터',
  '밀리',
  '미리',
  '컵',
  '모',
  '대',
  '개',
  '쪽',
  '장',
  '줄',
  '알',
  '팩',
  '캔',
  '통',
  '병',
  '줌',
  'g',
  'kg',
  'ml',
  'l',
  'L',
  'cc',
  'tbsp',
  'tsp',
  'cup',
  'oz',
  'lb',
  'ea',
];

/**
 * 단일 재료 문자열을 [재료명, 수량, 단위, 메모]로 파싱합니다.
 * 예: "돼지고기 200g (찌개용)" -> { name: "돼지고기", quantity: "200", unit: "g", notes: "찌개용" }
 * 예: "다진마늘 1/2큰술" -> { name: "다진마늘", quantity: "1/2", unit: "큰술", notes: "" }
 * 예: "소금 약간" -> { name: "소금", quantity: "", unit: "약간", notes: "" }
 */
export function parseIngredientLineToParts(rawLine: string): ParsedIngredientPart {
  const line = (rawLine || '').trim();
  if (!line) {
    return { name: '', quantity: '', unit: '', notes: '' };
  }

  let text = line;
  let notes = '';

  // 1. 괄호 안의 메모 분리 (예: "돼지고기 200g (목살 또는 삼겹살)")
  const parenMatch = text.match(/\((.*?)\)/);
  if (parenMatch) {
    notes = parenMatch[1].trim();
    text = text.replace(/\(.*?\)/g, ' ').trim();
  }

  // 2. 비수량 표현 예외 (소금 약간, 후추 적당량 등)
  for (const unq of ['약간', '적당량', '취향껏', '조금', '선택']) {
    if (text.includes(unq) && !/\d/.test(text)) {
      const namePart = text.replace(unq, '').trim();
      return {
        name: namePart || text,
        quantity: '',
        unit: unq,
        notes,
      };
    }
  }

  // 3. 대분수 패턴 (예: "1 1/2큰술", "2 1/2개")
  const mixedMatch = text.match(/(.*?)(\d+\s+\d+\/\d+)\s*([^\d\s]*.*)/);
  if (mixedMatch) {
    const namePart = mixedMatch[1].trim();
    const qtyPart = mixedMatch[2].trim();
    const restPart = mixedMatch[3].trim();
    const unitMatch = matchUnit(restPart);
    return {
      name: namePart || '재료',
      quantity: qtyPart,
      unit: unitMatch.unit,
      notes: notes ? `${unitMatch.rest} ${notes}`.trim() : unitMatch.rest,
    };
  }

  // 4. 범위 수량 패턴 (예: "1~2큰술", "100~150g")
  const rangeMatch = text.match(/(.*?)(\d+(?:\.\d+)?|\d+\/\d+)\s*~\s*(\d+(?:\.\d+)?|\d+\/\d+)\s*([^\d\s]*.*)/);
  if (rangeMatch) {
    const namePart = rangeMatch[1].trim();
    const qtyPart = `${rangeMatch[2]}~${rangeMatch[3]}`;
    const restPart = rangeMatch[4].trim();
    const unitMatch = matchUnit(restPart);
    return {
      name: namePart || '재료',
      quantity: qtyPart,
      unit: unitMatch.unit,
      notes: notes ? `${unitMatch.rest} ${notes}`.trim() : unitMatch.rest,
    };
  }

  // 5. 분수 패턴 (예: "1/2모", "1/4포기")
  const fracMatch = text.match(/(.*?)(\d+\/\d+)\s*([^\d\s]*.*)/);
  if (fracMatch) {
    const namePart = fracMatch[1].trim();
    const qtyPart = fracMatch[2].trim();
    const restPart = fracMatch[3].trim();
    const unitMatch = matchUnit(restPart);
    return {
      name: namePart || '재료',
      quantity: qtyPart,
      unit: unitMatch.unit,
      notes: notes ? `${unitMatch.rest} ${notes}`.trim() : unitMatch.rest,
    };
  }

  // 6. 일반 소수점/정수 패턴 (예: "돼지고기 200g", "물 500ml", "양파 1개")
  const numMatch = text.match(/(.*?)(\d+(?:\.\d+)?)\s*([^\d\s]*.*)/);
  if (numMatch) {
    const namePart = numMatch[1].trim();
    const qtyPart = numMatch[2].trim();
    const restPart = numMatch[3].trim();
    const unitMatch = matchUnit(restPart);
    return {
      name: namePart || '재료',
      quantity: qtyPart,
      unit: unitMatch.unit,
      notes: notes ? `${unitMatch.rest} ${notes}`.trim() : unitMatch.rest,
    };
  }

  // 숫자가 없는 경우 전체를 재료명으로 간주
  return {
    name: text,
    quantity: '',
    unit: '',
    notes,
  };
}

/**
 * 텍스트 시작 부분에서 알려진 단위를 매칭합니다.
 */
function matchUnit(text: string): { unit: string; rest: string } {
  const trimmed = text.trim();
  if (!trimmed) return { unit: '', rest: '' };

  for (const unit of KNOWN_UNITS) {
    if (trimmed.toLowerCase().startsWith(unit.toLowerCase())) {
      const rest = trimmed.slice(unit.length).trim();
      return { unit, rest };
    }
  }

  // 첫 번째 공백 이전의 단어를 단위 후보로 고려
  const parts = trimmed.split(/\s+/);
  if (parts.length > 0) {
    return { unit: parts[0], rest: parts.slice(1).join(' ') };
  }

  return { unit: '', rest: trimmed };
}

/**
 * 재료 파트들을 다시 레시피 한 줄 문자열로 조합합니다.
 */
export function formatIngredientLineFromParts(part: ParsedIngredientPart): string {
  const name = (part.name || '').trim();
  const qty = (part.quantity || '').trim();
  const unit = (part.unit || '').trim();
  const notes = (part.notes || '').trim();

  if (!name && !qty && !unit) return '';

  let line = name;
  if (qty && unit) {
    // 단위가 영문(g, ml)이거나 한글인 경우 공백 처리
    line += ` ${qty}${unit}`;
  } else if (qty) {
    line += ` ${qty}`;
  } else if (unit) {
    line += ` ${unit}`;
  }

  if (notes) {
    line += ` (${notes})`;
  }

  return line.trim();
}

/**
 * 날짜 타임스탬프를 포맷팅합니다.
 */
function formatDateToKorean(val?: number | string): string {
  if (!val) return '';
  const date = typeof val === 'number' ? new Date(val) : new Date(String(val));
  if (isNaN(date.getTime())) return String(val);
  const YYYY = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, '0');
  const DD = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}`;
}

/**
 * 레시피 목록을 Excel(.xlsx) 워크북으로 변환하여 브라우저에서 다운로드합니다.
 * 
 * @param recipes 다운로드할 레시피 배열
 * @param options 선택적 옵션 (즐겨찾기, 메모 등)
 * @returns 생성된 파일명
 */
export function exportRecipesToExcel(
  recipes: Recipe[],
  options?: {
    customFileName?: string;
    bookmarkedIds?: number[];
    userNotes?: Record<number, string>;
  }
): string {
  logger.info('excelBackup.exportRecipesToExcel', `Excel 내보내기 시작: ${recipes.length}개 레시피`);

  if (!recipes || recipes.length === 0) {
    throw new Error('내보낼 레시피 데이터가 없습니다.');
  }

  const bookmarks = new Set(options?.bookmarkedIds || []);
  const notesMap = options?.userNotes || {};

  // 1. Sheet 1: '레시피' 데이터 생성
  const recipeRows: ExcelRecipeSheetRow[] = recipes.map((recipe) => {
    const isBookmarked = recipe.isBookmarked ?? bookmarks.has(recipe.id);
    const memo = recipe.userNotes || notesMap[recipe.id] || '';

    return {
      '레시피 ID': recipe.id,
      '레시피명': recipe.name || '무제 레시피',
      '카테고리': recipe.category || '기타',
      '설명': memo,
      '인분': recipe.baseServings || 1,
      '조리시간': recipe.cookingTimeMinutes ? `${recipe.cookingTimeMinutes}분` : '',
      '난이도': recipe.difficulty || '',
      '칼로리(kcal)': recipe.caloriesPerServing ? `${recipe.caloriesPerServing}` : '',
      '조리방법': recipe.method || '',
      '팁 / 메모': recipe.tip ? (memo ? `${recipe.tip}\n[메모] ${memo}` : recipe.tip) : memo,
      '대표 이미지 URL': recipe.imageUrl || '',
      '원본 레시피 URL': recipe.sourceImageUrl || '',
      '출처': recipe.syncScope === 'public' ? '공개 레시피' : recipe.isCustom ? '직접 작성' : '개인 레시피',
      '즐겨찾기 여부': isBookmarked ? 'Y' : 'N',
      '생성일': formatDateToKorean(recipe.createdAt),
      '수정일': formatDateToKorean(recipe.updatedAt),
    };
  });

  // 2. Sheet 2: '재료' 데이터 생성
  const ingredientRows: ExcelIngredientSheetRow[] = [];
  let totalIngredientsCount = 0;

  recipes.forEach((recipe) => {
    const rawIngs = (recipe.ingredients || '')
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (rawIngs.length === 0) {
      // 재료가 없는 경우 기본 1행 추가
      ingredientRows.push({
        '레시피 ID': recipe.id,
        '레시피명': recipe.name || '무제 레시피',
        '재료 순서': 1,
        '재료명': '재료 정보 없음',
        '수량': '',
        '단위': '',
        '재료 메모': '',
      });
      totalIngredientsCount += 1;
    } else {
      rawIngs.forEach((line, idx) => {
        const parts = parseIngredientLineToParts(line);
        ingredientRows.push({
          '레시피 ID': recipe.id,
          '레시피명': recipe.name || '무제 레시피',
          '재료 순서': idx + 1,
          '재료명': parts.name,
          '수량': parts.quantity,
          '단위': parts.unit,
          '재료 메모': parts.notes,
        });
        totalIngredientsCount += 1;
      });
    }
  });

  // 3. Sheet 3: '_metadata' (검증용 숨김 메타데이터)
  const nowIso = new Date().toISOString();
  const metadataRows = [
    { key: 'app', value: EXCEL_BACKUP_APP_ID },
    { key: 'backupVersion', value: String(EXCEL_BACKUP_VERSION) },
    { key: 'createdAt', value: nowIso },
    { key: 'format', value: EXCEL_BACKUP_FORMAT },
    { key: 'totalRecipes', value: String(recipes.length) },
    { key: 'totalIngredients', value: String(totalIngredientsCount) },
  ];

  // 4. 워크북 생성 및 시트 추가
  const wb = XLSX.utils.book_new();

  const wsRecipes = XLSX.utils.json_to_sheet(recipeRows);
  const wsIngredients = XLSX.utils.json_to_sheet(ingredientRows);
  const wsMetadata = XLSX.utils.json_to_sheet(metadataRows);

  // 시트별 컬럼 너비 설정
  wsRecipes['!cols'] = [
    { wch: 10 }, // 레시피 ID
    { wch: 22 }, // 레시피명
    { wch: 12 }, // 카테고리
    { wch: 25 }, // 설명
    { wch: 8 },  // 인분
    { wch: 10 }, // 조리시간
    { wch: 8 },  // 난이도
    { wch: 12 }, // 칼로리
    { wch: 45 }, // 조리방법
    { wch: 30 }, // 팁 / 메모
    { wch: 35 }, // 대표 이미지 URL
    { wch: 35 }, // 원본 레시피 URL
    { wch: 12 }, // 출처
    { wch: 12 }, // 즐겨찾기 여부
    { wch: 20 }, // 생성일
    { wch: 20 }, // 수정일
  ];

  wsIngredients['!cols'] = [
    { wch: 10 }, // 레시피 ID
    { wch: 22 }, // 레시피명
    { wch: 10 }, // 재료 순서
    { wch: 20 }, // 재료명
    { wch: 10 }, // 수량
    { wch: 10 }, // 단위
    { wch: 25 }, // 재료 메모
  ];

  XLSX.utils.book_append_sheet(wb, wsRecipes, '레시피');
  XLSX.utils.book_append_sheet(wb, wsIngredients, '재료');
  XLSX.utils.book_append_sheet(wb, wsMetadata, '_metadata');

  // 파일명 생성: recipe-backup-YYYY-MM-DD.xlsx
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const defaultFileName = `recipe-backup-${yyyy}-${mm}-${dd}.xlsx`;
  const fileName = options?.customFileName || defaultFileName;

  // 5. Excel 파일 다운로드 실행
  XLSX.writeFile(wb, fileName, { compression: true });
  logger.info('excelBackup.exportRecipesToExcel', `Excel 다운로드 완료: ${fileName}`);

  return fileName;
}

/**
 * 업로드된 Excel(.xlsx) 백업 파일을 읽고 파싱하여 유효성 검사 및 미리보기 데이터를 생성합니다.
 * 
 * @param file 사용자가 업로드한 File 객체
 * @param existingRecipes 현재 앱에 등록된 레시피 목록 (중복 체크용)
 * @returns ExcelRestorePreview 객체
 */
export async function parseAndValidateExcelBackup(
  file: File,
  existingRecipes: Recipe[]
): Promise<ExcelRestorePreview> {
  logger.info('excelBackup.parseAndValidateExcelBackup', `Excel 백업 파일 파싱 시작: ${file.name} (${file.size} bytes)`);

  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: 'array' });

  // 1. 필수 시트 존재 검증
  const sheetNames = wb.SheetNames;
  const hasRecipeSheet = sheetNames.includes('레시피');
  const hasIngredientSheet = sheetNames.includes('재료');
  const hasMetadataSheet = sheetNames.includes('_metadata');

  if (!hasRecipeSheet) {
    throw new Error('이 파일은 레시피 앱에서 생성한 정상적인 백업 파일이 아닙니다. (\'레시피\' 시트 누락)');
  }

  // 2. 메타데이터 시트 확인 (있는 경우 포맷 검증)
  let backupVersion = 1;
  let createdAt: string | undefined = undefined;

  if (hasMetadataSheet) {
    const metaDataRaw = XLSX.utils.sheet_to_json<{ key: string; value: string }>(wb.Sheets['_metadata']);
    const metaMap: Record<string, string> = {};
    metaDataRaw.forEach((row) => {
      if (row.key) metaMap[row.key] = String(row.value);
    });

    if (metaMap.format && metaMap.format !== EXCEL_BACKUP_FORMAT && metaMap.app !== EXCEL_BACKUP_APP_ID) {
      logger.warn('excelBackup', `메타데이터 포맷 불일치: ${metaMap.format}`);
    }

    if (metaMap.backupVersion) {
      backupVersion = Number(metaMap.backupVersion) || 1;
    }
    createdAt = metaMap.createdAt;
  }

  // 3. '재료' 시트 파싱 및 레시피 ID별 그룹핑
  const ingredientsByRecipeId = new Map<string, ParsedIngredientPart[]>();
  let totalIngredientsCount = 0;

  if (hasIngredientSheet) {
    const ingredientRows = XLSX.utils.sheet_to_json<any>(wb.Sheets['재료']);
    ingredientRows.forEach((row) => {
      const rawId = row['레시피 ID'] ?? row['recipeId'] ?? row['id'];
      if (rawId === undefined || rawId === null) return;
      const recipeIdKey = String(rawId).trim();

      const name = String(row['재료명'] ?? row['name'] ?? '').trim();
      if (!name || name === '재료 정보 없음') return;

      const qty = String(row['수량'] ?? row['quantity'] ?? '').trim();
      const unit = String(row['단위'] ?? row['unit'] ?? '').trim();
      const notes = String(row['재료 메모'] ?? row['notes'] ?? row['memo'] ?? '').trim();

      const part: ParsedIngredientPart = { name, quantity: qty, unit, notes };
      if (!ingredientsByRecipeId.has(recipeIdKey)) {
        ingredientsByRecipeId.set(recipeIdKey, []);
      }
      ingredientsByRecipeId.get(recipeIdKey)!.push(part);
      totalIngredientsCount += 1;
    });
  }

  // 4. '레시피' 시트 파싱
  const recipeRows = XLSX.utils.sheet_to_json<any>(wb.Sheets['레시피']);
  if (!recipeRows || recipeRows.length === 0) {
    throw new Error('이 파일은 레시피 앱에서 생성한 정상적인 백업 파일이 아닙니다. (등록된 레시피 데이터 없음)');
  }

  const existingIdSet = new Set(existingRecipes.map((r) => r.id));
  const existingNameSet = new Set(existingRecipes.map((r) => r.name.trim().toLowerCase()));

  const parsedRecipes: Recipe[] = [];
  const duplicateRecipeNames: string[] = [];
  let duplicateCount = 0;
  let newCount = 0;

  recipeRows.forEach((row, index) => {
    const rawId = row['레시피 ID'] ?? row['id'];
    const numId = Number(rawId) || Date.now() + index;
    const name = String(row['레시피명'] ?? row['name'] ?? `복원 레시피 ${index + 1}`).trim();
    const category = String(row['카테고리'] ?? row['category'] ?? '기타').trim();
    const method = String(row['조리방법'] ?? row['method'] ?? '').trim();
    const userNotes = String(row['설명'] ?? row['userNotes'] ?? row['메모'] ?? '').trim();
    const tip = String(row['팁 / 메모'] ?? row['tip'] ?? '').trim();
    const imageUrl = String(row['대표 이미지 URL'] ?? row['imageUrl'] ?? '').trim() || undefined;
    const sourceImageUrl = String(row['원본 레시피 URL'] ?? row['sourceImageUrl'] ?? '').trim() || undefined;
    const difficulty = row['난이도'] || undefined;
    const baseServings = Math.max(1, Number(row['인분'] ?? row['baseServings']) || 1);

    // 칼로리 파싱
    let caloriesPerServing: number | undefined = undefined;
    const rawCal = row['칼로리(kcal)'] ?? row['칼로리'] ?? row['caloriesPerServing'];
    if (rawCal) {
      const parsedNum = parseInt(String(rawCal).replace(/[^0-9]/g, ''), 10);
      if (!isNaN(parsedNum) && parsedNum > 0) {
        caloriesPerServing = parsedNum;
      }
    }

    // 조리시간 파싱
    let cookingTimeMinutes: number | undefined = undefined;
    const rawTime = row['조리시간'] ?? row['cookingTimeMinutes'];
    if (rawTime) {
      const parsedTime = parseInt(String(rawTime).replace(/[^0-9]/g, ''), 10);
      if (!isNaN(parsedTime) && parsedTime > 0) {
        cookingTimeMinutes = parsedTime;
      }
    }

    // 즐겨찾기
    const isBookmarked =
      row['즐겨찾기 여부'] === 'Y' ||
      row['즐겨찾기 여부'] === 'true' ||
      row['isBookmarked'] === true;

    // 재료 시트에서 재료 텍스트 조합
    const idKey = String(rawId).trim();
    const ingParts = ingredientsByRecipeId.get(idKey);
    let ingredientsText = '';

    if (ingParts && ingParts.length > 0) {
      ingredientsText = ingParts
        .map(formatIngredientLineFromParts)
        .filter(Boolean)
        .join('\n');
    } else if (row['재료'] || row['ingredients']) {
      // 재료 시트에 없으나 레시피 시트에 재료 컬럼이 있는 경우 하위 호환 지원
      ingredientsText = String(row['재료'] || row['ingredients']).trim();
    }

    // 조리 단계 수 및 재료 수 산출
    const ingCount = ingredientsText.split(/\n+/).filter(Boolean).length;
    const stepCount = method.split(/\n+/).filter(Boolean).length;

    const recipe: Recipe = {
      id: numId,
      name,
      category,
      ingredients: ingredientsText,
      method,
      ingredientCount: ingCount,
      stepCount: stepCount,
      icon: '🍳',
      imageUrl,
      sourceImageUrl,
      cookingTimeMinutes,
      difficulty,
      baseServings,
      caloriesPerServing,
      isBookmarked,
      userNotes: userNotes || undefined,
      tip: tip || undefined,
      isCustom: true,
      syncScope: 'private',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    parsedRecipes.push(recipe);

    // 중복 검사 (ID 또는 이름 일치)
    const isDuplicate = existingIdSet.has(numId) || existingNameSet.has(name.toLowerCase());
    if (isDuplicate) {
      duplicateCount += 1;
      duplicateRecipeNames.push(name);
    } else {
      newCount += 1;
    }
  });

  logger.info('excelBackup.parseAndValidateExcelBackup', `파싱 완료: 레시피 ${parsedRecipes.length}개 (신규: ${newCount}, 중복: ${duplicateCount})`);

  return {
    totalRecipes: parsedRecipes.length,
    totalIngredients: totalIngredientsCount,
    newRecipeCount: newCount,
    duplicateRecipeCount: duplicateCount,
    duplicateRecipeNames,
    version: backupVersion,
    createdAt,
    parsedRecipes,
  };
}

/**
 * 파싱된 레시피 목록과 중복 전략에 따라 복원을 수행하고 최신 레시피 목록을 생성합니다.
 * 
 * @param parsedRecipes 복원할 레시피 배열
 * @param existingRecipes 현재 존재하는 레시피 배열
 * @param strategy 중복 처리 전략 ('skip' | 'overwrite' | 'createNew')
 * @returns ExcelRestoreResult 결과 리포트 및 병합된 레시피 배열
 */
export function executeExcelRestore(
  parsedRecipes: Recipe[],
  existingRecipes: Recipe[],
  strategy: DuplicateStrategy
): ExcelRestoreResult {
  logger.info('excelBackup.executeExcelRestore', `복원 실행 (전략: ${strategy}, 대상: ${parsedRecipes.length}개)`);

  const existingIdMap = new Map<number, Recipe>();
  const existingNameMap = new Map<string, Recipe>();

  existingRecipes.forEach((r) => {
    existingIdMap.set(r.id, r);
    existingNameMap.set(r.name.trim().toLowerCase(), r);
  });

  const finalRecipeMap = new Map<number, Recipe>();
  existingRecipes.forEach((r) => finalRecipeMap.set(r.id, { ...r }));

  let success = 0;
  let skipped = 0;
  let failed = 0;
  const failedItems: Array<{ name: string; reason: string }> = [];

  // ID 충돌 방지를 위한 최대 ID 계산
  let maxId = existingRecipes.reduce((max, r) => Math.max(max, r.id), 1000);

  parsedRecipes.forEach((incoming) => {
    try {
      if (!incoming.name || !incoming.name.trim()) {
        failed += 1;
        failedItems.push({ name: incoming.name || '이름 없음', reason: '레시피명이 비어 있습니다.' });
        return;
      }

      const isIdDuplicate = existingIdMap.has(incoming.id);
      const isNameDuplicate = existingNameMap.has(incoming.name.trim().toLowerCase());
      const isDuplicate = isIdDuplicate || isNameDuplicate;

      if (isDuplicate) {
        if (strategy === 'skip') {
          skipped += 1;
          return;
        }

        if (strategy === 'overwrite') {
          // 기존 레시피 덮어쓰기 (기존 ID 유지하면서 속성 병합)
          const matchedTarget = existingIdMap.get(incoming.id) || existingNameMap.get(incoming.name.trim().toLowerCase())!;
          const merged: Recipe = {
            ...matchedTarget,
            ...incoming,
            id: matchedTarget.id,
            updatedAt: Date.now(),
          };
          finalRecipeMap.set(matchedTarget.id, merged);
          success += 1;
          return;
        }

        if (strategy === 'createNew') {
          // 신규 ID를 채번하여 별도 레시피로 추가
          maxId += 1;
          const newRecipe: Recipe = {
            ...incoming,
            id: maxId,
            name: isNameDuplicate ? `${incoming.name} (복원)` : incoming.name,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          finalRecipeMap.set(maxId, newRecipe);
          success += 1;
          return;
        }
      }

      // 중복이 아닌 신규 레시피
      let targetId = incoming.id;
      if (finalRecipeMap.has(targetId)) {
        maxId += 1;
        targetId = maxId;
      }

      const newRecipe: Recipe = {
        ...incoming,
        id: targetId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      finalRecipeMap.set(targetId, newRecipe);
      success += 1;
    } catch (err: any) {
      failed += 1;
      failedItems.push({
        name: incoming.name || '알 수 없는 레시피',
        reason: err?.message || '처리 중 예외 발생',
      });
    }
  });

  const resultList = Array.from(finalRecipeMap.values());
  logger.info('excelBackup.executeExcelRestore', `복원 완료: 성공 ${success}, 건너뜀 ${skipped}, 실패 ${failed}, 최종 총계 ${resultList.length}개`);

  return {
    total: parsedRecipes.length,
    success,
    skipped,
    failed,
    failedItems,
    restoredRecipes: resultList,
  };
}
