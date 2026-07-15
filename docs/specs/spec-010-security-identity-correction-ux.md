# Spec-010: Security Identity Correction UX (Holdings-primary)

**Created:** 2026-07-15
**Status:** Approved (implementation)
**Scope:** `lifestack-web` only — one web PR.
**Depends on:** api spec-083 (Security Identity Resolution & Reference Data) — `Instrument`
`ticker`/`isin`/`exchange` fields on `InstrumentCreate`/`InstrumentUpdate`, the constituent CSV
schema additions, the `identifier_status` response field, and the resolve endpoint
(`GET /v1/investing/reference/resolve`). No web work here can land ahead of that contract; this
spec is the UI-side pairing for its §8/§8a/§8b (superseding those sections as the UX source of
record — the api spec keeps them as a contract summary, this spec carries the rationale and specs
the concrete component/interaction changes).

---

## 1. Problem

Api spec-083 fixes company-identity fragmentation (same company under name variants) by resolving
identity through ISIN → ticker(+exchange) → normalized name, and makes `ticker`/`isin`/`exchange`
editable on `Instrument` for the first time. None of that is usable without a UI surface to enter
and correct those fields, and — just as important — a UI surface a user would actually **find**.

Today, instrument authoring/correction lives entirely inside the Analytics tab, behind an
`Advanced` `<details>` disclosure (`AnalyticsTab.tsx`), on a tab whose job is *reading* exposure —
not fixing data. This is a discoverability mismatch: a user noticing their Indian mutual fund is
missing its ISIN would look at the security itself (Holdings), not at an analytics screen's
collapsed advanced panel.

## 2. UX Rationale — why Holdings, not Analytics

| Signal | Holdings tab | Analytics tab |
|---|---|---|
| What it lists | Every security the user **owns** (stock/ETF/MF) | Pooled instruments + exposure/overlap read-outs |
| Existing edit surface | Edit Holding modal already edits `symbol`, `quantity`, `avg_cost`, `currency`, `instrument_type` | Inline table-cell edit for `name`/`instrument_type` only, under an `Advanced` fold |
| User's mental model | "I own this security, let me fix its details" | "I'm analyzing my portfolio's concentration" |
| Discoverability | Primary tab, daily-use | One disclosure-click deep on a secondary tab |

**Decision:** the **Holdings tab's Edit Holding modal becomes the primary identity-correction
surface.** It already edits the entity a user thinks of as "this stock I own"; extending it with
`ticker`/`isin`/`exchange` is a natural three-field addition to an existing, discoverable modal —
not a new destination.

The **Analytics `Advanced` panel is demoted, not removed**: it remains the correction path only for
**pooled instruments that have no `Holding` row** — i.e. an ETF/MF the user tracks for analytics
purposes without directly holding it (the case the panel was originally built for). Holdings and
Analytics both read/write the same `Instrument` entity (`queryKeys.investing.instruments()`), so a
correction made in either place is immediately reflected in the other — there is no data
duplication, only a change in which surface is the primary entry point.

**Company/constituent identity** (the names *inside* an ETF, which the user does not directly own)
has no analog in Holdings — it stays in the Seed Constituents modal and the CSV import preview,
which are the only surfaces where those entities exist at all.

## 3. Scope

### 3.1 Holdings tab — Edit Holding modal (primary, new)
File: `src/pages/investing/HoldingsTab.tsx`.

Add to the existing edit form:
- `Ticker` (text input, uppercase-normalized)
- `ISIN` (text input, uppercase-normalized)
- `Exchange` (text input; optional — see §4 inference note)

Behavior:
- The **required-identifier hint** (§4) is computed from the currently-selected `instrument_type`
  and shown inline above/below the identifier fields, exactly as it already reacts to
  `instrument_type` changes for the existing `Asset Type` dropdown.
