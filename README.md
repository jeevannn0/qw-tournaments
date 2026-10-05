# QW Tournaments

A mobile-first Free Fire tournament website with a GitHub Pages frontend and an optional Supabase Free backend for complete player registration, private payment-proof storage, organizer review, and confirmed public rosters.

There is no package manager, compilation, or application server. Browser modules load one exact-pinned Supabase JavaScript client from jsDelivr only on backend-enabled pages.

## Current release

- **Solo Survival 01:** two scheduled 50-player lobbies on 6 October 2026 at 7:30 PM and 9:00 PM IST, ₹10 entry, ₹6 for each organizer-verified elimination, and an additional ₹30 Booyah bonus.
- **Squad Last Circle 01:** Coming soon; registration, payment, schedule, fee, and rewards are unavailable.
- **Clash Squad Cup 01:** Coming soon under the same restrictions.
- Only organizer-confirmed, consented game details appear in the public roster.

## Pages

| Page | Purpose |
|---|---|
| `index.html` | Home, Solo summary, future formats, and joining flow |
| `tournaments.html` | Searchable and filterable tournament board |
| `tournament.html?tournament=<id>` | Event details, rewards, availability, and rules |
| `register.html?tournament=<id>` | Required player details, payment proof, review, and Supabase submission |
| `players.html?tournament=<id>` | Public organizer-confirmed player roster |
| `rules.html` | Eligibility, payment, verification, privacy, and competition rules |
| `admin.html` | Private organizer dashboard protected by Supabase Auth and database policies |

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

- One required Solo lobby: 6 October 2026 at 7:30 PM or 9:00 PM IST
- In-game display name
- Numeric 6–12 digit Free Fire UID
- Age from 13 through 80
- Private 10-digit Indian WhatsApp number
- UPI payment of ₹10 to `9449449382@slc` using Google Pay, Paytm, PhonePe, super.money, or another UPI app
- 6–40 character UTR or transaction reference
- JPG, PNG, or WebP payment screenshot no larger than 2 MB
- Rules, guardian, payment, and public-roster confirmations

The screenshot uploads to the private `payment-proofs` bucket first. The complete pending database row is created only after that succeeds. If the database insert fails, the client attempts to remove the unattached private upload. No form or payment data is persisted in browser storage.

A successful submission is not confirmation. The organizer must verify the receiving account, assign a slot, and confirm the entry.

## Organizer dashboard

Open `admin.html` and sign in with the organizer email/password account. The account’s UUID must have an active row in `admin_users`.

The dashboard supports:

- Total, pending, payment-verified, confirmed, and duplicate-UTR counts
- Search plus lobby, payment, registration, duplicate-UTR, and sort filters
- Automatic duplicate UTR warning badges, including cross-record counts
- Complete private player/payment details
- On-demand private screenshot loading
- Payment verification, rejection, cancellation, notes, and player-number assignment
- Export filtered PDF and Export all PDF reconciliation reports without screenshots
- Direct WhatsApp contact
- Permanent deletion of cancelled or rejected registrations and their private screenshots
- Atomic private-status and public-roster updates through `review_registration`

Confirmation requires verified payment and a unique player number from 1 through 50 within the selected lobby. The public row contains only reference, tournament, lobby, display name, UID, player number, status, and confirmation time.

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

- Visitors can insert only complete pending Solo registrations owned by their authenticated anonymous user.
- Database constraints enforce the current tournament, ₹10 amount, field formats, consents, statuses, and screenshot path.
- Visitors cannot list other private registrations, review payments, assign slots, or confirm themselves.
- Only active organizers can list private registrations, download proofs, and invoke the review RPC.
- The payment bucket is private, image-only, and limited to 2 MB.
- Unique database constraints prevent duplicate registration references and duplicate confirmed lobby slots.
- Public roster reads expose only sanitized confirmed fields.
- Security is enforced by PostgreSQL Row Level Security and Storage policies—not by hiding `admin.html` or frontend source.

## Data handling

Payment screenshots can reveal names, UPI IDs, phone numbers, and transaction references. Protect the organizer account, use a written retention period, and delete rejected, cancelled, and settled proofs when they are no longer needed. Never collect an OTP, UPI PIN, card PIN, game password, account password, or identity document.

The WhatsApp group message contains only registration reference, tournament, in-game name, and Free Fire UID. Age, phone number, payment details, screenshot, database user ID, and organizer notes remain private.

## Project structure

```text
.
├── assets/
├── css/
├── data/
│   ├── config.js
│   ├── players.js
│   ├── supabase-config.js
│   └── tournaments.js
├── docs/
│   ├── supabase-setup.md
│   ├── image-credits.md
│   └── ui-references.md
├── js/
│   ├── pages/
│   └── shared/
├── admin.html
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

## UPI app routing

On Android, payment buttons target the installed Google Pay, Paytm, PhonePe, or super.money package directly. On iPhone, Google Pay, Paytm, and PhonePe use their documented custom UPI URL schemes. No verified public super.money iOS payment scheme is available, so that button copies the configured UPI ID and instructs the player to open super.money manually. The generic **Other UPI app** button uses the device’s standard UPI handler, and **Copy UPI ID** remains available everywhere.
