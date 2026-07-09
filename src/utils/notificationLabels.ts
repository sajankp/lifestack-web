// Notification `category` is a free-form string set by the backend (see
// src/types/notifications.ts) — this is the humanized label map for every
// category currently emitted, plus a title-case fallback for anything new.
const CATEGORY_LABELS: Record<string, string> = {
  todo_reminder: 'Todo reminders',
  medication_reminder: 'Medication reminders',
  budget: 'Budget alerts',
  budget_guardrail: 'Budget guardrails',
  insight: 'Insights',
  briefing: 'Morning briefing',
  system: 'System',
  general: 'General',
};

export function categoryLabel(category: string | null | undefined): string {
  if (!category) return '';
  if (CATEGORY_LABELS[category]) return CATEGORY_LABELS[category];
  return category
    .split('_')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}
