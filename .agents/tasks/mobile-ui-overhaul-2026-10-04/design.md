# QW Tournaments Mobile UI Overhaul — Design Brief

## Overview

QW Tournaments will remain a dependency-free, multi-page static website built with semantic HTML, two ordered CSS files, and browser-native JavaScript modules. The redesign will replace the current accumulated desktop-first overrides with one coherent mobile-first system while preserving all six public page URLs, query-string routes, tournament data, roster behavior, theme behavior, demo safeguards, and private WhatsApp registration handoff. The visual direction is **QW Night-Stage Control**: a disciplined, high-contrast competition interface informed by a real rally time-control board rather than a generic neon game dashboard. Structural rules will live in `css/styles.css`; the QW combat treatment will continue to load second from `css/gaming.css` and will not duplicate structural breakpoints.

The audit covered all six HTML documents, both complete stylesheets, every page and shared script, the theme bootstrap, all three data files, both documentation files, and every current asset. There is no `.agents/tasks/mobile-ui-overhaul-2026-10-04/design-review.json`, so this is the initial design rather than a review revision.

## Design brief

**Scene sentence.** A player in India checks QW one-handed on a 320–390 px phone in dim evening light minutes before check-in, intent on confirming the match time, fee, open slots, and next action without hunting, while an organizer may scan the same roster on a daylight laptop; this requires a dark default, an equally legible light theme, compact factual density, and large controls.

**Reference sentence.** The interface quotes a **night-stage rally time-control board**: matte blue-black panels, sodium-amber marshal signals, chalk-white timing figures, hairline cell divisions, and one clipped identification tab—not a science-fiction HUD.

The named aesthetic is **QW Night-Stage Control**. Its physical voice is mechanical, urgent, and disciplined. QW remains recognizable through its amber signal color, condensed Teko display type, Rajdhani interface type, angular shield mark, direct tournament language, and the original battle-arena artwork. Distinction comes from timing-board composition, strong rules, tabular match facts, and selective asymmetry rather than gradients, glowing glass, repeated clipped cards, or constant animation.

The two-altitude reflex check rejects both predictable routes. First-order “gaming site” choices such as black plus cyan/magenta neon, holographic glass, and military-HUD clutter are excluded. Second-order “anti-gaming” choices such as stark brutalism, oversized Helvetica, or a monochrome editorial layout are also excluded. The rally control-board reference instead supports the actual task—quickly reading event state and timing—while retaining QW’s warm amber identity.

### Slop-check decisions

The implementation must remove or avoid the following current patterns:

- No gradient-filled text, rainbow gradients, glass panels, pastel blobs, or decorative glow fields.
- No side-stripe alerts. Existing 2–3 px left-border callouts become a full hairline frame, a tinted surface, and a leading status word or symbol.
- No resting shadows on event cards, form groups, prize items, or buttons. Shadows are reserved for the modal drawer and toast because those are true overlays.
- No lifting hover effects. Buttons, cards, and match choices change border, ink, or fill in 80–120 ms without `translateY`.
- No scroll-triggered fade-in system, cursor spotlights, pointer parallax, scan-line animation, glitch animation, pulsing badges, or breathing hero art. Content is visible at first paint.
- No tiny tracked label above every heading. A route may have one context label; numbers appear only for genuinely ordered material such as wizard phases, schedule checkpoints, and process steps.
- No icon tile for every fact. Icons remain only where they clarify an action, status, privacy warning, menu, theme, or WhatsApp handoff.
- No arbitrary notch on every component. The QW wordmark and one major media frame may use the clipped corner; ordinary event cards and controls use square or 4 px corners.
- No decorative image gallery whose removal loses no information. Event imagery identifies actual tournament formats and links to those events.
- No combat metaphor where plain language is safer. “Drop. Fight. Win.” can remain the brand line, but actions use “View tournaments,” “Register,” “View roster,” and “Open WhatsApp.” Financial, eligibility, privacy, and confirmation copy stays literal.

## Locked technology and architecture

The technology stack is HTML5, modern CSS, and vanilla ECMAScript modules. Layout uses Grid, Flexbox, intrinsic sizing, `clamp()`, logical properties, and a small number of content-driven media queries. Components use native links, buttons, inputs, selects, radio controls, checkboxes, `dialog`, `details`, `table`, `meter`, and live regions. Data remains in `window.QW_CONFIG`, `window.QW_TOURNAMENTS`, and `window.QW_ROSTERS`, adapted through `js/shared/data.js`. There will be no framework, package manager, compilation, generated bundle, backend, service worker, tracker, analytics tag, third-party widget, or runtime CDN dependency.

Teko and Rajdhani will be retained but served as local WOFF2 files obtained from their authoritative Google Fonts repositories under the SIL Open Font License 1.1. The current Google Fonts preconnect and stylesheet requests will be removed from every page. This preserves the identity while eliminating a render-blocking third-party dependency and a privacy/network failure point.

The existing page boundaries remain authoritative:

- `index.html`: brand hero, current facts, featured event, upcoming events, and joining protocol.
- `tournaments.html`: discovery, search, format filtering, sorting, and complete event states.
- `tournament.html?tournament=<id>`: one event’s details.
- `register.html?tournament=<id>`: three-phase local registration builder and WhatsApp handoff.
- `players.html?tournament=<id>`: public confirmed roster.
- `rules.html`: long-form rules and disclosures.

All links stay relative so root hosting and project-subpath hosting continue to work. Asset paths may be reorganized, but public page names and query parameters do not change.

## Color system

The strategy is **committed**: paper and ink own most of the interface, while amber owns the primary actions, selected states, focus, and a few structural rules. It is not a full multicolor game palette. Secondary surfaces and borders are tonal mixes of the four slots, not new hues.

