# Firebase + Vercel setup

## Already configured

- Firebase project: **rizal-game**.
- Primary controller: **rsegundo@addu.edu.ph**.
- The complete Firebase Web config and Realtime Database URL are saved in `.env.local`.
- `.firebaserc` points the Firebase CLI to `rizal-game`.
- `vercel.json` includes the Vite build settings and routes for `/host`, `/play`,
  and `/display`.

**The Firebase configuration is complete.** The remaining setup is to publish the
database rules, configure Vercel environment variables, and authorize your domain.

## 1. Realtime Database

Your database is already created in Singapore. Its configured URL is:

```dotenv
VITE_FIREBASE_DATABASE_URL=https://rizal-game-default-rtdb.asia-southeast1.firebasedatabase.app
```

An empty (`null`) Data tab is normal before you create the first game session.
Restart `npm run dev` if needed after environment changes.

## 2. Google sign-in

Under **Authentication → Sign-in method**, enable **Google** and choose a support
email. Under **Authentication → Settings → Authorized domains**, include:

- `localhost`
- `rizal-game.firebaseapp.com`
- `rizal-game.web.app`
- Your exact Vercel production hostname, such as `your-game.vercel.app`
- Your custom hostname if using one

Enter hostnames without `https://` or a path. Use the stable production URL for
the presentation. If you want Google login on a Vercel preview URL, that exact
preview hostname must be authorized too.

The app uses Firebase Google sign-in. Its OAuth client configuration is managed
by Firebase; you do not need a separate Client ID environment variable.

## 3. Publish the database rules

This step is required regardless of whether Vercel or Firebase hosts the site.
Vercel deploys the frontend; it does not publish Firebase database rules.

```powershell
firebase login
firebase deploy --only database --project rizal-game
```

Alternatively, paste `database.rules.json` into Realtime Database → Rules and click
**Publish**.

If the host page says Firebase access is blocked, use its **Copy Firebase rules**
button, paste those rules into that same Rules tab, click **Publish**, and reload
the host page. If even `/lobby` cannot be read, the expected public-read rules are
not active (or access is otherwise blocked); signing in again will not publish them.

If the CLI cannot find `rizal-game`, it is signed into a Google account without
access to this Firebase project. Use the Firebase console above, or sign the CLI
into the account that owns the project with `firebase login:add` before deploying.

After those rules are published, sign in to `/host` as **rsegundo@addu.edu.ph**.
The primary account gets access directly from its verified Google email.
**There is no UID lookup or manual `adminUsers` setup anymore.** Old UID-based
grants do not authorize accounts under these rules.

## 4. Deploy on Vercel

Import the project into Vercel with these settings:

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm install` |

In **Vercel → Project → Settings → Environment Variables**, add:

| Variable | Value |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Copy from `.env.local` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `rizal-game.firebaseapp.com` |
| `VITE_FIREBASE_DATABASE_URL` | `https://rizal-game-default-rtdb.asia-southeast1.firebasedatabase.app` |
| `VITE_FIREBASE_PROJECT_ID` | `rizal-game` |
| `VITE_FIREBASE_APP_ID` | `1:1089984031217:web:67d0cd9f304f29525abc50` |

Set them for **Production**; also set Preview/Development if you use those
environments. `.env.local` is gitignored and does not automatically travel with a
Git deployment. Vercel can import its contents into environment variables if you
prefer that workflow.

Deploy or **redeploy after changing environment variables**: Vite embeds these
values at build time. Then add the resulting Vercel hostname to Firebase’s
Authorized domains as described in step 2.

Use:

- Tablet: `https://your-production-hostname/host`
- Projector: `https://your-production-hostname/display`
- Representatives: `https://your-production-hostname/play`

The projector QR code automatically points to `/play` on the same hostname.
Live game data stays in Firebase, so Vercel redeploys do not erase scores.

### Firebase Hosting instead

You can use the free Firebase Hosting domain with the same app:

