import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ContentProvenance } from '@modules/component-platform/application/contracts/component-platform-constraints';
import { SourceAttribution } from '@modules/component-platform/presentation/components/shared/source-attribution';

vi.mock('@i18n/server', () => ({
  getNow: () => Promise.resolve(new Date('2026-11-06T12:00:00.000Z')),
  getTranslations: () =>
    Promise.resolve((key: string, values?: { count: number }) =>
      values === undefined ? key : `${key}:${values.count}`,
    ),
  getAppFormatters: () => Promise.resolve({ dateTime: (value: string) => value }),
}));

const SOURCE: ContentProvenance = {
  kind: 'snapshot',
  sourceId: 'source-1',
  sourceUrl: 'https://example.invalid/dataset',
  fetchedAt: '2026-11-06T08:00:00.000Z',
  validUntil: null,
  license: 'Data licence',
  licenseUrl: 'https://example.invalid/license',
  attribution: 'Publisher',
};

describe('source attribution', () => {
  it('keeps the last successful capture visible and identifies an overdue refresh', async () => {
    render(
      await SourceAttribution({ sources: [{ ...SOURCE, validUntil: '2026-11-06T09:00:00.000Z' }] }),
    );
    expect(screen.getByText('provenance.stale')).toBeVisible();
    expect(screen.getByText(SOURCE.fetchedAt)).toHaveAttribute('datetime', SOURCE.fetchedAt);
  });
  it('does not call an in-budget capture stale', async () => {
    render(
      await SourceAttribution({ sources: [{ ...SOURCE, validUntil: '2026-11-06T13:00:00.000Z' }] }),
    );
    expect(screen.queryByText('provenance.stale')).not.toBeInTheDocument();
  });
  it('shows an explicit snapshot date, source and license as usable links', async () => {
    render(await SourceAttribution({ sources: [SOURCE] }));
    expect(screen.getByText('provenance.snapshot')).toBeInTheDocument();
    expect(screen.getByText(SOURCE.fetchedAt)).toHaveAttribute('datetime', SOURCE.fetchedAt);
    expect(screen.getByRole('link', { name: 'Publisher' })).toHaveAttribute(
      'href',
      SOURCE.sourceUrl,
    );
    expect(screen.getByRole('link', { name: 'Data licence' })).toHaveClass('min-h-6');
  });

  it('names one capture once when several datasets of a block come from it', async () => {
    render(await SourceAttribution({ sources: [SOURCE, SOURCE, { ...SOURCE }] }));
    expect(screen.getAllByText('provenance.snapshot')).toHaveLength(1);
  });

  it('does not hide a license when its URL is unavailable', async () => {
    render(await SourceAttribution({ sources: [{ ...SOURCE, licenseUrl: null }] }));
    expect(screen.getByText('Data licence')).toBeInTheDocument();
  });

  it('labels synthetic content and partial results without relying on color', async () => {
    render(
      await SourceAttribution({
        sources: [
          { ...SOURCE, kind: 'synthetic', sourceUrl: null, license: null, licenseUrl: null },
        ],
        rejected: 2,
      }),
    );
    expect(screen.getByText('provenance.synthetic')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('provenance.partial:2');
  });
});
