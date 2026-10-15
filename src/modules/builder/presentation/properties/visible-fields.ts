import type {
  ComponentDescriptor,
  PropFieldDescriptor,
} from '../../application/contracts/builder-constraints';
import type { ComponentCatalog } from '../../application/contracts/editor-model';

/**
 * The fields a session may edit: the SAME rule the server enforces on
 * save (`editablePropKeys`), so the panel never offers an edit that the
 * save would refuse.
 */
export function visibleFields(
  descriptor: ComponentDescriptor,
  canRestructure: boolean,
  catalog: ComponentCatalog,
): readonly PropFieldDescriptor[] {
  const allowed = catalog.editablePropKeys(descriptor.type, canRestructure);
  return allowed === null
    ? descriptor.fields
    : descriptor.fields.filter((field) => allowed.has(field.key));
}