| Theme | Paper | Ink | Accent | Mute |
|---|---|---|---|---|
| Light — daylight timing sheet | `oklch(0.960 0.008 235)` | `oklch(0.180 0.025 250)` | `oklch(0.520 0.170 52)` | `oklch(0.480 0.030 245)` |
| Dark — night-stage control | `oklch(0.140 0.018 250)` | `oklch(0.940 0.015 85)` | `oklch(0.760 0.150 67)` | `oklch(0.660 0.025 245)` |

The proposed pairs were numerically checked before approval. Approximate contrast against paper is 16.75:1 for light ink, 5.8:1 for light mute, 5.2:1 for light accent, 16.69:1 for dark ink, 6.42:1 for dark mute, and 8.99:1 for dark accent. Light-theme accent buttons use light paper text; dark-theme accent buttons use dark paper text. This yields approximately 5.2:1 and 8.99:1 respectively. Implementation must re-run contrast checks after browser gamut conversion and after deriving hover/fill tones.

`--surface-1`, `--surface-2`, `--line`, `--field`, and hover tones are produced with `color-mix(in oklch, ...)` from paper, ink, accent, and mute. The existing semantic names such as `--background`, `--foreground`, and `--primary` may alias these four slots to limit churn, but the palette has one source of truth in `gaming.css`.

Success, warning, error, and information colors sit outside the four brand slots because they are signals. They use restrained green, ochre, oxblood, and blue respectively, with separate light/dark values. Every signal includes a word and, where useful, a symbol; no status depends on color alone. The focus ring uses accent at 3 px with at least a 3:1 boundary against adjacent surfaces and remains visible in forced-colors mode.

Dark remains the first-visit default to suit the scene. `js/theme-init.js` applies a valid saved `light` or `dark` value before CSS paints; unsupported, blocked, or malformed storage falls back to dark. Theme persistence stores only `qw-theme`, never player or form information.

## Type, content density, and voice

Teko is the display face and Rajdhani is the body/interface face. The local font set is limited to Teko 600 and 700 plus Rajdhani 500 and 700. A metric-compatible fallback stack follows each face, and `font-display: swap` prevents invisible text. UI identifiers and UIDs use the existing system monospace stack only where aligned characters aid scanning.

The type scale is role-based rather than element-based:

- Metadata: `clamp(0.8125rem, 0.79rem + 0.1vw, 0.875rem)`; never below 13 px.
- Body/control text: `clamp(1rem, 0.96rem + 0.18vw, 1.125rem)`.
- Compact subhead: `clamp(1.25rem, 1.16rem + 0.35vw, 1.5rem)`.
- Component title: `clamp(1.625rem, 1.42rem + 0.75vw, 2.125rem)`.
- Section title: `clamp(2.125rem, 1.75rem + 1.5vw, 3rem)`.
- Route title: `clamp(3rem, 2.2rem + 3vw, 4.5rem)`.
- Home display: `clamp(3.75rem, 2.7rem + 4vw, 6rem)`.

Rajdhani body copy uses at least 1.5 line height in light mode and 1.55 in dark mode. Paragraphs cap at 65 characters. Teko headings use 0.9–1.0 line height, tracking no tighter than `-0.02em`, and balanced wrapping. Uppercase is reserved for short labels and status marks; paragraphs and long control labels use normal case. Numeric match facts use tabular figures. Inputs remain at 16 px or larger to avoid automatic mobile zoom.

The voice is a tournament operator with controlled gaming energy. It tells the player what is true now, what action occurs next, and what does not constitute confirmation. Existing fees, prizes, dates, policies, organizer details, demo warnings, and privacy statements are not rewritten into vague promotional copy.

## Layout system

A 4 px spacing scale is the only source of gaps and padding: 4, 8, 12, 16, 24, 32, 48, 64, and 96 px, exposed as CSS custom properties. Tight label/value groups use 4–8 px, component groups use 12–24 px, and page regions use 48–96 px. Page gutters use `clamp(0.75rem, 4vw, 2rem)`. The full canvas always occupies the viewport; prose and data columns cap independently.

The primary region strategies are:

- **Home hero:** `broadsheet`, with dominant copy and one major original QW image.
- **Event discovery:** `index-card` on desktop and a factual `feed` on narrow screens.
- **Tournament detail:** `broadsheet` hero followed by `dispatch` sections.
- **Registration:** `dispatch` at wide widths and one-column `feed` on mobile.
- **Roster:** compact `index-card` for squads and semantic table-to-record transformation for solo entries.
- **Rules:** `dispatch` with a restrained contents margin at wide widths and a `letter` reading flow on mobile.

Hairline rules and flat surface shifts mark section boundaries. A full-bleed dark band is reserved for the hero and final action region; ordinary sections do not each receive a card, gradient, shadow, and decorative label.

### Shared header, navigation, and drawer

`js/shared/shell.js` remains the owner of the shared header, drawer, footer, theme control, and toast. The whole header stack is sticky: the demo warning, when enabled, sits above a compact navigation row. CSS owns `--header-stack-height`, with a production and demo value, so skip links, hash targets, local navigation, and focused fields are never hidden beneath it.

At 320 px, the row retains the 44 px QW mark, a short readable “QW Tournaments” text lockup when space allows, a “Join” link, and a 44 px menu button. The theme toggle moves into the mobile drawer instead of disappearing, preserving functionality without crowding the row. At desktop widths, the primary navigation and full “Join tournament” action return inline. The active route uses ink plus an amber bottom rule and `aria-current="page"`.

The drawer remains a native modal `dialog`. Its panel is at most 24 rem wide, fills `100dvh`, observes all four safe-area insets, scrolls internally in short landscape viewports, opens with focus on its close control, closes with Escape/backdrop/close/link activation, and returns focus to the opener. The fallback for browsers without `showModal()` uses the existing `open` attribute path plus explicit focus containment and background inerting. Drawer motion is a single 180–220 ms transform and is removed under reduced motion.

