# TaskFlow — Handover Doc

Last updated: 2026-07-27

A group + task management app (WhatsApp-style groups/chat + Asana-style projects/tasks), built with Next.js App Router, MongoDB Atlas, and NextAuth.

## Live URLs

- **Production**: https://taskflow1-fawn-delta.vercel.app
- **GitHub repo**: https://github.com/Salim12344/taskflow
- **Vercel project**: `taskflow1` (team `salim-aliyus-projects`)
- **Local dev**: `npm run dev` → http://localhost:3000

## Login credentials

### Seeded test accounts — password `Seed12345!` for all of them

| Email | Role |
|---|---|
| ada@nimbus.studios | Org owner — Nimbus Studios |
| raj@vertex.io | Org owner — Vertex Robotics |
| priya@solstice.media | Org owner — Solstice Media |
| mia@example.com | Granted "group creator" under Nimbus — created & admins Nimbus Marketing Pod |
| sam@example.com | Granted "group creator" under Vertex — created & admins Vertex R&D Lab |
| chloe@example.com | Member in Nimbus Product Team, **admin** in Nimbus Design Guild (per-group roles) |
| diego@example.com | Promoted admin of Vertex Field Ops (not the owner) |
| ben, eve, frank, grace, noah, olivia @example.com | Plain members spread across groups |

Covers: tasks in all 4 statuses, subtasks, rejection history, an **accepted** task-management delegation (Diego manages "Safety inspection checklist"), a **pending, unaccepted** delegation request (Raj → Diego on "Firmware update rollout" — good for testing the accept/decline UI), group chat + task chat messages, DM threads, an @mention.

### Other accounts

- `demo@taskflow.dev` / `Demo12345!` — original manual test account, now an org owner ("Demo Admin's Organization").
- Your own account (`salimaliyuu00@gmail.com`) — you know that password; it was migrated to an org owner too when independent-group creation was locked down.

## Environment variables

See `.env.local.example` for the full list. The important ones:
- `MONGODB_URI` — Atlas connection string, must include `/taskflow` as the db name.
- `AUTH_SECRET` — real one is set on Vercel; local `.env.local` has a dev placeholder.
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — **not configured**. "Continue with Google" will error until these are added (both locally and on Vercel).
- `RESEND_API_KEY` — **not configured**. Email sending is stubbed to `console.log` (`lib/email.ts`).

⚠️ **Local dev and production currently share the same Atlas database.** Anything you test locally writes to live data. This was flagged as a real gap to fix (see below) but hasn't been — be careful running scripts against it.

## Redeploying

```bash
git push                                   # push to GitHub
npx vercel --prod --token <VERCEL_TOKEN>   # deploy to Vercel prod
```
A Vercel API token was used during this build session (not stored anywhere in the repo). You'll need your own if you want to redeploy from the CLI, or just let Vercel's GitHub integration auto-deploy on push (check if that's connected in the Vercel dashboard).

## Account & permission model

Every `User` has `accountType: individual | organization` — this only means "do they own an `Organization` doc." It has nothing to do with what they can do in any given group.

**Three tiers of "who can create a group":**
1. **Org owner** — owns an `Organization` (unique 6-digit `regNumber`). Can create groups, and is *implicitly* admin on every group under their org (checked live, not stored as a membership row).
2. **Granted "group creator"** — an `individual` account the owner explicitly lists in `Organization.groupCreators[]` (managed from `/organization`). Can create their own group and is auto-admin of it — no rights over other groups in the org.
3. **Plain individual** — can't create anything, only joins via invite.

**Per-group roles** (`GroupMember.role: admin | member`) are separate from all of the above — same person can be admin in one group and a plain member in another.

**Task management delegation** (newer feature): a task's `reviewerId` field, once accepted via a request/accept/decline flow, means *only* that specific admin (or the org owner, as a permanent fallback) can edit/reassign/delete/approve that task — other admins lose those rights on it. See `lib/permissions.ts` → `canManageTask`.

**Guardrails enforced server-side** (not just UI):
- A group always keeps ≥1 admin — accounts for the org owner's implicit admin status, not just explicit `GroupMember` rows (`hasAnotherAdmin` in `lib/permissions.ts`).
- Admin can't leave/self-demote while the group has pending-review tasks.
- Admin **removing** a member auto-unassigns their tasks + notifies other admins. **Promoting** a member with active tasks is *blocked* (not auto-unassigned) until those tasks are cleared — asymmetric on purpose.
- Tasks can never be assigned to an admin, including self.
- Org owner can't be removed/demoted from a group they own (their admin rights don't come from the membership row anyway).
- DMs only start between people who already share a group.
- Soft-deleted groups cascade — their projects/tasks stop being reachable, not just hidden from lists.

