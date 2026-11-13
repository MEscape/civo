import { screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoverStrip } from '@modules/booking/presentation/components/employee/cover-strip';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import { renderServer } from '../support/server-render';

const mocks = vi.hoisted(() => ({ cover: vi.fn() }));

vi.mock('@i18n/server', () => ({
  getTranslations: () =>
    Promise.resolve(createTranslator({ locale: 'en', messages: enBooking, namespace: 'booking' })),
}));
vi.mock('@modules/booking/composition', () => ({ getBookingQueries: () => ({}) }));
vi.mock('@modules/booking/presentation/loaders/load-employee-administration', () => ({
  loadComingCover: mocks.cover,
}));

const TODAY = '2027-02-01';
const spell = (from: string, to: string) => ({
  locationId: 'loc-2',
  locationName: 'Bürgerbüro West',
  from,
  to,
});
const show = async (cover: { spell: ReturnType<typeof spell>; today: string } | null) => {
  mocks.cover.mockResolvedValue(cover);
  return renderServer(await CoverStrip({ locale: 'en', websiteId: 'site' }));
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the strip that says the person works at another location', () => {
  it('is not there when nothing is coming up', async () => {
    expect((await show(null)).container).toBeEmptyDOMElement();
  });

  it('says where they are today and until when', async () => {
    await show({ spell: spell('2027-01-31', '2027-02-03'), today: TODAY });

    expect(screen.getByRole('status')).toHaveTextContent('Today you work at Bürgerbüro West');
  });

  it('announces a spell that starts later', async () => {
    await show({ spell: spell('2027-02-04', '2027-02-05'), today: TODAY });

    expect(screen.getByRole('status')).toHaveTextContent('you work at Bürgerbüro West');
    expect(screen.getByRole('status')).not.toHaveTextContent('Today');
  });
});
