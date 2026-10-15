'use client';

import { useRef } from 'react';

import { ConfirmDialog } from '@components/shared/confirm-dialog';

import { useBeforeUnloadGuard } from '@hooks/use-before-unload-guard';
import { useUnsavedNavigationGuard } from '@hooks/use-unsaved-navigation-guard';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { useCanvasDnd } from '../hooks/use-canvas-dnd';
import { useEditorShortcuts } from '../hooks/use-editor-shortcuts';
import { useBuilderSelector } from '../state/builder-hooks';
import { selectCanRestructure, selectIsDirty, selectMode } from '../state/builder-selectors';

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
  readonly pageTitle: string;
  /** CSS custom properties of the website's theme, computed by the route. */
  readonly themeStyle: ThemeStyle;
  readonly links: EditorLinks;
}

const PANEL = 'shrink-0 overflow-y-auto bg-surface';

/** Composes the three-column editor. Capability-gated panels are omitted, not hidden. */
export function BuilderShell({ pageTitle, themeStyle, links }: BuilderShellProps) {
  const t = useTranslations('builder');
  const mode = useBuilderSelector(selectMode);
  const isDirty = useBuilderSelector(selectIsDirty);
  const canEditStructure = useBuilderSelector(selectCanRestructure);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dnd = useCanvasDnd(canvasRef);

  useEditorShortcuts(canEditStructure);
  useBeforeUnloadGuard(isDirty);
  const leaveGuard = useUnsavedNavigationGuard(isDirty);

  return (
    <div className="flex h-website-body flex-col">
      <BuilderToolbar pageTitle={pageTitle} links={links} />
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
      <ConfirmDialog
        open={leaveGuard.isPrompting}
        title={t('leave.title')}
        description={t('leave.description')}
        confirmLabel={t('leave.confirm')}
        cancelLabel={t('leave.stay')}
        onConfirm={leaveGuard.confirm}
        onCancel={leaveGuard.cancel}
      />
    </div>
  );
}