### Footer

The footer is a flat ink band with QW identity, navigation, visible organizer contact, support hours, timezone, independence statement, and an image-credit link where required. It does not use a giant translucent QW background mark. Mobile order is identity, primary links, support, then legal text. Links and number remain at least 44 px high even when visually compact, and bottom padding includes `env(safe-area-inset-bottom)`.

### Home hero and current facts

The home hero keeps “Drop. Fight. Win.” and the original QW battle-arena artwork. At wide widths it is an asymmetric copy/media split; at narrow widths, copy appears first on a solid surface and the 4:3 image follows rather than placing essential text over a busy crop. The primary action is “View tournaments”; the secondary action is “Register.” Mobile-only, India server, and WhatsApp confirmation remain visible as short proof lines.

The hero uses `min-block-size: calc(100svh - var(--header-stack-height))` but never a fixed height or maximum that can clip enlarged text. In short landscape viewports it switches to natural height. The image carries explicit intrinsic dimensions/aspect ratio, is the only home image with `fetchpriority="high"`, and has a functional alt description. Static amber rules and timing-board coordinates replace the current glitch, scan, parallax, and breathing effects.

Open lobbies, combat modes, and demo prize total form a hairline divider strip, not three shadowed cards. Demo prize language continues to say it must be replaced before launch. The confirmation chain is plain text and remains available on mobile rather than being silently removed.

The featured event remains one responsive component on every viewport; it is not loaded and then hidden on phones. On desktop it has an asymmetric event brief and image. On mobile it becomes the first full-width event record with status, date, prize, fee, capacity, and action all visible. The following event preview excludes the featured event to avoid duplicate content and duplicate image downloads.

The existing decorative five-wallpaper “Battle in style” gallery is removed. If a discovery rail is retained, it contains only actual events or the three real formats and each item leads somewhere useful. It has a visible scrollbar and next-item edge peek.

### Event cards and tournament board

An event is a legitimately independent unit, so a card is appropriate; the treatment is a flat timing-sheet cell with a hairline border rather than a floating panel. Every card contains one 16:9 image, textual state, event name, format/server, start time, prize, entry fee, capacity, occupancy meter, and one primary action. A secondary details link is retained only when the primary action registers; closed states use details as the single action.

Cards use semantic `<article>`, `<time>`, `<dl>`, and a labelled native `<meter>` (or an equivalent progress element with complete `aria-valuemin`, `aria-valuemax`, and `aria-valuenow`). The entire art may link to details, but action links do not nest. Hover changes border and image saturation only. At 320–699 px the tournament catalog is a vertical feed; horizontal swiping is not required to compare the complete board. The home preview may be a horizontal snap rail because it is short and supplemental.

Event-state priority is centralized in `getEventState()` and is consistent on cards, detail, and registration:

1. Invalid safety-critical event data produces “Event unavailable” and can never register.
2. A reached match time produces “Completed.” It links to “View event”; it says “View results” only if result data actually exists.
3. `registrationOpen: false` produces “Registration closed.”
4. Zero remaining slots produces “Slots full.”
5. A future valid `registrationOpensAt` produces “Registration opens soon.”
6. A reached registration deadline produces “Registration closed.”
7. A deadline within 24 hours produces “Closing soon” and remains registerable.
8. Otherwise the event is “Registration open.”

Open, closing, closed, full, scheduled, unavailable, and completed each have a distinct word/symbol treatment. Closed and full are not rendered as dead buttons when details remain available. Registration is rechecked when the player enters the form, advances, and submits so a time transition cannot generate an invalid handoff.

The tournament page keeps search, format radio controls, sort, count, and clear behavior. Search remains visible on mobile. Desktop controls use a sticky 19–20 rem margin; mobile controls use normal flow with search first and a native `details` disclosure labelled “Filters” for format and sort. The disclosure summary is 44 px high, reports active-filter count, and does not hide the result count. Radio segments are at least 44 px high and wrap instead of overflowing. The empty result state explains why no events match and provides “Clear filters.”

### Tournament detail

The event detail hero uses a 16:9 media frame rather than forcing landscape wallpaper into a 4:5 crop. Title, status, description, register/details action, and roster action remain adjacent to it at wide widths and precede it on mobile. The five key facts become a ruled data band: date/time spans the full mobile row, then fee, prize, format, and capacity occupy readable two-column cells.

The local section navigation is a deliberately scrollable horizontal rail directly below the sticky header. It exposes a visible thin scrollbar or scroll affordance, preserves 44 px targets, and uses `scroll-margin-top` based on the combined sticky height. It never overlaps the primary header.

The overview is a `dispatch` composition: current state and capacity are dominant; mode, unit size, and roster publication are simple divided facts rather than icon cards. Prize amounts are a ranked list/podium with hairline dividers, no shadows, and natural height on mobile. Schedule remains an ordered list of registration close, check-in, and match time. Rules remain concise highlights plus a link to the complete rules. The unknown ID state is a complete in-page 404 with a match-board link; an empty configured tournament list is a separate “No events configured” state.

### Roster and privacy

Tournament select and roster search remain above the roster. On mobile they stack in normal flow; neither is fixed while the keyboard is open. The selected event, update time, sample marker, and confirmed count form one ruled status row.

Squad records use a flat roster-sheet grid on wide screens and a vertical feed on phones. Each record shows slot, registration reference, team, textual confirmation, four players, captain label, and UIDs. Solo entries retain a semantic table at wide widths and become labelled record rows below 700 px without duplicating content. Long display names truncate only where the complete value remains available through wrapping or an accessible title; UIDs use `overflow-wrap: anywhere` rather than widening the page.

The state model distinguishes:

