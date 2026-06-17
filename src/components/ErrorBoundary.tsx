import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { showToast } from "./Toast";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error Boundary caught an error:", error, errorInfo);
    showToast("error", "发生了一个错误，请刷新重试");
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    showToast("info", "正在重新加载...");
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-cream">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-accent-ink mb-3">
              哎呀，出错了
            </h2>
            <p className="text-accent-inkMute mb-6">
              页面加载过程中遇到了问题，请尝试刷新重试
            </p>
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 px-6 py-3 bg-accent-orange text-white rounded-full font-bold hover:bg-accent-orange/90 transition active:scale-95"
            >
              <RefreshCw size={18} />
              刷新页面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}