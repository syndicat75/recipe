/**
 * @file lib/recipePageParser.ts
 * @description 웹페이지 URL에서 schema.org/Recipe 구조화 데이터(JSON-LD) 및 본문 레시피를
 * 안전하고 빠르게 추출하는 전문 파서.
 * SSRF 방어, 6초 타임아웃, 광고/메뉴/스크립트 제거 및 토큰 최적화 fallback을 제공합니다.
 */

import { URL } from 'url';

export interface ParsedJsonLdRecipe {
  name?: string;
  servings?: number;
  rawYield?: string;
  ingredients?: string[];
  instructions?: string[];
  cookingTimeMinutes?: number;
  category?: string;
  description?: string;
  imageUrl?: string;
}

export interface RecipePageParseResult {
  success: boolean;
  sourceType: 'jsonld' | 'html' | 'failed';
  url: string;
  title?: string;
  extractedText: string;
  jsonLdRecipe?: ParsedJsonLdRecipe;
  fetchDurationMs: number;
  parseDurationMs: number;
  fetchStatus?: number;
  errorMessage?: string;
  isBlockedOrForbidden?: boolean;
}

/**
 * SSRF(Server-Side Request Forgery) 방어를 위한 URL 유효성 검증
 * localhost, 내부 사설망(RFC 1918), 루프백, 링크로컬 IP 대역을 차단합니다.
 */
export function validateAndSanitizeUrl(rawUrl: string): { valid: boolean; sanitizedUrl?: string; reason?: string } {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, reason: 'URL이 비어 있습니다.' };
  }

  const trimmed = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, reason: '유효하지 않은 URL 형식입니다.' };
  }

  // http / https 프로토콜만 허용
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: 'http 또는 https URL만 지원합니다.' };
  }

  // 사용자 정보(user:pass@) 차단
  if (parsed.username || parsed.password) {
    return { valid: false, reason: '인증 정보가 포함된 URL은 허용되지 않습니다.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // localhost 및 loopback 차단
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return { valid: false, reason: '로컬 네트워크 주소는 접근할 수 없습니다.' };
  }

  // 사설 IPv4 대역 차단
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipv4Match = hostname.match(ipv4Regex);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1, 5).map(Number);
    if (octets.some((o) => o > 255)) {
      return { valid: false, reason: '유효하지 않은 IP 주소입니다.' };
    }
    const [a, b] = octets;
    if (
      a === 10 || // 10.0.0.0/8
      a === 127 || // 127.0.0.0/8
      a === 0 || // 0.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
      (a === 192 && b === 168) || // 192.168.0.0/16
      (a === 169 && b === 254) || // 169.254.0.0/16
      (a === 100 && b >= 64 && b <= 127) // 100.64.0.0/10 Carrier-grade NAT
    ) {
      return { valid: false, reason: '사설 IP 주소는 접근할 수 없습니다.' };
    }
  }

  // IPv6 사설/루프백 대역 차단 (::1, fe80, fc00, fd00 등)
  if (
    hostname.startsWith('[') &&
    (hostname.includes('::1') ||
      hostname.toLowerCase().startsWith('[fe80:') ||
      hostname.toLowerCase().startsWith('[fc') ||
      hostname.toLowerCase().startsWith('[fd'))
  ) {
    return { valid: false, reason: '사설 IPv6 주소는 접근할 수 없습니다.' };
  }

  return { valid: true, sanitizedUrl: parsed.toString() };
}

/**
 * ISO 8601 Duration(예: PT30M, PT1H15M, P0DT0H25M) 문자열을 분 단위 정수로 변환합니다.
 */
export function parseIsoDuration(durationStr?: string): number | undefined {
  if (!durationStr || typeof durationStr !== 'string') return undefined;

  const trimmed = durationStr.trim().toUpperCase();

  // 순수 숫자인 경우
  if (/^\d+$/.test(trimmed)) {
    const num = parseInt(trimmed, 10);
    return num > 0 ? num : undefined;
  }

  // "30분", "1시간 20분" 등의 한글 표기 대응
  if (trimmed.includes('분') || trimmed.includes('시간')) {
    let total = 0;
    const hourMatch = trimmed.match(/(\d+)\s*시간/);
    if (hourMatch) total += parseInt(hourMatch[1], 10) * 60;
    const minMatch = trimmed.match(/(\d+)\s*분/);
    if (minMatch) total += parseInt(minMatch[1], 10);
    if (total > 0) return total;
  }

  // ISO 8601 Duration 정규식
  const isoRegex = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;
  const match = trimmed.match(isoRegex);
  if (!match) return undefined;

  const days = parseInt(match[1] || '0', 10);
  const hours = parseInt(match[2] || '0', 10);
  const minutes = parseInt(match[3] || '0', 10);
  const seconds = parseInt(match[4] || '0', 10);

  const totalMinutes = days * 24 * 60 + hours * 60 + minutes + Math.round(seconds / 60);
  return totalMinutes > 0 ? totalMinutes : undefined;
}

