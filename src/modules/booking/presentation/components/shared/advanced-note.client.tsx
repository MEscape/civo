'use client';

import type { ComponentProps } from 'react';

import { TextAreaField } from './text-area-field.client';

export interface AdvancedNoteProps extends ComponentProps<typeof TextAreaField> {
  /** The disclosure's name ("Advanced"). */
  readonly title: string;
  /** What is inside it, said quietly after the name ("Internal note"). */
  readonly titleHint: string;
}

/**
 * The internal note of a form, behind a disclosure at the foot of a column, so it never pushes a field
 * that matters out of view and opening it moves nothing above it. The same on every form that has
 * one (services, resources).
 */
export function AdvancedNote({ title, titleHint, ...areaProps }: AdvancedNoteProps) {
  return (
    <details className="self-start rounded-token border border-border bg-surface px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-copy">
        {title} <span className="font-normal text-copy-muted">{titleHint}</span>
      </summary>
      <div className="pt-4">
        <TextAreaField {...areaProps} />
      </div>
    </details>
  );
}
