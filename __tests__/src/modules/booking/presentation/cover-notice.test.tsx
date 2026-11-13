import { screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { CoverNotice } from '@modules/booking/presentation/components/employee/cover-notice';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import { expectNoViolations } from '../../../support/a11y';
import { renderServer } from '../support/server-render';

vi.mock('@i18n/server', () => ({
  getTranslations: () =>
    Promise.resolve(createTranslator({ locale: 'en', messages: enBooking, namespace: 'booking' })),
}));

const spell = (from: string, to: string) => ({
  locationId: 'loc-2',
  locationName: 'Bürgerbüro West',
  from,
  to,
});
const TODAY = '2027-02-01';

const show = async (coverage: Array<ReturnType<typeof spell>>) =>
  renderServer(await CoverNotice({ locale: 'en', coverage, today: TODAY }));

describe('telling an employee they work at another location', () => {
  it('says nothing when nothing is coming up', async () => {
    const { container } = await show([
      spell('2027-01-20', '2027-01-25'),
      spell('2027-03-01', '2027-03-02'),
    ]);

    expect(container).toBeEmptyDOMElement();
  });

  it('says where they are today, as a warning of its own', async () => {
    const { container } = await show([spell('2027-01-30', '2027-02-03')]);

    expect(screen.getByText('Today you work at Bürgerbüro West')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Bürgerbüro West');
    await expectNoViolations(container);
  });

  it('announces a spell in the next two weeks with its days', async () => {
    await show([spell('2027-02-10', '2027-02-12')]);

    expect(screen.getByText('You will work at Bürgerbüro West')).toBeInTheDocument();
    expect(screen.getByText(/Bürgerbüro West: .*10.*12/)).toBeInTheDocument();
  });
});
