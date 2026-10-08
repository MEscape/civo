import localFont from 'next/font/local';

/**
 * Loaded exactly once here and exposed as CSS variables, consumed by the
 * root layout and design tokens in globals.css. styling.md: "prefer shared
 * design tokens over hard-coded visual values" — this file is what makes
 * the typeface itself a token rather than a per-component font import.
 */

export const fontSerif = localFont({
  src: [
    {
      path: '../../../public/fonts/source-serif/SourceSerif4-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../../public/fonts/source-serif/SourceSerif4-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-serif',
  display: 'swap',
});

export const fontSans = localFont({
  src: [
    { path: '../../../public/fonts/inter/Inter-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../../public/fonts/inter/Inter-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../../../public/fonts/inter/Inter-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: '../../../public/fonts/inter/Inter-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-sans',
  display: 'swap',
});

export const fontGeist = localFont({
  src: [
    { path: '../../../public/fonts/geist/Geist-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../../public/fonts/geist/Geist-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../../../public/fonts/geist/Geist-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: '../../../public/fonts/geist/Geist-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-geist',
  display: 'swap',
});

export const fontDMSans = localFont({
  src: [
    { path: '../../../public/fonts/dm-sans/DMSans-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../../public/fonts/dm-sans/DMSans-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../../../public/fonts/dm-sans/DMSans-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-dm-sans',
  display: 'swap',
});

/** Applied on `<html>` in the root layout so every route inherits both variables. */
export const fontVariables = `${fontSerif.variable} ${fontSans.variable} ${fontGeist.variable} ${fontDMSans.variable}`;
