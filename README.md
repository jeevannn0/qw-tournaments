# QW Tournaments

A mobile-first Free Fire tournament website with a GitHub Pages frontend and an optional Supabase Free backend for complete player registration, private payment-proof storage, organizer review, and confirmed public rosters.

There is no package manager, compilation, or application server. Browser modules load one exact-pinned Supabase JavaScript client from jsDelivr only on backend-enabled pages.

## Current release

- **Solo Survival 01, Squad Last Circle 01, and Clash Squad Cup 01** can each be set to Coming soon, Scheduled, or Registration open from the organizer Match Cards workspace.
- Registration open creates one future, capacity-limited lobby using the published fee and reward summary. Solo accepts one player; Squad BR and Clash Squad accept exactly four players and a squad name.
- Scheduled and Registration open matches become Completed at match time and return to Coming soon three hours later.
- Only organizer-confirmed, consented game details appear in the public roster.

## Pages

| Page | Purpose |
|---|---|
| `index.html` | Home, Solo summary, future formats, and joining flow |
| `tournaments.html` | Searchable and filterable tournament board |
| `tournament.html?tournament=<id>` | Event details, rewards, availability, and rules |
| `register.html?tournament=<id>` | Required player details, payment proof, review, and Supabase submission |
| `players.html?tournament=<id>` | Public organizer-confirmed player roster |
| `booyah.html` | Public organizer-verified match-winner board |
| `rules.html` | Eligibility, payment, verification, privacy, and competition rules |
| `admin.html` | Private organizer dashboard for registration review, Booyah winner publishing, and versioned match announcements, protected by Supabase Auth and database policies |

## Architecture

```text
GitHub Pages
├── HTML, CSS, and JavaScript
├── Public tournament configuration
└── Supabase JavaScript client
         ↓
Supabase Authentication
├── Anonymous player sessions
└── Organizer email/password account
         ↓
PostgreSQL with Row Level Security
├── registrations       private complete submissions
├── admin_users         organizer approvals
└── public_players      sanitized confirmed roster
         ↓
Supabase Storage
└── payment-proofs      private screenshots, maximum 2 MB
```

Supabase is fail-closed. Until `data/supabase-config.js` contains a valid Project URL and public Publishable key, registration submission is disabled and the organizer page shows a setup notice. Normal tournament browsing continues to work.

## Complete player submission

Every registration requires:

- One organizer-published future lobby from a match marked Registration open
- One Solo player, or a squad name and exactly four Squad/TDM players
- Each player’s in-game display name, numeric 6–12 digit Free Fire UID, and age from 13 through 80
- One private 10-digit Indian WhatsApp number
- The exact published UPI entry fee paid to `9900344144@ybl`, copied from the registration page and paid through any UPI app
- 6–40 character UTR or transaction reference
- JPG, PNG, or WebP payment screenshot no larger than 2 MB
- Rules, guardian, payment, and public-roster confirmations

The screenshot uploads to the private `payment-proofs` bucket first. The complete pending database row is created only after that succeeds. If the database insert fails, the client attempts to remove the unattached private upload. No form or payment data is persisted in browser storage.

A successful submission is not confirmation. The organizer must verify the receiving account, assign a slot, and confirm the entry.

## Organizer dashboard

Open `admin.html` and sign in with the organizer email/password account. The account’s UUID must have an active row in `admin_users`.

The dashboard supports:

- Total, pending, payment-verified, confirmed, and duplicate-UTR counts
- Three keyboard-accessible operations tabs for payment verification, Booyah cards, and match cards
- A version-checked Match Cards editor for public copy, map, rounds, lobby capacity, and three states: Coming soon, Scheduled, or Registration open
- Registration open publishes one IST lobby, entry fee, reward summary, and player/team capacity, then enables server-validated registration and payment submission
- Search plus dynamic lobby, payment, registration, duplicate-UTR, and sort filters
- Automatic duplicate UTR warning badges, including cross-record counts
- Complete private Solo or four-player squad details
- On-demand private screenshot loading
- Payment verification, rejection, cancellation, notes, and player-number assignment
- Export filtered PDF and Export all PDF reconciliation reports without screenshots
- Direct WhatsApp contact
- Permanent deletion of cancelled or rejected registrations and their private screenshots
- Atomic private-status and public-roster updates through `review_registration`

