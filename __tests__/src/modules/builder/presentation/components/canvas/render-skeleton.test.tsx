import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RenderSkeleton } from '@modules/builder/presentation/components/canvas/render-skeleton';

describe('RenderSkeleton', () => {
  it('says once, to assistive technology, that the draft is being rendered', () => {
    render(<RenderSkeleton label="Rendering…" />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('Rendering…');
  });

  it('keeps the blocks out of the accessibility tree', () => {
    const { container } = render(<RenderSkeleton isCompact label="Rendering…" />);

    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
