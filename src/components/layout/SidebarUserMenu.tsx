"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "../../contexts/ThemeContext";
import EditPasswordModal from "../ui/EditPasswordModal";
import { logout } from "../../services/authService";
import { clearSession, getCurrentUser } from "../../services/session";

/** User profile block pinned to the bottom of the sidebar — avatar, name,
 * email, and an expand chevron that opens an upward popup (theme toggle,
 * change password, log out). Tailwind-styled. */
const SidebarUserMenu = () => {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const [open, setOpen] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  const currentUser = getCurrentUser();
  const userName = currentUser?.name || "User";
  const userEmail = currentUser?.email || "";

  const initials =
    userName
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join("") || "U";

  const handleLogout = async () => {
    // Clear the httpOnly session cookie server-side first — client JS can't
    // remove it directly — then drop the cached display info.
    try {
      await logout();
    } finally {
      clearSession();
      router.push("/");
    }
  };

  return (
    <div className="relative mt-auto border-t border-white/10 pt-2">
      {open && (
        <div className="absolute bottom-[calc(100%+6px)] left-0 right-0 z-20 rounded-md border border-white/10 bg-[#132240] p-2 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
          <div className="px-2 py-1.5 mb-1">
            <p className="text-[13px] font-semibold text-white truncate">{userName}</p>
            <p className="text-[11px] text-sidebar-fg/80 truncate">{userEmail}</p>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowEditPassword(true);
              setOpen(false);
            }}
            className="w-full text-left px-2 py-1.5 rounded text-[13px] text-sidebar-fg hover:bg-white/10 hover:text-white transition-colors"
          >
            Change Password
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-left px-2 py-1.5 rounded text-[13px] text-red-400 hover:bg-white/10 transition-colors"
          >
            Sign out
          </button>

          <div className="my-1.5 h-px bg-white/10" />

          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[12px] text-sidebar-fg">Dark Mode</span>
            <button
              type="button"
              role="switch"
              aria-checked={theme === "dark"}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              onClick={toggleTheme}
              className={`relative h-4 w-[30px] rounded-full transition-colors ${
                theme === "dark" ? "bg-accent" : "bg-white/15"
              }`}
            >
              <span
                className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
                  theme === "dark" ? "translate-x-[16px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-white/5 transition-colors"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-white">
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-white">{userName}</span>
          <span className="block truncate text-[11px] text-sidebar-fg/80">{userEmail}</span>
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          className={`h-3.5 w-3.5 shrink-0 text-sidebar-fg/70 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6-6 6 6M6 15l6 6 6-6" />
        </svg>
      </button>

      {showEditPassword && <EditPasswordModal onClose={() => setShowEditPassword(false)} />}
    </div>
  );
};

export default SidebarUserMenu;
