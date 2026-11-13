import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getComponentDefinition } from '@modules/component-platform/application/contracts/component-platform-constraints';
import { OpeningHours } from '@modules/component-platform/presentation/components/civic/opening-hours/opening-hours';
import type { LoadContent } from '@modules/component-platform/presentation/components/page-renderer/load-content';

import { ok } from '@lib/result';

import { resolveServerComponents } from '../../../support/server-components';

vi.mock('@i18n/server', () => ({
  getTranslations: () =>
    Promise.resolve((key: string, values?: { from: string; to: string }) =>
      values === undefined ? key : `${values.from}–${values.to}`,
    ),
}));

async function display(items: ReadonlyArray<Record<string, unknown>>) {
  const source: LoadContent = () =>
    Promise.resolve(ok({ items, origin: { kind: 'live' } as const, truncated: false }) as never);
  const element = await OpeningHours({
    props: getComponentDefinition('openingHours').parseProps({ heading: 'Hours' }),
    context: { websiteId: 'city', mode: 'published' },
    loadContent: source,
  });
  render(await resolveServerComponents(element));
}

describe('OpeningHours', () => {
  it('shows a day with a midday break as one row with both periods', async () => {
    await display([
      { id: 'mon-0', day: 'mon', closed: false, opensAt: '07:20', closesAt: '13:00' },
      { id: 'mon-1', day: 'mon', closed: false, opensAt: '14:00', closesAt: '15:00' },
      { id: 'wed-0', day: 'wed', closed: true },
    ]);

    const monday = screen.getByText('openingHours.days.mon').parentElement;
    expect(monday).not.toBeNull();
    const hours = within(monday!).getByRole('definition');
    expect(hours).toHaveTextContent('07:20–13:0014:00–15:00');
    expect(screen.getAllByRole('term')).toHaveLength(2);
    expect(screen.getByText('openingHours.closed')).toBeVisible();
  });
});
