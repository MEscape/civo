import { toHexColor } from '@lib/utils';

import type { PALETTE_SIZE } from '../../application/contracts/map-constraints';
import type { ResolvedPalette } from '../mapbox/mapbox-layers';

/**
 * The design system's chart tokens (see `globals.css`), by palette slot. DOM
 * elements such as legend swatches use these directly; the Mapbox canvas
 * needs them resolved to concrete colours (`resolvePalette`), so a website's
 * theme colours reach the map too.
 */
export const SERIES_COLOR_VARS = [
  'var(--civo-chart-1)',
  'var(--civo-chart-2)',
  'var(--civo-chart-3)',
  'var(--civo-chart-4)',
  'var(--civo-chart-5)',
  'var(--civo-chart-6)',
] as const satisfies readonly string[] & { length: typeof PALETTE_SIZE };

export const OTHER_COLOR_VAR = 'var(--civo-color-border-strong)';
export const RANGE_LOW_COLOR_VAR = 'var(--civo-chart-3)';
export const RANGE_HIGH_COLOR_VAR = 'var(--civo-chart-1)';
const OUTLINE_COLOR_VAR = 'var(--civo-color-surface)';
const HIGHLIGHT_COLOR_VAR = 'var(--civo-color-accent-copy)';
const ON_CLUSTER_COLOR_VAR = 'var(--civo-color-primary-foreground)';

/** Gradient for the legend's numeric ranges: the same two stops the map interpolates between. */
export const RANGE_GRADIENT = `linear-gradient(to right, ${RANGE_LOW_COLOR_VAR}, ${RANGE_HIGH_COLOR_VAR})`;

const FALLBACK_COLOR = '#000000';

/**
 * Resolves CSS colours (including `var()` and `color-mix()`) to `#rrggbb`.
 * The browser computes the colour, a 1px canvas normalizes any colour space.
 */
class ColorProbe {
  private readonly context = document
    .createElement('canvas')
    .getContext('2d', { willReadFrequently: true });

  constructor(private readonly host: HTMLElement) {}

  resolve(cssColor: string): string {
    const probe = document.createElement('span');
    probe.style.color = cssColor;
    this.host.appendChild(probe);
    const computed = getComputedStyle(probe).color;
    probe.remove();

    const { context } = this;
    if (context === null) {
      return FALLBACK_COLOR;
    }
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = computed;
    context.fillRect(0, 0, 1, 1);
    const [red = 0, green = 0, blue = 0] = context.getImageData(0, 0, 1, 1).data;
    return toHexColor({ red, green, blue });
  }
}

/** Reads the active theme once, when a map is created. */
export function resolvePalette(host: HTMLElement): ResolvedPalette {
  const probe = new ColorProbe(host);
  const resolve = (cssColor: string) => probe.resolve(cssColor);
  return {
    series: SERIES_COLOR_VARS.map(resolve),
    other: resolve(OTHER_COLOR_VAR),
    rangeLow: resolve(RANGE_LOW_COLOR_VAR),
    rangeHigh: resolve(RANGE_HIGH_COLOR_VAR),
    outline: resolve(OUTLINE_COLOR_VAR),
    highlight: resolve(HIGHLIGHT_COLOR_VAR),
    onCluster: resolve(ON_CLUSTER_COLOR_VAR),
  };
}
