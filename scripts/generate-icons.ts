import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const iconsDir = path.join(process.cwd(), 'public', 'icons');
const screenshotsDir = path.join(process.cwd(), 'public', 'screenshots');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// 1. Standard App Icon SVG (Warm orange gradient, rounded square with pan/egg visual)
function getStandardIconSvg(size: number, isMaskable = false, isApple = false) {
  const cornerRadius = isMaskable ? 0 : Math.round(size * 0.22);
  const padding = isMaskable ? size * 0.18 : size * 0.08;
  const innerSize = size - padding * 2;
  const cx = size / 2;
  const cy = size / 2;

  // Maskable icons should fill the entire canvas with background
  const bgRect = isMaskable
    ? `<rect width="${size}" height="${size}" fill="url(#brandGrad)" />`
    : `<rect width="${size}" height="${size}" rx="${cornerRadius}" fill="url(#brandGrad)" filter="url(#shadow)" />`;

  return `
  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fb923c" />
        <stop offset="50%" stop-color="#f97316" />
        <stop offset="100%" stop-color="#ea580c" />
      </linearGradient>
      <linearGradient id="eggWhiteGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffffff" />
        <stop offset="100%" stop-color="#fef3c7" />
      </linearGradient>
      <linearGradient id="yolkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fde047" />
        <stop offset="60%" stop-color="#f59e0b" />
        <stop offset="100%" stop-color="#d97706" />
      </linearGradient>
      <linearGradient id="panGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#334155" />
        <stop offset="100%" stop-color="#1e293b" />
      </linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="${Math.round(size * 0.02)}" stdDeviation="${Math.round(size * 0.03)}" flood-color="#000000" flood-opacity="0.15" />
      </filter>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="${Math.round(size * 0.015)}" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>

    ${bgRect}

    <!-- Pan Graphic -->
    <g transform="translate(${cx}, ${cy - size * 0.02})">
      <!-- Pan handle -->
      <path d="M ${size * 0.18} ${size * 0.15} L ${size * 0.32} ${size * 0.28}" 
            stroke="#1e293b" stroke-width="${size * 0.065}" stroke-linecap="round" />
      <circle cx="${size * 0.32}" cy="${size * 0.28}" r="${size * 0.018}" fill="#ea580c" />

      <!-- Pan outer body -->
      <circle cx="0" cy="0" r="${size * 0.26}" fill="url(#panGrad)" />
      <!-- Pan inner rim -->
      <circle cx="0" cy="0" r="${size * 0.235}" fill="#475569" opacity="0.6" />
      <!-- Pan inner surface -->
      <circle cx="0" cy="0" r="${size * 0.22}" fill="#0f172a" />

      <!-- Fried Egg: Egg white blob -->
      <path d="M -${size * 0.12} -${size * 0.05} 
               C -${size * 0.14} -${size * 0.13}, -${size * 0.03} -${size * 0.16}, ${size * 0.08} -${size * 0.13} 
               C ${size * 0.16} -${size * 0.10}, ${size * 0.16} ${size * 0.05}, ${size * 0.10} ${size * 0.12} 
               C ${size * 0.04} ${size * 0.17}, -${size * 0.08} ${size * 0.16}, -${size * 0.13} ${size * 0.08} 
               Z" 
            fill="url(#eggWhiteGrad)" filter="url(#shadow)" />

      <!-- Egg Yolk -->
      <circle cx="-${size * 0.015}" cy="-${size * 0.01}" r="${size * 0.075}" fill="url(#yolkGrad)" />
      <!-- Yolk reflection/highlight -->
      <ellipse cx="-${size * 0.035}" cy="-${size * 0.035}" rx="${size * 0.022}" ry="${size * 0.014}" 
               transform="rotate(-30, -${size * 0.035}, -${size * 0.035})" fill="#ffffff" opacity="0.65" />
      
      <!-- Steam lines -->
      <path d="M -${size * 0.06} -${size * 0.24} Q -${size * 0.09} -${size * 0.28} -${size * 0.06} -${size * 0.32}" 
            stroke="#ffffff" stroke-width="${size * 0.02}" stroke-linecap="round" fill="none" opacity="0.75" />
      <path d="M ${size * 0.04} -${size * 0.24} Q ${size * 0.01} -${size * 0.28} ${size * 0.04} -${size * 0.32}" 
            stroke="#ffffff" stroke-width="${size * 0.02}" stroke-linecap="round" fill="none" opacity="0.75" />
    </g>

    <!-- App Name Badge on bottom -->
    <g transform="translate(${cx}, ${size * (isMaskable ? 0.82 : 0.85)})">
      <rect x="-${size * 0.32}" y="-${size * 0.055}" width="${size * 0.64}" height="${size * 0.11}" rx="${size * 0.055}" 
            fill="#ffffff" opacity="0.95" />
      <text x="0" y="${size * 0.025}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif" 
            font-size="${size * 0.06}" font-weight="900" fill="#ea580c" letter-spacing="-0.5px">내입맛레시피</text>
    </g>
  </svg>
  `;
}