Confirmation requires verified payment and a unique player/team number within the lobby’s configured capacity. Public rows contain only reference, tournament, lobby, safe lineup names and UIDs, assigned number, status, and confirmation time.

### Match registration lifecycle

**Coming soon** hides schedule, fee, and reward terms. **Scheduled** publishes those facts while registration remains closed. **Registration open** uses the same facts as one authoritative lobby and accepts a complete Solo or four-player squad submission until match time. At match time, Scheduled and Registration open become **Completed**; three hours later they display **Coming soon**.

The server derives each new registration’s tournament name, lobby ID/time, fee, capacity, and cycle from the organizer-controlled match row. It verifies the private proof object, enforces capacity under a database lock, and rejects a player UID already active in the same tournament cycle. Historical registrations and rosters remain attached to their original cycle.

## Supabase setup

Follow [`docs/supabase-setup.md`](docs/supabase-setup.md):

1. Create a Supabase Free project.
2. Run `supabase-schema.sql` in SQL Editor.
3. Enable anonymous sign-ins.
4. Create the organizer email/password user.
5. Insert that user into `admin_users`.
6. Add Project URL and public Publishable key to `data/supabase-config.js`.
7. Test one controlled registration before accepting money.

The Project URL and Publishable key are public browser values. Never commit the `service_role` key, database password, access token, or private credential.

## Security boundaries

- Visitors can submit only complete pending registrations through the guarded `submit_registration` RPC.
- Database and RPC validation enforce the current open match, published fee/time/capacity, one-or-four-player lineup, field formats, consents, statuses, and screenshot path.
- Visitors cannot list other private registrations, review payments, assign slots, or confirm themselves.
- Only active organizers can list private registrations, download proofs, and invoke the review RPC.
- The payment bucket is private, image-only, and limited to 2 MB.
- Unique database constraints prevent duplicate registration references and duplicate confirmed lobby slots.
- Public roster reads expose only sanitized confirmed fields.
- Security is enforced by PostgreSQL Row Level Security and Storage policies—not by hiding `admin.html` or frontend source.

## Data handling

Payment screenshots can reveal names, UPI IDs, phone numbers, and transaction references. Protect the organizer account, use a written retention period, and delete rejected, cancelled, and settled proofs when they are no longer needed. Never collect an OTP, UPI PIN, card PIN, game password, account password, or identity document.

The WhatsApp group message contains only the registration reference, tournament, lobby, squad name when applicable, and player names/UIDs. Ages, phone numbers, payment details, screenshot, database user ID, and organizer notes remain private.

## Project structure

```text
.
├── assets/
├── css/
├── data/
│   ├── config.js
│   ├── players.js
│   ├── supabase-config.js
│   ├── tournaments.js
│   └── winners.js
├── docs/
│   ├── supabase-setup.md
│   ├── image-credits.md
│   └── ui-references.md
├── js/
│   ├── pages/
│   └── shared/
├── admin.html
├── booyah.html
├── index.html
├── players.html
├── register.html
├── rules.html
├── tournament.html
├── tournaments.html
└── supabase-schema.sql
```

## Local preview

```powershell
Set-Location "C:\Users\jeevanzn\Downloads\tournamte site"
python -m http.server 4317 --bind 127.0.0.1
```

Open `http://127.0.0.1:4317`.

## GitHub Pages

GitHub Pages continues to deploy the frontend from `main` at the repository root. Run `supabase-schema.sql` separately in Supabase; pushing SQL to GitHub does not apply it automatically.

The public site is `https://jeevannn0.github.io/qw-tournaments/`.

## Artwork

