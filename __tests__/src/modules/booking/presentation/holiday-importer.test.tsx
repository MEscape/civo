import { useState } from 'react';

import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ExceptionsEditor } from '@modules/booking/presentation/components/availability/exceptions-editor';
import { NO_ERRORS } from '@modules/booking/presentation/components/shared/form-error-summary';
import type { FormErrors } from '@modules/booking/presentation/components/shared/form-error-summary';
import type { ExceptionForm } from '@modules/booking/presentation/drafts/availability-plan-form';
import {
  groupExceptions,
  holidayProposals,
  withHolidayClosures,
} from '@modules/booking/presentation/drafts/holiday-exceptions';

import { renderBooking, setup } from './ui-support';

const BY_NEW_YEAR: ExceptionForm = {
  kind: 'closed',
  from: '2026-01-01',
  to: '2026-01-01',
  label: null,
  holiday: { key: 'newYear', region: 'BY' },
};

const OWN_CLOSURE: ExceptionForm = {
  kind: 'closed',
  from: '2026-12-24',
  to: '2026-12-24',
  label: 'Christmas Eve',
  holiday: null,
};

const WEEK = Array.from({ length: 7 }, () => ({
  intervals: [{ start: '09:00', end: '17:00' }],
  breaks: [],
}));

function importFor(
  region: 'DE' | 'BY',
  existing: readonly ExceptionForm[],
): readonly ExceptionForm[] {
  return withHolidayClosures(existing, {
    region,
    year: 2026,
    proposals: holidayProposals(region, 2026, existing),
  });
}

describe('holiday proposals', () => {
  it('replace the holidays already imported for the year, whichever state they were for', () => {
    const bavarian = importFor('BY', []);
    const proposals = holidayProposals('DE', 2026, bavarian);

    expect(
      proposals.every((proposal) => proposal.status === 'new' || proposal.status === 'replaces'),
    ).toBe(true);
    expect(proposals.find((proposal) => proposal.key === 'newYear')?.status).toBe('replaces');

    const nationwide = importFor('DE', bavarian);

    expect(nationwide).toHaveLength(9);
    expect(nationwide.every((exception) => exception.holiday?.region === 'DE')).toBe(true);
  });

  it('never touch a day somebody entered by hand and do not add the holiday on it', () => {
    const christmas: ExceptionForm = { ...OWN_CLOSURE, from: '2026-12-25', to: '2026-12-27' };
    const proposals = holidayProposals('DE', 2026, [christmas]);

    expect(proposals.find((proposal) => proposal.key === 'christmasDay')?.status).toBe('covered');
    expect(proposals.find((proposal) => proposal.key === 'boxingDay')?.status).toBe('covered');

    const applied = importFor('DE', [christmas]);

    expect(applied[0]).toEqual(christmas);
    expect(applied.some((exception) => exception.holiday?.key === 'christmasDay')).toBe(false);
    expect(applied).toHaveLength(1 + 7);
  });

  it('keep the other years and what was entered by hand when replacing', () => {
    const lastYear: ExceptionForm = { ...BY_NEW_YEAR, from: '2025-01-01', to: '2025-01-01' };
    const applied = importFor('DE', [OWN_CLOSURE, lastYear, BY_NEW_YEAR]);

    expect(applied).toContainEqual(OWN_CLOSURE);
    expect(applied).toContainEqual(lastYear);
    expect(applied.filter((exception) => exception.from.startsWith('2026-01-01'))).toHaveLength(1);
  });

  it('are named by whoever looks, never stored in a language', () => {
    expect(importFor('DE', []).every((exception) => exception.label === null)).toBe(true);
  });
});

describe('exception groups', () => {
  it('keep what was entered by hand apart from the holidays of each state and year', () => {
    const { own, groups } = groupExceptions([OWN_CLOSURE, BY_NEW_YEAR, ...importFor('DE', [])]);

    expect(own.map((entry) => entry.index)).toEqual([0]);
    expect(groups.map((group) => `${group.region}-${group.year}`)).toEqual(['BY-2026', 'DE-2026']);
  });
});