## Data model

Mongoose models in `models/`: `User`, `Organization`, `Group`, `GroupMember`, `InviteLink`, `Project`, `Task`, `TaskHistory`, `TaskChatMessage`, `GroupMessage`, `DMThread`, `DMMessage`, `ActivityLog` (model exists, **never written to** — no activity log feature built), `Notification`, `TypingIndicator`.

Notable fields:
- `Task.reviewerId` / `Task.pendingReviewDelegation` — the management-delegation feature.
- `Task.reviewerId` persists across reject→resubmit cycles (it's a standing assignment, not per-cycle).
- `User.avatarUrl` — base64 data URI, resized client-side before upload (not a real blob store — see gaps below).
- `User.lastActiveAt` / `showOnlineStatus` — presence; heartbeat every 30s from any open tab (`app/api/me/heartbeat`); masked server-side (`lib/presence.ts` → `maskPresence`) when the user opts out in Settings.
- `Notification.text` / `description` — computed at creation time (see `lib/notify.ts`), not resolved via joins at read time.

## Feature status

### Built
- Auth: credentials + Google OAuth config (Google needs real env vars to actually work), individual/org signup with unique 6-digit org registration number.
- Groups: create (org-gated), invite (email + link), full member management with all the guardrails above, onboarding checklist.
- Projects & tasks: full CRUD, Kanban board, status workflow (todo → in progress → pending review → done, with reject-to-in-progress + full rejection history), subtasks, recurrence (generates next instance on approval), task management delegation.
- Chat: group chat (with @mentions, autocomplete, highlighted mention bubbles, "Seen by N" + tap-to-expand modal), task chat (viewable by any admin, postable only by assignee + current manager), DMs (member-list-only entry point, "Seen at [time]", 3-item sidebar cap + full inbox).
- Presence: online/last-seen everywhere (member lists, DM inbox/thread, sidebar), privacy toggle in Settings.
- Typing indicators: group chat + DMs, TTL-backed (not in-memory, so it's correct across serverless).
- Notifications: real inbox at `/notifications`, sidebar bell with live unread badge, covers task lifecycle + delegation + mentions + member-joined + tasks-unassigned.
- Review queue: admin's pending-review tasks grouped by group.
- Profile pictures, PWA (installable, manifest + generated icons + apple-touch-icon).

### Explicitly NOT built (flagged when skipped, not silently dropped)
- **Email sending** — Resend integration is a `console.log` stub (`lib/email.ts`). Nobody actually receives emails for any notification trigger.
- **Activity log** — model exists, nothing writes to it.
- **Search** across tasks/messages/members.
- **Calendar view** for projects (Kanban only).
- **Recurring due-date reminder digest** (would need Vercel Cron).
- **Real file attachments** — schema exists (`{ url, name, type, size }`) but no blob storage (Vercel Blob/S3) wired up; nothing can actually be uploaded as an attachment.
- **Voice/video calls** — deferred per spec, out of scope entirely for now.
- **Tests** — zero automated coverage anywhere.

### Known infra gaps (raised during a "production standard" review, not yet fixed)
- Local dev and production share one Atlas database (see warning above).
- No input validation library (zod etc.) on API routes — most rely on Mongoose CastErrors turning into generic 500s rather than clean 400s.
- No rate limiting on signup/login.
- No CI (typecheck/build only ever run manually during this session).
- No error monitoring (Sentry etc.), no configured Atlas backups.

## Dev environment quirks worth knowing

- **Windows + Node DNS bug**: Node's resolver occasionally fails to reach Atlas (`querySrv ETIMEOUT`) even though the OS resolver works fine. Fixed in `lib/db.ts` by pinning Node's DNS to `8.8.8.8`/`1.1.1.1` on `win32` only — doesn't touch the Linux Vercel deployment.
- **Mongoose model caching**: editing a schema file requires a **full dev server restart** (not just a save) — Mongoose registers models by name for the life of the Node process, so a stale schema can silently linger otherwise.
- Deliberate simplifications are marked with `// ponytail:` comments in the code — grep for that to find every known shortcut and its stated upgrade path.

## If you're picking this up cold

1. Read this file, then skim `PROJECT_SPEC.md` for the original product spec (some of it — e.g. group creation being open to individuals — has since been intentionally overridden; this doc reflects the current actual behavior).
2. `lib/permissions.ts` is the single source of truth for every authorization rule — read it before touching any API route.
3. Log in as one of the seeded accounts above and click around — the seed data is deliberately built to exercise every permission tier and feature.
