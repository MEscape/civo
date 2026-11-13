'use client';

import { useEffect, useRef, useState } from 'react';

import { ArrowLeft, Check, Copy } from '@components/icons/icons';
import { Button } from '@components/ui/button';

import { useCopyToClipboard } from '@hooks/use-copy-to-clipboard';

import { useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

/* -------------------------------------------------------------------------- */
/* BackLink                                                                   */
/* -------------------------------------------------------------------------- */

interface BackLinkProps {
  /** Already translated, e.g. "Back". */
  readonly label: string;
  /** Where to go when there is no page before this one (the screen was opened directly). */
  readonly fallbackHref: string;
}

/**
 * Takes the person back to the page they came from, whichever it was, instead of to a fixed place:
 * a screen reached from many others (the profile) has no single parent. Opened directly, with no
 * earlier page in this tab, it goes to `fallbackHref`.
 */
export function BackLink({ label, fallbackHref }: BackLinkProps) {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ms-3 text-copy-muted"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {label}
    </Button>
  );
}

/* -------------------------------------------------------------------------- */
/* CopyButton                                                                 */
/* -------------------------------------------------------------------------- */

interface CopyButtonProps {
  /** What goes to the clipboard. */
  readonly value: string;
  readonly label: string;
  /** Said for a moment after copying; announced to assistive technology. */
  readonly copiedLabel: string;
}

/**
 * A small button that copies a value and says so. Where the clipboard is not
 * available (an insecure origin, a refused permission) it stays quiet rather
 * than claiming something it did not do.
 */
export function CopyButton({ value, label, copiedLabel }: CopyButtonProps) {
  const { isCopied, copy } = useCopyToClipboard(value);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        title={label}
        onClick={() => {
          void copy();
        }}
      >
        {isCopied ? (
          <Check className="text-success" aria-hidden="true" />
        ) : (
          <Copy aria-hidden="true" />
        )}
      </Button>
      <span role="status" className="sr-only">
        {isCopied ? copiedLabel : ''}
      </span>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* ClampedText                                                                */
/* -------------------------------------------------------------------------- */

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
          aria-expanded={isExpanded}
          onClick={() => {
            setIsExpanded((previous) => !previous);
          }}
          className="h-auto min-h-6 p-0"
        >
          {isExpanded ? showLessLabel : showMoreLabel}
        </Button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* LoadingStatus                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Says once, politely, that the region around it is loading; the skeleton
 * blocks themselves are hidden. A Client Component on purpose: loading UI is
 * a Suspense fallback, which must not read the request to find its language.
 */
export function LoadingStatus() {
  const t = useTranslations('app');
  return (
    <p role="status" className="sr-only">
      {t('loading')}
    </p>
  );
}
