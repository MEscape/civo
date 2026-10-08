/** Deterministic text hash, used to derive stable ids for records that carry none. */
export interface ContentHasher {
  hash(text: string): string;
}
