'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

import { Button } from '@components/ui/button';

import { useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

export interface EntityFormArgs<T> {
  readonly item: T | undefined;
  readonly onSaved: () => void;
  readonly onCancel: () => void;
}

export interface EntityPanelProps<T extends { readonly id: string }> {
  readonly title: string;
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
}

type Editing = { readonly mode: 'new' } | { readonly mode: 'edit'; readonly id: string };

/**
 * A list of configured entries with "new" and "edit". While a form is open
 * it replaces the list, so there is one thing to do at a time; saving
 * refreshes the server-rendered data and returns to the list.
 */
export function EntityPanel<T extends { readonly id: string }>({
  title,
  intro,
  newLabel,
  emptyText,
  items,
  label,
  canEdit,
  summary,
  renderForm,
}: EntityPanelProps<T>) {
  const t = useTranslations('booking');
  const router = useRouter();
  const [editing, setEditing] = useState<Editing | null>(null);

  if (editing !== null) {
    const item =
      editing.mode === 'edit' ? items.find((candidate) => candidate.id === editing.id) : undefined;
    return (
      <div className="space-y-4">
        {renderForm({
          item,
          onSaved: () => {
            router.refresh();
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-medium text-copy">{title}</h3>
          <p className="text-sm text-copy-muted">{intro}</p>
        </div>
        {canEdit && (
          <Button
            type="button"
            onClick={() => {
              setEditing({ mode: 'new' });
            }}
          >
            {newLabel}
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p
          role="status"
          className="rounded-token border border-border bg-canvas p-4 text-sm text-copy"
        >
          {emptyText}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-token border border-border">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">{summary(item)}</div>
              {canEdit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing({ mode: 'edit', id: item.id });
                  }}
                >
                  {t('form.edit')}
                  <span className="sr-only"> {label(item)}</span>
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!canEdit && <p className="text-xs text-copy-muted">{t('form.readOnly')}</p>}
    </div>
  );
}
