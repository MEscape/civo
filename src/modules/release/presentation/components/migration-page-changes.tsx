'use client';

import { Badge } from '@components/ui/badge';

import { useTranslations } from '@i18n/client';

import { NODE_STATUS_MESSAGE_KEYS } from '../messages/message-keys';

import { PagePathLabel } from './page-path-label';

import type { NodeMigrationStatus } from '../../application/contracts/release-constraints';
import type { MigrationSummaryPageDto } from '../dto/migration-dto';

const NODE_BADGE_VARIANTS = {
  unchanged: 'outline',
  upgradable: 'success',
  needs_review: 'warning',
  unresolvable: 'danger',
} as const satisfies Record<NodeMigrationStatus, 'outline' | 'success' | 'warning' | 'danger'>;

type PageNode = MigrationSummaryPageDto['nodes'][number];

interface NodeGroup {
  readonly key: string;
  readonly node: PageNode;
  readonly count: number;
}

/** Instances of one component that changed alike read as one line with a count, not one line each. */
function groupNodes(nodes: readonly PageNode[]): readonly NodeGroup[] {
  const groups = new Map<string, NodeGroup>();
  for (const node of nodes) {
    const key = `${node.type}:${node.fromVersion}:${node.toVersion ?? ''}:${node.status}`;
    const found = groups.get(key);
    groups.set(key, { key, node, count: (found?.count ?? 0) + 1 });
  }
  return [...groups.values()];
}

function VersionChange({ node }: { readonly node: PageNode }) {
  const t = useTranslations('release');
  const isChanged =
    node.toVersion !== undefined &&
    node.status !== 'unresolvable' &&
    node.fromVersion !== node.toVersion;

  return (
    <span className="font-mono text-xs text-copy-muted">
      {isChanged
        ? t('migration.history.versionChanged', { from: node.fromVersion, to: node.toVersion })
        : t('migration.history.versionUnchanged', { version: node.fromVersion })}
    </span>
  );
}

export interface MigrationPageChangesProps {
  readonly page: MigrationSummaryPageDto;
  /** The names people know components by, by type; a type without one is shown as it is. */
  readonly labels: Readonly<Record<string, string>>;
}

/** What one update did on one page: each changed component once, with how often it is used there. */
export function MigrationPageChanges({ page, labels }: MigrationPageChangesProps) {
  const t = useTranslations('release');

  return (
    <li className="overflow-hidden rounded-token border border-border bg-surface">
      <p className="flex items-center justify-between gap-2 border-b border-border bg-canvas px-3 py-2 text-sm font-medium text-copy">
        <PagePathLabel path={page.path} />
        <span className="text-xs font-normal text-copy-muted">
          {t('migration.history.pageChangeCount', { count: page.nodes.length })}
        </span>
      </p>
      {page.nodes.length === 0 ? (
        <p className="px-3 py-2 text-xs text-copy-muted">{t('migration.history.noNodeChanges')}</p>
      ) : (
        <ul className="divide-y divide-border">
          {groupNodes(page.nodes).map(({ key, node, count }) => (
            <li
              key={key}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_6rem_auto]"
            >
              <span className="min-w-0 truncate text-copy">
                {labels[node.type] ?? node.type}
                {count > 1 && (
                  <span className="ml-1.5 text-xs text-copy-muted">
                    {t('migration.history.instanceCount', { count })}
                  </span>
                )}
              </span>
              <span className="order-last col-span-2 sm:order-none sm:col-span-1">
                <VersionChange node={node} />
              </span>
              <Badge variant={NODE_BADGE_VARIANTS[node.status]} className="justify-self-end">
                {t(NODE_STATUS_MESSAGE_KEYS[node.status])}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
