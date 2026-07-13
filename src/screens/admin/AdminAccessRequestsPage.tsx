"use client";

import { useEffect, useState } from "react";
import "./AdminAccessRequestsPage.css";
import {
  listPendingUsers,
  reviewUser,
  type PendingUser,
} from "../../services/adminService";

const AdminAccessRequestsPage = () => {
  const [requests, setRequests] = useState<PendingUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const loadRequests = () => {
    setIsLoading(true);
    setError(null);
    listPendingUsers()
      .then(setRequests)
      .catch(() => setError("Couldn't load access requests."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleReview = async (id: string, status: "active" | "rejected") => {
    setActioningId(id);
    try {
      await reviewUser(id, status);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError("Couldn't update this request. Please try again.");
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="admin-requests-page">
      <div className="admin-requests-header">
        <h1>Access Requests</h1>
        <p>Review and approve new users requesting access to the portal.</p>
      </div>

      {isLoading && <p>Loading requests...</p>}
      {error && <p className="error-message">{error}</p>}

      {!isLoading && !error && requests.length === 0 && (
        <p className="empty-state">No pending requests.</p>
      )}

      {!isLoading && !error && requests.length > 0 && (
        <table className="admin-requests-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Requested</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id}>
                <td>{request.name}</td>
                <td>{request.email}</td>
                <td>{new Date(request.created_at).toLocaleString()}</td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="approve-btn"
                      disabled={actioningId === request.id}
                      onClick={() => handleReview(request.id, "active")}
                    >
                      Approve
                    </button>
                    <button
                      className="reject-btn"
                      disabled={actioningId === request.id}
                      onClick={() => handleReview(request.id, "rejected")}
                    >
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default AdminAccessRequestsPage;
