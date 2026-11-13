import { cn } from '@lib/utils';

export interface NameTileProps {
  /** What the tile stands for; its first letter is drawn. */
  readonly name: string;
  /** Drawn instead of the first letter: a number that ties a row to its pin on a map. */
  readonly text?: string | undefined;
  readonly className?: string | undefined;
}

/**
 * A small tinted tile with the first letter of a name: it gives a location, a resource or a person
 * in a list a face to find again, without needing a picture. Decoration only (the name is always
 * beside it), so assistive technology skips it.
 */
export function NameTile({ name, text, className }: NameTileProps) {
  const first = name.trim().codePointAt(0);
  const letter = first === undefined ? '·' : String.fromCodePoint(first).toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-token bg-primary/10 font-heading text-base font-semibold text-primary-copy',
        className,
      )}
    >
      {text ?? letter}
    </span>
  );
}
