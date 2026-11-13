import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ArtemisLogo } from '@components/brand/artemis-logo';

describe('ArtemisLogo', () => {
  it('exposes a name only when the logo carries meaning on its own', () => {
    const { rerender, container } = render(<ArtemisLogo title="Artemis Connect" />);
    expect(screen.getByRole('img', { name: 'Artemis Connect' })).toHaveAttribute(
      'focusable',
      'false',
    );
    rerender(<ArtemisLogo variant="mark" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
