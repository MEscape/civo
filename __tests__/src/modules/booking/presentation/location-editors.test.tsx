import { useState } from 'react';

import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import type { DayDto, ExceptionInputDto } from '@modules/booking/client';
import { ExceptionsEditor } from '@modules/booking/presentation/components/locations/exceptions-editor.client';
import { ImpactReviewDialog } from '@modules/booking/presentation/components/shared/impact-review-dialog.client';
import { WeeklyHoursEditor } from '@modules/booking/presentation/components/shared/weekly-hours-editor.client';
import { WEEK_TEMPLATES } from '@modules/booking/presentation/forms/week/templates';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import enApp from '@i18n/messages/en.json';

function Intl({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider
      locale="en"
      messages={{ ...enBooking, app: enApp }}
      timeZone="Europe/Berlin"
    >
      {children}
    </NextIntlClientProvider>
  );
}

const ITEMS = [
  { id: 'b-1', label: 'Mon, 11 Jan, 17:00', detail: 'Outside the new opening hours' },
  { id: 'b-2', label: 'Tue, 12 Jan, 17:30', detail: 'Outside the new opening hours' },
];

function renderDialog(props: Partial<React.ComponentProps<typeof ImpactReviewDialog>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <Intl>
      <ImpactReviewDialog
        open
        total={2}
        changes={['Friday will close at 14:00 instead of 16:00.']}
        items={ITEMS}
        note="Nothing is cancelled."
        confirmLabel="Save anyway"
        onConfirm={onConfirm}
        onCancel={onCancel}
        {...props}
      />
    </Intl>,
  );
  return { onConfirm, onCancel };
}

