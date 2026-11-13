import { useState } from 'react';

import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import type { ExceptionInputDto } from '@modules/booking/client';
import { PeriodsEditor } from '@modules/booking/presentation/components/shared/periods-editor.client';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import enApp from '@i18n/messages/en.json';

import { expectNoViolations } from '../../../support/a11y';

const day = (from: string, to = from): ExceptionInputDto => ({ kind: 'closed', from, to });

function Harness({
  initial,
  words = 'resources.form.blocks',
  errors = {},
}: {
  initial: readonly ExceptionInputDto[];
  words?: 'resources.form.blocks' | 'team.absences';
  errors?: Record<string, string>;
}) {
  const [value, setValue] = useState<readonly ExceptionInputDto[]>(initial);
  return (
    <NextIntlClientProvider
      locale="en"
      messages={{ ...enBooking, app: enApp }}
      timeZone="Europe/Berlin"
    >
      <PeriodsEditor
        words={words}
        value={value}
        errors={errors}
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

describe('the closed periods of a resource or an employee', () => {
  it('says so when there are none, in the words of what they are', () => {
    const view = render(<Harness initial={[]} />);
    expect(screen.getByText('No blocked periods')).toBeInTheDocument();
    view.unmount();

    render(<Harness initial={[]} words="team.absences" />);
    expect(screen.getByText('No absences')).toBeInTheDocument();
  });

  it('adds a period only through the dialog, which says what is missing and keeps the list clean', async () => {
    const { container } = render(<Harness initial={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add blocked period' }));
    const dialog = screen.getByRole('dialog', { name: 'Block a period', hidden: true });
    expect(within(dialog).queryByRole('combobox', { hidden: true })).toBeNull();
    expect(within(dialog).queryByText(/Some details need your attention/)).toBeNull();

    // Nothing filled: it does not go on, it says why, and nothing was added to the list.
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Add blocked period', hidden: true }),
    );
    expect(within(dialog).getByText(/Some details need your attention/)).toBeInTheDocument();
    expect(rows()).toHaveLength(0);
    expect(screen.getByText('No blocked periods')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByRole('textbox', { name: 'From', hidden: true }), {
      target: { value: '2027-05-05' },
    });
    expect(within(dialog).queryByText(/Some details need your attention/)).toBeNull();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Add blocked period', hidden: true }),
    );

    expect(rows()).toHaveLength(1);
    expect(screen.queryByText('No blocked periods')).toBeNull();
    await expectNoViolations(container);
  });

  it('never leaves a blank row behind, however often the dialog is opened and left', () => {
    render(<Harness initial={[]} />);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Add blocked period' }));
      const dialog = screen.getByRole('dialog', { name: 'Block a period', hidden: true });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel', hidden: true }));
    }

    expect(rows()).toHaveLength(0);
  });

  it('refuses a period that ends before it begins, beside the field, and adds nothing', () => {
    render(<Harness initial={[day('2027-05-05')]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add blocked period' }));
    const dialog = screen.getByRole('dialog', { name: 'Block a period', hidden: true });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'From', hidden: true }), {
      target: { value: '2027-05-20' },
    });
    fireEvent.change(
      within(dialog).getByRole('textbox', { name: 'Until (included)', hidden: true }),
      { target: { value: '2027-05-10' } },
    );
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Add blocked period', hidden: true }),
    );

    expect(within(dialog).getByText(/Some details need your attention/)).toBeInTheDocument();
    expect(rows()).toHaveLength(1);
  });

  it('changes a period in the same dialog, and shows the server’s message on its row', () => {
    render(
      <Harness
        initial={[day('2027-05-05')]}
        errors={{ '0.from': 'This day is already blocked.' }}
      />,
    );
    expect(screen.getByText('This day is already blocked.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Details / }));
    const dialog = screen.getByRole('dialog', { name: 'Change blocked period', hidden: true });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'From', hidden: true }), {
      target: { value: '2027-06-01' },
    });
    fireEvent.change(
      within(dialog).getByRole('textbox', { name: 'Until (included)', hidden: true }),
      {
        target: { value: '2027-06-03' },
      },
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save exception', hidden: true }));

    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent(/June 1, 2027/);
  });

  it('asks before a period is removed, and keeps it when that is declined', () => {
    render(<Harness initial={[day('2027-05-05')]} />);

    fireEvent.click(screen.getByRole('button', { name: /^Remove: / }));
    const question = screen.getByRole('alertdialog', {
      name: 'Remove blocked period?',
      hidden: true,
    });
    fireEvent.click(within(question).getByRole('button', { name: 'Cancel', hidden: true }));
    expect(rows()).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /^Remove: / }));
    fireEvent.click(
      within(
        screen.getByRole('alertdialog', { name: 'Remove blocked period?', hidden: true }),
      ).getByRole('button', { name: 'Remove', hidden: true }),
    );
    expect(rows()).toHaveLength(0);
  });

  it('pages a long list like the other lists do, without growing the form with it', () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      day(`2027-06-${String(index + 1).padStart(2, '0')}`),
    );
    render(<Harness initial={many} />);

    expect(rows()).toHaveLength(10);
    expect(screen.getByText('Showing 1–10 of 12')).toBeInTheDocument();
    const pager = screen.getByRole('navigation', { name: 'Pages of exceptions' });
    expect(within(pager).getByRole('button', { name: 'Previous' })).toBeDisabled();
    fireEvent.click(within(pager).getByRole('button', { name: 'Page 2' }));

    expect(rows()).toHaveLength(2);
    expect(screen.getByText('Showing 11–12 of 12')).toBeInTheDocument();
    expect(within(pager).getByRole('button', { name: 'Page 2' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(pager).getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('shows no pager for a short list', () => {
    render(<Harness initial={[day('2027-05-05')]} />);
    expect(screen.queryByRole('navigation', { name: 'Pages of exceptions' })).toBeNull();
  });
});
