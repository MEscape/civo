import { hasCapability } from '../../../application/contracts/editor-model';
import { useBuilderSelector } from '../../state/builder-hooks';
import { selectEditorMode } from '../../state/builder-selectors';

import { SaveControls } from './save-controls';
import { ToolbarBreadcrumb } from './toolbar-breadcrumb';
import { ToolbarHistoryControls } from './toolbar-history-controls';
import { ToolbarModeLinks } from './toolbar-mode-links';
import { ToolbarViewportControls } from './toolbar-viewport-controls';

import type { EditorLinks } from '../../navigation/editor-links';

export interface BuilderToolbarProps {
  readonly websiteName: string;
  readonly pageTitle: string;
  readonly links: EditorLinks;
}

export function BuilderToolbar({ websiteName, pageTitle, links }: BuilderToolbarProps) {
  const editorMode = useBuilderSelector(selectEditorMode);

  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
      <ToolbarBreadcrumb
        websiteName={websiteName}
        pageTitle={pageTitle}
        websitesHref={links.websites}
      />
      <div className="flex items-center gap-4">
        <ToolbarHistoryControls />
        <ToolbarViewportControls />
        <ToolbarModeLinks
          publicSiteHref={links.publicSite}
          settingsHref={hasCapability(editorMode, 'manageTheme') ? links.settings : null}
        />
        <SaveControls />
      </div>
    </div>
  );
}
