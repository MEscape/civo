import { Suspense } from 'react';
import type { ReactNode } from 'react';

import { SectionBar } from '@components/layout/layout-primitives';
import { SectionBarSkeleton } from '@components/skeletons/section-bar-skeleton';

import { PublishChip } from './_components/publish-chip';
import { WebsiteNav } from './_components/website-nav';

interface LayoutProps {
  readonly children: ReactNode;
  readonly params: Promise<{ locale: string; websiteId: string }>;
}

/**
 * Every page of one website, the visual editor included, sits under this bar: it names the
 * website and stays put, so moving between the website's areas never leaves the website.
 */
export default function WebsiteLayout({ children, params }: LayoutProps) {
  return (
    <>
      <SectionBar>
        <Suspense fallback={<SectionBarSkeleton hasTrailing />}>
          <WebsiteNav params={params} />
        </Suspense>
        <div className="ml-auto flex shrink-0 items-center pl-4">
          <Suspense fallback={null}>
            <PublishChip params={params} />
          </Suspense>
        </div>
      </SectionBar>
      {children}
    </>
  );
}
