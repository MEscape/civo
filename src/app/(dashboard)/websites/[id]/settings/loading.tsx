/**
 * Shown while navigating to this route and its async work — loading the
 * website and its theme — is still in flight. Same rationale as the
 * builder route's loading.tsx: no nested `Suspense` here, so this only
 * covers the initial navigation gap.
 */
export default function Loading() {
    return <div className="h-app-body animate-pulse bg-canvas" />;
}
