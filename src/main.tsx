/**
 * @file src/main.tsx
 * @description 애플리케이션 React 진입점 및 PWA 서비스 워커 등록
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { logger } from './utils/logger';

// PWA 서비스 워커 등록
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        logger.info('main.serviceWorker', `서비스 워커 등록 성공: scope=${registration.scope}`);
      })
      .catch((error) => {
        logger.warn('main.serviceWorker', '서비스 워커 등록 실패:', error);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
