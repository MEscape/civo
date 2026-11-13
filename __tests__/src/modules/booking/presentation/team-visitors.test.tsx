import { screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { TeamVisitors } from '@modules/booking/presentation/components/team/team-visitors';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import enApp from '@i18n/messages/en.json';

import { expectNoViolations } from '../../../support/a11y';
import { renderServer } from '../support/server-render';

vi.mock('@i18n/server', () => ({
  getTranslations: ({ namespace }: { namespace: 'booking' | 'app' }) =>
    Promise.resolve(
      createTranslator({
        locale: 'en',
        messages: { ...enBooking, app: enApp },
        namespace,
      } as never),
    ),
}));
vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const VISITORS = [
  {
    id: 'e-1',
    name: 'Anna Müller',
    home: { id: 'loc-mitte', name: 'Bürgerbüro Mitte' },
    from: '2027-02-01',
    to: '2027-02-03',
  },
  {
    id: 'e-2',
    name: 'Ben Koch',
    home: { id: 'loc-ost', name: 'Bürgerbüro Ost' },
    from: '2027-02-02',
    to: '2027-02-02',
  },
];

describe('the employees of other locations who work here for some days', () => {
  it('draws nothing while there are none', async () => {
    const { container } = await renderServer(
      await TeamVisitors({ locale: 'en', websiteId: 'site', visitors: [] }),
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('names who, where they belong and when, with the way to their own calendar', async () => {
    const { container } = await renderServer(
      await TeamVisitors({ locale: 'en', websiteId: 'site', visitors: VISITORS }),
    );

    expect(screen.getByRole('heading', { name: 'Working here for some days' })).toBeInTheDocument();
    expect(screen.getByText('Anna Müller')).toBeInTheDocument();
    expect(screen.getByText('Bürgerbüro Mitte')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open calendar: Ben Koch' })).toHaveAttribute(
      'href',
      '/bookings/site/locations/loc-ost/team/e-2',
    );
    await expectNoViolations(container);
  });
});
