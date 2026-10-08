import { literalGuard } from '@lib/utils';

export const EDITOR_MODES = ['internal', 'municipality'] as const;
export type EditorMode = (typeof EDITOR_MODES)[number];

export const isEditorMode = literalGuard(EDITOR_MODES);

export const EDITOR_CAPABILITIES = [
  'editStructure', // add, remove, reorder components
  'editContent', // text, image and link fields
  'changeVariant', // presentation variants
  'changeSpacing', // spacing and layout fields
  'configureData', // data source, limit, category
  'manageTheme', // website theme tokens
  'toggleVisibility', // hide or show via the `visible` prop
] as const;
export type EditorCapability = (typeof EDITOR_CAPABILITIES)[number];

/** The prop a visibility toggle writes; allowed with `toggleVisibility`. */
export const VISIBILITY_PROP_KEY = 'visible';

/**
 * "internal" is the full builder. "municipality" is the restricted mode for
 * municipal staff: content and basic presentation, never structure, data
 * sources or the theme. The mode is NOT a client claim: the application
 * layer derives it from the actor's permissions, and `checkEditScope`
 * enforces it on every save.
 */
const CAPABILITIES_BY_MODE = {
  internal: new Set<EditorCapability>(EDITOR_CAPABILITIES),
  municipality: new Set<EditorCapability>(['editContent', 'changeVariant', 'toggleVisibility']),
} as const satisfies Record<EditorMode, ReadonlySet<EditorCapability>>;

export function hasCapability(mode: EditorMode, capability: EditorCapability): boolean {
  return CAPABILITIES_BY_MODE[mode].has(capability);
}

/** True when the mode may do everything, so prop edits are unrestricted. */
export function isFullAccess(mode: EditorMode): boolean {
  return EDITOR_CAPABILITIES.every((capability) => hasCapability(mode, capability));
}
