import { cn } from '@lib/utils';

/** A blank line (possibly with spaces, LF or CRLF) separates paragraphs. */
const PARAGRAPH_BREAK = /\r?\n\s*\r?\n/;
const KEY_PREFIX_LENGTH = 24;

export interface ParagraphsProps {
  readonly text: string;
  /** Type size, colour and measure belong to the caller. */
  readonly className?: string;
}

/** Plain editor text as real paragraphs; a single line break inside one is kept. */
export function Paragraphs({ text, className }: ParagraphsProps) {
  const paragraphs = text
    .split(PARAGRAPH_BREAK)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '');

  return (
    <div className={cn('space-y-4', className)}>
      {paragraphs.map((paragraph, index) => (
        <p
          key={`${String(index)}-${paragraph.slice(0, KEY_PREFIX_LENGTH)}`}
          className="whitespace-pre-line"
        >
          {paragraph}
        </p>
      ))}
    </div>
  );
}
