"use client";

import React from "react";

type Props = {
    children: React.ReactNode;
    /**
     * The component type string (e.g. "eventsGrid"), shown only in
     * developer/staging contexts when `showDetails` is true — never in
     * production (Phase 22: do not expose stack traces, internal URLs, or
     * implementation details to end users).
     */
    componentType?: string;
    /**
     * When true, shows the component type in the fallback. Set this in
     * the builder/editor where surfacing the broken component's identity
     * is useful to a developer; leave false (the default) for production
     * rendering where only the safe message is shown.
     */
    showDetails?: boolean;
};

type State = {
    hasError: boolean;
    error: Error | null;
};

/**
 * Runtime error boundary for a single rendered component node (Phase 22
 * / Phase 4H).
 *
 * Wrapping each PageNode in this boundary ensures that one broken
 * component cannot crash the rest of the page. The fallback is a neutral,
 * non-leaking message that never exposes internal details (stack traces,
 * URLs, credentials, database errors) to end users.
 *
 * This is a Class Component because React's `componentDidCatch` API is
 * only available on class components (function components cannot catch
 * render errors in the current React model).
 *
 * Usage:
 * ```tsx
 * <ComponentErrorBoundary componentType={node.type}>
 *   <TheActualComponent {...props} />
 * </ComponentErrorBoundary>
 * ```
 */
export class ComponentErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        // Log to the platform logger in dev/staging. In production this
        // goes to whatever logging transport is configured — never to the
        // browser console, where it would be visible to users.
        // We cannot import the Node.js logger here (this is a client
        // component), so we use console.error guarded by an env check so
        // it only appears in non-production builds.
        if (process.env.NODE_ENV !== "production") {
            console.error(
                `[ComponentErrorBoundary] ${this.props.componentType ?? "unknown"} crashed:`,
                error,
                info.componentStack
            );
        }
    }

    override render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        return (
            <ComponentErrorFallback
                componentType={this.props.componentType}
                showDetails={this.props.showDetails}
            />
        );
    }
}

/**
 * Safe, non-leaking fallback rendered when a component crashes at
 * runtime. Never shows stack traces, internal URLs, or error messages
 * (Phase 22). The `componentType` is only shown when `showDetails` is
 * explicitly true (builder context), not on production pages.
 */
function ComponentErrorFallback({
    componentType,
    showDetails,
}: {
    componentType?: string;
    showDetails?: boolean;
}) {
    return (
        <div
            role="status"
            aria-label="Komponente vorübergehend nicht verfügbar"
            className="mx-auto w-full max-w-5xl px-6 py-8"
        >
            <div className="rounded-token border border-dashed border-border bg-surface px-4 py-3 text-sm text-copy-muted">
                {showDetails && componentType ? (
                    <span>
                        <code className="font-mono text-xs">{componentType}</code>
                        {" — "}
                        Dieser Abschnitt ist vorübergehend nicht verfügbar.
                    </span>
                ) : (
                    <span>Dieser Abschnitt ist vorübergehend nicht verfügbar.</span>
                )}
            </div>
        </div>
    );
}
