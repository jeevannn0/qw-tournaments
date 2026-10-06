# QW Tournaments Mobile UI Overhaul — Design Review

## Findings

1. **MEDIUM — The non-modal drawer fallback does not define the modal accessibility behavior that acceptance requires.**  
   **Where:** “Shared Shell and Progressive Baseline,” the `showModal()` failure row in “Deterministic Failure and Empty-State Matrix,” `js/shared/shell.js` in the change map, and Acceptance Gate 14.  
   The brief says a fixed `<dialog open>` fallback provides the same close routes, while Acceptance Gate 14 also requires focus entry, focus containment, focus return, and body unlock. Setting `open` does not make a dialog modal: it does not make the background inert, contain Tab/Shift+Tab, or emit the native `cancel` event on Escape. The current `shell.js` confirms that the existing fallback only sets `open`, so there is no existing helper that supplies these behaviors. “Clear body scroll lock in `finally`” also does not specify which open/close failure paths own cleanup.  
   **Concrete fix:** Add this normative fallback algorithm:
   ```text
   openDrawer(opener):
     1. Record opener and each shell sibling’s prior inert state.
     2. Try dialog.showModal(). If it is absent or throws, enter fallbackMode.
     3. In fallbackMode set open, role="dialog", aria-modal="true"; set all
        non-dialog shell siblings inert; install document keydown handling for
        Escape and Tab/Shift+Tab wrap; then focus the close button.
     4. Commit body.drawer-open only after an open path succeeds.

   closeDrawer():
     In one try/finally path close/remove open, remove fallback listeners,
     restore every prior inert state, clear body.drawer-open, and return focus
     to the recorded connected opener.
   ```
   Test native mode and missing/throwing `showModal()` separately for forward/backward Tab wrap, Escape, backdrop click, explicit close, link close, repeated open/close, and an opener removed before close.

2. **MEDIUM — The media approval table marks an asset approved without accounting for its material third-party game imagery, and it omits provenance for retained visual assets.**  
   **Where:** “Imagery and Licensing Plan,” the `commons-ffwc-gameplay-2019` row, the `assets/brand/favicon.svg` organization entry, the retained inline SVG icon-map statement, and Acceptance Gates 25–26.  
   The live Commons metadata verifies the proposed gameplay file’s author, 1920×800 dimensions, SHA-1, and CC BY 3.0 declaration. However, its file-page source explicitly includes `{{De minimis|Coyrighted game image}}`: the CC BY grant is for the Sygnustv Media video frame and does not itself license Garena’s underlying screen graphics. The image contains a large central Free Fire gameplay screen/logo, and the proposed center-aware crop from 2.4:1 to 16:9 removes side context and makes that third-party content proportionally more prominent. The brief mentions trademarks but not this copyright basis. Both Commons rows are also labeled “Approved” while required metadata recheck and downloaded SHA-256 are still pending, contrary to the rule that approved rows have no unknown required fields. Finally, the retained favicon and inline icon paths have no ledger/provenance entry in the current repository or proposed table.  
   **Concrete fix:** Change both Commons rows to `pending` until retrieval, metadata recheck, and SHA-256 completion. Keep `commons-ffwc-gameplay-2019` pending for third-party-rights review and ship the detail hero as the specified image-free QW mode plate unless an exact replacement file has a reusable license covering the whole composition or direct permission is recorded. Add ledger rows for `qw-shield-favicon` and the retained icon set with repository source/author, license or owner attestation, allowed placements, and approval status. Only after every required field is known may the manifest and HTML reference an asset.

3. **MEDIUM — The required responsive image derivatives have neither reproducible crop/encoder instructions nor an available authoring path in this workspace.**  
   **Where:** “Performance Plan,” “Imagery and Licensing Plan,” the assets/file change map, and Acceptance Gates 25 and 28.  
   “Center-aware” 4:3/16:9 crops leave many valid compositions, and no source-pixel crop rectangles, encoder, quality settings, metadata policy, or repeatable command/tool is selected. The current machine has Python but no Pillow, ImageMagick, `cwebp`, or FFmpeg. The brief simultaneously requires committed WebP/JPEG outputs and no new dependency/package workflow, so an implementer must invent an unreviewed process or cannot produce the locked files and byte budgets.  
   **Concrete fix:** Lock a dependency-free authoring route, for example a checked-in `tools/generate-media.html` that uses native browser canvas against locally downloaded originals. For each output family, record the exact source-pixel crop rectangle, output dimensions, MIME type, quality value, metadata stripping rule, browser/version used, source SHA-256, and output SHA-256. Outputs are generated once and committed; the page has no runtime dependency on the tool. Alternatively, explicitly approve one pinned portable encoder with its version/checksum as an authoring-only tool. In either case, have `verify-static.py` check dimensions, filenames, hashes, and byte ceilings against the ledger.

