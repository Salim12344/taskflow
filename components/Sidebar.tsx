"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { groupIcon } from "@/lib/group-icon";
import { Avatar } from "@/components/Avatar";
import { isOnline } from "@/lib/presence";

type Group = { _id: string; name: string };
type DmThread = { threadId: string; other: { id: string; name: string; avatarUrl: string | null; lastActiveAt: string | null } | null; unread: number };
type Me = { name: string; accountType: string; avatarUrl: string | null };

function NavRow({ href, label, active, icon, trailing }: { href: string; label: string; active: boolean; icon?: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      <div
        className={active ? "" : "nav-row"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 13.5,
          color: active ? "var(--color-accent-300)" : "inherit",
          background: active ? "color-mix(in srgb, var(--color-accent) 14%, transparent)" : "transparent",
        }}
      >
        {icon}
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        {trailing}
      </div>
    </Link>
  );
}

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [groups, setGroups] = useState<Group[]>([]);
  const [dms, setDms] = useState<DmThread[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  function loadNotifs() {
    api<{ unreadCount: number }>("/api/notifications")
      .then((d) => setUnreadNotifs(d.unreadCount))
      .catch(() => {});
  }

  function loadGroups() {
    api<{ groups: Group[] }>("/api/groups")
      .then((d) => setGroups(d.groups))
      .catch(() => setGroups([]));
  }

  function loadDms() {
    api<{ threads: DmThread[] }>("/api/dm")
      .then((d) => setDms(d.threads))
      .catch(() => setDms([]));
  }

  function loadMe() {
    api<{ user: Me }>("/api/me")
      .then((d) => setMe(d.user))
      .catch(() => {});
  }

  useEffect(loadGroups, [pathname]);
  useEffect(loadMe, []);
  useEffect(onNavigate, [pathname]);

  useEffect(() => {
    loadNotifs();
    const interval = setInterval(loadNotifs, 20_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    loadDms();
    const interval = setInterval(loadDms, 5_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    window.addEventListener("taskflow:groups-changed", loadGroups);
    window.addEventListener("taskflow:profile-changed", loadMe);
    window.addEventListener("taskflow:notifications-changed", loadNotifs);
    return () => {
      window.removeEventListener("taskflow:groups-changed", loadGroups);
      window.removeEventListener("taskflow:profile-changed", loadMe);
      window.removeEventListener("taskflow:notifications-changed", loadNotifs);
    };
  }, []);

  return (
    <aside
      style={{
        width: 264,
        flex: "none",
        display: "flex",
        flexDirection: "column",
        background: "var(--color-surface)",
        borderRight: "1px solid var(--color-divider)",
        height: "100dvh",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 18px 14px" }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--color-accent-700)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-100)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>
        </div>
        <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 16 }}>TaskFlow</div>
      </div>

      {session?.user && (
        <Link href="/settings" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="nav-row" style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", margin: "0 10px 12px", background: "var(--color-bg)", borderRadius: 8 }}>
            <Avatar name={me?.name ?? session.user.name ?? "?"} avatarUrl={me?.avatarUrl} size={26} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{me?.name ?? session.user.name}</div>
              <div style={{ fontSize: 11, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
                {session.user.accountType === "organization" ? "Organization" : "Individual"}
              </div>
            </div>
          </div>
        </Link>
      )}

      <div style={{ padding: "2px 20px 6px", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>
        Overview
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 10px" }}>
        <NavRow href="/dashboard" label="Dashboard" active={pathname === "/dashboard"} />
        <NavRow href="/search" label="Search" active={pathname === "/search"} />
        <NavRow
          href="/notifications"
          label="Notifications"
          active={pathname === "/notifications"}
          trailing={
            unreadNotifs > 0 ? (
              <span style={{ background: "var(--color-accent)", color: "var(--color-bg)", fontSize: 10, fontWeight: 600, minWidth: 17, height: 17, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px", flex: "none" }}>
                {unreadNotifs}
              </span>
            ) : undefined
          }
        />
        <NavRow href="/review-queue" label="Tasks by status" active={pathname === "/review-queue"} />
        {session?.user?.accountType === "organization" && (
          <NavRow href="/organization" label="Organization" active={pathname === "/organization"} />
        )}
      </div>

      <div style={{ padding: "16px 20px 6px", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>
        Groups
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 10px", overflowY: "auto" }}>
        {groups.map((g) => {
          const icon = groupIcon(g.name);
          return (
            <NavRow
              key={g._id}
              href={`/groups/${g._id}`}
              label={g.name}
              active={pathname === `/groups/${g._id}`}
              icon={
                <span style={{ width: 20, height: 20, borderRadius: 6, background: icon.bg, color: icon.fg, fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                  {icon.letter}
                </span>
              }
            />
          );
        })}
        {groups.length === 0 && (
          <div style={{ fontSize: 11.5, padding: "4px 10px", color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>
            No groups yet.
          </div>
        )}
      </div>

      <div style={{ padding: "16px 20px 6px", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>
        Direct messages
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 10px" }}>
        {dms.length === 0 && (
          <div style={{ fontSize: 11.5, padding: "4px 10px", color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>
            Message a member from a group&rsquo;s Members list.
          </div>
        )}
        {dms.slice(0, 3).map((d) => (
          <NavRow
            key={d.threadId}
            href={`/messages/${d.threadId}`}
            label={d.other?.name ?? "Unknown"}
            active={pathname === `/messages/${d.threadId}`}
            icon={<Avatar name={d.other?.name ?? "?"} avatarUrl={d.other?.avatarUrl} size={20} fontSize={9.5} online={isOnline(d.other?.lastActiveAt ?? null)} />}
            trailing={
              d.unread > 0 ? (
                <span style={{ background: "var(--color-accent)", color: "var(--color-bg)", fontSize: 10, fontWeight: 600, minWidth: 17, height: 17, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px", flex: "none" }}>
                  {d.unread}
                </span>
              ) : undefined
            }
          />
        ))}
        {dms.length > 3 && <NavRow href="/messages" label="See all messages" active={pathname === "/messages"} />}
      </div>

      <div style={{ flex: 1 }} />
      <div style={{ padding: "0 10px 8px" }}>
        <NavRow href="/settings" label="Settings" active={pathname === "/settings"} />
      </div>
      <div style={{ padding: "0 16px 16px" }}>
        <button className="btn btn-secondary btn-block" onClick={() => signOut({ callbackUrl: "/login" })}>
          Log out
        </button>
      </div>
    </aside>
  );
}
