"use client";

import { useRouter } from "next/navigation";
import "./NotFoundPage.css";
import { isAuthenticated } from "../../services/session";

const NotFoundPage = () => {
  const router = useRouter();

  const handleGoBack = () => {
    router.push(isAuthenticated() ? "/dashboard" : "/");
  };

  return (
    <div className="not-found-page">
      <div className="not-found-card">
        <span className="not-found-code">404</span>
        <h1>Page Not Found</h1>
        <p>The page you&apos;re looking for doesn&apos;t exist or may have moved.</p>
        <button onClick={handleGoBack}>Go Back</button>
      </div>
    </div>
  );
};

export default NotFoundPage;
