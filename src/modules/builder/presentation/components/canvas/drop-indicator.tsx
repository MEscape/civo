import type { IndicatorRect } from '../../dnd/canvas-drag-controller';

export interface DropIndicatorProps {
  readonly rect: IndicatorRect | null;
}

const VARIANT_CLASS = {
  before: 'civo-drop-indicator--line',
  after: 'civo-drop-indicator--line',
  inside: 'civo-drop-indicator--inside',
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
      className={`civo-drop-indicator ${VARIANT_CLASS[rect.position]}`}
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      }}
    />
  );
}
