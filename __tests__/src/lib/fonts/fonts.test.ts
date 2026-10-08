import { describe, expect, it, vi } from 'vitest';

import { fontSans, fontSerif, fontGeist, fontDMSans, fontVariables } from '@lib/fonts/fonts';

// Mock the Next.js font compiler macros which otherwise require the Next.js build step
vi.mock('next/font/local', () => ({
  default: vi.fn((options: any) => ({ variable: `${options.variable}-mock` })),
}));

describe('fonts design tokens', () => {
  it('exposes the configured sans, serif, geist, and dm-sans fonts', () => {
    // We assert that the application correctly exports the objects
    // returned by the font loaders, rather than testing Next.js's font loading behavior.
    expect(fontSans.variable).toBe('--font-sans-mock');
    expect(fontSerif.variable).toBe('--font-serif-mock');
    expect(fontGeist.variable).toBe('--font-geist-mock');
    expect(fontDMSans.variable).toBe('--font-dm-sans-mock');
  });

  it('concatenates font variables into a single string for the root layout', () => {
    expect(fontVariables).toBe(
      '--font-serif-mock --font-sans-mock --font-geist-mock --font-dm-sans-mock',
    );
  });
});
