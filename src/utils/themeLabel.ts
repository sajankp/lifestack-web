// Readable names for the theme keys the portfolio report pushes (spec-113 §5.3):
// `semis_ai` -> "Semis & AI". An explicit map covers the keys we know; anything else that looks
// like a machine key (snake_case) is title-cased. A name that already reads as text is left alone.

const KNOWN = new Map<string, string>([
  ['semis_ai', 'Semis & AI'],
  ['ai_semis', 'Semis & AI'],
  ['us_equities', 'US equities'],
  ['india_equities', 'India equities'],
  ['gold_silver', 'Gold & silver'],
]);

const ACRONYMS = new Set(['ai', 'us', 'uk', 'eu', 'etf', 'it', 'reit', 'usd', 'inr']);

const MACHINE_KEY = /^[a-z0-9_]+$/;

export const themeLabel = (key: string): string => {
  const trimmed = key.trim();
  if (!trimmed) return 'Unclassified';
  const known = KNOWN.get(trimmed);
  if (known) return known;
  if (!MACHINE_KEY.test(trimmed)) return trimmed;
  return trimmed
    .split('_')
    .filter(Boolean)
    .map((word, index) =>
      ACRONYMS.has(word)
        ? word.toUpperCase()
        : index === 0
          ? word.charAt(0).toUpperCase() + word.slice(1)
          : word,
    )
    .join(' ');
};
