import { RESOURCE_LIMITS } from '../../application/contracts/booking-constraints';

const GERMAN_LETTERS: Readonly<Record<string, string>> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
};

/**
 * Turns what a person typed ("Gebärden Sprache") into the key that is stored
 * (`gebaerden-sprache`): lower-case words joined by hyphens, the shape the
 * domain accepts. `null` when nothing usable is left or the key is too long.
 */
export function toSkillKey(raw: string): string | null {
  const key = raw
    .trim()
    .toLowerCase()
    .replace(/[äöüß]/g, (letter) => GERMAN_LETTERS[letter] ?? letter)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return key === '' || key.length > RESOURCE_LIMITS.skillMax ? null : key;
}

/** How a stored key reads in a list when no better label exists: "sign-language" becomes "sign language". */
export function skillLabelOf(key: string): string {
  return key.replace(/-/g, ' ');
}

/** The list a skill picker offers: the known keys, labelled readably, plus any chosen key the list no longer knows. */
export function skillChoices(
  known: readonly string[],
  chosen: readonly string[],
): ReadonlyArray<{ readonly value: string; readonly label: string }> {
  return [...new Set([...known, ...chosen])].map((key) => ({
    value: key,
    label: skillLabelOf(key),
  }));
}
