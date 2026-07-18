"use client";

import "./welcomeCard.css";
import { useCurrentUser } from "../../contexts/CurrentUserContext";

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

  const { user } = useCurrentUser();
  const userName = user?.name?.split(" ")[0] || "User";

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
