import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RouteErrorPanel } from '@components/page-states/route-error-panel';

describe('RouteErrorPanel', () => {
  it('provides one clear retry action with supplied public-facing text', () => {
    const retry = vi.fn();
    render(
      <RouteErrorPanel
        title="Could not load"
        description="Try again shortly"
        retryLabel="Retry"
        onRetry={retry}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Could not load' })).toBeInTheDocument();
    expect(screen.getByText('Try again shortly')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
