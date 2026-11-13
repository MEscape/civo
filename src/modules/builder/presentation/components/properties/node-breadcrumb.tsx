// @ui-plain button a breadcrumb link that selects a node of the tree instead of navigating, drawn by BreadcrumbLink

import { Fragment } from 'react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@components/ui/breadcrumb';

import { useTranslations } from '@i18n/client';

import { useComponentText } from '../../hooks/use-component-text';
import { nodeSelected } from '../../state/builder-actions';
import { useBuilderDispatch } from '../../state/builder-hooks';

import type { PageNode } from '../../../application/contracts/editor-model';

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
    <Breadcrumb aria-label={t('properties.breadcrumb')}>
      <BreadcrumbList className="mb-3 gap-1 text-xs">
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <button type="button" onClick={() => dispatch(nodeSelected(null))}>
              {t('properties.page')}
            </button>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {ancestors.map((ancestor) => (
          <Fragment key={ancestor.id}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <button type="button" onClick={() => dispatch(nodeSelected(ancestor.id))}>
                  {text.componentLabel(ancestor.type)}
                </button>
              </BreadcrumbLink>
            </BreadcrumbItem>
          </Fragment>
        ))}
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage aria-current="location" className="font-normal">
            {currentLabel}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
