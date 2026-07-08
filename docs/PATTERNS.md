# Lifestack Web - UI and Frontend Patterns

> Concrete UI, form, and interaction patterns for `lifestack-web`.

---

## Validation and UX Robustness

### Domain-Aligned Inputs
The UI control should match the domain concept, not just the raw transport type. If the domain concept is "month" or "budget period", do not expose a generic day-level date control unless the user is actually allowed to pick any day.

**Pattern:**
- Use a month/year selector when the backend stores a canonical month field (e.g. `start_month` for budgets).
- Use a full date picker only when day-level precision is meaningful to the user.
- Treat a generic `<input type="date">` for month-only workflows as an interim control, not the target UX.

### Date Normalization
When the backend enforces specific date constraints (for example, "must be the 1st of the month"), the frontend should proactively normalize inputs before submission. This prevents unnecessary `422 Unprocessable Entity` errors and keeps the backend as the final source of truth.

**Pattern:**
```typescript
// Frontend normalization in SpendingPage.tsx
const handleSave = () => {
  // Always normalize to the 1st of the month for budget start/end
  const normalizedDate = budgetMonth.substring(0, 7) + "-01";
  await api.saveBudget({ ...data, start_month: normalizedDate });
};
```

**Guideline:**
- Constrain in the UI when possible.
- Normalize before sending.
- Still rely on the backend to validate the canonical shape.

### API-Aware Form UX
Forms should be designed from API semantics, not just field names or primitive types. The frontend should distinguish between "invalid input shape" and "valid shape but domain conflict".

**Pattern:**
- `422 Unprocessable Entity`: the UI produced an invalid request shape or violated a strict validation rule. The preferred fix is better controls, normalization, or clearer inline validation.
- `409 Conflict`: the request shape is valid, but it violates a domain uniqueness or state rule. The UI should surface a recovery path such as "edit existing", "view existing", or a clear explanatory message.

For the spending budget flow specifically:
- `start_month` / `end_month` are month-level domain concepts with a canonical day of `01`.
- Attempting to create a duplicate budget (same scope + overlapping date range) should be treated as a conflict-aware UX branch, not a generic failure case.

### Modal and Dropdown Overflow
Modals containing absolute-positioned elements (like `DropdownSelect`) should not use `overflow-hidden` on their main container, as this will clip the dropdown list. Use `overflow-visible` (default) instead.

**Pattern:**
```tsx
// Bad: clips absolute children
<div className="relative overflow-hidden rounded-2xl ...">

// Good: allows dropdowns to overflow
<div className="relative rounded-2xl ...">
```

### Overlay-Safe Shared Components
Any shared component that renders a floating surface should be treated as an overlay, even if the first implementation is simple.

**Pattern:**
- Dropdowns, calendars, popovers, command menus, and autocomplete lists must be tested inside modals and narrow containers.
- If a component depends on absolute positioning, parent clipping rules must be reviewed.
- When the component system matures, prefer primitives that support portals and robust focus management.

---

## Server-State Conventions (TanStack Query)

- **Query keys** come from `src/lib/queryKeys.ts` — the module-scoped registry
  (`['module', 'resource', ...params]`). Never inline raw key arrays in pages;
  invalidation scope depends on the shared prefixes.
- **Mutations** use `src/hooks/useInvalidatingMutation.ts`:
  `useInvalidatingMutation(mutationFn, invalidateKeys, { onSuccess })`. It
  invalidates each key on success (isolating per-key failures) before calling
  your `onSuccess`. Pages should not hand-roll `useMutation` +
  `queryClient.invalidateQueries` pairs.
- **API response shapes** are Zod schemas in `src/types/<module>.ts` — the
  single source of truth. Services parse every response
  (`Schema.parse(response.data)`); response types are `z.infer`-derived;
  request payload types stay plain interfaces. When the backend shape changes,
  update the schema — a drifted schema fails loudly at the network boundary
  instead of rendering garbage.