- no tournaments configured;
- roster not published;
- published roster with no entries;
- valid roster with no search match;
- sample roster;
- roster data unavailable because every record failed validation;
- normal published roster.

Only display name, UID, team, slot, registration reference, and confirmation status are selected by the renderer. Extra properties in `data/players.js` are ignored, ensuring age, phone, payment, and room fields cannot appear accidentally. The privacy section stays factual and uses two divided lists, not nested cards.

### Rules and disclosures

Rules use a maximum 65-character reading measure. The desktop table of contents is sticky below the shared header; on phones it becomes an intentional horizontal rail with a visible scroll affordance, followed by 44 px Expand all and Collapse all controls. Native `details`/`summary` remains the disclosure primitive.

A hash navigation such as `rules.html#payments` opens the containing disclosure before scrolling, moves focus only when initiated by a user action, and updates `aria-current` in the contents navigation. Expand/collapse feedback uses the shared status toast. The scoring data remains a semantic table. Payment and privacy warnings use a complete hairline frame and a written warning, not a colored side stripe. The CSS scroll progress rule may remain because it communicates reading position, but it disappears under reduced motion and forced-colors conditions if it cannot retain meaning.

### Registration form and wizard

The registration experience remains a three-phase form in one document so Back preserves entered values. At wide widths, phase context sits in a margin; on mobile a compact three-item ordered stepper appears above the form with number, short name, complete state, and `aria-current="step"`. The visual progress element exposes `role="progressbar"`, minimum 1, maximum 3, and current phase. Progress never relies on width or amber color alone.

Phase 1 presents open matches. At desktop it is an intrinsic grid; at 320–699 px it is a horizontal snap rail because a visual choice benefits from comparison. Cards are approximately 82–86% of the available width to reveal the next choice, and the scrollbar remains visible. Closed, full, completed, scheduled, and unavailable matches remain visible for context but disabled with a textual reason. Deep-linked valid open events are selected and centered without animated scrolling when reduced motion is requested.

Phase 2 is one column on mobile. Squad name precedes four numbered player groups. Each group uses a real `fieldset`/`legend`; player name, UID, and age have persistent labels and format help. UID stays `type="text"` with `inputmode="numeric"` so leading zeroes are not lost. Input font size is at least 16 px. Age does not occupy an unusably narrow 4.75 rem track. Required fields say “Required” in accessible text rather than relying on an asterisk.

Phase 3 shows event, lineup, captain, UIDs, ages, fee, fee unit, and all three existing confirmations. It continues to state that no upload occurs on the website, payment proof is attached privately, a screenshot is not confirmation, and written organizer confirmation is required. Review data is escaped even though it originated in the same form.

Validation is custom and persistent because the form already uses `novalidate`. `validateRegistration()` changes from returning an unlocated string to returning either `null` or `{ code, fieldName, message }`. The page script sets `aria-invalid`, links the field to a specific error with `aria-describedby`, updates a phase error summary with `role="alert"`, scrolls the field into view below the sticky header, and focuses it. Expected user mistakes are not logged.

The WhatsApp submission still generates the reference and message entirely in memory. No form data enters local storage, a URL, console output, analytics, or public roster data. After activation, the result panel always appears with the reference, “not a confirmed slot” language, a normal anchor to reopen WhatsApp, Copy message, and Edit lineup. If `window.open()` is blocked, the persistent result and anchor make the operation recoverable and a status message says “WhatsApp did not open; use Open WhatsApp again.”

Buttons stay in normal document flow while an input is focused; there is no fixed bottom action above the soft keyboard. On phones, actions are full width and primary-first in reading order. Step changes use `scrollIntoView({ block: "start" })` and CSS scroll padding instead of a hard-coded 120 px window offset. `prefers-reduced-motion` selects instant scrolling.

### Controls, alerts, toasts, and result states

All buttons, icon buttons, links presented as controls, inputs, selects, radio labels, checkbox labels, disclosure summaries, rail links, and toast dismiss controls have a minimum 44 by 44 px target. Controls define default, hover, focus-visible, active, disabled, filled/valid, invalid, and read-only states using palette-derived surfaces. Native semantics stay intact.

Form errors and fatal data problems are persistent inline messages. Toasts are reserved for recoverable transient confirmation such as copied text or expanded rules. The toast has `role="status"`, atomic text, a 44 px close control, hover/focus pause, no more than one queued message, and safe-area-aware bottom/right offsets. Error messages do not disappear on a timer. Demo mode is a persistent status bar, not a toast.

Global and route states use the same anatomy: a plain-language heading, one sentence explaining the state, a next action if one exists, and a non-color symbol. There are no skeleton loaders because all operational data is local. Image failure uses a stable aspect-ratio fallback with the event mark and retains the event text; it never collapses layout or shows a broken-image icon.

## Mobile-first responsive specification

The base layout targets 320 px and scales upward. Media queries are introduced only where content no longer fits, expected near 43.75 rem (700 px) and 60 rem (960 px), plus a short-landscape query. `gaming.css` does not add repeated copies of these structural queries.

The root has no artificial `min-width`. `html` and `body` use `max-width: 100%`, `overflow-x: clip`, and `min-height: 100svh`; every grid/flex child that can shrink receives `min-width: 0`. Long names, references, dates, and UIDs wrap safely. The verification invariant is `document.documentElement.scrollWidth <= document.documentElement.clientWidth` at every required viewport, except inside explicitly labelled rails.

Horizontal rails are permitted only for the short home event preview, registration match picker, event local navigation, and mobile rules contents. Each rail has an accessible name, visible scrollbar/position affordance, keyboard-reachable children, edge padding, scroll snapping that does not trap free scrolling, and a partial next item. The catalog, roster, rules body, forms, and footer never require sideways scrolling.

