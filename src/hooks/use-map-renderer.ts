'use client';

import { useEffect, useRef, useState } from 'react';

export interface MapController {
  destroy(): void;
  resize?(): void;
}

export interface MapLifecycle {
  readonly isActive: () => boolean;
  readonly onReady: () => void;
  readonly onFailure: () => void;
}

export type MountMap<T extends MapController> = (
  host: HTMLElement,
  lifecycle: MapLifecycle,
) => Promise<T>;

/** Synchronizes a browser map with its host; late initialization cannot outlive cleanup or a newer renderer. */
export function useMapRenderer<T extends MapController>(
  mount: MountMap<T>,
  synchronize: (renderer: T) => void,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderer, setRenderer] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const live = useRef<T | null>(null);

  useEffect(() => {
    const slot = containerRef.current;
    if (slot === null) {
      return;
    }
    // Strict Mode and suspended subtrees may overlap initialization. Every instance owns an empty host.
    const host = document.createElement('div');
    host.className = 'h-full w-full';
    slot.appendChild(host);
    let isCancelled = false;
    let created: T | null = null;
    setIsLoading(true);
    const settled = () => {
      if (!isCancelled) {
        setIsLoading(false);
      }
    };
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => created?.resize?.());
    observer?.observe(host);
    void mount(host, { isActive: () => !isCancelled, onReady: settled, onFailure: settled })
      .then((instance) => {
        if (isCancelled) {
          instance.destroy();
          host.remove();
          return;
        }
        created = instance;
        live.current = instance;
        setRenderer(instance);
      })
      .catch(settled);
    return () => {
      isCancelled = true;
      observer?.disconnect();
      live.current = null;
      created?.destroy();
      host.remove();
    };
  }, [mount]);

  useEffect(() => {
    if (renderer !== null && live.current === renderer) {
      synchronize(renderer);
    }
  }, [renderer, synchronize]);

  return { containerRef, isLoading };
}
