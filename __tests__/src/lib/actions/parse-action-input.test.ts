import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createActionInputParser } from '@lib/actions/parse-action-input';

const parse = createActionInputParser('site.invalid_input');

const schema = z.object({
  title: z.string().min(1),
  colors: z.object({ primary: z.string().regex(/^#/) }),
});

describe('createActionInputParser', () => {
  it('returns the parsed data', () => {
    const input = { title: 'Hello', colors: { primary: '#fff' } };

    expect(parse(schema, input)._unsafeUnwrap()).toEqual(input);
  });

  it('reports every problem on its dotted field path under the module’s code', () => {
    const error = parse(schema, { title: '', colors: { primary: 'red' } })._unsafeUnwrapErr();

    expect(error.kind).toBe('validation');
    expect(error.code).toBe('site.invalid_input');
    expect(Object.keys(error.fieldErrors).sort()).toEqual(['colors.primary', 'title']);
  });

  it('files a problem with the input as a whole under the root field', () => {
    const error = parse(schema, 'not an object')._unsafeUnwrapErr();

    expect(Object.keys(error.fieldErrors)).toEqual(['_form']);
  });

  it('keeps several problems on one field', () => {
    const strict = z.object({ code: z.string().min(5).regex(/^\d+$/) });

    const error = parse(strict, { code: 'ab' })._unsafeUnwrapErr();

    expect(error.fieldErrors['code']).toHaveLength(2);
  });

  it('never leaks the offending input into the error', () => {
    const error = parse(schema, { title: 'secret-value', colors: { primary: 'nope' } });

    expect(JSON.stringify(error._unsafeUnwrapErr())).not.toContain('secret-value');
  });
});

describe('createActionInputParser with keys taken from the input', () => {
  const records = z.object({ props: z.record(z.string(), z.number()) });

  it.each(['constructor', 'toString', 'hasOwnProperty'])(
    'reports a bad value under the key %s instead of throwing',
    (key) => {
      const input = JSON.parse(`{"props": {"${key}": "not a number"}}`) as unknown;

      const error = parse(records, input)._unsafeUnwrapErr();

      expect(error.fieldErrors[`props.${key}`]).toHaveLength(1);
    },
  );
});