Safe-area handling uses `max(base-padding, env(safe-area-inset-*)))` on the sticky header, drawer, footer, and toast. Full-height overlays use `100dvh`; stable page shells and first-screen calculations use `100svh`. Content pages use natural height and never force `100vh`. A short landscape viewport removes hero minimum height, reduces nonessential media height, keeps the drawer scrollable, and prevents two sticky navigation rows from consuming most of the screen.

Portrait and landscape checks include 320×568, 360×800, 390×844, 430×932, 667×375, 844×390, 768×1024, 1024×768, and 1440×900. The design must also survive 200% browser zoom and browser text enlargement without clipped controls or hidden content.

Soft-keyboard behavior is CSS-first: controls use 16 px text, focused fields have generous scroll margins, wizard actions are not fixed, mobile form columns are single-track, and the document remains naturally scrollable when the visual viewport shrinks. No `dvh` height is applied to the form itself. Search and UID fields retain appropriate `inputmode`, `autocomplete`, and `enterkeyhint` values.

## Input validation and invariants

`js/shared/data.js` owns normalization of all globals before any page renders. It exposes immutable normalized config, events, and rosters; formatters and renderers consume only these normalized values. It also exposes a summarized issue list for one-time logging without form or private data.

| Input | Contract | Failure behavior |
|---|---|---|
| Theme storage | Optional string, exactly `light` or `dark` | Ignore any other value and use dark; browsing remains fully usable. |
| `tournament` query | Optional string, 1–64 characters, `[a-z0-9-]` after URL decoding | Detail shows in-page 404 for unknown/invalid IDs; registration shows no preselection and asks the player to choose. |
| Tournament search | Optional string, maximum 80 normalized characters | Clamp programmatic overlength values, match locally and case-insensitively, never interpret as HTML or a regular expression. |
| Roster search | Optional string, maximum 80 normalized characters | Same handling as tournament search; zero matches is a normal empty state. |
| Format filter | One of `all`, `solo`, `squad`, `tdm` | Unknown values reset to `all`. |
| Sort | One of `date`, `prize`, `fee` | Unknown values reset to `date`. |
| Tournament ID | Required unique string, 1–64 characters, lowercase letters/digits/hyphens | Exclude an invalid event; keep the first duplicate and reject later duplicates. Log one summarized warning. |
| Tournament type | Required `solo` or `squad` | Mark event unavailable/exclude it from registration; do not infer a paid format. |
| Dates | `matchAt`, `checkInAt`, and `registrationClosesAt` required ISO date strings; `registrationOpensAt` optional but valid if present | Invalid safety-critical timing forces registration closed and displays “Schedule unavailable.” |
| Money/capacity | Fees and prizes finite and at least zero; capacity integer at least zero; spots clamped to 0–capacity | Invalid fee or capacity makes registration unavailable; display never emits `NaN`, negative money, or negative slots. |
| Media descriptor | Local relative path; alt required for meaningful media; focus is a bounded keyword/percentage pattern | Invalid media uses the original QW fallback. No arbitrary value enters an inline style. |
| Player/team name | Required, Unicode text normalized to one line, 2–32 characters, control characters removed | Phase remains blocked; focus and error identify the exact field. |
| UID | Required string of 6–12 ASCII digits | Block phase; duplicate UIDs within a lineup are rejected. |
| Age | Required integer from `config.minimumAge` (currently 13) through 80 | Block phase. Entrants below 18 remain covered by the existing required guardian confirmation. |
| Squad size | Solo exactly one participant; squad exactly four; player 1 is captain | Domain validation blocks review/handoff if the invariant fails, regardless of DOM state. |
| Consent | All three required booleans true | Block WhatsApp handoff and focus the first missing confirmation. |
| WhatsApp number | Required 8–15 ASCII digits after configuration normalization | Browsing remains available, but support and registration handoff are disabled with a persistent contact-unavailable message. |
| Roster entry | Known event, valid slot/reference/status, and valid public player fields | Ignore unknown/private properties; skip an invalid record; if none remain, show roster-data-unavailable instead of a false empty roster. |

The data layer owns event identity, event-state precedence, date/money formatting, capacity clamping, URL encoding, and output escaping because every page uses them. `js/shared/registration.js` owns participant-count, team/name, UID, age, uniqueness, consent, reference, and message invariants because those must hold independently of the current DOM. Page scripts own focus, step progression, and human-readable state presentation. `shell.js` owns one theme value, one open drawer, and one toast. CSS owns target size, shrinkability, sticky offsets, and overflow. The roster renderer explicitly selects public fields so privacy is enforced at the final output boundary as well as documented in `data/players.js`.

Every value inserted into an HTML string passes through `escapeHtml()`. IDs in URLs pass through `encodeURIComponent()`. No untrusted string is used as `innerHTML`, a selector, an inline CSS declaration, or a URL protocol. The fixed media map is trusted code; future data-driven paths must pass a relative-path validator. The inclusive-language rule applies to all new code, comments, labels, and documentation.

## Concrete error handling