function Harness({
  initial = [],
  errors = NO_ERRORS,
}: {
  readonly initial?: ExceptionForm[];
  readonly errors?: FormErrors;
}) {
  const [exceptions, setExceptions] = useState<ExceptionForm[]>(initial);
  return (
    <>
      <ExceptionsEditor
        exceptions={exceptions}
        weekly={WEEK}
        disabled={false}
        errors={errors}
        errorPath="openingHours"
        onChange={setExceptions}
      />
      <output aria-label="closures">
        {exceptions.map((exception) => exception.from).join(',')}
      </output>
    </>
  );
}

describe('adding public holidays to the opening hours', () => {
  it('shows the days for the chosen state and changes nothing until they are added', async () => {
    const user = setup();
    renderBooking(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Add public holidays …' }));

    expect(screen.getByRole('region', { name: 'Public holidays' })).toBeInTheDocument();
    expect(screen.getByText('Good Friday')).toBeInTheDocument();
    expect(screen.queryByText('Epiphany')).toBeNull();
    expect(screen.getByLabelText('closures')).toHaveTextContent('');
  });

  it('adds them as one group that can be opened and removed in one step', async () => {
    const user = setup();
    renderBooking(<Harness initial={[OWN_CLOSURE]} />);
    await user.click(screen.getByRole('button', { name: 'Add public holidays …' }));
    await user.click(screen.getByRole('button', { name: /Add 9 holidays as closures/ }));

    expect(screen.getByLabelText('closures').textContent?.split(',')).toHaveLength(10);
    expect(screen.getByText(/Public holidays \d{4}: Nationwide/)).toBeInTheDocument();
    expect(screen.getByText('9 days')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show days' }));
    expect(screen.getByText('Good Friday')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove all' }));
    expect(screen.getByLabelText('closures')).toHaveTextContent('2026-12-24');
  });

  it('can be closed without changing anything', async () => {
    const user = setup();
    renderBooking(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Add public holidays …' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('region', { name: 'Public holidays' })).toBeNull();
    expect(screen.getByLabelText('closures')).toHaveTextContent('');
  });
});

describe('the exceptions list', () => {
  const MANY: ExceptionForm[] = Array.from({ length: 8 }, (_, day) => ({
    ...OWN_CLOSURE,
    from: `2026-11-${String(day + 1).padStart(2, '0')}`,
    to: `2026-11-${String(day + 1).padStart(2, '0')}`,
  }));

  it('shows a few at a time', async () => {
    const user = setup();
    renderBooking(<Harness initial={MANY} />);

    expect(screen.getAllByRole('listitem', { name: /Exception \d/ })).toHaveLength(5);

    await user.click(screen.getByRole('button', { name: 'Show 3 more' }));

    expect(screen.getAllByRole('listitem', { name: /Exception \d/ })).toHaveLength(8);
  });

  it('keeps an exception with a problem in view and marks it', () => {
    renderBooking(
      <Harness
        initial={MANY}
        errors={{
          fields: { 'openingHours.exceptions.7.from': ['booking.validation.date_invalid'] },
          formCode: null,
        }}
      />,
    );

    const row = screen.getByRole('listitem', { name: 'Exception 8' });
    expect(within(row).getByText('Needs attention')).toBeInTheDocument();
    expect(within(row).getByText('Please enter a valid date.')).toBeInTheDocument();
  });

  function previewButton(position: number): HTMLElement {
    const button = screen.getAllByRole('button', { name: 'Preview' })[position];
    if (button === undefined) {
      throw new Error(`no preview button at ${position}`);
    }
    return button;
  }

  it('opens the preview of one exception at a time', async () => {
    const user = setup();
    renderBooking(<Harness initial={MANY.slice(0, 2)} />);

    await user.click(previewButton(0));
    expect(screen.getAllByText('With this exception')).toHaveLength(1);

    await user.click(previewButton(0));

    // The first preview closed as the second opened: still one preview.
    expect(screen.getAllByText('With this exception')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Hide preview' })).toHaveLength(1);
  });
});