/**
 * recipeYield 문자열이나 배열을 파싱하여 기준 인분 정수를 산출합니다.
 * "1인분", "2인분", "4 servings", "2~3인분" 등을 정확히 처리하며,
 * 원문에 1인분이 명시된 경우 1을 엄격히 반환합니다.
 */
export function parseYieldToServings(yieldVal?: unknown): number | undefined {
  if (yieldVal == null) return undefined;

  if (typeof yieldVal === 'number' && yieldVal >= 1) {
    return Math.round(yieldVal);
  }

  let text = '';
  if (Array.isArray(yieldVal)) {
    text = yieldVal.filter(Boolean).map(String).join(' ');
  } else if (typeof yieldVal === 'string') {
    text = yieldVal;
  } else {
    return undefined;
  }

  const trimmed = text.trim();
  if (!trimmed) return undefined;

  // "1인분", "2인분", "4인분" 등의 한글 패턴
  const krMatch = trimmed.match(/(\d+)\s*인분/);
  if (krMatch) {
    const n = parseInt(krMatch[1], 10);
    if (n >= 1 && n <= 100) return n;
  }

  // "servings 4", "4 servings", "yields 2" 등의 영문 패턴
  const enMatch = trimmed.match(/(\d+)\s*(?:servings?|portions?|people|인)/i);
  if (enMatch) {
    const n = parseInt(enMatch[1], 10);
    if (n >= 1 && n <= 100) return n;
  }

  // "2~3인분", "3-4 servings" -> 최소 인분 기준
  const rangeMatch = trimmed.match(/(\d+)\s*[-~]\s*(\d+)/);
  if (rangeMatch) {
    const n = parseInt(rangeMatch[1], 10);
    if (n >= 1 && n <= 100) return n;
  }

  // 단순 숫자만 있는 경우
  const numOnly = trimmed.match(/^(\d+)$/);
  if (numOnly) {
    const n = parseInt(numOnly[1], 10);
    if (n >= 1 && n <= 100) return n;
  }

  return undefined;
}

/**
 * HTML 문서 내 모든 JSON-LD 블록 중 schema.org/Recipe 데이터를 탐색하여 정제합니다.
 */
export function extractJsonLdRecipe(html: string): ParsedJsonLdRecipe | null {
  const scriptRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(html)) !== null) {
    const rawContent = match[1]?.trim();
    if (!rawContent) continue;

    try {
      const parsed = JSON.parse(rawContent);
      const recipeItem = findRecipeInJson(parsed);
      if (recipeItem) {
        return normalizeJsonLdRecipe(recipeItem);
      }
    } catch {
      // JSON 파싱 에러 시 다음 script 태그 탐색
      continue;
    }
  }

  return null;
}

/**
 * JSON 객체/배열/그래프 구조에서 @type이 'Recipe'인 객체를 재귀적으로 탐색합니다.
 */
function findRecipeInJson(obj: unknown): Record<string, unknown> | null {
  if (!obj || typeof obj !== 'object') return null;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findRecipeInJson(item);
      if (found) return found;
    }
    return null;
  }

  const record = obj as Record<string, unknown>;

  // @type 확인 (문자열 또는 문자열 배열 대응)
  const typeVal = record['@type'];
  if (typeof typeVal === 'string' && typeVal.toLowerCase() === 'recipe') {
    return record;
  }
  if (Array.isArray(typeVal) && typeVal.some((t) => typeof t === 'string' && t.toLowerCase() === 'recipe')) {
    return record;
  }

  // @graph 내부 탐색
  if (Array.isArray(record['@graph'])) {
    for (const item of record['@graph']) {
      const found = findRecipeInJson(item);
      if (found) return found;
    }
  }

  return null;
}

/**
 * 추출된 schema.org Recipe 객체를 앱 표준 데이터로 정규화합니다.
 */