describe('ImpactReviewDialog', () => {
  it('lists the change in words and the bookings it reaches, and saves only when told to', () => {
    const { onConfirm, onCancel } = renderDialog();

    expect(screen.getByText('2 bookings are affected')).toBeInTheDocument();
    expect(screen.getByText('Friday will close at 14:00 instead of 16:00.')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Affected bookings', hidden: true });
    expect(within(list).getAllByRole('listitem', { hidden: true })).toHaveLength(2);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Save anyway', hidden: true }));
    expect(onConfirm).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Back', hidden: true }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('says when the list was cut short', () => {
    renderDialog({ isTruncated: true });

    expect(screen.getByText('More bookings are affected than can be shown here.')).toBeVisible();
  });

  it('keeps saving shut and counts what is undecided when each booking needs a choice', () => {
    renderDialog({
      choices: [
        { value: 'keep', label: 'Keep' },
        { value: 'cancel', label: 'Cancel it' },
      ],
      choiceOf: { 'b-1': 'keep' },
    });

    const confirm = screen.getByRole('button', {
      name: 'Save anyway (1 booking still undecided)',
      hidden: true,
    });
    expect(confirm).toBeDisabled();
  });
});

function WeekHarness({ onWeek }: { onWeek?: (week: DayDto[]) => void }) {
  const [week, setWeek] = useState<DayDto[]>([...WEEK_TEMPLATES.standardOffice]);
  return (
    <Intl>
      <WeeklyHoursEditor
        value={week}
        errors={{ '0.intervals.0.end': 'Close after opening' }}
        onChange={(next) => {
          setWeek(next);
          onWeek?.(next);
        }}
      />
    </Intl>
  );
}

/** Every row of the week keeps its exact fields closed until asked; these tests read the fields. */
function openExactTimes() {
  for (const button of screen.getAllByRole('button', { name: /^Exact times and copying for/ })) {
    fireEvent.click(button);
  }
}

describe('WeeklyHoursEditor', () => {
  it('shows a day as a bar with its times in words, and the fields only when asked', () => {
    render(<WeekHarness />);

    expect(screen.getAllByRole('slider', { name: /Monday, period 1: start/ })).toHaveLength(1);
    expect(
      screen.queryByRole('textbox', { name: /Tuesday, period 1: start$/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Exact times and copying for Tuesday' }));
    expect(screen.getByRole('textbox', { name: /Tuesday, period 1: start$/ })).toBeInTheDocument();
  });

  it('computes the weekly total from the hours', () => {
    render(<WeekHarness />);

    expect(screen.getByText('Total: 44 h 0 min per week')).toBeInTheDocument();
  });

  it('names every time field by day and period, so it can be reached and read by keyboard and screen reader', () => {
    render(<WeekHarness />);
    openExactTimes();

    expect(screen.getAllByRole('textbox', { name: /period 1: start$/ })).toHaveLength(5);
    expect(screen.getAllByRole('textbox', { name: /break 1: start$/ })).toHaveLength(4);
    // Seven rows of select fields and dialogs are slow to open in a simulated browser.
  }, 45_000);

  it('opens the fields of a row that has a message, and shows it next to the field', () => {
    render(<WeekHarness />);

    const [field] = screen.getAllByRole('textbox', { name: /period 1: end$/ });
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Close after opening')).toBeInTheDocument();
  });

  it('follows an edit at once in the total', () => {
    const onWeek = vi.fn();
    render(<WeekHarness onWeek={onWeek} />);
    fireEvent.click(screen.getByRole('button', { name: 'Exact times and copying for Friday' }));

    const friday = screen.getByRole('textbox', { name: /Friday, period 1: end$/ });
    fireEvent.change(friday, { target: { value: '14:00' } });

    expect(onWeek).toHaveBeenCalled();
    expect(screen.getByText('Total: 42 h 0 min per week')).toBeInTheDocument();
  });

  it('removes a day’s period with the button that names it', () => {
    render(<WeekHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Exact times and copying for Monday' }));

    fireEvent.click(screen.getByRole('button', { name: /^Remove Monday.*, period 1$/ }));

    expect(screen.getByText(/Total: 35 h 0 min per week/)).toBeInTheDocument();
  });
});

const HOLIDAY: ExceptionInputDto = { kind: 'closed', from: '2027-01-01', to: '2027-01-01' };
const SPECIAL: ExceptionInputDto = {
  kind: 'override',
  from: '2027-12-24',
  to: '2027-12-24',
  day: { intervals: [{ start: '08:00', end: '12:00' }], breaks: [] },
};

function ExceptionsHarness({ initial }: { initial: readonly ExceptionInputDto[] }) {
  const [value, setValue] = useState<readonly ExceptionInputDto[]>(initial);
  return (
    <Intl>
      <ExceptionsEditor
        value={value}
        onChange={(next) => {
          setValue(next);
        }}
        errors={{}}
        years={[2027]}
      />
    </Intl>
  );
}

describe('ExceptionsEditor', () => {
  it('says so when there is nothing yet', () => {
    render(<ExceptionsHarness initial={[]} />);

    expect(screen.getByText('No exceptions yet.')).toBeInTheDocument();
  });

  it('counts the exceptions by kind in the filter tabs and filters by them', () => {
    render(<ExceptionsHarness initial={[HOLIDAY, SPECIAL]} />);

    expect(screen.getByRole('button', { name: 'All 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Holidays 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Special hours 1' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Special hours 1' }));
    expect(screen.getByRole('button', { name: 'Special hours 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    const table = screen.getByRole('table', { name: 'Exceptions' });
    expect(within(table).getAllByRole('button', { name: /^Details / })).toHaveLength(1);
  });

  it('asks before an exception is removed, and keeps it when that is declined', () => {
    render(<ExceptionsHarness initial={[HOLIDAY]} />);

    fireEvent.click(screen.getByRole('button', { name: /^Remove: / }));
    const question = screen.getByRole('alertdialog', { name: 'Remove exception?', hidden: true });
    fireEvent.click(within(question).getByRole('button', { name: 'Cancel', hidden: true }));

    expect(screen.getByRole('button', { name: /^Details / })).toBeInTheDocument();
    expect(screen.queryByText('No exceptions yet.')).not.toBeInTheDocument();
  });

  it('adds the holidays of a state as closures, and then adds nothing the second time', () => {
    render(<ExceptionsHarness initial={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Import holidays' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add holidays', hidden: true }));
    expect(screen.getByRole('status')).toHaveTextContent(/holidays added\./);

    fireEvent.click(screen.getByRole('button', { name: 'Import holidays' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add holidays', hidden: true }));
    expect(screen.getByRole('status')).toHaveTextContent(
      'There are no new holidays: every day is already entered.',
    );
  });

  it('adds an exception only when the rules accept it, and says what is missing beside the fields', () => {
    render(<ExceptionsHarness initial={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add exception' }));
    const dialog = screen.getByRole('dialog', { name: 'Add exception', hidden: true });
    expect(within(dialog).queryByText(/Some details need your attention/)).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Add exception', hidden: true }));
    expect(within(dialog).getByText(/Some details need your attention/)).toBeInTheDocument();
    expect(screen.getByText('No exceptions yet.')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByRole('textbox', { name: 'From', hidden: true }), {
      target: { value: '2027-05-05' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add exception', hidden: true }));

    expect(screen.queryByText('No exceptions yet.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Details / })).toBeInTheDocument();
  });

  it('drops the message the moment the exception is put right', () => {
    render(<ExceptionsHarness initial={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add exception' }));
    const dialog = screen.getByRole('dialog', { name: 'Add exception', hidden: true });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add exception', hidden: true }));
    expect(within(dialog).getByText(/Some details need your attention/)).toBeInTheDocument();

    fireEvent.change(within(dialog).getByRole('textbox', { name: 'From', hidden: true }), {
      target: { value: '2027-05-05' },
    });
    expect(within(dialog).queryByText(/Some details need your attention/)).not.toBeInTheDocument();
  });
});
