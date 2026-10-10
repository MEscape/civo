import type { ReactNode, RefObject } from 'react';

export interface FlowFrameProps {
  readonly heading: string;
  readonly title: string;
  /** Focused when the step changes, so keyboard and screen-reader users land on the new step. */
  readonly headingRef: RefObject<HTMLHeadingElement | null>;
  readonly progress?: ReactNode;
  readonly footer?: ReactNode;
  readonly children: ReactNode;
}

/** The card every step of the booking flow sits in. */
export function FlowFrame({
  heading,
  title,
  headingRef,
  progress,
  footer,
  children,
}: FlowFrameProps) {
  return (
    <section
      aria-label={heading}
      className="rounded-token border border-border bg-surface p-4 shadow-sm sm:p-6"
    >
      <div className="space-y-4">
        {progress}
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="font-heading text-xl font-semibold text-copy outline-none"
        >
          {title}
        </h3>
      </div>
      <div className="mt-4">{children}</div>
      {footer !== null && footer !== undefined && (
        <div className="mt-6 border-t border-border pt-3">{footer}</div>
      )}
    </section>
  );
}
