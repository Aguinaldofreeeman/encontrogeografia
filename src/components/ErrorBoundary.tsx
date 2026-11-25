import React from 'react';
import { Compass, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Ocorreu uma falha inesperada na aplicação.',
    };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary capturou erro:', error, info);
  }

  override render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex items-center justify-center px-6">
          <div className="max-w-lg w-full bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-8 space-y-5">
            <div className="flex items-center gap-3 text-[var(--accent-terracotta)]">
              <Compass className="w-5 h-5" />
              <span className="font-mono text-xs uppercase tracking-widest">
                Registro de Interrupção
              </span>
            </div>
            <h1 className="font-serif text-3xl font-semibold text-[var(--text-primary)]">
              Não foi possível carregar esta seção do atlas.
            </h1>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              Verifique sua conexão ou recarregue a página para restabelecer o acesso ao acervo fotográfico.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--accent-forest)] text-[var(--accent-forest-contrast)] text-sm font-medium hover:bg-[var(--accent-forest-hover)] transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              Recarregar Álbum
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
