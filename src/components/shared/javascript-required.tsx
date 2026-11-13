/**
 * Shown only when scripting is off, for screens that cannot work without it
 * (sign-in, administration). Place it outside any Suspense boundary: a
 * streamed segment stays hidden without scripts. Public pages render complete
 * HTML and do not use it.
 */
export function JavaScriptRequired({ message }: { readonly message: string }) {
  return (
    <noscript>
      <p className="mx-auto w-full max-w-7xl px-6 py-12 text-copy">{message}</p>
    </noscript>
  );
}
