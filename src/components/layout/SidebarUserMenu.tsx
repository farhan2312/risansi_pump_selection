"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "../../contexts/CurrentUserContext";
import { useTheme } from "../../contexts/ThemeContext";
import EditPasswordModal from "../ui/EditPasswordModal";
import { logout } from "../../services/authService";

/** User profile block pinned to the bottom of the sidebar — avatar, name,
 * email, and an expand chevron that opens an upward popup (theme toggle,
 * change password, log out). Tailwind-styled. */
const SidebarUserMenu = () => {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { user: currentUser } = useCurrentUser();

  const [open, setOpen] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  const userName = currentUser?.name || "User";
  const userEmail = currentUser?.email || "";

  const initials =
    userName
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join("") || "U";

  const handleLogout = async () => {
    // Clear the httpOnly session cookie server-side — client JS can't
    // remove it directly.
    try {
      await logout();
    } finally {
      router.push("/");
    }
  };

  // Fixed px throughout (not Tailwind's rem-based p-2/gap-2.5/h-8/etc.) —
  // those scale with the app's 13px root font-size (index.css's "compact
  // scale"), rendering noticeably smaller than intended. Same fix as the
  // pump-selection wizard's formStyles.ts.
  return (
    <div className="relative mt-auto border-t border-white/10 pt-[8px]">
      {open && (
        <div className="absolute bottom-[calc(100%+6px)] left-0 right-0 z-20 rounded-md border border-white/10 bg-[#132240] pl-[8px] pr-[8px] pt-[8px] pb-[8px] shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
          <div className="pl-[8px] pr-[8px] pt-[6px] pb-[6px] mb-[4px]">
            <p className="text-[13px] font-semibold text-white truncate">{userName}</p>
            <p className="text-[11px] text-sidebar-fg/80 truncate">{userEmail}</p>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowEditPassword(true);
              setOpen(false);
            }}
            className="w-full text-left pl-[8px] pr-[8px] pt-[6px] pb-[6px] rounded text-[13px] text-sidebar-fg hover:bg-white/10 hover:text-white transition-colors"
          >
            Change Password
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-left pl-[8px] pr-[8px] pt-[6px] pb-[6px] rounded text-[13px] text-red-400 hover:bg-white/10 transition-colors"
          >
            Sign out
          </button>

          <div className="my-[6px] h-px bg-white/10" />

          <div className="flex items-center justify-between pl-[8px] pr-[8px] pt-[4px] pb-[4px]">
            <span className="text-[12px] text-sidebar-fg">Dark Mode</span>
            <button
              type="button"
              role="switch"
              aria-checked={theme === "dark"}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              onClick={toggleTheme}
              className={`relative h-[16px] w-[30px] rounded-full transition-colors ${
                theme === "dark" ? "bg-accent" : "bg-white/15"
              }`}
            >
              <span
                className={`absolute top-[2px] h-[12px] w-[12px] rounded-full bg-white transition-transform ${
                  theme === "dark" ? "translate-x-[16px]" : "translate-x-[2px]"
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
        className="flex w-full items-center gap-[10px] rounded-md pl-[8px] pr-[8px] pt-[8px] pb-[8px] text-left hover:bg-white/5 transition-colors"
      >
        <span className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-white">
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
          className={`h-[14px] w-[14px] shrink-0 text-sidebar-fg/70 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6-6 6 6M6 15l6 6 6-6" />
        </svg>
      </button>

      {showEditPassword && <EditPasswordModal onClose={() => setShowEditPassword(false)} />}
    </div>
  );
};

export default SidebarUserMenu;
