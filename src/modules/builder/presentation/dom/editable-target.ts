const EDITABLE_TAGS: ReadonlySet<string> = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** True when keyboard input at `target` is text editing, which shortcuts must not hijack. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return EDITABLE_TAGS.has(target.tagName) || target.isContentEditable;
}
