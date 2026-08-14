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

function NavRow({ href, label, active, icon, trailing, collapsed }: { href: string; label: string; active: boolean; icon?: React.ReactNode; trailing?: React.ReactNode; collapsed?: boolean }) {
  return (
    <Link href={href} title={collapsed ? label : undefined} style={{ textDecoration: "none", color: "inherit" }}>
      <div
        className={active ? "" : "nav-row"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: collapsed ? "8px" : "8px 10px",
          justifyContent: collapsed ? "center" : "flex-start",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 13.5,
          color: active ? "var(--color-accent-300)" : "inherit",
          background: active ? "color-mix(in srgb, var(--color-accent) 14%, transparent)" : "transparent",
          position: "relative",
        }}
      >
        {icon}
        {!collapsed && <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>}
        {!collapsed && trailing}
        {collapsed && trailing && <span style={{ position: "absolute", top: 2, right: 2 }}>{trailing}</span>}
      </div>
    </Link>
  );
}

const NAV_ICONS = {
  dashboard: <path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  bell: <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />,
  tasks: <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />,
  org: <path d="M12 2l8 4v6c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-4z" />,
  messages: <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />,
};

function NavIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
      {children}
    </svg>
  );
}

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [groups, setGroups] = useState<Group[]>([]);
  const [dms, setDms] = useState<DmThread[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("taskflow:sidebar-collapsed") === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      localStorage.setItem("taskflow:sidebar-collapsed", c ? "0" : "1");
      return !c;
    });
  }

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

  const totalUnreadDms = dms.reduce((sum, d) => sum + d.unread, 0);
  const isMessagesActive = pathname === "/messages" || pathname.startsWith("/messages/");

  function unreadBadge(count: number) {
    if (count === 0) return undefined;
    return (
      <span style={{ background: "var(--color-accent)", color: "var(--color-bg)", fontSize: 10, fontWeight: 600, minWidth: 17, height: 17, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px", flex: "none" }}>
        {count}
      </span>
    );
  }

  return (
    <aside
      style={{
        width: collapsed ? 68 : 264,
        flex: "none",
        display: "flex",
        flexDirection: "column",
        background: "var(--color-surface)",
        borderRight: "1px solid var(--color-divider)",
        height: "100dvh",
        transition: "width .15s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: collapsed ? "18px 0 14px" : "18px 18px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: collapsed ? "center" : "flex-start", width: collapsed ? "100%" : "auto" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--color-accent-700)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-100)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>
          </div>
          {!collapsed && <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 16 }}>TaskFlow</div>}
        </div>
        {!collapsed && (
          <button
            onClick={toggleCollapsed}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="app-sidebar-collapse-btn"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "color-mix(in srgb, var(--color-text) 55%, transparent)", display: "flex" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /><path d="M9 6v12" /></svg>
          </button>
        )}
      </div>
      {collapsed && (
        <button
          onClick={toggleCollapsed}
          aria-label="Expand sidebar"
          title="Expand sidebar"
          className="app-sidebar-collapse-btn"
          style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 0 10px", color: "color-mix(in srgb, var(--color-text) 55%, transparent)", display: "flex", justifyContent: "center" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /><path d="M15 6v12" /></svg>
        </button>
      )}

      {session?.user && (
        <Link href="/settings" title={collapsed ? "Settings" : undefined} style={{ textDecoration: "none", color: "inherit" }}>
          <div className="nav-row" style={{ display: "flex", alignItems: "center", gap: 9, justifyContent: collapsed ? "center" : "flex-start", padding: collapsed ? "8px" : "8px 10px", margin: collapsed ? "0 10px 12px" : "0 10px 12px", background: "var(--color-bg)", borderRadius: 8 }}>
            <Avatar name={me?.name ?? session.user.name ?? "?"} avatarUrl={me?.avatarUrl} size={26} />
            {!collapsed && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{me?.name ?? session.user.name}</div>
                <div style={{ fontSize: 11, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
                  {session.user.accountType === "organization" ? "Organization" : "Individual"}
                </div>
              </div>
            )}
          </div>
        </Link>
      )}

      {!collapsed && (
        <div style={{ padding: "2px 20px 6px", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>
          Overview
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 10px" }}>
        <NavRow href="/dashboard" label="Dashboard" active={pathname === "/dashboard"} collapsed={collapsed} icon={<NavIcon>{NAV_ICONS.dashboard}</NavIcon>} />
        <NavRow href="/search" label="Search" active={pathname === "/search"} collapsed={collapsed} icon={<NavIcon>{NAV_ICONS.search}</NavIcon>} />
        <NavRow
          href="/notifications"
          label="Notifications"
          active={pathname === "/notifications"}
          collapsed={collapsed}
          icon={<NavIcon>{NAV_ICONS.bell}</NavIcon>}
          trailing={unreadBadge(unreadNotifs)}
        />
        <NavRow href="/messages" label="Messages" active={isMessagesActive} collapsed={collapsed} icon={<NavIcon>{NAV_ICONS.messages}</NavIcon>} trailing={unreadBadge(totalUnreadDms)} />
        <NavRow href="/review-queue" label="Tasks by status" active={pathname === "/review-queue"} collapsed={collapsed} icon={<NavIcon>{NAV_ICONS.tasks}</NavIcon>} />
        {session?.user?.accountType === "organization" && (
          <NavRow href="/organization" label="Organization" active={pathname === "/organization"} collapsed={collapsed} icon={<NavIcon>{NAV_ICONS.org}</NavIcon>} />
        )}
      </div>

      {!collapsed && (
        <>
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

          <div style={{ padding: "16px 20px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>
              Direct messages
            </span>
            <Link href="/messages" style={{ fontSize: 10.5, color: "var(--color-accent-300)", textDecoration: "none" }}>See all</Link>
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
                trailing={unreadBadge(d.unread)}
              />
            ))}
          </div>
        </>
      )}

      <div style={{ flex: 1 }} />
      <div style={{ padding: "0 10px 8px" }}>
        <NavRow href="/settings" label="Settings" active={pathname === "/settings"} collapsed={collapsed} icon={<NavIcon><path d="M12 15a3 3 0 100-6 3 3 0 000 6z" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" /></NavIcon>} />
      </div>
      <div style={{ padding: collapsed ? "0 10px 16px" : "0 16px 16px" }}>
        {collapsed ? (
          <button
            className="btn btn-secondary"
            style={{ width: "100%", padding: 8 }}
            title="Log out"
            aria-label="Log out"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <NavIcon><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></NavIcon>
          </button>
        ) : (
          <button className="btn btn-secondary btn-block" onClick={() => signOut({ callbackUrl: "/login" })}>
            Log out
          </button>
        )}
      </div>
    </aside>
  );
}
