import { describe, expect, it, vi } from 'vitest';

import { applyActionError } from '@lib/actions/apply-action-error';

interface Values {
  slug: string;
  title: string;
}

describe('applyActionError', () => {
  it('puts each field error on its input and focuses only the first', () => {
    const setError = vi.fn();

    const shown = applyActionError<Values>(
      {
        code: 'site.invalid_input',
        message: 'm',
        fieldErrors: { title: ['required', 'x'], slug: ['taken'] },
      },
      setError,
    );

    expect(shown).toBeNull();
    expect(setError).toHaveBeenNthCalledWith(
      1,
      'title',
      { type: 'server', message: 'required' },
      { shouldFocus: true },
    );
    expect(setError).toHaveBeenNthCalledWith(
      2,
      'slug',
      { type: 'server', message: 'taken' },
      { shouldFocus: false },
    );
  });

  it('routes a form-level code to the field it belongs to', () => {
    const setError = vi.fn();

    const shown = applyActionError<Values>({ code: 'site.slug_taken', message: 'm' }, setError, {
      'site.slug_taken': 'slug',
    });

    expect(shown).toBeNull();
    expect(setError).toHaveBeenCalledWith(
      'slug',
      { type: 'server', message: 'site.slug_taken' },
      { shouldFocus: true },
    );
  });

  it('hands back the code when nothing can be placed on a field', () => {
    const setError = vi.fn();

    const shown = applyActionError<Values>(
      { code: 'site.persistence_failed', message: 'm' },
      setError,
    );

    expect(shown).toBe('site.persistence_failed');
    expect(setError).not.toHaveBeenCalled();
  });

  it('leaves root-level problems to the form-level message', () => {
    const setError = vi.fn();

    const shown = applyActionError<Values>(
      { code: 'site.invalid_input', message: 'm', fieldErrors: { _form: ['bad'] } },
      setError,
    );

    expect(shown).toBe('site.invalid_input');
    expect(setError).not.toHaveBeenCalled();
  });

  it('skips a field that carries no codes', () => {
    const setError = vi.fn();

    const shown = applyActionError<Values>(
      { code: 'site.invalid_input', message: 'm', fieldErrors: { title: [] } },
      setError,
    );

    expect(setError).not.toHaveBeenCalled();
    expect(shown).toBeNull();
  });
});