| Operation/failure | Recoverable? | What the visitor receives | Logging |
|---|---|---|---|
| Config global missing/malformed | Partly | Safe brand/time defaults, demo mode forced on, and contact actions disabled if the number is unavailable | One `console.error` summary; no form values. |
| Some tournament records malformed | Yes | Valid events render; invalid records do not register. A total failure shows “Tournament data unavailable.” | One `console.warn` with field paths and indexes. |
| No tournaments configured | Yes | Purpose-built empty state on home, board, detail, roster, and registration; rules and support remain usable | No log; an empty list is valid. |
| Unknown detail query | Yes | In-page 404 and “Return to match board” | No log; user-controlled URL. |
| Event crosses deadline while wizard is open | Yes | Advancement/submission stops, state changes to closed/full/completed, and the player is asked to choose another event | No log; expected time transition. |
| User input invalid | Yes | Persistent error summary plus field message, `aria-invalid`, focus, and preserved values | No console output. |
| WhatsApp number invalid | Fatal only to handoff | Persistent “Organizer contact unavailable”; handoff/support controls disabled but details remain browsable | One `console.error`, never the prepared message. |
| Popup blocked | Yes | Result/reference still render; normal Open WhatsApp anchor and explanatory status remain | No log; expected browser policy. |
| Clipboard API missing/denied | Yes | “Copy unavailable; use Open WhatsApp” toast; prepared message remains in memory | No log. |
| Theme storage denied | Yes | Theme changes for the current page; persistence is omitted | No log; expected privacy setting. |
| `dialog` API missing | Yes | Accessible fallback panel with focus containment, Escape close, background inerting, and focus return | No log unless fallback initialization itself fails. |
| Image decode/load failure | Yes | Fixed-ratio QW event-mark fallback; surrounding event facts remain complete | No repetitive production log. |
| Optional View Transition/Intersection Observer absent | Yes | No animation; immediate visible content | No log. The redesign removes dependence on both. |
| Unexpected route render exception | Fatal to that route’s dynamic region | Shared shell remains; region shows “This page could not display its data” and support/board action | `console.error` once with stack, never registration values or prepared messages. |

## Imagery and licensing plan

Imagery must identify an event, establish QW identity, or explain a process. It is not filler. All production files are downloaded into the repository; there are no hotlinks, image-search thumbnails, social reposts, scraped fan art, watermarked images, or uncertain-license assets.

