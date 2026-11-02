import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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
    console.error('Growa ErrorBoundary caught error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 text-center shadow-lg border border-slate-200">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <AlertTriangle className="h-8 w-8" aria-hidden="true" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">เกิดข้อผิดพลาดในการแสดงผล</h1>
            <p className="mt-2 text-base text-slate-600">
              ระบบพบปัญหาชั่วคราว ข้อมูลของคุณยังถูกบันทึกไว้อย่างปลอดภัย โปรดลองโหลดหน้านี้ใหม่อีกครั้ง
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-purple-700 px-5 text-base font-bold text-white hover:bg-purple-800 transition-colors shadow-xs cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>โหลดหน้าใหม่</span>
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-base font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                กลับหน้าเริ่มต้น
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

