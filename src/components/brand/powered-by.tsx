import { APP_IDENTITY } from '@lib/config';

import { ArtemisLogo } from './artemis-logo';

export interface PoweredByProps {
  /** "Provided with", already translated; the brand's name follows it. */
  readonly label: string;
  readonly className?: string;
}

/**
 * A quiet credit for pages that carry someone else's brand (a municipality's
 * public site): small, muted, after everything else. The site's own logo
 * stays the main one.
 */
export function PoweredBy({ label, className }: PoweredByProps) {
  return (
    <p className={className}>
      <span className="inline-flex items-center gap-1.5 text-xs text-copy-muted">
        {label}
        <ArtemisLogo variant="mark" className="h-3.5" />
        <span className="font-medium">{APP_IDENTITY.company}</span>
      </span>
    </p>
  );
}
