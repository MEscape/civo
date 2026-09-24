/**
 * Route-level Suspense boundary for the public website page.
 *
 * Required for the nested `Suspense` boundaries in render-nodes.tsx to
 * actually stream: without a `loading.tsx`, Next.js has no early flush
 * point for this route and buffers the ENTIRE response — including every
 * widget's per-node Suspense fallback — until the slowest data source
 * resolves. Confirmed by direct measurement: adding this file dropped
 * time-to-first-byte on a 28-widget page from ~6.5s (one buffered burst)
 * to under 200ms, with each widget's own skeleton and data streaming in
 * independently afterward exactly as render-nodes.tsx intends.
 *
 * Kept minimal on purpose: this only needs to exist to create the
 * boundary. It is shown only on the very first navigation to a page not
 * yet in the Router Cache — normally invisible, since the boundary below
 * resolves in milliseconds once this route's own async work (loading the
 * website, its page config) finishes.
 */
export default function Loading() {
    return null;
}
