# Spec-011: Account Activity Daily Closing Highlight

**Created:** 2026-08-04
**Status:** Implemented 2026-08-04 — persisted general user timezone; Account activity is the first consumer
**Scope:** `lifestack-api` + `lifestack-web`.

---

## Problem

Spending → Account activity can show several ledger entries on the same day. Although every row
contains its running balance, visually comparing the ledger with a bank or wallet statement requires
finding the final balance for each day by hand.

## Goal

Make each visible day's closing ledger entry immediately recognizable so the user can scan and match
daily closing balances against a statement.

## Behavior

- Ledger entries remain in their existing newest-first order.
- The chronologically latest entry for each calendar day in the user's effective timezone is the
  daily closing entry. This is the
  first row of each day group in the newest-first response.
- Highlight the entire daily-closing row/card with a subtle teal/emerald background and border, and
  show a compact `Daily close` label beside its running balance. The label ensures the meaning is not
  conveyed by color alone.
- Apply the same treatment to desktop table rows and mobile/tablet cards, including transaction and
  transfer entries.
- Display Account activity dates and group rows using the same effective timezone so the displayed
  date and daily-close highlighting cannot disagree.
- Preserve the current row ordering, amounts, running balances, actions, and transfer-specific colors.

## Pagination correctness

The ledger is paginated. A page after the first may begin in the middle of a day, so its first row must
not automatically be treated as that day's closing entry. When `offset > 0`, fetch the immediately
preceding (newer) ledger entry through the existing endpoint and use it only for the page-boundary
comparison. No extra request is needed on the first page.

## Reusable user timezone preference

- Add an optional, validated IANA timezone to the general user profile (for example
  `Asia/Kolkata`), not to finance settings or an individual ledger.
- Expose it through `GET /auth/me` and a narrowly scoped authenticated profile update endpoint.
- Add a Settings → Preferences control that starts with the browser-detected IANA timezone when the
  user has not saved one and persists the explicit selection.
- A shared web helper returns the saved timezone, falling back to
  `Intl.DateTimeFormat().resolvedOptions().timeZone`, then `UTC` only when neither is available.
- The preference is reusable infrastructure. This spec changes Account activity only; migrating
  todos, summaries, voice capture, and other existing timezone behaviors is follow-up scope so this
  feature cannot silently alter unrelated schedules.
- Store the IANA name rather than a numeric UTC offset so daylight-saving transitions remain correct.

## Testing

- With multiple entries on one day, only the newest entry has the daily-close treatment.
- Entries on different days are each highlighted.
- A page beginning midway through a day does not falsely highlight its first entry.
- A page beginning on a new day does highlight its first entry.
- The indicator is present in both responsive renderings and is accessible without relying on color.
- Invalid/unknown timezone names are rejected by the API; an authenticated user can read and update
  their timezone without changing other profile fields.
- Run the focused Vitest coverage plus frontend test, build, and lint validation.
