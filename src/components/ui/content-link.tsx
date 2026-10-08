import type { AnchorHTMLAttributes } from 'react';

export interface ContentLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  readonly href: string;
}

/**
 * A link whose target comes from content rather than from the app: a
 * municipality's URL, a `mailto:` or `tel:` address, or a path of the
 * published site an editor typed. It is deliberately not locale-prefixed or
 * client-routed; app navigation uses the locale-aware `Link` from '@i18n'.
 */
export function ContentLink({ href, children, ...props }: ContentLinkProps) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}
