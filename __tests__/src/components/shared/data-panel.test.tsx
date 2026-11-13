import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DataPanel } from '@components/shared/data-panel';

describe('DataPanel', () => {
  it('is a region named by its title, holding the content', () => {
    render(
      <DataPanel title="People" description="Everyone with access">
        <p>rows</p>
      </DataPanel>,
    );

    const region = screen.getByRole('region', { name: 'People' });
    expect(within(region).getByRole('heading', { name: 'People' })).toBeInTheDocument();
    expect(within(region).getByText('Everyone with access')).toBeInTheDocument();
    expect(within(region).getByText('rows')).toBeInTheDocument();
  });

  it('shows the count, the actions and the footer only when given', () => {
    const { rerender } = render(<DataPanel title="People">rows</DataPanel>);
    expect(screen.queryByText('3 people')).not.toBeInTheDocument();

    rerender(
      <DataPanel
        title="People"
        meta="3 people"
        actions={<button type="button">Refresh</button>}
        footer="Page 1"
      >
        rows
      </DataPanel>,
    );
    expect(screen.getByText('3 people')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    expect(screen.getByText('Page 1')).toBeInTheDocument();
  });

  it('adds no page landmarks of its own', () => {
    render(
      <DataPanel title="People" footer="Page 1">
        rows
      </DataPanel>,
    );

    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });
});
