'use client';

import { useEffect, useRef, useState } from 'react';

import { Button } from '@components/ui/button';

import { cn } from '@lib/utils';

export interface ClampedTextProps {
  readonly text: string;
  readonly showMoreLabel: string;
  readonly showLessLabel: string;
  readonly className?: string;
}

/**
 * Text cut to a few lines so cards keep a similar height. Only a text that is
 * really cut offers the toggle; the full text stays in the DOM either way.
 */
export function ClampedText({ text, showMoreLabel, showLessLabel, className }: ClampedTextProps) {
  const paragraph = useRef<HTMLParagraphElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCut, setIsCut] = useState(false);

  useEffect(() => {
    const element = paragraph.current;
    if (element === null || isExpanded) {
      return undefined;
    }
    const measure = () => {
      setIsCut(element.scrollHeight > element.clientHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [text, isExpanded]);

  return (
    <div className="space-y-1">
      <p ref={paragraph} className={cn(className, !isExpanded && 'line-clamp-3')}>
        {text}
      </p>
      {(isCut || isExpanded) && (
        <Button
          type="button"
          variant="link"
          size="sm"
          aria-expanded={isExpanded}
          onClick={() => {
            setIsExpanded((previous) => !previous);
          }}
          className="h-auto p-0"
        >
          {isExpanded ? showLessLabel : showMoreLabel}
        </Button>
      )}
    </div>
  );
}
