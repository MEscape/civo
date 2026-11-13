import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MapCanvas } from '@components/shared/map-canvas';

import type { MapLifecycle } from '@hooks/use-map-renderer';

/** A map that stays "loading" until the test says its first tiles are drawn. */
function pendingMap() {
  const lifecycle: { current: MapLifecycle | null } = { current: null };
  const mount = vi.fn((_host: HTMLElement, next: MapLifecycle) => {
    lifecycle.current = next;
    return Promise.resolve({ destroy: vi.fn() });
  });
  return { mount, lifecycle };
}

describe('MapCanvas', () => {
  it('covers the map with a blurred placeholder until the first tiles are drawn', async () => {
    const { mount } = pendingMap();
    render(<MapCanvas mount={mount} synchronize={vi.fn()} loadingLabel="Loading map…" />);
    await waitFor(() => {
      expect(mount).toHaveBeenCalledTimes(1);
    });

    const overlay = screen.getByRole('status');
    expect(overlay).toHaveTextContent('Loading map…');
    expect(overlay).toHaveAttribute('data-state', 'loading');
    expect(overlay).toHaveClass('opacity-100', 'backdrop-blur-md');
  });

  it('fades the placeholder out on its own layer instead of removing it', async () => {
    const { mount, lifecycle } = pendingMap();
    const { container } = render(
      <MapCanvas mount={mount} synchronize={vi.fn()} loadingLabel="Loading map…" />,
    );
    await waitFor(() => {
      expect(lifecycle.current).not.toBeNull();
    });

    act(() => {
      lifecycle.current?.onReady();
    });

    const overlay = container.querySelector('[data-state]');
    expect(overlay).toHaveAttribute('data-state', 'ready');
    // Opacity is composited by the browser; the layer is promoted ahead of the transition.
    expect(overlay).toHaveClass(
      'opacity-0',
      'pointer-events-none',
      'transition-opacity',
      'will-change-[opacity]',
      'motion-reduce:transition-none',
    );
    expect(overlay).toHaveAttribute('aria-hidden', 'true');
    expect(overlay).toBeEmptyDOMElement();
  });

  describe('placeholder picture', () => {
    const SRC =
      'https://api.mapbox.com/styles/v1/acme/light/static/0,20,1/640x400@2x?access_token=pk.test';

    function renderWithPicture(src: string | null | undefined) {
      const { mount, lifecycle } = pendingMap();
      const view = render(
        <MapCanvas
          mount={mount}
          synchronize={vi.fn()}
          loadingLabel="Loading map…"
          placeholderSrc={src}
        />,
      );
      return { ...view, lifecycle, picture: () => view.container.querySelector('img') };
    }

    it('blurs a still of the starting view under the loading note, and shows it once loaded', () => {
      const { picture } = renderWithPicture(SRC);

      const image = picture();
      expect(image).toHaveAttribute('src', SRC);
      expect(image).toHaveAttribute('alt', '');
      expect(image).toHaveClass('blur-xl', 'opacity-0');

      fireEvent.load(image!);

      expect(picture()).toHaveClass('opacity-100');
      expect(screen.getByRole('status')).toHaveTextContent('Loading map…');
    });

    it('drops a picture that cannot load, leaving the plain frosted cover', () => {
      const { picture } = renderWithPicture(SRC);

      fireEvent.error(picture()!);

      expect(picture()).toBeNull();
      expect(screen.getByRole('status')).toHaveAttribute('data-state', 'loading');
    });

    it.each([null, undefined])('draws no picture without a source (%s)', (src) => {
      const { picture } = renderWithPicture(src);

      expect(picture()).toBeNull();
    });

    it('fades the picture out with the rest of the cover once the map is ready', async () => {
      const { lifecycle, container } = renderWithPicture(SRC);
      await waitFor(() => {
        expect(lifecycle.current).not.toBeNull();
      });

      act(() => {
        lifecycle.current?.onReady();
      });

      expect(container.querySelector('[data-state]')).toHaveClass('opacity-0');
    });
  });
});
