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

## 2026 mobile-first inspiration sweep — 64 references

This second sweep was completed before the October 2026 UX overhaul. It deliberately mixes live products, official game brands, design case studies, galleries, and specialist UX guidance. Gallery entries are inspiration indexes—not code or layouts to copy.

### A. Tournament discovery, schedules, rosters, and results

| # | Reference | Pattern reviewed for QW |
|---:|---|---|
| 1 | [start.gg](https://start.gg/) | Event-first discovery, clear registration state, and public participant context. |
| 2 | [Challengermode](https://www.challengermode.com/) | Competitive-product navigation and action-led tournament presentation. |
| 3 | [game.tv](https://game.tv/) | Mobile gaming discovery and short paths from game to tournament. |
| 4 | [Repeat.gg](https://repeat.gg/) | Competition cards, reward visibility, and participation status. |
| 5 | [Toornament Play](https://play.toornament.com/en_US/) | Dense factual listings with clear event identity and local navigation. |
| 6 | [Challonge](https://challonge.com/) | Familiar bracket and participant mental models. |
| 7 | [Battlefy tournament guidance](https://help.battlefy.com/en/articles/6961376-navigating-the-tournament-page) | Tournament-page orientation and predictable section structure. |
| 8 | [Battlefy check-in guidance](https://help.battlefy.com/en/articles/4587324-how-to-check-in-to-a-tournament) | Separating registration, check-in, and confirmed participation. |
| 9 | [Score7 mobile tournament comparison](https://kb.score7.io/blog/comparisons/best-tournament-app-2026/) | Designing tournament management for phones rather than shrinking desktop UI. |
| 10 | [Strafe](https://www.strafe.com/) | Fast access to schedules, results, and competition identity. |
| 11 | [Strafe esports calendar](https://www.strafe.com/calendar/) | Scannable time-led match rows and compact state communication. |
| 12 | [VLR.gg](https://www.vlr.gg/) | High-density match schedules that remain easy to scan. |
| 13 | [HLTV matches](https://www.hltv.org/matches) | Strong grouping by date, event, live state, and importance. |
| 14 | [Liquipedia](https://www.liquipedia.net/) | Deep event information architecture and reliable cross-linking. |
| 15 | [Leaderboarded tournament guide](https://leaderboarded.com/blog/posts/gaming-tournament-leaderboard/) | Shareable standings with immediately understandable scoring columns. |
| 16 | [WANDR leaderboard UX](https://www.wandr.studio/blog/game-leaderboard-ui-design) | Giving ranking rows identity and context instead of presenting bare numbers. |
| 17 | [Blaston tournament redesign case study](https://www.resolutiongames.com/blog/redesigning-the-blaston-tournament-interface-a-uxui-case-study) | Keeping progress, join action, and leaderboard in one coherent mobile flow. |
| 18 | [FlutterFlow mobile esports tutorial](https://www.rapidevelopers.com/flutterflow-tutorials/how-to-create-a-platform-for-mobile-esports-with-live-competitions-in-flutterflow) | Registration, result submission, organizer review, and live update states. |

### B. Official esports event and game-brand experiences

| # | Reference | Pattern reviewed for QW |
|---:|---|---|
| 19 | [VALORANT Esports](https://valorantesports.com/en-US/) | Strong league identity with schedule-first navigation. |
| 20 | [VALORANT league filters](https://valorantesports.com/en-US/leagues/champions,game_changers_championship,vct_americas,vct_masters) | Compact competition switching without losing the current context. |
| 21 | [Riot Competitive Operations](https://competitiveops.riotgames.com/VALORANT) | Clear separation of rules, rosters, rulings, and competition information. |
| 22 | [ESL](https://esl.com/) | Cinematic gaming identity anchored by a simple content hierarchy. |
| 23 | [ESL events](https://esl.com/events/) | Event discovery that distinguishes upcoming and active competitions. |
| 24 | [DreamHack](https://dreamhack.com/) | Energetic event branding with direct paths to participation information. |
| 25 | [PGL Esports](https://www.pglesports.com/) | Upcoming-event priority and restrained event-card facts. |
| 26 | [Evo](https://evo.gg/) | One unmistakable event brand with strong player/fan route separation. |
| 27 | [Evo 2026 event](https://evo.gg/events/evo2026) | Event details grouped around participation, games, and venue information. |
| 28 | [Esports World Cup](https://esportsworldcup.com/en/) | Competition-scale visual hierarchy and game-based discovery. |
| 29 | [Free Fire](https://ff.garena.com/en) | Official Free Fire visual language, combat imagery, and mobile-first brand energy. |
| 30 | [PUBG Mobile](https://www.pubgmobile.com/en-US/home.shtml) | Battle-royale atmosphere with bold mobile action hierarchy. |
| 31 | [PUBG](https://pubg.com/) | Full-bleed art, restrained copy, and high-contrast action placement. |
| 32 | [Fortnite](https://www.epicgames.com/fortnite/en-US/home) | Strong seasonal identity and clear action-led content blocks. |
| 33 | [Esports World Cup Free Fire](https://esportsworldcup.com/en/competitions/2025/free-fire) | Free Fire competition summaries, standings, and event-state hierarchy. |
| 34 | [HB Battle](https://www.hbbattle.online/) | Small-community mobile tournament information and fair-play orientation. |
| 35 | [Royal Hub Esports](https://royalhubesports.com/) | Multi-game tournament discovery and reward-led cards. |

### C. Esports team brands and premium gaming art direction

| # | Reference | Pattern reviewed for QW |
|---:|---|---|
| 36 | [Fnatic](https://fnatic.com/) | Distinctive brand typography and high-energy content framing. |
| 37 | [Cloud9](https://cloud9.gg/) | Team identity, roster/news prioritization, and controlled accent color. |
| 38 | [NAVI teams](https://navi.gg/en/teams) | Game-based roster navigation and bold editorial art direction. |
| 39 | [Team Liquid](https://teamliquid.com/) | Multi-game navigation with a persistent, recognizable brand system. |
| 40 | [KryzenGG](https://kryzengg.com/) | Free Fire-compatible esports identity and focused organization positioning. |
| 41 | [Awwwards: Zentry case study](https://www.awwwards.com/zentry-case-study.html) | Layered gaming atmosphere balanced against readable information. |
| 42 | [Awwwards: Nemiga Gaming](https://www.awwwards.com/sites/nemiga-gaming) | Aggressive but refined esports identity rather than generic neon styling. |
| 43 | [Awwwards: Riot Star Guardian](https://www.awwwards.com/sites/riot-games-star-guardian) | Character-led storytelling and cohesive world-building. |
| 44 | [Awwwards: Disguised](https://www.awwwards.com/sites/disguised) | Limited palette, cut-out imagery, and clear brand personality. |
| 45 | [Awwwards: Gaming on Avalanche](https://www.awwwards.com/sites/gaming-on-avalanche) | Dynamic gaming presentation with structured content beneath the spectacle. |
| 46 | [Awwwards games and entertainment collection](https://www.awwwards.com/websites/games-entertainment/) | Broad responsive gaming composition and motion references. |

### D. Mobile gaming UI and visual pattern galleries

| # | Reference | Pattern reviewed for QW |
|---:|---|---|
| 47 | [Dribbble gaming UX](https://dribbble.com/tags/gaming_ux) | Gaming dashboards, tournament pages, navigation, and compact card treatments. |
| 48 | [Dribbble gaming mobile app](https://dribbble.com/tags/gaming-mobile-app) | Thumb-first navigation and dense mobile game surfaces. |
| 49 | [Dribbble gaming UI](https://dribbble.com/tags/gaming-ui) | HUD details, visual hierarchy, and combat-oriented typography. |
| 50 | [Dribbble mobile game UI](https://dribbble.com/tags/mobile-game-ui) | In-game control density and mobile status feedback. |
| 51 | [Dribbble sports UI](https://dribbble.com/tags/sports-ui) | Match scores, player statistics, and schedule cards. |
| 52 | [Dribbble player cards](https://dribbble.com/tags/player-card) | Compact identity rows and player-number emphasis. |
| 53 | [Behance Teamfight Tactics UI](https://www.behance.net/gallery/133371555/Teamfight-Tactics-UI-Design) | Tactical game hierarchy and information-dense panels. |
| 54 | [Behance sports dashboard UI](https://www.behance.net/gallery/98577079/Sports-Dashboard-UI) | Filters, standings, and dense sports-data composition. |
| 55 | [Behance game UI/UX collection](https://www.behance.net/tags/game-ui-ux) | Long-form case studies showing complete game UI systems. |
| 56 | [Behance mobile game UI collection](https://www.behance.net/tags/mobile-game-ui) | Mobile game controls, status, and visual feedback patterns. |
| 57 | [Collect UI mobile menus](https://collectui.com/challenges/mobile-menu) | Image-only menu inspiration; useful for comparing drawer and bottom-navigation patterns. |
| 58 | [Mobbin mobile reference library](https://mobbin.com/) | Real product flows and state-by-state mobile interaction references. |
| 59 | [Mobbin mobile icons](https://mobbin.com/explore/mobile/ui-elements/icon) | Familiar mobile icon placement and label pairing. |
| 60 | [Mobbin sliders](https://mobbin.com/explore/mobile/ui-elements/slider) | Touch-target and state references for horizontal controls. |

### E. Registration, payment, progress, and upload UX

| # | Reference | Pattern reviewed for QW |
|---:|---|---|
| 61 | [Eleken stepper examples](https://www.eleken.co/blog-posts/stepper-ui-examples) | Visible progress, short phase names, and safe Back navigation. |
| 62 | [Stripe mobile checkout UX](https://stripe.com/resources/more/mobile-checkout-ui) | Reducing small-screen input burden and keeping payment context visible. |
| 63 | [U.S. Department of Labor mobile document uploader guidance](https://www.dol.gov/agencies/eta/ui-modernization/customer-experience/doc-uploader-cx) | Mobile-native upload affordances and plain recovery guidance. |
| 64 | [UX Patterns file input](https://uxpatterns.dev/patterns/forms/file-input) | File selection, validation, preview, progress, errors, and retry states. |

### Synthesis used for QW

The references converge on six decisions that fit this project:

1. **Persistent mobile orientation:** provide a compact quick-navigation dock, but remove it during payment/registration to protect focus.
2. **Decision-complete match cards:** show status, lobby time, entry, reward, and the next action without forcing a detail-page visit.
3. **One live path, visible future formats:** lead with Solo while keeping Squad and Clash discoverable but unmistakably unavailable.
4. **Payment prevention before error recovery:** verify service readiness before exposing the UPI handoff; never wait until final submit.
5. **Review without memory work:** keep lobby, player, WhatsApp, UTR, screenshot, fee, and rewards visible with direct Edit actions.
6. **Roster truth by default:** start at All lobbies and keep registration references visible so a filtered board cannot look complete by accident.

Content from external sources was rephrased for compliance with licensing restrictions.