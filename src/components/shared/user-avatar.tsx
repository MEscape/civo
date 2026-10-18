/** Up to two letters of a name, for the avatar circle. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words.at(-1)] : [words[0]?.slice(0, 2)];
  return letters
    .map((word) => word?.[0] ?? '')
    .join('')
    .toUpperCase();
}

/** The round monogram in front of a person's name, shared by every people table. */
export function UserAvatar({ name }: { readonly name: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-canvas text-xs font-semibold text-copy-muted"
    >
      {initialsOf(name)}
    </span>
  );
}