Runtime artwork and ownership notes are documented in [`docs/image-credits.md`](docs/image-credits.md). Confirm compliance with current Garena policies before operating a paid public event.

The Supabase Free plan currently includes 500 MB database space, 1 GB file storage, 5 GB egress, and 50,000 monthly active users. See [Supabase billing documentation](https://supabase.com/docs/guides/platform/billing-on-supabase).

Content was rephrased for compliance with licensing restrictions.

## UPI payment handoff

The receiving address is a personal UPI VPA, not a merchant payment-gateway integration. The payment card displays the configured UPI ID and provides one **Copy UPI ID** button. Players paste the ID into any UPI app, verify the recipient name, enter exactly ₹10, and the organizer verifies the actual received amount. The site does not issue partial merchant-style UPI intents because payment apps can report misleading bank-limit failures when required merchant fields are unavailable.

## Custom Room access

Apply `supabase-migrations/2026-10-09-custom-room-details.sql` after the registration-open migration. New registrations collect a private email. Organizers publish a current-cycle Room ID/password from the separate Custom Room card in `admin.html`; confirmed players retrieve it from the always-visible Custom Room button on the matching event page by entering that same email. Unpublished rooms show a wait message, and wrong, pending, rejected, cancelled, historical, or other-cycle registrations receive no credentials. Email-only lookup does not prove email ownership, so room passwords should be rotated if exposed.

To enable removal of demo or outdated Room credentials, apply `supabase-migrations/2026-10-10-clear-custom-room.sql`. The organizer-only **Clear Room details** action deletes the current-cycle Room ID/password after confirmation and immediately restores the player waiting state.

## Lifecycle reconciliation migration

Apply `supabase-migrations/2026-10-11-lifecycle-reconciliation.sql` after migrations 10-09 and 10-10. This final reconciliation expires Room access when a match closes/starts, keeps inactive credentials clearable, makes reviews conflict-safe, restores duplicate UTR state after deletion, enables cycle-aware winners for all formats, limits public rosters to the current cycle, and provides accurate current occupancy. The Payment verification tab keeps archived cycles accessible through explicitly labelled cards without mixing them into the current match.

## Automatic lobby numbering

Apply `supabase-migrations/2026-10-12-auto-lobby-number.sql` after lifecycle reconciliation. Verifying a payment automatically confirms a nonterminal registration, assigns the lowest free player/team number under a lobby-scoped database lock, and publishes the confirmed roster row. Cancellation or rejection clears the number for reuse; an already confirmed registration keeps its number.

## Squad-aware results and Booyah publish fix

Apply `supabase-migrations/2026-10-13-squad-results.sql` after automatic lobby numbering (already applied to the live project on 13 October 2026). It stores the winning squad name and full four-player lineup on `match_results`, returns squad identity from `get_admin_public_players`, and replaces `publish_match_result` with the eight-argument signature (including `p_registration_cycle`) that the organizer console has sent since the dynamic-operations release; the previous seven-argument overload rejected every publish. The same migration closes database-linter findings: organizer-only and trigger functions are no longer executable by `anon`, RLS `auth.uid()` calls are wrapped for per-statement evaluation, duplicate permissive SELECT policies are merged, and the winner foreign key is indexed.

On the frontend, the Payment verification queue, printable PDF report, Booyah winner picker, published-card list, and public Booyah page show the squad name and every player with their UID instead of only the captain. Home no longer opens an unsolicited winner toast; winners remain available from the persistent Booyah navigation.

The same release fixes a Custom Room dialog race that could leave the email check button stuck on "Checking registration…", a false "match changed or closed" error on the registration page when no match was open, solo roster boards disappearing after a card left Registration open, archived lobbies labelled "Coming soon" instead of "Completed", the organizer dashboard reloading on every hourly token refresh, double data fetches on first load, the match-board fee sort treating unannounced fees as ₹0, stale fixed-schedule copy on Home, the board, and the Solo detail page, and mismatched stylesheet cache tokens between pages. All HTML, data, and module URLs now share the `20261013-squad-results` cache token.
