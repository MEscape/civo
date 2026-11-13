import { describe, expect, it } from 'vitest';

import { CREDENTIAL_LIMITS } from '@modules/auth/application/contracts/auth-constraints';
import { assessPassword } from '@modules/auth/presentation/password/password-strength';

describe('rating a password while it is typed', () => {
  it('rates nothing while nothing is typed', () => {
    expect(assessPassword('')).toMatchObject({ level: 0, isLongEnough: false, isNotCommon: true });
  });

  it('never calls a password under the minimum better than weak', () => {
    const short = 'Xk9#mQ2!vL7$wZ'.slice(0, CREDENTIAL_LIMITS.passwordMin - 1);

    expect(assessPassword(short)).toMatchObject({ level: 1, isLongEnough: false });
  });

  it('knows the common passwords people dress up with digits and symbols', () => {
    for (const password of ['passwort12345', 'Password!!1234', 'qwertzqwertz1']) {
      expect(assessPassword(password)).toMatchObject({ level: 1, isNotCommon: false });
    }
  });

  it('sees through a run of neighbouring characters and a single repeated one', () => {
    for (const password of ['abcdefghijklmn', '1234567890123', 'aaaaaaaaaaaaa', 'asdfghjklasdf']) {
      expect(assessPassword(password)).toMatchObject({ level: 1 });
    }
  });

  it('rewards length: a long passphrase is strong', () => {
    expect(assessPassword('correct horse battery staple')).toMatchObject({
      level: 4,
      isLongEnough: true,
      isNotCommon: true,
    });
  });

  it('rates the shortest allowed password fair, not strong', () => {
    expect(assessPassword('kqzvbmwtrxpy').level).toBe(2);
  });

  it('grows with length and variety', () => {
    const levels = ['kqzvbmwtrxpy', 'Kqzv7bmwtrxpy9', 'Kqzv7bmwTrxpy9Lh2s!d'].map(
      (password) => assessPassword(password).level,
    );

    expect(levels).toEqual([2, 3, 4]);
  });

  it('climbs a step at a time while a passphrase is typed, never jumping', () => {
    const typed = 'correct horse battery staple';
    const levels = Array.from(typed, (_, at) => assessPassword(typed.slice(0, at + 1)).level);

    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    levels.slice(1).forEach((level, at) => {
      expect(level - (levels[at] ?? 0)).toBeLessThanOrEqual(1);
    });
    expect(new Set(levels)).toEqual(new Set([1, 2, 3, 4]));
  });

  it('holds back a password that echoes the name or address of the person', () => {
    const own = assessPassword('Maria.Schneider2027x', [
      'maria.schneider@stadt.de',
      'Maria Schneider',
    ]);

    expect(own).toMatchObject({ avoidsPersonalInfo: false });
    expect(own.level).toBeLessThanOrEqual(2);
    expect(assessPassword('Kqzv7bmwTrxpy9Lh', ['maria@stadt.de']).avoidsPersonalInfo).toBe(true);
  });

  it('says nothing about personal details when there are none to compare with', () => {
    expect(assessPassword('Kqzv7bmwTrxpy9Lh').avoidsPersonalInfo).toBeNull();
    // Parts shorter than three characters are noise, not details.
    expect(assessPassword('Kqzv7bmwTrxpy9Lh', ['jo@x.de']).avoidsPersonalInfo).toBeNull();
  });
});
