import { describe, expect, it } from 'vitest';

import { validationError } from '@lib/errors/factory';
import { FieldErrorBag } from '@lib/errors/field-error-bag';

const newBag = () =>
  new FieldErrorBag((fieldErrors) => validationError('x.invalid', 'm', fieldErrors));

describe('FieldErrorBag', () => {
  it('starts empty and builds an error with no field problems', () => {
    const bag = newBag();

    expect(bag.hasErrors).toBe(false);
    expect(bag.toError()).toMatchObject({ kind: 'validation', code: 'x.invalid', fieldErrors: {} });
  });

  it('collects several codes on one field and codes on several fields', () => {
    const bag = newBag();

    bag.add('title', 'too_long');
    bag.add('title', 'forbidden_word');
    bag.add('colors.primary', 'not_hex');

    expect(bag.hasErrors).toBe(true);
    expect(bag.toError().fieldErrors).toEqual({
      title: ['too_long', 'forbidden_word'],
      'colors.primary': ['not_hex'],
    });
  });

  it('records a code only when the check failed, and hands the check back', () => {
    const bag = newBag();

    expect(bag.expect(true, 'a', 'never')).toBe(true);
    expect(bag.expect(false, 'b', 'bad')).toBe(false);

    expect(bag.toError().fieldErrors).toEqual({ b: ['bad'] });
  });

  it('builds an error that does not alias the bag', () => {
    const bag = newBag();
    bag.add('title', 'first');
    const built = bag.toError();

    bag.add('title', 'second');

    expect(built.fieldErrors).toEqual({ title: ['first'] });
    expect(bag.toError().fieldErrors).toEqual({ title: ['first', 'second'] });
  });
});

describe('FieldErrorBag with a path named like a prototype member', () => {
  it.each(['constructor', 'toString', '__proto__'])('keeps %s as an ordinary field', (path) => {
    const bag = newBag();

    bag.add(path, 'bad');
    bag.add(path, 'worse');

    expect(Object.getOwnPropertyDescriptor(bag.toError().fieldErrors, path)?.value).toEqual([
      'bad',
      'worse',
    ]);
  });
});
