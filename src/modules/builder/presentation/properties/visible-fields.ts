import type {
  ComponentDescriptor,
  PropFieldDescriptor,
} from '../../application/contracts/builder-constraints';
import type { ComponentCatalog } from '../../application/contracts/editor-model';

/** The one field besides the map picker that a saved map leaves to the page: its heading. */
const MAP_BLOCK_FIELDS = new Set(['heading']);

/**
 * A component placing a saved map is configured in the map editor, which its picker links to:
 * the panel offers the picker and the heading only. The older inline settings stay stored and
 * keep rendering on pages that still use them; they are just no longer edited here.
 */
function isOfferedField(field: PropFieldDescriptor, placesMaps: boolean): boolean {
  return !placesMaps || field.control === 'map' || MAP_BLOCK_FIELDS.has(field.key);
}

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
  const placesMaps = descriptor.fields.some((field) => field.control === 'map');
  return descriptor.fields.filter(
    (field) => (allowed === null || allowed.has(field.key)) && isOfferedField(field, placesMaps),
  );
}
