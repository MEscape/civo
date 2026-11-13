import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getComponentDefinition } from '@modules/component-platform/application/contracts/component-platform-constraints';
import { getContentDefinition } from '@modules/component-platform/domain/content/content-definitions';
import type { LoadContent } from '@modules/component-platform/presentation/components/page-renderer/load-content';
import { StatusBoard } from '@modules/component-platform/presentation/components/smartcity/status-board/status-board';

import { ok } from '@lib/result';
import { isPlainObject } from '@lib/utils';

import { resolveServerComponents } from '../../../support/server-components';

vi.mock('@i18n/server', () => ({
  getTranslations: () => Promise.resolve((key: string) => key),
  getAppFormatters: () => Promise.resolve({ dateTime: (value: string) => value }),
}));

const NOW = '2026-11-06T19:00:00.000Z';

async function display(status: string | undefined, observedAt: string | undefined) {
  const source: LoadContent = (request) =>
    Promise.resolve(
      ok({
        items: getContentDefinition(request.kind)
          .sample(NOW)
          .slice(0, 1)
          .map((item) => (isPlainObject(item) ? { ...item, status, observedAt } : item)),
        origin: { kind: 'live' } as const,
        truncated: false,
      }),
    );
  const element = await StatusBoard({
    props: getComponentDefinition('statusBoard').parseProps({ heading: 'Parking' }),
    context: { websiteId: 'city', mode: 'published' },
    loadContent: source,
  });
  render(await resolveServerComponents(element));
}

describe('source-defined place statuses', () => {
  it('keeps an unfamiliar source status and its exact observation time without inventing a capacity', async () => {
    await display('nur für Berechtigte', NOW);
    expect(screen.getByText('nur für Berechtigte')).toBeVisible();
    expect(screen.getByText(NOW)).toHaveAttribute('datetime', NOW);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText(/free spaces|freie Plätze/i)).not.toBeInTheDocument();
  });
  it('states missing status and time instead of substituting availability or now', async () => {
    await display(undefined, undefined);
    expect(screen.getByText('statusBoard.unknownStatus')).toBeVisible();
    expect(screen.getByText('statusBoard.unknownTime')).toBeVisible();
    expect(screen.queryByText(NOW)).not.toBeInTheDocument();
  });
});