function normalizeJsonLdRecipe(recipe: Record<string, unknown>): ParsedJsonLdRecipe {
  const name = typeof recipe.name === 'string' ? recipe.name.trim() : undefined;
  const description = typeof recipe.description === 'string' ? recipe.description.trim() : undefined;

  // 인분 수 추출
  const rawYield = recipe.recipeYield != null ? String(recipe.recipeYield) : undefined;
  const servings = parseYieldToServings(recipe.recipeYield);

  // 재료 목록 추출
  let ingredients: string[] = [];
  if (Array.isArray(recipe.recipeIngredient)) {
    ingredients = recipe.recipeIngredient
      .filter((i) => typeof i === 'string' && i.trim())
      .map((i) => (i as string).trim());
  } else if (typeof recipe.recipeIngredient === 'string') {
    ingredients = recipe.recipeIngredient
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // 조리 순서 추출 (HowToStep, HowToSection, string[] 대응)
  const instructions: string[] = [];
  const rawInstructions = recipe.recipeInstructions;

  if (Array.isArray(rawInstructions)) {
    for (const step of rawInstructions) {
      if (typeof step === 'string') {
        if (step.trim()) instructions.push(step.trim());
      } else if (step && typeof step === 'object') {
        const stepObj = step as Record<string, unknown>;
        // HowToSection 인 경우
        if (stepObj['@type'] === 'HowToSection' && Array.isArray(stepObj.itemListElement)) {
          for (const sub of stepObj.itemListElement as unknown[]) {
            if (sub && typeof sub === 'object') {
              const text = (sub as Record<string, unknown>).text;
              if (typeof text === 'string' && text.trim()) instructions.push(text.trim());
            }
          }
        } else {
          // HowToStep 인 경우
          const text = stepObj.text || stepObj.name;
          if (typeof text === 'string' && text.trim()) {
            instructions.push(text.trim());
          }
        }
      }
    }
  } else if (typeof rawInstructions === 'string') {
    instructions.push(
      ...rawInstructions
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean)
    );
  }

  // 조리시간 계산 (cookTime 우선, 없으면 totalTime)
  const cookMin = parseIsoDuration(recipe.cookTime as string);
  const totalMin = parseIsoDuration(recipe.totalTime as string);
  const prepMin = parseIsoDuration(recipe.prepTime as string);

  let cookingTimeMinutes = cookMin || totalMin;
  if (!cookingTimeMinutes && prepMin) {
    cookingTimeMinutes = prepMin;
  }

  // 이미지 추출
  let imageUrl: string | undefined;
  if (typeof recipe.image === 'string') {
    imageUrl = recipe.image;
  } else if (Array.isArray(recipe.image) && typeof recipe.image[0] === 'string') {
    imageUrl = recipe.image[0];
  } else if (recipe.image && typeof recipe.image === 'object') {
    const imgObj = recipe.image as Record<string, unknown>;
    if (typeof imgObj.url === 'string') imageUrl = imgObj.url;
  }

  // 카테고리 추출
  let category: string | undefined;
  if (typeof recipe.recipeCategory === 'string') {
    category = recipe.recipeCategory;
  } else if (Array.isArray(recipe.recipeCategory) && typeof recipe.recipeCategory[0] === 'string') {
    category = recipe.recipeCategory[0];
  }

  return {
    name,
    servings,
    rawYield,
    ingredients,
    instructions,
    cookingTimeMinutes,
    category,
    description,
    imageUrl,
  };
}

/**
 * 정제된 JSON-LD 레시피 데이터를 Gemini가 가장 빠르고 정확하게 분석할 수 있는 최소 텍스트로 직렬화합니다.
 */
