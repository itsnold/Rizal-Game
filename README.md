# Rizal Live

A presenter-controlled, Firebase-only classroom quiz. The presenter launches any
prewritten question from a tablet. The projector shows the question; whitelisted
group representatives answer on phones for 20 seconds. Correct answers are ranked
by client-measured response time.

## Run it

Requires Node.js 22.12+ (the current workspace already has Node and Firebase CLI).

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`. Without a Firebase config, the landing page offers a
local rehearsal. Use these **separate tabs in the same browser**:

- `http://localhost:5173/host?demo=1` — enter rehearsal host.
- `http://localhost:5173/display?demo=1` — projector; enable sound.
- `http://localhost:5173/play?demo=1` — pick a sample group.

Rehearsal uses localStorage, not Firebase. Different devices do not share it.
It is a UI/flow preview, not an authentication or security environment. Choose
different sample groups in different tabs to compare rankings. Creating a fresh
session clears that session’s standings without deleting historical sessions.

## Connect and deploy

Follow **[FIREBASE_SETUP.md](FIREBASE_SETUP.md)**. It covers the configured database URL,
Google authorized domains, Firebase rules, and deploying to Vercel or Firebase.
The initial controller is **rsegundo@addu.edu.ph**; that account can authorize
additional controllers using the **Controllers** panel.

## Screens

| Route | Purpose |
| --- | --- |
| `/` | Landing and setup |
| `/host` | Tablet control room, question editor, email/group manager, cueing, results, exports |
| `/display` | Public projector, QR lobby, question, timer, results, podium |
| `/play` | School Google login, assigned group, answering, personal results |

## Game mechanics

- Prepare is private. Play starts a 1-second delivery lead-in plus 3-second countdown.
- The full answer window is 20 seconds, followed by 2 seconds of transport grace.
- Phones anchor the shared start time onto `performance.now()` using Realtime
  Database’s server-clock offset estimate. The offset is approximate; timing is
  classroom-grade, not a guarantee of sub-100-ms physical synchronization.
- Taps are immutable locally and submissions are immutable in Firebase rules.
- Accepted submissions carry a Firebase server timestamp for deadline checks;
  upload order is **not** the ranking metric.
- Correct answers in the same 100-ms bucket share competition rank. Points are
  `round(1000 × 0.9^(rank - 1))`: 1000, 900, 810, etc. Wrong/missing answers get 0.
- Client response times are trusted; rules validate bounds, not the physical tap.
- Practice rounds award zero and do not affect cumulative correct-answer counts.
- The authenticated host browser finalizes each round transactionally. Results
  are persistent, and totals are derived from finalized, non-voided rounds.
- Host disconnection does not extend the answer deadline. Keep the host page
  visible during rounds. It recovers and finalizes on reconnect/reload.
- One 60-second device lease per group, renewed every 20 seconds. Normal duplicate
  tabs/phones cannot acquire an occupied lease. The presenter can release a lease.
- Switching devices and refreshing do not erase accepted answers or restart time.
- **Reset session** starts at zero with unused questions, ends the previous session,
  and preserves the question bank, roster, group names/colors, and controllers.
  Connected devices automatically return to waiting; archived sessions stay saved.

## Question and roster format

Edit `content/questions.example.json`, then import it in Host → Setup. The example
file is **not deployed** with your site. Real questions and answer keys live in the
host-private `questions` database node. Only the launched prompt and choices are
published. Phones omit the prompt in the UI; the projector shows it.

You can also use **Manage questions** to add/edit/delete questions directly in the
control room. Each launched round saves a host-private answer-key snapshot, so
editing the bank does not alter a live round’s answer or an existing result.

`correctIndex` starts at 0: A=0, B=1, C=2, D=3. Questions allow 2–4 choices. Optional
`image` can be an HTTPS URL or a local `/assets/...` URL. Put local images in
`public/assets/` and rebuild/redeploy when they change.

Paste a roster using `Group name, representative@addu.edu.ph`, one line per group.
One unique email and name per group; up to 80 groups. Setup → Create fresh session
applies the roster. Use the real school accounts before the presentation.

Use **Authorized emails & groups** for ongoing roster changes without creating a
new session. Rename a group, authorize/revoke an exact email, or replace a
representative while preserving that group’s points. Name changes sync live;
email changes wait until the current round ends. Unauthorized accounts are signed
out of `/play`, and database rules deny their submissions independently.

Controller admission is separate. Firebase rules grant the verified primary
email `rsegundo@addu.edu.ph` control-room access, plus emails that the primary
account adds to `controllers`. Only the primary account can manage that list;
the old `adminUsers` UID grants are no longer used.

## Audio

Eleven original CC0 WAV cues are in `public/assets/audio/` (roughly 480 KB total),
including a four-second quiz-show intro with animated answer-shape tiles.
The display plays the live cues; phones are silent. `SOURCES.md` documents provenance.
The projector’s Enable sound button unlocks browser audio. Regenerate files with
`npm run assets`. No external font, music, or asset service is needed at runtime.

## Verification

```powershell
npm run build
npm test
npm run test:rules
npm run test:e2e
```

Rules tests use the **local Firebase database emulator**, which needs Java 21+.
Java is a development test dependency only; the website and deployment do not
use Java. End-to-end tests use Playwright Chromium; if needed, run
`npx playwright install chromium` once.

## Main files

- `src/model.ts` — validation, round phases, ranking, cumulative standings.
- `src/backend.ts` — Firebase adapter and same-browser rehearsal adapter.
- `src/game-service.ts` — session creation, cueing, finalization, voiding.
- `src/Host.tsx`, `src/Display.tsx`, `src/Player.tsx` — device interfaces.
- `database.rules.json` — server-enforced roles, whitelist, leases, deadlines.
- `firebase.json` — standard Hosting and database deployment config.
- `vercel.json` — Vite deployment and SPA routes for Vercel.
- `src/ControllerManager.tsx`, `src/access.ts` — primary owner and controller list.
