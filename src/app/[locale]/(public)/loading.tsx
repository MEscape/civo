/**
 * Deliberately empty. A published website streams its own parts (data
 * components bring their own skeletons), and a route-level screen would flash
 * a layout that matches no site. The file still marks the Suspense boundary
 * that `cacheComponents` needs.
 */
export default function Loading(): null {
  return null;
}
