import { categoryLabel } from './notificationLabels';

describe('categoryLabel', () => {
  it('labels the weekly net-worth push', () => {
    expect(categoryLabel('weekly_wealth')).toBe('Weekly net worth');
  });

  it('keeps existing labels and the title-case fallback', () => {
    expect(categoryLabel('briefing')).toBe('Morning briefing');
    expect(categoryLabel('some_new_category')).toBe('Some New Category');
    expect(categoryLabel(null)).toBe('');
  });
});
