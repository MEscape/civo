import { cn } from '@lib/utils';

import type { PageListItemDto } from '../dto/page-dto';

type OutlineBlock = NonNullable<PageListItemDto['outline']>[number];

export interface PageOutlineProps {
  /** `null` when the page's config could not be read. */
  readonly outline: readonly OutlineBlock[] | null;
}

function Block({ block }: { readonly block: OutlineBlock }) {
  if (block.shape === 'text') {
    return (
      <span className="flex flex-col gap-0.5">
        <span className="h-0.5 w-full rounded-full bg-copy-muted/40" />
        <span className="h-0.5 w-2/3 rounded-full bg-copy-muted/40" />
      </span>
    );
  }
  if (block.shape === 'layout') {
    return (
      <span className="flex gap-0.5">
        {Array.from({ length: block.columns }, (_, index) => (
          <span key={index} className="h-2 flex-1 rounded-sm bg-border-strong" />
        ))}
      </span>
    );
  }
  return <span className="h-2 rounded-sm bg-primary/25" />;
}

/**
 * A page at a glance: its top-level blocks sketched in a few pixels, drawn
 * from the stored tree without rendering a component, so a long list stays
 * fast. Decoration only: the row's title names the page.
 */
export function PageOutline({ outline }: PageOutlineProps) {
  const isBlank = outline === null || outline.length === 0;

  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-11 w-16 shrink-0 flex-col gap-1 overflow-hidden rounded-token-sm border bg-surface p-1.5',
        isBlank ? 'border-dashed border-border-strong' : 'border-border',
      )}
    >
      {outline?.map((block, index) => (
        // eslint-disable-next-line react/no-array-index-key -- a fixed sketch, never reordered: the position is the identity
        <Block key={index} block={block} />
      ))}
    </span>
  );
}
