import { ChevronRight } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { useComponentText } from '../../hooks/use-component-text';
import { nodeSelected } from '../../state/builder-actions';
import { useBuilderDispatch } from '../../state/builder-hooks';

import type { PageNode } from '../../../application/contracts/editor-model';

const CRUMB =
  'hover:text-copy hover:underline focus-visible:outline-2 focus-visible:outline-accent';

export interface NodeBreadcrumbProps {
  readonly ancestors: readonly PageNode[];
  readonly currentLabel: string;
}

/** The selected node's place in the tree; each ancestor selects itself. */
export function NodeBreadcrumb({ ancestors, currentLabel }: NodeBreadcrumbProps) {
  const t = useTranslations('builder');
  const dispatch = useBuilderDispatch();
  const text = useComponentText();

  return (
    <nav aria-label={t('properties.breadcrumb')}>
      <ol className="mb-3 flex flex-wrap items-center gap-1 text-xs text-copy-muted">
        <li>
          <button type="button" onClick={() => dispatch(nodeSelected(null))} className={CRUMB}>
            {t('properties.page')}
          </button>
        </li>
        {ancestors.map((ancestor) => (
          <li key={ancestor.id} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
            <button
              type="button"
              onClick={() => dispatch(nodeSelected(ancestor.id))}
              className={CRUMB}
            >
              {text.componentLabel(ancestor.type)}
            </button>
          </li>
        ))}
        <li aria-current="location" className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          <span className="text-copy">{currentLabel}</span>
        </li>
      </ol>
    </nav>
  );
}
