/**
 * The look of a tab strip and of its tabs, shared by `Tabs` (script-driven) and `LinkTabs`
 * (address-backed). They live outside `tabs.tsx` because that file is a Client Component: a Server
 * Component importing a value from it would receive a client reference, not the class string.
 */
export const TABS_LIST_CLASS_NAME =
  'inline-flex h-9 items-center justify-center rounded-token bg-canvas p-1 text-copy-muted';
export const TABS_TRIGGER_CLASS_NAME = [
  'inline-flex items-center justify-center whitespace-nowrap rounded-token-sm px-3 py-1 text-sm font-medium transition-all',
  'ring-offset-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
  'hover:bg-surface/60 hover:text-copy',
  'disabled:pointer-events-none disabled:opacity-50',
  'data-[state=active]:bg-surface data-[state=active]:text-copy data-[state=active]:shadow-sm',
  'aria-[current=page]:bg-surface aria-[current=page]:text-copy aria-[current=page]:shadow-sm',
].join(' ');
