import type { ReactNode } from 'react';

import { sectionToneClass } from '@components/layout/layout-primitives';
import type { SectionTone } from '@components/layout/layout-primitives';

import { cn } from '@lib/utils';

export interface SectionBlockProps {
  readonly tone: SectionTone;
  readonly children: ReactNode;
}

/**
 * Groups child components under one background. It adds no padding of its
 * own: the children are sections that already space themselves, and a
 * second layer would double the gap.
 */
export function SectionBlock({ tone, children }: SectionBlockProps) {
  return <div className={cn('w-full', sectionToneClass(tone))}>{children}</div>;
}
