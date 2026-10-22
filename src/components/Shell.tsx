import { useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router";
import {
  Bell,
  BookMarked,
  LogOut,
  Mail,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldAlert,
  UserRound,
  X,
} from "lucide-react";
import { useActions } from "../lib/actions";
import { memberNav, staffNav, staffHome, type NavGroup } from "../lib/nav";
import { Btn, cx } from "./ui";
import { fmtDateTime } from "../lib/types";

function useOutside(cb: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) =>
      ref.current && !ref.current.contains(e.target as Node) && cb();
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  });
  return ref;
}

export default function Shell({ kind }: { kind: "staff" | "member" }) {
  const a = useActions();
  const { s } = a;
  const nav = useNavigate();
  const loc = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [touchLayout, setTouchLayout] = useState(false);
  const [menu, setMenu] = useState<"bell" | "mail" | "user" | null>(null);
  const ref = useOutside(() => setMenu(null));
  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse), (any-pointer: coarse)");
    const update = () => setTouchLayout(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    setMobile(false);
    setMenu(null);
  }, [loc.pathname]);
  const sess = s.session;
  if (!sess) return <Navigate to="/login" replace />;
  if ((kind === "member") !== (sess.role === "Member"))
    return (
      <Navigate
        to={sess.role === "Member" ? "/member" : staffHome(sess.role)}
        replace
      />
    );
  const groups: NavGroup[] = (kind === "staff" ? staffNav : memberNav)
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => i.roles.includes(sess.role)),
    }))
    .filter((g) => g.items.length);
  const all = groups.flatMap((g) => g.items);
  const full = (kind === "staff" ? staffNav : memberNav).flatMap(
    (g) => g.items,
  );
  const matched = [...full]
    .sort((x, y) => y.to.length - x.to.length)
    .find((i) => loc.pathname === i.to || loc.pathname.startsWith(i.to + "/"));
  const denied = matched && !matched.roles.includes(sess.role);
  const key = kind === "staff" ? "staff" : sess.userId;
  const user = (kind === "staff" ? s.staff : s.members).find(
    (u) => u.id === sess.userId,
  );
  const unreadN = s.notices.filter((n) => n.toId === key && !n.read);
  const unreadM = s.messages.filter((m) => m.toId === key && !m.read);
  const w = collapsed ? "lg:w-[4.5rem]" : "lg:w-64";
  const sidebar = (
    <nav
      aria-label="Main navigation"
      className="scroll-quiet flex-1 overflow-y-auto px-2 pb-6"
    >
      {groups.map((g) => (
        <div key={g.heading} className="mt-4">
          <div
            className={cx(
              "px-3 pb-1.5 text-[10px] font-extrabold uppercase tracking-[.16em] text-slate-500",
              collapsed && "lg:hidden",
            )}
          >
            {g.heading}
          </div>
          {collapsed && (
            <div className="mx-3 mb-1 hidden border-t border-white/10 lg:block" />
          )}
          {g.items.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.end}
              title={i.label}
              className={({ isActive }) =>
                cx(
                  "group relative mb-0.5 flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-semibold transition",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-slate-300 hover:bg-white/5 hover:text-white",
                  collapsed && "lg:justify-center",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute inset-y-1.5 left-0 w-1 rounded-r bg-brand" />
                  )}
                  <i.icon
                    size={17}
                    className={cx(
                      "shrink-0",
                      isActive
                        ? "text-red-400"
                        : "text-slate-400 group-hover:text-red-300",
                    )}
                  />
                  <span className={cx(collapsed && "lg:hidden")}>
                    {i.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
  const brand = (
    <Link
      to={kind === "staff" ? staffHome(sess.role) : "/member"}
      className="flex h-16 shrink-0 items-center gap-3 px-4"
    >
      <span className="relative h-9 w-9 shrink-0 overflow-hidden">
        <img
          src="/logo-transparent.png"
          alt="NBS College Library System"
          className="absolute left-0 -top-1 h-auto w-9 max-w-none"
        />
      </span>
      <span className={cx("leading-tight", collapsed && "lg:hidden")}>
        <span className="block text-[15px] font-extrabold text-white">
          Library System
        </span>
        <span className="block text-[10px] font-bold uppercase tracking-[.16em] text-red-300">
          {kind === "staff" ? "Staff Portal" : "Member Portal"}
        </span>
      </span>
    </Link>
  );
  const drop =
    "absolute right-0 top-full z-40 mt-2 w-80 max-w-[calc(100vw-1rem)] rounded-lg border border-line bg-white shadow-xl";
  const badge = (n: number) =>
    n > 0 && (
      <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[9px] font-extrabold text-white">
        {n}
      </span>
    );
  return (
    <div className="flex h-full min-w-0 overflow-x-hidden">
      <aside
        className={cx(
          "hidden shrink-0 flex-col bg-side transition-[width] duration-200",
          !touchLayout && "lg:flex",
          w,
        )}
      >
        {brand}
        {sidebar}
      </aside>
      {mobile && (
        <div className={cx("fixed inset-0 z-50", !touchLayout && "lg:hidden")}>
          <div
            className="absolute inset-0 bg-slate-900/60"
            onClick={() => setMobile(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-side">
            <button
              onClick={() => setMobile(false)}
              aria-label="Close menu"
              className="absolute right-2 top-4 text-slate-400"
            >
              <X size={20} />
            </button>
            {brand}
            {sidebar}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-30 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-white px-3 sm:px-5">
          <button
            onClick={() => setMobile(true)}
            aria-label="Open menu"
            className={cx("rounded p-2 text-mute hover:bg-slate-100", !touchLayout && "lg:hidden")}
          >
            <Menu size={20} />
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label="Toggle sidebar"
            className={cx("hidden rounded p-2 text-mute hover:bg-slate-100", !touchLayout && "lg:block")}
          >
            {collapsed ? (
              <PanelLeftOpen size={20} />
            ) : (
              <PanelLeftClose size={20} />
            )}
          </button>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-extrabold text-ink">
              {matched?.label ?? "Library"}
            </div>
            <div className="truncate text-[11px] font-semibold text-mute">
              {kind === "staff" ? `Staff · ${sess.role}` : "Member"}
            </div>
          </div>
          <span className="ml-1 hidden sm:block">
          </span>
          <div ref={ref} className="ml-auto flex items-center gap-1">
            {kind === "member" && (
              <Link
                to="/member/cart"
                aria-label="Cart"
                className="relative rounded p-2 text-mute hover:bg-slate-100"
              >
                <BookMarked size={19} />
                {badge((s.carts[key] ?? []).length)}
              </Link>
            )}
            <div className="relative">
              <button
                onClick={() => setMenu(menu === "bell" ? null : "bell")}
                aria-label="Notifications"
                className="relative rounded p-2 text-mute hover:bg-slate-100"
              >
                <Bell size={19} />
                {badge(unreadN.length)}
              </button>
              {menu === "bell" && (
                <div className={drop}>
                  <div className="flex items-center justify-between border-b border-line px-4 py-2.5 text-xs font-extrabold uppercase tracking-wide text-brand">
                    Notifications
                    <button
                      onClick={() => a.readAllNotices(key)}
                      className="font-semibold normal-case text-mute hover:text-brand"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {s.notices
                      .filter((n) => n.toId === key)
                      .slice(0, 5)
                      .map((n) => (
                        <button
                          key={n.id}
                          onClick={() => {
                            a.readNotice(n.id);
                            nav(`/${kind}/notifications`);
                          }}
                          className={cx(
                            "block w-full border-b border-line px-4 py-2.5 text-left text-sm hover:bg-slate-50",
                            !n.read && "bg-brand-soft/50",
                          )}
                        >
                          <div className="font-semibold">{n.text}</div>
                          <div className="text-[11px] text-mute">
                            {fmtDateTime(n.date)}
                          </div>
                        </button>
                      ))}
                    {!s.notices.some((n) => n.toId === key) && (
                      <div className="p-6 text-center text-sm text-mute">
                        You're all caught up.
                      </div>
                    )}
                  </div>
                  <Link
                    to={`/${kind}/notifications`}
                    className="block px-4 py-2 text-center text-xs font-bold text-brand"
                  >
                    Show all notifications
                  </Link>
                </div>
              )}
            </div>
            <div className="relative">
              <button
                onClick={() => setMenu(menu === "mail" ? null : "mail")}
                aria-label="Messages"
                className="relative rounded p-2 text-mute hover:bg-slate-100"
              >
                <Mail size={19} />
                {badge(unreadM.length)}
              </button>
              {menu === "mail" && (
                <div className={drop}>
                  <div className="border-b border-line px-4 py-2.5 text-xs font-extrabold uppercase tracking-wide text-brand">
                    Message center
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {s.messages
                      .filter((m) => m.toId === key)
                      .slice(0, 4)
                      .map((m) => (
                        <Link
                          key={m.id}
                          to={`/${kind}/messages`}
                          className={cx(
                            "block border-b border-line px-4 py-2.5 text-sm hover:bg-slate-50",
                            !m.read && "bg-brand-soft/50",
                          )}
                        >
                          <div className="truncate font-bold">{m.subject}</div>
                          <div className="truncate text-xs text-mute">
                            {m.body}
                          </div>
                        </Link>
                      ))}
                  </div>
                  <Link
                    to={`/${kind}/messages`}
                    className="block px-4 py-2 text-center text-xs font-bold text-brand"
                  >
                    Read all messages
                  </Link>
                </div>
              )}
            </div>
            <span className="mx-1 hidden h-7 w-px bg-line sm:block" />
            <div className="relative">
              <button
                onClick={() => setMenu(menu === "user" ? null : "user")}
                aria-label="Profile menu"
                className="flex items-center gap-2 rounded p-1.5 hover:bg-slate-100"
              >
                <span className="hidden text-right leading-tight sm:block">
                  <span className="block text-sm font-bold">{user?.name}</span>
                  <span className="block text-[11px] text-mute">
                    {sess.role}
                  </span>
                </span>
                <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-xs font-extrabold text-white">
                  {user?.name
                    .split(" ")
                    .map((x) => x[0])
                    .slice(0, 2)
                    .join("")}
                </span>
              </button>
              {menu === "user" && (
                <div className={cx(drop, "w-52 py-1")}>
                  <Link
                    to={`/${kind}/profile`}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                  >
                    <UserRound size={15} /> Profile & password
                  </Link>
                  <button
                    onClick={() => {
                      a.logout();
                      nav("/login");
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm font-semibold text-brand hover:bg-slate-50"
                  >
                    <LogOut size={15} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="scroll-thin min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-6">
          {denied ? (
            <div className="mx-auto mt-16 max-w-md rounded-lg border border-line bg-white p-8 text-center">
              <ShieldAlert size={40} className="mx-auto text-brand" />
              <h1 className="mt-3 text-xl font-extrabold">Access restricted</h1>
              <p className="mt-1 text-sm text-mute">
                The {sess.role} role can't open “{matched?.label}”. Switch roles
                from the login screen to review it.
              </p>
              <Btn className="mt-4" onClick={() => nav(all[0]?.to ?? "/login")}>
                Go to {all[0]?.label}
              </Btn>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
