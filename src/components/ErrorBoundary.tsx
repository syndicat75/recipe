/**
 * @file src/components/ErrorBoundary.tsx
 * @description React 런타임 오류 방어용 전역 Error Boundary 컴포넌트
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';
import { logger } from '../utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error('ErrorBoundary.componentDidCatch', '렌더링 런타임 에러 포착', {
      error,
      errorInfo,
    });
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    window.location.hash = '';
    window.location.reload();
  };

  private handleGoHome = (): void => {
    this.setState({ hasError: false, error: null });
    window.location.hash = '';
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-100 text-rose-600 shadow-md">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="mt-4 font-soft text-2xl font-black text-stone-900">
            화면을 불러오는 중 문제가 발생했습니다
          </h2>
          <p className="mt-2 max-w-md text-sm text-stone-600">
            일시적인 오류일 수 있습니다. 홈으로 돌아가거나 페이지를 새로고침해 주세요.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleGoHome}
              className="flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-2.5 font-soft text-sm font-bold text-white shadow-md shadow-orange-500/20 hover:bg-orange-600 active:scale-95 transition-all"
            >
              <Home className="h-4 w-4" />
              <span>홈으로 돌아가기</span>
            </button>
            <button
              type="button"
              onClick={this.handleReset}
              className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-5 py-2.5 font-soft text-sm font-bold text-stone-700 shadow-xs hover:bg-stone-50 active:scale-95 transition-all"
            >
              <RotateCcw className="h-4 w-4" />
              <span>새로고침</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
