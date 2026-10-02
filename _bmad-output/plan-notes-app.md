---
title: "Build a minimal cross-device notes app"
type: feature
ticket: ""
created: "2026-10-02"
status: built
baseline_revision: "NO_COMMIT"
route: full
route_source: auto
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
context: []
---

## Plain-Language Solution

One website on both devices. Firebase handles site hosting, login, and note storage. Users only see their own notes. No app or server needed.

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The user needs to write a note on an Android phone and read the same private note from a web browser on any computer, without Android Studio or a costly hosting setup.

**Approach:** Build a mobile-first React and TypeScript web app with Vite, Firebase email/password authentication and Cloud Firestore rules that scope notes to their owner. Deploy the static app with Firebase Hosting on the no-cost Spark plan; provide setup steps because the user must create a Firebase project and supply its web configuration.

## Boundaries & Constraints

**Always:** A signed-in user's notes are available from another device after signing in; only that user can read or change their notes; missing cloud configuration is explained clearly; enforce access with Firestore Security Rules, not UI filtering; keep the Firebase project on the Spark plan and do not link billing.

**Never:** Native Android code, Android Studio, paid-only services, shared notes, rich text, attachments, offline synchronization, or features beyond basic note create/read/edit/delete and authentication.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Sign up or sign in | Valid email and password | Authenticated notes view; notes are scoped to the account | Show provider error without losing entered email |
| Save a note | Non-empty title or body | Note persists in Firestore and appears in the list | Keep editor contents and show retryable error |
| Empty note | Blank title and body | No note is created or saved | Explain that a note needs content |
| Delete a note | User confirms delete | Note is removed from the user's list and database | Keep the note visible and show an error if deletion fails |
| Cloud is not configured | Required Firebase web configuration is absent | Show setup guidance; do not imply that notes are syncing | App remains buildable and does not make a broken network request |
| Another account accesses a note | Different authenticated user requests another user's path | No note data is returned or changed | Enforced by Firestore Security Rules, not just UI filtering |

</frozen-after-approval>

## Code Map

- `package.json` and `package-lock.json` -- React/Vite/Firebase dependencies, emulator, test, and deployment commands.
- `src/App.tsx` and `src/styles.css` -- responsive Russian sign-in and notes interface.
- `src/lib/firebase.ts` and `src/lib/notes.ts` -- Firebase client, auth/database connection, and owner-scoped CRUD.
- `firestore.rules` and `firebase.json` -- Firestore owner-only rules and Firebase Hosting/emulator configuration.
- `.env.local` -- ignored local Firebase Web App configuration; never commit or paste its contents. `.env.example` documents required names.
- `README.md` -- Firebase setup, local run, security and deployment instructions.
- `skills-lock.json`, `_bmad/`, `.agents/`, `.claude/`, `.vscode/` -- existing workspace/BMad setup; preserve them.

## Tasks & Acceptance

**Execution:**
- [x] `package.json`, `index.html`, `vite.config.ts`, `tsconfig*.json` -- create the React/TypeScript Vite app shell and scripts -- provide a small static build suitable for Firebase Hosting.
- [x] `src/` -- implement responsive sign-in, note list, create/edit/delete and clear loading, empty, error, and missing-configuration states -- support the phone-to-computer workflow.
- [x] `src/lib/firebase.ts`, `.env.example` -- configure the browser SDK from Vite environment variables -- make it easy to connect the user's Firebase web app without committing its config.
- [x] `firestore.rules`, `firebase.json` -- configure per-user Firestore access and static Hosting for the production build -- protect note data and support deployment.
- [x] `README.md`, `.gitignore` -- document local setup, Firebase Auth/Firestore setup, Spark quotas, Firebase CLI/GitHub deployment, and staying off the paid Blaze plan -- make external setup reproducible and avoid billing surprises.

**Acceptance Criteria:**
- Given the app is configured with a Firebase project, when a user signs up and signs in on a phone browser, then they can create, edit, and delete plain-text notes.
- Given the same user signs in from a computer browser, when the notes view loads, then the same notes are visible from Firestore.
- Given a second account is signed in, when it requests the first account's note path, then Firestore Security Rules deny access to those notes.
- Given required Firebase web configuration is absent, when the app loads, then it explains the missing setup and does not claim that notes are synced.
- Given a production build is requested, when `npm run build` runs, then TypeScript/Vite complete successfully and emit deployable static assets.
- Given a phone-sized viewport, when the user edits a note, then controls remain readable, reachable, and usable without horizontal scrolling.

