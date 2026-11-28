import { describe, expect, it } from 'vitest';
import { themeLabel } from './themeLabel';

describe('themeLabel', () => {
  it('uses the explicit name for a known key', () => {
    expect(themeLabel('semis_ai')).toBe('Semis & AI');
  });

  it('title-cases an unknown snake_case key and upper-cases acronyms', () => {
    expect(themeLabel('clean_energy')).toBe('Clean energy');
    expect(themeLabel('us_small_cap')).toBe('US small cap');
    expect(themeLabel('gold')).toBe('Gold');
  });

  it('leaves a name that already reads as text alone', () => {
    expect(themeLabel('US Equities')).toBe('US Equities');
    expect(themeLabel('Cash & equivalents')).toBe('Cash & equivalents');
  });

  it('never returns an empty label', () => {
    expect(themeLabel('')).toBe('Unclassified');
    expect(themeLabel('   ')).toBe('Unclassified');
  });
});
