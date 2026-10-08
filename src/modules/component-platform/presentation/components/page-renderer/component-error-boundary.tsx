'use client';

import { Component } from 'react';
import type { ReactNode } from 'react';

export interface ComponentErrorBoundaryProps {
  /** Rendered on the server, so it can be translated; shown in place of the broken component. */
  readonly fallback: ReactNode;
  readonly children: ReactNode;
}

interface ComponentErrorBoundaryState {
  readonly hasError: boolean;
}

/**
 * Keeps one broken component from taking the rest of the page down. It
 * shows only the fallback it was given and nothing about the error: no
 * message, no stack, no component internals reach a visitor. Failures are
 * reported by Next.js on the server, so there is nothing to log here (a
 * Client Component has no logger).
 */
export class ComponentErrorBoundary extends Component<
  ComponentErrorBoundaryProps,
  ComponentErrorBoundaryState
> {
  override state: ComponentErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ComponentErrorBoundaryState {
    return { hasError: true };
  }

  override render(): ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
