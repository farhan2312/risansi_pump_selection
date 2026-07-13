"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "./Sidebar.css";
import { isAdmin } from "../../services/session";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/pump-selection", label: "Pump Selection" },
  { href: "/selection-summary", label: "Reports" },
];

const Sidebar = () => {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Risansi Industries" className="sidebar-logo" />
      </div>

      <nav>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={pathname === link.href ? "active-link" : ""}
          >
            {link.label}
          </Link>
        ))}

        {isAdmin() && (
          <Link
            href="/admin/access-requests"
            className={pathname === "/admin/access-requests" ? "active-link" : ""}
          >
            Access Requests
          </Link>
        )}
      </nav>
    </aside>
  );
};

export default Sidebar;
