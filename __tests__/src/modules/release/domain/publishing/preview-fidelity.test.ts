import { describe, expect, it } from 'vitest';

import type { ComponentCatalog } from '@modules/release/domain/ports/component-catalog.port';
import { describePreviewFidelity } from '@modules/release/domain/publishing/preview-fidelity';

describe('how faithfully an old release can be shown', () => {
  const pin = (type: string, version: number) => ({ type, version, contracts: [] });
  const catalog = (current: Record<string, number>): ComponentCatalog => ({
    resolve: (type) =>
      type in current ? { type, version: current[type] ?? 0, contracts: [] } : null,
    defaultProps: () => null,
  });

  it('is exact when every component is at the version the release was built with', () => {
    const fidelity = describePreviewFidelity(
      [pin('hero', 1), pin('news', 2)],
      catalog({ hero: 1, news: 2 }),
    );

    expect(fidelity).toEqual({ status: 'exact', deviations: [] });
  });

  it('says it can look different when components moved on, and names them', () => {
    const fidelity = describePreviewFidelity(
      [pin('hero', 1), pin('news', 2)],
      catalog({ hero: 3, news: 2 }),
    );

    expect(fidelity.status).toBe('changed');
    expect(fidelity.deviations).toEqual([{ type: 'hero', pinnedVersion: 1, currentVersion: 3 }]);
  });

  it('says it cannot be shown as it was when a component is gone, and lists the gone ones first', () => {
    const fidelity = describePreviewFidelity(
      [pin('alpha', 1), pin('zulu', 1)],
      catalog({ alpha: 2 }),
    );

    expect(fidelity.status).toBe('unavailable');
    expect(fidelity.deviations.map((deviation) => deviation.type)).toEqual(['zulu', 'alpha']);
  });
});
