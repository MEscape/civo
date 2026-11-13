import { fireEvent, render, screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { ChartFigure } from '@modules/component-platform/presentation/components/shared/chart-figure';

import appMessages from '@/i18n/messages/en.json';

vi.mock('@i18n/client', () => ({
  useTranslations: () =>
    createTranslator({ locale: 'en', messages: { app: appMessages }, namespace: 'app' }),
}));

const rows = Array.from({ length: 45 }, (_, index) => [`Point ${index + 1}`, String(index)]);

describe('chart table pagination', () => {
  it('pages the bounded window without hiding values permanently or requesting more data', () => {
    render(
      <ChartFigure
        label="Water"
        showDataLabel="Show data"
        table={{ caption: 'Measurements', columns: ['Time', 'Value'], rows }}
      >
        <div>Chart</div>
      </ChartFigure>,
    );
    fireEvent.click(screen.getByText('Show data'));
    const region = screen.getByRole('region', { name: 'Measurements' });
    expect(within(region).getAllByRole('row')).toHaveLength(21);
    expect(within(region).getByText('Point 1')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(within(region).queryByText('Point 1')).toBeNull();
    expect(within(region).getByText('Point 21')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(within(region).getAllByRole('row')).toHaveLength(6);
    expect(within(region).getByText('Point 45')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(within(region).getByText('Point 21')).toBeVisible();
  });
});
