'use client';

import { useState } from 'react';

import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { ChevronDown, Pencil, Trash2 } from '@components/ui/icons';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { CANONICAL_KIND_MESSAGE_KEYS } from '../messages/message-keys';

import { DataSourceMappingPanel } from './data-source-mapping-panel';
import { DatasetForm } from './dataset-form';

import type { DatasetDto } from '../dto/dataset-dto';

/** A page that shows a dataset, as the screen links to it. */
export interface DatasetUse {
  /** The page's title, and its editor. */
  readonly title: string;
  readonly href: string;
  /** The components on it that read the dataset, each opening the editor with it selected. */
  readonly components: ReadonlyArray<{ readonly label: string; readonly href: string }>;
  /**
   * A page of the live site rather than a draft: it shows the dataset until
   * the next publish, so `href` leads to publishing and `components` is empty.
   */
  readonly isLive: boolean;
}

/** A component on a page that still shows sample data, opening the editor with it selected. */
export interface ComponentAwaitingData {
  readonly label: string;
  readonly page: string;
  /** The content kind it asks for; a dataset of this kind can go there. */
  readonly kind: string;
  readonly href: string;
}

/**
 * The pages that use each dataset, by dataset id, read by the route from the
 * builder; `null` when they could not be read, so "unused" is never guessed.
 */
export type DatasetUsage = Readonly<Record<string, readonly DatasetUse[]>> | null;

export interface DatasetManagementItemProps {
  readonly dataSourceId: string;
  readonly dataset: DatasetDto;
  readonly isExpanded: boolean;
  /** The pages showing this dataset; `null` when that is unknown. */
  readonly usedOn: readonly DatasetUse[] | null;
  readonly onToggleExpand: () => void;
  /** Whether the open mapping holds unsaved assignments. */
  readonly onMappingDirtyChange: (isDirty: boolean) => void;
  readonly onDelete: () => void;
  readonly isPending: boolean;
}

/** Where the dataset is shown, so it is clear what a change or a deletion affects. */
function UsedOn({ pages }: { readonly pages: readonly DatasetUse[] | null }) {
  const t = useTranslations('dataSources');
  if (pages === null) {
    return null;
  }
  const drafts = pages
    .filter((page) => !page.isLive)
    .flatMap((page) => page.components.map((component) => ({ ...component, page: page.title })));
  const live = pages.filter((page) => page.isLive);
  if (drafts.length === 0 && live.length === 0) {
    return <p className="text-xs text-copy-muted">{t('datasets.unused')}</p>;
  }
  return (
    <>
      {drafts.length > 0 && (
        <p className="text-xs text-copy-muted">
          {t('datasets.usedOn')}{' '}
          {drafts.map((use, index) => (
            <span key={use.href}>
              {index > 0 && ', '}
              {/* Opens the editor with this very component selected. */}
              <Link
                href={use.href}
                className="font-medium text-copy underline-offset-2 hover:underline"
              >
                {t('datasets.useLabel', { page: use.page, component: use.label })}
              </Link>
            </span>
          ))}
        </p>
      )}
      {drafts.length === 0 && (
        <p className="text-xs text-copy-muted">
          {t('datasets.liveOnly', { pages: live.map((page) => page.title).join(', ') })}
        </p>
      )}
    </>
  );
}

/**
 * One dataset as a row: what it holds and whether components can use it yet.
 * An unmapped dataset is not usable, so its mapping is the row's main action.
 */
export function DatasetManagementItem({
  dataSourceId,
  dataset,
  isExpanded,
  usedOn,
  onToggleExpand,
  onMappingDirtyChange,
  onDelete,
  isPending,
}: DatasetManagementItemProps) {
  const t = useTranslations('dataSources');
  const [isEditing, setIsEditing] = useState(false);
  const panelId = `mapping-${dataset.id}`;
  const isMapped = dataset.mapping !== null;

  if (isEditing) {
    return (
      <li className="bg-surface p-4">
        <DatasetForm
          dataSourceId={dataSourceId}
          dataset={dataset}
          onSaved={() => {
            setIsEditing(false);
          }}
          onCancel={() => {
            setIsEditing(false);
          }}
        />
      </li>
    );
  }

  return (
    <li>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-copy">{dataset.name}</p>
            <Badge variant={isMapped ? 'success' : 'warning'}>
              {isMapped ? t('datasets.mapped') : t('datasets.unmapped')}
            </Badge>
          </div>
          <p className="text-xs text-copy-muted">
            {t('datasets.kind', {
              kind: t(CANONICAL_KIND_MESSAGE_KEYS[dataset.canonicalKind]),
            })}
          </p>
          <UsedOn pages={usedOn} />
        </div>
        <div className="flex flex-wrap gap-1">
          <Button
            variant={isMapped || isExpanded ? 'outline' : 'default'}
            size="sm"
            aria-expanded={isExpanded}
            aria-controls={panelId}
            onClick={onToggleExpand}
          >
            {isExpanded ? t('datasets.hideMapping') : t('datasets.editMapping')}
            <ChevronDown
              className={cn(
                'size-3.5 transition-transform motion-reduce:transition-none',
                isExpanded && 'rotate-180',
              )}
              aria-hidden="true"
            />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={t('datasets.editLabel', { name: dataset.name })}
            onClick={() => {
              setIsEditing(true);
            }}
            disabled={isPending}
          >
            <Pencil className="size-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={t('datasets.deleteLabel', { name: dataset.name })}
            onClick={onDelete}
            disabled={isPending}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {isExpanded && (
        // The accent rule ties the open mapping to its dataset row.
        <div
          id={panelId}
          className="border-t border-l-2 border-border border-l-accent bg-canvas px-4 py-4"
        >
          <DataSourceMappingPanel
            datasetId={dataset.id}
            canonicalKind={dataset.canonicalKind}
            existingMapping={dataset.mapping}
            onDirtyChange={onMappingDirtyChange}
          />
        </div>
      )}
    </li>
  );
}
