/**
 * Deliberately empty, and deliberately here rather than only in `(public)`.
 * Client navigation between published pages (or sites) re-renders only the
 * segments below the one that changed, so a boundary in `(public)/loading.tsx`
 * lies above the re-render scope and cannot catch the page's per-request load.
 * This one sits inside the page's own segment and does. A published website
 * streams its own parts, so no route-level screen is drawn that would flash a
 * layout matching no site.
 */
export default function Loading(): null {
  return null;
}
