import type { ReactNode } from 'react';

import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { Wizard } from '@components/shared/wizard';

import enApp from '@i18n/messages/en.json';

vi.mock('@i18n', () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const STEPS = [
  { key: 'basics', label: 'Basics' },
  { key: 'hours', label: 'Opening hours' },
  { key: 'review', label: 'Review' },
];

function Page({ currentKey, children }: { currentKey: string; children?: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={{ app: enApp }} timeZone="UTC">
      <Wizard
        steps={STEPS}
        currentKey={currentKey}
        actions={<button type="button">Next</button>}
        status="Saved in this browser"
      >
        {children ?? <p>fields</p>}
      </Wizard>
    </NextIntlClientProvider>
  );
}

describe('Wizard', () => {
  it('names the step on screen and says how far along it is', () => {
    render(<Page currentKey="hours" />);

    expect(screen.getByRole('heading', { level: 2, name: 'Opening hours' })).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    expect(screen.getByText('fields')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });

  it('marks the current step for assistive technology and says which steps are done', () => {
    render(<Page currentKey="hours" />);

    const steps = within(screen.getByRole('navigation', { name: 'Steps' })).getAllByRole(
      'listitem',
    );
    expect(steps).toHaveLength(3);
    expect(steps[0]).not.toHaveAttribute('aria-current');
    expect(steps[0]).toHaveTextContent('Basics (completed)');
    expect(steps[1]).toHaveAttribute('aria-current', 'step');
    expect(steps[1]).not.toHaveTextContent('completed');
    expect(steps[2]).not.toHaveAttribute('aria-current');
  });

  it('reads out where the work stands in a status region', () => {
    render(<Page currentKey="basics" />);

    expect(screen.getByRole('status')).toHaveTextContent('Saved in this browser');
  });

  it('leaves focus alone on the first render and moves it to the new step heading when the step changes', () => {
    const { rerender } = render(<Page currentKey="basics" />);
    expect(screen.getByRole('heading', { name: 'Basics' })).not.toHaveFocus();

    rerender(<Page currentKey="hours" />);

    expect(screen.getByRole('heading', { name: 'Opening hours' })).toHaveFocus();
  });

  it('does not move focus when it is rendered again for the same step', () => {
    const { rerender } = render(<Page currentKey="basics" />);

    rerender(<Page currentKey="basics">changed fields</Page>);

    expect(screen.getByRole('heading', { name: 'Basics' })).not.toHaveFocus();
  });

  it('draws nothing for a step that is not in the list, instead of a wrong one', () => {
    const { container } = render(<Page currentKey="nowhere" />);

    expect(container).toBeEmptyDOMElement();
  });
});
