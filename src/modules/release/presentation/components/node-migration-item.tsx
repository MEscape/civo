'use client';

import { Badge } from '@components/ui/badge';

import { useTranslations } from '@i18n/client';

import {
  NODE_STATUS_MESSAGE_KEYS,
  UNRESOLVABLE_REASON_MESSAGE_KEYS,
} from '../messages/message-keys';
import { conflictKey } from '../resolutions/resolution-choices';

import { ConflictField } from './conflict-field';

import type { NodeMigrationView } from '../../application/contracts/release-views';
import type { ChoiceMap, ConflictChoice } from '../resolutions/resolution-choices';

const BADGE_VARIANT = {
  unchanged: 'outline',
  upgradable: 'success',
  needs_review: 'warning',
  unresolvable: 'danger',
} as const satisfies Record<
  NodeMigrationView['status'],
  'outline' | 'success' | 'warning' | 'danger'
>;

export interface NodeMigrationItemProps {
  readonly pagePath: string;
  readonly node: NodeMigrationView;
  readonly choices: ChoiceMap;
  readonly isDisabled: boolean;
  readonly onChoose: (key: string, choice: ConflictChoice) => void;
}

/** One component on a page: what happens to it, and the decisions it still needs. */
export function NodeMigrationItem({
  pagePath,
  node,
  choices,
  isDisabled,
  onChoose,
}: NodeMigrationItemProps) {
  const t = useTranslations('release');

  return (
    <li className="space-y-3 rounded-token border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-copy">{node.type}</span>
        <Badge variant={BADGE_VARIANT[node.status]}>
          {t(NODE_STATUS_MESSAGE_KEYS[node.status])}
        </Badge>
        {node.status !== 'unresolvable' && (
          <span className="text-xs text-copy-muted">
            {t('migration.review.versions', {
              from: node.fromVersion,
              to: node.toVersion,
            })}
          </span>
        )}
      </div>

      {node.status === 'unresolvable' && (
        <p className="text-xs text-copy-muted">
          {t(UNRESOLVABLE_REASON_MESSAGE_KEYS[node.reason])}
        </p>
      )}

      {(node.status === 'upgradable' || node.status === 'needs_review') &&
        node.addedFields.length > 0 && (
          <p className="text-xs text-copy-muted">
            {t('migration.review.addedFields', {
              fields: node.addedFields.join(', '),
            })}
          </p>
        )}

      {node.status === 'needs_review' && (
        <div className="space-y-3">
          {node.conflicts.map((conflict) => {
            const key = conflictKey(pagePath, node.nodeId, conflict.key);
            return (
              <ConflictField
                key={key}
                conflict={conflict}
                choice={choices[key]}
                isDisabled={isDisabled}
                onChoose={(choice) => {
                  onChoose(key, choice);
                }}
              />
            );
          })}
        </div>
      )}
    </li>
  );
}
