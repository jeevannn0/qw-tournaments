# QW Tournaments UI reference notes

The redesign borrows information architecture and interaction principles—not visual assets, page copy, logos, or proprietary layouts—from the sources below.

## Tournament product references

- [start.gg](https://www.start.gg/) — clear separation between event discovery, event details, brackets, standings, and attendees. QW uses focused pages and direct event URLs instead of deep nested navigation.
- [FACEIT tournament guidance](https://support.faceit.com/hc/en-us/articles/9936015291036-Joining-CS2-tournaments) — distinguishes readiness, joining, and confirmation. QW similarly avoids presenting a generated message as a confirmed slot.
- [Battlefy tournament-page guidance](https://help.battlefy.com/en/articles/6961376-navigating-the-tournament-page) and [check-in guidance](https://help.battlefy.com/en/articles/4587324-how-to-check-in-to-a-tournament) — inspired the compact “what happens next” status component and explicit check-in timing.
- [Toornament Play](https://play.toornament.com/en_US/) — useful factual event cards and local event navigation. QW cards expose date, format, fee, prize, capacity, and status before registration.
- [ESL events](https://esl.com/events/) — one featured event can provide energy without turning every item into a competing hero.
- [BLAST](https://blast.tv/cs/) — compact schedule/event presentation informed QW’s timeline components.
- [VALORANT Esports](https://valorantesports.com/en-US/) — phase-aware event navigation and mobile simplification informed the dedicated detail page.
- [PUBG Esports tournaments](https://pubgesports.com/en/tournament) — desktop factual listing and mobile card transformation reinforced responsive event components.
- [Esports World Cup Free Fire](https://esportsworldcup.com/en/competitions/2025/free-fire) — battle-royale event summaries and standings hierarchy informed the prize and scoring sections.

## Component and accessibility references

- [WAI multi-page form guidance](https://www.w3.org/WAI/tutorials/forms/multi-page/) — the registration experience uses an ordered stepper, visible progress, step-level validation, Back controls, and focus movement.
- [WAI form validation guidance](https://www.w3.org/WAI/tutorials/forms/validation/) — form errors are specific, persistent, and connected to the current task.
- [WAI dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) and [MDN dialog documentation](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog) — mobile navigation uses the native dialog element, Escape handling, an explicit close control, and focus return.
- [WAI tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) — reviewed to avoid misusing tab semantics for page navigation or tournament filters.
- [MDN View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API) — same-origin page navigation receives a progressive cross-fade where supported; ordinary navigation remains the fallback.
- [MDN Intersection Observer](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API) — one-time reveals avoid continuous scroll handlers and leave content visible when enhancement is unavailable.
- [MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) and [WCAG animation guidance](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) — optional movement is suppressed for visitors requesting reduced motion.
- [WCAG focus visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html), [focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html), and [target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) — controls use visible focus rings, sticky-header scroll offsets, and touch-friendly targets.
- [Radix accessibility overview](https://www.radix-ui.com/primitives/docs/overview/accessibility) and [shadcn/ui components](https://ui.shadcn.com/docs/components) — used as anatomy and state references while keeping the implementation dependency-free and framework-free.

## Design decisions applied

1. One job per page: discovery, event detail, registration, roster verification, or rules.
2. One fixed navigation layer; the mobile drawer is modal and does not compete with a bottom bar.
3. Event cards show decision data before the action.
4. Registration is a three-step reviewable flow, but remains one document so entered values survive Back navigation.
5. WhatsApp is clearly described as the handoff; it is not represented as an automated payment or confirmation system.
6. Motion supports hierarchy: page transitions, one-time reveals, step changes, hover feedback, and status emphasis. There is no autoplay carousel or endless marquee.
7. Room credentials, ages, phone numbers, and payment evidence never enter public roster data.

Content was rephrased for compliance with licensing restrictions.

## Supabase-backed registration extension

The frontend remains a static GitHub Pages application, but registration now uses Supabase Authentication, PostgreSQL, Row Level Security, and private Storage. The form is intentionally all-or-nothing: every player field, private contact field, payment field, screenshot, and consent must pass before upload begins; the pending registration row is inserted only after the screenshot succeeds. The organizer dashboard loads private screenshots only on demand, keeps status changes behind a database review function, and publishes a separate sanitized public roster record rather than exposing the private registration table.

Security is enforced by database and Storage policies rather than by obscuring the administrator URL or frontend source. A successful upload remains pending until the organizer verifies the receiving account and assigns a slot.
