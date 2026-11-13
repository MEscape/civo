'use client';

import { useEffect, useRef, useState } from 'react';

import { useMapRenderer } from '@hooks/use-map-renderer';
import type { MapController, MountMap } from '@hooks/use-map-renderer';

import { cn } from '@lib/utils';

interface MapCanvasProps<T extends MapController> {
  readonly mount: MountMap<T>;
  readonly synchronize: (renderer: T) => void;
  readonly loadingLabel: string;
  /**
   * A still picture of the map's starting view, shown blurred under the loading note until the
   * first tiles are drawn. Optional: without it, or when it cannot load, the plain frosted cover
   * is what visitors see.
   */
  readonly placeholderSrc?: string | null | undefined;
}

/** Decorative picture that fades in once it has loaded and is dropped when it fails: never a broken-image icon. */
function PlaceholderImage({ src }: { readonly src: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<'pending' | 'loaded' | 'failed'>('pending');
  // A cached picture can finish before this component hydrates, and then no load event follows.
  useEffect(() => {
    if (ref.current?.complete === true && ref.current.naturalWidth > 0) {
      setState('loaded');
    }
  }, []);
  if (state === 'failed') {
    return null;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a remote, blurred, decorative still; optimization would only add a hop
    <img
      ref={ref}
      src={src}
      alt=""
      aria-hidden="true"
      decoding="async"
      referrerPolicy="origin"
      onLoad={() => {
        setState('loaded');
      }}
      onError={() => {
        setState('failed');
      }}
      className={cn(
        'absolute inset-0 size-full scale-110 object-cover blur-xl',
        'transition-opacity duration-300 motion-reduce:transition-none',
        state === 'loaded' ? 'opacity-100' : 'opacity-0',
      )}
    />
  );
}

/**
 * Reusable map host for public maps and editor previews. The caller owns its renderer, records and
 * translated labels.
 *
 * Until the first tiles are drawn a blurred placeholder covers the host, so the map never shows a
 * half-painted frame. It stays mounted (its label does not) and only fades its opacity, which the
 * browser composites on its own layer: no layout or paint work, and no flash when the tiles arrive.
 */
export function MapCanvas<T extends MapController>({
  mount,
  synchronize,
  loadingLabel,
  placeholderSrc,
}: MapCanvasProps<T>) {
  const { containerRef, isLoading } = useMapRenderer(mount, synchronize);
  return (
    <div className="relative h-full w-full" aria-busy={isLoading}>
      <div ref={containerRef} className="h-full w-full" />
      <div
        role="status"
        aria-hidden={!isLoading}
        data-state={isLoading ? 'loading' : 'ready'}
        className={cn(
          'absolute inset-0 flex items-center justify-center overflow-hidden bg-canvas/70 text-sm text-copy-muted backdrop-blur-md',
          'transition-opacity duration-500 ease-out will-change-[opacity] motion-reduce:transition-none',
          isLoading ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        {placeholderSrc !== null && placeholderSrc !== undefined && (
          <PlaceholderImage src={placeholderSrc} />
        )}
        {isLoading && (
          <span className="relative animate-pulse rounded-token bg-canvas/80 px-3 py-1 motion-reduce:animate-none">
            {loadingLabel}
          </span>
        )}
      </div>
    </div>
  );
}
