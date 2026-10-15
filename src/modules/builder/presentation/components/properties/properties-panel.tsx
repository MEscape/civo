import { useTranslations } from '@i18n/client';

import { VISIBILITY_PROP_KEY } from '../../../application/contracts/builder-constraints';
import { useComponentText } from '../../hooks/use-component-text';
import { visibleFields } from '../../properties/visible-fields';
import { useBuilderSelector } from '../../state/builder-hooks';
import {
  selectCanRestructure,
  selectSelectedAncestors,
  selectSelectedNode,
} from '../../state/builder-selectors';
import { useBuilderSession } from '../../state/builder-session-context';

import { NodeBreadcrumb } from './node-breadcrumb';
import { PropertyFieldGroups } from './property-field-groups';
import { VisibilityToggle } from './visibility-toggle';

const MUTED = 'text-sm text-copy-muted';

/**
 * Descriptor-driven: it renders exactly the controls the component
 * declares, filtered by the SAME rule the server enforces on save. A
 * component without fields shows no editable properties; no control ever
 * exposes arbitrary CSS, class names or HTML.
 */
export function PropertiesPanel() {
  const t = useTranslations('builder');
  const { catalog } = useBuilderSession();
  const text = useComponentText();
  const node = useBuilderSelector(selectSelectedNode);
  const ancestors = useBuilderSelector(selectSelectedAncestors);
  const canRestructure = useBuilderSelector(selectCanRestructure);

  if (node === null) {
    return (
      <div className="p-4">
        <p className={MUTED}>{t('properties.empty')}</p>
      </div>
    );
  }

  const descriptor = catalog.describe(node.type);
  const fields = descriptor === null ? [] : visibleFields(descriptor, canRestructure, catalog);
  const label = text.componentLabel(node.type);

  return (
    <div className="p-4">
      {ancestors.length > 0 && <NodeBreadcrumb ancestors={ancestors} currentLabel={label} />}
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-copy-muted">
        {t('properties.title')}
      </h2>
      <p className="mb-4 text-sm font-medium text-copy">{label}</p>

      <VisibilityToggle nodeId={node.id} isVisible={node.props[VISIBILITY_PROP_KEY] !== false} />

      {fields.length > 0 ? (
        <PropertyFieldGroups nodeId={node.id} fields={fields} props={node.props} />
      ) : (
        <p className={MUTED}>{t('properties.noFields')}</p>
      )}
    </div>
  );
}
