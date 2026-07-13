"use client";

import { useEffect, useState } from "react";
import "./welcomeCard.css";
import { getCurrentUser } from "../../services/session";

const WelcomeCard = () => {
  const now = new Date();

  const greeting =
    now.getHours() < 12
      ? "Good Morning"
      : now.getHours() < 17
      ? "Good Afternoon"
      : "Good Evening";

  const currentDate = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Logged-in user name — read after mount to avoid SSR/client mismatch.
  const [userName, setUserName] = useState("User");
  useEffect(() => {
    const name = getCurrentUser()?.name;
    if (name) setUserName(name.split(" ")[0]);
  }, []);

  return (
    <div className="welcome-card">
      <h1>
        {greeting}, {userName}
      </h1>

      <p className="current-date">{currentDate}</p>
    </div>
  );
};

export default WelcomeCard;