```powershell
npm run build
firebase deploy --only hosting,database --project rizal-game
```

Its live routes are `https://rizal-game.web.app/host`, `/display`, and `/play`.

## 5. Control-room management

Sign in as **rsegundo@addu.edu.ph** on `/host`.

1. **Setup → Create fresh session**. You can start with an empty roster and add
   representatives afterward, or paste `Group name, email@addu.edu.ph` lines.
2. **Manage questions** adds/edits/deletes questions through forms. Select the
   correct choice using its radio button. JSON import remains available in Setup.
3. **Authorized emails & groups** adds exact school emails, renames groups,
   changes colors, replaces representatives, and revokes player access.
4. **Controllers** adds/removes other school emails with control-room access.

### Reset after trying the game

Use **Reset session** beside Setup in the control-room header and confirm.

- Starts a fresh session at zero points, with all questions marked unused.
- Ends the old session and cancels any unfinished round.
- Keeps the question bank, exact-email whitelist, group names/colors, and controllers.
- Connected phones and the projector automatically move back to the waiting screen.
- Practice mode is switched off on the controller that performs the reset.
- Earlier sessions remain saved in Firebase; reset does not delete archived history.

Use **Create fresh session** in Setup when you want to apply a different title or
bulk roster as well. Use **Practice round** for a zero-point rehearsal.

### Controller permissions

- The initial controller is **rsegundo@addu.edu.ph only**.
- Only that primary account can add or remove controllers.
- Added controllers can run rounds and manage questions and representatives.
- Removing a controller takes away its database permissions and signs it out of
  the control room when the live access update arrives.
- The primary account is permanent and cannot be removed through the app.
- Controller access is separate from representative/player authorization.

### Groups and rounds

- Renaming a group preserves its group ID and earned points, and syncs to phones
  and the projector immediately.
- Changing an email releases the old device; the replacement uses the same group
  and saved scores. Email authorization changes wait until a running round ends.
- Revoking an email signs it out of `/play`, and rules deny further submissions.
- A launched round snapshots its private answer key, so later question edits do
  not change that round’s correct answer.
- Firebase Authentication can authenticate an identity before the app checks
  admission. The exact-email lists and server-enforced rules determine game
  access; rejected identities may still appear under Authentication → Users.

## 6. During the presentation

- Keep `/host` visible on the tablet during each round. The host browser publishes
  results; Firebase persists them. It recovers saved submissions on reconnect.
- Open `/display` on the projector laptop and click the sound icon once to enable
  audio. Use its fullscreen button if wanted.
- Select a question → **Prepare** → switch the laptop from slides to `/display`
  → **Play** on the tablet.
- Phones show the animated intro, then choices for 20 seconds. Client response
  time determines ranking; a fixed 2-second upload grace precedes results.
- Return to waiting from the host UI, then switch the laptop back to the slides.
- The tablet does not automatically switch laptop windows or PowerPoint slides.
- The group’s circular-arrow control releases a device for a phone switch.
- **Void** removes a round’s points; replaying creates a new round.

## Audio

Original audio files are in `public/assets/audio/`, including `quiz-intro.wav`.
To replace the four-second intro with your own file, add:

```dotenv
VITE_ROUND_INTRO_URL=/assets/audio/custom-intro.mp3
```

Place that file in `public/assets/audio/`, then rebuild/redeploy. On Vercel, add
the optional environment variable there too. Phones are silent; the projector
plays the cues.

## Free Firebase plan

Stay on **Spark**. The app uses Authentication and Realtime Database; no paid
Firebase backend or Cloud Functions are required.

- Realtime Database: 100 concurrent connections, 1 GB stored, 10 GB downloaded/month.
- Count extra tabs, the tablet, and projector among connections.
- Countdowns animate locally rather than writing timer ticks to the database.
- Static images and audio are served by your frontend host from `/assets/`.
- Keep actual answer keys in Firebase, not a public question-bank JSON file.
