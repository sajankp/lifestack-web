/** Plain-words names for the engine's bucket keys, e.g. `indian:long_term` -> "Indian long-term". */
export const bucketName = (key: string): string => {
  const [regime = '', term = ''] = key.split(':');
  const place = regime === 'indian' ? 'Indian' : regime === 'foreign' ? 'Foreign' : regime;
  return `${place} ${term === 'long_term' ? 'long-term' : 'short-term'}`;
};

/** "short_term" -> "short-term". */
export const termName = (term: string): string => term.replace('_', '-');
