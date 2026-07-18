"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import "./Sidebar.css";
import { useCurrentUser } from "../../contexts/CurrentUserContext";
import SidebarUserMenu from "./SidebarUserMenu";

// 15x15 stroke icons (stroke:currentColor, width 1.5) per the Risansi guide §7.7.
const icon = (path: ReactNode) => (
  <svg
    className="nav-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {path}
  </svg>
);

const icons = {
  dashboard: icon(
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </>,
  ),
  projects: icon(<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />),
  pump: icon(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
    </>,
  ),
  reports: icon(
    <>
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M9 13h6M9 17h4" />
    </>,
  ),
  users: icon(
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    </>,
  ),
};

const mainLinks = [
  { href: "/dashboard", label: "Dashboard", icon: icons.dashboard },
  { href: "/projects", label: "Projects", icon: icons.projects },
  { href: "/pump-selection", label: "Pump Selection", icon: icons.pump },
  { href: "/selection-summary", label: "Reports", icon: icons.reports },
];

const Sidebar = () => {
  const pathname = usePathname();
  const { user } = useCurrentUser();

  const navLink = (href: string, label: string, ic: ReactNode) => (
    <Link key={href} href={href} className={pathname === href ? "active-link" : ""}>
      {ic}
      <span>{label}</span>
    </Link>
  );

  return (
    <aside className="sidebar">
      <div className="logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Risansi Industries" className="sidebar-logo" />
      </div>

      <nav className="flex-1">
        <p className="sidebar-group-label">Main</p>
        {mainLinks.map((l) => navLink(l.href, l.label, l.icon))}

        {user?.role === "admin" && (
          <>
            <p className="sidebar-group-label">Admin</p>
            {navLink("/admin/access-requests", "Access Requests", icons.users)}
          </>
        )}
      </nav>

      <SidebarUserMenu />
    </aside>
  );
};

export default Sidebar;
