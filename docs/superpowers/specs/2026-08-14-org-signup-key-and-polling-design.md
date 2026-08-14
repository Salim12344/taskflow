# Org signup key + app-wide polling

## 1. Org signup key

### Problem
Today, joining an org happens only through per-group invite links. There's no self-serve way for a new hire to say "I work at this company" without an admin first sending them a group-specific invite. The user wants a standing org-level key, separate from the business registration number, that a new signup can enter to attach themselves to an existing org.

### Data model changes
- `Organization`: new field `signupKey: string` (unique, 8-char uppercase alphanumeric, e.g. `X7K2QPLM`). Generated at org creation. Only the org owner can view or regenerate it from the org page; regenerating immediately invalidates the old key (anyone mid-signup with the stale key gets "Invalid organization key").
- `User`: new field `orgId: ObjectId | null`, `ref: "Organization"`. Set when a user signs up via an org key. Stays `null` for individuals and for org owners (owners are already tracked via `Organization.ownerId`).
- **`accountType` is unaffected** — a key-joiner's `accountType` stays `"individual"`. This is load-bearing: `accountType === "organization"` is what currently grants implicit-admin rights across every group in the org (see `isOrgAccount` checks throughout the group/task permission code). A key-joiner must not inherit that.

### Signup flow
- Add a third path to the signup form alongside the existing "Individual" and "Create an organization" options: **"Join an organization"**.
- That path shows one field: the org key. On submit, `POST /api/signup` looks up `Organization.findOne({ signupKey })`; no match → 400 "Invalid organization key." Match → create the user with `orgId` set, `accountType: "individual"`, no group memberships.

### Post-signup landing
- A user with `orgId` set but zero group memberships doesn't fit the existing dashboard (which assumes either group membership or org ownership). They land on a lightweight "You're in — an admin will add you to a group soon" screen instead, until their first group membership exists (checked the same way the dashboard already checks "do I have any groups").

### Admin side
- New "Org members" section on the org page, visible to the org owner: lists `User.find({ orgId: org._id })` — name, email, joined date, and whether they're in any group yet. Each row gets a shortcut into the existing per-group invite/add-member flow.
- Regenerate-key control lives on the same page, owner-only (matches existing owner-only patterns elsewhere in the org page).

### Explicitly out of scope
- Joining an org via key from within the app later (e.g. a settings page) — signup-only for now.
- Multiple/named keys, expiring keys — one standing key per org, regenerate-on-demand covers the "it leaked" case.
- No change to per-group invite links; they remain the way admins add an org member (or anyone) to a specific group.

## 2. App-wide polling

### Problem
Chat pages (group chat, DM threads, task chat), the DM inbox, and the sidebar DM list already poll every 1.5–5s so they feel live. Every other data page (dashboard, Kanban board, review queue, notifications, org page, and the group page's Members/Projects/Activity tabs) is fetch-once-on-mount — a teammate's change doesn't show up until the viewer manually reloads. The user wants the whole app to feel uniformly instant, not chat-fast-and-everything-else-slow.

### Approach
Standardize every data page still using a one-shot `useEffect` fetch to the same 1.5s `setInterval` pattern already used by the chat pages: keep the existing one-shot load call, wrap it in `setInterval(loadFn, 1500)`, clear on unmount. This is a mechanical, page-by-page change — no new shared abstraction needed since each page's fetch/state shape already differs and the existing chat pages already establish the pattern inline.

Pages to convert:
- Dashboard
- Project page (Kanban board)
- Review queue
- Notifications
- Organization page (including the new org-members list from part 1)
- Group page's Members, Projects, and Activity tabs (Chat tab already polls; only poll the tab that's currently active, same as the group page's existing chat-tab-only polling pattern)
- DM inbox (`messages/page.tsx`) and sidebar DM list bumped from their current 3–5s down to 1.5s

Not converted (nothing changes from someone else's action while the page is open, so polling would be pure waste):
- new-task form, group invite page, settings page, search page

### No-UI-bugs requirement
Silent background refetches must never be visible as a glitch. Concretely, for every page converted above:
- No loading spinner/skeleton flash on refetch — only show the initial-load spinner once, before first data arrives; subsequent polls swap data in place.
- No scroll-position reset. Any page with a scrollable list (Kanban columns, notifications, org members) must preserve the user's scroll position across a poll-triggered re-render — same principle already fixed for chat via `use-stick-to-bottom.ts`, applied case-by-case (most of these lists don't auto-scroll at all today, so the risk is a full remount resetting scroll — verify keys are stable so React reconciles in place rather than remounting).
- No focus loss. If a poll lands while a user has a dropdown/input focused on one of these pages (e.g. review-queue's status filter, org page's regenerate-key confirm), the refetch must not steal focus or close an open menu/modal.
- No layout shift/flicker from a stale-then-fresh count mismatch (e.g. review queue's per-status counts) — acceptable since the counts simply update in place, not acceptable if it causes a reflow that jumps other content.
- Verify each converted page manually (dev server, browser) after implementation: trigger a change from a second session/tab and confirm the first tab picks it up within ~1.5s with no visible glitch, then also confirm normal interaction (scrolling, typing, opening a menu) is undisturbed while polling continues in the background.

## Testing
No formal test suite in this project (verified via `npm run build` / `npx tsc --noEmit` pattern used throughout). Verification for this change is: typecheck clean, build clean, and the manual no-glitch pass described above for each converted page.