export function formatJsonLdPromptText(recipe: ParsedJsonLdRecipe, sourceUrl: string): string {
  const parts: string[] = [];

  parts.push(`[웹페이지 구조화 데이터 (schema.org/Recipe 기반)]:`);
  parts.push(`출처 URL: ${sourceUrl}`);
  if (recipe.name) parts.push(`요리명: ${recipe.name}`);
  if (recipe.servings) {
    parts.push(`기준 인분: ${recipe.servings}인분 (원문 명시: ${recipe.rawYield || `${recipe.servings}인분`})`);
  } else if (recipe.rawYield) {
    parts.push(`기준 인분 표기: ${recipe.rawYield}`);
  }
  if (recipe.cookingTimeMinutes) parts.push(`예상 조리시간: ${recipe.cookingTimeMinutes}분`);
  if (recipe.category) parts.push(`카테고리 정보: ${recipe.category}`);
  if (recipe.description) parts.push(`요리 소개: ${recipe.description}`);

  if (recipe.ingredients && recipe.ingredients.length > 0) {
    parts.push(`\n[재료 목록]:\n` + recipe.ingredients.map((i) => `- ${i}`).join('\n'));
  }

  if (recipe.instructions && recipe.instructions.length > 0) {
    parts.push(
      `\n[조리 순서]:\n` +
        recipe.instructions.map((step, idx) => `${idx + 1}. ${step.replace(/^\d+[\.\)]\s*/, '')}`).join('\n')
    );
  }

  return parts.join('\n');
}

/**
 * HTML 문서에서 레시피와 무관한 잡음(헤더, 푸터, 네비게이션, 광고, 댓글, 스크립트 등)을 제거하고
 * 레시피 핵심 본문을 우선 추출하는 고속 경량 파서.
 * 토큰 소비를 대폭 줄이고 Gemini 응답 속도를 2~3배 끌어올리기 위해 최대 3,500자 이내로 엄선 정제합니다.
 */
export function cleanHtmlFallback(html: string): string {
  // 1. 불필요한 태그 영역 완전히 제거
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // 2. 레시피 핵심 유력 컨테이너 (네이버 스마트에디터, 만개의레시피, 블로그, 요리사이트) 정밀 탐색
  // - se-main-container / se-component (네이버 블로그)
  // - view2_summary / ready_ingre3 / view_step / recipe_step / ingre_list (만개의레시피 모바일/PC)
  // - entry-content / article_content (티스토리/다음)
  // - recipe, ingredient, cook, step, method, 재료, 만드는법 등
  const candidateRegex =
    /<(?:div|section|article|main)\b[^>]*(?:class|id)=["'][^"']*(?:recipe|ingredient|view2|cook|step|method|재료|만드는법|se-main-container|entry-content|view_step|recipe_step|ready_ingre|ingre_list)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section|article|main)>/gi;

  const candidateBlocks: string[] = [];
  let candidateMatch: RegExpExecArray | null;
  while ((candidateMatch = candidateRegex.exec(text)) !== null) {
    const rawBlock = candidateMatch[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (rawBlock && rawBlock.length >= 60) {
      candidateBlocks.push(rawBlock);
    }
    if (candidateBlocks.length >= 6) break;
  }

  if (candidateBlocks.length > 0) {
    const combinedCandidates = candidateBlocks.join('\n\n');
    if (combinedCandidates.length >= 150) {
      return combinedCandidates.slice(0, 3500);
    }
  }

  // 3. 일반 본문 태그 제거 및 공백 정규화
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();

  // 4. 최대 3,500자로 제한하여 Gemini 전송 속도와 토큰 소모 최소화
  return text.slice(0, 3500);
}

/**
 * 네이버 블로그 등 iframe을 사용하는 URL을 모바일 친화적 본문 직접 URL로 정규화
 */
export function normalizeRecipeRequestUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    const host = parsed.hostname.toLowerCase();

    // blog.naver.com/{id}/{postId} -> m.blog.naver.com/{id}/{postId}
    if (host === 'blog.naver.com' && !parsed.pathname.includes('PostView')) {
      parsed.hostname = 'm.blog.naver.com';
      return parsed.toString();
    }
  } catch {
    // 무시하고 원본 유지
  }
  return rawUrl.trim();
}

/**
 * URL을 받아 5초 타임아웃 내에 안전하게 웹페이지를 조회하고
 * JSON-LD Recipe 우선 추출 -> HTML 정제 Fallback을 수행합니다.
 * @param targetUrl 조회할 레시피 URL
 * @param timeoutMs 웹페이지 조회 타임아웃 (기본 5000ms = 5초)
 */
