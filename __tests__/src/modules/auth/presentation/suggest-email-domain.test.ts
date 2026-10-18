import { describe, expect, it } from 'vitest';

import { suggestEmailDomain } from '@modules/auth/presentation/forms/suggest-email-domain';

describe('suggesting the address someone meant', () => {
  it('corrects a domain one letter away from a well-known provider', () => {
    expect(suggestEmailDomain('anna@gmial.com')).toBe('anna@gmail.com');
    expect(suggestEmailDomain('anna@gmx.dee')).toBe('anna@gmx.de');
    expect(suggestEmailDomain('  Anna.K@web.d  ')).toBe('Anna.K@web.de');
  });

  it('keeps what the person typed before the @', () => {
    expect(suggestEmailDomain('a.b+c@hotmial.com')).toBe('a.b+c@hotmail.com');
  });

  it('leaves correct addresses and unknown domains alone', () => {
    expect(suggestEmailDomain('anna@gmail.com')).toBeNull();
    expect(suggestEmailDomain('anna@wuerzburg.de')).toBeNull();
    expect(suggestEmailDomain('anna@stadt-musterhausen.de')).toBeNull();
  });

  it('says nothing about something that is not an address yet', () => {
    for (const typed of ['', 'anna', 'anna@', '@gmail.com']) {
      expect(suggestEmailDomain(typed)).toBeNull();
    }
  });
});
