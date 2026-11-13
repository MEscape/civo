import type { IndicatorRect } from '../../dnd/canvas-drag-controller';

export interface DropIndicatorProps {
  readonly rect: IndicatorRect | null;
}

/**
 * A restrained insertion line for before/after, and a filled, dashed highlight for dropping
 * inside a container: both intentionally distinct from the selection and hover outlines, so a
 * person never confuses "this is selected" with "this is where your drag will land".
 */
const VARIANT_CLASS = {
  before: 'bg-accent ring-1 ring-accent/40',
  after: 'bg-accent ring-1 ring-accent/40',
  inside: 'bg-accent/10 outline-2 -outline-offset-2 outline-dashed outline-accent',
} as const satisfies Record<IndicatorRect['position'], string>;

/**
 * Where a drag would land: an insertion line for before/after, a
 * highlighted region for "inside". Decorative; keyboard users get the same
 * information from `DragAnnouncer`.
 */
export function DropIndicator({ rect }: DropIndicatorProps) {
  if (rect === null) {
    return null;
  }
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute z-20 rounded-sm ${VARIANT_CLASS[rect.position]}`}
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      }}
    />
  );
}