4. **MEDIUM — The `srcdoc` integration harness cannot exercise several claimed fixtures without a specified rewrite/injection protocol.**  
   **Where:** “Testability and Verification,” the missing-media/shell fixture paragraph, and Acceptance Gates 5, 7–9, 14–16, 20, 23, and 25.  
   A `<base>` changes relative URL resolution but does not give an `about:srcdoc` document the requested route’s `location.pathname` or `location.search`; production query branches read `window.location.search`. Merely injecting fixture globals “before the page module” is also ambiguous because the production `data/*.js` tags can overwrite them, while a missing-global fixture requires those tags not to define the global at all. Likewise, `js/shared/media.js` owns an imported module-local manifest, so an “injected manifest copy” cannot change it unless a test seam or import substitution is defined. As written, the runner can report green while never entering present-empty/malformed query branches, missing globals, or the intended missing-media path.  
   **Concrete fix:** Specify this order for every generated test document:
   ```text
   1. Remove the production data-script and route-module tags from fetched HTML.
   2. Insert <base> and a prelude before any application script.
   3. In the prelude, history.replaceState({}, "", exactRouteAndQuery), install
      the controlled Date.now/theme/API substitutions, and define only the
      requested fixture globals (define none for a missing-global case).
   4. Reinsert theme initialization, then the route module, in production order.
   5. Assert iframe location.pathname/search before running route assertions.
   ```
   Test image failure by changing a rendered approved `<img>` to a known missing local path and dispatching/waiting for its real `error` path, or define an import-map substitution for a test-only `media.js`; do not claim that a global can replace a module-local constant. Add a harness self-test proving each fixture identity is visible to the route before accepting UI assertions.

5. **MEDIUM — The transactional region helper is referenced as a core failure boundary without an implementable contract.**  
   **Where:** “Shared Shell and Progressive Baseline,” the route-render failure row, `js/shared/render.js` in the change map, and the shell/region verification plan.  
   `mountRegion(name, mount, render, fallback)` does not say whether `render`/`fallback` return HTML, `Node`, `DocumentFragment`, or mutate the mount; it gives no result shape despite callers needing health information; and “restore the supplied safe fallback on a post-commit failure” has no bounded meaning for later asynchronous listener errors. The tests force a shell commit failure but do not force route render, enhancement, and commit failures. Different implementations can therefore discard the static fallback, double-render it, or still let one region abort the route.  
   **Concrete fix:** Define one synchronous contract, for example:
   ```text
   RegionResult =
     | { ok: true }
     | { ok: false, phase: "render" | "enhance" | "commit" }

   mountRegion(
     name: closed internal enum,
     mount: Element,
     render: () => DocumentFragment,
     fallback: () => DocumentFragment,
     enhance?: (detached: DocumentFragment) => void
   ): RegionResult
   ```
   Require `render` and `enhance` to operate only on the detached fragment; commit exactly once with `replaceChildren`; preserve the existing static children if any pre-commit phase fails; use the safe fallback only when a later user-triggered update cannot retain valid prior content; and catch/log only inside this call. Later event-handler updates must invoke `mountRegion` again. Add independent render-, enhance-, and commit-throw fixtures and assert that sibling regions still render.

6. **MEDIUM — Static no-script/shell fallbacks duplicate authoritative configuration, but only the demo flag has a synchronization gate.**  
   **Where:** “Assumptions and Audit Basis,” “Shared Shell and Progressive Baseline,” “Configuration contract,” failure-matrix config rows, `tools/verify-static.py`, and the Must-Preserve Contracts.  
   The design requires all six checked-in baselines to contain the configured WhatsApp contact, brand/footer details, support hours, and timezone label, while declaring `data/config.js` authoritative. It explicitly checks only `data-demo`. A later supported config edit can therefore leave no-JavaScript and shell-failure visitors with a stale number or conflicting support information; in the worst case, a stale action sends information to the wrong WhatsApp destination. The current files already demonstrate why this matters: the number is duplicated in HTML and config.  
   **Concrete fix:** Define the exact static mirror set—at least `brandName`, `whatsappNumber`, `whatsappDisplay`, `supportHours`, `timezoneLabel`, and `demoMode`—and make `verify-static.py` parse `data/config.js` and compare every header/footer/no-script occurrence on all six pages. Fail closed on any mismatch, document the atomic update procedure in README, and keep configuration-error registration actions as non-links so only the verified static support contact remains.

