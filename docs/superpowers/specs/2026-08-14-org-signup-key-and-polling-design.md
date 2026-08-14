# Org signup key, admin permissions, and app-wide polling

## 1. Org signup key

### Problem
Today, joining an org happens only through per-group invite links. There's no self-serve way for a new hire to say "I work at this company" without an admin first sending them a group-specific invite. The user wants a standing org-level key, separate from the business registration number, that a new signup can enter to attach themselves to an existing org.

### Data model changes
- `Organization`: new field `signupKey: string` (unique, 8-char uppercase alphanumeric, e.g. `X7K2QPLM`). Generated at org creation. Only the org owner can view or regenerate it from the org page; regenerating immediately invalidates the old key (anyone mid-signup with the stale key gets "Invalid organization key").
- `User`: new field `orgId: ObjectId | null`, `ref: "Organization"`. Set when a user signs up via an org key. Stays `null` for individuals and for org owners (owners are already tracked via `Organization.ownerId`).
- **`accountType` is unaffected** — a key-joiner's `accountType` stays `"individual"`. This is load-bearing: `accountType === "organization"` is what currently grants implicit-admin rights across every group in the org (see `isOrgAccount` checks throughout the group/task permission code). A key-joiner must not inherit that.

### Signup flow
- Add a third path to the signup form alongside the existing "Individual" and "Create an organization" options: **"Join an organization"**.
- That path shows one field: the org key. On submit, `POST /api/signup` looks up `Organization.findOne({ signupKey })`; no match → 400 "Invalid organization key." Match → create the user with `orgId` set, `accountType: "individual"`, no group memberships, and **`signupStatus: "pending"`** (see Approval gate below — a guessed-but-valid-looking key must not grant instant access).

### Approval gate
A key alone isn't proof of identity — anyone who guesses or leaks a key could otherwise self-serve into the org. So joining via key doesn't grant access immediately:
- `User` gets a new field `signupStatus: "pending" | "approved" | "rejected"` (default `"approved"` for individual/org-owner signups — the gate only applies to key-joiners).
- A `pending` user can log in (so they get feedback) but sees only a "Your request to join **{org name}** is waiting on approval" screen — no dashboard, no data, nothing else in the app is reachable.
- **Who can approve**: the org owner, or any admin whose permission checklist (see part 2, below) includes "Approve new sign-ups." Approving sets `signupStatus: "approved"`, which drops them into the existing "awaiting group assignment" screen from the flow above. Rejecting sets `signupStatus: "rejected"`.
- **Rejected experience**: the account is not deleted. A rejected user who tries to log in sees "Your request to join **{org name}** was declined — contact an admin if you think this is a mistake" instead of the app shell. This is more transparent than silently vanishing the account, and gives them something concrete to act on.
- New "Pending sign-ups" section on the org page (visible to the owner and to admins with the approve permission): lists pending `User` rows for this org with Approve/Reject buttons per row.

### Admin side
- "Org members" section on the org page, visible to the org owner and to admins with the "see all org tasks" or "org-owner-level override" permission (both imply visibility into org membership): lists `User.find({ orgId: org._id, signupStatus: "approved" })` — name, email, joined date, and whether they're in any group yet. Each row gets a shortcut into the existing per-group invite/add-member flow.
- Regenerate-key control lives on the same page, owner-only (matches existing owner-only patterns elsewhere in the org page).

### Explicitly out of scope
- Joining an org via key from within the app later (e.g. a settings page) — signup-only for now.
- Multiple/named keys, expiring keys — one standing key per org, regenerate-on-demand covers the "it leaked" case.
- No change to per-group invite links; they remain the way admins add an org member (or anyone) to a specific group.
- Re-requesting after a rejection (e.g. "try again with a new key") — a rejected user needs an admin to intervene directly; no self-serve retry.

## 2. Admin permission checklist

### Problem
Every group admin has the same flat set of rights today. The org owner wants a way to deputize a specific admin with broader, org-wide reach — without handing over the ability to reshuffle who else is an admin, or to hand that same power to someone else. This needs to exist before the approval gate above is fully useful, since one of the three checklist items is "approve new sign-ups."

### Data model
- `GroupMember` (or a new org-scoped model — see decision below) gets a `permissions: string[]` field, subset of three fixed values: `"view_all_tasks"`, `"org_override"`, `"approve_signups"`. No open-ended/custom permissions — exactly these three, matching the user's explicit "no added abilities" instruction.
- **Where this lives**: group admin status is per-`GroupMember` row (one per group), but these are *org-wide* permissions, not group-scoped. Storing them on `GroupMember` would mean re-granting per group, which contradicts "org-wide reach." Instead: add `orgPermissions: string[]` directly to `User` (only meaningful when the user is an admin somewhere under an org). Simpler than a new model, and mirrors how `orgId` already lives on `User`.
- Only the org owner can read/write another user's `orgPermissions` — enforced the same way `signupKey` regeneration is owner-gated.

### The three permissions
1. **`view_all_tasks`** — read access to every task across every group in the org, not just groups they admin. Additive to `canManageTask`/`isGroupMember` checks: a user with this flag passes group-scoped read checks org-wide, but this is *view only* — it does not grant write/approve rights on tasks outside their own groups (that's `org_override`).
2. **`org_override`** — extends the org owner's existing task-level override (`canManageTask`'s `isOrgOwnerOfGroup` check) to this user: approve/reject/delete/task-chat-write on any task, org-wide, same permanent-emergency-fallback semantics the owner already has. **Explicitly excluded**: this does not extend to `isGroupAdmin`-gated member-management actions (removing or demoting another admin) — those stay owner-only, checked separately (see below), regardless of this flag.
3. **`approve_signups`** — can see and act on the "Pending sign-ups" list from part 1. Independent of the other two; an admin could have only this one.

### The "can't touch other admins" boundary
Regardless of `org_override`, a user is only allowed to demote/remove another *admin* (not a plain member — removing plain members stays a normal admin action, unaffected) if `isOrgOwnerOfGroup` is true for them — i.e., only the actual owner, checked via `Organization.ownerId`, never via `orgPermissions`. This is a hardcoded exception in `hasAnotherAdmin`/the member-removal route's admin-target check, not a fourth permission — nothing in `orgPermissions` can ever unlock it, closing off the "cascade the same power further" risk by construction rather than by convention.

Promoting a *plain member* to admin is unaffected by any of this — an `org_override` admin can already do that today (existing per-group admin promotion), and the promoted admin gets the plain default role with an empty `orgPermissions: []` — extended permissions never propagate automatically.

### UI
- On the org page's member list (the "Org members" section from part 1, or the existing per-group Members tab — whichever the org owner is looking at an admin from), an admin row gets a "Permissions" control, owner-only, opening a small checklist (3 checkboxes, the items above) that PATCHes `User.orgPermissions` for that user.
- Not visible/editable by anyone except the owner, including admins who themselves have `org_override` — matches the earlier decision that checklist control is owner-only, full stop.

### Explicitly out of scope
- Any permission beyond the three listed. No custom/named permission sets, no per-group grant of these (they're org-wide only).
- Extended-permission admins granting or revoking `orgPermissions` on anyone, including themselves.

## 3. App-wide polling

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
