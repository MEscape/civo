import { useState } from 'react';

import { COMPONENT_CATEGORIES } from '@modules/component-platform/client';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { useComponentText } from '../../hooks/use-component-text';
import { usePaletteDrag } from '../../hooks/use-palette-drag';
import { CATEGORY_MESSAGE_KEYS } from '../../messages/message-keys';
import { useBuilderDispatch } from '../../state/builder-hooks';
import { insertComponent } from '../../state/editing-thunks';
import { useBuilderSession } from '../builder-session-context';

import { ComponentPreviewPopover } from './component-preview-popover';

import type { CanvasDnd } from '../../hooks/use-canvas-dnd';
import type { ThemeStyle } from '../canvas/canvas-theme-scope';

interface HoveredItem {
  readonly type: string;
  readonly rect: DOMRect;
}

export interface ComponentPaletteProps {
  readonly dnd: CanvasDnd;
  readonly themeStyle: ThemeStyle;
}

const HEADING = 'text-xs font-semibold uppercase tracking-wide text-copy-muted';

/**
 * The component list, read from the catalog (never a second hard-coded
 * list). Two ways to add: click or Enter appends the component where it
 * fits; press-and-drag starts a drag session shared with the canvas, so a
 * component can be dropped straight into a container. The palette is only
 * rendered for sessions that may change the structure.
 */
export function ComponentPalette({ dnd, themeStyle }: ComponentPaletteProps) {
  const t = useTranslations('builder');
  const dispatch = useBuilderDispatch();
  const { catalog } = useBuilderSession();
  const text = useComponentText();
  const palette = usePaletteDrag(dnd);
  const [hovered, setHovered] = useState<HoveredItem | null>(null);

  function showPreview(type: string, element: HTMLElement): void {
    if (!palette.wasDragged()) {
      setHovered({ type, rect: element.getBoundingClientRect() });
    }
  }

  function handleClick(type: string): void {
    // A drag that ends on its own button would still fire a click.
    if (!palette.wasDragged()) {
      dispatch(insertComponent(type));
    }
  }

  return (
    <div className="p-4">
      <h2 className={cn('mb-4', HEADING)}>{t('palette.title')}</h2>
      {COMPONENT_CATEGORIES.map((category) => {
        const items = catalog.descriptors.filter((descriptor) => descriptor.category === category);
        if (items.length === 0) {
          return null;
        }
        return (
          <section key={category} className="mb-5">
            <h3 className={cn('mb-2 font-medium normal-case tracking-normal', HEADING)}>
              {t(CATEGORY_MESSAGE_KEYS[category])}
            </h3>
            <ul className="flex flex-col gap-1">
              {items.map((item) => (
                <li key={item.type}>
                  <button
                    type="button"
                    onPointerDown={(event) => {
                      palette.handlePointerDown(event, item.type);
                    }}
                    onClick={() => {
                      handleClick(item.type);
                    }}
                    onPointerEnter={(event) => {
                      showPreview(item.type, event.currentTarget);
                    }}
                    onFocus={(event) => {
                      showPreview(item.type, event.currentTarget);
                    }}
                    onPointerLeave={() => {
                      setHovered(null);
                    }}
                    onBlur={() => {
                      setHovered(null);
                    }}
                    className="w-full cursor-grab rounded-token-sm px-2.5 py-2 text-left text-sm text-copy hover:bg-canvas focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {text.componentLabel(item.type)}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <ComponentPreviewPopover
        componentType={dnd.session === null ? (hovered?.type ?? null) : null}
        anchorRect={hovered?.rect ?? null}
        themeStyle={themeStyle}
      />
    </div>
  );
}
