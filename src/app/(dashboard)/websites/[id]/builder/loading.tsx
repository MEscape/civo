/**
 * Shown while navigating to this route (e.g. clicking a website in the
 * list) and its async work — loading the website, its page config — is
 * still in flight. Unlike the public site route, nothing inside this page
 * uses `Suspense`, so this exists only for that initial navigation gap, not
 * for streaming individual widgets.
 *
 * Mirrors the shell's own chrome (header height, canvas background) so the
 * transition doesn't flash to a bare white page before the real content
 * takes over.
 */
export default function Loading() {
    return <div className="h-app-body animate-pulse bg-canvas" />;
}
