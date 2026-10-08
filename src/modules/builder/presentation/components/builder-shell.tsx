'use client';

import { useRef } from 'react';

import { useBeforeUnloadGuard } from '@hooks/use-before-unload-guard';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { hasCapability } from '../../application/contracts/editor-model';
import { useCanvasDnd } from '../hooks/use-canvas-dnd';
import { useEditorShortcuts } from '../hooks/use-editor-shortcuts';
import { useBuilderSelector } from '../state/builder-hooks';
import { selectEditorMode, selectIsDirty, selectMode } from '../state/builder-selectors';

import { BuilderCanvas } from './canvas/builder-canvas';
import { DragAnnouncer } from './canvas/drag-announcer';
import { DragOverlayCursor } from './canvas/drag-overlay-cursor';
import { PreviewCanvas } from './canvas/preview-canvas';
import { EditNotice } from './feedback/edit-notice';
import { ComponentPalette } from './palette/component-palette';
import { PropertiesPanel } from './properties/properties-panel';
import { BuilderToolbar } from './toolbar/builder-toolbar';

import type { EditorLinks } from '../navigation/editor-links';
import type { ThemeStyle } from './canvas/canvas-theme-scope';

export interface BuilderShellProps {
  readonly website: { readonly name: string };
  readonly pageTitle: string;
  /** CSS custom properties of the website's theme, computed by the route. */
  readonly themeStyle: ThemeStyle;
  readonly links: EditorLinks;
}

const PANEL = 'shrink-0 overflow-y-auto bg-surface';

/** Composes the three-column editor. Capability-gated panels are omitted, not hidden. */
export function BuilderShell({ website, pageTitle, themeStyle, links }: BuilderShellProps) {
  const t = useTranslations('builder');
  const mode = useBuilderSelector(selectMode);
  const editorMode = useBuilderSelector(selectEditorMode);
  const isDirty = useBuilderSelector(selectIsDirty);
  const canEditStructure = hasCapability(editorMode, 'editStructure');
  const canvasRef = useRef<HTMLDivElement>(null);
  const dnd = useCanvasDnd(canvasRef);

  useEditorShortcuts(canEditStructure);
  useBeforeUnloadGuard(isDirty);

  return (
    <div className="flex h-app-body flex-col">
      <BuilderToolbar websiteName={website.name} pageTitle={pageTitle} links={links} />
      <EditNotice />

      {mode === 'preview' ? (
        <div className="flex-1 overflow-y-auto bg-canvas">
          <PreviewCanvas themeStyle={themeStyle} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          {canEditStructure && (
            <aside
              aria-label={t('palette.label')}
              className={cn(PANEL, 'w-60 border-r border-border')}
            >
              <ComponentPalette dnd={dnd} themeStyle={themeStyle} />
            </aside>
          )}
          <section
            aria-label={t('canvas.label')}
            className="min-w-0 flex-1 overflow-y-auto bg-canvas p-6"
          >
            <BuilderCanvas themeStyle={themeStyle} containerRef={canvasRef} dnd={dnd} />
          </section>
          <aside
            aria-label={t('properties.label')}
            className={cn(PANEL, 'w-72 border-l border-border')}
          >
            <PropertiesPanel />
          </aside>
        </div>
      )}

      <DragOverlayCursor session={dnd.session} isKeyboard={dnd.isKeyboard} />
      <DragAnnouncer dnd={dnd} />
    </div>
  );
}