async function generateAll() {
  console.log('Generating PWA Icons...');

  // 1. icon-192.png
  const svg192 = getStandardIconSvg(192, false);
  await sharp(Buffer.from(svg192))
    .resize(192, 192)
    .png({ quality: 100 })
    .toFile(path.join(iconsDir, 'icon-192.png'));
  console.log('Generated: public/icons/icon-192.png (192x192)');

  // 2. icon-512.png
  const svg512 = getStandardIconSvg(512, false);
  await sharp(Buffer.from(svg512))
    .resize(512, 512)
    .png({ quality: 100 })
    .toFile(path.join(iconsDir, 'icon-512.png'));
  console.log('Generated: public/icons/icon-512.png (512x512)');

  // 3. maskable-512.png
  const svgMaskable512 = getStandardIconSvg(512, true);
  await sharp(Buffer.from(svgMaskable512))
    .resize(512, 512)
    .png({ quality: 100 })
    .toFile(path.join(iconsDir, 'maskable-512.png'));
  console.log('Generated: public/icons/maskable-512.png (512x512, maskable)');

  // 4. apple-touch-icon-180.png
  const svgApple180 = getStandardIconSvg(180, false, true);
  await sharp(Buffer.from(svgApple180))
    .resize(180, 180)
    .png({ quality: 100 })
    .toFile(path.join(iconsDir, 'apple-touch-icon-180.png'));
  console.log('Generated: public/icons/apple-touch-icon-180.png (180x180)');

  // 5. Screenshots for Richer PWA Install UI
  const screenshot1Svg = `
  <svg width="720" height="1280" viewBox="0 0 720 1280" xmlns="http://www.w3.org/2000/svg">
    <rect width="720" height="1280" fill="#fffaf3" />
    <rect width="720" height="120" fill="#ffffff" />
    <text x="50" y="75" font-family="'Noto Sans KR', sans-serif" font-size="34" font-weight="900" fill="#1c1917">🍳 내 입맛 레시피</text>
    <rect x="40" y="150" width="640" height="180" rx="24" fill="#ffedd5" />
    <text x="70" y="210" font-family="'Noto Sans KR', sans-serif" font-size="28" font-weight="800" fill="#9a3412">나만의 황금 레시피 북</text>
    <text x="70" y="260" font-family="'Noto Sans KR', sans-serif" font-size="20" font-weight="500" fill="#c2410c">계량 조절, 타이머, 주간 식단표까지 한 번에</text>
    
    <!-- Card 1 -->
    <rect x="40" y="360" width="305" height="420" rx="24" fill="#ffffff" stroke="#fed7aa" stroke-width="2" />
    <text x="192" y="470" font-size="80" text-anchor="middle">🍲</text>
    <text x="65" y="550" font-family="'Noto Sans KR', sans-serif" font-size="24" font-weight="800" fill="#1c1917">김치찌개</text>
    <text x="65" y="590" font-family="'Noto Sans KR', sans-serif" font-size="18" font-weight="600" fill="#f97316">국/찌개 • 25분</text>
    <rect x="65" y="630" width="80" height="32" rx="16" fill="#fef3c7" />
    <text x="105" y="652" font-family="'Noto Sans KR', sans-serif" font-size="14" font-weight="700" fill="#b45309" text-anchor="middle">쉬움</text>

    <!-- Card 2 -->
    <rect x="375" y="360" width="305" height="420" rx="24" fill="#ffffff" stroke="#fed7aa" stroke-width="2" />
    <text x="527" y="470" font-size="80" text-anchor="middle">🍳</text>
    <text x="400" y="550" font-family="'Noto Sans KR', sans-serif" font-size="24" font-weight="800" fill="#1c1917">계란말이</text>
    <text x="400" y="590" font-family="'Noto Sans KR', sans-serif" font-size="18" font-weight="600" fill="#f97316">반찬 • 15분</text>
    <rect x="400" y="630" width="80" height="32" rx="16" fill="#fef3c7" />
    <text x="440" y="652" font-family="'Noto Sans KR', sans-serif" font-size="14" font-weight="700" fill="#b45309" text-anchor="middle">쉬움</text>
    
    <!-- Bottom Nav -->
    <rect y="1180" width="720" height="100" fill="#ffffff" stroke="#e7e5e4" stroke-width="2" />
    <text x="120" y="1240" font-family="'Noto Sans KR', sans-serif" font-size="22" font-weight="700" fill="#ea580c" text-anchor="middle">🏠 홈</text>
    <text x="360" y="1240" font-family="'Noto Sans KR', sans-serif" font-size="22" font-weight="700" fill="#78716c" text-anchor="middle">✨ AI 요리사</text>
    <text x="600" y="1240" font-family="'Noto Sans KR', sans-serif" font-size="22" font-weight="700" fill="#78716c" text-anchor="middle">📅 식단표</text>
  </svg>
  `;

  await sharp(Buffer.from(screenshot1Svg))
    .resize(720, 1280)
    .png({ quality: 95 })
    .toFile(path.join(screenshotsDir, 'screenshot-mobile-1.png'));
  console.log('Generated: public/screenshots/screenshot-mobile-1.png');
}

generateAll().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
