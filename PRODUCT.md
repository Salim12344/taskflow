# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: teams and departments inside a business organization — an org owner who oversees every group under their org, group admins who run day-to-day work (create projects, assign and review tasks), and members who execute assigned tasks. Trading/investment groups and families can use the same mechanics but are secondary, opportunistic audiences, not who the permission model is designed around.

## Product Purpose

TaskFlow combines invite-only group chat with structured projects and tasks, so a group's work happens in one place instead of being lost in a scrolling chat thread. Success means every task's status is trustworthy: what's marked "done" was actually verified, not just claimed.

## Positioning

The mechanism a neighboring group-chat or generic task tool doesn't have: an admin-reviewed task workflow (todo → in progress → pending review → done, with reject-and-resubmit) combined with per-task management delegation — a specific admin can hand off full control (edit/reassign/approve/reject/delete) of one task to another admin, narrowing who's accountable for it instead of leaving it to "any admin." The org owner sits above all of this as a permanent observer with emergency override, never the default actor.

## Operating Context

Used from desktop and mobile browsers (installable as a PWA). Groups are invite-only — no public discovery, joined via email invite or a shareable link. Within a group: a Projects tab (Kanban board across the four task states), a Chat tab (group chat with @mentions, replies, voice notes, file/photo attachments), and a Members tab. Each task also has its own private chat thread scoped to the assignee and whoever currently manages it. Direct messages exist between people who share a group (or, for an org owner, anyone under her org). Near-real-time via polling (~1.5s in active chats), not WebSockets.

## Capabilities and Constraints

- Auth: email/password credentials plus Google OAuth.
- Data: MongoDB Atlas via Mongoose.
- File storage: Vercel Blob (voice notes, photos, documents attached to any chat).
- Hosting: Vercel, Next.js App Router.
- Org-gated group creation: only an org owner, or an individual explicitly granted "group creator" permission by an org owner, can create a group.
- Email delivery is not wired up (invite/notification emails are stubbed, not sent) — undecided whether/when to add.
- Deadline reminders run once daily via Vercel Cron; no other scheduled jobs.
- No public search-engine discovery of groups or content by design.

## Brand Commitments

Name: TaskFlow. Homepage tagline: "Run your team's work without the group-chat chaos."

## Evidence on Hand

None. All current data (organizations, groups, tasks, chat history) is synthetic seed data for development/demo purposes — no real customers, testimonials, or case studies exist yet. Future work must not fabricate any.

## Product Principles

- Accountability over speed: the review step exists specifically to catch work that isn't actually finished, even though it adds friction.
- Authority is narrow and explicit: default task control belongs to whoever created/assigned it, not "any admin" — delegation is opt-in, not ambient.
- Oversight isn't control: the org owner sees everything under her org but only acts on a task when she's its actual manager or in her permanent emergency-override capacity.
- Invite-only by default: no public discovery of groups, members, or content.

## Accessibility & Inclusion

No accessibility standard has been explicitly required yet.