The authoritative first candidate is the [official Garena Free Fire wallpaper library](https://ff.garena.com/en/wallpaper/), with the [Garena Free Fire brand page](https://ff.garena.com/en/brand/) and any current community-tournament terms as the permission sources. The current repository already records exact rights-holder CDN URLs for eight wallpapers. Official hosting establishes provenance, **not automatically permission for a paid community tournament**. Before keeping an asset, the implementer must verify that the current written terms permit local hosting, responsive resizing/cropping, and this tournament context. The source page, governing terms URL, access date, creator/rightsholder, modifications, and required attribution must be recorded per file. If that basis cannot be confirmed, the asset is not shipped.

If approved, only three Garena images remain, each with a functional role:

- Current `ff-arena-07.jpg`: Solo Survival event card and detail identity.
- Current `ff-arena-01.jpg`: Squad Last Circle event card and detail identity.
- Current `ff-arena-04.jpg`: Clash Squad/TDM event card and detail identity.

The implementation reacquires their highest practical official originals rather than enlarging the current 480×320 derivatives, then creates local 480, 960, and 1440 px WebP renditions plus one JPEG fallback. A consistent 16:9 crop is approved visually at phone and desktop sizes. Any baked official mark remains unmodified unless Garena’s written rules explicitly permit a crop that removes it. Cards use concise contextual alt text; repeated decorative instances use empty alt only when adjacent text fully identifies the event.

`assets/battle-arena.svg` is original QW artwork and remains the home hero. Its ownership statement stays in `docs/image-credits.md`. It may be optimized without changing the depicted competitors or embedding new third-party marks. It receives a stable 4:3 frame and is not reused as a meaningless divider.

Explicitly reusable fallback candidates are [Wikimedia Commons](https://commons.wikimedia.org/) file pages carrying CC0, public-domain, CC BY 4.0, or CC BY-SA 4.0 terms, and [Poly Haven textures](https://polyhaven.com/textures), published under CC0. Commons assets may be used only for a clearly captioned, non-misleading mobile/esports context image; the exact file page and attribution must be retained. Poly Haven may supply at most one subtle, aggressively compressed asphalt/paint texture for the rally-control surface, only if it improves hierarchy at both themes. CC BY/CC BY-SA attribution appears visibly near the use and in the credits document. Noncommercial, no-derivatives, unclear, or source-less files are rejected because the site may collect paid entries and resizing is a modification.

If Garena permission is not confirmed, event identity uses three purpose-made crops/variants of the original QW vector plus HTML text labels; it does not substitute unrelated stock photography or generated lookalike Free Fire characters. This branch is predetermined by the license check and is not an open visual decision.

Route-header background wallpapers, the fixed registration wallpaper, and the five decorative gallery images are removed. This eliminates `ff-arena-02`, `03`, `05`, `06`, and `08` unless one is selected through the same permission gate for a specific functional use. Unused files are deleted after references and credits are updated.

## Performance plan

The page performs no network work at runtime except user-initiated navigation to WhatsApp, a source credit, or another page. Fonts, images, styles, scripts, and icons are same-origin local files. There is no JavaScript image carousel, background video, analytics, or speculative prefetch.

Each meaningful raster has explicit `width` and `height` plus CSS `aspect-ratio`. `<picture>`/`srcset` and `sizes` deliver the smallest adequate event rendition. The one true above-fold hero/LCP image on a page is eager and high priority; all below-fold media uses `loading="lazy"` and `decoding="async"`. CSS background images are not used for content because they cannot lazy-load or carry alt text. Image failure preserves dimensions.

The two stylesheets remain render-blocking because they are the complete visual contract, but they are substantially reduced. `styles.css` owns reset, accessibility, primitives, component structure, and all responsive layout. `gaming.css` owns the two palettes, typography faces, QW surface treatment, and narrow aesthetic adjustments. The current seven separate `max-width: 44rem` blocks in `gaming.css` are consolidated. Unused `.hero-arena*`, `.event-emblem*`, `.selection-card*`, and `.demo-callout` rules are deleted. Repeated base/skin declarations are resolved at the owning layer rather than overridden later.

`js/shared/motion.js` and all `data-reveal`, `data-parallax`, and `data-spotlight` integration are removed. Page scripts render directly. Button sweeps, scan lines, breathing art, glitches, continuous status pulses, card lifts, and cross-page navigation animation are removed. Restrained 80–220 ms transitions remain only for control state and drawer spatial continuity. `prefers-reduced-motion: reduce` makes those transitions effectively instant and disables smooth scrolling. Low-power devices receive the same static composition without pointer listeners, fixed texture layers, large blurs, or continuous compositor work.

`theme-init.js` stays small and early to prevent theme flash. Other modules remain at the end of the document or module-deferred. Data scripts remain ordered before page modules. Local fonts use `font-display: swap`; only the body and display faces actually used are retained, and fallback metrics are tuned to reduce swap shift.

Performance acceptance targets on a representative mid-range mobile profile are Lighthouse Performance at least 90, LCP at most 2.5 seconds, CLS at most 0.10, and INP at most 200 ms. The initial compressed transfer for any route, excluding below-fold lazy media, should remain under 350 KB; no delivered raster rendition should exceed 160 KB without a documented quality reason. There must be no external request during initial load and no console/network 404.

## File and folder plan

Public HTML stays at the project root. The organized target is:

```text
.
├── assets/
│   ├── brand/
│   │   └── favicon.svg
│   ├── fonts/
│   │   ├── OFL.txt
│   │   ├── rajdhani-latin-500.woff2
│   │   ├── rajdhani-latin-700.woff2
│   │   ├── teko-latin-600.woff2
│   │   └── teko-latin-700.woff2
│   └── images/
│       ├── events/
│       │   ├── solo-survival-{480,960,1440}.webp
│       │   ├── solo-survival-960.jpg
│       │   ├── squad-last-circle-{480,960,1440}.webp
│       │   ├── squad-last-circle-960.jpg
│       │   ├── clash-squad-cup-{480,960,1440}.webp
│       │   └── clash-squad-cup-960.jpg
│       └── qw/
│           └── battle-arena.svg
├── css/
│   ├── styles.css
│   └── gaming.css
├── data/
├── docs/
├── js/
│   ├── pages/
│   ├── shared/
│   └── theme-init.js
├── index.html
├── tournaments.html
├── tournament.html
├── register.html
├── players.html
└── rules.html
```

The event raster paths above are created only after the Garena permission gate; otherwise equivalent `qw-...` vector/raster variants take their place. There is no source-art or build-output directory because the repository has no build pipeline.

Specific integration changes are locked as follows:

- All six HTML files: remove Google Fonts connections; update favicon/font/media paths; adjust semantic region markup and static responsive media; retain stylesheet order and existing script/data order.
- `css/styles.css`: replace the accumulated structural layer with the mobile-first token scale, shell, semantic controls, component anatomy, sticky offsets, responsive layouts, safe areas, print/forced-colors/reduced-motion rules, and no skin-specific imagery.
- `css/gaming.css`: define local `@font-face`, exact light/dark palettes, QW Night-Stage visual treatment, flat rules, restrained notches, image crops, and state colors; do not recreate structural layout or duplicate phone queries.
- `js/theme-init.js`: retain early initialization, strict saved-value validation, dark fallback, and storage failure recovery.
- `js/shared/data.js`: normalize and validate globals, fail demo mode safe, centralize state priority/media descriptors/format fallbacks, continue escaping and encoding, and expose data issues without private values.
- `js/shared/event-card.js`: output the new semantic flat card, all event states, intrinsic media, and accessible occupancy meter.
- `js/shared/shell.js`: render the sticky header stack, mobile theme control, accessible drawer fallback, simplified footer, image-credit route/link where required, and safe toast behavior. Remove unused `copy`, `chevron`, and `search` icon definitions unless a real use remains.
- `js/shared/registration.js`: retain reference/message/WhatsApp behavior, make validation pure and field-addressable, and never log registration data.
- `js/shared/motion.js`: delete after all imports and data attributes are removed; no replacement library is introduced.
- `js/pages/home.js`: render one nonduplicated featured event, useful previews, live facts, one prioritized hero, and no decorative gallery or motion initialization.
- `js/pages/tournaments-page.js`: retain filter/search/sort, enforce bounded inputs, render normal/empty/data-error states, and update without View Transitions.
- `js/pages/tournament-page.js`: retain query routing and all factual sections; render scheduled/closed/full/completed/unavailable states and honest completed action copy.
- `js/pages/register-page.js`: retain deep linking, three phases, value preservation, review, result, copy, and WhatsApp; add field-addressable errors, progress ARIA, state rechecks, popup-block feedback, and keyboard-safe scrolling.
- `js/pages/players-page.js`: retain event/search/query behavior; select only public fields and distinguish every roster empty/error state.
- `js/pages/rules-page.js`: retain expand/collapse/current-section behavior; add hash-driven disclosure opening and remove motion dependency.
- `data/config.js`, `data/tournaments.js`, and `data/players.js`: preserve organizer number, demo switch, fees, prizes, schedules, rules-facing values, and sample content. Only comments or optional media keys may change; no factual value changes are part of this UI work.
- `README.md`: update the organized tree, local-font policy, state behavior, image permission gate, test matrix, and removal of decorative motion.
- `docs/ui-references.md`: record the rally time-control direction, mobile layout/accessibility decisions, and official standards used.
- `docs/image-credits.md`: record exact per-asset source, rightsholder/creator, license or written permission basis, access date, modifications, local variants, and fallback decision.
- Current root asset files: move the favicon and QW SVG to their organized paths; replace approved event files with responsive variants; delete unused wallpapers only after reference checks pass.

## Accessibility and semantic requirements

Each page retains one `<main>` and one route-level `<h1>`. Heading levels descend without skips. Repeated event units are articles, fact pairs are definition lists, schedules/processes are ordered lists, rules are native disclosures, visuals are figures when captioned, and solo rosters remain tables at the semantic level. Links navigate and buttons perform in-page actions.

Every image has context-appropriate alt text or explicitly empty alt when redundant. Every control has a persistent associated label. Skip links remain first-focusable and land below the sticky header. Focus order follows DOM/reading order; Grid never visually reorders interactive content. `:focus-visible` remains a real outline and survives forced colors. Status, selection, completion, error, and capacity do not depend on color.

Body and meaningful metadata meet WCAG 2.2 AA contrast, with body pairs targeting AAA. Controls and focus indicators meet 3:1 non-text contrast. Touch targets meet the 44 px project target. At 200% zoom, all content reflows without two-dimensional scrolling. Reduced motion preserves all information and interaction. CSS-disabled reading order remains coherent. The native dialog, details, radio, checkbox, select, and table behaviors are preferred over custom ARIA widgets.

## Testability and verification

Pure functions in `data.js` and `registration.js` are unit-testable without DOM: normalization, escaping, state precedence with an injected current time, capacity clamping, invalid date/money fallbacks, URL encoding, registration shape validation, UID uniqueness, reference shape, and generated message wording. If automated tests are added, they use Node’s built-in `node:test` only; no package file or runtime dependency is introduced.

Browser integration tests cover shell rendering, theme boot/persistence failure, drawer focus and Escape, local links under a project subpath, event filtering/sorting, query routing, every event state, roster state, rule hashes, solo and squad wizard paths, Back value preservation, focus on errors, consent blocking, clipboard denial, popup blocking, and no-JavaScript notices. Fixture data may be supplied before page modules in a local test harness, but production data files are not changed to manufacture states.

Visual verification uses real browser rendering in both themes at every listed viewport, portrait and landscape, plus reduced motion, forced colors, keyboard-only use, 200% zoom, and simulated slow mobile. Each route is checked for horizontal overflow with a document-width assertion. Media dimensions are checked before and after load for layout stability. Network inspection must show only same-origin initial requests and zero failed requests. Console inspection must show no uncaught exception. Lighthouse and browser accessibility inspection complete the pass.

## Acceptance gates

1. All six existing public URLs and all `?tournament=<id>` deep links continue to work from both a root URL and a nested static-hosting path.
2. `styles.css` remains the base/structural layer and `gaming.css` remains the second combat-skin layer; structural mobile rules are not duplicated across the two.
3. Every page renders without document-level horizontal overflow at 320 px and the full viewport matrix; only the four explicitly approved rails can scroll horizontally and each visibly advertises that behavior.
4. Every interactive target is at least 44×44 px, inputs render at least 16 px on phones, safe-area insets are honored, and portrait/landscape soft-keyboard use does not hide the active field or required action.
5. Light and dark themes use the approved OKLCH four-slot palettes, persist only the valid theme value, and pass WCAG contrast checks for text, controls, focus, and status treatments.
6. Teko and Rajdhani load locally under documented OFL terms; a normal page load makes no request to Google Fonts, a CDN, tracker, backend, or analytics endpoint.
7. The home hero uses one prioritized original QW image with stable dimensions; all below-fold imagery is local, responsive, lazy-loaded, credited as required, and has a non-collapsing error fallback.
8. No Garena or third-party image ships without a recorded per-file provenance and verified permission/license compatible with local hosting, responsive modification, and a potentially paid tournament. Unverified assets are replaced by the predetermined original-QW fallback.
9. The decorative wallpaper gallery, fixed registration wallpaper, continuous animation, parallax, cursor spotlight, scroll reveal, button sweep, card lift, and unnecessary shadows are absent.
10. Open, closing soon, scheduled, closed, full, completed, unavailable, no-data, no-match, unpublished-roster, empty-roster, invalid-form, popup-blocked, copy-failed, image-failed, and successful-message states all render with specific text and an appropriate next action.
11. Search, format filters, sort, event detail, event capacity, roster selection/search, rules disclosures, theme switching, demo ribbon, organizer contact, and WhatsApp registration behavior remain operational.
12. Solo registration accepts exactly one participant; squad registration requires exactly four and a team name; names, UIDs, ages, UID uniqueness, open-event state, and all consents are revalidated before handoff.
13. The organizer number remains `+91 94494 49382`, current fees/prizes/schedules/content remain unchanged, demo mode remains on, and all “message/payment proof is not confirmation” safeguards remain visible.
14. No player form value, age, phone number, payment proof, room credential, or prepared WhatsApp message is persisted, logged, placed in a query string, or rendered in the public roster. All data-derived HTML is escaped.
15. Keyboard traversal, skip links, dialog focus/return, native disclosures, error focus, and hash navigation work with visible focus; reduced motion and forced colors remain fully usable.
16. The final implementation has no uncaught console errors, no failed initial requests, Lighthouse Performance of at least 90, LCP at most 2.5 s, CLS at most 0.10, and INP at most 200 ms under the agreed mobile profile.
17. Dead selectors and script paths identified in the audit are removed, all remaining references resolve after asset organization, and documentation matches the final tree and license records.
18. New code, comments, UI copy, and documentation follow the repository’s inclusive-language requirement.

## Assumptions and out of scope

The redesign assumes the current factual tournament, roster, rules, and organizer data is intentional sample content even where event dates may be historical by implementation time. This phase does not invent future events or silently change money, timing, eligibility, or refund terms. The site remains an independent community interface, not an official Garena property.

Out of scope are a backend, database, authentication, automated payments, payment verification, server-side slot reservation, live brackets, live results ingestion, organizer administration, WhatsApp API automation, user accounts, push notifications, analytics, advertising, a framework migration, a package/build pipeline, or a change to the six public route names. The redesign also does not claim legal permission for official artwork; it installs a verifiable asset gate and a safe fallback.