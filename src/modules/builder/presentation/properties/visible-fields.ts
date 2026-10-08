import type {
  ComponentDescriptor,
  EditorMode,
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
  mode: EditorMode,
  catalog: ComponentCatalog,
): readonly PropFieldDescriptor[] {
  const allowed = catalog.editablePropKeys(descriptor.type, mode);
  return allowed === null
    ? descriptor.fields
    : descriptor.fields.filter((field) => allowed.has(field.key));
}
