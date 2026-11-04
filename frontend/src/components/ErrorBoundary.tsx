import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    try {
      localStorage.removeItem('arychi_session_token');
      localStorage.removeItem('arychi_oauth_user');
      localStorage.removeItem('arychi_subscription');
    } catch {}
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#07080C] text-slate-200 flex items-center justify-center p-6">
          <div className="surface p-8 max-w-lg w-full text-center space-y-5 border border-line">
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 mx-auto grid place-items-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h1 className="text-lg font-bold text-white">Giao diện gặp sự cố tạm thời</h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                Đã chặn màn hình đen. Bạn có thể tải lại hoặc đặt lại phiên đăng nhập để đồng bộ lại dữ liệu.
              </p>
              {this.state.error?.message && (
                <pre className="p-3 bg-[#141722] rounded-lg text-2xs font-mono text-rose-300 text-left overflow-x-auto max-h-32">
                  {this.state.error.message}
                </pre>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="btn-primary"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Tải lại trang</span>
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="btn-secondary"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Về trang chủ</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