7. **MEDIUM — “Total confirmed units” conflicts with the roster’s allowed withdrawn/disqualified states.**  
   **Where:** “Roster,” “Roster schema,” published-empty/no-match rows, and Acceptance Gate 23.  
   The schema admits `Confirmed`, `Checked in`, `Withdrawn`, and `Disqualified`, but metadata is specified as “total confirmed units.” Counting `entries.length` (the current implementation) mislabels withdrawn/disqualified entries as confirmed; counting only active statuses can produce zero confirmed units while the roster is not structurally empty. The brief does not choose whether inactive records remain visible or how search/count copy behaves.  
   **Concrete fix:** Keep all valid published records visible for auditability, define `activeConfirmedCount = entries.filter(status is "Confirmed" or "Checked in").length`, and label metadata “{activeConfirmedCount} active confirmations · {entries.length} roster records.” Reserve “published — no entries” for `entries.length === 0`; if records exist but none are active, render them with their status and announce “No active confirmations.” Add mixed-status squad and solo fixtures and assert counts before and after search (the metadata total must not change with filtering).

8. **NIT — Roster timestamp validation is weaker and environment-dependent compared with the exact tournament timestamp rule.**  
   **Where:** “Roster schema.”  
   `updatedAt` is described both as an “ISO timestamp” and merely “parseable.” `Date.parse()` also accepts timezone-less and date-only strings whose interpretation can differ from the intended IST contract.  
   **Concrete fix:** Reuse the tournament timestamp syntax—`YYYY-MM-DDTHH:mm:ss`, optional fractional seconds, then `Z` or `±HH:mm`—for non-null `updatedAt`, and test rejection of date-only, timezone-less, impossible, and trailing-junk values.

9. **NIT — The configuration section calls all listed fields launch-critical but later treats only a subset as registration-critical.**  
   **Where:** “Configuration contract” and its following health paragraph.  
   `brandName`, `gameName`, `whatsappDisplay`, `timezoneLabel`, `rosterLeadHours`, `supportHours`, and `organizerName` appear in the “required launch-critical” list, but the next paragraph says noncritical display strings use static fallbacks and names only WhatsApp digits, ages, timezone, demo flag, and prefix as reasons to set `registrationSafe = false`. `supportHours` and `organizerName` also have a maximum but no explicit nonempty minimum.  
   **Concrete fix:** Replace the prose with a field table containing `required`, normalization/limits, fallback, and health effect. Name the exact registration-critical set, name the display-only set, require 1–80 normalized characters for `supportHours`/`organizerName` if they remain required, and state whether invalid `rosterLeadHours` disables roster timing copy or registration.

## Verified Assumptions

