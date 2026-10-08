/** Upper bounds shared by the editor-facing props of every component. */
export const PROP_LIMITS = {
  heading: 120,
  label: 80,
  text: 500,
  longText: 5_000,
  url: 2_048,
  id: 128,
  category: 80,
} as const;