- On submit, in addition to the existing `investingService.updateHolding(...)` call, PATCH the
  linked instrument's identity via `investingService.updateInstrument(instrument.public_id, {
  ticker, isin, exchange })` (new fields on `InstrumentUpdate`, api spec-083 §5.2). Both calls are
  part of the same save action from the user's perspective (single "Save" button, sequenced
  mutation or combined optimistic update — implementation detail for the coding agent). The **Save
  button must stay disabled for the full duration of both async calls** (not just the first) to
  prevent duplicate submissions on a slow second request. **Partial failure must not leave silent
  inconsistent state**: if the holding update succeeds but the instrument identity PATCH fails, the
  modal stays open, shows which part failed, and lets the user retry just the failed identity save
  rather than resubmitting the already-succeeded holding update.
- On blur of the ticker/ISIN/exchange fields, call the resolve endpoint
  (`GET /v1/investing/reference/resolve`) and show inline status: `✓ resolved (<exchange/name>)`,
  `⚠ unresolved — will still save`, or `⚠ ambiguous — confirm`. This is advisory, not blocking (see
  §5 — UI enforcement is an affordance, not the authoritative gate).

### 3.2 Analytics tab — Advanced panel (demoted, existing surface extended)
File: `src/pages/investing/AnalyticsTab.tsx`.

- The inline table-cell edit (currently `name` + `instrument_type` only) graduates to a small **Edit
  Instrument modal** (reusing the `Dialog` component already used for Create Instrument / Seed
  Constituents in this file), carrying the same `ticker`/`isin`/`exchange` fields and the same
  per-type hint as §3.1. This keeps the two surfaces visually/behaviorally consistent since they
  edit the same entity.
- No copy change is needed to signal "this is now secondary" — the natural effect of Holdings
  covering the primary flow is that most users never need to open Analytics → Advanced at all
  (per §2, that panel's realistic remaining use is analytics-only pooled instruments with no
  Holding row).

### 3.3 Seed Constituents modal — fix the `company_name = ticker` quirk
File: `src/pages/investing/AnalyticsTab.tsx`, `onUpsertConstituents`.

Today the freeform `TICKER,WEIGHT` textarea parser sets `company_name: ticker` — i.e. it stores the
ticker as if it were the company's name (`AnalyticsTab.tsx:215`). This directly feeds the
name-based fragmentation api spec-083 fixes at the backend; the UI must stop reproducing it.

Replace the two-column freeform textarea with a structured row entry (table or repeated
mini-form): **Company name**, **Ticker**, **ISIN**, **Weight** as four separate fields per row
(matching api spec-083 §5.3's CSV headers exactly: `company_name`, `company_isin`,
`company_ticker`, `weight`). Ticker and ISIN are **not** combined into one field — a single
"Ticker or ISIN" input would require client-side parsing to guess which backend field a pasted
value maps to (ISINs are 12 alphanumeric chars starting with a country code; tickers are shorter
and freeform), which is exactly the kind of inference this spec exists to eliminate. Paste-a-CSV-block
remains supported as a convenience, but parses into the same four fields — never collapses ticker
into name, and never conflates ticker with ISIN.

### 3.4 Import UI — template + preview
File: `ImportsPage.tsx` (or wherever the constituents template/preview currently render).

- Template download reflects api spec-083 §8a.1's self-documenting header (per-type identifier
  legend + example rows) — this is generated server-side per that spec; the web change here is
  ensuring the template download flow surfaces it as-is (no client-side stripping of comment lines)
  and that the new `company_isin`/`company_exchange` columns render correctly in any client-side
  preview parsing.
- The import preview table gains an **Identifier** status column reflecting per-row
  `identifier_status` (`resolved` / `unresolved` / `ambiguous`) from the validation response, with a
  tooltip explaining the reason for `unresolved`/`ambiguous` rows.

### 3.5 Create Instrument modal
File: `src/pages/investing/AnalyticsTab.tsx`.

Add the same `ticker`/`isin`/`exchange` fields + per-type hint as §3.1, since instruments can be
created directly here (not only via a holding).

## 4. Required-identifier hint (shared component)

Because four surfaces (§3.1, §3.2, §3.3, §3.5) need the identical per-type/market hint, implement it
**once** as a small shared component/hook (e.g. `useIdentifierHint(instrumentType, exchange?)`)
returning `{ requiredField: 'ticker'|'isin'|'ticker+exchange', helperText, placeholderExample }` per
api spec-083 §6's table, and consume it from all four locations. Do not fork the copy four times.

Exchange inference note (api spec-083 §6.1): exchange is inferred from ticker suffix (`.NS`, `.BO`,
`.L`, …) and is **not** a required standalone input — the `Exchange` field in every form above is
always optional/auto-filled-on-resolve, never a blocking required field on its own.

## 5. Validation is advisory client-side, authoritative server-side

Per api spec-083 §8b: every form in this spec (§3.1, §3.2, §3.3, §3.5) may **disable/warn** on
submit when the type-appropriate identifier looks absent, but the **API's schema + resolver is the
real gate** (422 on the authoritative failure). The UI must handle a 422 from any of these submits
gracefully (surface the field-level error from the response), not assume its own pre-check was
sufficient. This is a testable behavior, not just a note — see §7.

## 6. Non-goals

- No new page/route/tab. Everything above extends existing modals/tabs.
- No change to exposure/overlap analytics rendering — api spec-083 does not change that math, and
  this spec doesn't touch `sortedExposureRows`/`concentration` logic.
- No offline/local identifier validation (suffix-based hinting only) — the resolve call is the only
  source of `resolved/unresolved/ambiguous` truth; the web layer does not reimplement exchange
  inference rules client-side beyond using them for the *hint* copy.
- Zod response-schema changes needed for the resolve endpoint and the new `Instrument`/constituent
  fields are in-scope as plumbing but are not separately re-litigated here — follow the existing
  `src/types/investing.ts` `z.infer` pattern (architecture contract).

## 7. Test Plan

- **Component/unit (vitest + Testing Library + MSW):**
  - `useIdentifierHint` returns the correct required field per (`instrument_type`, suffix) per api
    spec-083 §6's table (US stock/ticker, India stock/ticker+exchange, India MF/isin, UK ETF/suffix
    or isin).
  - Holdings Edit modal: submitting with the linked instrument's identity fields populates the
    `updateInstrument` PATCH payload; a mocked 422 response renders the field-level error inline
    (not a generic toast) — proves server-side is still authoritative even though the UI pre-checks.
  - Seed Constituents: pasting `AAPL,0.60` no longer sets `company_name` to `AAPL` — the structured
    entry requires (and preserves) a separate company name field.
  - Import preview: renders `resolved`/`unresolved`/`ambiguous` status per row from a mocked
    validation response.
- **Playwright E2E (local, mocked API) or lifestack-e2e (full stack) — pick whichever suite already
  covers the Holdings edit flow; extend rather than duplicate:**
  - Edit a holding, add a ticker, save, reload, confirm it persisted (round-trips through the real
    `Instrument` PATCH).
  - Analytics Advanced panel still works for a pooled instrument with no holding.
- Coverage gate unchanged (web 70% line coverage) — no new files below the threshold.

## 8. Acceptance Criteria

- [ ] Holdings Edit Holding modal has `ticker`/`isin`/`exchange` fields, dynamic per-type hint, and
      patches the linked `Instrument` on save — this is the primary correction path.
- [ ] Analytics Advanced instrument list edit is a modal (not inline cells) with the same fields;
      remains usable for pooled instruments without a holding.
- [ ] Seed Constituents no longer sets `company_name` from the ticker; captures name + identifier
      as separate fields (structured entry, CSV-paste still supported).
- [ ] Create Instrument modal has the same identifier fields + hint.
- [ ] Import preview surfaces per-row `identifier_status`.
- [ ] `useIdentifierHint` (or equivalently named shared helper) is implemented once and reused by
      all four forms — no copy-pasted per-type copy.
- [ ] A 422 from any of the four submit paths renders the server's field-level error, proving the
      client-side hint is advisory only.
- [ ] `npm run build`, `npm run lint`, `npm test -- --run` all green; coverage gate (70%) held.