## Implementation Notes

- The initial app snapshot is on `main` at commit `9cc51df`, synced with `origin/main`; its original build baseline was `NO_COMMIT`. The Google sign-in follow-up is currently uncommitted. Do not commit or push without the user's explicit request.
- 2026-10-03 handoff: Firebase project `mobile-web-notes` is on Spark; Google Analytics was disabled; Email/Password Auth is enabled; default Firestore database is in `europe-central2` (Warsaw); owner-only `firestore.rules` are deployed; Hosting is live at `https://mobile-web-notes.web.app/`.
- Firebase Web App values are in ignored `.env.local`; do not publish their contents or replace the file. Firebase CLI is authenticated locally as the project owner.
- Google sign-in follow-up: the owner enabled Google in Firebase Authentication. The update with mobile redirect sign-in and a signed-in **Link Google** action is deployed; linking an existing password account preserves the Firebase UID and notes. **Pending manual check:** sign into the existing account by email/password, link the same Google account, verify the notes remain visible, then sign out and try **Continue with Google** on another device.
- User confirmed that two notes added on the computer are visible on both phone and computer when signed into the same account. Cross-device sync is manually verified; edit/delete behavior on mobile remains unverified.
- The original app snapshot and Firebase project bootstrap are on GitHub. Google sign-in code, README updates, and this follow-up note are local and not yet in GitHub.
- Verified for Google sign-in update: 13 UI tests pass, TypeScript/Vite production build passes, and the deployed page displays the Google option. Firestore rules were unchanged; prior rule tests passed (2 cases).

## Plan Change Log

## Review Triage Log

- medium | patch | `src/App.tsx`: A failed Firestore subscription looked like an empty account while sync remained marked active; added a distinct load-error state and regression coverage. Verified by `npm test` (10 passed).

## Architecture

- **Web app:** React/Vite builds a static single-page app. Firebase Hosting serves its files over HTTPS through Firebase's CDN.
- **Sign-in:** Firebase Authentication. Email/password and linked Google sign-in resolve to the same Firebase user ID.
- **Notes database:** Cloud Firestore Standard in `europe-central2` (Warsaw). Notes live at `/users/{uid}/notes/{noteId}`; Firestore Security Rules restrict access to the matching signed-in user.
- **Request path:** Phone/computer browser → Firebase Hosting CDN for app files; browser → Firebase Auth and Firestore APIs for sign-in and notes. There is no separate application server.
- **Privacy boundary:** The Hosting CDN serves static app assets, not note contents. Private note reads/writes go to Firestore and are checked by Security Rules.

## Design Notes

Use a static React SPA rather than Next.js: the app needs no server rendering, and Vite produces a straightforward static deployment. Cloud storage is necessary for cross-device persistence; browser `localStorage` alone would strand notes on one device. A note has an id, title, body, and timestamps, stored under `/users/{uid}/notes/{noteId}`. Firestore rules allow access only when the authenticated UID matches the path UID. Use explicit save to make persistence visible and avoid autosave races; mobile uses a list-to-editor flow and desktop may keep the list beside the editor. Firebase is chosen over Supabase because the official Supabase pricing page says free projects pause after one inactive week; Firebase Spark provides a single-provider static host, email/password auth, and Firestore no-cost quotas without requiring payment details to start most features. Spark has hard quotas: Firestore includes 1 GiB, 50,000 reads/day, 20,000 writes/day, and 20,000 deletes/day; Firebase Hosting includes 10 GB storage and 10 GB/month transfer. Exceeding a Spark quota can disable that service until reset. Do not link billing or upgrade to Blaze for this personal MVP.

## Verification

**Commands:**
- `npm run build` -- expected: TypeScript and Vite finish successfully.
- `git diff --check` -- expected: no whitespace errors in changed tracked content.

**Manual checks (if no CLI):**
- With a configured Firebase project, sign up, create/edit/delete, and sign in with the same account in a second browser; notes should persist.
- Sign in with a second account and verify the first account's notes do not appear.
- Check the empty notes state and missing-Firebase-configuration state at a narrow mobile viewport.