export async function fetchAndParseRecipePage(
  targetUrl: string,
  timeoutMs: number = 5000
): Promise<RecipePageParseResult> {
  const startedAt = Date.now();

  // 0. URL 전처리 (모바일 최적화 등)
  const normalizedUrl = normalizeRecipeRequestUrl(targetUrl);

  // 1. SSRF 방어 검증
  const validation = validateAndSanitizeUrl(normalizedUrl);
  if (!validation.valid || !validation.sanitizedUrl) {
    return {
      success: false,
      sourceType: 'failed',
      url: targetUrl,
      extractedText: '',
      fetchDurationMs: 0,
      parseDurationMs: 0,
      errorMessage: validation.reason || '접근이 허용되지 않는 URL입니다.',
    };
  }

  const sanitizedUrl = validation.sanitizedUrl;
  let fetchDurationMs = 0;
  let html = '';
  let status = 0;

  // 2. 5초 단축 타임아웃으로 웹페이지 요청
  try {
    const fetchStart = Date.now();
    const response = await fetch(sanitizedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    });

    fetchDurationMs = Date.now() - fetchStart;
    status = response.status;

    // 리디렉션된 경우 최종 도착 URL에 대해 SSRF 방어 재검증
    if (response.url && response.url !== sanitizedUrl) {
      const redirectCheck = validateAndSanitizeUrl(response.url);
      if (!redirectCheck.valid) {
        return {
          success: false,
          sourceType: 'failed',
          url: response.url,
          extractedText: '',
          fetchDurationMs,
          parseDurationMs: 0,
          errorMessage: '리디렉션된 웹 주소가 안전하지 않아 접근이 차단되었습니다.',
        };
      }
    }

    if (!response.ok) {
      const isForbiddenOrBlocked = response.status === 403 || response.status === 429 || response.status === 401;
      return {
        success: false,
        sourceType: 'failed',
        url: sanitizedUrl,
        extractedText: '',
        fetchDurationMs,
        parseDurationMs: 0,
        fetchStatus: response.status,
        isBlockedOrForbidden: isForbiddenOrBlocked,
        errorMessage: isForbiddenOrBlocked
          ? '해당 사이트에서 레시피 내용을 읽지 못했습니다. 텍스트로 붙여넣으면 더 안정적으로 가져올 수 있습니다.'
          : `웹페이지 접속에 실패했습니다. (HTTP ${response.status})`,
      };
    }

    html = await response.text();
  } catch (err) {
    fetchDurationMs = Date.now() - startedAt;
    const isTimeout =
      err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError' || err.message.includes('timeout'));

    return {
      success: false,
      sourceType: 'failed',
      url: sanitizedUrl,
      extractedText: '',
      fetchDurationMs,
      parseDurationMs: 0,
      isBlockedOrForbidden: false,
      errorMessage: isTimeout
        ? '웹페이지 응답 시간이 초과되었습니다(5초). 텍스트로 복사하여 가져오기를 시도해주세요.'
        : '해당 사이트에 접속할 수 없습니다. URL 주소를 확인해주세요.',
    };
  }

  // 3. 파싱 단계 시작
  const parseStart = Date.now();

  // 3-1. JSON-LD Recipe 탐색 (최우선)
  const jsonLdRecipe = extractJsonLdRecipe(html);
  if (jsonLdRecipe && (jsonLdRecipe.name || (jsonLdRecipe.ingredients && jsonLdRecipe.ingredients.length > 0))) {
    const formattedPrompt = formatJsonLdPromptText(jsonLdRecipe, sanitizedUrl);
    const parseDurationMs = Date.now() - parseStart;

    return {
      success: true,
      sourceType: 'jsonld',
      url: sanitizedUrl,
      title: jsonLdRecipe.name,
      extractedText: formattedPrompt,
      jsonLdRecipe,
      fetchDurationMs,
      parseDurationMs,
      fetchStatus: status,
    };
  }

  // 3-2. HTML Fallback 정제
  const cleanedText = cleanHtmlFallback(html);
  const parseDurationMs = Date.now() - parseStart;

  // 유효한 본문이 거의 없는 경우
  if (!cleanedText || cleanedText.length < 50) {
    return {
      success: false,
      sourceType: 'failed',
      url: sanitizedUrl,
      extractedText: '',
      fetchDurationMs,
      parseDurationMs,
      fetchStatus: status,
      errorMessage: '웹페이지에서 유효한 레시피 본문을 찾지 못했습니다. 텍스트를 복사해서 붙여넣어 주세요.',
    };
  }

  return {
    success: true,
    sourceType: 'html',
    url: sanitizedUrl,
    extractedText: `[웹페이지 URL: ${sanitizedUrl}]\n${cleanedText}`,
    fetchDurationMs,
    parseDurationMs,
    fetchStatus: status,
  };
}
