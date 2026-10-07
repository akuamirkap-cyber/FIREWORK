import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  error: Error | null;
}

/** Keeps one broken component from blanking the whole app. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.label ?? "ui"}]`, error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="pointer-events-auto absolute inset-x-3 top-3 z-50 rounded-2xl border-[3px] border-[#2a1445] bg-red-500/90 p-3 text-center text-[15px] leading-snug text-white shadow-lg">
        Terjadi kesalahan di {this.props.label ?? "tampilan"}.
        <br />
        <button
          className="mt-2 rounded-xl bg-white px-4 py-1.5 text-[15px] text-red-700"
          onClick={() => window.location.reload()}
        >
          Muat ulang
        </button>
      </div>
    );
  }
}
