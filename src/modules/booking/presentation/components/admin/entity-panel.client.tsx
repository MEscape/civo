'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { usePagedList } from '../../hooks/use-paged-list';
import { ListSearch } from '../shared/list-search';

export interface EntityFormArgs<T> {
  readonly item: T | undefined;
  /** The template a new entry starts from, if one was chosen. */
  readonly presetKey: string | undefined;
  readonly onSaved: () => void;
  readonly onCancel: () => void;
}

export interface EntityPanelProps<T extends { readonly id: string }> {
  readonly title: string;
  /** The id of the heading, so the section around the panel can be named by it. */
  readonly titleId: string;
  readonly intro: string;
  readonly newLabel: string;
  readonly emptyText: string;
  readonly items: readonly T[];
  /** The name of an entry, so "Edit" is announced with what it edits. */
  readonly label: (item: T) => string;
  /** Whether the person may add and change entries (`booking.configure`). */
  readonly canEdit: boolean;
  readonly summary: (item: T) => ReactNode;
  readonly renderForm: (args: EntityFormArgs<T>) => ReactNode;
  /** Marks an entry that needs attention; its summary says why. */
  readonly isHighlighted?: (item: T) => boolean;
  /** Templates a new entry can start from: a quick way to set the system up. */
  readonly presets?: ReadonlyArray<{ readonly key: string; readonly label: string }>;
}

interface PresetPickerProps {
  readonly presets: NonNullable<EntityPanelProps<{ readonly id: string }>['presets']>;
  readonly onPick: (presetKey: string) => void;
}

function PresetPicker({ presets, onPick }: PresetPickerProps) {
  const t = useTranslations('booking');

  return (
    <div role="group" aria-label={t('presets.label')} className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-copy-muted">{t('presets.start')}</span>
      {presets.map((preset) => (
        <Button
          key={preset.key}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            onPick(preset.key);
          }}
        >
          {preset.label}
        </Button>
      ))}
    </div>
  );
}

interface EntityRowProps {
  readonly label: string;
  readonly summary: ReactNode;
  readonly isHighlighted: boolean;
  /** `null` when the person may not change entries. */
  readonly onEdit: (() => void) | null;
}

function EntityRow({ label, summary, isHighlighted, onEdit }: EntityRowProps) {
  const t = useTranslations('booking');

  return (
    <li
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 p-4',
        isHighlighted && 'bg-danger-subtle/40 ring-1 ring-inset ring-danger',
      )}
    >
      <div className="min-w-0 flex-1">{summary}</div>
      {onEdit !== null && (
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          {t('form.edit')}
          <span className="sr-only"> {label}</span>
        </Button>
      )}
    </li>
  );
}

interface EntityHeaderProps {
  readonly title: string;
  readonly titleId: string;
  readonly intro: string;
  readonly newLabel: string;
  readonly presets: NonNullable<EntityPanelProps<{ readonly id: string }>['presets']>;
  /** `null` when the person may not add entries. */
  readonly onNew: ((presetKey?: string) => void) | null;
}

function EntityHeader({ title, titleId, intro, newLabel, presets, onNew }: EntityHeaderProps) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={titleId} className="text-lg font-medium text-copy">
            {title}
          </h2>
          <p className="text-sm text-copy-muted">{intro}</p>
        </div>
        {onNew !== null && (
          <Button
            type="button"
            onClick={() => {
              onNew();
            }}
          >
            {newLabel}
          </Button>
        )}
      </div>
      {onNew !== null && presets.length > 0 && <PresetPicker presets={presets} onPick={onNew} />}
    </>
  );
}

type Editing =
  | { readonly mode: 'new'; readonly presetKey?: string }
  | { readonly mode: 'edit'; readonly id: string };

/**
 * A list of configured entries with "new" and "edit". While a form is open
 * it replaces the list, so there is one thing to do at a time; saving
 * refreshes the server-rendered data and returns to the list. A long list
 * shows a page at a time and can be searched by name (`usePagedList`).
 */
export function EntityPanel<T extends { readonly id: string }>({
  title,
  titleId,
  intro,
  newLabel,
  emptyText,
  items,
  label,
  canEdit,
  summary,
  renderForm,
  isHighlighted = () => false,
  presets = [],
}: EntityPanelProps<T>) {
  const t = useTranslations('booking');
  const [editing, setEditing] = useState<Editing | null>(null);
  const list = usePagedList(items, { label, isPinned: isHighlighted });

  if (editing !== null) {
    const item =
      editing.mode === 'edit' ? items.find((candidate) => candidate.id === editing.id) : undefined;
    return (
      <div className="space-y-4">
        {renderForm({
          item,
          presetKey: editing.mode === 'new' ? editing.presetKey : undefined,
          onSaved: () => {
            setEditing(null);
          },
          onCancel: () => {
            setEditing(null);
          },
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <EntityHeader
        title={title}
        titleId={titleId}
        intro={intro}
        newLabel={newLabel}
        presets={presets}
        onNew={
          canEdit
            ? (presetKey) => {
                setEditing(presetKey === undefined ? { mode: 'new' } : { mode: 'new', presetKey });
              }
            : null
        }
      />

      {list.isSearchable && (
        <ListSearch id={`${titleId}-search`} value={list.query} onChange={list.setQuery} />
      )}

      {items.length === 0 ? (
        <p
          role="status"
          className="rounded-token border border-border bg-canvas p-4 text-sm text-copy"
        >
          {emptyText}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-token border border-border">
          {list.shown.map((item) => (
            <EntityRow
              key={item.id}
              label={label(item)}
              summary={summary(item)}
              isHighlighted={isHighlighted(item)}
              onEdit={
                canEdit
                  ? () => {
                      setEditing({ mode: 'edit', id: item.id });
                    }
                  : null
              }
            />
          ))}
        </ul>
      )}
      {list.hasNoMatch && (
        <p role="status" className="text-sm text-copy-muted">
          {t('form.noMatches')}
        </p>
      )}
      {list.hiddenCount > 0 && (
        <Button type="button" variant="ghost" size="sm" onClick={list.showMore}>
          {t('list.showMore', { count: list.hiddenCount })}
        </Button>
      )}
      {!canEdit && <p className="text-xs text-copy-muted">{t('form.readOnly')}</p>}
    </div>
  );
}