- The project has exactly the six public root entry points named in the brief: Home, tournament board, tournament detail, registration, roster, and rules. Every current page loads `css/styles.css` before `css/gaming.css`, and those public paths can remain unchanged during reorganization.
- The brief names a concrete aesthetic rather than “clean/modern”: **QW Dropboard**, anchored to a MotoGP pit-lane timing board/mobile event credential. It includes scene/reference sentences, a two-altitude reflex check, named composition/type/color/motion/voice systems, a 4 px spacing scale, and explicit rejection of the relevant artifactory-design failure patterns (gradient text, decorative gradients, glass panels, side stripes, nested/shadowed cards, generic card grids, repeated eyebrows, hover lift, scroll reveals, continuous effects, and decorative icon tiles).
- Both light and dark themes have complete sRGB and OKLCH core/surface/semantic palettes. Independent clipped-sRGB calculations reproduce the stated OKLCH minimum ratios: light ink 14.73:1, mute 5.43:1, accent 4.99:1, control boundary 4.20:1; dark ink 13.88:1, mute 6.22:1, accent 8.00:1, and control boundary 4.56:1. The semantic pairs and accent-button pairs are also plausible at the stated thresholds.
- The brief covers all six pages and their shared shell/footer/demo row, four explicitly bounded mobile rails, event cards, alerts, empty/error/data-unavailable states, both themes, toasts, the three-step wizard, review/result recovery, roster variants, rules disclosures, and open/closing/full/manual-closed/not-started/deadline-closed/completed/unavailable/demo event states.
- The mobile specification starts at 320 px, defines 40/58/72 rem structural breakpoints and a short-landscape query, prohibits page overflow, requires 44×44 px targets, uses `viewport-fit=cover` and all safe-area edges, orders `vh`/`svh`/`dvh` fallbacks, covers portrait/landscape, and keeps form actions scrollable above a soft keyboard. Real-device-only limitations are correctly assigned to manual verification rather than claimed by static checks.
- The performance section has numeric CSS, image, font, CLS, LCP, blocking-time, and long-task budgets; a repeatable Lighthouse protocol; local responsive-media behavior; a no-runtime-network rule; and explicit dead-CSS/dead-JavaScript removal intent. Current source confirms extensive motion/effect hooks and structural overrides that justify the rewrite rather than another override layer.
- `data/config.js` confirms demo mode, `919449449382` / `+91 94494 49382`, IST, age limits, support hours, and the current reference prefix. The three current tournament objects use `formatLabel`, have ordered offset-bearing timestamps, valid capacities, and prize breakdowns that sum to their prize pools.
- The sample roster has exactly two four-player squads and deliberately nonnumeric `Demo UID 01`–`Demo UID 08` values. The brief’s narrow `demoMode && isSample` display exception preserves those records without weakening registration UID validation.
- The current registration module prepares participant names, numeric UIDs, private ages, event/fee/schedule, three confirmations, a non-confirming reference, demo do-not-pay language, and the target WhatsApp URL. The brief explicitly preserves this handoff, popup/clipboard recovery, and the rule that no message/reference/screenshot confirms a slot.
- Current rendering escapes inserted data in the principal card/detail/registration/roster paths, and only `qw-theme` currently uses local storage. The brief strengthens this into explicit validation/projection/encoding and prohibits participant data in storage, URLs, logs, analytics, or public rosters.
- All eight current Garena JPEGs are local 480×270 files of approximately 26–42 KB. The current ledger supplies an exact Garena CDN source for each but no verified reuse grant for a paid community event; the brief correctly removes them from runtime until permission is documented.
- Wikimedia Commons API metadata verifies the proposed Rio event photo as Rjcastillo’s 4882×4079 own work under CC BY 4.0 with the stated SHA-1. It also verifies the gameplay frame’s stated dimensions, SHA-1, author, and CC BY 3.0 metadata, subject to Finding 2’s separate underlying-content issue.
- The Must-Preserve and Out-of-Scope sections explicitly retain demo mode, WhatsApp, privacy, escaping, relative links, unchanged public URLs, and the two-file CSS order/split, while forbidding new runtime dependencies, frameworks, package/build tooling, backend/database/payment automation, analytics, advertising, tracking, service workers, and new product scope.

## Unverified/Wrong Assumptions

- **Wrong/incomplete (Finding 1):** `<dialog open>` plus fixed positioning does not itself provide modal focus containment, background inertness, or native Escape cancellation. The current helper supplies none of those fallback behaviors.
- **Wrong/incomplete (Finding 2):** The proposed gameplay frame is not supported solely by an unqualified CC BY grant for every visible element. Its Commons source explicitly relies on a separate de-minimis assertion for copyrighted game imagery, and the planned crop can change that factual basis.
- **Wrong (Finding 2):** A ledger row cannot satisfy the brief’s own `approved` definition while metadata recheck and downloaded SHA-256 remain unfinished. Those rows are pending until retrieval verification completes.
- **Unverified (Finding 2):** No source/license/owner attestation was found for the retained `assets/favicon.svg` or inline SVG icon paths. `assets/battle-arena.svg` is also not independently proven project-owned, but the brief correctly keeps it pending and out of runtime.
- **Unverified/blocked (Finding 3):** No local WebP-capable authoring tool is currently available: Pillow, ImageMagick, `cwebp`, and FFmpeg are absent. The required crop and compression outputs therefore need the explicit dependency-free or pinned authoring route described in the fix.
- **Unverified (Finding 4):** The proposed `srcdoc` runner has no defined way to set the route URL/query, suppress or replace production data scripts, or substitute a module-local media manifest. Its claimed query/missing-global/missing-media coverage cannot yet be trusted.
- **Unverified (Finding 5):** `js/shared/render.js`, its result type, and render/commit failure tests do not exist; the current routes directly mutate mounts and share uncaught initialization chains.
- **Ambiguous (Finding 6):** The brief guarantees configuration synchronization only for `data-demo`, not for the other values duplicated into six static baselines.
- **Ambiguous (Finding 7):** A roster containing withdrawn/disqualified records has no single specified “confirmed units” count or empty-state behavior.
- **Not yet present:** The local WOFF2/OFL files, approved media derivatives/ledger, `media.js`, `render.js`, unit/layout harnesses, verification document, and static verifier remain implementation deliverables; none can be treated as an existing helper or proven gate yet.
