'use client';

import { useRef, useState } from 'react';

import { ConfirmDialog } from '@components/shared/confirm-dialog';

import { useBeforeUnloadGuard } from '@hooks/use-before-unload-guard';
import { useUnsavedNavigationGuard } from '@hooks/use-unsaved-navigation-guard';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { useCanvasDnd } from '../hooks/use-canvas-dnd';
import { useEditorShortcuts } from '../hooks/use-editor-shortcuts';
import { useBuilderSelector } from '../state/builder-hooks';
import { selectCanRestructure, selectIsDirty, selectMode } from '../state/builder-selectors';
import { useBuilderSession } from '../state/builder-session-context';

import { BuilderPanelTabs } from './builder-panel-tabs';
import { BuilderCanvas } from './canvas/builder-canvas';
import { DragAnnouncer } from './canvas/drag-announcer';
import { DragOverlayCursor } from './canvas/drag-overlay-cursor';
import { PreviewCanvas } from './canvas/preview-canvas';
import { EditNotice } from './feedback/edit-notice';
import { ComponentPalette } from './palette/component-palette';
import { PropertiesPanel } from './properties/properties-panel';
import { BuilderToolbar } from './toolbar/builder-toolbar';

import type { BuilderPanel } from './builder-panel-tabs';
import type { EditorLinks } from '../navigation/editor-links';
import type { ThemeStyle } from './canvas/canvas-theme-scope';

export interface BuilderShellProps {
  readonly pageTitle: string;
  /** CSS custom properties of the website's theme, computed by the route. */
  readonly themeStyle: ThemeStyle;
  readonly links: EditorLinks;
}

const PANEL = 'overflow-y-auto bg-surface lg:shrink-0';

/** Below `lg` only the active area is drawn, full width; from `lg` all three stand side by side. */
function shownOn(panel: BuilderPanel, active: BuilderPanel): string {
  return panel === active ? 'flex-1 lg:flex-none' : 'hidden lg:block';
}

/**
 * Composes the editor: three columns on a wide screen, one area at a time
 * with a tab bar on a narrow one. Capability-gated panels are omitted, not hidden.
 */
export function BuilderShell({ pageTitle, themeStyle, links }: BuilderShellProps) {
  const t = useTranslations('builder');
  const mode = useBuilderSelector(selectMode);
  const isDirty = useBuilderSelector(selectIsDirty);
  const canEditStructure = useBuilderSelector(selectCanRestructure);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dnd = useCanvasDnd(canvasRef);
  const [panel, setPanel] = useState<BuilderPanel>('canvas');

  useEditorShortcuts(canEditStructure);
  useBeforeUnloadGuard(isDirty);
  const leaveGuard = useUnsavedNavigationGuard(isDirty);
  const { discard } = useBuilderSession();

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
              className={cn(
                PANEL,
                'lg:w-60 lg:border-r lg:border-border',
                shownOn('palette', panel),
              )}
            >
              <ComponentPalette
                dnd={dnd}
                themeStyle={themeStyle}
                onInserted={() => {
                  setPanel('canvas');
                }}
              />
            </aside>
          )}
          <section
            aria-label={t('canvas.label')}
            className={cn(
              'min-w-0 overflow-y-auto bg-canvas p-3 sm:p-6 lg:block lg:flex-1',
              panel === 'canvas' ? 'flex-1' : 'hidden',
            )}
          >
            <BuilderCanvas themeStyle={themeStyle} containerRef={canvasRef} dnd={dnd} />
          </section>
          <aside
            aria-label={t('properties.label')}
            className={cn(
              PANEL,
              'lg:w-72 lg:border-l lg:border-border',
              shownOn('properties', panel),
            )}
          >
            <PropertiesPanel />
          </aside>
        </div>
      )}
      {mode !== 'preview' && (
        <BuilderPanelTabs active={panel} onChange={setPanel} hasPalette={canEditStructure} />
      )}

      <DragOverlayCursor session={dnd.session} isKeyboard={dnd.isKeyboard} />
      <DragAnnouncer dnd={dnd} />
      <ConfirmDialog
        open={leaveGuard.isPrompting}
        title={t('leave.title')}
        description={t('leave.description')}
        confirmLabel={t('leave.confirm')}
        cancelLabel={t('leave.stay')}
        onConfirm={() => {
          leaveGuard.confirm();
          // The page stays mounted while hidden; without this the edits would be back on return.
          discard();
        }}
        onCancel={leaveGuard.cancel}
      />
    </div>
  );
}
