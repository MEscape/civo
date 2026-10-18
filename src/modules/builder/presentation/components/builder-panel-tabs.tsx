'use client';

import { Button } from '@components/ui/button';
import { Eye, PanelLeft, PanelRight } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { useBuilderSelector } from '../state/builder-hooks';
import { selectSelectedNodeId } from '../state/builder-selectors';

/** The three areas of the editor; on a narrow screen one is shown at a time. */
export type BuilderPanel = 'palette' | 'canvas' | 'properties';

export interface BuilderPanelTabsProps {
  readonly active: BuilderPanel;
  readonly onChange: (panel: BuilderPanel) => void;
  /** Whoever may not restructure the page has no palette to switch to. */
  readonly hasPalette: boolean;
}

const ICONS = {
  palette: PanelLeft,
  canvas: Eye,
  properties: PanelRight,
} as const satisfies Record<BuilderPanel, unknown>;

/**
 * The switch between the editor's areas on a narrow screen, at the bottom
 * where a thumb reaches it. Wide screens show all three side by side and
 * never draw it. The properties tab is marked while something is selected,
 * so its settings are one tap away.
 */
export function BuilderPanelTabs({ active, onChange, hasPalette }: BuilderPanelTabsProps) {
  const t = useTranslations('builder');
  const hasSelection = useBuilderSelector(selectSelectedNodeId) !== null;
  const panels: readonly BuilderPanel[] = hasPalette
    ? ['palette', 'canvas', 'properties']
    : ['canvas', 'properties'];

  return (
    <nav
      aria-label={t('panels.label')}
      className="flex shrink-0 border-t border-border bg-surface lg:hidden"
    >
      {panels.map((panel) => {
        const Icon = ICONS[panel];
        const isActive = panel === active;
        return (
          <Button
            key={panel}
            type="button"
            variant="ghost"
            aria-pressed={isActive}
            onClick={() => {
              onChange(panel);
            }}
            className={cn(
              'relative h-auto min-h-12 flex-1 flex-col gap-0.5 rounded-none text-xs',
              isActive ? 'text-copy' : 'text-copy-muted hover:text-copy',
            )}
          >
            {isActive && (
              <span aria-hidden="true" className="absolute inset-x-6 top-0 h-0.5 bg-primary" />
            )}
            <span className="relative">
              <Icon className="size-4" aria-hidden="true" />
              {panel === 'properties' && hasSelection && (
                <span
                  aria-hidden="true"
                  className="absolute -top-0.5 -right-1 size-1.5 rounded-full bg-accent"
                />
              )}
            </span>
            {t(`panels.${panel}`)}
          </Button>
        );
      })}
    </nav>
  );
}
