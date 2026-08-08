"use client";

import { useEffect, useMemo, useState } from "react";
import "./AdminAccessRequestsPage.css";
import {
  listPendingUsers,
  reviewUser,
  type PendingUser,
} from "../../services/adminService";
import EmptyState from "../../components/ui/EmptyState";
import { SkeletonRows } from "../../components/ui/Skeleton";
import Spinner from "../../components/ui/Spinner";
import Pagination, { usePagination } from "../../components/ui/Pagination";
import { AlertIcon, CheckIcon, XIcon } from "../../components/ui/adminIcons";

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

  // 50 rows/page. There's no search here, so a stable resetKey suffices.
  const { page, setPage, from, to, pageSize } = usePagination(
    requests.length,
    "requests",
    50,
  );
  const paged = useMemo(() => requests.slice(from, to), [requests, from, to]);

  return (
    <div className="admin-requests-page">
      <div className="admin-requests-header">
        <h1>Access Requests</h1>
        <p>Review and approve new users requesting access to the portal.</p>
      </div>

      {error && (
        <div className="admin-requests-error" role="alert">
          <AlertIcon />
          <span>{error}</span>
        </div>
      )}

      {isLoading && (
        <div className="admin-requests-panel">
          <div style={{ padding: 16 }}>
            <SkeletonRows rows={4} cols={4} />
          </div>
        </div>
      )}

      {!isLoading && !error && requests.length === 0 && (
        <EmptyState
          icon="check"
          title="No pending requests"
          description="Every access request has been reviewed. New sign-ups will appear here for approval."
        />
      )}

      {!isLoading && !error && requests.length > 0 && (
        <div className="admin-requests-panel">
          <table className="admin-requests-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Requested</th>
                <th className="admin-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((request) => {
                const busy = actioningId === request.id;
                return (
                  <tr key={request.id}>
                    <td className="request-name">{request.name}</td>
                    <td className="request-email">{request.email}</td>
                    <td className="request-time">
                      {new Date(request.created_at).toLocaleString()}
                    </td>
                    <td className="admin-actions-col">
                      <div className="admin-actions">
                        <button
                          className="admin-btn admin-btn-approve"
                          disabled={busy}
                          onClick={() => handleReview(request.id, "active")}
                        >
                          {busy ? <Spinner size="sm" inline /> : <CheckIcon />}
                          Approve
                        </button>
                        <button
                          className="admin-btn admin-btn-reject"
                          disabled={busy}
                          onClick={() => handleReview(request.id, "rejected")}
                        >
                          <XIcon />
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination
            page={page}
            totalItems={requests.length}
            pageSize={pageSize}
            onPageChange={setPage}
            itemLabel="requests"
          />
        </div>
      )}
    </div>
  );
};

export default AdminAccessRequestsPage;
