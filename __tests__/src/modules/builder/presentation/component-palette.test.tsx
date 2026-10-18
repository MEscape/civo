import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ComponentCatalog } from '@modules/builder/application/contracts/editor-model';
import { ComponentPalette } from '@modules/builder/presentation/components/palette/component-palette';
import type { ComponentPreviewPopoverProps } from '@modules/builder/presentation/components/palette/component-preview-popover';
import enBuilder from '@modules/builder/presentation/i18n/en.json';
import { BuilderSessionContext } from '@modules/builder/presentation/state/builder-session-context';

const popoverProps = vi.hoisted(() => [] as unknown[]);

vi.mock('@modules/builder/presentation/components/palette/component-preview-popover', () => ({
  ComponentPreviewPopover: (props: unknown) => {
    popoverProps.push(props);
    return null;
  },
}));
vi.mock('@modules/builder/presentation/hooks/use-component-text', () => ({
  useComponentText: () => ({ componentLabel: (type: string) => type }),
}));
vi.mock('@modules/builder/presentation/state/builder-hooks', () => ({
  useBuilderDispatch: () => vi.fn(),
}));

const CATALOG = {
  descriptors: [
    { type: 'hero', category: 'layout' },
    { type: 'text', category: 'layout' },
  ],
} as unknown as ComponentCatalog;

const DND = {
  beginPaletteDrag: vi.fn(),
  movePalettePointer: vi.fn(),
  drop: vi.fn(),
  cancel: vi.fn(),
  session: null,
} as never;

function renderPalette() {
  return render(
    <NextIntlClientProvider locale="en" messages={enBuilder} timeZone="UTC">
      <BuilderSessionContext.Provider
        value={{
          catalog: CATALOG,
          datasetOptions: {},
          categoryOptions: { byDataset: {}, sampleByKind: {} },
          discard: vi.fn(),
        }}
      >
        <ComponentPalette dnd={DND} themeStyle={{}} />
      </BuilderSessionContext.Provider>
    </NextIntlClientProvider>,
  );
}

const shownTypes = () =>
  (popoverProps as ComponentPreviewPopoverProps[]).map((props) => props.componentType);

beforeEach(() => {
  popoverProps.length = 0;
});

describe('ComponentPalette preview', () => {
  it('shows the hovered component and hides the preview when the pointer leaves the list', () => {
    renderPalette();
    const hero = screen.getByRole('button', { name: 'hero' });

    fireEvent.pointerEnter(hero);
    expect(shownTypes().at(-1)).toBe('hero');

    fireEvent.pointerLeave(hero, { relatedTarget: document.body });
    expect(shownTypes().at(-1)).toBeNull();
  });

  it('never hides the preview while the pointer moves from one row to the next', () => {
    renderPalette();
    const hero = screen.getByRole('button', { name: 'hero' });
    const text = screen.getByRole('button', { name: 'text' });

    fireEvent.pointerEnter(hero);
    popoverProps.length = 0;
    fireEvent.pointerLeave(hero, { relatedTarget: text });
    fireEvent.pointerEnter(text, { relatedTarget: hero });

    expect(shownTypes()).not.toContain(null);
    expect(shownTypes().at(-1)).toBe('text');
  });

  it('does not rerender the preview when focus lands on the row the pointer already shows', () => {
    renderPalette();
    const hero = screen.getByRole('button', { name: 'hero' });

    fireEvent.pointerEnter(hero);
    const renders = popoverProps.length;
    fireEvent.focus(hero);

    expect(popoverProps).toHaveLength(renders);
  });
});
