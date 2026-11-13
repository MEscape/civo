import { invalid, ruleTester, rules, valid } from './rule-tester';

const PAGE = 'src/app/[locale]/shops/page.tsx';

ruleTester.run('architecture/metadata-conventions', rules['metadata-conventions']!, {
  valid: [
    valid(
      PAGE,
      `import { buildLocalizedMetadata } from '@lib/seo';
export async function generateMetadata({ params }) { const { locale } = await params; return buildLocalizedMetadata({ locale, pathname: '/shops', title: 't', description: 'd' }); }
export default function Page() { return <h1>Shops</h1>; }`,
    ),
    valid(
      PAGE,
      `import { buildLocalizedMetadata } from '@lib/seo';
export const metadata = buildLocalizedMetadata({ locale: 'de', pathname: '/', title: 't', description: 'd' });
export default function Page() { return null; }`,
    ),
    // internal pages are intentionally not indexed, and say so
    valid(
      'src/app/[locale]/(protected)/dashboard/page.tsx',
      `export const metadata = { title: 'Dashboard', robots: { index: false, follow: false } };
export default function Page() { return null; }`,
    ),
    // the other @lib/seo builders decide indexability too
    valid(
      'src/app/[locale]/(protected)/dashboard/page.tsx',
      `import { buildPrivateMetadata } from '@lib/seo';
export async function generateMetadata() { return buildPrivateMetadata('Dashboard'); }
export default function Page() { return null; }`,
    ),
    valid(
      'src/app/[locale]/(public)/s/[siteSlug]/page.tsx',
      `import { buildContentMetadata } from '@lib/seo';
export async function generateMetadata() { return buildContentMetadata({ pathname: '/s/x', title: 't', description: 'd', siteName: 's' }); }
export default function Page() { return null; }`,
    ),
    // layouts and other files are not pages
    valid(
      'src/app/[locale]/layout.tsx',
      'export default function Layout({ children }) { return <div>{children}</div>; }',
    ),
    valid(
      'src/app/[locale]/shops/loading.tsx',
      'export default function Loading() { return <p>…</p>; }',
    ),
  ],
  invalid: [
    invalid(
      PAGE,
      'export default function Page() { return null; }',
      /Every page exports `metadata` or `generateMetadata`/,
    ),
    invalid(
      PAGE,
      "export const metadata = { title: 'Shops' };\nexport default function Page() { return null; }",
      /Make indexability intentional/,
    ),
    invalid(
      PAGE,
      "export async function generateMetadata() { return { title: 'x', alternates: { canonical: '/shops' } }; }\nexport default function Page() { return null; }",
      /Make indexability intentional/,
      /Do not build canonical URLs by hand/,
    ),
    invalid(
      PAGE,
      `import { buildLocalizedMetadata } from '@lib/seo';
export const metadata = buildLocalizedMetadata({ locale: 'de', pathname: '/', title: 't', description: 'd' });
export default function Page() { return <><title>x</title><h1>x</h1></>; }`,
      /Do not render <title> in a page/,
    ),
    invalid(
      'src/app/[locale]/layout.tsx',
      'export default function Layout() { return <link rel="canonical" href="/x" />; }',
      /Do not render <link> in a page/,
    ),
  ],
});

ruleTester.run('architecture/heading-hierarchy', rules['heading-hierarchy']!, {
  valid: [
    valid('src/x.tsx', 'export const A = () => <><h1>a</h1><h2>b</h2><h3>c</h3><h2>d</h2></>;'),
    valid(
      'src/x.tsx',
      'export const A = () => <section><h3>a component can start anywhere</h3><h4>x</h4></section>;',
    ),
    valid('src/x.tsx', 'export const A = () => <><h2>a</h2><h2>b</h2></>;'),
  ],
  invalid: [
    invalid(
      'src/x.tsx',
      'export const A = () => <><h1>a</h1><h3>c</h3></>;',
      /Heading level jumps from h1 to h3/,
    ),
    invalid(
      'src/x.tsx',
      'export const A = () => <><h2>a</h2><h5>c</h5></>;',
      /jumps from h2 to h5/,
    ),
    invalid(
      'src/x.tsx',
      'export const A = () => <><h1>a</h1><h1>b</h1></>;',
      /A page has one <h1>/,
    ),
  ],
});

ruleTester.run('architecture/no-page-query-orchestration', rules['no-page-query-orchestration']!, {
  valid: [
    valid(
      'src/app/[locale]/websites/audit/page.tsx',
      'export default function Page() { return <AuditAdministration />; }',
    ),
    valid(
      'src/app/[locale]/websites/page.tsx',
      'export default async function Page() { const res = await queries.list.execute(); return <div>{res}</div>; }',
    ),
    valid(
      'src/modules/audit/presentation/loaders/load-audit.ts',
      'export async function load(q) { await q.a.execute(); await q.b.execute(); }',
    ),
  ],
  invalid: [
    invalid(
      'src/app/[locale]/audit/page.tsx',
      'export default async function Page(q) { const a = await q.a.execute(); const b = await q.b.execute(); return <div />; }',
      /Route page 'src\/app\/\[locale\]\/audit\/page\.tsx' must not orchestrate multi-step queries \(2 calls to \.execute\)/,
      /Route page 'src\/app\/\[locale\]\/audit\/page\.tsx' must not orchestrate multi-step queries \(2 calls to \.execute\)/,
    ),
  ],
});

const PROTECTED = 'src/app/[locale]/(protected)/websites/[websiteId]/media/page.tsx';

ruleTester.run('architecture/page-structure', rules['page-structure']!, {
  valid: [
    valid(
      PROTECTED,
      `import { Suspense } from 'react';
async function MediaContent({ params }) { const { websiteId } = await params; return <MediaAdministration websiteId={websiteId} />; }
export default function MediaPage(props) { return (<Suspense fallback={<MediaPageSkeleton />}><MediaContent {...props} /></Suspense>); }`,
    ),
    // public pages and layouts are not held to it
    valid(
      'src/app/[locale]/(public)/s/[siteSlug]/page.tsx',
      'export default function Page() { return <main />; }',
    ),
  ],
  invalid: [
    invalid(
      PROTECTED,
      'export default function Page() { return <MediaAdministration />; }',
      /returns <Suspense fallback/,
    ),
    invalid(
      PROTECTED,
      `import { Suspense } from 'react';
export default function Page(props) { return <Suspense><MediaContent {...props} /></Suspense>; }
async function MediaContent() { return null; }`,
      /needs a `fallback`/,
    ),
    invalid(
      PROTECTED,
      `import { Suspense } from 'react';
export default function Page(props) { return <Suspense fallback={<S />}><Media {...props} /></Suspense>; }`,
      /local `async function …Content/,
    ),
    invalid(
      PROTECTED,
      `import { Suspense } from 'react';
async function MediaContent() { const a = 1; const b = 2; const c = 3; const d = 4; const e = 5; const f = 6; const g = 7; const h = 8; const i = 9; return null; }
export default function Page(props) { return <Suspense fallback={<S />}><MediaContent {...props} /></Suspense>; }`,
      /has 10 statements/,
    ),
  ],
});
