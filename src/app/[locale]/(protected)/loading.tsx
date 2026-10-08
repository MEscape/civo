/**
 * Deliberately empty. Pages here stream their own parts behind Suspense
 * (the platform's data components even bring their own skeletons), and a
 * route-level screen would show the wrong layout for forms and the editor.
 * The file still marks the Suspense boundary that `cacheComponents` needs.
 */
export default function Loading(): null {
  return null;
}
