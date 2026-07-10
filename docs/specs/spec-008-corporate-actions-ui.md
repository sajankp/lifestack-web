# Spec-008: Corporate Actions UI (record & manage splits/bonus from the web app)

**Created:** 2026-07-10
**Status:** Implemented 2026-07-11 — owner-approved and built. Orders-tab collapsible section (list + record modal + delete-with-replay-warning confirm), CAMS advisory now links to `/investing?tab=orders`. Preview arithmetic is illustrative only, sourced from a live holdings lookup (not a canned zero). `tsc -b`, `vite build`, lint (0 errors), and the full vitest suite (188 passed) all green. e2e coverage (record→replay→delete) left as a follow-up per the spec's own testing plan.
**Scope:** `lifestack-web` only — one web PR. **No API or schema changes**: the backend shipped complete in api spec-051 (api#102) with `POST` / `GET` / `DELETE /investing/corporate-actions`.
**Depends on:** api spec-051 (corporate-actions backend). **Closes a loose end from:** api spec-056 — the CAMS-import advisory instructs the user to "Record it under Investing → Corporate Actions", a screen that does not exist.

---

## Problem

Api spec-051 made splits, reverse splits, and bonus issues first-class backend events — replayed by `ex_date` alongside orders, scaling open FIFO lots in place (splits) or creating a zero-cost lot (bonus), cash-neutral by construction. But it shipped **API-only**. Today the sole way to record one is a raw API call.

Two consequences:

1. **The feature is invisible.** A real split/bonus in the user's portfolio silently distorts quantities until someone hand-crafts a POST — in practice it just doesn't get recorded.
2. **The UI already points at the missing screen.** The imports advisory (`ImportsPage.tsx`, "Possible un-applied corporate action") tells the user: *"Record it under Investing → Corporate Actions."* That destination was never built — a dead instruction shipped with api spec-056.

## Goal

A thin web UI over the existing endpoints: **list**, **record**, and **delete** corporate actions, and turn the imports-advisory instruction into a working link.

## Non-goals (this spec)

- Any backend change — endpoints, schema, and replay semantics are api spec-051's and are not touched. (There is deliberately no `PATCH`; the edit path is delete + recreate, consistent with full-replay correctness.)
- Automatic detection/ingestion of corporate actions from a data feed — the CAMS NAV-discontinuity advisory (api spec-056) remains the only detector.
- Dividends — that is income, not a quantity event; api spec-073.

## Solution

### Placement

A **"Corporate actions" section on the Orders tab** (`src/pages/investing/OrdersTab.tsx`) — actions replay chronologically *with* orders and belong in the same mental space. Collapsible section below the orders list, mirroring existing section patterns. (Alternative considered: own tab — rejected for v1; expected row count is tiny.)

### List

- Table of recorded actions from `GET /investing/corporate-actions` (paginated): account, symbol, type (split / reverse split / bonus), ratio rendered human-readably, ex-date, notes, created.
- **Ratio display must match api spec-051 semantics** (they are type-dependent): split `ratio_base → ratio_quote` renders "1 old → 5 new"; bonus renders "1 free per 2 held" (`ratio_quote` free per `ratio_base` held).
- Empty state: one line + "Record corporate action" button.

### Record modal

- Fields mapping 1:1 to `CorporateActionCreate`: account (existing account dropdown), symbol (picker fed from that account's holdings — free-text fallback allowed, uppercased client-side to match API normalization), action type, ratio (two numeric inputs with the type-dependent phrasing above, both > 0, ≤ 4 decimal places), ex-date (house date-validation patterns per MEMORY-FRONTEND), optional notes (≤ 255).
- **Effect preview** before submit: for the chosen symbol/account, show held quantity on ex-date → resulting quantity ("120 units → 600 units" for a 1→5 split; "+60 bonus units" for 1:2). Client-side arithmetic on the current holding quantity — labeled approximate, since the authoritative result comes from backend replay.
- API errors (unknown symbol/account, validation) surface inline in the modal.

### Delete

- Per-row delete with a confirm dialog that states the consequence plainly: *"Deleting recomputes this symbol's holdings and realized gains from scratch (full replay)."* No undo; re-record to restore.

### Imports-advisory link

- The advisory text in `ImportsPage.tsx` becomes a real link/navigation to the new section (deep-link to Investing → Orders with the section expanded, prefilling symbol when the advisory carries one — prefill is nice-to-have, link is required).

## Invariants (must hold)

- **INV-1 — Thin client.** The UI performs no financial arithmetic beyond the labeled-approximate preview; all authoritative effects come from backend replay. No optimistic quantity updates — after create/delete, refetch holdings/orders queries (TanStack invalidation).
- **INV-2 — Semantics-faithful rendering.** Split and bonus ratios are displayed per api spec-051's type-dependent semantics; a bonus is never rendered with split phrasing or vice versa (regression-tested — this is the likeliest UI bug).
- **INV-3 — No dead instructions.** The api spec-056 advisory link must point at the shipped section (e2e-verified), retiring the current dead text.

## Now vs. Proposed

| Aspect | Now | Proposed |
|---|---|---|
| Recording a split/bonus | raw API call only | Orders-tab section + modal |
| Visibility of recorded actions | none | list with ratios, ex-dates, notes |
| Imports advisory ("record it under…") | points at nonexistent screen | working link, optional prefill |
| Deleting a mis-entered action | raw API call | confirm dialog explaining full replay |

## Testing & evidence

- Component tests: list rendering (both ratio phrasings — INV-2), empty state, modal validation (ratio bounds, decimal places, symbol uppercasing), error surfacing, delete confirm.
- Preview arithmetic unit tests: split, reverse split, bonus quantization.
- Query invalidation test: create/delete invalidates holdings + orders queries (INV-1).
- e2e (lifestack-e2e): record a split via UI → holdings quantity reflects replay; delete → restored; advisory link navigates (INV-3).
- Web CI: real `npm run build`, not just `tsc --noEmit`. Coverage gate respected.

## Open questions (for approval)

1. **Confirm Orders-tab placement** (vs a dedicated tab)? *Recommendation: Orders tab, collapsible section — actions are order-timeline events and volume is tiny.*
2. **Advisory prefill** (symbol carried from the CAMS advisory into the modal) in v1 or follow-up? *Recommendation: v1 if trivial once deep-link exists; never blocks the PR.*
