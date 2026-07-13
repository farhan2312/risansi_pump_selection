"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import "./Navbar.css";
import { useTheme } from "../../contexts/ThemeContext";
import EditPasswordModal from "../ui/EditPasswordModal";
import { clearSession, getCurrentUser } from "../../services/session";

const Navbar = () => {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const [menuOpen, setMenuOpen] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  const currentUser = getCurrentUser();
  const userName = currentUser?.name || "User";
  const userEmail = currentUser?.email || "";

  const initials = userName
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");

  const handleLogout = () => {
    clearSession();
    router.push("/");
  };

  return (
    <header className="navbar">
      <div>
        <h2>Pump Selection & Testing Portal</h2>
        <p>Welcome back, {userName.split(" ")[0]}</p>
      </div>

      <div className="navbar-right">
        <button aria-label="Notifications" title="Notifications">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>

        <button
          className="avatar"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-haspopup="true"
          aria-expanded={menuOpen}
        >
          {initials || "U"}
        </button>

        {menuOpen && (
          <div className="avatar-menu">
            <div className="avatar-menu-header">
              <strong>{userName}</strong>
              <span>{userEmail}</span>
            </div>

            <button
              onClick={() => {
                setShowEditPassword(true);
                setMenuOpen(false);
              }}
            >
              Edit Password
            </button>

            <button className="logout-option" onClick={handleLogout}>
              Log Out
            </button>

            <div className="avatar-menu-divider" />

            <div className="theme-toggle-row">
              <span>Dark Mode</span>
              <button
                role="switch"
                aria-checked={theme === "dark"}
                aria-label={
                  theme === "dark"
                    ? "Switch to light mode"
                    : "Switch to dark mode"
                }
                className={`theme-switch ${theme === "dark" ? "on" : ""}`}
                onClick={toggleTheme}
              >
                <span className="theme-switch-knob" />
              </button>
            </div>
          </div>
        )}
      </div>

      {showEditPassword && (
        <EditPasswordModal onClose={() => setShowEditPassword(false)} />
      )}
    </header>
  );
};

export default Navbar;
