import { useState } from 'react';

import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { CoverageEditor } from '@modules/booking/presentation/components/team/coverage-editor.client';
import type { CoverageInputDto } from '@modules/booking/presentation/dto/team-dto';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import enApp from '@i18n/messages/en.json';

const CHOICES = [
  { id: 'loc-west', name: 'Bürgerbüro West' },
  { id: 'loc-ost', name: 'Bürgerbüro Ost' },
];

function Harness({ initial }: { initial: readonly CoverageInputDto[] }) {
  const [value, setValue] = useState<readonly CoverageInputDto[]>(initial);
  return (
    <NextIntlClientProvider
      locale="en"
      messages={{ ...enBooking, app: enApp }}
      timeZone="Europe/Berlin"
    >
      <CoverageEditor
        value={value}
        home="loc-mitte"
        choices={CHOICES}
        onChange={(next) => {
          setValue(next);
        }}
      />
    </NextIntlClientProvider>
  );
}

const rows = () =>
  screen
    .queryAllByRole('row')
    .filter((row) => within(row).queryAllByRole('columnheader').length === 0);

describe('where a manager sends an employee for some days', () => {
  it('says so when the person is not sent anywhere', () => {
    render(<Harness initial={[]} />);

    expect(screen.getByText('Not sent to another location')).toBeInTheDocument();
  });

  it('lists a spell with its place and its days', () => {
    render(
      <Harness initial={[{ locationId: 'loc-west', from: '2027-02-01', to: '2027-02-03' }]} />,
    );

    expect(screen.getByText('Bürgerbüro West')).toBeInTheDocument();
    expect(rows()).toHaveLength(1);
  });

  it('adds one only through the dialog, which says what is missing and keeps the list clean', () => {
    render(<Harness initial={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Send to a location' }));
    const dialog = screen.getByRole('dialog', { name: 'Send to another location', hidden: true });
    expect(within(dialog).queryByText(/Some details need your attention/)).toBeNull();

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Send to a location', hidden: true }),
    );

    expect(within(dialog).getByText(/Some details need your attention/)).toBeInTheDocument();
    expect(rows()).toHaveLength(0);
  });

  it('refuses days in the wrong order and names the field', () => {
    render(<Harness initial={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send to a location' }));
    const dialog = screen.getByRole('dialog', { name: 'Send to another location', hidden: true });

    fireEvent.click(within(dialog).getByRole('combobox', { hidden: true }));
    fireEvent.click(screen.getByRole('option', { name: 'Bürgerbüro West', hidden: true }));
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'From', hidden: true }), {
      target: { value: '2027-02-05' },
    });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'To', hidden: true }), {
      target: { value: '2027-02-01' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Send to a location', hidden: true }),
    );

    expect(within(dialog).getAllByText('Please choose a valid period.').length).toBeGreaterThan(0);
    expect(rows()).toHaveLength(0);
  });

  it('refuses two spells on one day, because a person is in one place at a time', () => {
    render(
      <Harness initial={[{ locationId: 'loc-west', from: '2027-02-01', to: '2027-02-05' }]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send to a location' }));
    const dialog = screen.getByRole('dialog', { name: 'Send to another location', hidden: true });

    fireEvent.click(within(dialog).getByRole('combobox', { hidden: true }));
    fireEvent.click(screen.getByRole('option', { name: 'Bürgerbüro Ost', hidden: true }));
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'From', hidden: true }), {
      target: { value: '2027-02-04' },
    });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'To', hidden: true }), {
      target: { value: '2027-02-08' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Send to a location', hidden: true }),
    );

    expect(within(dialog).getByText(/cannot be at two locations on one day/)).toBeInTheDocument();
    expect(rows()).toHaveLength(1);
  });

  it('adds a valid spell and takes it away again after asking', () => {
    render(<Harness initial={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send to a location' }));
    const dialog = screen.getByRole('dialog', { name: 'Send to another location', hidden: true });

    fireEvent.click(within(dialog).getByRole('combobox', { hidden: true }));
    fireEvent.click(screen.getByRole('option', { name: 'Bürgerbüro West', hidden: true }));
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'From', hidden: true }), {
      target: { value: '2027-02-01' },
    });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'To', hidden: true }), {
      target: { value: '2027-02-03' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Send to a location', hidden: true }),
    );

    expect(rows()).toHaveLength(1);
    expect(screen.getByText('Bürgerbüro West')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove the cover at Bürgerbüro West' }));
    const question = screen.getByRole('alertdialog', { name: 'Remove this cover?', hidden: true });
    fireEvent.click(within(question).getByRole('button', { name: 'Remove', hidden: true }));

    expect(rows()).toHaveLength(0);
  });
});
