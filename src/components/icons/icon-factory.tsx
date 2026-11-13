import type { ReactNode } from 'react';

import type { IconProps } from '../../types/icons';

/**
 * Every icon shares one 24x24 stroke canvas (the Lucide grid, ISC licence),
 * so only the shapes differ. Callers pass `className`, `aria-hidden` or an
 * accessible name through `props`.
 */
export function strokeIcon(shapes: ReactNode) {
  return function StrokeIcon(props: IconProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        {shapes}
      </svg>
    );
  };
}
