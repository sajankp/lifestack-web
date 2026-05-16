# Feature Spec: Frontend Component Foundation
**Status:** Proposed
**Spec ID:** 002

## 1. Overview
Lifestack Web is moving beyond a small set of hand-built views into a broader product surface with richer forms, date inputs, interactive filters, and dashboard visualizations. This spec defines the frontend component foundation for that next stage so new UI work does not drift into a mix of native browser controls, ad hoc custom widgets, and inconsistent patterns.

The primary decision in this spec is to adopt `shadcn/ui` as the default component foundation for interactive UI primitives while continuing to own styling inside the repo.

## 2. Goals
- Standardize interactive UI primitives across the app.
- Replace native-looking controls that feel visually out of place in the current dark, premium UI.
- Improve accessibility, keyboard support, and focus behavior for form controls and overlays.
- Establish a consistent path for future form-heavy modules and dashboard/chart work.
- Keep visual ownership in the repo instead of adopting a heavy opinionated design system.

## 3. Scope
- Component primitives for select, popover, dialog, tabs, dropdown menus, and date picker patterns.
- Form composition guidance for validation, error presentation, and controlled inputs.
- Charting direction for future dashboard and analytics slices.
- Migration guidance for existing pages that currently rely on native form controls or hand-built widgets.

### Out of Scope
- Full implementation of every component in this spec.
- A complete design token system redesign.
- Rewriting all current pages in one pass.
- Backend API contract changes.

## 4. Architectural Decision

### 4.1 Primary UI Layer
- Adopt `shadcn/ui` as the default UI component foundation.
- `shadcn/ui` components should live in-repo and remain fully styleable to match Lifestack's visual language.
- Components added through this system must prefer composition over one-off page-specific widget logic.

### 4.2 Why `shadcn/ui`
- It fits the existing Tailwind-based stack.
- It supports a premium custom look without forcing a generic design system aesthetic.
- It provides a strong path for polished controls such as select, popover, calendar, dialog, and command surfaces.
- It reduces accessibility and interaction bugs compared with building every control from scratch.

### 4.3 Supporting Libraries
`shadcn/ui` does not replace all supporting libraries. The expected foundation is:
- UI primitives: `shadcn/ui`
- Form state: `react-hook-form`
- Validation and schema inference: `zod`
- Charts: `recharts`

These choices align with the current architecture direction in the backend docs, which already recommends Recharts for frontend charting.

### 4.4 Architecture Alignment
- This spec is additive to the platform architecture and does not replace the existing frontend stack guidance in `lifestack-api/docs/ARCHITECTURE.md`.
- State ownership remains unchanged:
  - server state stays in TanStack Query
  - auth/session and truly client-side UI state stay in Zustand or local component state
- Frontend structure should continue mirroring backend module boundaries as documented in the platform architecture.
- This spec provides the explicit component-system decision that was intentionally left open in the FastTodo reference audit.

## 5. Requirements

### 5.1 Component Rules
- New interactive controls must prefer `shadcn/ui` primitives over native browser styling where the native control clashes with the app's visual language.
- Shared controls must be reusable and live under `src/components/`.
- Overlays and menus must support keyboard interaction, focus visibility, and escape-to-close behavior.
- Controls must render cleanly on desktop and mobile breakpoints.

### 5.2 Form Rules
- New non-trivial forms should be built with `react-hook-form`.
- Validation rules should be represented in `zod` schemas where practical.
- Error messages must be shown inline near the relevant field.
- Disabled, loading, and invalid states must follow a consistent visual treatment.

### 5.3 Date Input Rules
- Date inputs that are central to a workflow should not rely solely on raw native `<input type="date">` behavior.
- Prefer a composed date picker pattern using `shadcn/ui` popover/calendar components so the experience matches the app's styling.
- If a native date input is temporarily retained, it should be treated as an interim implementation, not the target interaction model.

### 5.4 Chart Rules
- New dashboard and analytics charts should use `recharts`.
- Chart containers, legends, labels, and empty states should be styled consistently with the rest of the app.
- Charts must degrade gracefully when data is empty, partial, or loading.

## 6. Migration Plan

### Phase 1
- Introduce the `shadcn/ui` component base and required dependencies.
- Establish shared patterns for button, input, select, popover, dialog, and calendar usage.

### Phase 2
- Migrate spending modals and filters to the shared form primitives.
- Replace native-feeling date inputs in key workflows with styled date picker patterns.

### Phase 3
- Apply the same foundation to future dashboard controls, analytics filters, and additional module forms.
- Introduce chart primitives and shared chart wrappers for loading and empty states.

## 7. Acceptance Criteria
- A documented frontend component foundation exists and names the default UI stack.
- The chosen stack explicitly covers UI primitives, form state, validation, and charts.
- The spec aligns with the platform architecture's existing frontend stack guidance rather than contradicting it.
- Future specs can reference this document instead of re-deciding the UI stack.
- Native controls that visibly clash with the product UI are treated as migration targets.
- New major frontend slices are expected to follow this spec unless a later spec overrides it.

## 8. Implementation Notes
- Existing custom components do not need to be removed immediately if they already provide acceptable UX.
- The goal is not "use a library for everything"; the goal is consistent, accessible, polished primitives where it matters.
- Small presentational components can remain hand-authored.
- If a `shadcn/ui` component introduces unnecessary complexity for a tiny use case, a simpler local wrapper is acceptable as long as it follows this spec's interaction and styling rules.

## 9. Follow-Up Work
- Add the initial `shadcn/ui` setup to `lifestack-web`.
- Define the first shared control set: button, input, select, dialog, popover, calendar/date picker.
- Migrate the spending workflow to the new date picker and shared field primitives.
- Update existing frontend specs to reference this component foundation where relevant.
- Add a frontend architecture note or README section once the initial migration lands.
