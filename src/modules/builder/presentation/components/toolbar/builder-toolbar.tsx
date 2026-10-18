import { SaveControls } from './save-controls';
import { ToolbarBreadcrumb } from './toolbar-breadcrumb';
import { ToolbarHistoryControls } from './toolbar-history-controls';
import { ToolbarModeLinks } from './toolbar-mode-links';
import { ToolbarViewportControls } from './toolbar-viewport-controls';

import type { EditorLinks } from '../../navigation/editor-links';

export interface BuilderToolbarProps {
  readonly pageTitle: string;
  readonly links: EditorLinks;
}

export function BuilderToolbar({ pageTitle, links }: BuilderToolbarProps) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-3 sm:px-4">
      <ToolbarBreadcrumb pageTitle={pageTitle} pagesHref={links.pages} />
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <ToolbarHistoryControls />
        <ToolbarViewportControls />
        <ToolbarModeLinks publicSiteHref={links.publicSite} />
        <SaveControls />
      </div>
    </div>
  );
}
